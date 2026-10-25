// Raw colour strings for Wavesurfer.js, which cannot read CSS variables.
// MUST stay in sync with the CSS variables defined in cssVariables.ts.
export const WAVEFORM_COLORS = {
  /** Recessed well behind the waveform (dark shade 8). */
  background: "#0B1524",
  /** Waveform bars (teal, dimmed). */
  wave: "rgba(79, 209, 197, 0.55)",
  /** Progress / played portion (solid teal). */
  waveProgress: "#4FD1C5",
  /** Playback cursor. */
  cursor: "#E8EDF4",
  /** Core region (solid teal). */
  coreRegion: "rgba(79, 209, 197, 0.90)",
  /** 5s export window (teal at 16% opacity) — the lighter shaded area behind the core. */
  exportWindow: "rgba(79, 209, 197, 0.16)",
  /** Cut marker line. */
  cutLine: "#FBBF24",
  /** Playhead line. */
  playhead: "#F43F5E",
  /** Rejected clip region. */
  rejectedRegion: "rgba(244, 63, 94, 0.28)",
  /** Flagged (duration_outlier / edge_clamped) region. */
  flaggedRegion: "rgba(251, 191, 36, 0.28)",
  /** Approved clip region. */
  approvedRegion: "rgba(79, 209, 197, 0.18)",
  /** Active clip region. */
  activeRegion: "rgba(79, 209, 197, 0.32)",
  /** Proposed clip region. */
  proposedRegion: "rgba(251, 191, 36, 0.16)",
} as const;
