/**
 * Proof Pack Generator
 *
 * Creates a comprehensive QA proof package including:
 * - Screenshot
 * - Recording (optional)
 * - Compliance results
 * - Event log
 * - Tag source
 * - Metadata
 */

import JSZip from "jszip";
import type { ComplianceResult } from "@/lib/compliance";
import type { MRAIDEvent } from "@/components/audit-panel";
import type { DetectedMacro } from "@/lib/macros/detector";

export interface TextChange {
  original: string;
  current: string;
  type?: string;
}

export interface ProofPackData {
  /** Screenshot blob */
  screenshot?: Blob;
  /** Recording blob */
  recording?: Blob;
  /** Recording format */
  recordingFormat?: "webm" | "mp4";
  /** Compliance check results */
  compliance?: ComplianceResult | null;
  /** Event log */
  events: MRAIDEvent[];
  /** Detected macros */
  macros: DetectedMacro[];
  /** Original tag source */
  originalTag?: string;
  /** Modified tag (if personalized/fixed) */
  modifiedTag?: string;
  /** Text personalization changes */
  textChanges?: TextChange[];
  /** Macro replacement values (for URL resolution) */
  macroValues?: Record<string, string>;
  /** Whether click macro fix was specifically applied via compliance */
  clickMacroFixApplied?: boolean;
  /** Metadata */
  metadata: ProofMetadata;
}

export interface ProofMetadata {
  /** Timestamp when proof was collected */
  timestamp: string;
  /** ISO timestamp */
  timestampISO: string;
  /** Ad dimensions */
  width: number;
  height: number;
  /** Target DSP */
  dsp: string;
  /** Detected vendor */
  vendor?: string;
  /** Tool version */
  version: string;
  /** Collection duration (ms) */
  collectionDurationMs?: number;
}

export interface ProofPackResult {
  /** The zip blob */
  blob: Blob;
  /** Suggested filename */
  filename: string;
  /** Summary for UI display */
  summary: ProofPackSummary;
}

export interface ProofPackSummary {
  hasScreenshot: boolean;
  hasRecording: boolean;
  complianceStatus: "pass" | "fail" | "warn" | "pending" | "skipped" | "none";
  eventCount: number;
  macroCount: number;
  isPersonalized: boolean;
}

/**
 * Generate a proof pack ZIP file
 */
