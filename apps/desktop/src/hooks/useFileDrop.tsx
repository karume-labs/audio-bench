import { useTauriDrop } from "@/hooks/useTauriDrop";
import { classifyDropPaths } from "@/lib/dropKind";
import { useDropZoneStore } from "@/stores/useDropZoneStore";
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

  useTauriDrop();
};
