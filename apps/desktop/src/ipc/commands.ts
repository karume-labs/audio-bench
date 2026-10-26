import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type {
  AnalysisResult,
  DetectionSettings,
  ExportRequest,
  ExportResult,
  Peaks,
} from "@/ipc/types";

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

export const deleteProjectFile = (path: string) =>
  call<void>("delete_project", { path });

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
