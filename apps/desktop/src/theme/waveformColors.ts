export interface WaveformColorSet {
  background: string;
  wave: string;
  waveProgress: string;
  cursor: string;
  coreRegion: string;
  exportWindow: string;
  cutLine: string;
  playhead: string;
  rejectedRegion: string;
  flaggedRegion: string;
  approvedRegion: string;
  activeRegion: string;
  proposedRegion: string;
}

export const WAVEFORM_COLORS_DARK: WaveformColorSet = {
  background: "#0D0D0F",
  wave: "rgba(79, 209, 197, 0.55)",
  waveProgress: "#4FD1C5",
  cursor: "#EDEDEF",
  coreRegion: "rgba(79, 209, 197, 0.90)",
  exportWindow: "rgba(79, 209, 197, 0.16)",
  cutLine: "#FBBF24",
  playhead: "#F43F5E",
  rejectedRegion: "rgba(244, 63, 94, 0.28)",
  flaggedRegion: "rgba(251, 191, 36, 0.28)",
  approvedRegion: "rgba(79, 209, 197, 0.18)",
  activeRegion: "rgba(79, 209, 197, 0.32)",
  proposedRegion: "rgba(251, 191, 36, 0.16)",
};

export const WAVEFORM_COLORS_LIGHT: WaveformColorSet = {
  background: "#ECECEE",
  wave: "rgba(45, 150, 140, 0.55)",
  waveProgress: "#2D968C",
  cursor: "#1A1A1D",
  coreRegion: "rgba(45, 150, 140, 0.90)",
  exportWindow: "rgba(45, 150, 140, 0.16)",
  cutLine: "#D97706",
  playhead: "#E11D48",
  rejectedRegion: "rgba(225, 29, 72, 0.28)",
  flaggedRegion: "rgba(217, 119, 6, 0.28)",
  approvedRegion: "rgba(45, 150, 140, 0.18)",
  activeRegion: "rgba(45, 150, 140, 0.32)",
  proposedRegion: "rgba(217, 119, 6, 0.16)",
};

/** Back-compat alias (dark scheme). */
export const WAVEFORM_COLORS = WAVEFORM_COLORS_DARK;

/** Return the waveform colour set for the given scheme. */
export const getWaveformColors = (
  scheme: "light" | "dark",
): WaveformColorSet =>
  scheme === "light" ? WAVEFORM_COLORS_LIGHT : WAVEFORM_COLORS_DARK;
