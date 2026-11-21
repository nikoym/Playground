import { describe, expect, it } from "vitest";
import { SyncEngine, type SyncDeps, type SyncStatus } from "../src/storage/sync";
import { GitHubError, decodeBase64Utf8, encodeBase64Utf8 } from "../src/storage/github";
import { capture, updateIdea } from "../src/domain/transitions";
import { emptyDataFile, type DataFile } from "../src/domain/types";

const cfg = { owner: "me", repo: "data", branch: "main", path: "ideas.json", token: "t" };
const t = (m: number) => new Date(Date.UTC(2026, 10, 1, 10, m));

/** In-memory fake GitHub with sha checks. */
function fakeRemote(initial: DataFile | null) {
  let file = initial ? { data: initial, sha: "s0" } : null;
  let n = 0;
  return {
    get file() {
      return file;
    },
    /** Simulate another device writing. */
    externalWrite(data: DataFile) {
      file = { data, sha: `ext${++n}` };
    },
    getFile: async () => (file ? { data: structuredClone(file.data), sha: file.sha } : null),
    putFile: async (_c: unknown, data: DataFile, sha: string | null) => {
      if ((file && sha !== file.sha) || (!file && sha)) throw new GitHubError("conflict", "sha mismatch", 409);
      file = { data: structuredClone(data), sha: `s${++n}` };
      return file.sha;
    },
  };
}

function harness(local: DataFile, remote: ReturnType<typeof fakeRemote>, connected = true) {
  let data = local;
  let sha: string | null = null;
  let dirty = false;
  const statuses: SyncStatus[] = [];
  const deps: SyncDeps = {
    getConfig: () => (connected ? cfg : null),
    getData: () => data,
    setData: (d) => (data = d),
    onStatus: (s) => statuses.push(s),
    getFile: remote.getFile,
    putFile: remote.putFile,
    loadSha: () => sha,
    saveSha: (s) => (sha = s),
    isDirty: () => dirty,
    setDirty: (d) => (dirty = d),
    sleep: async () => {},
  };
  const engine = new SyncEngine(deps, 0);
  return {
    engine,
    get data() {
      return data;
    },
    set data(d: DataFile) {
      data = d;
      dirty = true;
    },
    get dirty() {
      return dirty;
    },
    statuses,
  };
}

describe("SyncEngine", () => {
  it("creates the remote file on first sync", async () => {
    const local = capture(emptyDataFile(), { title: "A", category: "game" }, t(0)).data;
    const remote = fakeRemote(null);
    const h = harness(local, remote);
    await h.engine.sync();
    expect(remote.file?.data.ideas.map((i) => i.title)).toEqual(["A"]);
    expect(h.dirty).toBe(false);
    expect(h.statuses.at(-1)?.kind).toBe("synced");
  });

  it("pulls remote ideas into an empty device without writing", async () => {
    const remoteData = capture(emptyDataFile(), { title: "From phone", category: "game" }, t(0)).data;
    const remote = fakeRemote(remoteData);
    const h = harness(emptyDataFile(), remote);
    await h.engine.sync();
    expect(h.data.ideas.map((i) => i.title)).toEqual(["From phone"]);
    expect(remote.file?.sha).toBe("s0");
  });

  it("merges when another device wrote in between (conflict retry)", async () => {
    const base = capture(emptyDataFile(), { title: "Shared", category: "game" }, t(0));
    const remote = fakeRemote(base.data);
    const h = harness(base.data, remote);
    await h.engine.sync();

    // Local edit, then another device writes before we push.
    h.data = capture(h.data, { title: "Desktop", category: "other" }, t(2)).data;
    remote.externalWrite(updateIdea(base.data, base.id, { title: "Shared (phone edit)" }, t(3)));
    await h.engine.sync();

    const titles = remote.file!.data.ideas.map((i) => i.title).sort();
    expect(titles).toEqual(["Desktop", "Shared (phone edit)"]);
    expect(h.data.ideas.map((i) => i.title).sort()).toEqual(titles);
    expect(h.dirty).toBe(false);
  });

  it("reports offline on network errors and keeps changes dirty", async () => {
    const remote = fakeRemote(null);
    remote.getFile = async () => {
      throw new GitHubError("network", "offline");
    };
    const h = harness(emptyDataFile(), remote);
    h.data = capture(h.data, { title: "X", category: "game" }, t(0)).data;
    await h.engine.sync();
    expect(h.statuses.at(-1)?.kind).toBe("offline");
    expect(h.dirty).toBe(true);
  });

  it("reports local mode without config", async () => {
    const h = harness(emptyDataFile(), fakeRemote(null), false);
    await h.engine.sync();
    expect(h.statuses.at(-1)).toEqual({ kind: "local" });
  });
});

describe("base64 utf-8", () => {
  it("round-trips non-ASCII text", () => {
    const s = "Γειά σου κόσμε — 🎮 ideas";
    expect(decodeBase64Utf8(encodeBase64Utf8(s))).toBe(s);
  });
});