export async function generateProofPack(
  data: ProofPackData
): Promise<ProofPackResult> {
  const zip = new JSZip();
  const timestamp = Date.now();

  // 1. Add screenshot
  if (data.screenshot) {
    zip.file("screenshot.png", data.screenshot);
  }

  // 2. Add recording
  if (data.recording) {
    const ext = data.recordingFormat === "mp4" ? "mp4" : "webm";
    zip.file(`recording.${ext}`, data.recording);
  }

  // 3. Add compliance results
  if (data.compliance) {
    const complianceJson = JSON.stringify(
      {
        overallStatus: data.compliance.overallStatus,
        checks: data.compliance.checks.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          status: c.status,
          details: c.details,
          items: c.items,
        })),
      },
      null,
      2
    );
    zip.file("compliance.json", complianceJson);
  }

  // 4. Add event log with resolved URLs
  const eventsJson = JSON.stringify(
    data.events.map((e) => {
      const eventData: Record<string, unknown> = {
        type: e.type,
        timestamp: e.timestamp,
        time: new Date(e.timestamp).toISOString(),
      };

      // For click-related events, resolve URLs using macro values
      const clickEvents = ["open", "window.open", "anchor"];
      if (clickEvents.includes(e.type) && e.args?.[0]) {
        const rawUrl = e.args[0] as string;
        let resolvedUrl = rawUrl;

        // Apply macro substitutions if we have macro values
        if (data.macroValues) {
          for (const [macroRaw, value] of Object.entries(data.macroValues)) {
            if (value.trim()) {
              resolvedUrl = resolvedUrl.split(macroRaw).join(value);
            }
          }
        }

        eventData.rawUrl = rawUrl;
        eventData.resolvedUrl = resolvedUrl !== rawUrl ? resolvedUrl : rawUrl;
        // Keep remaining args (e.g., target for window.open)
        if (e.args.length > 1) {
          eventData.args = e.args.slice(1);
        }
      } else {
        eventData.args = e.args;
      }

      return eventData;
    }),
    null,
    2
  );
  zip.file("events.json", eventsJson);

  // 5. Add macros
  if (data.macros.length > 0) {
    const macrosJson = JSON.stringify(
      data.macros.map((m) => ({
        name: m.name,
        format: m.format,
        raw: m.raw,
        count: m.count,
      })),
      null,
      2
    );
    zip.file("macros.json", macrosJson);
  }

  // 5b. Add personalization data
  const hasTextChanges = data.textChanges && data.textChanges.length > 0;
  const hasTagModification = data.modifiedTag && data.modifiedTag !== data.originalTag;
  const hasMacroValues = data.macroValues && Object.values(data.macroValues).some(v => v.trim());

  if (hasTextChanges || hasTagModification || hasMacroValues) {
    const personalizationJson = JSON.stringify(
      {
        tagModified: hasTagModification,
        textChanges: data.textChanges || [],
        macroValues: hasMacroValues ? data.macroValues : undefined,
        summary: {
          textChangesCount: data.textChanges?.length || 0,
          macroValuesApplied: hasMacroValues,
          clickMacroFixApplied: data.clickMacroFixApplied || false,
        },
      },
      null,
      2
    );
    zip.file("personalization.json", personalizationJson);
  }

  // 6. Add original tag
  if (data.originalTag) {
    zip.file("tag-original.html", data.originalTag);
  }

  // 7. Add modified tag (if different)
  if (data.modifiedTag && data.modifiedTag !== data.originalTag) {
    zip.file("tag-modified.html", data.modifiedTag);
  }

  // 8. Add metadata
  const metadataJson = JSON.stringify(data.metadata, null, 2);
  zip.file("metadata.json", metadataJson);

  // 9. Generate summary report (human-readable)
  const report = generateTextReport(data);
  zip.file("qa-report.txt", report);

  // 10. Generate interactive HTML viewer
  const screenshotBase64 = data.screenshot
    ? await blobToBase64(data.screenshot)
    : undefined;
  const htmlReport = generateHtmlReport(data, screenshotBase64);
  zip.file("index.html", htmlReport);

  // Generate the zip
  const blob = await zip.generateAsync({ type: "blob" });

  // Create summary
  const summary: ProofPackSummary = {
    hasScreenshot: !!data.screenshot,
    hasRecording: !!data.recording,
    complianceStatus: data.compliance?.overallStatus ?? "none",
    eventCount: data.events.length,
    macroCount: data.macros.length,
    isPersonalized: !!(
      data.modifiedTag && data.modifiedTag !== data.originalTag
    ),
  };

  return {
    blob,
    filename: `proof-pack-${data.metadata.width}x${data.metadata.height}-${timestamp}.zip`,
    summary,
  };
}

/**
 * Generate a human-readable text report
 */
