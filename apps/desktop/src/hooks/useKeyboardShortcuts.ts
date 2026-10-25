import { orderedClips } from "@audio-bench/domain";
import { useEffect } from "react";
import { waveformBridge } from "../lib/waveformBridge";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

/** True when the event originated from a text-entry surface. */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
};

/**
 * PRD §6 keyboard workflow:
 *
 *   Space        play / pause
 *   Shift+Space  audition the active clip's export window
 *   ↑ / ↓        previous / next clip (seeks the playhead there)
 *   S            split active clip at playhead
 *   M            merge active clip with the next one
 *   A            approve active clip
 *   R            reject active clip
 *   K            skip the active clip's script line
 *   L            anchor / unanchor the active clip
 */
export const useKeyboardShortcuts = (): void => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const project = useProjectStore.getState();
      const editor = useEditorStore.getState();
      const orderedIds = project.project
        ? orderedClips(project.project.clips).map((c) => c.id)
        : [];
      const activeId = editor.activeClipId;

      switch (e.key) {
        case " ":
        case "Spacebar": {
          e.preventDefault();
          if (e.shiftKey) {
            // Audition the padded export window (built-in stop-at on ws.play).
            waveformBridge.actions?.playExportWindow();
          } else {
            waveformBridge.actions?.togglePlay();
          }
          return;
        }

        case "ArrowDown":
        case "ArrowUp": {
          if (orderedIds.length === 0) return;
          e.preventDefault();
          const nextId = editor.stepActive(
            e.key === "ArrowDown" ? 1 : -1,
            orderedIds,
          );
          if (nextId) {
            const clip = project.project?.clips.find((c) => c.id === nextId);
            if (clip)
              waveformBridge.actions?.seek(clip.core_start_sample / 48_000);
          }
          return;
        }

        default:
          break;
      }

      if (!project.project || !activeId) return;
      const clip = project.project.clips.find((c) => c.id === activeId);
      if (!clip) return;

      switch (e.key.toLowerCase()) {
        case "s":
          e.preventDefault();
          project.splitClipAt(Math.round(editor.playhead * 48_000));
          break;
        case "m":
          e.preventDefault();
          project.mergeActiveWithNext(activeId);
          break;
        case "a":
          e.preventDefault();
          project.setClipStatus(activeId, "approved");
          break;
        case "r":
          e.preventDefault();
          project.setClipStatus(activeId, "rejected");
          break;
        case "k":
          e.preventDefault();
          if (clip.script_line_id) project.skipLine(clip.script_line_id);
          break;
        case "l":
          e.preventDefault();
          project.toggleAnchorOp(activeId);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
