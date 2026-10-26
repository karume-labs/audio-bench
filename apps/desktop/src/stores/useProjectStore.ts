import {
  type Clip,
  type ClipStatus,
  MANIFEST_COLUMNS,
  type Project,
  REPORT_COLUMNS,
  applyNamingTemplate,
  checkNameCollisions,
  generateAlignmentReport,
  generateManifest,
  mergeClipWithNext,
  orderedClips,
  projectSchema,
  rejectClip,
  restoreClip,
  splitClip,
  toCsv,
} from "@audio-bench/domain";
import { create } from "zustand";
import {
  analyzeRecording,
  exportClips,
  loadProjectFile,
  saveProjectFile,
} from "../ipc/commands";
import type { AnalysisProgress } from "../ipc/events";
import {
  AUDIO_EXTENSIONS,
  basename,
  extname,
  formatDuration,
} from "../lib/format";
import { notifyError, notifyInfo, notifySuccess } from "../lib/notify";
import { notifyOsIfUnfocused } from "../lib/osNotify";
import { useEditorStore } from "./useEditorStore";

const newUuid = (): string => globalThis.crypto.randomUUID();

const deriveProjectPath = (originalPath: string): string =>
  `${originalPath.replace(/\.[^./\\]+$/, "")}.audiobench`;

/** Recompute derived flags (edge_clamped based on the 5s export window). */
const withFlags = (project: Project, clips: Clip[]): Clip[] => {
  const durationSamples =
    project.source.duration_samples ??
    Math.round(project.source.duration_s * 48_000);
  const padSamples = 5 * 48000;
  return clips.map((c) => {
    const flags: (typeof c.flags extends (infer T)[] | undefined
      ? T
      : never)[] = [];
    if (
      c.core_start_sample < padSamples ||
      c.core_end_sample + padSamples > durationSamples
    ) {
      flags.push("edge_clamped");
    }
    return { ...c, flags };
  });
};

interface ProjectStore {
  project: Project | null;
  projectPath: string | null;
  busy: boolean;
  exporting: boolean;
  progress: AnalysisProgress | null;
  undoStack: Project[];
  redoStack: Project[];
  /** User override for min_silence_ms; null = auto-tune. */
  detectionMinSilenceMs: number | null;
  /** Resolved value actually used by the last analysis (ms). */
  lastResolvedMinSilenceMs: number | null;

