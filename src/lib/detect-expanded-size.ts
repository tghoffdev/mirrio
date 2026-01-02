/**
 * Detect Expanded Size from Ad Tag
 *
 * Parses ad tags to find hardcoded expanded dimensions from CSS or inline styles.
 * Common patterns include:
 * - #expanded { width: 600px; height: 400px; }
 * - .expanded-state { width: 100%; height: 100%; } (responsive - returns null)
 * - data-expanded-width="600" data-expanded-height="400"
 */

export interface DetectedExpandedSize {
  width: number;
  height: number;
  source: "css" | "data-attr" | "inline-style";
}

/**
 * Attempts to detect hardcoded expanded dimensions from an ad tag
 * Returns null if the ad appears to be responsive (uses %, vw, vh, etc.)
 */
export function detectExpandedSize(tag: string): DetectedExpandedSize | null {
  // Pattern 1: CSS rules for #expanded or .expanded with pixel dimensions
  // Match: #expanded { ... width: 600px; ... height: 400px; ... }
  const cssExpandedPattern = /#expanded\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px[^}]*\}/i;
  const cssExpandedMatch = tag.match(cssExpandedPattern);
  if (cssExpandedMatch) {
    return {
      width: parseInt(cssExpandedMatch[1], 10),
      height: parseInt(cssExpandedMatch[2], 10),
      source: "css",
    };
  }

  // Try reverse order (height before width)
  const cssExpandedPatternReverse = /#expanded\s*\{[^}]*height:\s*(\d+)px[^}]*width:\s*(\d+)px[^}]*\}/i;
  const cssExpandedMatchReverse = tag.match(cssExpandedPatternReverse);
  if (cssExpandedMatchReverse) {
    return {
      width: parseInt(cssExpandedMatchReverse[2], 10),
      height: parseInt(cssExpandedMatchReverse[1], 10),
      source: "css",
    };
  }

  // Pattern 2: CSS class .expanded with pixel dimensions
  const cssClassPattern = /\.expanded[^{]*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px[^}]*\}/i;
  const cssClassMatch = tag.match(cssClassPattern);
  if (cssClassMatch) {
    return {
      width: parseInt(cssClassMatch[1], 10),
      height: parseInt(cssClassMatch[2], 10),
      source: "css",
    };
  }

  // Pattern 3: data attributes
  // Match: data-expanded-width="600" data-expanded-height="400"
  const dataWidthMatch = tag.match(/data-expanded-width=["'](\d+)["']/i);
  const dataHeightMatch = tag.match(/data-expanded-height=["'](\d+)["']/i);
  if (dataWidthMatch && dataHeightMatch) {
    return {
      width: parseInt(dataWidthMatch[1], 10),
      height: parseInt(dataHeightMatch[1], 10),
      source: "data-attr",
    };
  }

  // Pattern 4: Inline style on expanded element
  // Match: id="expanded" style="width: 600px; height: 400px;"
  const inlineStylePattern = /id=["']expanded["'][^>]*style=["'][^"']*width:\s*(\d+)px[^"']*height:\s*(\d+)px/i;
  const inlineStyleMatch = tag.match(inlineStylePattern);
  if (inlineStyleMatch) {
    return {
      width: parseInt(inlineStyleMatch[1], 10),
      height: parseInt(inlineStyleMatch[2], 10),
      source: "inline-style",
    };
  }

  // Pattern 5: Look for expandTo or similar MRAID expand parameters
  // Match: mraid.expand() calls with dimensions, or expandProperties
  const mraidExpandPattern = /expandProperties[^}]*width['":\s]+(\d+)[^}]*height['":\s]+(\d+)/i;
  const mraidExpandMatch = tag.match(mraidExpandPattern);
  if (mraidExpandMatch) {
    return {
      width: parseInt(mraidExpandMatch[1], 10),
      height: parseInt(mraidExpandMatch[2], 10),
      source: "css", // Treating as CSS since it's embedded config
    };
  }

  // Pattern 6: Generic CSS with "expand" in selector and pixel dimensions
  const genericExpandPattern = /expand[^{]*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px[^}]*\}/i;
  const genericExpandMatch = tag.match(genericExpandPattern);
  if (genericExpandMatch) {
    return {
      width: parseInt(genericExpandMatch[1], 10),
      height: parseInt(genericExpandMatch[2], 10),
      source: "css",
    };
  }

  // No hardcoded dimensions found - ad is likely responsive
  return null;
}

/**
 * Checks if the tag appears to be an expandable ad
 */
export function isExpandableTag(tag: string): boolean {
  const expandableIndicators = [
    /#expanded/i,
    /\.expanded/i,
    /mraid\.expand/i,
    /data-expanded/i,
    /expandable/i,
    /#collapsed/i,
    /\.collapsed/i,
  ];

  return expandableIndicators.some((pattern) => pattern.test(tag));
}
