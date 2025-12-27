"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagInput, type InputMode } from "@/components/tag-input";
import { SizeSelector } from "@/components/size-selector";
import { PreviewFrame, type PreviewFrameHandle } from "@/components/preview-frame";
import { BackgroundColorPicker } from "@/components/background-color-picker";
import { CaptureControls } from "@/components/capture-controls";
import { AuditPanel, type MRAIDEvent } from "@/components/audit-panel";
import { scanTextElements, updateTextElement, type TextElement } from "@/lib/dco/scanner";
import { detectMacros, scanIframeForMacros, type DetectedMacro } from "@/lib/macros/detector";
import { detectVendor } from "@/lib/vendors";
import {
  useRecorder,
  downloadVideo,
  type RecordingMode,
  type CropConfig,
} from "@/hooks/use-recorder";
import { captureScreenshot, downloadScreenshot } from "@/lib/capture/screenshot";
import { createZipArchive, downloadBlob, type ZipFile } from "@/lib/capture/zip";
import { useProcessing } from "@/hooks/use-processing";
import type { AdSize, OutputFormat } from "@/types";
import {
  registerServiceWorker,
  loadHtml5Ad,
  getPreviewUrl,
  clearHtml5Ad,
  updateConfig,
} from "@/lib/html5/sw-manager";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

