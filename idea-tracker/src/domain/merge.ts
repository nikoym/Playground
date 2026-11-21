import { DEFAULT_SETTINGS, type DataFile, type Idea } from "./types";

/**
 * Merge two copies of the data file (e.g. phone vs desktop).
 * - Ideas are merged by id; the newer `updatedAt` wins.
 * - Deletions (tombstones) from either side win over edits.
 * - Settings: newer `updatedAt` wins.
 */
export function mergeDataFiles(local: DataFile, remote: DataFile): DataFile {
  const deleted = new Set([...local.deletedIds, ...remote.deletedIds]);
  const byId = new Map<string, Idea>();
  for (const idea of [...remote.ideas, ...local.ideas]) {
    if (deleted.has(idea.id)) continue;
    const existing = byId.get(idea.id);
    if (!existing || idea.updatedAt > existing.updatedAt) byId.set(idea.id, idea);
  }
  const ideas = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settings = local.settings.updatedAt >= remote.settings.updatedAt ? local.settings : remote.settings;
  return { version: 1, settings, ideas, deletedIds: [...deleted].sort() };
}

/** Validate/repair a parsed JSON value into a DataFile. Throws on garbage. */
export function normalizeDataFile(value: unknown): DataFile {
  if (!value || typeof value !== "object") throw new Error("Not a data file.");
  const v = value as Partial<DataFile>;
  if (!Array.isArray(v.ideas)) throw new Error("Data file has no ideas array.");
  const s = v.settings ?? DEFAULT_SETTINGS;
  return {
    version: 1,
    settings: {
      cooldownDays: typeof s.cooldownDays === "number" ? s.cooldownDays : DEFAULT_SETTINGS.cooldownDays,
      weights: { ...DEFAULT_SETTINGS.weights, ...(s.weights ?? {}) },
      updatedAt: s.updatedAt ?? DEFAULT_SETTINGS.updatedAt,
    },
    ideas: v.ideas.filter((i): i is Idea => !!i && typeof i.id === "string" && typeof i.title === "string"),
    deletedIds: Array.isArray(v.deletedIds) ? v.deletedIds.filter((x) => typeof x === "string") : [],
  };
}

/** Structural equality good enough to detect "nothing changed". */
export function sameData(a: DataFile, b: DataFile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
