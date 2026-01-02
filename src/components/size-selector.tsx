"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { analytics } from "@/lib/analytics";
import type { AdSize } from "@/types";

/**
 * SizeSelector Component
 *
 * Controls for selecting ad dimensions with preset sizes.
 * Supports three format types: Banner, Interstitial, Expandable.
 * Expandable format has both collapsed (banner) and expanded (fullscreen) sizes.
 */

export type AdFormatType = "banner" | "interstitial" | "expandable";

// Interstitial sizes based on most common phone viewports (2024-2025 data)
export const INTERSTITIAL_SIZES: AdSize[] = [
  { width: 320, height: 480, label: "320×480" },
  { width: 360, height: 800, label: "360×800" },
  { width: 390, height: 844, label: "390×844" },
  { width: 393, height: 852, label: "393×852" },
  { width: 414, height: 896, label: "414×896" },
  { width: 412, height: 915, label: "412×915" },
  { width: 430, height: 932, label: "430×932" },
  { width: 768, height: 1024, label: "768×1024" },
];

// Common banner sizes
export const BANNER_SIZES: AdSize[] = [
  { width: 300, height: 250, label: "300×250" },
  { width: 320, height: 50, label: "320×50" },
  { width: 728, height: 90, label: "728×90" },
  { width: 300, height: 600, label: "300×600" },
  { width: 160, height: 600, label: "160×600" },
  { width: 970, height: 250, label: "970×250" },
  { width: 336, height: 280, label: "336×280" },
  { width: 300, height: 50, label: "300×50" },
];

// Common expandable collapsed sizes (banners that expand)
export const EXPANDABLE_COLLAPSED_SIZES: AdSize[] = [
  { width: 320, height: 50, label: "320×50" },
  { width: 300, height: 250, label: "300×250" },
  { width: 320, height: 100, label: "320×100" },
  { width: 728, height: 90, label: "728×90" },
  { width: 300, height: 50, label: "300×50" },
];

// Common expanded sizes (fullscreen or larger panels)
export const EXPANDABLE_EXPANDED_SIZES: AdSize[] = [
  { width: 320, height: 480, label: "320×480" },
  { width: 360, height: 640, label: "360×640" },
  { width: 390, height: 844, label: "390×844" },
  { width: 414, height: 896, label: "414×896" },
  { width: 768, height: 1024, label: "768×1024" },
];

interface SizeSelectorProps {
  width: number;
  height: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  // Expandable support
  expandedWidth?: number;
  expandedHeight?: number;
  onExpandedWidthChange?: (width: number) => void;
  onExpandedHeightChange?: (height: number) => void;
  // Format type
  formatType?: AdFormatType;
  onFormatTypeChange?: (type: AdFormatType) => void;
  // Batch capture (hidden for now)
  batchSizes?: AdSize[];
  onBatchSizesChange?: (sizes: AdSize[]) => void;
}

