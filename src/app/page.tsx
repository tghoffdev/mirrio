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
import { SizeSelector, type AdFormatType } from "@/components/size-selector";
import { PreviewFrame, type PreviewFrameHandle } from "@/components/preview-frame";
import { BackgroundColorPicker } from "@/components/background-color-picker";
import { CaptureControls } from "@/components/capture-controls";
import { AuditPanel, type MRAIDEvent } from "@/components/audit-panel";
import { scanTextElements, updateTextElement, type TextElement } from "@/lib/dco/scanner";
import { detectMacros, scanIframeForMacros, replaceMacroInDOM, clearMacroRegistry, type DetectedMacro } from "@/lib/macros/detector";
import { detectVendor } from "@/lib/vendors";
import {
  useRecorder,
  downloadVideo,
  type RecordingMode,
  type CropConfig,
} from "@/hooks/use-recorder";
import { captureScreenshot, downloadScreenshot } from "@/lib/capture/screenshot";
import { createZipArchive, downloadBlob, type ZipFile } from "@/lib/capture/zip";
import { generateProofPack, downloadProofPack, type ProofPackData } from "@/lib/capture/proof-pack";
import type { ProofCollectionState } from "@/components/audit-panel";

/**
 * Extract a frame from a video blob as a PNG screenshot
 */
async function extractFrameFromVideo(videoBlob: Blob, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    
    video.onloadeddata = () => {
      // Seek to 1 second in (or end if shorter)
      video.currentTime = Math.min(1, video.duration * 0.5);
    };
    
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };
    
    video.load();
  });
}
import { useProcessing } from "@/hooks/use-processing";
import { analytics } from "@/lib/analytics";
import type { AdSize, OutputFormat } from "@/types";
import {
  registerServiceWorker,
  loadHtml5Ad,
  getPreviewUrl,
  clearHtml5Ad,
  updateConfig,
} from "@/lib/html5/sw-manager";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";
import {
  ComplianceEngine,
  createEmptyComplianceData,
  type ComplianceData,
  type ComplianceResult,
  type FileInfo,
  type ClickInfo,
  type PixelInfo,
} from "@/lib/compliance";
import { detectExpandedSize, isExpandableTag } from "@/lib/detect-expanded-size";

