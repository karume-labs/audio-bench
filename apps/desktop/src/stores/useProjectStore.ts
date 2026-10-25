import {
  type Clip,
  type ClipFlag,
  type ClipStatus,
  DEFAULT_ID_PATTERN,
  MANIFEST_COLUMNS,
  type Project,
  REPORT_COLUMNS,
  type ScriptLine,
  applyNamingTemplate,
  checkClipOutlier,
  checkNameCollisions,
  countGate,
  generateAlignmentReport,
  generateManifest,
  mergeClipWithNext,
  orderedClips,
  parseScriptImport,
  projectSchema,
  reassignScriptLines,
  rejectClip,
  restoreClip,
  skipScriptLine,
  splitClip,
  toCsv,
  toggleAnchor,
} from "@audio-bench/domain";
import { create } from "zustand";
import {
  analyzeRecording,
  exportClips,
  importScriptRows,
  loadProjectFile,
  saveProjectFile,
} from "../ipc/commands";
import type { AnalysisProgress } from "../ipc/events";
import {
  AUDIO_EXTENSIONS,
  SCRIPT_EXTENSIONS,
  basename,
  extname,
  formatDuration,
} from "../lib/format";
import { notifyError, notifySuccess } from "../lib/notify";
import { useEditorStore } from "./useEditorStore";

const newUuid = (): string => globalThis.crypto.randomUUID();

const deriveProjectPath = (originalPath: string): string =>
  `${originalPath.replace(/\.[^./\\]+$/, "")}.audiobench`;

/** Recompute derived flags (deterministic from clip + line state). */
const withFlags = (project: Project, clips: Clip[]): Clip[] => {
  const durationSamples =
    project.source.duration_samples ??
    Math.round(project.source.duration_s * 48_000);
  return clips.map((c) => {
    const line = c.script_line_id
      ? (project.script.find((l) => l.id === c.script_line_id) ?? null)
      : null;
    const flags: ClipFlag[] = [];
    // PRD §8.1: edge_clamped when the 5s export window runs past the recording.
    const padSamples = 5 * 48000;
    if (
      c.core_start_sample < padSamples ||
      c.core_end_sample + padSamples > durationSamples
    ) {
      flags.push("edge_clamped");
    }
    if (line && c.status !== "rejected") {
      const outlier = checkClipOutlier(
        c.core_start_sample,
        c.core_end_sample,
        durationSamples,
        line.text,
      );
      if (outlier) flags.push(outlier);
    }
    return { ...c, flags };
  });
};

interface ProjectStore {
  project: Project | null;
  projectPath: string | null;
  /** Script imported before any recording was loaded. */
  pendingScript: ScriptLine[] | null;
  busy: boolean;
  exporting: boolean;
  progress: AnalysisProgress | null;

