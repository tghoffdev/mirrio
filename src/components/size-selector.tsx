"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdSize } from "@/types";

/**
 * SizeSelector Component
 *
 * Controls for selecting ad dimensions with preset sizes.
 * Supports batch selection for capturing at multiple sizes.
 */

// Interstitial sizes based on most common phone viewports (2024-2025 data)
// Source: Statista, BrowserStack - CSS pixel dimensions
export const INTERSTITIAL_SIZES: AdSize[] = [
  // Standard interstitial
  { width: 320, height: 480, label: "320×480" },
  // Most common Android (11% market share)
  { width: 360, height: 800, label: "360×800" },
  // iPhone 12/13/14/15 standard
  { width: 390, height: 844, label: "390×844" },
  // iPhone 14/15 Pro
  { width: 393, height: 852, label: "393×852" },
  // iPhone 11, XR, XS Max
  { width: 414, height: 896, label: "414×896" },
  // High-end Android (Samsung, Pixel)
  { width: 412, height: 915, label: "412×915" },
  // iPhone Pro Max
  { width: 430, height: 932, label: "430×932" },
  // iPad portrait
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

interface SizeSelectorProps {
  width: number;
  height: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  batchSizes?: AdSize[];
  onBatchSizesChange?: (sizes: AdSize[]) => void;
}

export function SizeSelector({
  width,
  height,
  onWidthChange,
  onHeightChange,
  batchSizes = [],
  onBatchSizesChange,
}: SizeSelectorProps) {
  // Local string state for inputs to allow free editing
  const [widthStr, setWidthStr] = useState(String(width));
  const [heightStr, setHeightStr] = useState(String(height));

  // Sync local state when props change (e.g., from preset clicks)
  useEffect(() => {
    setWidthStr(String(width));
  }, [width]);

  useEffect(() => {
    setHeightStr(String(height));
  }, [height]);

  const handleWidthSubmit = () => {
    const val = parseInt(widthStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onWidthChange(val);
    } else {
      // Reset to current valid value
      setWidthStr(String(width));
    }
  };

  const handleHeightSubmit = () => {
    const val = parseInt(heightStr, 10);
    if (!isNaN(val) && val >= 50 && val <= 2000) {
      onHeightChange(val);
    } else {
      // Reset to current valid value
      setHeightStr(String(height));
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
  };

  const isSelected = (size: AdSize) =>
    size.width === width && size.height === height;

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

  return (
    <div className="space-y-4 w-full">
      {/* Manual inputs */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="width" className="text-sm text-muted-foreground">
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
          <label htmlFor="height" className="text-sm text-muted-foreground">
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

      {/* Interstitial presets */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Interstitial
        </span>
        <div className="flex flex-wrap gap-1.5">
          {INTERSTITIAL_SIZES.map((size) => (
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

      {/* Banner presets */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Banner
        </span>
        <div className="flex flex-wrap gap-1.5">
          {BANNER_SIZES.map((size) => (
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

      {/* Batch capture selection - hidden for now */}
      {false && onBatchSizesChange && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
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
