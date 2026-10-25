# ADR 001: Desktop Architecture — Decoupled Monorepo

**Status:** Accepted
**Date:** 2026-10-21

## Context

`audio-bench` mixes three very different kinds of code: byte-level DSP, spreadsheet-style
business rules, and a reactive UI. Mixing them in one layer makes the audio pipeline
untestable without a window, and makes the UI depend on Rust types it should not know.

## Decision

Split the app into four layers with one-way dependencies, enforced by package boundaries:

| Layer | Path | Tech | Depends on |
| --- | --- | --- | --- |
| Frontend | `apps/desktop` | React, TS, Mantine, Zustand, Wavesurfer.js | `packages/domain`, Tauri IPC |
| Backend shell | `apps/backend` | Tauri v2, Rust | `crates/audio-core` |
| Domain logic | `packages/domain` | Pure TS + Zod | nothing (no React, no Tauri) |
| Audio engine | `crates/audio-core` | Pure Rust, Symphonia, Hound | nothing (no Tauri) |

Rules:

* `apps/backend` is a **thin shell**. Commands parse arguments, run jobs, emit progress
  events, and serialize results. No naming math, no count-gate rules, no schema policy.
* `crates/audio-core` has **no Tauri imports**, so `cargo test` runs headless in CI.
* `packages/domain` has **no React/Tauri imports**, so it runs in any JS runtime
  (including `bun test` and Node scripts like `tools/make-fixtures.ts`).
* The frontend never touches audio bytes. It requests precomputed peaks over IPC and
  streams playback through Tauri's asset protocol.

## Consequences

* The IPC contract is duplicated once (camelCase serde structs in Rust, mirrored TS
  interfaces in `apps/desktop/src/ipc/commands.ts`). Both sides must be changed together.
* Business rules are written once in TS and can be unit-tested without a display server.
* Building the desktop app requires both a Cargo workspace and a Bun workspace, but
  neither bleeds into the other's lockfile (`Cargo.lock` vs `bun.lock`).

## Alternatives Considered

* **Single Tauri app with Rust business logic** — rejected: the alignment rules are
  string/table heavy and iterate constantly during review; TS + Zod keeps them data-driven
  and hot-reloadable.
* **WASM audio engine in the frontend** — rejected for MVP: peak generation and slicing
  are already fast in native Rust, and WASM would complicate the 24-bit PCM file I/O.
