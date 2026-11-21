import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeDataFile, mergeDataFiles } from "../domain/merge";
import { RuleError } from "../domain/transitions";
import type { DataFile } from "../domain/types";
import { getFile, putFile } from "../storage/github";
import * as cache from "../storage/localCache";
import { SyncEngine, type SyncStatus } from "../storage/sync";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface StoreValue {
  data: DataFile;
  /** Apply a domain transition. Returns true on success; rule errors become toasts. */
  run: (action: string, fn: (data: DataFile, now: Date) => DataFile) => boolean;
  status: SyncStatus;
  config: cache.GitHubConfig | null;
  setConfig: (c: cache.GitHubConfig | null) => void;
  syncNow: () => Promise<void>;
  /** Merge ideas from an exported JSON file into the current data. */
  importFile: (json: string) => boolean;
  toast: Toast | null;
  notify: (message: string, tone?: Toast["tone"]) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<DataFile>(() => cache.loadData());
  const dataRef = useRef(data);
  const [config, setConfigState] = useState(() => cache.loadConfig());
  const configRef = useRef(config);
  const [status, setStatus] = useState<SyncStatus>(() => (config ? { kind: "saving" } : { kind: "local" }));
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = setTimeout(() => setToast(null), tone === "error" ? 5000 : 2500);
  }, []);

  const commitData = useCallback((next: DataFile) => {
    dataRef.current = next;
    cache.saveData(next); // local first — never lose data
    setDataState(next);
  }, []);

  const engine = useMemo(
    () =>
      new SyncEngine({
        getConfig: () => configRef.current,
        getData: () => dataRef.current,
        setData: commitData,
        onStatus: setStatus,
        getFile,
        putFile,
        loadSha: cache.loadSha,
        saveSha: cache.saveSha,
        isDirty: cache.isDirty,
        setDirty: cache.setDirty,
      }),
    [commitData],
  );

  // Sync on start, when the tab regains focus, and when coming back online.
  useEffect(() => {
    void engine.sync();
    const onVisible = () => document.visibilityState === "visible" && void engine.sync();
    const onOnline = () => void engine.sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      engine.dispose();
    };
  }, [engine]);

  const run = useCallback<StoreValue["run"]>(
    (action, fn) => {
      try {
        const next = fn(dataRef.current, new Date());
        if (next === dataRef.current) return true;
        commitData(next);
        engine.markChanged(action);
        return true;
      } catch (e) {
        if (e instanceof RuleError) notify(e.message, "error");
        else {
          console.error(e);
          notify("Something went wrong — see console.", "error");
        }
        return false;
      }
    },
    [commitData, engine, notify],
  );

  const setConfig = useCallback(
    (c: cache.GitHubConfig | null) => {
      configRef.current = c;
      cache.saveConfig(c);
      cache.saveSha(null);
      setConfigState(c);
      if (c) {
        cache.setDirty(true); // first sync merges local + remote
        void engine.sync();
      } else setStatus({ kind: "local" });
    },
    [engine],
  );

  const importFile = useCallback<StoreValue["importFile"]>(
    (json) => {
      try {
        const incoming = normalizeDataFile(JSON.parse(json));
        commitData(mergeDataFiles(dataRef.current, incoming));
        engine.markChanged("import");
        notify(`Imported ${incoming.ideas.length} ideas.`);
        return true;
      } catch (e) {
        notify(`Import failed: ${e instanceof Error ? e.message : e}`, "error");
        return false;
      }
    },
    [commitData, engine, notify],
  );

  const value: StoreValue = {
    data,
    run,
    status,
    config,
    setConfig,
    syncNow: () => engine.sync(),
    importFile,
    toast,
    notify,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

export function useIdea(id: string | undefined) {
  const { data } = useStore();
  return data.ideas.find((i) => i.id === id);
}
