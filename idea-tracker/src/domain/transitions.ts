import { isScorable, daysUntilScorable } from "./cooldown";
import { isValidScores } from "./scoring";
import { addDays, DAY_MS } from "./time";
import {
  MAX_DUE_WEEKS,
  type Category,
  type CheckIn,
  type DataFile,
  type Idea,
  type PostMortem,
  type Scores,
  type Settings,
  type Slot,
} from "./types";

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

export const newId = (): string => crypto.randomUUID();

const iso = (now: Date) => now.toISOString();

function find(data: DataFile, id: string): Idea {
  const idea = data.ideas.find((i) => i.id === id);
  if (!idea) throw new RuleError("Idea not found.");
  return idea;
}

function replace(data: DataFile, id: string, fn: (idea: Idea) => Idea, now: Date): DataFile {
  const current = find(data, id);
  const next = { ...fn(current), updatedAt: iso(now) };
  return { ...data, ideas: data.ideas.map((i) => (i.id === id ? next : i)) };
}

export function slotOccupant(data: DataFile, slot: Slot): Idea | undefined {
  return data.ideas.find((i) => i.status === "active" && i.slot === slot);
}

// ---------- capture & edit ----------

export function capture(
  data: DataFile,
  input: { title: string; note?: string; category: Category },
  now: Date,
): { data: DataFile; id: string } {
  const title = input.title.trim();
  if (!title) throw new RuleError("Give the idea a title.");
  const id = newId();
  const idea: Idea = {
    id,
    title,
    note: input.note?.trim() || undefined,
    category: input.category,
    status: "inbox",
    createdAt: iso(now),
    updatedAt: iso(now),
  };
  return { data: { ...data, ideas: [idea, ...data.ideas] }, id };
}

export function updateIdea(
  data: DataFile,
  id: string,
  patch: Partial<Pick<Idea, "title" | "note" | "category" | "aiReview" | "finishLine">>,
  now: Date,
): DataFile {
  if (patch.title !== undefined && !patch.title.trim()) throw new RuleError("Title can't be empty.");
  return replace(data, id, (i) => ({ ...i, ...patch, title: (patch.title ?? i.title).trim() }), now);
}

// ---------- cooldown & scoring ----------

export function skipCooldown(data: DataFile, id: string, confirmTitle: string, now: Date): DataFile {
  const idea = find(data, id);
  if (idea.status !== "inbox") throw new RuleError("Only inbox ideas have a cooldown.");
  if (confirmTitle.trim() !== idea.title) throw new RuleError("Type the exact title to skip the cooldown.");
  return replace(data, id, (i) => ({ ...i, cooldownSkipped: true }), now);
}

export function score(data: DataFile, id: string, scores: Scores, now: Date): DataFile {
  const idea = find(data, id);
  if (!isValidScores(scores)) throw new RuleError("Every score must be a whole number from 1 to 5.");
  if (!isScorable(idea, data.settings, now)) {
    if (idea.status === "inbox") {
      const d = daysUntilScorable(idea, data.settings, now);
      throw new RuleError(`Still cooling down — scorable in ${d} day${d === 1 ? "" : "s"}.`);
    }
    throw new RuleError("Only inbox or candidate ideas can be scored.");
  }
  return replace(data, id, (i) => ({ ...i, scores: { ...scores }, scoredAt: iso(now), status: "candidate" }), now);
}

// ---------- commit ----------

export interface CommitInput {
  slot: Slot;
  finishLine: string;
  dueDate: string; // yyyy-mm-dd
  milestones: string[];
}

