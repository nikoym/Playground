import { CRITERIA, type Idea, type Scores, type Settings } from "./types";

/** Weighted score normalised to 0..100. Effort is inverted (low effort = good). */
export function computeScore(scores: Scores, weights: Settings["weights"]): number {
  let raw = 0;
  let max = 0;
  for (const { key } of CRITERIA) {
    const w = Math.max(0, weights[key] ?? 0);
    const v = key === "effort" ? 6 - scores[key] : scores[key];
    raw += w * v;
    max += w * 5;
  }
  if (max === 0) return 0;
  return Math.round((100 * raw) / max);
}

/** Candidates sorted by score desc; ties: lowest effort, then oldest. */
export function rankCandidates(ideas: Idea[], weights: Settings["weights"]): { idea: Idea; score: number }[] {
  return ideas
    .filter((i) => i.status === "candidate" && i.scores)
    .map((idea) => ({ idea, score: computeScore(idea.scores!, weights) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.idea.scores!.effort - b.idea.scores!.effort ||
        a.idea.createdAt.localeCompare(b.idea.createdAt),
    );
}

export function isValidScores(s: Partial<Scores> | undefined): s is Scores {
  if (!s) return false;
  return CRITERIA.every(({ key }) => {
    const v = s[key];
    return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
  });
}
