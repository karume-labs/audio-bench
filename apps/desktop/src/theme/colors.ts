import type { MantineColor } from "@mantine/core";

// A full 10-shade Mantine scale. Index 0 is lightest, 9 is darkest.

// Neutral scale "dark" (used for dark mode backgrounds and text).
export const dark = [
  "#EDEDEF", // 0 primary text
  "#C9C9CD", // 1
  "#9A9AA2", // 2 dimmed text
  "#6B6B73", // 3
  "#2E2E33", // 4 borders and input outlines
  "#232327", // 5 hover on surfaces
  "#1A1A1D", // 6 surfaces: panels, cards, sidebar, inspector
  "#121214", // 7 app background
  "#0D0D0F", // 8 recessed: waveform well, table header
  "#08080A", // 9
] as const;

// Light mode neutrals (use Mantine's gray scale, customised).
export const gray = [
  "#F5F5F6", // 0 app background (approx)
  "#FFFFFF", // 1 surfaces (approx)
  "#ECECEE", // 2 recessed (approx)
  "#DADADE", // 3 borders (approx)
  "#6B6B73", // 4 dimmed (approx)
  "#1A1A1D", // 5 text (approx)
  "#4A4A52",
  "#3A3A42",
  "#2A2A32",
  "#1A1A1D",
] as const;

export const teal = [
  "#E6FFFA",
  "#B2F5EA",
  "#81E6D9",
  "#5EDDD0",
  "#4FD1C5", // dark mode primary (shade 4)
  "#38B2AC",
  "#2D968C", // light mode primary (shade 6)
  "#2C7A7B",
  "#285E61",
  "#234E52",
] as const;

export const amber = [
  "#FFFBEB",
  "#FEF3C7",
  "#FDE68A",
  "#FCD34D",
  "#FBBF24", // dark mode (shade 4)
  "#F59E0B",
  "#D97706", // light mode (shade 6)
  "#B45309",
  "#92400E",
  "#78350F",
] as const;

export const rose = [
  "#FFF1F2",
  "#FFE4E6",
  "#FECDD3",
  "#FDA4AF",
  "#FB7185",
  "#F43F5E", // dark mode (shade 5)
  "#E11D48", // light mode (shade 6)
  "#BE123C",
  "#9F1239",
  "#881337",
] as const;

export type ClipStatusKey = "proposed" | "approved" | "rejected";

export const CLIP_STATUS_COLOR: Record<ClipStatusKey, MantineColor> = {
  proposed: "gray",
  approved: "teal",
  rejected: "rose",
};

export const CLIP_FLAG_COLOR = "amber" as const;

export const CLIP_STATUS_LABEL: Record<ClipStatusKey, string> = {
  proposed: "Proposed",
  approved: "Approved",
  rejected: "Rejected",
};
