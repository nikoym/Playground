import { describe, expect, it } from "vitest";
import { computeScore, rankCandidates } from "../src/domain/scoring";
import { daysUntilScorable, isScorable } from "../src/domain/cooldown";
import {
  addCheckIn,
  archive,
  capture,
  commit,
  kill,
  overdueCheckIns,
  remove,
  revisit,
  RuleError,
  score,
  ship,
  skipCooldown,
  toggleMilestone,
  updateSettings,
} from "../src/domain/transitions";
import { buildReviewPrompt } from "../src/domain/prompt";
import { emptyDataFile, type DataFile, type Scores } from "../src/domain/types";
import { addDays, toDateInput } from "../src/domain/time";

const T0 = new Date("2026-11-01T10:00:00Z");
const after = (days: number) => addDays(T0, days);
const S: Scores = { money: 4, passion: 3, audience: 5, effort: 2, confidence: 3 };
const weights = emptyDataFile().settings.weights;
const pm = { whatWorked: "a", whatDidnt: "b", learned: "c", reason: "d" };

function withIdea(title = "Game"): { data: DataFile; id: string } {
  return capture(emptyDataFile(), { title, category: "game" }, T0);
}
function candidate(title = "Game", base?: DataFile): { data: DataFile; id: string } {
  const r = capture(base ?? emptyDataFile(), { title, category: "game" }, T0);
  return { data: score(r.data, r.id, S, after(7)), id: r.id };
}
const commitInput = (slot: "main" | "fun" = "main") => ({
  slot,
  finishLine: "Demo on itch.io",
  dueDate: toDateInput(after(7 + 30)),
  milestones: ["Prototype", "", "Art"],
});

describe("scoring", () => {
  it("max scores with lowest effort = 100, min = 0", () => {
    expect(computeScore({ money: 5, passion: 5, audience: 5, effort: 1, confidence: 5 }, weights)).toBe(100);
    expect(computeScore({ money: 1, passion: 1, audience: 1, effort: 5, confidence: 1 }, weights)).toBe(20);
  });
  it("inverts effort", () => {
    const low = computeScore({ ...S, effort: 1 }, weights);
    const high = computeScore({ ...S, effort: 5 }, weights);
    expect(low).toBeGreaterThan(high);
  });
  it("applies weights and handles all-zero weights", () => {
    const moneyOnly = { money: 1, passion: 0, audience: 0, effort: 0, confidence: 0 };
    expect(computeScore({ ...S, money: 5 }, moneyOnly)).toBe(100);
    expect(computeScore(S, { money: 0, passion: 0, audience: 0, effort: 0, confidence: 0 })).toBe(0);
  });
  it("ranks by score, then lower effort, then older", () => {
    let d = emptyDataFile();
    const mk = (title: string, s: Scores, at: Date) => {
      const r = capture(d, { title, category: "other" }, at);
      d = score(r.data, r.id, s, after(30));
    };
    mk("A", { money: 3, passion: 3, audience: 3, effort: 3, confidence: 3 }, T0); // 60
    mk("B", { money: 4, passion: 3, audience: 3, effort: 4, confidence: 3 }, after(1)); // 60, effort 4
    mk("C", { money: 3, passion: 3, audience: 3, effort: 3, confidence: 3 }, after(2)); // 60, newer than A
    mk("D", { money: 5, passion: 5, audience: 5, effort: 1, confidence: 5 }, after(3)); // 100
    expect(rankCandidates(d.ideas, weights).map((r) => r.idea.title)).toEqual(["D", "A", "C", "B"]);
  });
});

describe("cooldown", () => {
  it("counts down and allows scoring after N days", () => {
    const { data, id } = withIdea();
    const idea = data.ideas[0];
    expect(daysUntilScorable(idea, data.settings, after(0))).toBe(7);
    expect(daysUntilScorable(idea, data.settings, after(6.5))).toBe(1);
    expect(isScorable(idea, data.settings, after(7))).toBe(true);
    expect(() => score(data, id, S, after(3))).toThrow(/cooling down/);
  });
  it("respects cooldownDays = 0", () => {
    const { data, id } = withIdea();
    const d = updateSettings(data, { cooldownDays: 0 }, T0);
    expect(score(d, id, S, T0).ideas[0].status).toBe("candidate");
  });
  it("skip requires exact title and sets a flag", () => {
    const { data, id } = withIdea("My Game");
    expect(() => skipCooldown(data, id, "my game", T0)).toThrow(RuleError);
    const d = skipCooldown(data, id, "My Game", T0);
    expect(d.ideas[0].cooldownSkipped).toBe(true);
    expect(score(d, id, S, T0).ideas[0].status).toBe("candidate");
  });
});

describe("capture & scoring rules", () => {
  it("rejects empty titles and invalid scores", () => {
    expect(() => capture(emptyDataFile(), { title: "  ", category: "game" }, T0)).toThrow(RuleError);
    const { data, id } = withIdea();
    expect(() => score(data, id, { ...S, money: 6 }, after(8))).toThrow(/1 to 5/);
    expect(() => score(data, id, { ...S, money: 2.5 }, after(8))).toThrow(/1 to 5/);
  });
  it("candidates can be re-scored", () => {
    const { data, id } = candidate();
    const d = score(data, id, { ...S, money: 1 }, after(9));
    expect(d.ideas[0].scores?.money).toBe(1);
  });
});

