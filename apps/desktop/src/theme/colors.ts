import type { MantineColor } from "@mantine/core";

// A full 10-shade Mantine scale. Index 0 is lightest, 9 is darkest.

export const teal = [
  "#E6FFFA",
  "#B2F5EA",
  "#81E6D9",
  "#5EDDD0",
  "#4FD1C5", // brand primary, shade 4
  "#38B2AC",
  "#319795",
  "#2C7A7B",
  "#285E61",
  "#234E52",
] as const;

export const dark = [
  "#E8EDF4", // 0 text
  "#C4CDD9", // 1
  "#8C9BB1", // 2 dimmed text
  "#5F7089", // 3
  "#33445E", // 4 borders
  "#263650", // 5 hover
  "#16253A", // 6 surfaces / panels
  "#0F1B2D", // 7 app background
  "#0B1524", // 8 recessed (waveform well, table header)
  "#070E19", // 9
] as const;

export const amber = [
  "#FFFBEB",
  "#FEF3C7",
  "#FDE68A",
  "#FCD34D",
  "#FBBF24", // cut line, warnings, needs review
  "#F59E0B",
  "#D97706",
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
  "#F43F5E", // playhead, rejected, destructive, errors
  "#E11D48",
  "#BE123C",
  "#9F1239",
  "#881337",
] as const;

// Semantic clip status → colour name. Feature code must use these constants
// instead of hard-coding colour names.
export type ClipStatusKey = "proposed" | "approved" | "rejected";

export const CLIP_STATUS_COLOR: Record<ClipStatusKey, MantineColor> = {
  proposed: "gray",
  approved: "teal",
  rejected: "rose",
};

// Clip flags use amber.
export const CLIP_FLAG_COLOR = "amber" as const;

// Status also needs an icon + text label (colour alone is not enough).
export const CLIP_STATUS_LABEL: Record<ClipStatusKey, string> = {
  proposed: "Proposed",
  approved: "Approved",
  rejected: "Rejected",
};
