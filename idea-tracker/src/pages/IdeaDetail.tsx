import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { daysUntilScorable, isScorable } from "../domain/cooldown";
import { buildReviewPrompt } from "../domain/prompt";
import { computeScore, isValidScores } from "../domain/scoring";
import { daysUntil } from "../domain/time";
import {
  addMilestone,
  archive,
  remove,
  removeMilestone,
  revisit,
  score,
  toggleMilestone,
  updateIdea,
} from "../domain/transitions";
import type { Category, Idea, Scores } from "../domain/types";
import { CheckInSheet, EndSheet, SkipCooldownSheet } from "../components/sheets";
import { CategoryPicker, categoryLabel, Progress, relativeDays, safeUrl, ScoreInput } from "../components/ui";
import { useIdea, useStore } from "../state/store";

const STATUS_LABEL: Record<Idea["status"], string> = {
  inbox: "Inbox",
  candidate: "Candidate",
  active: "Active",
  shipped: "Shipped",
  killed: "Killed",
  archived: "Archived",
};

type Open = "skip" | "checkin" | "ship" | "kill" | null;

export function IdeaDetailPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  const { data, run, notify } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open>(null);

  if (!idea) {
    return (
      <div className="empty-state">
        <p>This idea doesn't exist (maybe it was deleted on another device).</p>
        <Link className="btn" to="/">Back to Focus</Link>
      </div>
    );
  }

  const now = new Date();
  const left = idea.status === "inbox" ? daysUntilScorable(idea, data.settings, now) : 0;
  const scorable = isScorable(idea, data.settings, now);
  const ended = idea.status === "shipped" || idea.status === "killed" || idea.status === "archived";

  const doDelete = () => {
    if (!window.confirm(`Delete “${idea.title}” permanently?`)) return;
    if (run("delete idea", (d) => remove(d, idea.id))) {
      notify("Deleted.");
      navigate(-1);
    }
  };
  const doRevisit = () => {
    let newId = "";
    if (run("revisit idea", (d, n) => { const r = revisit(d, idea.id, n); newId = r.id; return r.data; })) {
      notify("Copied back to the inbox.");
      navigate(`/idea/${newId}`, { replace: true });
    }
  };

  return (
    <>
      <div className="page-head">
        <button className="ghost small" onClick={() => navigate(-1)}>← Back</button>
        <div className="row">
          <span className={`badge ${idea.status === "active" ? "accent" : idea.status === "shipped" ? "good" : idea.status === "killed" ? "bad" : ""}`}>
            {STATUS_LABEL[idea.status]}{idea.slot && idea.status === "active" ? ` · ${idea.slot}` : ""}
          </span>
          {idea.cooldownSkipped && <span className="badge warn" title="Cooldown was skipped">⚡ cooldown skipped</span>}
        </div>
      </div>

      <div className="stack">
        <EditBasics idea={idea} />

        {idea.status === "inbox" && left > 0 && (
          <section className="card">
            <h2>🧊 Cooling down</h2>
            <p>You can score this {relativeDays(left)}. Still excited by then? Good sign.</p>
            <button className="small" onClick={() => setOpen("skip")}>Skip cooldown…</button>
          </section>
        )}

        {scorable && <ScoreSection idea={idea} />}

        {(idea.status === "inbox" || idea.status === "candidate") && <AiSection idea={idea} />}

        {idea.status === "candidate" && (
          <Link className="btn primary" to={`/idea/${idea.id}/commit`}>Commit to a slot →</Link>
        )}

        {idea.status === "active" && <ActiveSection idea={idea} onOpen={setOpen} />}

        {ended && <EndedSection idea={idea} />}

        {(ended || idea.status === "active") && idea.aiReview && (
          <section className="card">
            <h2>AI review</h2>
            <div className="pre small">{idea.aiReview}</div>
          </section>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          {(idea.status === "inbox" || idea.status === "candidate") && (
            <button className="small" onClick={() => run("archive idea", (d, n) => archive(d, idea.id, n)) && notify("Archived.")}>
              Archive
            </button>
          )}
          {ended && <button className="small" onClick={doRevisit}>Revisit</button>}
          <span className="spacer" />
          {idea.status !== "active" && <button className="small danger" onClick={doDelete}>Delete</button>}
        </div>
        <p className="small muted">Captured {new Date(idea.createdAt).toLocaleDateString()}</p>
      </div>

      {open === "skip" && <SkipCooldownSheet idea={idea} onClose={() => setOpen(null)} />}
      {open === "checkin" && <CheckInSheet idea={idea} onClose={() => setOpen(null)} />}
      {(open === "ship" || open === "kill") && <EndSheet idea={idea} mode={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function EditBasics({ idea }: { idea: Idea }) {
  const { run, notify } = useStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note ?? "");
  const [category, setCategory] = useState<Category>(idea.category);

  useEffect(() => {
    if (!editing) {
      setTitle(idea.title);
      setNote(idea.note ?? "");
      setCategory(idea.category);
    }
  }, [idea, editing]);

  if (!editing) {
    return (
      <section className="card">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <h1 style={{ flex: 1 }}>{idea.title}</h1>
          <button className="small" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <span className="badge">{categoryLabel(idea.category)}</span>
        {idea.note ? <p className="pre" style={{ marginTop: 10 }}>{idea.note}</p> : <p className="muted small" style={{ marginTop: 10 }}>No notes.</p>}
      </section>
    );
  }
  const save = () => {
    if (run("edit idea", (d, n) => updateIdea(d, idea.id, { title, note: note.trim() || undefined, category }, n))) {
      setEditing(false);
      notify("Saved.");
    }
  };
  return (
    <section className="card">
      <div className="field">
        <label htmlFor="ed-title">Title</label>
        <input id="ed-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Category</label>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>
      <div className="field">
        <label htmlFor="ed-note">Notes</label>
        <textarea id="ed-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="row">
        <button className="primary" onClick={save}>Save</button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </section>
  );
}

function ScoreSection({ idea }: { idea: Idea }) {
  const { data, run, notify } = useStore();
  const [draft, setDraft] = useState<Partial<Scores>>(idea.scores ?? {});
  const valid = isValidScores(draft);
  const preview = valid ? computeScore(draft, data.settings.weights) : undefined;
  const changed = JSON.stringify(draft) !== JSON.stringify(idea.scores ?? {});

  const save = () => {
    if (!valid) return;
    if (run("score idea", (d, n) => score(d, idea.id, draft, n)))
      notify(idea.status === "inbox" ? "Scored — it's now on the Ranked list." : "Scores updated.");
  };

  return (
    <section className="card">
      <div className="row">
        <h2 style={{ flex: 1 }}>{idea.scores ? "Scores" : "Score this idea"}</h2>
        {preview !== undefined && <div className="score-pill" aria-label={`Score ${preview}`}>{preview}</div>}
      </div>
      <ScoreInput value={draft} onChange={setDraft} />
      <button className="primary" disabled={!valid || !changed} onClick={save}>
        {idea.scores ? "Update scores" : "Save scores"}
      </button>
      {!valid && <span className="small muted" style={{ marginLeft: 8 }}>Rate all five to save.</span>}
    </section>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function AiSection({ idea }: { idea: Idea }) {
  const { run, notify } = useStore();
  const [review, setReview] = useState(idea.aiReview ?? "");
  useEffect(() => {
    setReview(idea.aiReview ?? "");
  }, [idea.aiReview]);

  const copy = async () => {
    const ok = await copyText(buildReviewPrompt(idea));
    notify(ok ? "Prompt copied — paste it into Claude or ChatGPT." : "Couldn't copy. Your browser blocked the clipboard.", ok ? "info" : "error");
  };
  return (
    <section className="card">
      <h2>🤖 AI second opinion</h2>
      <p className="small muted">
        Copy a ready-made critique prompt{idea.scores ? " (includes your scores)" : ""}, paste it into an AI chat, then paste the answer below.
      </p>
      <button onClick={copy}>📋 Copy review prompt</button>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="ai-review">AI's answer</label>
        <textarea id="ai-review" value={review} onChange={(e) => setReview(e.target.value)} placeholder="Paste the response here…" style={{ minHeight: 120 }} />
      </div>
      <button
        className="small"
        disabled={review === (idea.aiReview ?? "")}
        onClick={() => run("save AI review", (d, n) => updateIdea(d, idea.id, { aiReview: review.trim() || undefined }, n)) && notify("Review saved.")}
      >
        Save review
      </button>
    </section>
  );
}

function ActiveSection({ idea, onOpen }: { idea: Idea; onOpen: (o: Open) => void }) {
  const { run } = useStore();
  const [newMs, setNewMs] = useState("");
  const now = new Date();
  const left = idea.dueDate ? daysUntil(idea.dueDate, now) : undefined;

  return (
    <>
      <section className={`card slot-${idea.slot}`}>
        <div className="slot-label">{idea.slot} slot</div>
        <div className="finish-line">🏁 {idea.finishLine}</div>
        <div className="small muted">
          Due {idea.dueDate} {left !== undefined && `(${left < 0 ? `${-left} days overdue` : `${left} days left`})`}
        </div>
        <Progress idea={idea} />
        <ul className="checklist">
          {(idea.milestones ?? []).map((m) => (
            <li key={m.id}>
              <input type="checkbox" id={`dm-${m.id}`} checked={m.done} onChange={() => run("toggle milestone", (d, n) => toggleMilestone(d, idea.id, m.id, n))} />
              <label htmlFor={`dm-${m.id}`} className={m.done ? "done" : ""} style={{ flex: 1, fontWeight: 400, margin: 0 }}>{m.title}</label>
              <button className="ghost small" aria-label={`Remove milestone ${m.title}`} onClick={() => run("remove milestone", (d, n) => removeMilestone(d, idea.id, m.id, n))}>✕</button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (run("add milestone", (d, n) => addMilestone(d, idea.id, newMs, n))) setNewMs("");
          }}
        >
          <input type="text" aria-label="New milestone" placeholder="Add milestone" value={newMs} onChange={(e) => setNewMs(e.target.value)} style={{ flex: 1 }} />
          <button className="small" type="submit" disabled={!newMs.trim()}>Add</button>
        </form>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={() => onOpen("checkin")}>Check in</button>
          <span className="spacer" />
          <button className="small" onClick={() => onOpen("ship")}>🚀 Ship</button>
          <button className="small danger" onClick={() => onOpen("kill")}>Kill</button>
        </div>
      </section>
      <CheckInHistory idea={idea} />
    </>
  );
}

function CheckInHistory({ idea }: { idea: Idea }) {
  const items = idea.checkIns ?? [];
  if (!items.length) return null;
  return (
    <section className="card">
      <h2>Check-ins</h2>
      <div className="stack">
        {items.map((c) => (
          <div key={c.id}>
            <div className="small muted">
              {new Date(c.date).toLocaleDateString()} {c.mood && ["😩", "😕", "😐", "🙂", "🔥"][c.mood - 1]}
            </div>
            {c.progress && <div className="pre">✅ {c.progress}</div>}
            {c.next && <div className="pre muted">→ {c.next}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function EndedSection({ idea }: { idea: Idea }) {
  const pm = idea.postMortem;
  const url = safeUrl(idea.shipUrl);
  return (
    <>
      {(idea.finishLine || pm || url) && (
        <section className="card">
          {idea.finishLine && <div className="finish-line">🏁 {idea.finishLine}</div>}
          {url && <p><a href={url} target="_blank" rel="noreferrer noopener">{idea.shipUrl}</a></p>}
          {pm && (
            <dl className="pm">
              {pm.reason && (<><dt>Why stopped</dt><dd>{pm.reason}</dd></>)}
              {pm.whatWorked && (<><dt>What worked</dt><dd>{pm.whatWorked}</dd></>)}
              {pm.whatDidnt && (<><dt>What didn't</dt><dd>{pm.whatDidnt}</dd></>)}
              {pm.learned && (<><dt>Learned</dt><dd>{pm.learned}</dd></>)}
            </dl>
          )}
        </section>
      )}
      <CheckInHistory idea={idea} />
    </>
  );
}
