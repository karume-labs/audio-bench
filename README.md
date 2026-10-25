# AUDIO BENCH

A local desktop application that transforms long recordings of scripted voice-over sessions into export-ready, perfectly named audio clips.

## Core Principles

- **Local-First & Private**: Audio never leaves the user's hard drive. No cloud uploads, no server costs, absolute privacy for unreleased IP.
- **Deterministic Rules**: The app proposes cuts; the user approves. Output conforms to strict, configurable templates.
- **The Conformed Master**: All audio operations happen on a normalized 48 kHz internal timeline using exact sample indices.
- **Speed of Review**: The UI is heavily optimized for keyboard-driven, rapid verification of proposed cuts.

## Architecture

The application is built as a deeply decoupled monorepo:

| Layer | Location | Tech | Responsibility |
|-------|----------|------|----------------|
| **Frontend** | `apps/desktop` | React, TS, Mantine, Zustand, Wavesurfer.js | UI, state, waveform rendering, user interaction |
| **Backend Shell** | `apps/backend` | Tauri, Rust | OS integration, file I/O, exposing commands to UI |
| **Domain Logic** | `packages/domain` | Pure TS, Zod | Framework-agnostic rules: naming templates, splitting math, project schema validation |
| **Audio Engine** | `crates/audio-core` | Pure Rust, Symphonia, Hound | High-performance decoding, 48kHz master conforming, peak generation, PCM slicing |

## Quick Start

```bash
# Install dependencies
bun install

# Start development (Vite + Tauri)
bun run tauri dev

# Or just the web frontend:
bun run desktop:dev
```

This launches the Vite dev server on `localhost:1420` and starts the Tauri Rust backend.

## Commands

| Script | Description |
|--------|-------------|
| `bun run tauri dev` | Start full Tauri desktop app (frontend + Rust backend) |
| `bun run desktop:dev` | Start only the web Vite frontend |
| `bun run build` | Build all packages |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |

## PRD Stages

- **Stage 0**: Rust audio spike (de-risking) - decoding, conforming, silence detection, slicing
- **Stage 1**: UI shell & domain rules - Tauri backend, React frontend, TS Domain, project/file schemas
- **Stage 2**: MVP integration - wire Rust audio to UI, script parsing, count gate, keyboard workflow, naming engine, directory export

## Inputs

### Source Recording
- Format: WAV/FLAC/MP3/M4A per session (~up to ~100 MB, ~45 minutes)
- Ingestion: Read directly from OS filesystem via Tauri (no upload)

### Reference Script
- Format: `.xlsx` or `.csv` (plain text fallback)
- Structure: `(id, text)` pairs. Default: Column 1 = ID, Column 2 = Sentence
- Strict ID rules: IDs are **strings, never integers**. Leading zeros (e.g., `0100150`) must survive import, storage, display, and export. Default validation regex: `^\d{7}$`

## Outputs

1. **Audio Files**: Sliced bit-exact from the conformed master, written to user-chosen OS folder
2. **`manifest.csv`**: Contains `id` (quoted to preserve zeros), `filename`, `text`, `core_start_sample`, `window_duration_s`, etc.
3. **`alignment_report.csv`**: Audit trail listing missing script IDs, extra clips, and rejected takes

## Stage 0: Audio Core (De-risking)

Implemented in `crates/audio-core`:
- Decode WAV/FLAC/MP3/M4A via Symphonia
- Downmix stereo to mono `(L+R)/2`, warn if anti-correlated
- Resample to 48 kHz using rubato
- Energy envelope silence detection (adaptive threshold, 10th percentile noise floor)
- 5s export window with padding/clamping and fade-in/out
- PCM slicing with fade application

## Stage 1: UI Shell & Domain Rules

- Tauri backend with command handlers (import script/audio, detect silences, export clips)
- React frontend with Mantine UI, waveform rendering via Wavesurfer.js
- TS Domain with Zod-validated schemas (project, clip, export window)
- Project file `.audiobench` JSON read/write

## Stage 2: MVP Integration

- Rust audio pipeline wired to the UI through six Tauri commands with `analysis-progress` events
- Script parsing (`.csv` / `.txt` / `.xlsx`), Count Gate, deterministic naming engine, directory export
- Bulk approval/rejection, merge/split actions, anchor locking, skip-ID
- Native drag & drop: drop a recording, script, or `.audiobench` project anywhere in the window

## Keyboard Workflow

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `Shift+Space` | Audition the active clip's export window (5 s pad each side) |
| `↑` / `↓` | Previous / next clip (seeks the playhead) |
| `S` | Split active clip at playhead (later IDs shift +1) |
| `M` | Merge active clip with the next (later IDs shift −1) |
| `A` | Approve active clip |
| `R` | Reject active clip |
| `K` | Skip the active clip's script line |
| `L` | Anchor / unanchor the active clip |

## Development

```bash
# Generate fixture assets (44.1 kHz stereo session + 10-line script)
bun tools/make-fixtures.ts

# Type-check each package
(cd packages/domain && bunx tsc --noEmit)
(cd apps/desktop && bunx tsc --noEmit)

# Rust
cargo check --workspace --all-targets   # must be warning-free
cargo test --workspace
```

Fixtures are **generated, not committed** — `fixtures/` is gitignored (the WAV alone is
7.5 MB) and `bun tools/make-fixtures.ts` recreates both files deterministically.

### Notes

- **Decoding uses Symphonia, not FFmpeg sidecars.** WAV/FLAC/MP3/M4A/AAC decode natively in
  `crates/audio-core`, so there are no bundled binaries in `apps/backend/binaries/`.
- Only `bun.lock` is kept for JS dependencies (plus `Cargo.lock` for Rust); `bun.lockb` is not used.
- GTK theme warnings on Linux come from the system GTK theme, not from this repo.