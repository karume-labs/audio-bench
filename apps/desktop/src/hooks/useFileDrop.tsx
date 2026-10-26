import { isTauri } from "@/ipc/commands";
import { classifyDropPaths, isIngestible } from "@/lib/dropKind";
import { basename, extname } from "@/lib/format";
import { notifyError, notifyInfo } from "@/lib/notify";
import { useDropZoneStore } from "@/stores/useDropZoneStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef } from "react";

/**
 * Window-level drag & drop wiring. DOM listeners keep the overlay honest in a
 * plain browser; the Tauri listener drives the overlay from native paths and
 * routes drops through the same ingest pipeline as the Import/Open buttons.
 */
export const useFileDrop = (): void => {
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearLeaveTimer = (): void => {
      if (leaveTimer.current !== null) {
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
    };

    const hasFiles = (e: DragEvent): boolean =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      clearLeaveTimer();
      const names = Array.from(e.dataTransfer?.files ?? []).map((f) => f.name);
      const kind = names.length > 0 ? classifyDropPaths(names) : null;
      const state = useDropZoneStore.getState();
      if (!state.isDragging) {
        state.startDrag(kind ?? "none");
      } else if (kind !== null && kind !== state.dropKind) {
        state.setDropKind(kind);
      }
    };

    const onDragLeave = (): void => {
      if (!useDropZoneStore.getState().isDragging) return;
      clearLeaveTimer();
      leaveTimer.current = window.setTimeout(() => {
        leaveTimer.current = null;
        useDropZoneStore.getState().dismiss();
      }, 150);
    };

    const onDrop = (e: DragEvent): void => {
      clearLeaveTimer();
      useDropZoneStore.getState().dismiss();
      e.preventDefault();
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      clearLeaveTimer();
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const handleDropPaths = (paths: string[]): void => {
      const { busy, exporting, project, ingestPath } =
        useProjectStore.getState();

      if (busy || exporting) {
        notifyInfo(
          "Still busy",
          "Analysis or export is running - drop the files again when it finishes.",
        );
        return;
      }

      const kind = classifyDropPaths(paths);
      if (kind === "none" || kind === "unsupported" || kind === "multiple") {
        notifyError(
          kind === "multiple"
            ? "Too many files"
            : kind === "unsupported"
              ? "Unsupported file type"
              : "Nothing to open",
          kind === "multiple"
            ? "Drop one recording (optionally with its project file) at a time."
            : `Audio Bench opens WAV, FLAC, MP3, M4A recordings and .audiobench projects. Got: ${paths
                .map(basename)
                .join(", ")}`,
        );
        return;
      }

      const target =
        paths.find((p) => extname(p) === "audiobench") ??
        paths.find(isIngestible);
      if (!target) return;

      if (!project) {
        void ingestPath(target);
        return;
      }

      const openName = project.name ?? basename(project.source.original_path);
      modals.openConfirmModal({
        title: "Replace the open session?",
        children: (
          <Stack gap="xs">
            <Text size="sm">
              Open <b>{basename(target)}</b> while <b>{openName}</b> is open?
            </Text>
            <Text size="sm" c="dimmed">
              The current session is closed first. Your edits are already
              autosaved to the project file on disk, but the in-memory undo
              history is discarded.
            </Text>
          </Stack>
        ),
        labels: { confirm: "Replace", cancel: "Cancel" },
        onConfirm: () => {
          void ingestPath(target);
        },
      });
    };

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter") {
          useDropZoneStore
            .getState()
            .startDrag(classifyDropPaths(payload.paths));
          return;
        }
        if (payload.type === "over") {
          const state = useDropZoneStore.getState();
          if (!state.isDragging) state.startDrag();
          return;
        }
        if (payload.type === "leave") {
          useDropZoneStore.getState().dismiss();
          return;
        }
        useDropZoneStore.getState().dismiss();
        if (payload.paths.length > 0) handleDropPaths(payload.paths);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((err) => notifyError("Drag & drop unavailable", err));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
};
