import { describe, expect, it } from "vitest";
import { mergeDataFiles, normalizeDataFile } from "../src/domain/merge";
import { capture, remove, updateIdea, updateSettings } from "../src/domain/transitions";
import { emptyDataFile } from "../src/domain/types";

const t = (m: number) => new Date(Date.UTC(2026, 10, 1, 10, m));

describe("mergeDataFiles", () => {
  const base = capture(emptyDataFile(), { title: "Shared", category: "game" }, t(0));

  it("keeps new ideas from both sides", () => {
    const local = capture(base.data, { title: "Phone idea", category: "other" }, t(1)).data;
    const remote = capture(base.data, { title: "Desktop idea", category: "other" }, t(2)).data;
    const m = mergeDataFiles(local, remote);
    expect(m.ideas.map((i) => i.title).sort()).toEqual(["Desktop idea", "Phone idea", "Shared"]);
  });

  it("newer edit of the same idea wins, regardless of side", () => {
    const local = updateIdea(base.data, base.id, { title: "Local edit" }, t(5));
    const remote = updateIdea(base.data, base.id, { title: "Remote edit" }, t(3));
    expect(mergeDataFiles(local, remote).ideas[0].title).toBe("Local edit");
    expect(mergeDataFiles(remote, local).ideas[0].title).toBe("Local edit");
  });

  it("deletion wins over an edit on the other side", () => {
    const local = remove(base.data, base.id);
    const remote = updateIdea(base.data, base.id, { title: "Edited" }, t(9));
    const m = mergeDataFiles(local, remote);
    expect(m.ideas).toHaveLength(0);
    expect(m.deletedIds).toEqual([base.id]);
  });

  it("newer settings win", () => {
    const local = updateSettings(base.data, { cooldownDays: 3 }, t(1));
    const remote = updateSettings(base.data, { cooldownDays: 10 }, t(2));
    expect(mergeDataFiles(local, remote).settings.cooldownDays).toBe(10);
  });

  it("is idempotent", () => {
    const local = capture(base.data, { title: "X", category: "other" }, t(1)).data;
    const once = mergeDataFiles(local, base.data);
    expect(mergeDataFiles(once, once)).toEqual(once);
  });
});

describe("normalizeDataFile", () => {
  it("repairs missing fields and rejects garbage", () => {
    const d = normalizeDataFile({ ideas: [{ id: "1", title: "a" }, { nope: true }] });
    expect(d.ideas).toHaveLength(1);
    expect(d.settings.cooldownDays).toBe(7);
    expect(d.deletedIds).toEqual([]);
    expect(() => normalizeDataFile(null)).toThrow();
    expect(() => normalizeDataFile({ ideas: "x" })).toThrow();
  });
});