export default function Home() {
  const [tagValue, setTagValue] = useState("");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(250);

  // The tag that's currently loaded in the preview
  const [loadedTag, setLoadedTag] = useState<string | null>(null);
  const [isAdReady, setIsAdReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // HTML5 zip upload state
  const [inputMode, setInputMode] = useState<InputMode>("tag");
  const [html5Url, setHtml5Url] = useState<string | null>(null);
  const [html5EntryPoint, setHtml5EntryPoint] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [isLoadingHtml5, setIsLoadingHtml5] = useState(false);

  // Preview settings
  const [backgroundColor, setBackgroundColor] = useState("#18181b");
  const [borderColor, setBorderColor] = useState("#27272a");
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("clip");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webm");

  // MRAID events
  const [mraidEvents, setMraidEvents] = useState<MRAIDEvent[]>([]);

  // Processing hook for MP4 conversion
  const processing = useProcessing();

  // Track when we're in the process of starting a capture (before recording actually begins)
  const [isStartingCapture, setIsStartingCapture] = useState(false);

  // Countdown for reload-and-record
  const [countdown, setCountdown] = useState<number | null>(null);

  // Audit panel + DCO
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [html5Macros, setHtml5Macros] = useState<DetectedMacro[]>([]);
  // Store text modifications to re-apply after reload (originalText -> currentText)
  const pendingTextModsRef = useRef<Map<string, string>>(new Map());
  // Track which content we've already auto-opened audit panel for (to avoid re-opening on reload)
  const autoOpenedForRef = useRef<string | null>(null);

  // Help highlight state
  type HighlightSection = "content" | "size" | "display" | "preview" | "audit" | null;
  const [highlightedSection, setHighlightedSection] = useState<HighlightSection>(null);

  // Check if current tag is cross-origin (Celtra preview, etc.)
  const isCrossOrigin = useMemo(() => {
    if (!loadedTag) return false;
    const vendorInfo = detectVendor(loadedTag);
    // Celtra with preview URL loads external content
    return vendorInfo.platform === "celtra" && !!vendorInfo.previewUrl;
  }, [loadedTag]);

  // Ref for the preview frame (used for clip recording mode and DCO scanning)
  const previewFrameRef = useRef<PreviewFrameHandle>(null);

  // Batch capture sizes
  const [batchSizes, setBatchSizes] = useState<AdSize[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentSize: string;
  } | null>(null);

  // Key to force reload the preview
  const [previewKey, setPreviewKey] = useState(0);

  // Ref to the preview container for screenshots
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Ref to resolve a promise when ad becomes ready (for reload-and-record)
  const adReadyResolverRef = useRef<(() => void) | null>(null);

  // Refs to track current dimensions and format for recording (avoids stale closures)
  const dimensionsRef = useRef({ width, height });
  dimensionsRef.current = { width, height };
  const outputFormatRef = useRef(outputFormat);
  outputFormatRef.current = outputFormat;

  // Recording hook - use ref for dimensions to avoid stale closure
  const recorder = useRecorder({
    onRecordingComplete: async (blob) => {
      const { width: w, height: h } = dimensionsRef.current;
      const format = outputFormatRef.current;
      const timestamp = Date.now();

      if (format === "mp4") {
        // Convert to MP4
        const mp4Blob = await processing.processVideo(blob, "mp4");
        downloadVideo(mp4Blob, `recording-${w}x${h}-${timestamp}.mp4`);
      } else {
        // Download as WebM directly
        downloadVideo(blob, `recording-${w}x${h}-${timestamp}.webm`);
      }
    },
  });

  // Register service worker on mount for HTML5 zip support
  useEffect(() => {
    registerServiceWorker().then((ready) => {
      setSwReady(ready);
      if (!ready) {
        console.warn("Service worker not available - HTML5 zip upload disabled");
      }
    });
  }, []);

  // Listen for MRAID events from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "mraid-event") {
        const newEvent: MRAIDEvent = {
          id: `${event.data.timestamp}-${Math.random().toString(36).slice(2)}`,
          type: event.data.event,
          args: event.data.args,
          timestamp: event.data.timestamp,
        };
        setMraidEvents((prev) => [...prev.slice(-9), newEvent]);
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setMraidEvents((prev) => prev.filter((e) => e.id !== newEvent.id));
        }, 5000);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Clear MRAID events when tag changes
  useEffect(() => {
    setMraidEvents([]);
  }, [loadedTag, html5Url]);

  // Auto-open audit panel on initial load (not reload) when macros or text exist
  useEffect(() => {
    // Create a content identity key
    const contentKey = loadedTag || html5Url || null;

    // Skip if no content or already auto-opened for this content
    if (!contentKey || autoOpenedForRef.current === contentKey) {
      return;
    }

    const hasTagMacros = loadedTag ? detectMacros(loadedTag).length > 0 : false;
    const hasHtml5Macros = html5Macros.length > 0;
    const hasTextElements = textElements.length > 0;

    if (hasTagMacros || hasHtml5Macros || hasTextElements) {
      setAuditPanelOpen(true);
      autoOpenedForRef.current = contentKey;
    }
  }, [loadedTag, html5Url, textElements, html5Macros]);

  // Update service worker config when dimensions change (for HTML5 content)
  useEffect(() => {
    if (html5Url) {
      updateConfig({ width, height });
    }
  }, [width, height, html5Url]);

  // Handle HTML5 zip upload
  const handleHtml5Load = useCallback(
    async (result: ZipLoadResult) => {
      if (!swReady) {
        console.error("Service worker not ready");
        return;
      }

      setIsLoadingHtml5(true);
      try {
        // Clear any existing tag content
        setLoadedTag(null);
        setIsAdReady(false);

        // Load files into service worker
        await loadHtml5Ad(result.files, { width, height });

        // Set the preview URL
        const url = getPreviewUrl(result.entryPoint);
        setHtml5EntryPoint(result.entryPoint);
        setHtml5Url(url);
        setPreviewKey((k) => k + 1);
      } catch (error) {
        console.error("Failed to load HTML5 ad:", error);
      } finally {
        setIsLoadingHtml5(false);
      }
    },
    [swReady, width, height]
  );

  const handleLoadTag = useCallback(() => {
    console.log("[Page] handleLoadTag called", {
      tagValueLength: tagValue.length,
      tagValueTrimmed: tagValue.trim().length,
      hasHtml5Url: !!html5Url,
    });
    if (tagValue.trim()) {
      // Clear HTML5 content when loading a tag
      if (html5Url) {
        clearHtml5Ad();
        setHtml5Url(null);
        setHtml5EntryPoint(null);
      }
      console.log("[Page] Setting loadedTag:", tagValue.trim().substring(0, 100) + "...");
      setLoadedTag(tagValue.trim());
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
    } else {
      console.log("[Page] handleLoadTag - tagValue is empty, skipping");
    }
  }, [tagValue, html5Url]);

  // Handle macro replacement - updates tag and reloads
  const handleMacrosChange = useCallback((modifiedTag: string) => {
    setTagValue(modifiedTag);
    setLoadedTag(modifiedTag);
    setIsAdReady(false);
    setPreviewKey((k) => k + 1);
  }, []);

  // Handle text modifications reload - stores mods and reloads
  const handleTextReloadWithChanges = useCallback(() => {
    // Store current text modifications to re-apply after reload
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });
    console.log("[DCO] Stored", pendingTextModsRef.current.size, "text modifications for reload");
    // Trigger reload
    setIsAdReady(false);
    setPreviewKey((k) => k + 1);
  }, [textElements]);

  const handleReload = useCallback(() => {
    if (loadedTag || html5Url) {
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
    }
  }, [loadedTag, html5Url]);

  const handleClear = useCallback(() => {
    setLoadedTag(null);
    setIsAdReady(false);
    setTagValue("");
    setTextElements([]); // Clear DCO text elements
    setHtml5Macros([]); // Clear HTML5 macros
    autoOpenedForRef.current = null; // Reset so next content will auto-open
    // Also clear HTML5 content
    if (html5Url) {
      clearHtml5Ad();
      setHtml5Url(null);
      setHtml5EntryPoint(null);
    }
  }, [html5Url]);

  // Scan ad DOM for text elements and macros
  const scanAd = useCallback(() => {
    const iframe = previewFrameRef.current?.getIframe();
    if (iframe) {
      // Delay slightly to ensure ad has fully rendered
      setTimeout(async () => {
        let elements = scanTextElements(iframe);
        console.log("[DCO] Scanned", elements.length, "text elements");

        // Scan for HTML5 macros in iframe content (async - fetches external scripts)
        const macros = await scanIframeForMacros(iframe);
        console.log("[Macros] Scanned", macros.length, "macros from iframe");
        setHtml5Macros(macros);

        // Check for pending modifications to re-apply
        if (pendingTextModsRef.current.size > 0) {
          console.log("[DCO] Re-applying", pendingTextModsRef.current.size, "pending modifications");
          elements = elements.map(el => {
            const pendingText = pendingTextModsRef.current.get(el.originalText);
            if (pendingText && pendingText !== el.originalText) {
              // Apply the modification to the DOM and update the element
              updateTextElement(el, pendingText);
              return { ...el, currentText: pendingText };
            }
            return el;
          });
          // Clear pending modifications after applying
          pendingTextModsRef.current.clear();
        }

        setTextElements(elements);
      }, 500);
    }
  }, []);

  const handleAdReady = useCallback(() => {
    setIsAdReady(true);
    // If we're waiting for ad ready (reload-and-record), resolve the promise
    if (adReadyResolverRef.current) {
      adReadyResolverRef.current();
      adReadyResolverRef.current = null;
    }
    // Auto-scan for DCO text elements
    scanAd();
  }, [scanAd]);

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    setWidth(newWidth);
    setHeight(newHeight);
  }, []);

  const handleScreenshot = useCallback(async () => {
    const container = previewFrameRef.current?.getContainer();
    if (!container) return;

    // Use ref to ensure we always have the latest dimensions
    const { width: currentWidth, height: currentHeight } = dimensionsRef.current;

    // Set starting capture before the dialog appears
    setIsStartingCapture(true);
    try {
      const result = await captureScreenshot({
        element: container,
        width: currentWidth,
        height: currentHeight,
      });
      downloadScreenshot(result.blob, `screenshot-${currentWidth}x${currentHeight}-${Date.now()}.png`);
    } catch (error) {
      console.error("Screenshot failed:", error);
    } finally {
      setIsStartingCapture(false);
    }
  }, []);

  const handleBatchScreenshot = useCallback(async () => {
    if (!previewContainerRef.current || batchSizes.length === 0) return;

    const originalWidth = width;
    const originalHeight = height;
    const timestamp = Date.now();
    const files: ZipFile[] = [];

    setIsCapturing(true);

    try {
      for (let i = 0; i < batchSizes.length; i++) {
        const size = batchSizes[i];
        setBatchProgress({
          current: i + 1,
          total: batchSizes.length,
          currentSize: size.label,
        });

        // Resize to target size
        setWidth(size.width);
        setHeight(size.height);

        // Wait for resize and render
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capture screenshot
        const result = await captureScreenshot({
          element: previewContainerRef.current!,
          width: size.width,
          height: size.height,
        });

        files.push({
          filename: `screenshot-${size.width}x${size.height}.png`,
          blob: result.blob,
        });

        // Small delay between captures
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Create and download zip
      setBatchProgress({
        current: batchSizes.length,
        total: batchSizes.length,
        currentSize: "Creating zip...",
      });

      const zipBlob = await createZipArchive(files);
      downloadBlob(zipBlob, `screenshots-${timestamp}.zip`);
    } catch (error) {
      console.error("Batch screenshot failed:", error);
    } finally {
      // Restore original size
      setWidth(originalWidth);
      setHeight(originalHeight);
      setBatchProgress(null);
      setIsCapturing(false);
    }
  }, [batchSizes, width, height]);

  const handleStartRecording = useCallback(async () => {
    setIsStartingCapture(true);
    try {
      let cropConfig: CropConfig | null = null;

      if (recordingMode === "clip" && previewFrameRef.current) {
        // Use getter functions for dynamic dimensions
        cropConfig = {
          element: () => previewFrameRef.current?.getContainer() ?? null,
          width: () => dimensionsRef.current.width,
          height: () => dimensionsRef.current.height,
        };
      }

      await recorder.startRecording(cropConfig);
    } catch (error) {
      console.error("Failed to start recording:", error);
    } finally {
      setIsStartingCapture(false);
    }
  }, [recorder, recordingMode]);

  const handleStopRecording = useCallback(async () => {
    try {
      await recorder.stopRecording();
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  }, [recorder]);

  const handleReloadAndRecord = useCallback(async () => {
    if (!loadedTag && !html5Url) return;

    // Store text modifications before reload so they persist
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });

    setIsStartingCapture(true);
    try {
      // Step 1: Request screen capture permission first (shows dialog)
      // This prepares the stream but doesn't start recording yet
      let cropConfig: CropConfig | null = null;

      if (recordingMode === "clip") {
        // Use getter functions so they always get the current element/dimensions
        // (the element changes when the preview reloads, dimensions change on resize)
        cropConfig = {
          element: () => previewFrameRef.current?.getContainer() ?? null,
          width: () => dimensionsRef.current.width,
          height: () => dimensionsRef.current.height,
        };
      }

      // This will show the screen share dialog but NOT start recording
      await recorder.prepareRecording(cropConfig);

      // Step 2: Show countdown (3, 2, 1)
      for (let i = 3; i >= 1; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      // Step 3: Wait for countdown overlay to clear from the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 4: Reload the ad unit and wait for it to be ready
      const adReadyPromise = new Promise<void>((resolve) => {
        adReadyResolverRef.current = resolve;
      });
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);

      // Step 5: Wait for ad to signal ready
      await adReadyPromise;

      // Step 6: Delay after ready to let ad fully render (skip loading animations)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 7: Start the recording now
      recorder.beginPreparedRecording();
    } catch (error) {
      console.error("Failed to start reload-and-record:", error);
      setCountdown(null);
    } finally {
      setIsStartingCapture(false);
    }
  }, [loadedTag, html5Url, recorder, recordingMode, textElements]);

  // Helper to get the iframe element from the preview
  const getPreviewIframe = useCallback((): HTMLIFrameElement | null => {
    return previewFrameRef.current?.getIframe() ?? null;
  }, []);

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* ASCII Header */}
      <header className="w-full border-b border-border/50 bg-black/20 backdrop-blur-sm">
        <TooltipProvider delayDuration={200}>
          <div className="px-4 py-1.5 font-mono text-xs flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-emerald-500/80 cursor-default">{">"}_</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-xs">
                <p>Terminal ready</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground/90 tracking-wider cursor-default">
                  <span className="text-emerald-400">Mirrio</span> Capture
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-xs">
                <p>Ad tag capture toolkit</p>
              </TooltipContent>
            </Tooltip>

            <span className="text-foreground/20 hidden sm:inline">{"///"}</span>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground/30 hidden sm:inline text-[10px] cursor-default">v0.1.0</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-xs">
                <p>Build: tags branch</p>
                <p className="text-muted-foreground">Multi-vendor detection</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {/* Author links */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://tommyhoffman.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/40 hover:text-foreground/70 transition-colors text-[10px]"
                  >
                    tommyhoffman.io
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>Portfolio</p>
                </TooltipContent>
              </Tooltip>

              <span className="text-foreground/20">|</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://x.com/tghoffdev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>@tghoffdev</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://www.linkedin.com/in/tommy-hoffman-73901466/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>LinkedIn</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <span className="text-foreground/20">|</span>

            <Popover onOpenChange={(open) => !open && setHighlightedSection(null)}>
              <PopoverTrigger asChild>
                <span className="text-foreground/40 hover:text-foreground/70 cursor-help transition-colors">
                  [?]
                </span>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-72 font-mono text-xs p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-foreground/5">
                  <p className="font-medium text-foreground">Mirrio Capture</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    MRAID sandbox for ad tag preview & capture
                  </p>
                </div>
                <div className="p-1">
                  <div
                    className="px-2 py-1.5 rounded hover:bg-foreground/5 cursor-default transition-colors"
                    onMouseEnter={() => setHighlightedSection("content")}
                    onMouseLeave={() => setHighlightedSection(null)}
                  >
                    <span className="text-cyan-400">Ad Content</span>
                    <span className="text-foreground/50 ml-2">Paste tags or upload HTML5 zips</span>
                  </div>
                  <div
                    className="px-2 py-1.5 rounded hover:bg-foreground/5 cursor-default transition-colors"
                    onMouseEnter={() => setHighlightedSection("size")}
                    onMouseLeave={() => setHighlightedSection(null)}
                  >
                    <span className="text-purple-400">Size</span>
                    <span className="text-foreground/50 ml-2">Presets, custom dims, batch sizes</span>
                  </div>
                  <div
                    className="px-2 py-1.5 rounded hover:bg-foreground/5 cursor-default transition-colors"
                    onMouseEnter={() => setHighlightedSection("display")}
                    onMouseLeave={() => setHighlightedSection(null)}
                  >
                    <span className="text-orange-400">Display</span>
                    <span className="text-foreground/50 ml-2">Background & border colors</span>
                  </div>
                  <div
                    className="px-2 py-1.5 rounded hover:bg-foreground/5 cursor-default transition-colors"
                    onMouseEnter={() => setHighlightedSection("preview")}
                    onMouseLeave={() => setHighlightedSection(null)}
                  >
                    <span className="text-blue-400">Preview</span>
                    <span className="text-foreground/50 ml-2">Live render, capture tools</span>
                  </div>
                  <div
                    className="px-2 py-1.5 rounded hover:bg-emerald-500/10 cursor-default transition-colors border border-transparent hover:border-emerald-500/30"
                    onMouseEnter={() => {
                      setHighlightedSection("audit");
                      setAuditPanelOpen(true);
                    }}
                    onMouseLeave={() => setHighlightedSection(null)}
                  >
                    <span className="text-emerald-400">Audit</span>
                    <span className="text-foreground/50 ml-2">Macros, text editing, MRAID events</span>
                    <div className="text-[9px] text-emerald-400/60 mt-0.5">
                      Click the tab on the right edge of the controls
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-border bg-foreground/5 text-[10px] text-foreground/40">
                  Supports Celtra, DCM, Flashtalking, Sizmek, generic MRAID
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </TooltipProvider>
      </header>

      <main className="px-2 py-2 flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-2 h-full">
          {/* Left Column - Controls + Audit Panel */}
          <div className="flex h-full overflow-hidden">
            {/* Controls */}
            <div className="w-[380px] shrink-0 space-y-2 overflow-y-auto">

              {/* Tag Input */}
              <Card className={`transition-all duration-300 ${highlightedSection === "content" ? "ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20" : ""}`}>
                <CardHeader className="pb-1 pt-2 px-3">
                  <CardTitle className="text-[10px] font-mono font-normal text-cyan-400/70 uppercase tracking-widest leading-none">Ad Content</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <TagInput
                    value={tagValue}
                    onChange={setTagValue}
                    onLoad={handleLoadTag}
                    onHtml5Load={handleHtml5Load}
                    inputMode={inputMode}
                    onInputModeChange={setInputMode}
                    disabled={false}
                  />
                </CardContent>
              </Card>

              {/* Size Controls */}
              <Card className={`transition-all duration-300 ${highlightedSection === "size" ? "ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20" : ""}`}>
                <CardHeader className="pb-1 pt-2 px-3">
                  <CardTitle className="text-[10px] font-mono font-normal text-purple-400/70 uppercase tracking-widest leading-none">Size</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <SizeSelector
                    width={width}
                    height={height}
                    onWidthChange={setWidth}
                    onHeightChange={setHeight}
                    batchSizes={batchSizes}
                    onBatchSizesChange={setBatchSizes}
                  />
                </CardContent>
              </Card>

              {/* Preview Settings */}
              <Card className={`transition-all duration-300 ${highlightedSection === "display" ? "ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20" : ""}`}>
                <CardHeader className="pb-1 pt-2 px-3">
                  <CardTitle className="text-[10px] font-mono font-normal text-orange-400/70 uppercase tracking-widest leading-none">Display</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Background</label>
                    <BackgroundColorPicker
                      value={backgroundColor}
                      onChange={setBackgroundColor}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Border</label>
                    <div className="flex gap-2 items-center">
                      <div
                        className="w-8 h-8 rounded border border-border flex-shrink-0"
                        style={{ backgroundColor: borderColor }}
                      />
                      <input
                        type="text"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        placeholder="#27272a"
                        className="flex-1 h-8 px-2 font-mono text-sm bg-background border border-input rounded-md"
                      />
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Audit Panel - slides from right */}
            <div className={`transition-all duration-300 ${highlightedSection === "audit" ? "ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 rounded-lg" : ""}`}>
              <AuditPanel
                tag={tagValue}
                open={auditPanelOpen}
                onOpenChange={setAuditPanelOpen}
                textElements={textElements}
                onTextElementsChange={setTextElements}
                onRescan={scanAd}
                isCrossOrigin={isCrossOrigin}
                mraidEvents={mraidEvents}
                onMacrosChange={handleMacrosChange}
                onReloadWithChanges={handleMacrosChange}
                onTextReloadWithChanges={handleTextReloadWithChanges}
                html5Macros={html5Macros}
              />
            </div>
          </div>

          {/* Right Column - Preview */}
          <Card className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${highlightedSection === "preview" ? "ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20" : ""}`}>
            {/* Actions Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReload}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reload
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </Button>
                {isAdReady && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Ready
                  </span>
                )}
              </div>
              <CaptureControls
                recordingState={recorder.state}
                hasContent={(!!loadedTag || !!html5Url) && isAdReady}
                onScreenshot={handleScreenshot}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onReloadAndRecord={handleReloadAndRecord}
                isCapturing={isCapturing}
                batchSizesCount={batchSizes.length}
                onBatchScreenshot={handleBatchScreenshot}
                batchProgress={batchProgress}
                recordingMode={recordingMode}
                onRecordingModeChange={setRecordingMode}
                isRegionCaptureSupported={recorder.isRegionCaptureSupported}
                isCountingDown={countdown !== null}
                outputFormat={outputFormat}
                onOutputFormatChange={setOutputFormat}
                conversionProgress={
                  processing.isProcessing
                    ? { progress: processing.progress, status: processing.status }
                    : null
                }
              />
            </div>
            {/* Preview Area */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <div ref={previewContainerRef} className="h-full">
                <PreviewFrame
                  ref={previewFrameRef}
                  key={previewKey}
                  width={width}
                  height={height}
                  tag={loadedTag}
                  html5Url={html5Url}
                  isLoadingHtml5={isLoadingHtml5}
                  backgroundColor={backgroundColor}
                  borderColor={borderColor}
                  onReady={handleAdReady}
                  onResize={handleResize}
                  suppressOverflowWarning={isStartingCapture || recorder.state.isRecording || recorder.state.isProcessing || isCapturing}
                  countdown={countdown}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

    </div>
  );
}
