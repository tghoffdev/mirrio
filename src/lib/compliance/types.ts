/**
 * Compliance Check Types
 *
 * Type definitions for the compliance checking system.
 */

export type CheckStatus = "pass" | "fail" | "warn" | "pending" | "skipped";

export type CheckCategory =
  | "file-size"
  | "load-time"
  | "security"
  | "click-tracking"
  | "tracking-pixels";

export interface ComplianceCheckItem {
  label: string;
  value: string | number;
  status: CheckStatus;
  meta?: Record<string, unknown>;
}

export interface ComplianceCheck {
  id: string;
  category: CheckCategory;
  name: string;
  description: string;
  status: CheckStatus;
  /** Threshold that was used */
  threshold?: string | number;
  /** Actual measured value */
  value?: string | number;
  /** Human-readable details */
  details?: string;
  /** Expandable items (e.g., list of files, URLs) */
  items?: ComplianceCheckItem[];
}

export interface ComplianceResult {
  timestamp: number;
  /** Overall status (worst case of all checks) */
  overallStatus: CheckStatus;
  checks: ComplianceCheck[];
  /** Raw data collected for checks */
  data: ComplianceData;
}

export interface FileInfo {
  path: string;
  size: number;
  contentType: string;
}

export interface TimingInfo {
  loadStart?: number;
  mraidReady?: number;
  networkIdle?: number;
}

export interface ClickInfo {
  type: "clickTag" | "mraid.open" | "window.open" | "anchor";
  url?: string;
  hasHandler: boolean;
}

export interface PixelInfo {
  type: "impression" | "view" | "click" | "tracking" | "beacon";
  url: string;
  method: "image" | "beacon" | "xhr";
}

export interface ComplianceData {
  files: FileInfo[];
  timing: TimingInfo;
  clicks: ClickInfo[];
  pixels: PixelInfo[];
  /** Raw HTML/JS content for scanning (optional, for security checks) */
  sourceContent?: string;
}

/** Message from service worker with file data */
export interface ComplianceFilesMessage {
  type: "compliance-files";
  files: FileInfo[];
  totalSize: number;
  loadStart: number;
}
