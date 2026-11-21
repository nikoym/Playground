import { Link } from "react-router-dom";
import { daysUntilScorable } from "../domain/cooldown";
import { categoryLabel } from "../components/ui";
import { useStore } from "../state/store";

export function InboxPage({ onCapture }: { onCapture: () => void }) {
  const { data } = useStore();
  const now = new Date();
  const inbox = data.ideas
    .filter((i) => i.status === "inbox")
    .map((idea) => ({ idea, left: daysUntilScorable(idea, data.settings, now) }))
    .sort((a, b) => a.left - b.left || b.idea.createdAt.localeCompare(a.idea.createdAt));
  const ready = inbox.filter((x) => x.left === 0).length;

  return (
    <>
      <div className="page-head">
        <h1>Inbox</h1>
        <span className="muted small">
          {inbox.length} idea{inbox.length === 1 ? "" : "s"} · {ready} ready to score
        </span>
      </div>
      <p className="muted small">
        New ideas cool down for {data.settings.cooldownDays} days before you can score them. If you're still excited after that, it's probably real.
      </p>
      {inbox.length === 0 ? (
        <div className="empty-state">
          <p>Inbox is empty.</p>
          <button className="primary" onClick={onCapture}>Capture an idea</button>
        </div>
      ) : (
        <div className="list">
          {inbox.map(({ idea, left }) => (
            <Link className="item" to={`/idea/${idea.id}`} key={idea.id}>
              <div className="body">
                <div className="title">{idea.title}</div>
                <div className="sub small muted">
                  {categoryLabel(idea.category)}
                  {idea.cooldownSkipped && " · cooldown skipped"}
                </div>
              </div>
              {left === 0 ? (
                <span className="badge accent">Score now →</span>
              ) : (
                <span className="badge">🧊 {left}d</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
