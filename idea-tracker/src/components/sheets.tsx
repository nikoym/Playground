import { useState, type FormEvent } from "react";
import { addCheckIn, capture, kill, ship, skipCooldown } from "../domain/transitions";
import type { Category, CheckIn, Idea } from "../domain/types";
import { useStore } from "../state/store";
import { CategoryPicker, Sheet } from "./ui";

export function CaptureSheet({ onClose }: { onClose: () => void }) {
  const { run, notify } = useStore();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category>("app-business");
  const [another, setAnother] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = run("capture idea", (d, now) => capture(d, { title, note, category }, now).data);
    if (!ok) return;
    notify("Captured. It can be scored after the cooldown.");
    if (another) {
      setTitle("");
      setNote("");
    } else onClose();
  };

  return (
    <Sheet title="Capture an idea" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="cap-title">Idea</label>
          <input id="cap-title" type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI music video generator for indie bands" enterKeyHint="done" />
        </div>
        <div className="field">
          <label>Category</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div className="field">
          <label htmlFor="cap-note">Note <span className="hint">(optional)</span></label>
          <textarea id="cap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's interesting, links, first thoughts…" />
        </div>
        <div className="sheet-actions">
          <label className="row" style={{ fontWeight: 400, marginRight: "auto" }}>
            <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} /> Add another
          </label>
          <button type="submit" className="primary" disabled={!title.trim()}>Save</button>
        </div>
      </form>
    </Sheet>
  );
}

export function CheckInSheet({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { run, notify } = useStore();
  const [progress, setProgress] = useState("");
  const [next, setNext] = useState("");
  const [mood, setMood] = useState<CheckIn["mood"]>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (run(`check in on ${idea.title}`, (d, now) => addCheckIn(d, idea.id, { progress, next, mood }, now))) {
      notify("Check-in saved. Keep going!");
      onClose();
    }
  };

  return (
    <Sheet title={`Check in: ${idea.title}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="ci-progress">What did you get done?</label>
          <textarea id="ci-progress" autoFocus value={progress} onChange={(e) => setProgress(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ci-next">What's the next concrete step?</label>
          <textarea id="ci-next" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label id="ci-mood">Motivation <span className="hint">(optional)</span></label>
          <div className="scale" role="group" aria-labelledby="ci-mood">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button type="button" key={n} aria-pressed={mood === n} onClick={() => setMood(mood === n ? undefined : n)}>
                {["😩", "😕", "😐", "🙂", "🔥"][n - 1]}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-actions">
          <button type="submit" className="primary">Save check-in</button>
        </div>
      </form>
    </Sheet>
  );
}

export function EndSheet({ idea, mode, onClose }: { idea: Idea; mode: "ship" | "kill"; onClose: () => void }) {
  const { run, notify } = useStore();
  const [shipUrl, setShipUrl] = useState("");
  const [reason, setReason] = useState("");
  const [whatWorked, setWorked] = useState("");
  const [whatDidnt, setDidnt] = useState("");
  const [learned, setLearned] = useState("");
  const isShip = mode === "ship";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const postMortem = { whatWorked, whatDidnt, learned, reason: isShip ? undefined : reason };
    const ok = run(`${mode} ${idea.title}`, (d, now) =>
      isShip ? ship(d, idea.id, { shipUrl, postMortem }, now) : kill(d, idea.id, postMortem, now),
    );
    if (ok) {
      notify(isShip ? "🚀 Shipped! A slot is free." : "Killed — and you kept the lessons. A slot is free.");
      onClose();
    }
  };

  return (
    <Sheet title={isShip ? `Ship “${idea.title}”` : `Kill “${idea.title}”`} onClose={onClose}>
      <form onSubmit={submit}>
        {isShip ? (
          <div className="field">
            <label htmlFor="end-url">Link <span className="hint">(store page, video, repo… optional)</span></label>
            <input id="end-url" type="url" value={shipUrl} onChange={(e) => setShipUrl(e.target.value)} placeholder="https://" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="end-reason">Why are you stopping?</label>
            <textarea id="end-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Be honest — no market, too big, lost interest…" />
          </div>
        )}
        <div className="field">
          <label htmlFor="end-worked">What worked?</label>
          <textarea id="end-worked" value={whatWorked} onChange={(e) => setWorked(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="end-didnt">What didn't?</label>
          <textarea id="end-didnt" value={whatDidnt} onChange={(e) => setDidnt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="end-learned">What did you learn? <span className="hint">(required)</span></label>
          <textarea id="end-learned" value={learned} onChange={(e) => setLearned(e.target.value)} />
        </div>
        <div className="sheet-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className={isShip ? "primary" : "danger solid"}>{isShip ? "Ship it" : "Kill project"}</button>
        </div>
      </form>
    </Sheet>
  );
}

export function SkipCooldownSheet({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { run } = useStore();
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (run("skip cooldown", (d, now) => skipCooldown(d, idea.id, text, now))) onClose();
  };
  return (
    <Sheet title="Skip the cooldown?" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          The cooldown is there to protect you from the new-idea rush. If you're sure, type the title exactly:
        </p>
        <p><strong>{idea.title}</strong></p>
        <div className="field">
          <input type="text" aria-label="Type the idea title to confirm" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="sheet-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={text.trim() !== idea.title}>Skip cooldown</button>
        </div>
      </form>
    </Sheet>
  );
}
