/** Human-readable meaning of each clip status, for tooltips. */
export const STATUS_TIP: Record<string, string> = {
  proposed: "Detected but not reviewed yet - included in the export.",
  approved: "Reviewed and confirmed - included in the export.",
  rejected: "Excluded from the export until you restore it.",
};

/** Human-readable meaning of each clip flag, for tooltips. */
export const FLAG_TIP: Record<string, string> = {
  edge_clamped:
    "The 5s lead-in or lead-out would run past the recording edge, so silence is padded instead.",
  duration_outlier: "This clip's duration is far from the session average.",
};
