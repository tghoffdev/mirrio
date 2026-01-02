/**
 * Click Tracking Compliance Checks
 */

import type { ClickInfo, ComplianceCheck } from "../types";
import type { DSPRules } from "../rules";

export function runClickTrackingChecks(
  clicks: ClickInfo[],
  sourceContent: string | undefined,
  rules: DSPRules
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Check for click macro presence in source
  let foundMacros: string[] = [];

  if (sourceContent) {
    for (const pattern of rules.clickMacroPatterns) {
      if (sourceContent.includes(pattern)) {
        foundMacros.push(pattern);
      }
    }

    // Also check for common clickTag patterns
    if (/window\.clickTag|clickTAG/i.test(sourceContent)) {
      foundMacros.push("clickTag");
    }
  }

  // Deduplicate
  foundMacros = [...new Set(foundMacros)];

  if (foundMacros.length > 0) {
    checks.push({
      id: "click-macro",
      category: "click-tracking",
      name: "Click Macro",
      description: "Click tracking macro must be present",
      status: "pass",
      details: `Found: ${foundMacros.join(", ")}`,
      items: foundMacros.map((m) => ({
        label: m,
        value: "present",
        status: "pass",
      })),
    });
  } else if (rules.requireClickMacro) {
    checks.push({
      id: "click-macro",
      category: "click-tracking",
      name: "Click Macro",
      description: "Click tracking macro must be present",
      status: "fail",
      details: `Expected one of: ${rules.clickMacroPatterns.slice(0, 3).join(", ")}`,
    });
  } else {
    checks.push({
      id: "click-macro",
      category: "click-tracking",
      name: "Click Macro",
      description: "Click tracking macro recommended",
      status: "warn",
      details: "No click macro detected (not required for this DSP)",
    });
  }

  // Check for click events fired during preview
  const clickEvents = clicks.filter(
    (c) => c.type === "mraid.open" || c.type === "window.open" || c.type === "anchor"
  );

  if (clickEvents.length > 0) {
    checks.push({
      id: "click-handler",
      category: "click-tracking",
      name: "Click Handler",
      description: "Ad has functional click handling",
      status: "pass",
      details: `${clickEvents.length} click event(s) detected`,
      items: clickEvents.slice(0, 5).map((c) => ({
        label: c.type,
        value: c.url ? truncateUrl(c.url) : "no URL",
        status: "pass",
      })),
    });
  } else {
    // Not a failure - clicks may not have been triggered during preview
    checks.push({
      id: "click-handler",
      category: "click-tracking",
      name: "Click Handler",
      description: "Click handlers fire when ad is clicked",
      status: "pending",
      details: "No clicks detected yet - try clicking the ad",
    });
  }

  return checks;
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + "...";
}
