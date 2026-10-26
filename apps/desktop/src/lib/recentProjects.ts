const STORAGE_KEY = "audio-bench.recentProjects";
const MAX_ENTRIES = 8;

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
}

const read = (): RecentProject[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentProject =>
          typeof e?.path === "string" && typeof e?.name === "string",
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
};

const write = (entries: RecentProject[]): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
  } catch {
    /* ignore quota errors */
  }
};

export const loadRecentProjects = (): RecentProject[] => read();

export const recordRecentProject = (path: string, name: string): void => {
  const entries = read().filter((e) => e.path !== path);
  entries.unshift({ path, name, openedAt: Date.now() });
  write(entries);
};

export const removeRecentProject = (path: string): void => {
  write(read().filter((e) => e.path !== path));
};

export const clearRecentProjects = (): void => write([]);
