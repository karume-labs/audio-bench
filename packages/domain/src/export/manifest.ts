import { exportWindowDuration } from "../alignment/metrics";
import type { Clip, Project } from "../types";
import { applyNamingTemplate } from "./naming";

/** Manifest columns, in order (PRD §8.3). */
export const MANIFEST_COLUMNS = [
  "id",
  "filename",
  "text",
  "core_start_sample",
  "core_end_sample",
  "window_duration_s",
  "status",
] as const;

/**
 * Generate the manifest rows for an export batch.
 * `id` is the 7-digit script ID (never the clip UUID) and is written quoted
 * so Excel preserves leading zeros.
 */
export const generateManifest = (
  project: Project,
  clips: Clip[],
): Array<Record<string, string>> => {
  const rows: Array<Record<string, string>> = [];

  for (const clip of clips) {
    const line = project.script.find((sl) => sl.id === clip.script_line_id);
    const prePad = project.export_settings?.pre_window_s ?? 5.0;

    // pad_silence policy: window duration is always core + 2 × pad exactly,
    // regardless of how close the clip sits to the recording edges.
    const windowDuration = exportWindowDuration(
      clip.core_start_sample,
      clip.core_end_sample,
      prePad,
    );

    rows.push({
      id: line ? line.script_id : "",
      filename: applyNamingTemplate(project.naming_template, project, clip),
      text: line ? line.text : "",
      core_start_sample: clip.core_start_sample.toString(),
      core_end_sample: clip.core_end_sample.toString(),
      window_duration_s: windowDuration.toFixed(3),
      status: clip.status,
    });
  }

  return rows;
};

/** Alignment report columns (PRD §8.3 audit trail). */
export const REPORT_COLUMNS = ["issue", "detail"] as const;

/**
 * Generate the alignment report: missing script IDs, extra (unassigned)
 * clips, and rejected takes — one row per issue.
 */
export const generateAlignmentReport = (
  project: Project,
  clips: Clip[],
): Array<Record<string, string>> => {
  const rows: Array<Record<string, string>> = [];

  const assignedLineIds = new Set(
    clips.map((c) => c.script_line_id).filter(Boolean) as string[],
  );

  for (const line of project.script) {
    if (!assignedLineIds.has(line.id)) {
      rows.push({
        issue: line.skipped ? "skipped_line" : "missing_script_id",
        detail: line.script_id,
      });
    }
  }

  const lineById = new Map(project.script.map((l) => [l.id, l]));
  for (const clip of clips) {
    if (clip.status === "rejected") {
      const line = clip.script_line_id
        ? lineById.get(clip.script_line_id)
        : undefined;
      rows.push({
        issue: "rejected_take",
        detail: line ? line.script_id : clip.id,
      });
    } else if (!clip.script_line_id) {
      rows.push({
        issue: "extra_clip",
        detail: `${clip.core_start_sample}..${clip.core_end_sample}`,
      });
    }
  }

  return rows;
};

/**
 * Serialize rows to CSV (RFC 4180 quoting: fields containing commas, quotes,
 * or newlines are quoted; embedded quotes are doubled).
 * The `id` column is ALWAYS quoted to preserve leading zeros in Excel.
 */
export const toCsv = (
  rows: Array<Record<string, string>>,
  columns: readonly string[],
  alwaysQuote: readonly string[] = ["id"],
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