function generateTextReport(data: ProofPackData): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("                     DOPPELIST QA PROOF PACK                    ");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Generated: ${data.metadata.timestampISO}`);
  lines.push(`Dimensions: ${data.metadata.width}x${data.metadata.height}`);
  lines.push(`Target DSP: ${data.metadata.dsp.toUpperCase()}`);
  if (data.metadata.vendor) {
    lines.push(`Vendor: ${data.metadata.vendor}`);
  }
  lines.push("");

  // Compliance Summary
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("COMPLIANCE SUMMARY");
  lines.push("───────────────────────────────────────────────────────────────");

  if (data.compliance) {
    const statusEmoji =
      data.compliance.overallStatus === "pass"
        ? "✓ PASS"
        : data.compliance.overallStatus === "fail"
        ? "✗ FAIL"
        : data.compliance.overallStatus === "warn"
        ? "⚠ WARN"
        : "? PENDING";

    lines.push(`Overall Status: ${statusEmoji}`);
    lines.push("");

    for (const check of data.compliance.checks) {
      const icon =
        check.status === "pass"
          ? "✓"
          : check.status === "fail"
          ? "✗"
          : check.status === "warn"
          ? "⚠"
          : check.status === "skipped"
          ? "-"
          : "?";
      lines.push(`  ${icon} ${check.name}: ${check.status.toUpperCase()}`);
      if (check.details) {
        lines.push(`    ${check.details}`);
      }
    }
  } else {
    lines.push("No compliance checks run");
  }

  lines.push("");

  // Personalization & Tag Modifications
  const reportHasTextChanges = data.textChanges && data.textChanges.length > 0;
  const reportHasTagMod = data.modifiedTag && data.modifiedTag !== data.originalTag;
  const reportHasMacroValues = data.macroValues && Object.values(data.macroValues).some(v => v.trim());

  if (reportHasTextChanges || reportHasTagMod || reportHasMacroValues || data.clickMacroFixApplied) {
    lines.push("───────────────────────────────────────────────────────────────");
    lines.push("PERSONALIZATION & MODIFICATIONS");
    lines.push("───────────────────────────────────────────────────────────────");

    // Click macro fix (compliance fix)
    if (data.clickMacroFixApplied) {
      lines.push("  ✓ Click macro fix applied (via compliance)");
    }

    // Macro value replacements
    if (reportHasMacroValues && data.macroValues) {
      const filledMacros = Object.entries(data.macroValues).filter(([, v]) => v.trim());
      lines.push(`  ✓ ${filledMacros.length} macro value(s) replaced:`);
      for (const [macroRaw, value] of filledMacros) {
        lines.push(`    • ${macroRaw} → ${value}`);
      }
    }

    // Text personalization
    if (reportHasTextChanges) {
      lines.push(`  ✓ ${data.textChanges!.length} text element(s) personalized:`);
      for (const change of data.textChanges!) {
        const typeLabel = change.type ? ` [${change.type}]` : "";
        lines.push(`    • "${change.original}" → "${change.current}"${typeLabel}`);
      }
    }

    // Tag files
    if (reportHasTagMod) {
      lines.push("");
      lines.push("  Modified tag files:");
      lines.push("    • Original: tag-original.html");
      lines.push("    • Modified: tag-modified.html");
    }

    lines.push("");
  }

  // Macros
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("DETECTED MACROS");
  lines.push("───────────────────────────────────────────────────────────────");

  if (data.macros.length > 0) {
    for (const macro of data.macros) {
      lines.push(`  • ${macro.raw} (${macro.format}, ${macro.count}x)`);
    }
  } else {
    lines.push("No macros detected");
  }

  lines.push("");

  // Events
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("EVENT LOG");
  lines.push("───────────────────────────────────────────────────────────────");

  if (data.events.length > 0) {
    const clickEvents = ["open", "window.open", "anchor"];
    for (const event of data.events.slice(0, 50)) {
      // Limit to 50 events
      const time = new Date(event.timestamp).toLocaleTimeString();

      // For click events, show resolved URL if macro values are available
      if (clickEvents.includes(event.type) && event.args?.[0]) {
        const rawUrl = event.args[0] as string;
        let resolvedUrl = rawUrl;

        if (data.macroValues) {
          for (const [macroRaw, value] of Object.entries(data.macroValues)) {
            if (value.trim()) {
              resolvedUrl = resolvedUrl.split(macroRaw).join(value);
            }
          }
        }

        if (resolvedUrl !== rawUrl) {
          lines.push(`  ${time} | ${event.type}`);
          lines.push(`           raw: ${rawUrl}`);
          lines.push(`           resolved: ${resolvedUrl}`);
        } else {
          lines.push(`  ${time} | ${event.type} → ${rawUrl}`);
        }
      } else {
        const args = event.args?.length ? ` → ${JSON.stringify(event.args)}` : "";
        lines.push(`  ${time} | ${event.type}${args}`);
      }
    }
    if (data.events.length > 50) {
      lines.push(`  ... and ${data.events.length - 50} more events`);
    }
  } else {
    lines.push("No events captured");
  }

  lines.push("");

  // Contents
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("PACKAGE CONTENTS");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("  • index.html (interactive viewer)");
  lines.push("  • qa-report.txt (this file)");
  lines.push("  • metadata.json");
  if (data.screenshot) lines.push("  • screenshot.png");
  if (data.recording)
    lines.push(
      `  • recording.${data.recordingFormat === "mp4" ? "mp4" : "webm"}`
    );
  if (data.compliance) lines.push("  • compliance.json");
  lines.push("  • events.json");
  if (data.macros.length > 0) lines.push("  • macros.json");
  if (reportHasTextChanges || reportHasTagMod || reportHasMacroValues || data.clickMacroFixApplied) {
    lines.push("  • personalization.json");
  }
  if (data.originalTag) lines.push("  • tag-original.html");
  if (reportHasTagMod) {
    lines.push("  • tag-modified.html");
  }

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(`                    Doppelist v${data.metadata.version}`);
  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * Download a proof pack
 */
export function downloadProofPack(result: ProofPackResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert a Blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate an interactive HTML report viewer
 */
function generateHtmlReport(data: ProofPackData, screenshotBase64?: string): string {
  const hasTextChanges = data.textChanges && data.textChanges.length > 0;
  const hasTagMod = data.modifiedTag && data.modifiedTag !== data.originalTag;
  const hasMacroValues = data.macroValues && Object.values(data.macroValues).some(v => v.trim());

  // Get unique event types for filter dropdown
  const eventTypes = [...new Set(data.events.map(e => e.type))].sort();

  // Prepare events with resolved URLs
  const clickEventTypes = ["open", "window.open", "anchor"];
  const processedEvents = data.events.map(e => {
    if (clickEventTypes.includes(e.type) && e.args?.[0]) {
      const rawUrl = e.args[0] as string;
      let resolvedUrl = rawUrl;
      if (data.macroValues) {
        for (const [macroRaw, value] of Object.entries(data.macroValues)) {
          if (value.trim()) {
            resolvedUrl = resolvedUrl.split(macroRaw).join(value);
          }
        }
      }
      return { ...e, rawUrl, resolvedUrl: resolvedUrl !== rawUrl ? resolvedUrl : undefined };
    }
    return e;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Doppelist QA Proof Pack - ${data.metadata.width}x${data.metadata.height}</title>
  <style>
    :root {
      --bg: #0f0f0f;
      --bg-card: #1a1a1a;
      --bg-hover: #252525;
      --fg: #fafafa;
      --fg-muted: #a1a1a1;
      --border: rgba(255,255,255,0.1);
      --cyan: #22d3ee;
      --emerald: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --purple: #a78bfa;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.5;
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    code, pre, .mono { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .logo {
      font-size: 14px;
      font-weight: 600;
      color: var(--fg-muted);
    }
    .logo span { color: var(--cyan); }
    .meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--fg-muted);
    }
    .meta strong { color: var(--fg); }

    /* Summary Cards */
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }
    .stat-card .label {
      font-size: 11px;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .stat-card.pass .value { color: var(--emerald); }
    .stat-card.fail .value { color: var(--red); }
    .stat-card.warn .value { color: var(--amber); }

    /* Screenshot */
    .screenshot-section {
      margin-bottom: 24px;
    }
    .screenshot-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      text-align: center;
    }
    .screenshot-container img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 4px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .screenshot-container img:hover { transform: scale(1.02); }

    /* Sections */
    .section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-bottom: 16px;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }
    .section-header:hover { background: var(--bg-hover); }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--border);
    }
    .chevron {
      width: 16px;
      height: 16px;
      transition: transform 0.2s;
    }
    .section.collapsed .chevron { transform: rotate(-90deg); }
    .section-content {
      padding: 0 16px 16px;
      display: block;
    }
    .section.collapsed .section-content { display: none; }

    /* Compliance */
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .check-item:last-child { border-bottom: none; }
    .check-icon {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .check-icon.pass { background: var(--emerald); color: #000; }
    .check-icon.fail { background: var(--red); color: #000; }
    .check-icon.warn { background: var(--amber); color: #000; }
    .check-icon.skip { background: var(--fg-muted); color: #000; }
    .check-name { font-size: 13px; font-weight: 500; }
    .check-details { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

    /* Events */
    .event-controls {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .event-controls input, .event-controls select {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--fg);
      outline: none;
    }
    .event-controls input { flex: 1; }
    .event-controls input:focus, .event-controls select:focus {
      border-color: var(--cyan);
    }
    .event-list {
      max-height: 400px;
      overflow-y: auto;
      font-size: 12px;
    }
    .event-item {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .event-item:last-child { border-bottom: none; }
    .event-item.hidden { display: none; }
    .event-time { color: var(--fg-muted); white-space: nowrap; font-family: monospace; }
    .event-type {
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
      white-space: nowrap;
    }
    .event-type.ready, .event-type.stateChange { background: var(--purple); color: #000; }
    .event-type.open, .event-type.anchor { background: var(--cyan); color: #000; }
    .event-type.pixel, .event-type.beacon { background: var(--amber); color: #000; }
    .event-type.viewableChange { background: var(--emerald); color: #000; }
    .event-args { color: var(--fg-muted); word-break: break-all; }
    .event-url { display: block; font-size: 11px; }
    .event-url.raw { color: var(--fg-muted); }
    .event-url.resolved { color: var(--cyan); }

    /* Macros */
    .macro-table {
      width: 100%;
      font-size: 12px;
      border-collapse: collapse;
    }
    .macro-table th, .macro-table td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--border);
    }
    .macro-table th {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--fg-muted);
      font-weight: 500;
    }
    .macro-raw { font-family: monospace; color: var(--purple); }
    .macro-value { font-family: monospace; color: var(--cyan); }

    /* Personalization */
    .change-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .change-item:last-child { border-bottom: none; }
    .change-type {
      font-size: 10px;
      color: var(--fg-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .change-arrow { color: var(--fg-muted); margin: 0 8px; }
    .change-old { color: var(--red); text-decoration: line-through; }
    .change-new { color: var(--emerald); }

    /* Code blocks */
    .code-block {
      position: relative;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-top: 12px;
    }
    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 11px;
      color: var(--fg-muted);
    }
    .copy-btn {
      background: var(--border);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 10px;
      color: var(--fg);
      cursor: pointer;
      transition: background 0.15s;
    }
    .copy-btn:hover { background: var(--bg-hover); }
    .code-content {
      padding: 12px;
      overflow-x: auto;
      font-size: 11px;
      line-height: 1.6;
      max-height: 300px;
      overflow-y: auto;
    }

    /* Files list */
    .file-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }
    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 12px;
      color: var(--fg);
      text-decoration: none;
      transition: border-color 0.15s;
    }
    .file-item:hover { border-color: var(--cyan); }
    .file-icon { font-size: 14px; }

    /* Modal */
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .modal.active { display: flex; }
    .modal img {
      max-width: 100%;
      max-height: 100%;
      border-radius: var(--radius);
    }
    .modal-close {
      position: absolute;
      top: 24px;
      right: 24px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 20px;
      color: var(--fg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 11px;
      color: var(--fg-muted);
    }
    .footer a { color: var(--cyan); text-decoration: none; }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="logo mono">&gt; <span>Doppelist</span> QA Proof Pack</div>
    <div class="meta">
      <span><strong>${data.metadata.width}x${data.metadata.height}</strong></span>
      <span>DSP: <strong>${escapeHtml(data.metadata.dsp.toUpperCase())}</strong></span>
      ${data.metadata.vendor ? `<span>Vendor: <strong>${escapeHtml(data.metadata.vendor)}</strong></span>` : ''}
      <span>${escapeHtml(data.metadata.timestamp)}</span>
    </div>
  </header>

  <!-- Summary Cards -->
  <div class="summary">
    <div class="stat-card ${data.compliance?.overallStatus || 'none'}">
      <div class="value">${data.compliance?.overallStatus === 'pass' ? '✓' : data.compliance?.overallStatus === 'fail' ? '✗' : data.compliance?.overallStatus === 'warn' ? '⚠' : '—'}</div>
      <div class="label">Compliance</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.events.length}</div>
      <div class="label">Events</div>
    </div>
    <div class="stat-card">
      <div class="value">${data.macros.length}</div>
      <div class="label">Macros</div>
    </div>
    <div class="stat-card">
      <div class="value">${(data.textChanges?.length || 0) + (hasMacroValues ? Object.values(data.macroValues!).filter(v => v.trim()).length : 0)}</div>
      <div class="label">Changes</div>
    </div>
    ${data.metadata.collectionDurationMs ? `
    <div class="stat-card">
      <div class="value">${(data.metadata.collectionDurationMs / 1000).toFixed(1)}s</div>
      <div class="label">Duration</div>
    </div>` : ''}
  </div>

  ${screenshotBase64 ? `
  <!-- Screenshot -->
  <div class="screenshot-section">
    <div class="screenshot-container">
      <img src="${screenshotBase64}" alt="Ad Screenshot" onclick="openModal(this.src)" />
    </div>
  </div>` : ''}

  <!-- Compliance Section -->
  ${data.compliance ? `
  <div class="section" id="compliance-section">
    <div class="section-header" onclick="toggleSection('compliance-section')">
      <div class="section-title">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        Compliance Checks
        <span class="section-badge">${data.compliance.checks.filter(c => c.status === 'pass').length}/${data.compliance.checks.length} passed</span>
      </div>
    </div>
    <div class="section-content">
      ${data.compliance.checks.map(check => `
        <div class="check-item">
          <div class="check-icon ${check.status}">${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'warn' ? '!' : '—'}</div>
          <div>
            <div class="check-name">${escapeHtml(check.name)}</div>
            ${check.details ? `<div class="check-details">${escapeHtml(check.details)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}

  <!-- Events Section -->
  <div class="section" id="events-section">
    <div class="section-header" onclick="toggleSection('events-section')">
      <div class="section-title">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        Event Log
        <span class="section-badge">${data.events.length} events</span>
      </div>
    </div>
    <div class="section-content">
      <div class="event-controls">
        <input type="text" id="event-search" placeholder="Search events..." oninput="filterEvents()" />
        <select id="event-type-filter" onchange="filterEvents()">
          <option value="">All Types</option>
          ${eventTypes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>
      <div class="event-list" id="event-list">
        ${processedEvents.map(event => `
          <div class="event-item" data-type="${escapeHtml(event.type)}" data-search="${escapeHtml(JSON.stringify(event).toLowerCase())}">
            <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
            <span class="event-type ${escapeHtml(event.type)}">${escapeHtml(event.type)}</span>
            <span class="event-args">
              ${'rawUrl' in event ? `
                <span class="event-url raw">${escapeHtml(event.rawUrl as string)}</span>
                ${event.resolvedUrl ? `<span class="event-url resolved">→ ${escapeHtml(event.resolvedUrl as string)}</span>` : ''}
              ` : event.args?.length ? escapeHtml(JSON.stringify(event.args)) : ''}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Macros Section -->
  ${data.macros.length > 0 ? `
  <div class="section" id="macros-section">
    <div class="section-header" onclick="toggleSection('macros-section')">
      <div class="section-title">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        Detected Macros
        <span class="section-badge">${data.macros.length} macros</span>
      </div>
    </div>
    <div class="section-content">
      <table class="macro-table">
        <thead>
          <tr>
            <th>Macro</th>
            <th>Format</th>
            <th>Count</th>
            ${hasMacroValues ? '<th>Value Applied</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.macros.map(m => `
            <tr>
              <td class="macro-raw">${escapeHtml(m.raw)}</td>
              <td>${escapeHtml(m.format)}</td>
              <td>${m.count}x</td>
              ${hasMacroValues ? `<td class="macro-value">${data.macroValues?.[m.raw]?.trim() ? escapeHtml(data.macroValues[m.raw]) : '—'}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- Personalization Section -->
  ${hasTextChanges || hasTagMod || hasMacroValues || data.clickMacroFixApplied ? `
  <div class="section" id="personalization-section">
    <div class="section-header" onclick="toggleSection('personalization-section')">
      <div class="section-title">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        Personalization & Modifications
      </div>
    </div>
    <div class="section-content">
      ${data.clickMacroFixApplied ? '<div class="change-item"><span style="color:var(--emerald)">✓</span> Click macro fix applied (via compliance)</div>' : ''}
      ${hasTextChanges ? data.textChanges!.map(change => `
        <div class="change-item">
          ${change.type ? `<div class="change-type">${escapeHtml(change.type)}</div>` : ''}
          <span class="change-old">${escapeHtml(change.original)}</span>
          <span class="change-arrow">→</span>
          <span class="change-new">${escapeHtml(change.current)}</span>
        </div>
      `).join('') : ''}
      ${hasTagMod ? `
        <div class="code-block">
          <div class="code-header">
            <span>tag-modified.html</span>
            <button class="copy-btn" onclick="copyCode('modified-tag')">Copy</button>
          </div>
          <pre class="code-content" id="modified-tag">${escapeHtml(data.modifiedTag!)}</pre>
        </div>
      ` : ''}
    </div>
  </div>` : ''}

  <!-- Files Section -->
  <div class="section" id="files-section">
    <div class="section-header" onclick="toggleSection('files-section')">
      <div class="section-title">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        Package Contents
      </div>
    </div>
    <div class="section-content">
      <div class="file-list">
        <a href="metadata.json" class="file-item" target="_blank"><span class="file-icon">📄</span> metadata.json</a>
        <a href="events.json" class="file-item" target="_blank"><span class="file-icon">📄</span> events.json</a>
        ${data.compliance ? '<a href="compliance.json" class="file-item" target="_blank"><span class="file-icon">📄</span> compliance.json</a>' : ''}
        ${data.macros.length > 0 ? '<a href="macros.json" class="file-item" target="_blank"><span class="file-icon">📄</span> macros.json</a>' : ''}
        ${hasTextChanges || hasTagMod || hasMacroValues ? '<a href="personalization.json" class="file-item" target="_blank"><span class="file-icon">📄</span> personalization.json</a>' : ''}
        ${data.screenshot ? '<a href="screenshot.png" class="file-item" target="_blank"><span class="file-icon">🖼️</span> screenshot.png</a>' : ''}
        ${data.recording ? `<a href="recording.${data.recordingFormat === 'mp4' ? 'mp4' : 'webm'}" class="file-item" target="_blank"><span class="file-icon">🎬</span> recording.${data.recordingFormat === 'mp4' ? 'mp4' : 'webm'}</a>` : ''}
        ${data.originalTag ? '<a href="tag-original.html" class="file-item" target="_blank"><span class="file-icon">📝</span> tag-original.html</a>' : ''}
        ${hasTagMod ? '<a href="tag-modified.html" class="file-item" target="_blank"><span class="file-icon">📝</span> tag-modified.html</a>' : ''}
        <a href="qa-report.txt" class="file-item" target="_blank"><span class="file-icon">📋</span> qa-report.txt</a>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    Generated by <a href="https://doppelist.com" target="_blank">Doppelist</a> v${escapeHtml(data.metadata.version)}
  </footer>

  <!-- Modal for screenshot -->
  <div class="modal" id="modal" onclick="closeModal()">
    <button class="modal-close" onclick="closeModal()">×</button>
    <img id="modal-img" src="" alt="Full size screenshot" />
  </div>

  <script>
    // Section toggle
    function toggleSection(id) {
      const section = document.getElementById(id);
      section.classList.toggle('collapsed');
      localStorage.setItem('section_' + id, section.classList.contains('collapsed'));
    }

    // Restore section states
    document.querySelectorAll('.section').forEach(section => {
      const collapsed = localStorage.getItem('section_' + section.id);
      if (collapsed === 'true') section.classList.add('collapsed');
    });

    // Event filtering
    function filterEvents() {
      const search = document.getElementById('event-search').value.toLowerCase();
      const type = document.getElementById('event-type-filter').value;
      document.querySelectorAll('.event-item').forEach(item => {
        const matchesType = !type || item.dataset.type === type;
        const matchesSearch = !search || item.dataset.search.includes(search);
        item.classList.toggle('hidden', !(matchesType && matchesSearch));
      });
    }

    // Copy code
    function copyCode(id) {
      const code = document.getElementById(id).textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      });
    }

    // Modal
    function openModal(src) {
      document.getElementById('modal-img').src = src;
      document.getElementById('modal').classList.add('active');
    }
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  </script>
</body>
</html>`;
}

