/**
 * Load Time Compliance Checks
 */

import type { TimingInfo, ComplianceCheck } from "../types";
import type { DSPRules } from "../rules";

export function runLoadTimeChecks(
  timing: TimingInfo,
  rules: DSPRules
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Check time to MRAID ready
  if (timing.loadStart && timing.mraidReady) {
    const loadTime = timing.mraidReady - timing.loadStart;
    const status = loadTime <= rules.maxLoadTime ? "pass" : "fail";

    checks.push({
      id: "load-time-ready",
      category: "load-time",
      name: "Time to Ready",
      description: `Ad must be ready within ${rules.maxLoadTime / 1000}s`,
      status,
      threshold: rules.maxLoadTime,
      value: loadTime,
      details: `${(loadTime / 1000).toFixed(2)}s / ${rules.maxLoadTime / 1000}s`,
    });
  } else if (timing.mraidReady) {
    // Only have mraidReady timestamp, can't calculate load time
    checks.push({
      id: "load-time-ready",
      category: "load-time",
      name: "Time to Ready",
      description: `Ad must be ready within ${rules.maxLoadTime / 1000}s`,
      status: "skipped",
      details: "Load start time not available",
    });
  } else {
    checks.push({
      id: "load-time-ready",
      category: "load-time",
      name: "Time to Ready",
      description: `Ad must be ready within ${rules.maxLoadTime / 1000}s`,
      status: "pending",
      details: "Waiting for ad to become ready...",
    });
  }

  return checks;
}
