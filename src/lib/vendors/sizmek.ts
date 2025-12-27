/**
 * Sizmek Vendor Handler
 *
 * Detects Sizmek (Amazon Ad Server) tags.
 * Note: Amazon sunset Sizmek Q4 2024, but tags still exist in the wild.
 */

import type { VendorDetector, VendorDetectionResult } from "@/types";

/**
 * Detects if a tag is a Sizmek tag
 */
function detect(tag: string): VendorDetectionResult | null {
  const sizmekPatterns = [
    // Sizmek serving system
    /bs\.serving-sys\.com/i,
    /serving-sys\.com/i,
    /sizmek\.com/i,
    // Sizmek SDK markers
    /EBLoader/i,
    /EB\.SDK/i,
    /EB\./i,
    // MediaMind (old name)
    /mediamind\.com/i,
  ];

  for (const pattern of sizmekPatterns) {
    if (pattern.test(tag)) {
      return {
        platform: "sizmek",
        tag,
        metadata: extractSizmekMetadata(tag),
      };
    }
  }

  return null;
}

/**
 * Extract metadata from Sizmek tags
 */
function extractSizmekMetadata(tag: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Try to extract placement ID
  const placementMatch = tag.match(/PlacementID=([^&"',\s]+)/i);
  if (placementMatch) {
    metadata.placementId = placementMatch[1];
  }

  // Try to extract ad ID
  const adIdMatch = tag.match(/AdID=([^&"',\s]+)/i);
  if (adIdMatch) {
    metadata.adId = adIdMatch[1];
  }

  return metadata;
}

export const sizmekDetector: VendorDetector = {
  name: "sizmek",
  displayName: "Sizmek",
  detect,
  requiresSpecialRendering: false,
};
