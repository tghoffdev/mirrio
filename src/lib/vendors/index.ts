/**
 * Vendor Detection Registry
 *
 * Central registry for all ad tag vendor detectors.
 * Detectors are tried in order - first match wins.
 */

import type { VendorDetector, VendorDetectionResult, AdPlatform } from "@/types";
import { celtraDetector } from "./celtra";
import { googleDetector } from "./google";
import { flashtalkingDetector } from "./flashtalking";
import { sizmekDetector } from "./sizmek";
import { adformDetector } from "./adform";

/**
 * Ordered list of vendor detectors.
 * More specific detectors should come first.
 */
const vendors: VendorDetector[] = [
  celtraDetector,
  googleDetector,
  flashtalkingDetector,
  sizmekDetector,
  adformDetector,
];

/**
 * Detect the vendor/platform from an ad tag
 * Returns the first matching vendor or 'generic' if no match
 */
export function detectVendor(tag: string): VendorDetectionResult {
  console.log("[Vendor Detection] Starting detection for tag:", tag.substring(0, 100) + "...");

  for (const vendor of vendors) {
    const result = vendor.detect(tag);
    if (result) {
      console.log("[Vendor Detection] Matched vendor:", vendor.name, {
        platform: result.platform,
        hasPreviewUrl: !!result.previewUrl,
        metadata: result.metadata,
      });
      return result;
    }
  }

  // No vendor matched - return generic
  console.log("[Vendor Detection] No vendor matched, using generic");
  return {
    platform: "generic",
    tag,
  };
}

/**
 * Get a vendor detector by name
 */
export function getVendor(name: AdPlatform): VendorDetector | undefined {
  return vendors.find((v) => v.name === name);
}

/**
 * Get all registered vendors
 */
export function getAllVendors(): VendorDetector[] {
  return [...vendors];
}

/**
 * Check if a vendor requires special rendering
 */
export function requiresSpecialRendering(platform: AdPlatform): boolean {
  const vendor = getVendor(platform);
  return vendor?.requiresSpecialRendering ?? false;
}

// Re-export individual detectors for direct access
export { celtraDetector } from "./celtra";
export { googleDetector } from "./google";
export { flashtalkingDetector } from "./flashtalking";
export { sizmekDetector } from "./sizmek";
export { adformDetector } from "./adform";
