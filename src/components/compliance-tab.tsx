"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type ComplianceResult,
  type ComplianceCheck,
  type CheckStatus,
  getDSPOptions,
  getStatusColor,
  getStatusIcon,
} from "@/lib/compliance";

interface ComplianceTabProps {
  result?: ComplianceResult | null;
  onRun?: () => void;
  selectedDSP?: string;
  onDSPChange?: (dsp: string) => void;
  hasContent?: boolean;
}

export function ComplianceTab({
  result,
  onRun,
  selectedDSP = "generic",
  onDSPChange,
  hasContent = false,
}: ComplianceTabProps) {
  const dspOptions = getDSPOptions();

  return (
    <div className="space-y-2 pt-2">
      {/* DSP Selector */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
          Target DSP
        </div>
        <select
          value={selectedDSP}
          onChange={(e) => onDSPChange?.(e.target.value)}
          className="h-6 text-xs bg-background border border-border rounded px-2 text-foreground"
        >
          {dspOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Run Button or Results */}
      {!hasContent ? (
        <div className="text-center py-6 text-foreground/40 text-sm">
          <p>Load content to run compliance checks</p>
          <p className="text-xs mt-2 text-foreground/30">
            Paste a tag or upload an HTML5 zip
          </p>
        </div>
      ) : !result ? (
        <Button
          onClick={onRun}
          variant="outline"
          size="sm"
          className="w-full text-xs h-8"
        >
          Run Compliance Checks
        </Button>
      ) : (
        <div className="space-y-2">
          {/* Overall Status Banner */}
          <div
            className={`p-2 rounded border ${getStatusBorderColor(
              result.overallStatus
            )} ${getStatusBgColorSolid(result.overallStatus)}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm ${getStatusTextColor(result.overallStatus)}`}>
                {getStatusIcon(result.overallStatus)}
              </span>
              <span className="text-sm font-medium">
                {getOverallStatusLabel(result.overallStatus, result.checks)}
              </span>
            </div>
          </div>

          {/* Re-run button */}
          <Button
            onClick={onRun}
            variant="ghost"
            size="sm"
            className="w-full text-xs h-6 text-foreground/50"
          >
            Re-run Checks
          </Button>

          {/* Individual Checks */}
          <div className="space-y-1">
            {result.checks.map((check) => (
              <ComplianceCheckItem key={check.id} check={check} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ComplianceCheckItemProps {
  check: ComplianceCheck;
}

function ComplianceCheckItem({ check }: ComplianceCheckItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasItems = check.items && check.items.length > 0;

  return (
    <div
      className={`rounded bg-foreground/5 ${
        hasItems ? "cursor-pointer" : ""
      }`}
      onClick={() => hasItems && setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {hasItems && (
            <svg
              className={`w-3 h-3 text-foreground/40 shrink-0 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
          <span className="text-xs truncate">{check.name}</span>
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${getStatusColor(
            check.status
          )}`}
        >
          {getStatusIcon(check.status)}{" "}
          {check.status === "pass"
            ? "Pass"
            : check.status === "fail"
            ? "Fail"
            : check.status === "warn"
            ? "Warn"
            : check.status === "pending"
            ? "..."
            : "Skip"}
        </span>
      </div>

      {/* Details */}
      {check.details && (
        <div className="px-1.5 pb-1.5 text-[10px] text-foreground/50 truncate">
          {check.details}
        </div>
      )}

      {/* Expanded Items */}
      {expanded && hasItems && (
        <div className="px-1.5 pb-1.5 space-y-1">
          {check.items!.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-[10px] bg-background/50 rounded px-2 py-1"
            >
              <span className="truncate text-foreground/70">{item.label}</span>
              <span
                className={`shrink-0 ${
                  item.status === "pass"
                    ? "text-emerald-400"
                    : item.status === "fail"
                    ? "text-red-400"
                    : item.status === "warn"
                    ? "text-amber-400"
                    : "text-foreground/50"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getOverallStatusLabel(
  status: CheckStatus,
  checks: ComplianceCheck[]
): string {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  switch (status) {
    case "pass":
      return "All Checks Passed";
    case "fail":
      return `${failCount} Issue${failCount !== 1 ? "s" : ""} Found`;
    case "warn":
      return `${warnCount} Warning${warnCount !== 1 ? "s" : ""}`;
    case "pending":
      return "Checks Running...";
    case "skipped":
      return "Checks Skipped";
  }
}

function getStatusBorderColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-500/30";
    case "fail":
      return "border-red-500/30";
    case "warn":
      return "border-amber-500/30";
    case "pending":
      return "border-cyan-500/30";
    case "skipped":
      return "border-gray-500/30";
  }
}

function getStatusBgColorSolid(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "bg-emerald-500/10";
    case "fail":
      return "bg-red-500/10";
    case "warn":
      return "bg-amber-500/10";
    case "pending":
      return "bg-cyan-500/10";
    case "skipped":
      return "bg-gray-500/10";
  }
}

function getStatusTextColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-400";
    case "fail":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    case "pending":
      return "text-cyan-400";
    case "skipped":
      return "text-gray-400";
  }
}
