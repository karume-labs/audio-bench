import { create } from "zustand";
import type { DropKind } from "../lib/dropKind";

/**
 * Shared state for the window-level drop overlay. Lives in a store (rather
 * than component state) so the drag listeners in `App` and the Escape
 * shortcut in `useKeyboardShortcuts` can both read and clear it without
 * prop drilling.
 */
interface DropZoneStore {
  isDragging: boolean;
  dropKind: DropKind;
  /** Start (or refresh) a drag; `kind` defaults to unclassified. */
  startDrag: (kind?: DropKind) => void;
  setDropKind: (kind: DropKind) => void;
  /** Hide the overlay (drag left, dropped, or Escape pressed). */
  dismiss: () => void;
}

export const useDropZoneStore = create<DropZoneStore>((set) => ({
  isDragging: false,
  dropKind: "none",
  startDrag: (kind = "none") => set({ isDragging: true, dropKind: kind }),
  setDropKind: (dropKind) => set({ dropKind }),
  dismiss: () => set({ isDragging: false, dropKind: "none" }),
}));
