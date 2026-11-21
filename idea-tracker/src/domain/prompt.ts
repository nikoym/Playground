import { CATEGORIES, type Idea } from "./types";

export function buildReviewPrompt(idea: Idea): string {
  const cat = CATEGORIES.find((c) => c.value === idea.category)?.label ?? idea.category;
  const s = idea.scores;
  const scoreLine = s
    ? `money ${s.money}, passion ${s.passion}, audience ${s.audience}, effort ${s.effort}, confidence ${s.confidence}`
    : "not scored yet";
  return `I'm a solo developer with 5–15 hours/week. I value money, passion and audience.
Critique this project idea honestly.

Idea: ${idea.title}
Category: ${cat}
Notes: ${idea.note?.trim() || "(none)"}
My scores (1–5): ${scoreLine}

Please give me:
1. The strongest reason to do it and the strongest reason not to.
2. Who exactly would use/pay for/watch this, and where I'd find them.
3. Existing competitors or similar projects.
4. The smallest version I could ship in 4–6 weeks (a concrete finish line).
5. A 1-weekend experiment to validate it before committing.
6. Your own 1–5 scores for the same criteria, with one line each.`;
}
