import type { z } from "zod";
import {
  type ClipFlag,
  DEFAULT_ID_PATTERN,
  type ScriptLine,
  exportWindowSchema,
  idPattern,
} from "../types";
import { validateClipDuration } from "./metrics";

const newUuid = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c || typeof c.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is unavailable in this environment");
  }
  return c.randomUUID();
};

export interface RawScriptRow {
  /** Raw ID string as it appears in the file (may be malformed). */
  id: string;
  text: string;
  /** 1-based row number in the source file, for error messages. */
  rowNumber?: number;
}

/**
 * Validate a script import result (PRD §2.2).
 * - IDs must match the project's `id_pattern` (default `^\d{7}$`)
 * - Duplicate IDs block the import
 * - Original text is preserved verbatim (sanitization happens at naming time)
 *
 * Returns `ScriptLine[]` ready to store on a project.
 */
export const parseScriptImport = (
  rawRows: RawScriptRow[],
  idPatternStr: string = DEFAULT_ID_PATTERN,
): ScriptLine[] => {
  const pattern = new RegExp(idPatternStr, "u");
  const where = (row: RawScriptRow, i: number): string =>
    row.rowNumber !== undefined ? `row ${row.rowNumber}` : `line ${i + 1}`;

  const seen = new Set<string>();
  const lines: ScriptLine[] = rawRows.map((row, i) => {
    const id = row.id.trim();
    if (!pattern.test(id)) {
      throw new Error(
        `Invalid ID format at ${where(row, i)}: "${row.id}". Expected ${idPatternStr} (e.g., "0100150").`,
      );
    }
    if (seen.has(id)) {
      throw new Error(
        `Duplicate script ID "${id}" at ${where(row, i)}. IDs must be unique.`,
      );
    }
    seen.add(id);

    const text = row.text.trim();
    if (text.length === 0) {
      throw new Error(`Empty script text at ${where(row, i)} (ID "${id}").`);
    }

    return {
      id: newUuid(),
      script_id: idPattern.parse(id),
      text,
      position: i,
      skipped: false,
    };
  });

  return lines;
};

/**
 * Validate that a clip's duration is sane against its assigned text.
 * Returns `duration_outlier` when the chars/sec rate is anomalous.
 */
export const checkClipOutlier = (
  clipStart: number,
  clipEnd: number,
  masterDuration: number,
  text: string,
): ClipFlag | null => {
  void masterDuration;
  const clipDur = (clipEnd - clipStart) / 48000;
  const { valid } = validateClipDuration(clipDur, text);
  return valid ? null : "duration_outlier";
};

/**
 * Create an export window given a clip's core region.
 * The window adds 5 seconds of padding on both sides (PRD §8.1).
 * Returns whether each edge had to clamp to the recording bounds —
 * the exporter pads those with silence to guarantee exact 5s lead/out.
 */
export const createExportWindow = (
  coreStart: number,
  coreEnd: number,
  masterDuration: number,
): {
  window: z.infer<typeof exportWindowSchema>;
  hasLeadingPad: boolean;
  hasTrailingPad: boolean;
} => {
  const PAD_SAMPLES = 5 * 48000; // 5 seconds at 48kHz

  const hasLeadingPad = coreStart < PAD_SAMPLES;
  const hasTrailingPad = coreEnd + PAD_SAMPLES > masterDuration;

  let exportStart = coreStart - PAD_SAMPLES;
  let exportEnd = coreEnd + PAD_SAMPLES;
  if (exportStart < 0) exportStart = 0;
  if (exportEnd > masterDuration) exportEnd = masterDuration;

  const window = exportWindowSchema.parse({
    core_start: coreStart,
    core_end: coreEnd,
    export_start: exportStart,
    export_end: exportEnd,
    duration_s: (exportEnd - exportStart) / 48000,
  });

  return { window, hasLeadingPad, hasTrailingPad };
};

/** Count gate: verify detected clip count matches expected script lines. */
export const countGate = (
  detectedClipCount: number,
  expectedLineCount: number,
): { valid: boolean; message: string } => {
  if (detectedClipCount === expectedLineCount) {
    return { valid: true, message: "Count gate passed" };
  }
  if (detectedClipCount < expectedLineCount) {
    return {
      valid: false,
      message: `Count mismatch: ${detectedClipCount} clips detected, but ${expectedLineCount} lines in script. Some lines may not have been recorded.`,
    };
  }
  return {
    valid: false,
    message: `Count mismatch: ${detectedClipCount} clips detected, but ${expectedLineCount} lines in script. Some script lines are duplicated or extra audio was recorded.`,
  };
};
