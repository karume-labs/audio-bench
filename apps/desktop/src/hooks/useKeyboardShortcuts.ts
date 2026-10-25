import { orderedClips } from "@audio-bench/domain";
import { useEffect } from "react";
import { waveformBridge } from "../lib/waveformBridge";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
};

export const useKeyboardShortcuts = (): void => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const project = useProjectStore.getState();
      // Allow Ctrl/Cmd+Z and Ctrl/Cmd+Y even though we otherwise ignore modifiers.
      const mod = e.ctrlKey || e.metaKey;
      if (
        mod &&
        (e.key === "z" || e.key === "y" || e.key === "Z" || e.key === "Y")
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          project.undo();
        } else if (
          e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey)
        ) {
          project.redo();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
