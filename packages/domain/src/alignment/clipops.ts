import type { Clip, Project, ScriptLine } from "../types";

// ==========================================
// Alignment Correction Actions (PRD §5.3)
//
// Clips carry an optional `script_line_id` assignment. After any structural
// change (split, merge, skip, reject) we re-run a deterministic in-order
// assignment so that later IDs ripple exactly +1/-1 as the PRD specifies.
// Anchored clips keep their assignment and pin the walk past their line.
// ==========================================

const newUuid = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c || typeof c.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is unavailable in this environment");
  }
  return c.randomUUID();
};

/** Clips in time order (the canonical ordering for assignment walks). */
export const orderedClips = (clips: Clip[]): Clip[] =>
  [...clips].sort(
    (a, b) =>
      a.core_start_sample - b.core_start_sample ||
      a.core_end_sample - b.core_end_sample,
  );

/** Script lines that still participate in assignment (not skipped). */
export const assignableLines = (lines: ScriptLine[]): ScriptLine[] =>
  lines.filter((l) => !l.skipped);

/**
 * Re-assign script lines to clips in time order.
 *
 * Walk rules:
 * - rejected clips are unassigned and consume no line
 * - anchored clips keep their current line and force the walk to resume
 *   after that line (this is what "anchors prevent ripple" means)
 * - every other clip takes the next assignable line
 * - clips that run past the end of the script become unassigned (extra)
 */
export const reassignScriptLines = (
  clips: Clip[],
  lines: ScriptLine[],
): Clip[] => {
  const timeOrdered = orderedClips(clips);
  const result: Clip[] = clips.map((c) => ({ ...c }));
  const byId = new Map(result.map((c) => [c.id, c]));

  // Lines pinned by anchored clips are off-limits to the sequential walk.
  const pinned = new Set(
    clips
      .filter((c) => c.anchored && c.script_line_id)
      .map((c) => c.script_line_id as string),
  );

  // Pointer over the full line list (skip entries are transparent).
  let ptr = 0;
  const nextLine = (): ScriptLine | undefined => {
    while (ptr < lines.length) {
      const line = lines[ptr];
      ptr += 1;
      if (!line.skipped && !pinned.has(line.id)) return line;
    }
    return undefined;
  };
  const resumeAfter = (lineId: string): void => {
    const idx = lines.findIndex((l) => l.id === lineId);
    ptr = idx >= 0 ? idx + 1 : ptr;
  };

  for (const clip of timeOrdered) {
    const target = byId.get(clip.id);
    if (!target) continue;

    if (target.status === "rejected") {
      target.script_line_id = null;
      continue;
    }

    if (target.anchored && target.script_line_id) {
      // Keep the pinned line, resume the walk right after it.
      resumeAfter(target.script_line_id);
      continue;
    }

    const line = nextLine();
    target.script_line_id = line ? line.id : null;
  }

  // Preserve the caller's original array order (sorted separately for display).
  return result;
};

/**
 * Split the clip containing `sample` into two clips at that exact sample.
 * The first half keeps the original identity; the second half is new.
 * Re-assignment afterwards shifts all later IDs by +1 (PRD §5.3).
 * Throws when the split point is not strictly inside the clip.
 */
export const splitClip = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
  sample: number,
): Clip[] => {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx < 0) throw new Error("Clip not found");

  const original = clips[idx];
  if (
    sample <= original.core_start_sample ||
    sample >= original.core_end_sample
  ) {
    throw new Error(
      "Split point must be strictly inside the clip's core region (move the playhead first)",
    );
  }

  const first: Clip = { ...original };
  const second: Clip = {
    ...original,
    id: newUuid(),
    core_start_sample: sample,
    core_end_sample: original.core_end_sample,
    status: "proposed",
    anchored: false,
    script_line_id: null,
    flags: [],
  };
  first.core_end_sample = sample;
  first.status = original.status === "rejected" ? "proposed" : original.status;
  first.flags = [...(original.flags ?? [])];

  const next = [...clips];
  next.splice(idx, 1, first, second);
  return reassignScriptLines(next, lines);
};

/**
 * Merge the clip with its immediate successor in time order.
 * The first clip's identity is kept and spans both core regions.
 * Re-assignment afterwards shifts later IDs by -1 (PRD §5.3).
 */
export const mergeClipWithNext = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
): Clip[] => {
  const ordered = orderedClips(clips);
  const pos = ordered.findIndex((c) => c.id === clipId);
  if (pos < 0) throw new Error("Clip not found");

  const first = ordered[pos];
  const second = ordered[pos + 1];
  if (!second) throw new Error("This is the last clip — nothing to merge with");
  if (first.status === "rejected" || second.status === "rejected") {
    throw new Error("Cannot merge a rejected clip");
  }

  const merged: Clip = {
    ...first,
    core_start_sample: Math.min(
      first.core_start_sample,
      second.core_start_sample,
    ),
    core_end_sample: Math.max(first.core_end_sample, second.core_end_sample),
    status: "proposed",
    flags: [...(first.flags ?? []), ...(second.flags ?? [])].filter(
      (f, i, arr) => arr.indexOf(f) === i,
    ),
  };

  const next = clips.filter((c) => c.id !== first.id && c.id !== second.id);
  next.push(merged);
  return reassignScriptLines(next, lines);
};

/** Mark a script line as not recorded. Later assignments shift by -1. */
export const skipScriptLine = (
  lines: ScriptLine[],
  lineId: string,
): ScriptLine[] =>
  lines.map((l) => (l.id === lineId ? { ...l, skipped: true } : l));

/** Reject a clip (cough/noise) — excluded from assignments. */
export const rejectClip = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
): Clip[] =>
  reassignScriptLines(
    clips.map((c) =>
      c.id === clipId ? { ...c, status: "rejected", script_line_id: null } : c,
    ),
    lines,
  );

/** Restore a rejected clip to proposed and re-enter the assignment pool. */
export const restoreClip = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
): Clip[] =>
  reassignScriptLines(
    clips.map((c) => (c.id === clipId ? { ...c, status: "proposed" } : c)),
    lines,
  );

/** Toggle the anchor flag (locks a clip's line during re-assignment). */
export const toggleAnchor = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
): Clip[] =>
  reassignScriptLines(
    clips.map((c) => (c.id === clipId ? { ...c, anchored: !c.anchored } : c)),
    lines,
  );

/** Approve a single clip. */
export const approveClipById = (
  clips: Clip[],
  lines: ScriptLine[],
  clipId: string,
): Clip[] =>
  reassignScriptLines(
    clips.map((c) => (c.id === clipId ? { ...c, status: "approved" } : c)),
    lines,
  );

/** Bulk-approve every non-rejected clip (clip table bulk action). */
export const approveAllClips = (clips: Clip[], lines: ScriptLine[]): Clip[] =>
  reassignScriptLines(
    clips.map((c) =>
      c.status === "rejected" ? c : { ...c, status: "approved" as const },
    ),
    lines,
  );

/**
 * Build a fully-formed project after analysis + script import, with
 * deterministic initial assignment.
 */
export const buildProjectWithAssignment = (project: Project): Project => ({
  ...project,
  clips: reassignScriptLines(project.clips, project.script),
});
