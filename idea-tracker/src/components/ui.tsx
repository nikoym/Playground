import { useEffect, useId, useRef, type ReactNode } from "react";
import { CATEGORIES, CRITERIA, type Category, type Idea, type Scores } from "../domain/types";
import { useStore } from "../state/store";
import type { SyncStatus } from "../storage/sync";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="sheet-head">
          <h2 id={titleId} style={{ margin: 0 }}>{title}</h2>
          <button className="ghost small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CategoryPicker({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="chips" role="group" aria-label="Category">
      {CATEGORIES.map((c) => (
        <button type="button" key={c.value} className="chip" aria-pressed={value === c.value} onClick={() => onChange(c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

export function ScoreInput({ value, onChange }: { value: Partial<Scores>; onChange: (s: Partial<Scores>) => void }) {
  return (
    <div>
      {CRITERIA.map((c) => (
        <div className="field" key={c.key}>
          <label id={`lbl-${c.key}`}>
            {c.label} <span className="hint">— {c.question}</span>
          </label>
          <div className="scale" role="group" aria-labelledby={`lbl-${c.key}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={value[c.key] === n}
                onClick={() => onChange({ ...value, [c.key]: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({ scores }: { scores: Scores }) {
  return (
    <div className="minibars" aria-hidden="true">
      {CRITERIA.map((c) => (
        <div className="minibar" key={c.key} title={`${c.label}: ${scores[c.key]}`}>
          <span>{c.label.slice(0, 4)}</span>
          <div className="track">
            <div className="fill" style={{ width: `${scores[c.key] * 20}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Progress({ idea }: { idea: Idea }) {
  const ms = idea.milestones ?? [];
  const done = ms.filter((m) => m.done).length;
  const pct = ms.length ? Math.round((100 * done) / ms.length) : 0;
  return (
    <>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Milestone progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="small muted">
        {done}/{ms.length} milestones
      </div>
    </>
  );
}

const STATUS_TEXT: Record<SyncStatus["kind"], string> = {
  local: "Local only",
  synced: "Synced",
  saving: "Saving…",
  offline: "Offline",
  error: "Sync error",
};

export function SyncBadge() {
  const { status, syncNow } = useStore();
  const title = status.kind === "error" ? status.message : status.kind === "synced" ? `Last sync ${new Date(status.at).toLocaleTimeString()}` : STATUS_TEXT[status.kind];
  return (
    <button className={`sync ${status.kind}`} title={title} onClick={() => void syncNow()} aria-label={`${STATUS_TEXT[status.kind]}. Sync now`}>
      <span className="dot" /> {STATUS_TEXT[status.kind]}
    </button>
  );
}

export function ToastView() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
      {toast.message}
    </div>
  );
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Only allow http(s) links — data can come from imported JSON. */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