  setProgress: (p: AnalysisProgress | null) => void;
  /** Route a dropped/picked path by extension. */
  ingestPath: (path: string) => Promise<void>;
  analyzeAudio: (path: string) => Promise<void>;
  importScriptFile: (path: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  saveProject: (announce?: boolean) => Promise<void>;
  /** Returns a blocker message when export must not proceed, else null. */
  exportBlockers: () => string | null;
  executeExport: (outDir: string) => Promise<void>;

  splitClipAt: (sample: number) => void;
  mergeActiveWithNext: (clipId: string) => void;
  setClipStatus: (clipId: string, status: ClipStatus) => void;
  toggleAnchorOp: (clipId: string) => void;
  skipLine: (lineId: string) => void;
  approveChecked: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  /** Persist the current project silently; failures surface as a toast. */
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

  /** Apply a clip/script mutation, recompute flags, autosave. */
  const commit = (
    next: { project?: Project; script?: ScriptLine[]; clips?: Clip[] },
    announce?: string,
  ): void => {
    const current = get().project;
    if (!current) return;
    const project: Project = {
      ...current,
      ...next,
      script: next.script ?? current.script,
      clips: next.clips ?? current.clips,
    };
    const clips = withFlags(
      project,
      reassignScriptLines(project.clips, project.script),
    );
    set({ project: { ...project, clips } });
    void persist();
    if (announce) notifySuccess("Updated", announce);
  };

  return {
    project: null,
    projectPath: null,
    pendingScript: null,
    busy: false,
    exporting: false,
    progress: null,

    setProgress: (p) => set({ progress: p }),

    ingestPath: async (path) => {
      const ext = extname(path);
      if (ext === "audiobench") return get().openProject(path);
      if (AUDIO_EXTENSIONS.has(ext)) return get().analyzeAudio(path);
      if (SCRIPT_EXTENSIONS.has(ext)) return get().importScriptFile(path);
      notifyError("Unsupported file", `Don't know how to open ".${ext}" files`);
      return Promise.resolve();
    },

    analyzeAudio: async (path) => {
      set({ busy: true, progress: null });
      try {
        const result = await analyzeRecording(path);
        const existing = get().project;
        const script = existing?.script ?? get().pendingScript ?? [];

        const detected: Clip[] = result.clips.map((c) => ({
          id: newUuid(),
          core_start_sample: c.startSample,
          core_end_sample: c.endSample,
          script_line_id: null,
          status: "proposed",
          anchored: false,
          flags: [],
        }));

        const project = projectSchema.parse({
          id: existing?.id ?? newUuid(),
          naming_template: existing?.naming_template ?? "{id}.wav",
          id_pattern: existing?.id_pattern ?? DEFAULT_ID_PATTERN,
          export_settings: existing?.export_settings ?? {
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
          script,
          clips: detected,
        });
        const clips = withFlags(
          project,
          reassignScriptLines(project.clips, project.script),
        );

        set({
          project: { ...project, clips },
          projectPath: deriveProjectPath(result.source.originalPath),
          pendingScript: null,
          busy: false,
          progress: null,
        });

        const editor = useEditorStore.getState();
        editor.setActive(clips[0]?.id ?? null);
        editor.setChecked([]);
        await persist();

        const gate = countGate(
          clips.filter((c) => c.status !== "rejected").length,
          project.script.filter((l) => !l.skipped).length,
        );
        notifySuccess(
          "Analysis complete",
          `${clips.length} clips from ${formatDuration(result.source.durationSeconds)} of audio. ${gate.message}`,
        );
      } catch (err) {
        set({ busy: false, progress: null });
        notifyError("Analysis failed", err);
      }
    },

    importScriptFile: async (path) => {
      try {
        const rows = await importScriptRows(path);
        const pattern = get().project?.id_pattern ?? DEFAULT_ID_PATTERN;
        const lines = parseScriptImport(rows, pattern);

        const project = get().project;
        if (project) {
          commit(
            { script: lines },
            `Imported ${lines.length} lines from ${basename(path)}`,
          );
        } else {
          set({ pendingScript: lines });
          notifySuccess(
            "Script staged",
            `${lines.length} lines imported. Load a recording to start aligning.`,
          );
        }
      } catch (err) {
        notifyError("Script import failed", err);
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
          pendingScript: null,
          busy: false,
          progress: null,
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
      const expected = project.script.filter((l) => !l.skipped).length;
      if (project.script.length === 0) return "Import a reference script first";
      const gate = countGate(active.length, expected);
      if (!gate.valid) return gate.message;
      const unassigned = active.filter((c) => !c.script_line_id).length;
      if (unassigned > 0)
        return `${unassigned} clip(s) have no assigned script line`;
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
      } catch (err) {
        notifyError("Export failed", err);
      } finally {
        set({ exporting: false });
      }
    },

    splitClipAt: (sample) => {
      const { project } = get();
      const active = useEditorStore.getState().activeClipId;
      if (!project || !active) return;
      try {
        commit({
          clips: splitClip(project.clips, project.script, active, sample),
        });
      } catch (err) {
        notifyError("Split failed", err);
      }
    },

    mergeActiveWithNext: (clipId) => {
      const { project } = get();
      if (!project) return;
      try {
        commit({
          clips: mergeClipWithNext(project.clips, project.script, clipId),
        });
      } catch (err) {
        notifyError("Merge failed", err);
      }
    },

    setClipStatus: (clipId, status) => {
      const { project } = get();
      if (!project) return;
      if (status === "approved") {
        commit(
          {
            clips: project.clips.map((c) =>
              c.id === clipId ? { ...c, status } : c,
            ),
          },
          undefined,
        );
      } else if (status === "rejected") {
        commit({ clips: rejectClip(project.clips, project.script, clipId) });
      } else {
        commit({ clips: restoreClip(project.clips, project.script, clipId) });
      }
    },

    toggleAnchorOp: (clipId) => {
      const { project } = get();
      if (!project) return;
      const target = project.clips.find((c) => c.id === clipId);
      commit(
        { clips: toggleAnchor(project.clips, project.script, clipId) },
        target?.anchored ? "Clip unanchored" : "Clip anchored to its line",
      );
    },

    skipLine: (lineId) => {
      const { project } = get();
      if (!project) return;
      const target = project.script.find((l) => l.id === lineId);
      if (!target) return;
      const script = target.skipped
        ? project.script.map((l) =>
            l.id === lineId ? { ...l, skipped: false } : l,
          )
        : skipScriptLine(project.script, lineId);
      commit(
        { script },
        target.skipped
          ? `Line ${target.script_id} restored`
          : `Line ${target.script_id} skipped`,
      );
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
  };
});
