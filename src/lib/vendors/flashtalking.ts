/**
 * Flashtalking Vendor Handler
 *
 * Detects Flashtalking (Innovid) tags.
 */

import type { VendorDetector, VendorDetectionResult } from "@/types";

/**
 * Detects if a tag is a Flashtalking tag
 */
function detect(tag: string): VendorDetectionResult | null {
  const flashtalkingPatterns = [
    // Flashtalking CDN
    /flashtalking\.com/i,
    /servedby\.flashtalking\.com/i,
    /cdn\.flashtalking\.com/i,
    // Flashtalking SDK markers
    /FT\.manifest/i,
    /FT\.render/i,
    /FT\._/i,
    // Innovid (parent company)
    /innovid\.com/i,
    /s\.innovid\.com/i,
  ];

  for (const pattern of flashtalkingPatterns) {
    if (pattern.test(tag)) {
      // Determine if it's specifically Innovid or Flashtalking
      const isInnovid = /innovid\.com/i.test(tag);

      return {
        platform: "flashtalking",
        tag,
        metadata: {
          subPlatform: isInnovid ? "innovid" : "flashtalking",
          ...extractFlashtalkingMetadata(tag),
        },
      };
    }
  }

  return null;
}

/**
 * Extract metadata from Flashtalking tags
 */
function extractFlashtalkingMetadata(tag: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Try to extract placement ID
  const placementMatch = tag.match(/placementId[=:]["']?([^&"',\s]+)/i);
  if (placementMatch) {
    metadata.placementId = placementMatch[1];
  }

  // Try to extract campaign ID
  const campaignMatch = tag.match(/campaignId[=:]["']?([^&"',\s]+)/i);
  if (campaignMatch) {
    metadata.campaignId = campaignMatch[1];
  }

  return metadata;
}

export const flashtalkingDetector: VendorDetector = {
  name: "flashtalking",
  displayName: "Flashtalking",
  detect,
  requiresSpecialRendering: false,
};
