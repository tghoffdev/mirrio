/**
 * Tracking Pixel Compliance Checks
 */

import type { PixelInfo, ComplianceCheck } from "../types";

export function runTrackingPixelChecks(
  pixels: PixelInfo[]
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Group pixels by type
  const impressionPixels = pixels.filter((p) => p.type === "impression");
  const viewPixels = pixels.filter((p) => p.type === "view");
  const clickPixels = pixels.filter((p) => p.type === "click");
  const trackingPixels = pixels.filter((p) => p.type === "tracking");
  const beacons = pixels.filter((p) => p.method === "beacon");

  const totalPixels = pixels.length;

  if (totalPixels === 0) {
    checks.push({
      id: "tracking-overview",
      category: "tracking-pixels",
      name: "Tracking Pixels",
      description: "Tracking pixels for ad measurement",
      status: "pending",
      details: "No tracking pixels detected yet - they may fire after ad load",
    });
    return checks;
  }

  // Overall tracking check
  checks.push({
    id: "tracking-overview",
    category: "tracking-pixels",
    name: "Tracking Pixels",
    description: "Tracking pixels for ad measurement",
    status: "pass",
    details: `${totalPixels} tracking event(s) detected`,
    items: [
      impressionPixels.length > 0
        ? { label: "Impressions", value: impressionPixels.length, status: "pass" as const }
        : null,
      viewPixels.length > 0
        ? { label: "Views", value: viewPixels.length, status: "pass" as const }
        : null,
      clickPixels.length > 0
        ? { label: "Clicks", value: clickPixels.length, status: "pass" as const }
        : null,
      trackingPixels.length > 0
        ? { label: "Other", value: trackingPixels.length, status: "pass" as const }
        : null,
      beacons.length > 0
        ? { label: "Beacons", value: beacons.length, status: "pass" as const }
        : null,
    ].filter(Boolean) as { label: string; value: number; status: "pass" }[],
  });

  // Impression tracking check
  if (impressionPixels.length > 0) {
    checks.push({
      id: "tracking-impression",
      category: "tracking-pixels",
      name: "Impression Tracking",
      description: "Impression pixel fires on ad load",
      status: "pass",
      details: `${impressionPixels.length} impression pixel(s)`,
      items: impressionPixels.slice(0, 5).map((p) => ({
        label: p.method,
        value: truncateUrl(p.url),
        status: "pass",
      })),
    });
  }

  // View tracking check
  if (viewPixels.length > 0) {
    checks.push({
      id: "tracking-view",
      category: "tracking-pixels",
      name: "Viewability Tracking",
      description: "Viewability pixel fires when ad is in view",
      status: "pass",
      details: `${viewPixels.length} view pixel(s)`,
      items: viewPixels.slice(0, 5).map((p) => ({
        label: p.method,
        value: truncateUrl(p.url),
        status: "pass",
      })),
    });
  }

  return checks;
}

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  // Try to show domain + end of path
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const remaining = maxLength - domain.length - 6; // "..." + "..."
    if (remaining > 10) {
      const pathEnd = urlObj.pathname.slice(-remaining);
      return `${domain}/...${pathEnd}`;
    }
    return domain + "/...";
  } catch {
    return url.slice(0, maxLength - 3) + "...";
  }
}
