# ADR 002: Deterministic Audio Engine

**Status:** Accepted
**Date:** 2026-10-21

## Context

The product's core risk is **alignment drift**: ~500 spoken sentences must map to script
IDs, and one missed or extra split shifts every ID after it. The tool must therefore be
predictable - the same inputs always produce the same cuts, the same names, and the same
manifest, or the count gate becomes useless.

## Decision

1. **One conformed master.** On import the source is decoded (Symphonia/Hound), downmixed
   to mono, and resampled to a single 24-bit / 48 kHz / mono PCM WAV. Every timestamp in
   the app - UI, project file, manifest, export slicing - is an **integer sample index**
   on that master. Float seconds never cross a storage or IPC boundary except for
   display.

2. **Levels are never touched.** No gain, normalization, or limiting anywhere in the
   pipeline. Peak overshoots after resampling are reported as warnings and left alone
   (they are a DAW's problem downstream).

3. **Windows are derived, not stored.** The export window is always
   `core ± 5.000 s`, computed at export time from the clip's core region. The `.audiobench`
   file stores only core start/end, so changing pad settings cannot desync saved state.

4. **Edge policy is `pad_silence`.** When the 5 s pad would run past the recording, the
   window is filled with digital silence so *every* exported file is exactly
   `core + 10 s`. A 5 ms fade is applied only at the outer edges of the final buffer to
   prevent clicks.

5. **Deterministic assignment.** After any structural edit (split / merge / skip /
   reject / anchor) the clip-to-line mapping is recomputed by a single pure function
   `reassignScriptLines()` that walks clips in time order:
   * rejected clips are unassigned and consume no line;
   * anchored clips keep their line and force the walk to resume past it;
   * pinned lines are skipped by the sequential walk;
   * clips running past the end of the script become unassigned extras.

   There is no incremental "patch the mapping" path - the whole mapping is derived, so
   a split always shifts later IDs by exactly +1 and a merge by exactly −1.

6. **Detection is bounded by config, not heuristics.** Silence regions at or above
   `min_silence_ms` are always cut boundaries (no upper bound - a 30 s lead-in silence
   still splits the take). Thresholds come from the frame-RMS noise floor estimate.

## Consequences

* The count gate (`clips == non-skipped script lines`) is a meaningful invariant rather
  than a heuristic, because assignment has exactly one possible outcome per input.
* Re-analysis regenerates clip IDs; the project keeps script and settings but discards
  stale clip state, since sample indices from an older conform would be wrong.
* Manifest filenames are reproducible: same project file + same template ⇒ same bytes,
  which makes export diffs reviewable.

## Alternatives Considered

* **Store export windows in the project** - rejected: changing pad settings would require
  rewriting every clip, and stale windows would silently export the wrong audio.
* **Incremental ID re-assignment after edits** - rejected: hard to reason about, and any
  missed branch produces exactly the drift this tool exists to prevent.
* **Silence-region upper bound (drop >10 s silences)** - rejected: long lead-in or
  pause-with-recording still marks a real cut boundary; dropping it desynchronizes every
  following ID.
