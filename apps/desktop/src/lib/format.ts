export const SAMPLE_RATE = 48_000;

export const samplesToSeconds = (samples: number): number =>
  samples / SAMPLE_RATE;

export const secondsToSamples = (seconds: number): number =>
  Math.round(seconds * SAMPLE_RATE);

/** Timecode as m:ss.mmm (or h:mm:ss.mmm beyond an hour). */
export const formatTimecode = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = s.toFixed(3).padStart(6, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
};

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

/** Basename of a path (POSIX + Windows separators). */
export const basename = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;

/** Extension of a path, lowercased, without the dot. */
export const extname = (path: string): string => {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const AUDIO_EXTENSIONS = new Set([
  "wav",
  "flac",
  "mp3",
  "m4a",
  "aac",
  "ogg",
]);
export const SCRIPT_EXTENSIONS = new Set(["csv", "txt", "xlsx"]);
