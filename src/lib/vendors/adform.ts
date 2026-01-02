/**
 * Adform Vendor Handler
 *
 * Detects Adform HTML5 banners.
 * Adform uses DHTML.js SDK and dhtml.getVar() for parameters.
 */

import type { VendorDetector, VendorDetectionResult } from "@/types";

/**
 * Detects if a tag is an Adform tag
 */
function detect(tag: string): VendorDetectionResult | null {
  const adformPatterns = [
    // Adform DHTML SDK
    /Adform\.DHTML/i,
    /adform\.net/i,
    /dhtml\.getVar/i,
    // Adform variable patterns
    /var\s+dhtml\s*=/i,
    /dhtml\s*\|\|\s*\{\}/i,
    // Adform click handling
    /dhtml\.clickTag/i,
    /clickTAGvalue/i,
    // Adform domains
    /s1\.adform\.net/i,
    /track\.adform\.net/i,
  ];

  for (const pattern of adformPatterns) {
    if (pattern.test(tag)) {
      return {
        platform: "adform",
        tag,
        metadata: extractAdformMetadata(tag),
      };
    }
  }

  return null;
}

/**
 * Extract metadata from Adform tags
 */
function extractAdformMetadata(tag: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Try to extract clickTAG value
  const clickTagMatch = tag.match(/clickTAG['"]\s*[,:]\s*['"]([^'"]+)['"]/i);
  if (clickTagMatch) {
    metadata.clickTag = clickTagMatch[1];
  }

  // Try to extract banner ID from DHTML.js URL
  const bannerIdMatch = tag.match(/banners\/scripts\/([^\/]+)/i);
  if (bannerIdMatch) {
    metadata.bannerId = bannerIdMatch[1];
  }

  return metadata;
}

export const adformDetector: VendorDetector = {
  name: "adform",
  displayName: "Adform",
  detect,
  requiresSpecialRendering: false,
};
