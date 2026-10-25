// ==========================================
// Alignment Metrics
// ==========================================

/** Compute the duration of a clip in seconds */
export const clipDurationSec = (start: number, end: number): number => {
  return (end - start) / 48000;
};

/** Compute the export window duration given a clip and padding */
export const exportWindowDuration = (
  coreStart: number,
  coreEnd: number,
  padSec = 5,
): number => {
  const windowStart = coreStart - padSec * 48000;
  const windowEnd = coreEnd + padSec * 48000;
  return (windowEnd - windowStart) / 48000;
};

/** Validate that a clip's duration is sane relative to its text length */
export const validateClipDuration = (
  durationSec: number,
  text: string,
  minCharsPerSec = 2.5,
  maxCharsPerSec = 4.5,
): { valid: boolean; message?: string } => {
  const chars = text.length;
  const rate = durationSec > 0 ? chars / durationSec : 0;

  if (rate < minCharsPerSec) {
    return {
      valid: false,
      message: `Clip too slow: ${rate.toFixed(1)} chars/sec (min ${minCharsPerSec})`,
    };
  }
  if (rate > maxCharsPerSec) {
    return {
      valid: false,
      message: `Clip too fast: ${rate.toFixed(1)} chars/sec (max ${maxCharsPerSec})`,
    };
  }
  return { valid: true };
};

/** Trim whitespace from both ends of script text */
export const trimScriptText = (text: string): string => text.trim();

/** Slugify a string for use in filenames */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
