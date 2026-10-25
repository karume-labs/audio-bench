import { create } from "zustand";

export type SortKey = "index" | "status" | "duration";

interface EditorStore {
  /** Currently inspected clip (drives inspector, regions, keyboard ops). */
  activeClipId: string | null;
  /** Checkbox selection in the clip table (bulk approval). */
  checked: string[];
  /** Current playhead position in seconds. */
  playhead: number;
  playing: boolean;
  /** True while an export-window audition (Shift+Space) is running. */
  playingWindow: boolean;
  sort: { by: SortKey; dir: "asc" | "desc" };
  /** Waveform zoom in px/second; 0 = fit to container. */
  zoom: number;

  setActive: (id: string | null) => void;
  toggleChecked: (id: string) => void;
  setChecked: (ids: string[]) => void;
  setPlayhead: (seconds: number) => void;
  setPlaying: (playing: boolean, window?: boolean) => void;
  setSort: (by: SortKey) => void;
  setZoom: (pxPerSec: number) => void;
  stepActive: (direction: 1 | -1, orderedIds: string[]) => string | null;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  activeClipId: null,
  checked: [],
  playhead: 0,
  playing: false,
  playingWindow: false,
  sort: { by: "index", dir: "asc" },
  zoom: 0,

  setActive: (id) => set({ activeClipId: id }),
  toggleChecked: (id) =>
    set((s) => ({
      checked: s.checked.includes(id)
        ? s.checked.filter((x) => x !== id)
        : [...s.checked, id],
    })),
  setChecked: (ids) => set({ checked: ids }),
  setPlayhead: (seconds) => set({ playhead: seconds }),
  setPlaying: (playing, window = false) =>
    set({ playing, playingWindow: playing && window }),
  setSort: (by) =>
    set((s) => ({
      sort:
        s.sort.by === by
          ? { by, dir: s.sort.dir === "asc" ? "desc" : "asc" }
          : { by, dir: "asc" },
    })),
  setZoom: (zoom) => set({ zoom }),

  /** Move the active selection within an ordered clip id list. */
  stepActive: (direction, orderedIds) => {
    if (orderedIds.length === 0) return null;
    const current = get().activeClipId;
    const idx = current ? orderedIds.indexOf(current) : -1;
    let next: number;
    if (idx < 0) {
      next = direction === 1 ? 0 : orderedIds.length - 1;
    } else {
      next = Math.min(orderedIds.length - 1, Math.max(0, idx + direction));
    }
    const id = orderedIds[next];
    set({ activeClipId: id });
    return id;
  },
}));
