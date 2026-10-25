# Audio Workbench (`audio-bench`) - Product Requirements Document

**Version:** 1.0 (Desktop Architecture)
**Platform:** Native Desktop Application (macOS/Windows)
**Architecture:** Tauri (Rust backend) + React/TypeScript frontend

> **Note:** The reference-script alignment feature (§2.2, §5.2, §5.3, §7 script schema, §8.2 `{id}`/`{text}` naming) has been removed. Clips are detected purely from audio; there is no transcription. Sections referencing scripts are retained for historical context only.

---

## 1. Product Overview

`audio-bench` is a local desktop application that transforms long recordings of scripted voice-over sessions into export-ready, perfectly named audio clips.

The tool tackles the **alignment problem**: matching ~500 spoken sentences to their corresponding script IDs. Because the final output requires a 5-second audio pad before and after each line, small boundary errors are harmless, but a missed or extra split shifts every subsequent ID. The app proposes cuts based on audio energy, allows fast visual review to fix alignment drift, applies deterministic naming rules, and exports the final batch directly to disk.

### 1.1 Core Principles

* **Local-First & Private:** Audio never leaves the user's hard drive. No cloud uploads, no server costs, absolute privacy for unreleased IP.
* **Deterministic Rules:** The app proposes; the user approves. Output conforms to strict, configurable templates.
* **The Conformed Master:** All audio operations happen on a normalized 48 kHz internal timeline using exact sample indices.
* **Speed of Review:** The UI is heavily optimized for keyboard-driven, rapid verification of proposed cuts.

### 1.2 Scope

* **MVP:** Upload recording and script -> Detect pauses via energy envelope -> Auto-assign IDs -> Visual review & correction -> Export 24-bit/48kHz WAVs + CSV manifests.
* **Future:** Automated batch processing and multi-file project templates.
* **Out of Scope:** Transcription, automatic speaker diarization, multitrack editing, audio effects (EQ/compression), level normalization (handled downstream in the DAW).

---

## 2. Inputs

### 2.1 The Source Recording

* **Format:** One WAV/FLAC/MP3/M4A file per session (typically up to ~100 MB, ~45 minutes).
* **Ingestion:** Read directly from the OS file system via Tauri (no upload process).

### 2.2 The Reference Script

* **Format:** Imported from `.xlsx` or `.csv`. Plain text fallback available.
* **Structure:** A list of `(id, text)` pairs. Default assumes Column 1 = ID, Column 2 = Sentence. One sheet per session.
* **Strict ID Rules:** IDs are **strings, never integers**. Leading zeros (e.g., `0100150`) must survive import, storage, display, and export. The default validation regex is `^\d{7}$`. Duplicate or malformed IDs block the import.

---

## 3. System Architecture & Tech Stack

The application is built as a deeply decoupled monorepo to isolate messy audio bytes from UI rendering and business logic.

| Layer | Location | Tech Stack | Responsibility |
| --- | --- | --- | --- |
| **Frontend** | `apps/desktop` | React, TS, Mantine, Zustand, Wavesurfer.js | UI, state, waveform rendering, user interaction. Knows nothing about OS or audio bytes. |
| **Backend Shell** | `apps/backend` | Tauri, Rust | OS integration, invoking sidecars, file I/O, exposing commands to the UI. Contains no business logic. |
| **Domain Logic** | `packages/domain` | Pure TypeScript, Zod | Framework-agnostic rules: naming templates, splitting math, project schema validation. |
| **Audio Engine** | `crates/audio-core` | Pure Rust, Symphonia, Hound | High-performance decoding, 48kHz master conforming, peak generation, PCM slicing. |

* **Sidecars:** FFmpeg and FFprobe are bundled as OS-specific sidecars in `apps/backend/binaries/` to handle compressed format probing and decoding.
* **Build Tools:** Bun workspaces, Turborepo (TS), Cargo workspace (Rust), Biome, Lefthook.

---

## 4. The Audio Pipeline (The Conformed Master)

To guarantee the output spec and prevent drift, the source file is converted immediately upon import.

1. **Conform Step:** The Rust audio engine uses FFmpeg/Symphonia to decode the source, downmix to mono (averaging `(L + R) / 2` by default, warning if anti-correlated), and resample to a **24-bit / 48 kHz / mono PCM WAV master**.
2. **Sample-Exact Timing:** Every timestamp in the UI, database, and logic is stored as an integer sample index based on this 48 kHz master.
3. **Level Policy:** `audio-bench` **never changes levels**. There is no gain, normalization, or limiting. Post-resample peaks above full scale are reported to the user, but not automatically lowered.
4. **UI Proxies:** The Rust backend generates precomputed peak profiles at multiple zoom levels so `Wavesurfer.js` renders instantly without the browser memory crashing. A lightweight playback proxy handles HTTP range requests for the UI.

---

## 5. Alignment & Detection Engine

### 5.1 Detection

