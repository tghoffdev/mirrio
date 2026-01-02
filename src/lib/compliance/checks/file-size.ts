/**
 * File Size Compliance Checks
 */

import type { FileInfo, ComplianceCheck } from "../types";
import type { DSPRules } from "../rules";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export function runFileSizeChecks(
  files: FileInfo[],
  rules: DSPRules
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  if (files.length === 0) {
    checks.push({
      id: "file-size-total",
      category: "file-size",
      name: "Total Bundle Size",
      description: "No files loaded to check",
      status: "skipped",
    });
    return checks;
  }

  // Total bundle size check
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const bundleStatus = totalSize <= rules.maxBundleSize ? "pass" : "fail";

  checks.push({
    id: "file-size-total",
    category: "file-size",
    name: "Total Bundle Size",
    description: `Bundle must be under ${formatBytes(rules.maxBundleSize)}`,
    status: bundleStatus,
    threshold: rules.maxBundleSize,
    value: totalSize,
    details: `${formatBytes(totalSize)} / ${formatBytes(rules.maxBundleSize)}`,
    items: files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10) // Top 10 files by size
      .map((f) => ({
        label: f.path,
        value: formatBytes(f.size),
        status: f.size <= rules.maxFileSize ? "pass" : "warn",
      })),
  });

  // Individual file size check (warning level)
  const oversizedFiles = files.filter((f) => f.size > rules.maxFileSize);

  if (oversizedFiles.length > 0) {
    checks.push({
      id: "file-size-individual",
      category: "file-size",
      name: "Large Files",
      description: `Individual files should be under ${formatBytes(rules.maxFileSize)}`,
      status: "warn",
      details: `${oversizedFiles.length} file(s) exceed recommended limit`,
      items: oversizedFiles.map((f) => ({
        label: f.path,
        value: formatBytes(f.size),
        status: "warn",
      })),
    });
  }

  // File type check
  const fileExtensions = files.map((f) => {
    const ext = f.path.split(".").pop()?.toLowerCase() || "";
    return { path: f.path, ext };
  });

  const disallowedFiles = fileExtensions.filter(
    (f) => f.ext && !rules.allowedFileTypes.includes(f.ext)
  );

  if (disallowedFiles.length > 0) {
    checks.push({
      id: "file-size-types",
      category: "file-size",
      name: "File Types",
      description: "Some file types may not be accepted",
      status: "warn",
      details: `${disallowedFiles.length} file(s) with non-standard types`,
      items: disallowedFiles.map((f) => ({
        label: f.path,
        value: `.${f.ext}`,
        status: "warn",
      })),
    });
  }

  return checks;
}
