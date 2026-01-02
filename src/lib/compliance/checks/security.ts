/**
 * Security Compliance Checks
 */

import type { FileInfo, ComplianceCheck } from "../types";
import type { DSPRules } from "../rules";

// Pattern to detect insecure HTTP URLs in source code
const HTTP_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const INSECURE_HTTP_PATTERN = /http:\/\/(?!localhost|127\.0\.0\.1)[^\s"'<>]+/gi;

export function runSecurityChecks(
  files: FileInfo[],
  sourceContent: string | undefined,
  rules: DSPRules
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  if (!rules.requireSSL) {
    checks.push({
      id: "security-ssl",
      category: "security",
      name: "HTTPS Only",
      description: "SSL check not required for this DSP",
      status: "skipped",
    });
    return checks;
  }

  // Check source content for insecure URLs
  if (sourceContent) {
    const insecureUrls = sourceContent.match(INSECURE_HTTP_PATTERN) || [];
    // Deduplicate
    const uniqueInsecure = [...new Set(insecureUrls)];

    if (uniqueInsecure.length === 0) {
      checks.push({
        id: "security-ssl",
        category: "security",
        name: "HTTPS Only",
        description: "All resource URLs must use HTTPS",
        status: "pass",
        details: "No insecure HTTP URLs detected",
      });
    } else {
      checks.push({
        id: "security-ssl",
        category: "security",
        name: "HTTPS Only",
        description: "All resource URLs must use HTTPS",
        status: "fail",
        details: `${uniqueInsecure.length} insecure URL(s) detected`,
        items: uniqueInsecure.slice(0, 10).map((url) => ({
          label: truncateUrl(url),
          value: "http://",
          status: "fail",
        })),
      });
    }

    // Check for mixed content potential
    const allUrls = sourceContent.match(HTTP_URL_PATTERN) || [];
    const httpsUrls = allUrls.filter((u) => u.startsWith("https://"));
    const httpUrls = allUrls.filter(
      (u) => u.startsWith("http://") && !u.includes("localhost") && !u.includes("127.0.0.1")
    );

    if (httpsUrls.length > 0 && httpUrls.length > 0) {
      checks.push({
        id: "security-mixed",
        category: "security",
        name: "Mixed Content",
        description: "Mixing HTTP and HTTPS can cause issues",
        status: "warn",
        details: `${httpUrls.length} HTTP and ${httpsUrls.length} HTTPS URLs found`,
      });
    }
  } else {
    // No source content available - can't check
    checks.push({
      id: "security-ssl",
      category: "security",
      name: "HTTPS Only",
      description: "All resource URLs must use HTTPS",
      status: "skipped",
      details: "Source content not available for scanning",
    });
  }

  return checks;
}

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + "...";
}