describe("commit & slots", () => {
  it("commits a candidate into a free slot", () => {
    const { data, id } = candidate();
    const d = commit(data, id, commitInput(), after(7));
    const idea = d.ideas[0];
    expect(idea.status).toBe("active");
    expect(idea.slot).toBe("main");
    expect(idea.milestones?.map((m) => m.title)).toEqual(["Prototype", "Art"]);
  });
  it("enforces one project per slot, but allows main + fun", () => {
    const a = candidate("A");
    const b = candidate("B", a.data);
    const c = candidate("C", b.data);
    let d = commit(c.data, a.id, commitInput("main"), after(7));
    expect(() => commit(d, b.id, commitInput("main"), after(7))).toThrow(/taken by “A”/);
    d = commit(d, b.id, commitInput("fun"), after(7));
    expect(() => commit(d, c.id, commitInput("fun"), after(7))).toThrow(/taken/);
  });
  it("rejects non-candidates, missing finish line, no milestones, bad dates", () => {
    const inbox = withIdea();
    expect(() => commit(inbox.data, inbox.id, commitInput(), after(8))).toThrow(/candidates/);
    const { data, id } = candidate();
    expect(() => commit(data, id, { ...commitInput(), finishLine: " " }, after(7))).toThrow(/finish line/);
    expect(() => commit(data, id, { ...commitInput(), milestones: ["", " "] }, after(7))).toThrow(/milestone/);
    expect(() => commit(data, id, { ...commitInput(), dueDate: toDateInput(after(1)) }, after(7))).toThrow(/future/);
    expect(() => commit(data, id, { ...commitInput(), dueDate: toDateInput(after(7 + 70)) }, after(7))).toThrow(/8 weeks/);
  });
});

describe("active work and endings", () => {
  const active = () => {
    const { data, id } = candidate();
    return { data: commit(data, id, commitInput(), after(7)), id };
  };

  it("toggles milestones", () => {
    const { data, id } = active();
    const mId = data.ideas[0].milestones![0].id;
    const d = toggleMilestone(data, id, mId, after(8));
    expect(d.ideas[0].milestones![0].done).toBe(true);
    expect(toggleMilestone(d, id, mId, after(8)).ideas[0].milestones![0].done).toBe(false);
  });

  it("flags overdue check-ins and clears them after a check-in", () => {
    const { data, id } = active();
    expect(overdueCheckIns(data, after(10), 7)).toHaveLength(0);
    expect(overdueCheckIns(data, after(15), 7)).toHaveLength(1);
    const d = addCheckIn(data, id, { progress: "did stuff", next: "more" }, after(15));
    expect(overdueCheckIns(d, after(16), 7)).toHaveLength(0);
    expect(() => addCheckIn(d, id, { progress: "", next: "" }, after(16))).toThrow(RuleError);
  });

  it("ship frees the slot", () => {
    const { data, id } = active();
    const d = ship(data, id, { shipUrl: "https://x.io", postMortem: { ...pm, reason: undefined } }, after(30));
    expect(d.ideas[0].status).toBe("shipped");
    const next = candidate("Next", d);
    expect(commit(next.data, next.id, commitInput(), after(7)).ideas[0].status).toBe("active");
  });

  it("kill needs a reason and a lesson", () => {
    const { data, id } = active();
    expect(() => kill(data, id, { ...pm, reason: "" }, after(20))).toThrow(/reason/);
    expect(() => kill(data, id, { ...pm, learned: "" }, after(20))).toThrow(/learned/);
    expect(kill(data, id, pm, after(20)).ideas[0].status).toBe("killed");
  });

  it("active projects can't be archived or deleted", () => {
    const { data, id } = active();
    expect(() => archive(data, id, after(8))).toThrow(RuleError);
    expect(() => remove(data, id)).toThrow(RuleError);
  });

  it("revisit copies a finished idea back to the inbox", () => {
    const { data, id } = active();
    const killed = kill(data, id, pm, after(20));
    const r = revisit(killed, id, after(21));
    const copy = r.data.ideas.find((i) => i.id === r.id)!;
    expect(copy.status).toBe("inbox");
    expect(copy.title).toBe("Game");
    expect(r.data.ideas).toHaveLength(2);
  });

  it("remove leaves a tombstone", () => {
    const { data, id } = withIdea();
    const d = remove(data, id);
    expect(d.ideas).toHaveLength(0);
    expect(d.deletedIds).toEqual([id]);
  });
});

describe("prompt", () => {
  it("includes title, category label and scores", () => {
    const { data } = candidate("Cool App");
    const p = buildReviewPrompt(data.ideas[0]);
    expect(p).toContain("Idea: Cool App");
    expect(p).toContain("Category: Game");
    expect(p).toContain("money 4, passion 3, audience 5, effort 2, confidence 3");
  });
});
