import { type UnlistenFn, listen } from "@tauri-apps/api/event";
import { isTauri } from "./commands";

export interface AnalysisProgress {
  phase: string;
  pct: number;
  message: string;
}

/** Subscribe to backend analysis progress. Resolves to an unlisten fn. */
export const onAnalysisProgress = (
  cb: (p: AnalysisProgress) => void,
): Promise<UnlistenFn> => {
  if (!isTauri()) return Promise.resolve(() => {});
  return listen<AnalysisProgress>("analysis-progress", (event) =>
    cb(event.payload),
  );
};
