import { mergeDataFiles, sameData } from "../domain/merge";
import type { DataFile } from "../domain/types";
import { GitHubError } from "./github";
import type { GitHubConfig } from "./localCache";

export type SyncStatus =
  | { kind: "local" } // no GitHub connection configured
  | { kind: "synced"; at: string }
  | { kind: "saving" }
  | { kind: "offline" }
  | { kind: "error"; message: string };

export interface SyncDeps {
  getConfig(): GitHubConfig | null;
  getData(): DataFile;
  /** Called when remote changes were merged in; must NOT trigger markChanged. */
  setData(data: DataFile): void;
  onStatus(status: SyncStatus): void;
  getFile(c: GitHubConfig): Promise<{ data: DataFile; sha: string } | null>;
  putFile(c: GitHubConfig, data: DataFile, sha: string | null, message: string): Promise<string>;
  loadSha(): string | null;
  saveSha(sha: string | null): void;
  isDirty(): boolean;
  setDirty(dirty: boolean): void;
  sleep?(ms: number): Promise<void>;
  now?(): Date;
}

const MAX_ATTEMPTS = 4;

export class SyncEngine {
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private message = "tracker: update";

  constructor(private deps: SyncDeps, private debounceMs = 2000) {}

  /** Record a local change and schedule a debounced push. */
  markChanged(action: string): void {
    this.deps.setDirty(true);
    this.message = `tracker: ${action}`;
    if (!this.deps.getConfig()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, this.debounceMs);
  }

  /** Pull, merge and push if needed. Calls are serialized. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.runOnce();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async runOnce(): Promise<void> {
    const d = this.deps;
    const config = d.getConfig();
    if (!config) {
      d.onStatus({ kind: "local" });
      return;
    }
    d.onStatus({ kind: "saving" });
    const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // 1. Pull and merge.
        const remote = await d.getFile(config);
        let sha: string | null = null;
        if (remote) {
          sha = remote.sha;
          const local = d.getData();
          const merged = mergeDataFiles(local, remote.data);
          if (!sameData(merged, local)) d.setData(merged);
          // (No await between reading `local` and here, so no local edit can slip in.)
          if (sameData(merged, remote.data)) {
            d.saveSha(sha);
            d.setDirty(false);
            d.onStatus({ kind: "synced", at: (d.now?.() ?? new Date()).toISOString() });
            return;
          } else {
            d.setDirty(true);
          }
        } else {
          d.setDirty(true); // file doesn't exist yet → create it
        }

        // 2. Push.
        const snapshot = d.getData();
        try {
          const newSha = await d.putFile(config, snapshot, sha, this.message);
          d.saveSha(newSha);
          if (d.getData() === snapshot) d.setDirty(false);
          else this.again = true;
          this.message = "tracker: update";
          d.onStatus({ kind: "synced", at: (d.now?.() ?? new Date()).toISOString() });
          return;
        } catch (e) {
          if (e instanceof GitHubError && e.kind === "conflict") {
            await sleep(400 * (attempt + 1));
            continue; // someone else wrote — pull & merge again
          }
          throw e;
        }
      }
      throw new GitHubError("conflict", "Kept conflicting with another device. Try again in a moment.");
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "network") d.onStatus({ kind: "offline" });
      else d.onStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }
}
