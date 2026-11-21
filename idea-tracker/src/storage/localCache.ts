import { normalizeDataFile } from "../domain/merge";
import { emptyDataFile, type DataFile } from "../domain/types";

const DATA_KEY = "idea-tracker:data:v1";
const DIRTY_KEY = "idea-tracker:dirty:v1";
const SHA_KEY = "idea-tracker:sha:v1";
const CONFIG_KEY = "idea-tracker:github:v1";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked — the in-memory state still works */
  }
}

export function loadData(): DataFile {
  const raw = read(DATA_KEY);
  if (!raw) return emptyDataFile();
  try {
    return normalizeDataFile(JSON.parse(raw));
  } catch {
    return emptyDataFile();
  }
}
export const saveData = (data: DataFile) => write(DATA_KEY, JSON.stringify(data));

export const isDirty = () => read(DIRTY_KEY) === "1";
export const setDirty = (dirty: boolean) => write(DIRTY_KEY, dirty ? "1" : null);

export const loadSha = () => read(SHA_KEY);
export const saveSha = (sha: string | null) => write(SHA_KEY, sha);

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token: string;
}

export function loadConfig(): GitHubConfig | null {
  const raw = read(CONFIG_KEY);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as GitHubConfig;
    return c.owner && c.repo && c.token ? c : null;
  } catch {
    return null;
  }
}
export const saveConfig = (c: GitHubConfig | null) => write(CONFIG_KEY, c ? JSON.stringify(c) : null);
