import { useState } from "react";
import { Link } from "react-router-dom";
import { daysUntil } from "../domain/time";
import { lastActivity, overdueCheckIns, slotOccupant, toggleMilestone } from "../domain/transitions";
import { CHECKIN_INTERVAL_DAYS, SLOTS, type Idea, type Slot } from "../domain/types";
import { CheckInSheet, EndSheet } from "../components/sheets";
import { Progress, relativeDays } from "../components/ui";
import { useStore } from "../state/store";

type Open = { kind: "checkin" | "ship" | "kill"; idea: Idea } | null;

export function FocusPage() {
  const { data } = useStore();
  const [open, setOpen] = useState<Open>(null);
  const now = new Date();
  const overdue = overdueCheckIns(data, now, CHECKIN_INTERVAL_DAYS);
  const candidates = data.ideas.filter((i) => i.status === "candidate").length;

  return (
    <>
      <div className="page-head">
        <h1>Focus</h1>
        <span className="muted small">One main thing. One fun thing.</span>
      </div>

      {overdue.map((i) => (
        <div className="banner warn row" key={i.id}>
          <span style={{ flex: 1 }}>
            No check-in on <strong>{i.title}</strong> for over {CHECKIN_INTERVAL_DAYS} days.
          </span>
          <button className="small" onClick={() => setOpen({ kind: "checkin", idea: i })}>Check in</button>
        </div>
      ))}

      <div className="stack">
        {SLOTS.map((s) => {
          const idea = slotOccupant(data, s.value);
          return idea ? (
            <SlotCard key={s.value} idea={idea} slot={s.value} onOpen={(kind) => setOpen({ kind, idea })} />
          ) : (
            <div className={`card empty slot-${s.value}`} key={s.value}>
              <div className="slot-label">{s.label} slot · {s.hint}</div>
              <p className="muted" style={{ margin: "8px 0 12px" }}>Empty. Pick your best-scored idea.</p>
              {candidates > 0 ? (
                <Link className="btn primary" to="/ranked">Choose from ranked ({candidates})</Link>
              ) : (
                <Link className="btn" to="/inbox">Go to inbox</Link>
              )}
            </div>
          );
        })}
      </div>

      {open?.kind === "checkin" && <CheckInSheet idea={open.idea} onClose={() => setOpen(null)} />}
      {(open?.kind === "ship" || open?.kind === "kill") && (
        <EndSheet idea={open.idea} mode={open.kind} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function SlotCard({ idea, slot, onOpen }: { idea: Idea; slot: Slot; onOpen: (k: "checkin" | "ship" | "kill") => void }) {
  const { run } = useStore();
  const now = new Date();
  const left = idea.dueDate ? daysUntil(idea.dueDate, now) : undefined;
  const last = lastActivity(idea);
  const lastCheck = idea.checkIns?.[0];
  const label = SLOTS.find((s) => s.value === slot)!;

  return (
    <article className={`card slot-${slot}`}>
      <div className="row">
        <span className="slot-label">{label.label}</span>
        <span className="spacer" />
        {left !== undefined && (
          <span className={`badge ${left < 0 ? "bad" : left <= 7 ? "warn" : ""}`}>
            {left < 0 ? `${-left} days overdue` : left === 0 ? "due today" : `${left} days left`}
          </span>
        )}
      </div>
      <h2 style={{ marginTop: 6 }}>
        <Link to={`/idea/${idea.id}`} style={{ color: "inherit", textDecoration: "none" }}>{idea.title}</Link>
      </h2>
      <div className="finish-line">🏁 {idea.finishLine}</div>
      <Progress idea={idea} />
      <ul className="checklist" style={{ marginTop: 8 }}>
        {(idea.milestones ?? []).map((m) => (
          <li key={m.id}>
            <input
              type="checkbox"
              id={`m-${m.id}`}
              checked={m.done}
              onChange={() => run(m.done ? "reopen milestone" : "complete milestone", (d, n) => toggleMilestone(d, idea.id, m.id, n))}
            />
            <label htmlFor={`m-${m.id}`} className={m.done ? "done" : ""} style={{ fontWeight: 400, margin: 0 }}>{m.title}</label>
          </li>
        ))}
      </ul>
      {lastCheck?.next && (
        <p className="small" style={{ marginTop: 8 }}>
          <span className="muted">Next step:</span> {lastCheck.next}
        </p>
      )}
      <p className="small muted">Last activity {last ? relativeDays(daysUntil(last, now)) : "never"}</p>
      <div className="row">
        <button className="primary" onClick={() => onOpen("checkin")}>Check in</button>
        <span className="spacer" />
        <button className="small" onClick={() => onOpen("ship")}>🚀 Ship</button>
        <button className="small danger" onClick={() => onOpen("kill")}>Kill</button>
      </div>
    </article>
  );
}
