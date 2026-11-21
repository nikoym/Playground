import { useRef, useState, type FormEvent } from "react";
import { updateSettings } from "../domain/transitions";
import { CRITERIA, type Criterion } from "../domain/types";
import { getFile, GitHubError } from "../storage/github";
import type { GitHubConfig } from "../storage/localCache";
import { useStore } from "../state/store";

export function SettingsPage() {
  return (
    <>
      <div className="page-head"><h1>Settings</h1></div>
      <div className="stack">
        <GitHubSection />
        <RulesSection />
        <BackupSection />
        <p className="small muted">
          Idea Tracker v0.1. All data lives in this browser and, if connected, in your own GitHub repo. Nothing else is sent anywhere.
        </p>
      </div>
    </>
  );
}

function GitHubSection() {
  const { config, setConfig, status, syncNow, notify } = useStore();
  const [form, setForm] = useState<GitHubConfig>(
    config ?? { owner: "", repo: "", branch: "main", path: "ideas.json", token: "" },
  );
  const [testing, setTesting] = useState(false);
  const set = (k: keyof GitHubConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value.trim() });
  const valid = form.owner && form.repo && form.branch && form.path && form.token;

  const test = async () => {
    setTesting(true);
    try {
      const r = await getFile(form);
      notify(r ? `Connected — found ${r.data.ideas.length} ideas in ${form.path}.` : `Connected — ${form.path} will be created on first sync.`);
      return true;
    } catch (e) {
      notify(e instanceof GitHubError ? e.message : String(e), "error");
      return false;
    } finally {
      setTesting(false);
    }
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    if (await test()) setConfig(form);
  };

  return (
    <section className="card">
      <h2>GitHub sync</h2>
      {config ? (
        <>
          <p>
            Connected to <strong>{config.owner}/{config.repo}</strong> ({config.branch}:{config.path}).<br />
            <span className="small muted">
              Status: {status.kind}
              {status.kind === "error" && ` — ${status.message}`}
              {status.kind === "synced" && ` at ${new Date(status.at).toLocaleTimeString()}`}
            </span>
          </p>
          <div className="row">
            <button onClick={() => void syncNow()}>Sync now</button>
            <button className="danger" onClick={() => { if (window.confirm("Disconnect and forget the token on this device? Local data stays.")) setConfig(null); }}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={connect}>
          <p className="small muted">
            Store your ideas as <code>ideas.json</code> in a <strong>private</strong> repo, so they sync between phone and desktop.
            Use a <em>fine-grained</em> token limited to that one repo with <em>Contents: Read and write</em>. The token is stored only on this device.
          </p>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="gh-owner">Owner</label>
              <input id="gh-owner" type="text" autoCapitalize="off" autoCorrect="off" value={form.owner} onChange={set("owner")} placeholder="your-username" />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="gh-repo">Repo</label>
              <input id="gh-repo" type="text" autoCapitalize="off" autoCorrect="off" value={form.repo} onChange={set("repo")} placeholder="my-ideas-data" />
            </div>
          </div>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="gh-branch">Branch</label>
              <input id="gh-branch" type="text" autoCapitalize="off" value={form.branch} onChange={set("branch")} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="gh-path">File path</label>
              <input id="gh-path" type="text" autoCapitalize="off" value={form.path} onChange={set("path")} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="gh-token">Token</label>
            <input id="gh-token" type="password" autoComplete="off" value={form.token} onChange={set("token")} placeholder="github_pat_…" />
          </div>
          <div className="row">
            <button type="submit" className="primary" disabled={!valid || testing}>{testing ? "Checking…" : "Connect"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

function RulesSection() {
  const { data, run, notify } = useStore();
  const s = data.settings;
  const [cooldown, setCooldown] = useState(String(s.cooldownDays));
  const [weights, setWeights] = useState<Record<Criterion, string>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, String(s.weights[c.key])])) as Record<Criterion, string>,
  );

  const save = (e: FormEvent) => {
    e.preventDefault();
    const w = Object.fromEntries(CRITERIA.map((c) => [c.key, Number(weights[c.key])])) as Record<Criterion, number>;
    if (run("update settings", (d, n) => updateSettings(d, { cooldownDays: Number(cooldown), weights: w }, n))) notify("Settings saved.");
  };

  return (
    <section className="card" id="weights">
      <h2>Rules & weights</h2>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="set-cool">Cooldown days <span className="hint">— wait before a new idea can be scored</span></label>
          <input id="set-cool" type="number" min={0} max={60} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </div>
        <p className="small muted">How much each criterion counts (0 = ignore, 5 = most important). Effort is inverted automatically: less effort scores higher.</p>
        <div className="row" style={{ alignItems: "flex-start" }}>
          {CRITERIA.map((c) => (
            <div className="field" key={c.key} style={{ width: 110 }}>
              <label htmlFor={`w-${c.key}`}>{c.label}</label>
              <input id={`w-${c.key}`} type="number" min={0} max={5} step={0.5} value={weights[c.key]} onChange={(e) => setWeights({ ...weights, [c.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="submit" className="primary">Save rules</button>
      </form>
    </section>
  );
}

function BackupSection() {
  const { data, importFile } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ideas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section className="card">
      <h2>Backup</h2>
      <p className="small muted">Export everything as JSON, or import a file. Imports are merged with what's here; nothing gets overwritten except older versions of the same idea.</p>
      <div className="row">
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileRef.current?.click()}>Import JSON…</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) importFile(await f.text());
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
