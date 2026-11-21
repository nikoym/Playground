# Idea Tracker — Implementation Plan

Source of truth for behaviour: [SPEC.md](./SPEC.md). Work happens in phases, and each phase ends in a working, committed state. Tick the boxes as tasks are done.

**Time budget:** one weekend (Phases 0–3 on Saturday, 4–6 on Sunday). Anything that doesn't fit goes into the app's own inbox, not into v1.

## Project layout

```
idea-tracker/
  docs/              SPEC.md, PLAN.md
  public/            icons, favicon
  src/
    domain/          pure logic, no React (types, scoring, transitions, cooldown, merge, prompt)
    storage/         localCache.ts, github.ts, sync.ts
    state/           store.tsx (context + reducer), hooks
    components/      reusable UI (SlotCard, ScoreInput, IdeaRow, Sheet, SyncBadge, Tabs)
    pages/           Focus, Inbox, Ranked, IdeaDetail, Archive, Settings
    styles/          tokens.css, base.css
    main.tsx, App.tsx
  tests/             *.test.ts for domain + merge
.github/workflows/idea-tracker-pages.yml   (at repo root)
```

## Phase 0 — Scaffold (≈30 min)
- [ ] `npm create vite` → React + TS in `idea-tracker/`; strict TS; ESLint defaults
- [ ] Add `react-router-dom` (HashRouter), `vitest`, `vite-plugin-pwa`
- [ ] Set `base` in `vite.config.ts` for Pages (`/<repo-name>/`)
- [ ] CSS tokens for light and dark, base layout, bottom-tab shell with 5 empty pages
- [ ] npm scripts: `dev`, `build`, `test`, `preview`
- **Done when:** `npm run dev` shows the tab shell and `npm test` runs.

## Phase 1 — Domain logic + tests (≈1.5 h)
- [ ] `domain/types.ts`: types from SPEC §4 and default settings
- [ ] `domain/scoring.ts`: `computeScore(scores, weights)` and `rankCandidates(ideas, weights)` (tie-breaks per SPEC §5)
- [ ] `domain/cooldown.ts`: `daysUntilScorable(idea, settings, now)`, `isScorable`
- [ ] `domain/transitions.ts`: `capture`, `score`, `skipCooldown`, `commit`, `toggleMilestone`, `addCheckIn`, `ship`, `kill`, `archive`, `revisit`, `remove`. Each one returns a new `DataFile` or throws a typed `RuleError` (slot taken, cooldown active, missing finish line, …). Every mutation bumps `updatedAt`.
- [ ] `domain/merge.ts`: `mergeDataFiles(local, remote)` merges by id with last `updatedAt` winning, unions and applies `deletedIds`, and lets the newer side's settings win
- [ ] `domain/prompt.ts`: `buildReviewPrompt(idea)` (template from SPEC §6)
- [ ] Tests: scoring maths and the inverted effort, cooldown edges, each illegal transition, slot limit, merge conflicts (same idea edited on both sides, a deletion against an edit, a new idea on each side)
- **Done when:** all domain tests pass. No UI yet.

## Phase 2 — Local state + capture + inbox (≈1.5 h)
- [ ] `storage/localCache.ts`: load and save `DataFile` in localStorage (versioned key, safe JSON parse)
- [ ] `state/store.tsx`: a reducer that wraps the domain functions, saves to the cache on every change, and shows a toast when a `RuleError` is thrown
- [ ] Capture sheet (title autofocused, Enter saves, category chips), opened from a floating + button on every page
- [ ] Inbox page: list with cooldown countdowns, "Score now" when allowed, "Skip cooldown" with type-to-confirm
- **Done when:** I can capture ideas on a phone-sized viewport and they survive a reload.

## Phase 3 — Scoring + ranked + idea detail (≈2 h)
- [ ] `ScoreInput` component: 1–5 segmented buttons, with the criterion question shown under each
- [ ] Idea detail page: edit title, note and category, the scoring form, live score preview, Copy AI prompt (clipboard plus a "Copied" toast), a box for the pasted AI review, Archive and Delete
- [ ] Ranked page: sorted candidates, score badge, mini bars per criterion, Commit button
- [ ] Settings: weights and cooldown days (local only for now)
- **Done when:** I can score ideas and see the ranking change as weights change.

