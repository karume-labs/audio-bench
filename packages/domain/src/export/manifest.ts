import { exportWindowDuration } from "../alignment/metrics";
import type { Clip, Project } from "../types";
import { applyNamingTemplate } from "./naming";

/** Manifest columns, in order. */
export const MANIFEST_COLUMNS = [
  "filename",
  "core_start_sample",
  "core_end_sample",
  "window_duration_s",
  "status",
] as const;

/**
 * Generate the manifest rows for an export batch.
 */
export const generateManifest = (
  project: Project,
  clips: Clip[],
): Array<Record<string, string>> => {
  const rows: Array<Record<string, string>> = [];

  for (const clip of clips) {
    const prePad = project.export_settings?.pre_window_s ?? 5.0;

    const windowDuration = exportWindowDuration(
      clip.core_start_sample,
      clip.core_end_sample,
      prePad,
    );

    rows.push({
      filename: applyNamingTemplate(project.naming_template, project, clip),
      core_start_sample: clip.core_start_sample.toString(),
      core_end_sample: clip.core_end_sample.toString(),
      window_duration_s: windowDuration.toFixed(3),
      status: clip.status,
    });
  }

  return rows;
};

/** Alignment report columns. */
export const REPORT_COLUMNS = ["issue", "detail"] as const;

/**
 * Generate the alignment report: one row per rejected take.
 */
export const generateAlignmentReport = (
  _project: Project,
  clips: Clip[],
): Array<Record<string, string>> => {
  const rows: Array<Record<string, string>> = [];

  for (const clip of clips) {
    if (clip.status === "rejected") {
      rows.push({
        issue: "rejected_take",
        detail: `${clip.core_start_sample}..${clip.core_end_sample}`,
      });
    }
  }

  return rows;
};

export const toCsv = (
  rows: Array<Record<string, string>>,
  columns: readonly string[],
  alwaysQuote: readonly string[] = [],
): string => {
  const escapeField = (value: string, forceQuote: boolean): string => {
    const needsQuote = forceQuote || /[",\r\n]/.test(value);
    if (!needsQuote) return value;
    return `"${value.replace(/"/g, '""')}"`;
  };

  const header = columns.map((c) => escapeField(c, false)).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => escapeField(row[c] ?? "", alwaysQuote.includes(c)))
      .join(","),
  );
  return `${[header, ...body].join("\n")}\n`;
};
