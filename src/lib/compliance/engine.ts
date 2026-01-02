/**
 * Compliance Engine
 *
 * Orchestrates running all compliance checks against collected data.
 */

import type {
  ComplianceResult,
  ComplianceData,
  ComplianceCheck,
  CheckStatus,
} from "./types";
import type { DSPRules } from "./rules";
import { getDSPRules } from "./rules";
import {
  runFileSizeChecks,
  runLoadTimeChecks,
  runSecurityChecks,
  runClickTrackingChecks,
  runTrackingPixelChecks,
} from "./checks";

export class ComplianceEngine {
  private rules: DSPRules;
  private dspName: string;

  constructor(dsp: string = "generic") {
    this.dspName = dsp;
    this.rules = getDSPRules(dsp);
  }

  setDSP(dsp: string): void {
    this.dspName = dsp;
    this.rules = getDSPRules(dsp);
  }

  getDSP(): string {
    return this.dspName;
  }

  getRules(): DSPRules {
    return this.rules;
  }

  runChecks(data: ComplianceData): ComplianceResult {
    const checks: ComplianceCheck[] = [
      ...runFileSizeChecks(data.files, this.rules),
      ...runLoadTimeChecks(data.timing, this.rules),
      ...runSecurityChecks(data.files, data.sourceContent, this.rules),
      ...runClickTrackingChecks(data.clicks, data.sourceContent, this.rules),
      ...runTrackingPixelChecks(data.pixels),
    ];

    const overallStatus = this.computeOverallStatus(checks);

    return {
      timestamp: Date.now(),
      overallStatus,
      checks,
      data,
    };
  }

  private computeOverallStatus(checks: ComplianceCheck[]): CheckStatus {
    // Priority: fail > warn > pending > skipped > pass
    if (checks.some((c) => c.status === "fail")) return "fail";
    if (checks.some((c) => c.status === "warn")) return "warn";
    if (checks.some((c) => c.status === "pending")) return "pending";
    if (checks.every((c) => c.status === "skipped")) return "skipped";
    return "pass";
  }
}

/**
 * Create empty compliance data structure
 */
export function createEmptyComplianceData(): ComplianceData {
  return {
    files: [],
    timing: {},
    clicks: [],
    pixels: [],
    sourceContent: undefined,
  };
}

/**
 * Get status color class for UI
 */
export function getStatusColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-400 bg-emerald-500/10";
    case "fail":
      return "text-red-400 bg-red-500/10";
    case "warn":
      return "text-amber-400 bg-amber-500/10";
    case "pending":
      return "text-cyan-400 bg-cyan-500/10";
    case "skipped":
      return "text-gray-400 bg-gray-500/10";
  }
}

/**
 * Get status icon for UI
 */
export function getStatusIcon(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "✓";
    case "fail":
      return "✗";
    case "warn":
      return "⚠";
    case "pending":
      return "⋯";
    case "skipped":
      return "–";
  }
}

/**
 * Get status label for UI
 */
export function getStatusLabel(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "warn":
      return "Warning";
    case "pending":
      return "Pending";
    case "skipped":
      return "Skipped";
  }
}
