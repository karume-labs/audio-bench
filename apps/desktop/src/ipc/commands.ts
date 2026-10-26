import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export const isTauri = (): boolean =>
  typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in globalThis;

const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauri()) {
    return Promise.reject(
      new Error(
        "Not running inside Tauri - start the app with `bun run tauri dev`",
      ),
    );
  }
  return invoke<T>(cmd, args);
};

// ==========================================
// IPC payload types (must mirror the Rust serde structs, camelCase)
// ==========================================

export interface DetectionSettings {
  frameMs: number;
  overlapMs: number;
  marginDb: number;
  minSilenceMs: number | null;
  minClipMs: number;
  maxClipMs: number;
  noiseFloorPctl: number;
  guardMs: number;
}

export const DEFAULT_DETECTION: DetectionSettings = {
  frameMs: 10,
  overlapMs: 0,
  marginDb: 20,
  minSilenceMs: null,
  minClipMs: 300,
  maxClipMs: 10_000,
  noiseFloorPctl: 10,
  guardMs: 100,
};

export interface SourceInfo {
  originalPath: string;
  masterPath: string;
  durationSamples: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  warnings: string[];
}

export interface DetectedClip {
  startSample: number;
  endSample: number;
  edgeClamped: boolean;
}

export interface AnalysisResult {
  source: SourceInfo;
  clips: DetectedClip[];
  minSilenceMs: number;
}

export interface Peaks {
  width: number;
  positive: number[];
  negative: number[];
}

export interface ExportClip {
  filename: string;
  coreStartSample: number;
  coreEndSample: number;
}

export interface ExportRequest {
  masterPath: string;
  outDir: string;
  preWindowS: number;
  postWindowS: number;
  fadeMs: number;
  clips: ExportClip[];
  manifestCsv: string;
  reportCsv: string;
}

export interface ExportResult {
  writtenFiles: number;
  outDir: string;
  filenames: string[];
}

// ==========================================
// Commands
// ==========================================

export const analyzeRecording = (
  path: string,
  settings?: Partial<DetectionSettings>,
) => call<AnalysisResult>("analyze_recording", { path, settings });

export const generatePeaks = (masterPath: string, width: number) =>
  call<Peaks>("generate_peaks", { masterPath, width });

export const loadProjectFile = (path: string) =>
  call<unknown | null>("load_project", { path });

export const saveProjectFile = (path: string, project: unknown) =>
  call<void>("save_project", { path, project });

export const exportClips = (request: ExportRequest) =>
  call<ExportResult>("export_clips", { request });

// ==========================================
// Native dialogs
// ==========================================

export const pickAudioFile = (): Promise<string | null> =>
  open({
    multiple: false,
    title: "Choose a source recording",
    filters: [
      {
        name: "Audio",
        extensions: ["wav", "flac", "mp3", "m4a", "aac", "ogg"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });

export const pickProjectFile = (): Promise<string | null> =>
  open({
    multiple: false,
    title: "Open a project",
    filters: [{ name: "Audio Bench project", extensions: ["audiobench"] }],
  });

export const pickDirectory = (title: string): Promise<string | null> =>
  open({ directory: true, multiple: false, title });

export const pickProjectSavePath = (
  defaultPath: string,
): Promise<string | null> =>
  save({
    title: "Save project",
    defaultPath,
    filters: [{ name: "Audio Bench project", extensions: ["audiobench"] }],
  });