* **Algorithm:** Frame-energy analysis over the 48kHz master.
* **Adaptive Threshold:** Estimates the noise floor from the 10th percentile of frame RMS, setting the threshold a configurable margin above it.
* **Defaults:** `1500ms` minimum silence, `300ms` minimum clip, `10s` maximum clip.
* **Core Region:** Cut boundaries run from speech onset to speech offset, plus a `100ms` guard padding to preserve soft breaths/consonants.

### 5.2 The Count Gate & Drift Detection

* The system compares *Detected Clips* vs. *Expected Script Lines* (e.g., "493 vs 500").
* Export is blocked if counts disagree, forcing the user to resolve the drift.
* **Duration Sanity Check:** Compares a clip's duration against the expected character-per-second rate of its assigned script line. Anomalies (e.g., two lines spoken without a pause) are flagged in the UI.

### 5.3 Correction Actions

The user can resolve drift using keyboard-mapped actions:

* *Split at playhead* (Later IDs shift +1)
* *Merge with next* (Later IDs shift -1)
* *Skip ID* (Line wasn't recorded)
* *Reject clip* (Cough/noise, exclude from assignments)
* *Anchor* (Lock a clip to an ID to prevent ripple effects during edits)

---

## 6. Frontend / UX

Designed as a high-speed audio workstation.

1. **Left Sidebar:** Project status, script import summary, processing profile, Count Gate.
2. **Center Workspace:** Wavesurfer.js waveform. Displays the **Core Region** (solid) and the **5s Export Window** (shaded overlap) so the user sees exactly what will be exported.
3. **Right Inspector:** ID, expected text, exact times, warning flags, approval toggle.
4. **Clip Table (Bottom):** Sortable list of all clips for bulk approval and fast jumping to flagged errors.
5. **Keyboard Workflow:** Space (Play/Pause), Shift+Space (Play Export Window), Up/Down (Next/Prev Clip), 'S' (Split), 'M' (Merge), 'A' (Approve).

---

## 7. Data Model (`.audiobench` JSON Schema)

Because this is a desktop app, state is saved as a local JSON file next to the master audio, governed by Zod schemas in `packages/domain`.

**Project Schema:**

* `id`: UUID
* `naming_template`: String (Default: `{id}.{ext}`)
* `id_pattern`: String (Default: `^\d{7}$`)
* `export_settings`: JSON (Pre/Post window duration, edge policies)
* `source`: Object (Paths to original, conformed master, durations, checksums)
* `script`: Array of `(uuid, script_id_string, text, position)`
* `clips`: Array of assigned regions.

**Clip Schema:**

* `id`: UUID
* `core_start_sample`, `core_end_sample`: Integers (48kHz indices)
* `script_line_id`: UUID (Nullable)
* `status`: enum (`proposed`, `approved`, `rejected`)
* `flags`: Array (e.g., `duration_outlier`, `edge_clamped`)

---

## 8. Export & Naming Engine

### 8.1 The Export Window

* **Window Logic:** The actual exported file is the **Core Region + 5.000 seconds on both sides**.
* *Rule:* Windows are derived at export time (`core_start - (5s * 48000)`). They are not stored.
* *Rule:* Windows naturally overlap neighboring clips. The exact core start/end is saved in the CSV manifest to denote the primary sentence.
* **Edge Policy:** If the 5s window exceeds the start/end of the recording, default to `pad_silence` to guarantee every file has exactly 5s of lead-in/out. Apply a `5ms` fade to outer edges to prevent clipping.

### 8.2 The Naming Engine

* **Template:** Configurable (e.g., `{project}_{category}_{language}_{id}.{ext}`).
* **Validation:** Domain logic sanitizes inputs (NFC normalization, strips illegal OS characters). No `eval()` allowed.
* **Collision Check:** Case-insensitive collision detection blocks export if two files resolve to the same name.

### 8.3 Outputs

1. **Audio Files:** Sliced bit-exact from the conformed master by the Rust engine. Written directly to the user's chosen OS destination folder.
2. **`manifest.csv`:** Contains `id` (quoted to preserve zeros in Excel), `filename`, `text`, `core_start_sample`, `window_duration_s`, etc.
3. **`alignment_report.csv`:** Audit trail listing missing script IDs, extra clips, and rejected takes.

---

## 9. Implementation Milestones

### Stage 0: Rust/Audio Spike (De-risking)

* Implement `crates/audio-core` to decode, conform to 48kHz, generate peaks, run silence detection, and slice WAVs via a basic CLI.

### Stage 1: The UI Shell & Domain Rules

* Scaffold Tauri backend, React frontend, and TS Domain.
* Implement `.audiobench` project file read/write, waveform rendering from precomputed peaks, and the split/merge/anchor alignment math.

### Stage 2: MVP Integration (Production Ready)

* Wire the Rust audio spike to the UI.
* Implement script parsing, Count Gate, keyboard workflow, deterministic naming engine, and directory export.
