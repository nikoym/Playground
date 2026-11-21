import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { computeScore } from "../domain/scoring";
import { addDays, toDateInput } from "../domain/time";
import { commit, slotOccupant } from "../domain/transitions";
import { DEFAULT_DUE_WEEKS, MAX_DUE_WEEKS, SLOTS, type Slot } from "../domain/types";
import { useIdea, useStore } from "../state/store";

export function CommitPage() {
  const { id } = useParams();
  const idea = useIdea(id);
  const { data, run, notify } = useStore();
  const navigate = useNavigate();
  const now = new Date();

  const freeSlots = SLOTS.filter((s) => !slotOccupant(data, s.value));
  const suggested: Slot | undefined =
    idea?.scores && freeSlots.length > 1
      ? idea.scores.passion > Math.max(idea.scores.money, idea.scores.audience) ? "fun" : "main"
      : freeSlots[0]?.value;

  const [slot, setSlot] = useState<Slot | undefined>(suggested);
  const [finishLine, setFinishLine] = useState("");
  const [dueDate, setDueDate] = useState(toDateInput(addDays(now, DEFAULT_DUE_WEEKS * 7)));
  const [milestones, setMilestones] = useState<string[]>(["", "", ""]);

  if (!idea) return <div className="empty-state">Idea not found. <Link to="/ranked">Back</Link></div>;
  if (idea.status !== "candidate")
    return <div className="empty-state">Only scored candidates can be committed. <Link to={`/idea/${idea.id}`}>Back</Link></div>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!slot) return notify("Pick a slot.", "error");
    if (run(`commit ${idea.title}`, (d, n) => commit(d, idea.id, { slot, finishLine, dueDate, milestones }, n))) {
      notify("Committed. Now go build it.");
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <div className="page-head">
        <button className="ghost small" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <h1>Commit to “{idea.title}”</h1>
      {idea.scores && <p className="muted">Score {computeScore(idea.scores, data.settings.weights)}/100</p>}

      <form className="card" onSubmit={submit}>
        <div className="field">
          <label id="slot-label">Slot</label>
          <div className="chips" role="group" aria-labelledby="slot-label">
            {SLOTS.map((s) => {
              const occ = slotOccupant(data, s.value);
              return (
                <button type="button" key={s.value} className="chip" aria-pressed={slot === s.value} disabled={!!occ} onClick={() => setSlot(s.value)}>
                  {s.label} · {occ ? `taken by ${occ.title}` : s.hint}
                </button>
              );
            })}
          </div>
          {freeSlots.length === 0 && <p className="small" style={{ color: "var(--bad)", marginTop: 8 }}>Both slots are full. Ship or kill a project first.</p>}
        </div>

        <div className="field">
          <label htmlFor="c-finish">
            Finish line <span className="hint">— a concrete, visible result. Not “make a game”, but “playable demo on itch.io”.</span>
          </label>
          <input id="c-finish" type="text" value={finishLine} onChange={(e) => setFinishLine(e.target.value)} placeholder="e.g. Landing page live + 10 signups" />
        </div>

        <div className="field">
          <label htmlFor="c-due">Due date <span className="hint">— max {MAX_DUE_WEEKS} weeks out</span></label>
          <input
            id="c-due"
            type="date"
            value={dueDate}
            min={toDateInput(addDays(now, 1))}
            max={toDateInput(addDays(now, MAX_DUE_WEEKS * 7))}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Milestones <span className="hint">— 3–5 steps that get you to the finish line</span></label>
          <div className="stack" style={{ gap: 8 }}>
            {milestones.map((m, i) => (
              <div className="row" key={i}>
                <input
                  type="text"
                  aria-label={`Milestone ${i + 1}`}
                  value={m}
                  placeholder={["Core prototype works", "First version shared with 3 people", "Published"][i] ?? "Another step"}
                  onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? e.target.value : x)))}
                  style={{ flex: 1 }}
                />
                {milestones.length > 1 && (
                  <button type="button" className="ghost small" aria-label={`Remove milestone ${i + 1}`} onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
            ))}
            {milestones.length < 5 && (
              <button type="button" className="small" style={{ alignSelf: "flex-start" }} onClick={() => setMilestones([...milestones, ""])}>+ Milestone</button>
            )}
          </div>
        </div>

        <button type="submit" className="primary" disabled={!slot || freeSlots.length === 0}>Commit</button>
      </form>
    </>
  );
}
