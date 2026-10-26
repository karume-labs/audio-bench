import { orderedClips } from "@audio-bench/domain";
import { Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useEffect } from "react";
import { basename } from "../lib/format";
import { notifyInfo } from "../lib/notify";
import { waveformBridge } from "../lib/waveformBridge";
import { useDropZoneStore } from "../stores/useDropZoneStore";
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
        case "Escape": {
          // A visible drop overlay owns Escape first: dismiss it and stop.
          const dropZone = useDropZoneStore.getState();
          if (dropZone.isDragging) {
            e.preventDefault();
            dropZone.dismiss();
            return;
          }
          // A modal or drawer handles its own Escape (it closes first; its
          // element is still mounted when this listener runs).
          if (document.querySelector('[role="dialog"]')) return;
          if (!project.project) return;
          if (project.busy || project.exporting) {
            notifyInfo("Still busy", "Wait for analysis or export to finish.");
            return;
          }
          e.preventDefault();
          const current = project.project;
          const name = current.name ?? basename(current.source.original_path);
          modals.openConfirmModal({
            title: "Close project?",
            children: (
              <Stack gap="xs">
                <Text size="sm">
                  Close <b>{name}</b> and return to an empty workspace?
                </Text>
                <Text size="sm" c="dimmed">
                  Your edits are already autosaved to the project file on disk.
                  Closing only clears the session and its undo history from
                  memory.
                </Text>
              </Stack>
            ),
            labels: { confirm: "Close project", cancel: "Cancel" },
            confirmProps: { color: "red" },
            onConfirm: () => useProjectStore.getState().closeProject(),
          });
          return;
        }

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
