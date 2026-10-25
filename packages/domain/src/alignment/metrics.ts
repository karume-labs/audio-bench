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

/** Slugify a string for use in filenames */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
