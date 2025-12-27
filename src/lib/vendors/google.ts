/**
 * Google DCM/CM360 Vendor Handler
 *
 * Detects Google Campaign Manager (formerly DoubleClick) tags.
 */

import type { VendorDetector, VendorDetectionResult } from "@/types";

/**
 * Detects if a tag is a Google DCM/CM360 tag
 */
function detect(tag: string): VendorDetectionResult | null {
  const googlePatterns = [
    // DCM/CM360 patterns
    /doubleclick\.net/i,
    /googleads\.g\.doubleclick\.net/i,
    /googlesyndication\.com/i,
    /googletagservices\.com/i,
    // DCM INS tag class
    /class=['"]dcmads['"]/i,
    // Google Studio
    /studio\.google\.com/i,
    /tpc\.googlesyndication\.com/i,
    // Google Web Designer exports
    /gwd-/i,
  ];

  for (const pattern of googlePatterns) {
    if (pattern.test(tag)) {
      return {
        platform: "google",
        tag,
        metadata: extractGoogleMetadata(tag),
      };
    }
  }

  return null;
}

/**
 * Extract metadata from Google tags
 */
function extractGoogleMetadata(tag: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Try to extract campaign ID
  const campaignMatch = tag.match(/dc_iu=([^&"']+)/i);
  if (campaignMatch) {
    metadata.campaignId = campaignMatch[1];
  }

  // Try to extract creative ID
  const creativeMatch = tag.match(/dc_cid=([^&"']+)/i);
  if (creativeMatch) {
    metadata.creativeId = creativeMatch[1];
  }

  return metadata;
}

export const googleDetector: VendorDetector = {
  name: "google",
  displayName: "Google DCM",
  detect,
  requiresSpecialRendering: false,
};