export function commit(data: DataFile, id: string, input: CommitInput, now: Date): DataFile {
  const idea = find(data, id);
  if (idea.status !== "candidate") throw new RuleError("Only scored candidates can be committed.");
  const occupant = slotOccupant(data, input.slot);
  if (occupant) throw new RuleError(`The ${input.slot} slot is taken by “${occupant.title}”. Ship or kill it first.`);
  const finishLine = input.finishLine.trim();
  if (!finishLine) throw new RuleError("Define a finish line — what does “done” look like?");
  const milestones = input.milestones.map((m) => m.trim()).filter(Boolean);
  if (milestones.length < 1) throw new RuleError("Add at least one milestone.");
  const due = new Date(`${input.dueDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) throw new RuleError("Pick a valid due date.");
  if (due.getTime() < now.getTime()) throw new RuleError("The due date must be in the future.");
  if (due.getTime() > addDays(now, MAX_DUE_WEEKS * 7 + 1).getTime())
    throw new RuleError(`Keep it short: due within ${MAX_DUE_WEEKS} weeks.`);

  return replace(
    data,
    id,
    (i) => ({
      ...i,
      status: "active",
      slot: input.slot,
      startedAt: iso(now),
      finishLine,
      dueDate: input.dueDate,
      milestones: milestones.map((title) => ({ id: newId(), title, done: false })),
      checkIns: [],
    }),
    now,
  );
}

// ---------- active project work ----------

function requireActive(data: DataFile, id: string): Idea {
  const idea = find(data, id);
  if (idea.status !== "active") throw new RuleError("This project isn't active.");
  return idea;
}

export function toggleMilestone(data: DataFile, id: string, milestoneId: string, now: Date): DataFile {
  requireActive(data, id);
  return replace(
    data,
    id,
    (i) => ({
      ...i,
      milestones: (i.milestones ?? []).map((m) =>
        m.id === milestoneId ? { ...m, done: !m.done, doneAt: m.done ? undefined : iso(now) } : m,
      ),
    }),
    now,
  );
}

export function addMilestone(data: DataFile, id: string, title: string, now: Date): DataFile {
  requireActive(data, id);
  const t = title.trim();
  if (!t) throw new RuleError("Milestone needs a title.");
  return replace(data, id, (i) => ({ ...i, milestones: [...(i.milestones ?? []), { id: newId(), title: t, done: false }] }), now);
}

export function removeMilestone(data: DataFile, id: string, milestoneId: string, now: Date): DataFile {
  requireActive(data, id);
  return replace(data, id, (i) => ({ ...i, milestones: (i.milestones ?? []).filter((m) => m.id !== milestoneId) }), now);
}

export function addCheckIn(
  data: DataFile,
  id: string,
  input: { progress: string; next: string; mood?: CheckIn["mood"] },
  now: Date,
): DataFile {
  requireActive(data, id);
  const progress = input.progress.trim();
  const next = input.next.trim();
  if (!progress && !next) throw new RuleError("Write at least what you did or what's next.");
  const entry: CheckIn = { id: newId(), date: iso(now), progress, next, mood: input.mood };
  return replace(data, id, (i) => ({ ...i, checkIns: [entry, ...(i.checkIns ?? [])] }), now);
}

export function lastActivity(idea: Idea): string | undefined {
  return idea.checkIns?.[0]?.date ?? idea.startedAt;
}

/** Active projects with no check-in in the last `intervalDays`. */
export function overdueCheckIns(data: DataFile, now: Date, intervalDays: number): Idea[] {
  return data.ideas.filter((i) => {
    if (i.status !== "active") return false;
    const last = lastActivity(i);
    return !last || now.getTime() - new Date(last).getTime() > intervalDays * DAY_MS;
  });
}

// ---------- endings ----------

export function ship(data: DataFile, id: string, input: { shipUrl?: string; postMortem: PostMortem }, now: Date): DataFile {
  requireActive(data, id);
  const pm = input.postMortem;
  if (!pm.learned.trim()) throw new RuleError("Write down at least one thing you learned.");
  return replace(
    data,
    id,
    (i) => ({ ...i, status: "shipped", endedAt: iso(now), shipUrl: input.shipUrl?.trim() || undefined, postMortem: pm }),
    now,
  );
}

export function kill(data: DataFile, id: string, postMortem: PostMortem, now: Date): DataFile {
  requireActive(data, id);
  if (!postMortem.reason?.trim()) throw new RuleError("Why are you stopping? A kill needs a reason.");
  if (!postMortem.learned.trim()) throw new RuleError("Write down at least one thing you learned.");
  return replace(data, id, (i) => ({ ...i, status: "killed", endedAt: iso(now), postMortem }), now);
}

export function archive(data: DataFile, id: string, now: Date): DataFile {
  const idea = find(data, id);
  if (idea.status !== "inbox" && idea.status !== "candidate")
    throw new RuleError("Only ideas that haven't started can be archived. Active projects must be shipped or killed.");
  return replace(data, id, (i) => ({ ...i, status: "archived", endedAt: iso(now) }), now);
}

export function revisit(data: DataFile, id: string, now: Date): { data: DataFile; id: string } {
  const idea = find(data, id);
  if (!["shipped", "killed", "archived"].includes(idea.status))
    throw new RuleError("Only finished or archived ideas can be revisited.");
  return capture(
    data,
    { title: idea.title, note: [idea.note, `(Revisited from a ${idea.status} idea)`].filter(Boolean).join("\n\n"), category: idea.category },
    now,
  );
}

export function remove(data: DataFile, id: string): DataFile {
  const idea = find(data, id);
  if (idea.status === "active") throw new RuleError("Active projects can't be deleted — ship or kill them.");
  return {
    ...data,
    ideas: data.ideas.filter((i) => i.id !== id),
    deletedIds: data.deletedIds.includes(id) ? data.deletedIds : [...data.deletedIds, id],
  };
}

// ---------- settings ----------

export function updateSettings(data: DataFile, patch: Partial<Omit<Settings, "updatedAt">>, now: Date): DataFile {
  const next: Settings = {
    ...data.settings,
    ...patch,
    weights: { ...data.settings.weights, ...(patch.weights ?? {}) },
    updatedAt: iso(now),
  };
  if (!Number.isFinite(next.cooldownDays) || next.cooldownDays < 0 || next.cooldownDays > 60)
    throw new RuleError("Cooldown must be between 0 and 60 days.");
  for (const w of Object.values(next.weights))
    if (!Number.isFinite(w) || w < 0 || w > 5) throw new RuleError("Weights must be between 0 and 5.");
  return { ...data, settings: next };
}