  setProgress: (p: AnalysisProgress | null) => void;
  setDetectionMinSilenceMs: (value: number | null) => void;
  ingestPath: (path: string) => Promise<void>;
  analyzeAudio: (path: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  closeProject: () => void;
  saveProject: (announce?: boolean) => Promise<void>;
  exportBlockers: () => string | null;
  executeExport: (outDir: string) => Promise<void>;

  undo: () => void;
  redo: () => void;

  splitClipAt: (sample: number) => void;
  mergeActiveWithNext: (clipId: string) => void;
  setClipStatus: (clipId: string, status: ClipStatus) => void;
  approveChecked: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const persist = async (): Promise<void> => {
    const { project, projectPath } = get();
    if (!project || !projectPath) return;
    try {
      const clean = projectSchema.parse(project);
      await saveProjectFile(projectPath, clean);
    } catch (err) {
      notifyError("Autosave failed", err);
    }
  };

  const commit = (next: { clips?: Clip[] }, announce?: string): void => {
    const current = get().project;
    if (!current) return;
    // Push current state onto the undo stack before mutating.
    const undoStack = [...get().undoStack, structuredClone(current)];
    const project: Project = {
      ...current,
      clips: next.clips ?? current.clips,
    };
    const clips = withFlags(project, project.clips);
    set({ project: { ...project, clips }, undoStack, redoStack: [] });
    void persist();
    if (announce) notifySuccess("Updated", announce);
  };

  return {
    project: null,
    projectPath: null,
    busy: false,
    exporting: false,
    progress: null,
    undoStack: [],
    redoStack: [],
    detectionMinSilenceMs: null,
    lastResolvedMinSilenceMs: null,

    setProgress: (p) => set({ progress: p }),
    setDetectionMinSilenceMs: (value) => set({ detectionMinSilenceMs: value }),

    ingestPath: async (path) => {
      const ext = extname(path);
      if (ext === "audiobench") return get().openProject(path);
      if (AUDIO_EXTENSIONS.has(ext)) return get().analyzeAudio(path);
      notifyError("Unsupported file", `Don't know how to open ".${ext}" files`);
      return Promise.resolve();
    },

    analyzeAudio: async (path) => {
      set({ busy: true, progress: null });
      try {
        const result = await analyzeRecording(path, {
          minSilenceMs: get().detectionMinSilenceMs,
        });

        const detected: Clip[] = result.clips.map((c) => ({
          id: newUuid(),
          core_start_sample: c.startSample,
          core_end_sample: c.endSample,
          status: "proposed",
          flags: [],
        }));

        const project = projectSchema.parse({
          id: newUuid(),
          naming_template: "{n}.wav",
          export_settings: {
            pre_window_s: 5,
            post_window_s: 5,
            fade_ms: 5,
          },
          source: {
            original_path: result.source.originalPath,
            master_path: result.source.masterPath,
            duration_s: result.source.durationSeconds,
            duration_samples: result.source.durationSamples,
            warnings: result.source.warnings,
          },
          clips: detected,
        });
        const clips = withFlags(project, project.clips);

        set({
          project: { ...project, clips },
          projectPath: deriveProjectPath(result.source.originalPath),
          busy: false,
          progress: null,
          undoStack: [],
          redoStack: [],
          lastResolvedMinSilenceMs: result.minSilenceMs,
        });

        const editor = useEditorStore.getState();
        editor.setActive(clips[0]?.id ?? null);
        editor.setChecked([]);
        await persist();

        notifySuccess(
          "Analysis complete",
          `${clips.length} clips from ${formatDuration(result.source.durationSeconds)} of audio.`,
        );
        void notifyOsIfUnfocused(
          "Analysis complete",
          `${clips.length} clips ready for review.`,
        );
      } catch (err) {
        set({ busy: false, progress: null });
        notifyError("Analysis failed", err);
        void notifyOsIfUnfocused("Analysis failed", "See the app for details.");
      }
    },

    openProject: async (path) => {
      try {
        const raw = await loadProjectFile(path);
        if (raw === null) throw new Error(`Project not found: ${path}`);
        const project = projectSchema.parse(raw);
        set({
          project,
          projectPath: path,
          busy: false,
          progress: null,
          undoStack: [],
          redoStack: [],
          lastResolvedMinSilenceMs: null,
        });
        const editor = useEditorStore.getState();
        editor.setActive(orderedClips(project.clips)[0]?.id ?? null);
        editor.setChecked([]);
        notifySuccess(
          "Project opened",
          `${project.clips.length} clips from ${basename(path)}`,
        );
      } catch (err) {
        notifyError("Could not open project", err);
      }
    },

    closeProject: () => {
      const { busy, exporting, projectPath } = get();
      if (busy || exporting) {
        notifyInfo("Still busy", "Wait for analysis or export to finish.");
        return;
      }
      set({
        project: null,
        projectPath: null,
        busy: false,
        progress: null,
        undoStack: [],
        redoStack: [],
        lastResolvedMinSilenceMs: null,
      });
      const editor = useEditorStore.getState();
      editor.setActive(null);
      editor.setChecked([]);
      editor.setPlayhead(0);
      editor.setPlaying(false);
      editor.setZoom(0);
      notifyInfo(
        "Project closed",
        projectPath ? `Unloaded ${basename(projectPath)}` : "Workspace cleared",
      );
    },

    saveProject: async (announce = false) => {
      const { project, projectPath } = get();
      if (!project || !projectPath) {
        if (announce) notifyError("Nothing to save", "Load a recording first");
        return;
      }
      try {
        const clean = projectSchema.parse(project);
        await saveProjectFile(projectPath, clean);
        if (announce) notifySuccess("Project saved", basename(projectPath));
      } catch (err) {
        notifyError("Save failed", err);
      }
    },

    exportBlockers: () => {
      const { project } = get();
      if (!project) return "No project loaded";
      const active = orderedClips(project.clips).filter(
        (c) => c.status !== "rejected",
      );
      if (active.length === 0) return "No clips to export";
      try {
        checkNameCollisions(project.naming_template, project, active);
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      return null;
    },

    executeExport: async (outDir) => {
      const { project } = get();
      const blocker = get().exportBlockers();
      if (!project || blocker) {
        notifyError("Export blocked", blocker ?? "No project");
        return;
      }
      const active = orderedClips(project.clips).filter(
        (c) => c.status !== "rejected",
      );
      const settings = project.export_settings ?? {
        pre_window_s: 5,
        post_window_s: 5,
        fade_ms: 5,
      };

      set({ exporting: true });
      try {
        const manifestRows = generateManifest(project, active);
        const reportRows = generateAlignmentReport(project, project.clips);
        const manifestCsv = toCsv(manifestRows, MANIFEST_COLUMNS);
        const reportCsv = toCsv(reportRows, REPORT_COLUMNS, []);

        const clips = active.map((c) => ({
          filename: applyNamingTemplate(project.naming_template, project, c),
          coreStartSample: c.core_start_sample,
          coreEndSample: c.core_end_sample,
        }));

        const result = await exportClips({
          masterPath: project.source.master_path,
          outDir,
          preWindowS: settings.pre_window_s,
          postWindowS: settings.post_window_s,
          fadeMs: settings.fade_ms,
          clips,
          manifestCsv,
          reportCsv,
        });

        notifySuccess(
          "Export complete",
          `Wrote ${result.writtenFiles} clips + manifest.csv + alignment_report.csv to ${result.outDir}`,
        );
        void notifyOsIfUnfocused(
          "Export complete",
          `${result.writtenFiles} clips written to ${result.outDir}.`,
        );
      } catch (err) {
        notifyError("Export failed", err);
        void notifyOsIfUnfocused("Export failed", "See the app for details.");
      } finally {
        set({ exporting: false });
      }
    },

    splitClipAt: (sample) => {
      const { project } = get();
      const active = useEditorStore.getState().activeClipId;
      if (!project || !active) return;
      try {
        commit({ clips: splitClip(project.clips, active, sample) });
      } catch (err) {
        notifyError("Split failed", err);
      }
    },

    mergeActiveWithNext: (clipId) => {
      const { project } = get();
      if (!project) return;
      try {
        commit({ clips: mergeClipWithNext(project.clips, clipId) });
      } catch (err) {
        notifyError("Merge failed", err);
      }
    },

    setClipStatus: (clipId, status) => {
      const { project } = get();
      if (!project) return;
      if (status === "approved") {
        commit({
          clips: project.clips.map((c) =>
            c.id === clipId ? { ...c, status } : c,
          ),
        });
      } else if (status === "rejected") {
        commit({ clips: rejectClip(project.clips, clipId) });
      } else {
        commit({ clips: restoreClip(project.clips, clipId) });
      }
    },

    approveChecked: () => {
      const { project } = get();
      const checked = new Set(useEditorStore.getState().checked);
      if (!project || checked.size === 0) return;
      const clips = project.clips.map((c) =>
        checked.has(c.id) && c.status !== "rejected"
          ? { ...c, status: "approved" as const }
          : c,
      );
      commit({ clips }, `Approved ${checked.size} clip(s)`);
      useEditorStore.getState().setChecked([]);
    },

    undo: () => {
      const { project, undoStack } = get();
      if (!project || undoStack.length === 0) {
        notifyInfo("Undo", "Nothing to undo");
        return;
      }
      const previous = undoStack[undoStack.length - 1];
      const redoStack = [...get().redoStack, structuredClone(project)];
      set({
        project: structuredClone(previous),
        undoStack: undoStack.slice(0, -1),
        redoStack,
      });
      void persist();
    },

    redo: () => {
      const { project, redoStack } = get();
      if (!project || redoStack.length === 0) {
        notifyInfo("Redo", "Nothing to redo");
        return;
      }
      const next = redoStack[redoStack.length - 1];
      const undoStack = [...get().undoStack, structuredClone(project)];
      set({
        project: structuredClone(next),
        undoStack,
        redoStack: redoStack.slice(0, -1),
      });
      void persist();
    },
  };
});