export function SizeSelector({
  width,
  height,
  onWidthChange,
  onHeightChange,
  expandedWidth = 320,
  expandedHeight = 480,
  onExpandedWidthChange,
  onExpandedHeightChange,
  formatType = "banner",
  onFormatTypeChange,
  batchSizes = [],
  onBatchSizesChange,
}: SizeSelectorProps) {
  // Local string state for inputs to allow free editing
  const [widthStr, setWidthStr] = useState(String(width));
  const [heightStr, setHeightStr] = useState(String(height));
  const [expandedWidthStr, setExpandedWidthStr] = useState(String(expandedWidth));
  const [expandedHeightStr, setExpandedHeightStr] = useState(String(expandedHeight));

  // Sync local state when props change (e.g., from preset clicks)
  useEffect(() => {
    setWidthStr(String(width));
  }, [width]);

  useEffect(() => {
    setHeightStr(String(height));
  }, [height]);

  useEffect(() => {
    setExpandedWidthStr(String(expandedWidth));
  }, [expandedWidth]);

  useEffect(() => {
    setExpandedHeightStr(String(expandedHeight));
  }, [expandedHeight]);

  const handleWidthSubmit = () => {
    const val = parseInt(widthStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onWidthChange(val);
      analytics.sizeChange(val, height, "manual");
    } else {
      setWidthStr(String(width));
    }
  };

  const handleHeightSubmit = () => {
    const val = parseInt(heightStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onHeightChange(val);
      analytics.sizeChange(width, val, "manual");
    } else {
      setHeightStr(String(height));
    }
  };

  const handleExpandedWidthSubmit = () => {
    const val = parseInt(expandedWidthStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onExpandedWidthChange?.(val);
    } else {
      setExpandedWidthStr(String(expandedWidth));
    }
  };

  const handleExpandedHeightSubmit = () => {
    const val = parseInt(expandedHeightStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onExpandedHeightChange?.(val);
    } else {
      setExpandedHeightStr(String(expandedHeight));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, submitFn: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitFn();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handlePresetClick = (size: AdSize) => {
    onWidthChange(size.width);
    onHeightChange(size.height);
    analytics.sizePresetClick(size.label);
    analytics.sizeChange(size.width, size.height, "preset");
  };

  const handleExpandedPresetClick = (size: AdSize) => {
    onExpandedWidthChange?.(size.width);
    onExpandedHeightChange?.(size.height);
  };

  const isSelected = (size: AdSize) =>
    size.width === width && size.height === height;

  const isExpandedSelected = (size: AdSize) =>
    size.width === expandedWidth && size.height === expandedHeight;

  const isBatchSelected = (size: AdSize) =>
    batchSizes.some((s) => s.width === size.width && s.height === size.height);

  const toggleBatchSize = (size: AdSize) => {
    if (!onBatchSizesChange) return;
    if (isBatchSelected(size)) {
      onBatchSizesChange(
        batchSizes.filter(
          (s) => !(s.width === size.width && s.height === size.height)
        )
      );
    } else {
      onBatchSizesChange([...batchSizes, size]);
    }
  };

  const selectAllBatch = (sizes: AdSize[]) => {
    if (!onBatchSizesChange) return;
    const newSizes = [...batchSizes];
    for (const size of sizes) {
      if (!isBatchSelected(size)) {
        newSizes.push(size);
      }
    }
    onBatchSizesChange(newSizes);
  };

  const clearBatch = () => {
    onBatchSizesChange?.([]);
  };

  // Get the relevant sizes for the current format
  const getPresetSizes = () => {
    switch (formatType) {
      case "interstitial":
        return INTERSTITIAL_SIZES;
      case "expandable":
        return EXPANDABLE_COLLAPSED_SIZES;
      case "banner":
      default:
        return BANNER_SIZES;
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Format Type Toggle */}
      {onFormatTypeChange && (
        <div className="flex gap-1 p-1 bg-foreground/5 rounded-lg">
          {(["banner", "interstitial", "expandable"] as const).map((type) => (
            <button
              key={type}
              onClick={() => onFormatTypeChange(type)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                formatType === type
                  ? "bg-foreground text-background shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {type === "banner" && "Banner"}
              {type === "interstitial" && "Interstitial"}
              {type === "expandable" && "Expandable"}
            </button>
          ))}
        </div>
      )}

      {/* Size inputs - varies based on format */}
      {formatType === "expandable" ? (
        <div className="space-y-4">
          {/* Collapsed (Banner) Size */}
          <div className="space-y-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Collapsed Size
            </span>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="width" className="text-xs text-muted-foreground">
                  W
                </label>
                <Input
                  id="width"
                  type="number"
                  value={widthStr}
                  onChange={(e) => setWidthStr(e.target.value)}
                  onBlur={handleWidthSubmit}
                  onKeyDown={(e) => handleKeyDown(e, handleWidthSubmit)}
                  className="w-20 h-8 text-xs"
                  min={50}
                  max={2000}
                />
              </div>
              <span className="text-muted-foreground text-xs">×</span>
              <div className="flex items-center gap-2">
                <label htmlFor="height" className="text-xs text-muted-foreground">
                  H
                </label>
                <Input
                  id="height"
                  type="number"
                  value={heightStr}
                  onChange={(e) => setHeightStr(e.target.value)}
                  onBlur={handleHeightSubmit}
                  onKeyDown={(e) => handleKeyDown(e, handleHeightSubmit)}
                  className="w-20 h-8 text-xs"
                  min={50}
                  max={2000}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPANDABLE_COLLAPSED_SIZES.map((size) => (
                <Button
                  key={`collapsed-${size.label}`}
                  variant={isSelected(size) ? "default" : "outline"}
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => handlePresetClick(size)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Expanded (Fullscreen) Size */}
          <div className="space-y-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Expanded Size
            </span>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="expanded-width" className="text-xs text-muted-foreground">
                  W
                </label>
                <Input
                  id="expanded-width"
                  type="number"
                  value={expandedWidthStr}
                  onChange={(e) => setExpandedWidthStr(e.target.value)}
                  onBlur={handleExpandedWidthSubmit}
                  onKeyDown={(e) => handleKeyDown(e, handleExpandedWidthSubmit)}
                  className="w-20 h-8 text-xs"
                  min={50}
                  max={2000}
                />
              </div>
              <span className="text-muted-foreground text-xs">×</span>
              <div className="flex items-center gap-2">
                <label htmlFor="expanded-height" className="text-xs text-muted-foreground">
                  H
                </label>
                <Input
                  id="expanded-height"
                  type="number"
                  value={expandedHeightStr}
                  onChange={(e) => setExpandedHeightStr(e.target.value)}
                  onBlur={handleExpandedHeightSubmit}
                  onKeyDown={(e) => handleKeyDown(e, handleExpandedHeightSubmit)}
                  className="w-20 h-8 text-xs"
                  min={50}
                  max={2000}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPANDABLE_EXPANDED_SIZES.map((size) => (
                <Button
                  key={`expanded-${size.label}`}
                  variant={isExpandedSelected(size) ? "default" : "outline"}
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => handleExpandedPresetClick(size)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Standard single size input for banner/interstitial */}
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="width" className="text-xs text-muted-foreground">
                Width
              </label>
              <Input
                id="width"
                type="number"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
                onBlur={handleWidthSubmit}
                onKeyDown={(e) => handleKeyDown(e, handleWidthSubmit)}
                className="w-20"
                min={50}
                max={2000}
              />
            </div>
            <span className="text-muted-foreground">×</span>
            <div className="flex items-center gap-2">
              <label htmlFor="height" className="text-xs text-muted-foreground">
                Height
              </label>
              <Input
                id="height"
                type="number"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                onBlur={handleHeightSubmit}
                onKeyDown={(e) => handleKeyDown(e, handleHeightSubmit)}
                className="w-20"
                min={50}
                max={2000}
              />
            </div>
          </div>

          {/* Presets for current format */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">
              {formatType === "interstitial" ? "Interstitial" : "Banner"} Sizes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {getPresetSizes().map((size) => (
                <Button
                  key={size.label}
                  variant={isSelected(size) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => handlePresetClick(size)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Batch capture selection - hidden for now */}
      {false && onBatchSizesChange && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Batch Capture Sizes
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => selectAllBatch([...INTERSTITIAL_SIZES, ...BANNER_SIZES])}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={clearBatch}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Interstitial batch */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Interstitial</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-5 px-1"
                onClick={() => selectAllBatch(INTERSTITIAL_SIZES)}
              >
                all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERSTITIAL_SIZES.map((size) => (
                <label
                  key={`batch-${size.label}`}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <Checkbox
                    checked={isBatchSelected(size)}
                    onCheckedChange={() => toggleBatchSize(size)}
                  />
                  <span className="text-xs">{size.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Banner batch */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Banner</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-5 px-1"
                onClick={() => selectAllBatch(BANNER_SIZES)}
              >
                all
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {BANNER_SIZES.map((size) => (
                <label
                  key={`batch-${size.label}`}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <Checkbox
                    checked={isBatchSelected(size)}
                    onCheckedChange={() => toggleBatchSize(size)}
                  />
                  <span className="text-xs">{size.label}</span>
                </label>
              ))}
            </div>
          </div>

          {batchSizes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {batchSizes.length} size{batchSizes.length !== 1 ? "s" : ""} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
