// IPC payload types (must mirror the Rust serde structs, camelCase).
// Kept separate from commands.ts so each file stays under the 150-line cap.

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
  previewPath: string;
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
