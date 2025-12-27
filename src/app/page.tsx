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
import { TagInput, type InputMode } from "@/components/tag-input";
import { SizeSelector } from "@/components/size-selector";
import { PreviewFrame, type PreviewFrameHandle } from "@/components/preview-frame";
import { BackgroundColorPicker } from "@/components/background-color-picker";
import { CaptureControls } from "@/components/capture-controls";
import { MacroDrawer, MacroEdgeTab } from "@/components/macro-drawer";
import { detectMacros } from "@/lib/macros/detector";
import { scanTextElements, type TextElement } from "@/lib/dco/scanner";
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
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("clip");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webm");

  // Processing hook for MP4 conversion
  const processing = useProcessing();

  // Track when we're in the process of starting a capture (before recording actually begins)
  const [isStartingCapture, setIsStartingCapture] = useState(false);

  // Countdown for reload-and-record
  const [countdown, setCountdown] = useState<number | null>(null);

  // Macro drawer + DCO
  const [macroDrawerOpen, setMacroDrawerOpen] = useState(false);
  const detectedMacros = useMemo(() => detectMacros(tagValue), [tagValue]);
  const [textElements, setTextElements] = useState<TextElement[]>([]);

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
    // Also clear HTML5 content
    if (html5Url) {
      clearHtml5Ad();
      setHtml5Url(null);
      setHtml5EntryPoint(null);
    }
  }, [html5Url]);

  // Scan ad DOM for text elements
  const scanAd = useCallback(() => {
    const iframe = previewFrameRef.current?.getIframe();
    if (iframe) {
      // Delay slightly to ensure ad has fully rendered
      setTimeout(() => {
        const elements = scanTextElements(iframe);
        setTextElements(elements);
        console.log("[DCO] Scanned", elements.length, "text elements");
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
  }, [loadedTag, html5Url, recorder, recordingMode]);

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
                  <span className="text-emerald-400">Einmir</span>
                  <span className="text-foreground/40 mx-1">/</span>
                  <span className="text-foreground/70">Capture</span>
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

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleReload}
                    disabled={!loadedTag && !html5Url}
                    className="p-1 text-foreground/40 hover:text-foreground/80 hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>Reload ad</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClear}
                    disabled={!loadedTag && !html5Url}
                    className="p-1 text-foreground/40 hover:text-foreground/80 hover:bg-foreground/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>Clear</p>
                </TooltipContent>
              </Tooltip>

              <span className="text-foreground/20 mx-1">|</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-mono text-xs">
                  <p>View source</p>
                </TooltipContent>
              </Tooltip>

            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground/40 hover:text-foreground/70 cursor-help transition-colors">
                  [?]
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-xs font-mono text-xs">
                <p>Paste ad tags, render in MRAID sandbox, capture screenshots & video.</p>
                <p className="text-muted-foreground mt-1">Supports Celtra, Google DCM, Flashtalking, Sizmek, and generic MRAID.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      <main className="px-2 py-2 flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-2 h-full">
          {/* Left Column - Controls */}
          <div className="space-y-2 overflow-y-auto">

            {/* Tag Input */}
            <Card>
              <CardHeader className="pb-1 pt-2 px-3">
                <CardTitle className="text-[10px] font-mono font-normal text-foreground/50 uppercase tracking-widest leading-none">Ad Content</CardTitle>
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
            <Card>
              <CardHeader className="pb-1 pt-2 px-3">
                <CardTitle className="text-[10px] font-mono font-normal text-foreground/50 uppercase tracking-widest leading-none">Size</CardTitle>
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
            <Card>
              <CardHeader className="pb-1 pt-2 px-3">
                <CardTitle className="text-[10px] font-mono font-normal text-foreground/50 uppercase tracking-widest leading-none">Background</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <BackgroundColorPicker
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview */}
          <Card className="flex flex-col h-full overflow-hidden">
            {/* Actions Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReload}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
                  Reload
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
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

      {/* Tag Inspector Tab + Drawer */}
      <MacroEdgeTab
        macroCount={detectedMacros.length}
        textCount={textElements.length}
        onClick={() => setMacroDrawerOpen(true)}
      />
      <MacroDrawer
        tag={tagValue}
        open={macroDrawerOpen}
        onOpenChange={setMacroDrawerOpen}
        textElements={textElements}
        onTextElementsChange={setTextElements}
        onRescan={scanAd}
        isCrossOrigin={isCrossOrigin}
      />
    </div>
  );
}
