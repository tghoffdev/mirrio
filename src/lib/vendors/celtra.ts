/**
 * Celtra Vendor Handler
 *
 * Detects Celtra tags and transforms them to use Celtra's preview sandbox
 * instead of trying to render raw MRAID tags.
 */

import type { VendorDetector, VendorDetectionResult } from "@/types";

/**
 * Builds a Celtra preview sandbox URL from an ad ID
 */
export function buildCeltraPreviewUrl(adId: string): string {
  return `https://preview-sandbox.celtra.com/preview/${adId}/frame`;
}

/**
 * Detects if a tag is a Celtra tag
 */
function detect(tag: string): VendorDetectionResult | null {
  // Check for Celtra CDN patterns
  const celtraPatterns = [
    /cdn\.celtra\.com\/ads\/([a-f0-9]+)\//i,
    /ads\.celtra\.com\/([a-f0-9]+)\//i,
  ];

  for (const pattern of celtraPatterns) {
    const match = tag.match(pattern);
    if (match && match[1]) {
      const adId = match[1];
      return {
        platform: "celtra",
        tag,
        previewUrl: buildCeltraPreviewUrl(adId),
        metadata: { adId },
      };
    }
  }

  // Check for celtra-ad-v class (another indicator)
  if (tag.includes("celtra-ad-v") || tag.includes("celtra.com")) {
    // Try to find any 8-character hex ID in the tag
    const hexIdMatch = tag.match(/\/([a-f0-9]{8})\//i);
    if (hexIdMatch && hexIdMatch[1]) {
      return {
        platform: "celtra",
        tag,
        previewUrl: buildCeltraPreviewUrl(hexIdMatch[1]),
        metadata: { adId: hexIdMatch[1] },
      };
    }

    // No ad ID found, but it's still Celtra
    return {
      platform: "celtra",
      tag,
    };
  }

  return null;
}

export const celtraDetector: VendorDetector = {
  name: "celtra",
  displayName: "Celtra",
  detect,
  requiresSpecialRendering: true,
};

// Legacy export for backwards compatibility
export interface CeltraDetectionResult {
  isCeltra: boolean;
  adId?: string;
  previewUrl?: string;
}

export function detectCeltra(tag: string): CeltraDetectionResult {
  const result = detect(tag);
  if (result) {
    return {
      isCeltra: true,
      adId: result.metadata?.adId,
      previewUrl: result.previewUrl,
    };
  }
  return { isCeltra: false };
}
