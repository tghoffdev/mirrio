"use client";

import {
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useRef,
  useCallback,
  useImperativeHandle,
} from "react";
import { useMRAID } from "@/hooks/use-mraid";
import { CeltraFrame } from "@/components/celtra-frame";
import { detectVendor, getVendor } from "@/lib/vendors";
import type { VendorDetectionResult } from "@/types";
import type { AdFormatType } from "@/components/size-selector";

export type ContentType = "tag" | "celtra" | "html5";

/** Vendor badge color mapping */
const vendorColors: Record<string, { text: string; bg: string }> = {
  celtra: { text: "text-blue-400", bg: "bg-blue-950/80" },
  google: { text: "text-red-400", bg: "bg-red-950/80" },
  flashtalking: { text: "text-purple-400", bg: "bg-purple-950/80" },
  sizmek: { text: "text-orange-400", bg: "bg-orange-950/80" },
  generic: { text: "text-gray-400", bg: "bg-gray-950/80" },
};

interface PreviewFrameProps {
  width: number;
  height: number;
  tag: string | null;
  /** URL for HTML5 content served by service worker */
  html5Url?: string | null;
  /** Show loading indicator for HTML5 content */
  isLoadingHtml5?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  onReady?: () => void;
  onReload?: () => void;
  onResize?: (width: number, height: number) => void;
  /** Suppress overflow warning (e.g., during recording) */
  suppressOverflowWarning?: boolean;
  /** Countdown number to display (null = no countdown) */
  countdown?: number | null;
  /** Ad format type for expandable support */
  formatType?: AdFormatType;
  /** Expanded dimensions for expandable ads */
  expandedWidth?: number;
  expandedHeight?: number;
  /** Whether the ad is currently expanded */
  isExpanded?: boolean;
  /** Callback when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
}

/** Handle exposed by PreviewFrame ref */
export interface PreviewFrameHandle {
  /** Get the container div element */
  getContainer: () => HTMLDivElement | null;
  /** Get the iframe element (for MRAID tags) */
  getIframe: () => HTMLIFrameElement | null;
}

export const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(
  function PreviewFrame(
    { width, height, tag, html5Url, isLoadingHtml5 = false, backgroundColor = "#18181b", borderColor = "#27272a", onReady, onResize, suppressOverflowWarning = false, countdown = null, formatType = "banner", expandedWidth = 320, expandedHeight = 480, isExpanded = false, onExpandChange },
    ref
  ) {
  const mraid = useMRAID({ width, height });
  const [celtraReady, setCeltraReady] = useState(false);
  const [html5Ready, setHtml5Ready] = useState(false);
  const [doesNotFit, setDoesNotFit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const html5IframeRef = useRef<HTMLIFrameElement>(null);

  // Expose handle methods via ref
  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
    getIframe: () => {
      // For MRAID tags, use the mraid hook's iframe
      const mraidIframe = mraid.getIframe();
      if (mraidIframe) return mraidIframe;
      // For HTML5 content, use the html5 iframe ref
      if (html5IframeRef.current) return html5IframeRef.current;
      // For Celtra, try to find iframe in container
      if (containerRef.current) {
        return containerRef.current.querySelector("iframe");
      }
      return null;
    },
  }), [mraid]);

