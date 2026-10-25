import type { Clip } from "../types";

const newUuid = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c || typeof c.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is unavailable in this environment");
  }
  return c.randomUUID();
};

/** Clips in time order (the canonical ordering for display and assignment). */
export const orderedClips = (clips: Clip[]): Clip[] =>
  [...clips].sort(
    (a, b) =>
      a.core_start_sample - b.core_start_sample ||
      a.core_end_sample - b.core_end_sample,
  );

/**
 * Split the clip containing `sample` into two clips at that exact sample.
 * The first half keeps the original identity; the second half is new.
 * Throws when the split point is not strictly inside the clip.
 */
export const splitClip = (
  clips: Clip[],
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

  const first: Clip = { ...original, core_end_sample: sample };
  const second: Clip = {
    ...original,
    id: newUuid(),
    core_start_sample: sample,
    core_end_sample: original.core_end_sample,
    status: "proposed",
    flags: [],
  };

  const next = [...clips];
  next.splice(idx, 1, first, second);
  return next;
};

/**
 * Merge the clip with its immediate successor in time order.
 * The first clip's identity is kept and spans both core regions.
 */
export const mergeClipWithNext = (clips: Clip[], clipId: string): Clip[] => {
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
  return next;
};

/** Reject a clip (cough/noise) — excluded from exports. */
export const rejectClip = (clips: Clip[], clipId: string): Clip[] =>
  clips.map((c) => (c.id === clipId ? { ...c, status: "rejected" } : c));

/** Restore a rejected clip to proposed. */
export const restoreClip = (clips: Clip[], clipId: string): Clip[] =>
  clips.map((c) => (c.id === clipId ? { ...c, status: "proposed" } : c));

/** Approve a single clip. */
export const approveClipById = (clips: Clip[], clipId: string): Clip[] =>
  clips.map((c) => (c.id === clipId ? { ...c, status: "approved" } : c));

/** Bulk-approve every non-rejected clip. */
export const approveAllClips = (clips: Clip[]): Clip[] =>
  clips.map((c) =>
    c.status === "rejected" ? c : { ...c, status: "approved" },
  );
