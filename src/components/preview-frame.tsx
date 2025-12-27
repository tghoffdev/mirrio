"use client";

import {
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useRef,
  useCallback,
} from "react";
import { useMRAID } from "@/hooks/use-mraid";
import { CeltraFrame } from "@/components/celtra-frame";
import { detectVendor, getVendor } from "@/lib/vendors";
import type { VendorDetectionResult } from "@/types";

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
  onReady?: () => void;
  onReload?: () => void;
  onResize?: (width: number, height: number) => void;
  /** Suppress overflow warning (e.g., during recording) */
  suppressOverflowWarning?: boolean;
  /** Countdown number to display (null = no countdown) */
  countdown?: number | null;
}

export const PreviewFrame = forwardRef<HTMLDivElement, PreviewFrameProps>(
  function PreviewFrame(
    { width, height, tag, html5Url, isLoadingHtml5 = false, backgroundColor = "#0f0f23", onReady, onResize, suppressOverflowWarning = false, countdown = null },
    ref
  ) {
  const mraid = useMRAID({ width, height });
  const [celtraReady, setCeltraReady] = useState(false);
  const [html5Ready, setHtml5Ready] = useState(false);
  const [doesNotFit, setDoesNotFit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Combine refs
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      // Set local ref
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Forward ref
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
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

  // Load tag when it changes (non-Celtra only)
  useEffect(() => {
    console.log("[PreviewFrame] Tag effect triggered", {
      hasTag: !!tag,
      tagLength: tag?.length,
      vendorPlatform: vendorInfo?.platform,
      isCeltraWithPreview,
    });

    if (tag && !isCeltraWithPreview) {
      console.log("[PreviewFrame] Loading tag via MRAID...");
      mraid.loadTag(tag);
    } else if (!tag) {
      console.log("[PreviewFrame] Clearing MRAID container");
      mraid.clear();
    } else {
      console.log("[PreviewFrame] Using Celtra preview URL, skipping MRAID");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, isCeltraWithPreview]);

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
        ref={setRefs}
        className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
        style={{ backgroundColor }}
      >
        {countdown !== null && <CountdownOverlay />}
        {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
        <div className="relative border border-border rounded overflow-hidden bg-white">
          <iframe
            src={html5Url}
            width={width}
            height={height}
            style={{ border: "none", display: "block" }}
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
  if (tag && isCeltraWithPreview && vendorInfo) {
    return (
      <div
        ref={setRefs}
        className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
        style={{ backgroundColor }}
      >
        {countdown !== null && <CountdownOverlay />}
        {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
        <div className="relative border border-border rounded overflow-hidden bg-white">
          <CeltraFrame
            width={width}
            height={height}
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

        {/* Size indicator */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          {width} × {height}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
      className="relative flex items-center justify-center h-full min-h-[400px] rounded-lg"
      style={{ backgroundColor }}
    >
      {countdown !== null && <CountdownOverlay />}
      {doesNotFit && !suppressOverflowWarning && <OverflowWarning />}
      {/* Container for the MRAID iframe */}
      <div
        ref={mraid.containerRef}
        className="relative border border-border rounded overflow-hidden bg-white"
        style={{ width, height }}
      >
        {/* Show placeholder when no content loaded */}
        {!tag && !html5Url && !mraid.isLoading && !isLoadingHtml5 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted/50">
            <p className="text-center px-4">
              Load an ad tag or upload HTML5 to preview
            </p>
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
