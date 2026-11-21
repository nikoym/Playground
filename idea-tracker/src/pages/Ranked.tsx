import { Link } from "react-router-dom";
import { rankCandidates } from "../domain/scoring";
import { slotOccupant } from "../domain/transitions";
import { categoryLabel, MiniBars } from "../components/ui";
import { useStore } from "../state/store";

export function RankedPage() {
  const { data } = useStore();
  const ranked = rankCandidates(data.ideas, data.settings.weights);
  const free = !slotOccupant(data, "main") || !slotOccupant(data, "fun");

  return (
    <>
      <div className="page-head">
        <h1>Ranked</h1>
        <Link className="small" to="/settings">Adjust weights</Link>
      </div>
      {!free && ranked.length > 0 && (
        <div className="banner warn small">Both slots are full. Ship or kill a project before committing a new one.</div>
      )}
      {ranked.length === 0 ? (
        <div className="empty-state">
          <p>No scored ideas yet.</p>
          <Link className="btn" to="/inbox">Score ideas from the inbox</Link>
        </div>
      ) : (
        <div className="list">
          {ranked.map(({ idea, score }, idx) => (
            <div className="item" key={idea.id}>
              <span className="rank">{idx + 1}</span>
              <div className="score-pill" aria-label={`Score ${score}`}>{score}</div>
              <Link className="body" to={`/idea/${idea.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <div className="title">{idea.title}</div>
                <div className="sub small muted">{categoryLabel(idea.category)}{idea.aiReview ? " · AI reviewed" : ""}</div>
                <MiniBars scores={idea.scores!} />
              </Link>
              {free && (
                <Link className="btn small primary" to={`/idea/${idea.id}/commit`}>Commit</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
