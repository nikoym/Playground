import { useNavigate } from "react-router-dom";
import { revisit } from "../domain/transitions";
import type { Idea, Status } from "../domain/types";
import { categoryLabel, safeUrl } from "../components/ui";
import { useStore } from "../state/store";

const GROUPS: { status: Status; title: string; emoji: string }[] = [
  { status: "shipped", title: "Shipped", emoji: "🚀" },
  { status: "killed", title: "Killed", emoji: "🪦" },
  { status: "archived", title: "Archived (never started)", emoji: "📦" },
];

export function ArchivePage() {
  const { data } = useStore();
  const ended = data.ideas.filter((i) => GROUPS.some((g) => g.status === i.status));
  const shipped = ended.filter((i) => i.status === "shipped").length;
  const killed = ended.filter((i) => i.status === "killed").length;

  return (
    <>
      <div className="page-head">
        <h1>Archive</h1>
        <span className="muted small">🚀 {shipped} shipped · 🪦 {killed} killed</span>
      </div>
      {ended.length === 0 && <div className="empty-state">Nothing here yet. Finished projects and their lessons will show up here.</div>}
      {GROUPS.map((g) => {
        const items = ended
          .filter((i) => i.status === g.status)
          .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));
        if (!items.length) return null;
        return (
          <section key={g.status} style={{ marginBottom: 20 }}>
            <h2>{g.emoji} {g.title}</h2>
            <div className="stack">
              {items.map((i) => <EndedCard idea={i} key={i.id} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function EndedCard({ idea }: { idea: Idea }) {
  const { run, notify } = useStore();
  const navigate = useNavigate();
  const pm = idea.postMortem;
  const doRevisit = () => {
    let newId = "";
    const ok = run("revisit idea", (d, now) => {
      const r = revisit(d, idea.id, now);
      newId = r.id;
      return r.data;
    });
    if (ok) {
      notify("Copied back to the inbox (cooldown applies).");
      navigate(`/idea/${newId}`);
    }
  };
  const days =
    idea.startedAt && idea.endedAt
      ? Math.max(1, Math.round((new Date(idea.endedAt).getTime() - new Date(idea.startedAt).getTime()) / 86400000))
      : undefined;

  return (
    <details className="card">
      <summary>
        <div className="row">
          <strong style={{ flex: 1 }}>{idea.title}</strong>
          <span className="badge">{categoryLabel(idea.category)}</span>
        </div>
        <div className="small muted">
          {idea.endedAt && new Date(idea.endedAt).toLocaleDateString()}
          {days && ` · ${days} days`}
          {idea.finishLine && ` · 🏁 ${idea.finishLine}`}
        </div>
      </summary>
      {safeUrl(idea.shipUrl) && <p style={{ marginTop: 8 }}><a href={safeUrl(idea.shipUrl)} target="_blank" rel="noreferrer noopener">{idea.shipUrl}</a></p>}
      {pm && (
        <dl className="pm">
          {pm.reason && (<><dt>Why stopped</dt><dd>{pm.reason}</dd></>)}
          {pm.whatWorked && (<><dt>What worked</dt><dd>{pm.whatWorked}</dd></>)}
          {pm.whatDidnt && (<><dt>What didn't</dt><dd>{pm.whatDidnt}</dd></>)}
          {pm.learned && (<><dt>Learned</dt><dd>{pm.learned}</dd></>)}
        </dl>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="small" onClick={() => navigate(`/idea/${idea.id}`)}>Details</button>
        <button className="small" onClick={doRevisit}>Revisit</button>
      </div>
    </details>
  );
}