  // Check if ad fits within container
  const checkFit = useCallback(() => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      // Add some padding buffer (20px)
      const fitsWidth = containerRect.width >= width;
      const fitsHeight = containerRect.height >= height;
      setDoesNotFit(!fitsWidth || !fitsHeight);
    }
  }, [width, height]);

  // Calculate proportional size that fits within container
  const handleResizeToFit = useCallback(() => {
    if (!containerRef.current || !onResize) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    // Add some padding (40px total, 20px each side)
    const availableWidth = containerRect.width - 40;
    const availableHeight = containerRect.height - 40;

    // Calculate scale factors
    const scaleX = availableWidth / width;
    const scaleY = availableHeight / height;

    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    if (scale < 1) {
      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);
      onResize(newWidth, newHeight);
    }
  }, [width, height, onResize]);

  // Check fit on mount, resize, and when dimensions change
  useEffect(() => {
    checkFit();
    window.addEventListener("resize", checkFit);
    return () => window.removeEventListener("resize", checkFit);
  }, [checkFit]);

  // Update iframe dimensions for expandable format
  useEffect(() => {
    if (formatType !== "expandable") return;

    const iframe = mraid.getIframe();
    if (!iframe) return;

    if (isExpanded) {
      // When expanded, iframe should fill container
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    } else {
      // When collapsed, use the collapsed dimensions
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
    }
  }, [isExpanded, formatType, width, height, mraid]);

  // Set container ref
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    []
  );

  // Detect vendor from tag
  const vendorInfo = useMemo((): VendorDetectionResult | null => {
    if (!tag) return null;
    return detectVendor(tag);
  }, [tag]);

  // Get vendor display info
  const vendorDisplay = useMemo(() => {
    if (!vendorInfo) return null;
    const vendor = getVendor(vendorInfo.platform);
    const colors = vendorColors[vendorInfo.platform] || vendorColors.generic;
    return {
      name: vendor?.displayName || vendorInfo.platform,
      ...colors,
    };
  }, [vendorInfo]);

  // Check if this is Celtra with a preview URL (requires special rendering)
  const isCeltraWithPreview = vendorInfo?.platform === "celtra" && vendorInfo.previewUrl;

  // Load tag when it changes or format type changes (non-Celtra only)
  // formatType is included because the container ref changes location based on format
  useEffect(() => {
    console.log("[PreviewFrame] Tag effect triggered", {
      hasTag: !!tag,
      tagLength: tag?.length,
      vendorPlatform: vendorInfo?.platform,
      isCeltraWithPreview,
      formatType,
    });

    if (tag && !isCeltraWithPreview) {
      console.log("[PreviewFrame] Loading tag via MRAID...");
      // Small delay to ensure the new container is mounted when format changes
      const timer = setTimeout(() => {
        mraid.loadTag(tag);
      }, 50);
      return () => clearTimeout(timer);
    } else if (!tag) {
      console.log("[PreviewFrame] Clearing MRAID container");
      mraid.clear();
    } else {
      console.log("[PreviewFrame] Using Celtra preview URL, skipping MRAID");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, isCeltraWithPreview, formatType]);

  // Reset Celtra ready state when tag changes
  useEffect(() => {
    setCeltraReady(false);
  }, [tag]);

  // Reset HTML5 ready state when URL changes
  useEffect(() => {
    setHtml5Ready(false);
  }, [html5Url]);

  // Notify parent when ready
  useEffect(() => {
    const isReady = html5Url
      ? html5Ready
      : isCeltraWithPreview
        ? celtraReady
        : mraid.isReady;
    if (isReady) {
      onReady?.();
    }
  }, [mraid.isReady, celtraReady, html5Ready, isCeltraWithPreview, html5Url, onReady]);

  // Countdown overlay for reload-and-record
  const CountdownOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 rounded-lg">
      <div className="text-center">
        <div className="text-8xl font-bold text-white tabular-nums animate-pulse">
          {countdown}
        </div>
        <p className="text-sm text-white/70 mt-4">Recording will start...</p>
      </div>
    </div>
  );

  // Warning overlay for when ad doesn't fit
  const OverflowWarning = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 rounded-lg">
      <div className="text-center px-6 py-4 bg-background/95 rounded-lg border border-border max-w-sm">
        <p className="text-sm font-medium text-foreground mb-2">
          Ad exceeds viewport
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Expand your browser window or choose a smaller size to capture this ad.
        </p>
        {onResize && (
          <button
            onClick={handleResizeToFit}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Resize to fit
          </button>
        )}
      </div>
    </div>
  );

  // Render HTML5 content from service worker
  if (html5Url) {
    return (
      <div
        ref={setContainerRef}
        className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
        style={{ backgroundColor }}
      >
        {countdown !== null && <CountdownOverlay />}
        {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
        <div
          className="relative overflow-hidden bg-white"
          style={{ border: `1px solid ${borderColor}` }}
        >
          <iframe
            ref={html5IframeRef}
            src={html5Url}
            width={width}
            height={height}
            style={{ border: "none", display: "block" }}
            sandbox="allow-scripts allow-same-origin allow-forms"
            allow="autoplay; fullscreen; encrypted-media"
            onLoad={() => setHtml5Ready(true)}
          />
        </div>

        {/* HTML5 badge */}
        <div className="absolute top-2 left-2 text-xs text-green-400 bg-green-950/80 px-2 py-1 rounded">
          HTML5
        </div>

        {/* Size indicator */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {width} × {height}
        </div>
      </div>
    );
  }

  // Render Celtra ads with preview URL differently
  // For expandable format, use expanded dimensions since Celtra handles its own expansion
  if (tag && isCeltraWithPreview && vendorInfo) {
    const celtraWidth = formatType === "expandable" ? expandedWidth : width;
    const celtraHeight = formatType === "expandable" ? expandedHeight : height;

    return (
      <div
        ref={setContainerRef}
        className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
        style={{ backgroundColor }}
      >
        {countdown !== null && <CountdownOverlay />}
        {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
        <div
          className="relative overflow-hidden bg-white"
          style={{ border: `1px solid ${borderColor}` }}
        >
          <CeltraFrame
            width={celtraWidth}
            height={celtraHeight}
            previewUrl={vendorInfo.previewUrl!}
            onReady={() => setCeltraReady(true)}
          />
        </div>

        {/* Vendor badge */}
        {vendorDisplay && (
          <div className={`absolute top-2 left-2 text-xs ${vendorDisplay.text} ${vendorDisplay.bg} px-2 py-1 rounded`}>
            {vendorDisplay.name}
          </div>
        )}

        {/* Format indicator for expandable */}
        {formatType === "expandable" && (
          <div className="absolute top-2 right-2 text-[10px] text-amber-400 bg-amber-950/80 px-2 py-1 rounded">
            Expandable
          </div>
        )}

        {/* Size indicator */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {celtraWidth} × {celtraHeight}
        </div>
      </div>
    );
  }

  // Render expandable format with mock website shell
  if (formatType === "expandable" && !isCeltraWithPreview && !html5Url) {
    const browserChromeHeight = 36;

    return (
      <div
        ref={setContainerRef}
        className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
        style={{ backgroundColor }}
      >
        {countdown !== null && <CountdownOverlay />}
        {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}

        {/* Mock Website Shell - inlined to prevent remounting */}
        {/* isolation: isolate creates stacking context to contain fixed-position ads */}
        <div
          className="relative bg-white overflow-hidden flex flex-col isolate"
          style={{
            width: expandedWidth,
            height: expandedHeight,
            border: `1px solid ${borderColor}`,
            borderRadius: 8
          }}
        >
          {/* Mock Browser Header - z-10 ensures it stays above content */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200 relative z-10" style={{ height: browserChromeHeight }}>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-2">
              <div className="h-5 bg-white rounded border border-gray-300 px-2 flex items-center">
                <span className="text-[9px] text-gray-400 font-mono truncate">example.com/article</span>
              </div>
            </div>
          </div>

          {/* Mock Website Content - isolate contains expanded ad stacking context */}
          <div className="flex-1 overflow-hidden relative isolate">
            {/* Mock article content - hidden when expanded */}
            {!isExpanded && (
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-full" />
                <div className="h-2.5 bg-gray-100 rounded w-5/6" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
              </div>
            )}

            {/* Ad Container - always the same element, just changes size/position */}
            <div
              className={`relative transition-all duration-300 overflow-hidden ${
                isExpanded
                  ? "absolute inset-0 z-[5]"
                  : "mx-auto my-2 cursor-pointer hover:scale-[1.01]"
              }`}
              style={isExpanded ? {} : { width, height }}
              onClick={!isExpanded ? () => onExpandChange?.(true) : undefined}
            >
              <div
                ref={mraid.containerRef}
                className="w-full h-full bg-white overflow-hidden"
                style={{ border: isExpanded ? "none" : `1px solid ${borderColor}` }}
              />

              {/* Tap to expand hint - only when collapsed */}
              {!isExpanded && tag && (
                <div className="absolute bottom-1 right-1 text-[8px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
                  Tap to expand
                </div>
              )}

              {/* Close button - only when expanded */}
              {isExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpandChange?.(false);
                  }}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* More mock content - hidden when expanded */}
            {!isExpanded && (
              <div className="p-3 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-full" />
                <div className="h-2.5 bg-gray-100 rounded w-4/5" />
                <div className="h-2.5 bg-gray-100 rounded w-5/6" />
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
              </div>
            )}

            {/* Loading indicator */}
            {mraid.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[6]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading ad...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vendor badge */}
        {vendorDisplay && tag && (
          <div className={`absolute top-2 left-2 text-xs ${vendorDisplay.text} ${vendorDisplay.bg} px-2 py-1 rounded`}>
            {vendorDisplay.name}
          </div>
        )}

        {/* Format indicator */}
        <div className="absolute top-2 right-2 text-[10px] text-amber-400 bg-amber-950/80 px-2 py-1 rounded">
          Expandable
        </div>

        {/* Size indicator */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {isExpanded ? `${expandedWidth} × ${expandedHeight}` : `${width} × ${height}`} {isExpanded && "(expanded)"}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setContainerRef}
      className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
      style={{ backgroundColor }}
    >
      {countdown !== null && <CountdownOverlay />}
      {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
      {/* Container for the MRAID iframe */}
      <div
        ref={mraid.containerRef}
        className="relative overflow-hidden bg-white"
        style={{ width, height, border: `1px solid ${borderColor}` }}
      >
        {/* Show placeholder when no content loaded */}
        {!tag && !html5Url && !mraid.isLoading && !isLoadingHtml5 && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95">
            <div className="text-center px-6">
              <div className="mb-4 text-emerald-500/30">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-mono text-sm text-foreground/40 mb-1">
                No preview loaded
              </p>
              <p className="font-mono text-xs text-foreground/25">
                Paste a tag or upload HTML5
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator for HTML5 */}
        {isLoadingHtml5 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                Loading HTML5 ad...
              </span>
            </div>
          </div>
        )}

        {/* Loading indicator for MRAID */}
        {mraid.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                Loading ad...
              </span>
            </div>
          </div>
        )}

        {/* Error display */}
        {mraid.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10">
            <div className="text-center px-4">
              <p className="text-destructive font-medium">Error</p>
              <p className="text-sm text-destructive/80">{mraid.error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Vendor badge */}
      {vendorDisplay && tag && (
        <div className={`absolute top-2 left-2 text-xs ${vendorDisplay.text} ${vendorDisplay.bg} px-2 py-1 rounded`}>
          {vendorDisplay.name}
        </div>
      )}

      {/* Size indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {width} × {height}
      </div>
    </div>
  );
});

// Export the hook for external control if needed
export { useMRAID };