export default function Home() {
  const [tagValue, setTagValue] = useState("");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(250);

  // Ad format and expandable sizes
  const [formatType, setFormatType] = useState<AdFormatType>("banner");
  const [expandedWidth, setExpandedWidth] = useState(320);
  const [expandedHeight, setExpandedHeight] = useState(480);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Compliance checking
  const [complianceData, setComplianceData] = useState<ComplianceData>(createEmptyComplianceData());
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [selectedDSP, setSelectedDSP] = useState("generic");
  const complianceEngineRef = useRef(new ComplianceEngine("generic"));

  // Track click macro fix and macro values for proof pack
  const [clickMacroFixApplied, setClickMacroFixApplied] = useState(false);
  const [macroValues, setMacroValues] = useState<Record<string, string>>({});

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
  
  // Proof collection state
  const [proofCollectionState, setProofCollectionState] = useState<ProofCollectionState>("idle");
  const proofRecordingBlobRef = useRef<Blob | null>(null);
  const proofStartTimeRef = useRef<number>(0);
  
  // Track original tag before any fixes are applied (for proof pack)
  const originalTagRef = useRef<string | null>(null);
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

  // Ref to track recording start time for analytics
  const recordingStartTimeRef = useRef<number>(0);

  // Refs to track current dimensions and format for recording (avoids stale closures)
  // For expandable format, use expanded dimensions since that's the container size
  const recordingWidth = formatType === "expandable" ? expandedWidth : width;
  const recordingHeight = formatType === "expandable" ? expandedHeight : height;
  const dimensionsRef = useRef({ width: recordingWidth, height: recordingHeight });
  dimensionsRef.current = { width: recordingWidth, height: recordingHeight };
  const outputFormatRef = useRef(outputFormat);
  outputFormatRef.current = outputFormat;
  // Flag to auto-run compliance after reload
  const autoRunComplianceRef = useRef(false);
  // Refs for compliance auto-run (to avoid stale closures)
  const complianceDataRef = useRef(complianceData);
  complianceDataRef.current = complianceData;
  const selectedDSPRef = useRef(selectedDSP);
  selectedDSPRef.current = selectedDSP;
  const loadedTagRef = useRef(loadedTag);
  loadedTagRef.current = loadedTag;

  // Track if we're collecting proof (to skip auto-download)
  const isCollectingProofRef = useRef(false);

  // Recording hook - use ref for dimensions to avoid stale closure
  const recorder = useRecorder({
    onRecordingComplete: async (blob) => {
      // Skip auto-download if we're collecting proof (proof pack handles its own export)
      if (isCollectingProofRef.current) {
        return;
      }

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

  // Track recent events for deduplication
  // Key: "eventType:timestampBucket" where bucket is timestamp rounded to 500ms
  const recentEventKeysRef = useRef<Set<string>>(new Set());

  // MRAID standard events that we capture via our bridge - skip from AD_EVENT to avoid dupes
  const MRAID_STANDARD_EVENTS = new Set([
    'ready', 'stateChange', 'viewableChange', 'open', 'close', 'expand', 
    'resize', 'playVideo', 'storePicture', 'createCalendarEvent',
    'window.open', 'anchor', 'pixel', 'beacon', 'fetch', 'xhr'
  ]);

  // Listen for MRAID events, custom AD_EVENT events, and compliance data from iframe/service worker
  useEffect(() => {
    // Helper to check for duplicate events (same type within 500ms time bucket)
    const isDuplicateEvent = (eventType: string, timestamp: number): boolean => {
      // Round timestamp to 500ms bucket for deduplication
      const bucket = Math.floor(timestamp / 500) * 500;
      const key = `${eventType}:${bucket}`;
      
      if (recentEventKeysRef.current.has(key)) {
        return true; // Duplicate
      }
      
      recentEventKeysRef.current.add(key);
      
      // Clean up old entries (keep set small)
      if (recentEventKeysRef.current.size > 100) {
        const entries = Array.from(recentEventKeysRef.current);
        entries.slice(0, 50).forEach((k) => recentEventKeysRef.current.delete(k));
      }
      return false;
    };

    const handleMessage = (event: MessageEvent) => {
      // Handle MRAID bridge events
      if (event.data?.type === "mraid-event") {
        const timestamp = event.data.timestamp || Date.now();
        const eventType = event.data.event;
        
        // Skip if duplicate
        if (isDuplicateEvent(eventType, timestamp)) {
          return;
        }

        const newEvent: MRAIDEvent = {
          id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
          type: eventType,
          args: event.data.args,
          timestamp,
        };
        // Keep last 100 events for history (persistent - no auto-removal)
        setMraidEvents((prev) => [...prev.slice(-99), newEvent]);
        // Track MRAID event
        analytics.mraidEvent(event.data.event, event.data.args?.length > 0);

        // Handle expand/close for expandable format
        if (event.data.event === "expand" && formatType === "expandable") {
          setIsExpanded(true);
        } else if (event.data.event === "close" && formatType === "expandable") {
          setIsExpanded(false);
        }
      }

      // Handle custom AD_EVENT postMessages from ad tags (e.g., custom event logging)
      if (event.data?.type === "AD_EVENT") {
        const timestamp = event.data.data?.time ? new Date(event.data.data.time).getTime() : Date.now();
        const eventType = event.data.event || "custom";
        
        // Skip MRAID standard events from AD_EVENT - we already capture these via our bridge
        if (MRAID_STANDARD_EVENTS.has(eventType)) {
          return;
        }
        
        // Skip if duplicate
        if (isDuplicateEvent(eventType, timestamp)) {
          return;
        }

        const newEvent: MRAIDEvent = {
          id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
          type: eventType,
          args: event.data.data ? [event.data.data] : [],
          timestamp,
        };
        setMraidEvents((prev) => [...prev.slice(-99), newEvent]);
        analytics.mraidEvent(event.data.event || "custom", !!event.data.data);
      }

      // Handle compliance file data from service worker
      if (event.data?.type === "compliance-files") {
        console.log("[Compliance] Received file data:", event.data.files?.length, "files");
        setComplianceData((prev) => ({
          ...prev,
          files: event.data.files as FileInfo[],
          timing: {
            ...prev.timing,
            loadStart: event.data.loadStart,
          },
        }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [formatType]);

  // PerformanceObserver to capture network requests from cross-origin iframes (like Celtra)
  // This uses the Resource Timing API which can see all resource loads on the page
  useEffect(() => {
    // Track URLs we've already logged to avoid duplicates
    const seenUrls = new Set<string>();
    
    // Helper to check if URL looks like tracking
    const isTrackingUrl = (url: string): boolean => {
      const patterns = [
        /impression/i, /pixel/i, /track/i, /beacon/i, /analytics/i,
        /click/i, /view/i, /event/i, /collect/i, /ping/i,
        /1x1/i, /spacer/i, /\.gif\?/i, /\.png\?.*cb=/i,
        /doubleclick/i, /adsrvr/i, /adnxs/i, /criteo/i, /taboola/i,
        /outbrain/i, /moat/i, /ias.*\.com/i, /doubleverify/i
      ];
      return patterns.some(p => p.test(url));
    };

    const handleResourceEntry = (entry: PerformanceResourceTiming) => {
      const url = entry.name;
      
      // Skip if already seen, or not tracking-related
      if (seenUrls.has(url)) return;
      if (!isTrackingUrl(url)) return;
      
      // Skip same-origin requests (already captured by MRAID bridge)
      try {
        const urlObj = new URL(url);
        if (urlObj.origin === window.location.origin) return;
      } catch {
        return;
      }
      
      seenUrls.add(url);
      
      // Determine event type from initiator
      let eventType = 'network';
      if (entry.initiatorType === 'img' || entry.initiatorType === 'image') {
        eventType = 'pixel';
      } else if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
        eventType = entry.initiatorType;
      } else if (entry.initiatorType === 'beacon') {
        eventType = 'beacon';
      } else if (entry.initiatorType === 'script') {
        eventType = 'script';
      }
      
      const newEvent: MRAIDEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: eventType,
        args: [url, `via ${entry.initiatorType}`],
        timestamp: performance.timeOrigin + entry.startTime,
      };
      
      setMraidEvents((prev) => [...prev.slice(-99), newEvent]);
    };

    // Process existing entries
    const existingEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    existingEntries.forEach(handleResourceEntry);

    // Observe new entries
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      entries.forEach(handleResourceEntry);
    });

    observer.observe({ type: 'resource', buffered: true });

    return () => {
      observer.disconnect();
    };
  }, [loadedTag, html5Url]); // Re-run when content changes to reset seenUrls

  // Clear MRAID events and compliance result when tag changes
  // (complianceData is set by the load handlers, not cleared here)
  // NOTE: macroValues is NOT reset here - audit-panel.tsx manages its own state
  // and syncs back via onMacroValuesChange. It has smarter "is new tag" detection.
  useEffect(() => {
    setMraidEvents([]);
    setComplianceResult(null);
    setIsExpanded(false); // Reset expanded state on new content
    setClickMacroFixApplied(false); // Reset click macro fix tracking

    // Update loadStart timing here (after state commits) rather than in handleLoadTag
    // This ensures we measure actual ad load time, not React's rendering pipeline
    if (loadedTag || html5Url) {
      setComplianceData((prev) => ({
        ...prev,
        timing: { loadStart: Date.now() },
      }));
    }
  }, [loadedTag, html5Url]);

  // Reset expanded state when format type changes
  useEffect(() => {
    setIsExpanded(false);
  }, [formatType]);

  // Aggregate pixels and clicks from MRAID events into compliance data
  useEffect(() => {
    const pixels: PixelInfo[] = mraidEvents
      .filter((e) => e.type === "pixel" || e.type === "beacon")
      .map((e) => ({
        type: (e.args?.[0] as PixelInfo["type"]) || "tracking",
        url: (e.args?.[1] as string) || "",
        method: e.type === "beacon" ? "beacon" : "image",
      }));

    const clicks: ClickInfo[] = mraidEvents
      .filter((e) => e.type === "open")
      .map((e) => ({
        type: "mraid.open" as const,
        url: e.args?.[0] as string,
        hasHandler: true,
      }));

    setComplianceData((prev) => ({
      ...prev,
      pixels,
      clicks,
    }));
  }, [mraidEvents]);

  // Auto-open audit panel on initial load (not reload) when content is loaded
  // This ensures Collect Proof and compliance are always accessible
  useEffect(() => {
    // Create a content identity key
    const contentKey = loadedTag || html5Url || null;

    // Skip if no content or already auto-opened for this content
    if (!contentKey || autoOpenedForRef.current === contentKey) {
      return;
    }

    // Always auto-open when content is loaded for easy access to Collect Proof
    setAuditPanelOpen(true);
    autoOpenedForRef.current = contentKey;
  }, [loadedTag, html5Url]);

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

      // Track upload
      const fileCount = Object.keys(result.files).length;
      const fileSize = Object.values(result.files).reduce(
        (sum, f) => sum + (f.content?.length || 0),
        0
      );
      analytics.html5Upload(fileSize, fileCount);

      setIsLoadingHtml5(true);
      try {
        // Clear any existing tag content
        setLoadedTag(null);
        setIsAdReady(false);
        originalTagRef.current = null; // Clear original tag when loading HTML5

        // Set compliance data for HTML5 bundle
        // Reset timing completely - don't preserve old mraidReady from previous load
        const complianceFiles: FileInfo[] = Object.entries(result.files).map(
          ([path, data]) => ({
            path,
            size: data.content?.length || 0,
            contentType: data.contentType || "application/octet-stream",
          })
        );
        // Gather source content from all JS/HTML files for macro detection
        const sourceContent = Object.entries(result.files)
          .filter(([path]) => /\.(js|html|htm)$/i.test(path))
          .map(([, data]) => data.content || "")
          .join("\n");
        setComplianceData({
          files: complianceFiles,
          timing: { loadStart: Date.now() },
          clicks: [],
          pixels: [],
          sourceContent,
        });

        // Load files into service worker
        await loadHtml5Ad(result.files, { width, height });

        // Set the preview URL
        const url = getPreviewUrl(result.entryPoint);
        setHtml5EntryPoint(result.entryPoint);
        setHtml5Url(url);
        setPreviewKey((k) => k + 1);
      } catch (error) {
        console.error("Failed to load HTML5 ad:", error);
        analytics.error("html5_load", String(error));
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
    const trimmedTag = tagValue.trim();
    if (trimmedTag) {
      // Track tag paste
      const vendorInfo = detectVendor(trimmedTag);
      analytics.tagPaste(vendorInfo.platform, trimmedTag.length);

      // Auto-detect if tag is expandable and get expanded dimensions
      if (isExpandableTag(trimmedTag)) {
        console.log("[Page] Detected expandable tag, switching to expandable format");
        setFormatType("expandable");

        const detectedSize = detectExpandedSize(trimmedTag);
        if (detectedSize) {
          console.log("[Page] Auto-detected expanded size:", detectedSize);
          setExpandedWidth(detectedSize.width);
          setExpandedHeight(detectedSize.height);
        }
      }

      // Clear HTML5 content when loading a tag
      if (html5Url) {
        clearHtml5Ad();
        setHtml5Url(null);
        setHtml5EntryPoint(null);
      }
      console.log("[Page] Setting loadedTag:", trimmedTag.substring(0, 100) + "...");

      // Set compliance data for inline tags (file size and load start time)
      // Reset timing completely - don't preserve old mraidReady from previous load
      const tagBytes = new Blob([trimmedTag]).size;
      setComplianceData({
        files: [{ path: "inline-tag.html", size: tagBytes, contentType: "text/html" }],
        timing: { loadStart: Date.now() },
        clicks: [],
        pixels: [],
        sourceContent: trimmedTag,
      });

      // Only increment previewKey if loading the SAME tag (reload)
      // Otherwise, the tag change itself will trigger the effect
      const isReload = loadedTag === trimmedTag;
      setLoadedTag(trimmedTag);
      setIsAdReady(false);
      
      // Save the original tag ONLY on first load (not when reloading after a fix)
      // This ensures we capture the pre-fix version for proof packs
      if (!isReload) {
        originalTagRef.current = trimmedTag;
      }
      
      if (isReload) {
        setPreviewKey((k) => k + 1);
      }
    } else {
      console.log("[Page] handleLoadTag - tagValue is empty, skipping");
    }
  }, [tagValue, html5Url, loadedTag]);

  // Handle macro replacement - updates tag and reloads
  const handleMacrosChange = useCallback((modifiedTag: string) => {
    // Store current text modifications to re-apply after reload
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });
    console.log("[Fix] Stored", pendingTextModsRef.current.size, "text modifications before tag fix reload");
    
    setTagValue(modifiedTag);
    // For macro changes, the tag content is different, so the effect will trigger
    // No need to increment previewKey
    setLoadedTag(modifiedTag);
    setIsAdReady(false);
    
    // Also update compliance data with new source content
    // This is critical for click macro fix detection
    const tagBytes = new Blob([modifiedTag]).size;
    setComplianceData({
      files: [{ path: "inline-tag.html", size: tagBytes, contentType: "text/html" }],
      timing: { loadStart: Date.now() },
      clicks: [],
      pixels: [],
      sourceContent: modifiedTag,
    });
  }, [textElements]);

  // Handle sample tag selection from sample browser
  const handleSelectSampleTag = useCallback((tag: string, tagWidth: number, tagHeight: number) => {
    // Set size first
    setWidth(tagWidth);
    setHeight(tagHeight);

    // Auto-detect if tag is expandable and get expanded dimensions
    if (isExpandableTag(tag)) {
      console.log("[Page] Sample tag is expandable, switching format");
      setFormatType("expandable");

      const detectedSize = detectExpandedSize(tag);
      if (detectedSize) {
        console.log("[Page] Auto-detected expanded size from sample:", detectedSize);
        setExpandedWidth(detectedSize.width);
        setExpandedHeight(detectedSize.height);
      }
    } else {
      // Reset to banner format for non-expandable samples
      setFormatType("banner");
    }

    // Clear HTML5 content
    if (html5Url) {
      clearHtml5Ad();
      setHtml5Url(null);
      setHtml5EntryPoint(null);
    }

    // Set compliance data for inline tags
    const tagBytes = new Blob([tag]).size;
    setComplianceData((prev) => ({
      ...prev,
      files: [{ path: "inline-tag.html", size: tagBytes, contentType: "text/html" }],
      timing: {
        ...prev.timing,
        loadStart: Date.now(),
      },
    }));

    // Set and load the tag
    // Note: Don't increment previewKey here - that's only for reloading the same tag
    // The tag change itself will trigger the PreviewFrame effect
    setTagValue(tag);
    setLoadedTag(tag);
    setInputMode("tag");
    setIsAdReady(false);
  }, [html5Url]);

  // Handle sample bundle selection from sample browser
  const handleSelectSampleBundle = useCallback(async (path: string, bundleWidth: number, bundleHeight: number) => {
    if (!swReady) {
      console.error("Service worker not ready");
      return;
    }

    try {
      // Fetch the bundle
      const response = await fetch(`/${path}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch bundle: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Import the zip loader dynamically to avoid circular deps
      const { extractZip } = await import("@/lib/html5/zip-loader");
      // Create a File object from the blob
      const file = new File([blob], "sample.zip", { type: "application/zip" });
      const result = await extractZip(file);

      // Set size
      setWidth(bundleWidth);
      setHeight(bundleHeight);

      // Clear tag content
      setLoadedTag(null);
      setTagValue("");
      setInputMode("html5");

      // Load into service worker
      await loadHtml5Ad(result.files, { width: bundleWidth, height: bundleHeight });

      // Set preview URL
      const url = getPreviewUrl(result.entryPoint);
      setHtml5EntryPoint(result.entryPoint);
      setHtml5Url(url);
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
    } catch (error) {
      console.error("Failed to load sample bundle:", error);
    }
  }, [swReady]);

  // Handle text modifications reload - stores mods and reloads
  const handleTextReloadWithChanges = useCallback(() => {
    // Store current text modifications to re-apply after reload
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });
    console.log("[DCO] Stored", pendingTextModsRef.current.size, "text modifications for reload");
    // Reset timing for fresh measurement
    setComplianceData((prev) => ({
      ...prev,
      timing: { loadStart: Date.now() },
    }));
    // Trigger reload
    setIsAdReady(false);
    setPreviewKey((k) => k + 1);
  }, [textElements]);

  const handleReload = useCallback(() => {
    if (loadedTag || html5Url) {
      setIsAdReady(false);
      // Reset timing for fresh measurement, explicitly preserve files
      setComplianceData((prev) => ({
        ...prev,
        files: prev.files, // Explicitly preserve files
        timing: { loadStart: Date.now() },
      }));
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
    originalTagRef.current = null; // Clear original tag for proof pack
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
      // Clear macro replacement registry (fresh scan = fresh tracking)
      clearMacroRegistry(iframe);

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
    // Track ad load (use ref for loadedTag to avoid dependency)
    const currentTag = loadedTagRef.current;
    if (html5Url) {
      analytics.html5Load(width, height);
    } else if (currentTag) {
      const vendorInfo = detectVendor(currentTag);
      analytics.tagLoad(vendorInfo.platform, width, height);
    }
    // If we're waiting for ad ready (reload-and-record), resolve the promise
    if (adReadyResolverRef.current) {
      adReadyResolverRef.current();
      adReadyResolverRef.current = null;
    }
    // Auto-scan for DCO text elements
    scanAd();

    // Update compliance timing
    setComplianceData((prev) => ({
      ...prev,
      timing: {
        ...prev.timing,
        mraidReady: Date.now(),
      },
    }));

    // Auto-run compliance if flagged (from reload & recheck)
    if (autoRunComplianceRef.current) {
      autoRunComplianceRef.current = false;
      // Defer to allow state to settle
      setTimeout(() => {
        const iframe = previewFrameRef.current?.getIframe();
        let sourceContent: string | undefined;
        try {
          sourceContent = iframe?.contentDocument?.documentElement?.outerHTML;
        } catch {
          // Cross-origin
        }
        // Use refs to get current values without dependency issues
        complianceEngineRef.current.setDSP(selectedDSPRef.current);
        const currentData = complianceDataRef.current;
        const tag = loadedTagRef.current;

        // For inline tags, recalculate file size from the tag itself
        let files = currentData.files;
        if (files.length === 0 && tag) {
          const tagBytes = new Blob([tag]).size;
          files = [{ path: "inline-tag.html", size: tagBytes, contentType: "text/html" }];
        }

        const data: ComplianceData = {
          ...currentData,
          files,
          timing: { loadStart: currentData.timing.loadStart || Date.now(), mraidReady: Date.now() },
          sourceContent: sourceContent || currentData.sourceContent,
        };
        const result = complianceEngineRef.current.runChecks(data);
        setComplianceResult(result);
      }, 150);
    }
  }, [scanAd, html5Url, width, height]);

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    setWidth(newWidth);
    setHeight(newHeight);
  }, []);

  // Handle macro replacement in DOM (for HTML5 content)
  const handleMacroReplaceInDOM = useCallback((macro: DetectedMacro, value: string) => {
    const iframe = previewFrameRef.current?.getIframe();
    if (iframe) {
      replaceMacroInDOM(iframe, macro, value);
    }
  }, []);

  // Run compliance checks
  const handleRunCompliance = useCallback(() => {
    // Get source content from iframe for security/click scanning
    const iframe = previewFrameRef.current?.getIframe();
    let sourceContent: string | undefined;
    try {
      sourceContent = iframe?.contentDocument?.documentElement?.outerHTML;
    } catch {
      // Cross-origin, can't access
    }

    // Use ref to get latest compliance data (avoids stale closure issues)
    const currentData = complianceDataRef.current;
    const tag = loadedTagRef.current;

    // For inline tags, ensure we have file info
    let files = currentData.files;
    if (files.length === 0 && tag) {
      const tagBytes = new Blob([tag]).size;
      files = [{ path: "inline-tag.html", size: tagBytes, contentType: "text/html" }];
    }

    const dataWithSource: ComplianceData = {
      ...currentData,
      files,
      // For cross-origin iframes, fall back to sourceContent from complianceData
      // (which was set from the tag when loaded or fixed)
      sourceContent: sourceContent || currentData.sourceContent,
    };

    complianceEngineRef.current.setDSP(selectedDSPRef.current);
    const result = complianceEngineRef.current.runChecks(dataWithSource);
    setComplianceResult(result);
  }, []);

  // Handle DSP change
  const handleDSPChange = useCallback((dsp: string) => {
    setSelectedDSP(dsp);
    // Re-run checks with new DSP rules if we have a result
    if (complianceResult) {
      complianceEngineRef.current.setDSP(dsp);
      const result = complianceEngineRef.current.runChecks(complianceResult.data);
      setComplianceResult(result);
    }
  }, [complianceResult]);

  // Reload ad and re-run compliance checks
  const handleReloadAndRecheck = useCallback(() => {
    if (!loadedTag && !html5Url) return;

    // Store text modifications before reload so they persist
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });

    // Clear current result
    setComplianceResult(null);
    // Set flag to auto-run compliance when ad is ready
    autoRunComplianceRef.current = true;
    // Reload the ad
    handleReload();
  }, [loadedTag, html5Url, handleReload, textElements]);

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
      // Track screenshot
      const vendor = loadedTag ? detectVendor(loadedTag).platform : "html5";
      analytics.screenshotTaken(currentWidth, currentHeight, vendor);
      analytics.exportDownload("png", result.blob.size);
    } catch (error) {
      console.error("Screenshot failed:", error);
      analytics.error("screenshot", String(error));
    } finally {
      setIsStartingCapture(false);
    }
  }, [loadedTag]);

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
      recordingStartTimeRef.current = Date.now();
      analytics.recordingStart(recordingMode, width, height);
    } catch (error) {
      console.error("Failed to start recording:", error);
      analytics.error("recording_start", String(error));
    } finally {
      setIsStartingCapture(false);
    }
  }, [recorder, recordingMode, width, height]);

  const handleStopRecording = useCallback(async () => {
    try {
      const result = await recorder.stopRecording();
      if (result) {
        const durationMs = Date.now() - recordingStartTimeRef.current;
        analytics.recordingStop(durationMs, outputFormat);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      analytics.error("recording_stop", String(error));
    }
  }, [recorder, outputFormat]);

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
      recordingStartTimeRef.current = Date.now();
    } catch (error) {
      console.error("Failed to start reload-and-record:", error);
      setCountdown(null);
    } finally {
      setIsStartingCapture(false);
    }
  }, [loadedTag, html5Url, recorder, recordingMode, textElements]);

  // Collect Proof workflow - runs compliance, captures screenshot, optionally records, bundles proof pack
  const handleCollectProof = useCallback(async () => {
    if (!loadedTag && !html5Url) return;
    if (proofCollectionState !== "idle") return;

    proofStartTimeRef.current = Date.now();
    proofRecordingBlobRef.current = null;
    isCollectingProofRef.current = true; // Prevent auto-download of recording

    // Capture personalization state BEFORE any reload
    const capturedTextChanges = textElements
      .filter(el => el.currentText !== el.originalText)
      .map(el => ({
        original: el.originalText,
        current: el.currentText,
        type: el.type,
      }));

    // Store text modifications for re-application after reload
    textElements.forEach(el => {
      if (el.currentText !== el.originalText) {
        pendingTextModsRef.current.set(el.originalText, el.currentText);
      }
    });

    try {
      // Step 1: Run compliance checks
      setProofCollectionState("checking");
      handleRunCompliance();
      
      // Wait a moment for compliance to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 2: Prepare for recording
      setProofCollectionState("recording");
      
      let cropConfig: CropConfig | null = null;
      if (previewFrameRef.current) {
        cropConfig = {
          element: () => previewFrameRef.current?.getContainer() ?? null,
          width: () => dimensionsRef.current.width,
          height: () => dimensionsRef.current.height,
        };
      }

      // Request screen capture permission
      await recorder.prepareRecording(cropConfig);

      // Quick countdown (2 seconds for proof)
      for (let i = 2; i >= 1; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reload and wait for ad ready
      const adReadyPromise = new Promise<void>((resolve) => {
        adReadyResolverRef.current = resolve;
      });
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
      await adReadyPromise;
      
      // Let ad fully render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start recording for 3 seconds
      recorder.beginPreparedRecording();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      // Stop and get the recording blob
      let recordingBlob = await recorder.stopRecording();

      // Step 3: Process and bundle
      setProofCollectionState("processing");

      // Convert to MP4 if that's the selected format
      let finalRecordingFormat: "webm" | "mp4" = "webm";
      if (recordingBlob && outputFormat === "mp4") {
        try {
          recordingBlob = await processing.processVideo(recordingBlob, "mp4");
          finalRecordingFormat = "mp4";
        } catch (err) {
          console.warn("MP4 conversion failed, using WebM:", err);
        }
      }
      proofRecordingBlobRef.current = recordingBlob;

      // Extract a frame from the recording as screenshot (avoids second screen capture prompt)
      // Note: Use original WebM blob for frame extraction if we converted to MP4
      let screenshotBlob: Blob | undefined;
      if (recordingBlob) {
        try {
          screenshotBlob = await extractFrameFromVideo(recordingBlob, dimensionsRef.current.width, dimensionsRef.current.height);
        } catch (err) {
          console.warn("Frame extraction failed:", err);
        }
      }

      // Get detected macros
      const macros = loadedTag ? detectMacros(loadedTag) : html5Macros;

      // Get vendor info
      const vendorInfo = loadedTag ? detectVendor(loadedTag) : null;

      // Determine if tag was modified (fix applied or text personalized)
      const originalTag = originalTagRef.current ?? loadedTag;
      const currentTag = loadedTag;
      const tagWasFixed = originalTag !== currentTag;
      const hasTextChanges = capturedTextChanges.length > 0;
      
      // Generate modified tag: either from compliance fix OR by applying text changes
      let modifiedTag: string | undefined;
      if (tagWasFixed) {
        // Tag was modified via compliance fix
        modifiedTag = currentTag ?? undefined;
      } else if (hasTextChanges && originalTag) {
        // Apply text changes to original tag source to create modified version
        let tagWithTextChanges = originalTag;
        for (const change of capturedTextChanges) {
          // Simple string replacement - may need escaping for special chars
          tagWithTextChanges = tagWithTextChanges.replace(
            change.original,
            change.current
          );
        }
        // Only set modifiedTag if changes were actually applied
        if (tagWithTextChanges !== originalTag) {
          modifiedTag = tagWithTextChanges;
        }
      }

      // Build proof pack data
      const proofData: ProofPackData = {
        screenshot: screenshotBlob,
        recording: proofRecordingBlobRef.current ?? undefined,
        recordingFormat: finalRecordingFormat,
        compliance: complianceResult,
        events: mraidEvents,
        macros,
        originalTag: originalTag ?? undefined,
        modifiedTag,
        textChanges: hasTextChanges ? capturedTextChanges : undefined,
        macroValues,
        clickMacroFixApplied,
        metadata: {
          timestamp: new Date().toLocaleString(),
          timestampISO: new Date().toISOString(),
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          dsp: selectedDSP,
          vendor: vendorInfo?.platform,
          version: "1.0.0",
          collectionDurationMs: Date.now() - proofStartTimeRef.current,
        },
      };

      // Generate and download proof pack
      const proofPack = await generateProofPack(proofData);
      downloadProofPack(proofPack);

      setProofCollectionState("complete");
      
      // Reset to idle after a moment
      setTimeout(() => {
        setProofCollectionState("idle");
        isCollectingProofRef.current = false;
      }, 2000);

    } catch (error) {
      console.error("Proof collection failed:", error);
      setProofCollectionState("error");
      setCountdown(null);
      isCollectingProofRef.current = false;
      
      // Reset to idle after showing error
      setTimeout(() => {
        setProofCollectionState("idle");
      }, 3000);
    }
  }, [
    loadedTag,
    html5Url,
    proofCollectionState,
    handleRunCompliance,
    recorder,
    outputFormat,
    complianceResult,
    mraidEvents,
    html5Macros,
    selectedDSP,
    macroValues,
    clickMacroFixApplied,
  ]);

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
                  <span className="text-emerald-400">Doppelist</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-xs">
                <p>Record. Test. Personalize.</p>
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

            {/* Compliance Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <span className="text-foreground/30 hover:text-foreground/50 cursor-pointer transition-colors text-[10px]">
                  [legal]
                </span>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-80 font-mono text-xs p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-foreground/5">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <span className="text-emerald-400">$</span> compliance --status
                  </p>
                </div>
                <div className="p-3 space-y-3 text-[11px]">
                  <div>
                    <p className="text-emerald-400 mb-1">{">"} Data Processing</p>
                    <p className="text-foreground/60 leading-relaxed">
                      All rendering, capture, and personalization happens client-side in your browser.
                      Ad content never touches our servers.
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-400 mb-1">{">"} Analytics</p>
                    <p className="text-foreground/60 leading-relaxed">
                      We use Google Analytics and Vercel Analytics to understand usage patterns.
                      No ad content or personal data is collected.
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-400 mb-1">{">"} Cookies</p>
                    <p className="text-foreground/60 leading-relaxed">
                      Only essential cookies for analytics. No tracking across sites.
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-400 mb-1">{">"} Your Content</p>
                    <p className="text-foreground/60 leading-relaxed">
                      Tags, zips, and captures stay in your browser. Clear your tab, clear your data.
                    </p>
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-border bg-foreground/5 text-[10px] text-foreground/40">
                  <span className="text-emerald-400/60">exit 0</span> · No data retained server-side
                </div>
              </PopoverContent>
            </Popover>

            <Popover onOpenChange={(open) => !open && setHighlightedSection(null)}>
              <PopoverTrigger asChild>
                <span className="text-foreground/40 hover:text-foreground/70 cursor-help transition-colors">
                  [?]
                </span>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-72 font-mono text-xs p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-foreground/5">
                  <p className="font-medium text-foreground">Doppelist</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    Record. Test. Personalize.
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
                    <span className="text-foreground/50 ml-2">Macros, personalize, MRAID events</span>
                    <div className="text-[9px] text-emerald-400/60 mt-0.5">
                      Edit macro values, swap text, intercept clicks
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
              <Card className={`py-2 gap-1 transition-all duration-300 ${highlightedSection === "content" ? "ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20" : ""}`}>
                <CardHeader className="py-1 px-3">
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
                    onSelectSampleTag={handleSelectSampleTag}
                    onSelectSampleBundle={handleSelectSampleBundle}
                    disabled={false}
                  />
                </CardContent>
              </Card>

              {/* Size Controls */}
              <Card className={`py-2 gap-1 transition-all duration-300 ${highlightedSection === "size" ? "ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20" : ""}`}>
                <CardHeader className="py-1 px-3">
                  <CardTitle className="text-[10px] font-mono font-normal text-purple-400/70 uppercase tracking-widest leading-none">Size</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <SizeSelector
                    width={width}
                    height={height}
                    onWidthChange={setWidth}
                    onHeightChange={setHeight}
                    expandedWidth={expandedWidth}
                    expandedHeight={expandedHeight}
                    onExpandedWidthChange={setExpandedWidth}
                    onExpandedHeightChange={setExpandedHeight}
                    formatType={formatType}
                    onFormatTypeChange={setFormatType}
                    batchSizes={batchSizes}
                    onBatchSizesChange={setBatchSizes}
                  />
                </CardContent>
              </Card>

              {/* Preview Settings */}
              <Card className={`py-2 gap-1 transition-all duration-300 ${highlightedSection === "display" ? "ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20" : ""}`}>
                <CardHeader className="py-1 px-3">
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
                      <input
                        type="text"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        placeholder="#27272a"
                        className="flex-1 h-8 px-2 font-mono text-sm bg-background border border-input rounded-md"
                      />
                      <label
                        className="w-8 h-8 rounded border border-border flex-shrink-0 cursor-pointer relative overflow-hidden"
                        style={{ backgroundColor: borderColor }}
                      >
                        <input
                          type="color"
                          value={borderColor}
                          onChange={(e) => setBorderColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </label>
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
                onMacroReplaceInDOM={handleMacroReplaceInDOM}
                isHtml5={!!html5Url}
                complianceResult={complianceResult}
                onRunCompliance={handleRunCompliance}
                onReloadAndRecheck={handleReloadAndRecheck}
                selectedDSP={selectedDSP}
                onDSPChange={handleDSPChange}
                hasContent={!!(loadedTag || html5Url)}
                onCollectProof={handleCollectProof}
                proofCollectionState={proofCollectionState}
                onClickMacroFixApplied={() => setClickMacroFixApplied(true)}
                onMacroValuesChange={setMacroValues}
              />
            </div>
          </div>

          {/* Right Column - Preview */}
          <Card className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${highlightedSection === "preview" ? "ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20" : ""}`}>
            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border">
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
                  formatType={formatType}
                  expandedWidth={expandedWidth}
                  expandedHeight={expandedHeight}
                  isExpanded={isExpanded}
                  onExpandChange={setIsExpanded}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

    </div>
  );
}
