import { AUDIO_EXTENSIONS, extname } from "./format";

/**
 * What a drag or drop is carrying, as far as the app can act on it.
 *
 * Pure and framework-agnostic so it can be unit tested without React or
 * Tauri. The drop overlay and the ingest decision both derive from this.
 */
export type DropKind =
  | "none"
  | "recording"
  | "project"
  | "both"
  | "unsupported"
  | "multiple";

type FileRole = "recording" | "project" | "other";

const roleOf = (path: string): FileRole => {
  const ext = extname(path);
  if (ext === "audiobench") return "project";
  if (AUDIO_EXTENSIONS.has(ext)) return "recording";
  return "other";
};

/** True when a path can be handed to `ingestPath`. */
export const isIngestible = (path: string): boolean => roleOf(path) !== "other";

/** Classify a list of dropped paths (or file names). */
export const classifyDropPaths = (paths: string[]): DropKind => {
  if (paths.length === 0) return "none";
  const roles = paths.map(roleOf);
  if (roles.includes("other")) return "unsupported";
  const recordings = roles.filter((r) => r === "recording").length;
  const projects = roles.filter((r) => r === "project").length;
  if (recordings > 1 || projects > 1) return "multiple";
  if (paths.length > 2) return "multiple";
  if (recordings === 1 && projects === 1) return "both";
  return recordings === 1 ? "recording" : "project";
};

/** Extensions listed in the overlay hint; mono type is styled by the view. */
export const ACCEPTED_AUDIO = "WAV · FLAC · MP3 · M4A";

export interface DropContext {
  /** A project is currently open. */
  hasProject: boolean;
  /** An analysis or export is running; drops are ignored. */
  busy: boolean;
}

export interface DropCopy {
  title: string;
  hint: string;
  /** False when the drop would be refused - drives the neutral border/icon. */
  accept: boolean;
}

/** The plain, always-applicable dropzone copy (no special-case message). */
const baseDropCopy = (hasProject: boolean): DropCopy =>
  hasProject
    ? {
        title: "Drop to replace or open files",
        hint: "Audio Bench asks before replacing the session you already have open.",
        accept: true,
      }
    : {
        title: "Drop a recording to start",
        hint: `Accepts ${ACCEPTED_AUDIO} audio and .audiobench project files.`,
        accept: true,
      };

/** Context-aware copy for the drop overlay. */
export const dropCopy = (kind: DropKind, ctx: DropContext): DropCopy => {
  if (ctx.busy) {
    return {
      title: "Can't add files right now",
      hint: "Analysis or export is running - drop files again when it finishes.",
      accept: false,
    };
  }

  switch (kind) {
    // No dedicated "invalid file type" overlay: the normal dropzone panel
    // stays up (neutral border, because the drop will be refused) and the
    // rejection itself is reported by the toast when the files land.
    case "unsupported":
      return { ...baseDropCopy(ctx.hasProject), accept: false };
    case "multiple":
      return {
        title: "One recording at a time",
        hint: "Drop a single recording (optionally with its project file) - a session is one recording.",
        accept: false,
      };
    case "both":
      return {
        title: "Drop to open recording + project",
        hint: "The saved review state in the project file is loaded against the recording you're dragging.",
        accept: true,
      };
    case "recording":
      return ctx.hasProject
        ? {
            title: "Drop to replace the recording",
            hint: "You'll be asked to confirm - the open session is closed before the new one starts.",
            accept: true,
          }
        : {
            title: "Drop a recording to start",
            hint: "It is conformed to 24-bit / 48 kHz mono, then split into clips for review.",
            accept: true,
          };
    case "project":
      return ctx.hasProject
        ? {
            title: "Drop to open this project",
            hint: "You'll be asked to confirm - the open session is replaced by this one.",
            accept: true,
          }
        : {
            title: "Drop a project to resume",
            hint: "Reopens a saved .audiobench session with its clip statuses and undo history.",
            accept: true,
          };
    default:
      return baseDropCopy(ctx.hasProject);
  }
};

/** Screen-reader announcement while a drop is active. */
export const dropAnnouncement = (
  copy: DropCopy,
  isDragging: boolean,
): string =>
  isDragging
    ? `File drop active. ${copy.title}. ${copy.hint} Press Escape to dismiss.`
    : "";
