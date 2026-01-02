/**
 * DSP-Specific Compliance Rules
 *
 * Defines validation rules for different DSP platforms.
 */

export interface DSPRules {
  name: string;
  displayName: string;
  /** Maximum total bundle size in bytes */
  maxBundleSize: number;
  /** Maximum individual file size in bytes */
  maxFileSize: number;
  /** Maximum load time in milliseconds */
  maxLoadTime: number;
  /** Require all resources to use HTTPS */
  requireSSL: boolean;
  /** Require click macro to be present */
  requireClickMacro: boolean;
  /** Patterns that satisfy click macro requirement */
  clickMacroPatterns: string[];
  /** Allowed file extensions */
  allowedFileTypes: string[];
}

export const DSP_RULES: Record<string, DSPRules> = {
  dv360: {
    name: "dv360",
    displayName: "DV360 / CM360",
    maxBundleSize: 200 * 1024, // 200KB
    maxFileSize: 150 * 1024, // 150KB per file
    maxLoadTime: 4000, // 4 seconds
    requireSSL: true,
    requireClickMacro: true,
    clickMacroPatterns: [
      "${CLICK_URL}",
      "%%CLICK_URL_UNESC%%",
      "%%CLICK_URL_ESC%%",
      "%%CLICK_URL%%",
    ],
    allowedFileTypes: [
      "html",
      "htm",
      "js",
      "css",
      "json",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "woff",
      "woff2",
      "ttf",
      "webp",
    ],
  },
  ttd: {
    name: "ttd",
    displayName: "The Trade Desk",
    maxBundleSize: 200 * 1024, // 200KB
    maxFileSize: 100 * 1024, // 100KB per file
    maxLoadTime: 3000, // 3 seconds
    requireSSL: true,
    requireClickMacro: true,
    clickMacroPatterns: [
      "%%TTD_CLK%%",
      "%%TTD_CLK_ESC%%",
      "%%TTD_CLICK%%",
    ],
    allowedFileTypes: [
      "html",
      "htm",
      "js",
      "css",
      "json",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
    ],
  },
  xandr: {
    name: "xandr",
    displayName: "Xandr (AppNexus)",
    maxBundleSize: 250 * 1024, // 250KB
    maxFileSize: 150 * 1024, // 150KB per file
    maxLoadTime: 4000, // 4 seconds
    requireSSL: true,
    requireClickMacro: true,
    clickMacroPatterns: [
      "${CLICK_URL}",
      "${CLICK_URL_ENC}",
      "${CLICK_URL_UNESC}",
    ],
    allowedFileTypes: [
      "html",
      "htm",
      "js",
      "css",
      "json",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "webp",
    ],
  },
  amazon: {
    name: "amazon",
    displayName: "Amazon DSP",
    maxBundleSize: 200 * 1024, // 200KB
    maxFileSize: 150 * 1024, // 150KB per file
    maxLoadTime: 4000, // 4 seconds
    requireSSL: true,
    requireClickMacro: true,
    clickMacroPatterns: [
      "${CLICK_URL}",
      "${CLICK_THROUGH_URL}",
    ],
    allowedFileTypes: [
      "html",
      "htm",
      "js",
      "css",
      "json",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
    ],
  },
  generic: {
    name: "generic",
    displayName: "Generic / IAB",
    maxBundleSize: 200 * 1024, // 200KB (IAB guideline)
    maxFileSize: 150 * 1024, // 150KB per file
    maxLoadTime: 5000, // 5 seconds
    requireSSL: true,
    requireClickMacro: false, // Don't fail, just warn
    clickMacroPatterns: [
      // Common patterns to detect
      "clickTag",
      "clickTAG",
      "${CLICK_URL}",
      "%%CLICK_URL%%",
      "[CLICK_URL]",
    ],
    allowedFileTypes: [
      "html",
      "htm",
      "js",
      "css",
      "json",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "webp",
      "woff",
      "woff2",
      "ttf",
      "eot",
      "mp4",
      "webm",
      "mp3",
      "ogg",
    ],
  },
};

export function getDSPRules(dsp: string): DSPRules {
  return DSP_RULES[dsp] || DSP_RULES.generic;
}

export function getDSPOptions(): Array<{ value: string; label: string }> {
  return Object.entries(DSP_RULES).map(([key, rules]) => ({
    value: key,
    label: rules.displayName,
  }));
}
