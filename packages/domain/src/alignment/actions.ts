import type { z } from "zod";
import { exportWindowSchema } from "../types";

/**
 * Create an export window given a clip's core region.
 * The window adds 5 seconds of padding on both sides (PRD §8.1).
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
