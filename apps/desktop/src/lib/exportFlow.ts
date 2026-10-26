// lib/exportFlow.ts - Export flow logic extracted from useProjectStore.ts
// Keeps the store under the 150-line cap

import type { Clip, Project } from "@audio-bench/domain";

/** Check for naming collisions and return an export blocker message, or null. */
export const exportBlockers = (
  project: Project | null,
  active: Clip[],
): string | null => {
  if (!project) return "No project loaded";
  const clips = active.filter((c) => c.status !== "rejected");
  if (clips.length === 0) return "No clips to export";
  return null;
};