## Phase 4 — Slots, check-ins, ship/kill (≈2 h)
- [ ] Commit flow: choose a slot (taken slots disabled, showing the occupant), finish line, due date (default +6 weeks, max +8), 3–5 milestone inputs
- [ ] Focus page: two `SlotCard`s with days left (red when overdue), milestone checklist, progress bar, and a "Check in" button
- [ ] Check-in sheet: progress, next step, optional mood. Overdue banner when the last check-in on any active project is more than 7 days old
- [ ] Ship flow (URL plus post-mortem) and Kill flow (post-mortem required)
- [ ] Archive page: shipped, killed and archived ideas with their post-mortems, and Revisit to copy one back to the inbox
- **Done when:** the full lifecycle works locally from end to end.

## Phase 5 — GitHub sync (≈2 h)
- [ ] `storage/github.ts`: `getFile()` → `{data, sha} | null`, `putFile(data, sha?, message)`; base64 encoding that's safe for UTF-8; typed errors (auth, not found, conflict, network)
- [ ] `storage/sync.ts`: pull on start and when the window regains focus; debounced push (~2 s); on 409/422 → re-pull → `mergeDataFiles` → retry ×3; pending flag while offline; retry on the `online` event
- [ ] Settings page: owner, repo, branch, path, token (password field), a "Test connection" button, Disconnect, Export and Import JSON
- [ ] `SyncBadge` in the header: Synced, Saving…, Offline, or Error
- [ ] First connect: if a remote file exists → merge it with the local data; if not → create it from local data
- [ ] Manual test: edit on two browser profiles at once and confirm both changes survive
- **Done when:** changes round-trip through a real private repo.

## Phase 6 — PWA + deploy (≈1 h)
- [ ] `vite-plugin-pwa`: manifest (name, colours, display standalone), 192 and 512 px icons, autoUpdate service worker
- [ ] `.github/workflows/idea-tracker-pages.yml`: on push to the default branch with changes in `idea-tracker/**`, run `npm ci` → `npm test` → `npm run build` → deploy to Pages
- [ ] `idea-tracker/README.md`: setup steps (create a private data repo, create a fine-grained token, enable Pages, install on the phone)
- [ ] Lighthouse check: installable, and no console errors
- **Done when:** the app is installed on my phone, synced with desktop, and my real ideas are in it.

## Phase 7 — Ship it (≈15 min)
- [ ] Capture "Idea Tracker", skip its cooldown, commit it to the Main slot, tick the milestones, then **Ship** it with a post-mortem
- [ ] Move the "not in v1" list from SPEC §3 into the inbox as ideas

## Manual setup (to do myself, outside the code)
1. Create a **private** repo, e.g. `my-ideas-data` (it can start empty).
2. GitHub → Settings → Developer settings → Fine-grained tokens → access to **only** that repo, with *Contents: Read and write*. Set an expiry and note the date.
3. Make sure the repo hosting the app can use GitHub Pages: a public repo on a free plan, or a private one on a paid plan. Set Pages → Source: GitHub Actions.
4. Paste the token into the app's Settings on each device.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Token stored in localStorage | Fine-grained token limited to one data repo; no third-party scripts; expiry date; Disconnect clears it |
| Phone and desktop edits conflict | sha check + merge by id using `updatedAt` + retry |
| Scope creep keeps the weekend from finishing | Everything not in SPEC §3 "In v1" goes into the app's inbox |
| GitHub API rate limit (5000/h) | Debounced writes; pull only on start and focus |
| Pages 404 on deep links | HashRouter |

## v2 backlog (after shipping)
- Built-in AI review via an LLM API (a key in Settings, or a small serverless proxy)
- Weekly devlog export (check-ins → Markdown post)
- Stats: shipped vs killed, average project length, score vs outcome
- Reminder notifications for check-ins
