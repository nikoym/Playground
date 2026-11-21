# Idea Tracker — Spec (v1)

A personal app for a solo developer that turns a pile of ideas into **one finished project at a time**.

## 1. Problem

- Too many ideas. Choosing between them is hard, and it isn't clear which ones are worth doing.
- Projects get dropped when **a new idea shows up** or **motivation fades**.
- Ideas live in my head, so I can't see or compare them.
- "Worth doing" means a mix of **money**, **passion** and **audience**.
- I have 5–15 hours a week, on both phone and desktop.

## 2. Core method: Inbox → Score → Commit → Ship or Kill

| Stage | Rule | Why |
|---|---|---|
| **Inbox** | Capture any idea in under 10 s. It can't be scored until a **7-day cooldown** has passed (configurable). | Beats the shiny new idea: excitement fades and the real ideas stay. |
| **Score** | Rate each idea 1–5 on 5 criteria. The app ranks ideas by a weighted score. An optional AI review prompt critiques the idea. | Turns a gut decision into a comparison. |
| **Commit** | Only **2 active slots**: **Main** (money/audience) and **Fun** (passion). Committing requires a **finish line** due within 4–6 weeks and 3–5 milestones. | Limits focus and gives each project a clear end. |
| **Ship or Kill** | A slot frees up only when the project is **shipped** or **killed with a post-mortem**. | No silent abandoning. Killing a project is fine, as long as I record why. |
| **Weekly check-in** | Each active project gets a short weekly log entry. A banner appears if more than 7 days have passed. | Keeps progress visible, which keeps motivation up, and can feed a devlog. |

## 3. Scope

### In v1
- Quick capture (title required; note and category optional)
- Idea list with filters by status and category
- Cooldown enforcement
- Scoring with configurable weights, plus a ranked list
- "Copy AI review prompt" button
- Two slots, finish line, milestones (checkable)
- Ship / Kill flows with a post-mortem
- Weekly check-ins plus a reminder banner
- Sync through a JSON file in a GitHub repo
- Installable PWA, mobile-first layout, light and dark mode
- Works offline with a local cache, and syncs when back online

### Not in v1 (log these as ideas in the app itself)
- Built-in LLM API call for reviews (v2)
- Charts and statistics, tags, search, attachments
- Multiple users, notifications, native apps

## 4. Data model

One file: `ideas.json` in a data repo.

```ts
type Category = "app-business" | "ai-video" | "game" | "other";
type Status = "inbox" | "candidate" | "active" | "shipped" | "killed" | "archived";
type Slot = "main" | "fun";

interface Scores {        // each 1..5
  money: number;
  passion: number;
  audience: number;
  effort: number;         // 5 = huge effort (counts against the idea)
  confidence: number;     // evidence that people want it
}

interface Milestone { id: string; title: string; done: boolean; doneAt?: string }

interface CheckIn { id: string; date: string; progress: string; next: string; mood?: 1|2|3|4|5 }

interface Idea {
  id: string;                 // crypto.randomUUID()
  title: string;
  note?: string;
  category: Category;
  status: Status;
  createdAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp, used for merging
  scores?: Scores;
  scoredAt?: string;
  aiReview?: string;          // AI response pasted back by the user
  cooldownSkipped?: boolean;
  // active-only
  slot?: Slot;
  startedAt?: string;
  finishLine?: string;        // e.g. "Playable demo on itch.io"
  dueDate?: string;           // ISO date, 1–8 weeks after startedAt
  milestones?: Milestone[];
  checkIns?: CheckIn[];
  // end states
  endedAt?: string;
  postMortem?: { whatWorked: string; whatDidnt: string; learned: string; reason?: string };
  shipUrl?: string;
}

interface Settings {
  cooldownDays: number;       // default 7
  weights: Record<keyof Scores, number>; // default all 1; effort is inverted
}

interface DataFile {
  version: 1;
  settings: Settings;
  ideas: Idea[];
  deletedIds: string[];       // tombstones so a deletion survives a merge
}
```

### Status transitions

```
inbox ──(cooldown over + scored)──▶ candidate ──(commit to free slot)──▶ active ──▶ shipped
  │                                    │                                   └──────▶ killed
  └────────────▶ archived ◀────────────┘   (dropped before starting; no post-mortem needed)
```

- `inbox → candidate`: only after `now - createdAt >= cooldownDays`, by saving scores.
  - Escape hatch: "Skip cooldown" asks me to type the idea's title to confirm, then sets `cooldownSkipped: true`. The flag shows as a badge forever. This adds friction without being a wall, and it's needed on day one to put the tracker itself in a slot.
- `candidate → active`: only when the chosen slot is free. Requires a finish line, a due date and at least 1 milestone (3–5 recommended).
- `active → shipped`: optional ship URL plus a short post-mortem.
- `active → killed`: post-mortem required (reason and what I learned).
- `shipped`, `killed` and `archived` are final. Ideas can be duplicated back into the inbox ("Revisit").
- Scores on candidates can be edited at any time.

## 5. Scoring

```
inverted(effort) = 6 - effort
raw   = Σ weight_c × value_c          (using inverted effort)
max   = Σ weight_c × 5
score = round(100 × raw / max)        → 0..100
```

The ranked list shows candidates sorted by score, with each criterion as a small bar. Ties are broken by lowest effort, then oldest idea first.

Criterion prompts shown in the UI:
- **Money**: could this make money within 6 months of shipping?
- **Passion**: would I build this even if it never paid?
- **Audience**: can I show it, post about it, grow a following with it?
- **Effort**: how big is a first shippable version? (1 = a weekend, 5 = months)
- **Confidence**: is there evidence anyone wants it (searches, competitors, people asking)?

## 6. AI review prompt (v1: copy to clipboard)

The button copies this template, filled in with the idea's data:

```
I'm a solo developer with 5–15 hours/week. I value money, passion and audience.
Critique this project idea honestly.

Idea: {title}
Category: {category}
Notes: {note}
My scores (1–5): money {money}, passion {passion}, audience {audience}, effort {effort}, confidence {confidence}

Please give me:
1. The strongest reason to do it and the strongest reason not to.
2. Who exactly would use/pay for/watch this, and where I'd find them.
3. Existing competitors or similar projects.
4. The smallest version I could ship in 4–6 weeks (a concrete finish line).
5. A 1-weekend experiment to validate it before committing.
6. Your own 1–5 scores for the same criteria, with one line each.
```

A text area on the idea page lets me paste the AI's response back. It's stored in `aiReview`.

## 7. Screens

1. **Home / Focus**: the two slot cards (Main, Fun) with finish line, days left, milestone progress, and a "Check in" button. A check-in-overdue banner. A big **+ Capture** button. Empty slots show "Pick from ranked list".
2. **Capture** (modal or sheet): title, optional note, category. Saves on Enter. Under 10 s.
3. **Inbox**: ideas still in cooldown show "scorable in N days". Ideas whose cooldown is over show a "Score now" button.
4. **Ranked**: candidates sorted by score. Each row has Commit, Edit scores and Archive.
5. **Idea detail**: all fields, a scoring form (5 sliders or 1–5 buttons with prompts), Copy AI prompt, the pasted review, and the history.
6. **Commit flow**: pick a slot, enter the finish line and due date (default today + 6 weeks, max 8), add 3–5 milestones.
7. **Ship / Kill flow**: post-mortem form.
8. **Archive / Graveyard**: shipped, killed and archived ideas with their post-mortems (a record of lessons learned).
9. **Settings**: GitHub connection (owner, repo, branch, path, token), cooldown days, weights, export/import JSON, sync status.

Navigation: bottom tab bar on mobile (Focus · Inbox · Ranked · Archive · Settings), and the same tabs at the top on desktop.

## 8. Storage and sync

- **Data repo:** a **separate private repo** (e.g. `my-ideas-data`) holding `ideas.json`. The app code can live in a public repo so GitHub Pages works on a free account, while the ideas stay private.
- **Auth:** a GitHub **fine-grained personal access token** limited to that single repo with *Contents: read & write*. It's pasted once per device in Settings and stored in `localStorage`. It's never committed and never sent anywhere except `api.github.com`.
- **API:** `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` (base64 content + `sha`), then `PUT` with `sha` to write. The file is created on first save if it's missing.
- **Local cache:** the full `DataFile` is mirrored in `localStorage`. The UI always reads the cache, so it's instant and works offline.
- **Write strategy:** changes are debounced (~2 s) and then pushed. Commit message: `tracker: <short action>`.
- **Conflict handling (phone and desktop edited the same file):** if the `PUT` returns 409/422 because the sha is stale → re-GET → **merge by idea id, last `updatedAt` wins**, honouring `deletedIds` → retry (up to 3 times).
- **Sync status indicator:** Synced / Saving… / Offline (pending changes) / Error (with message).
- **Without a token:** the app runs in local-only mode. Export/import JSON is always available as a backup.

## 9. Tech stack

- Vite + React 18 + TypeScript (strict)
- State: a React context with a reducer. All business rules live in pure functions in `src/domain/`.
- Styling: plain CSS with CSS variables (light and dark). No UI library.
- Routing: `react-router` with HashRouter, which avoids GitHub Pages 404s.
- PWA: `vite-plugin-pwa` (manifest, icons, offline shell)
- Tests: Vitest for domain logic (scoring, transitions, cooldown, merge)
- Deploy: a GitHub Actions workflow that builds and publishes to GitHub Pages
- No backend, no analytics, no third-party scripts (this limits risk to the token in localStorage)

## 10. Non-functional requirements

- Capture works in under 10 s on a phone; first load in under 2 s on 4G after install.
- Usable from 360 px wide upward; tap targets ≥ 44 px.
- No data loss: every action is written to the local cache before the remote save.
- Accessible: semantic HTML, labels on every input, keyboard usable.

## 11. Definition of done (v1)

- [ ] Deployed on GitHub Pages and installed on my phone and desktop
- [ ] Connected to the private data repo; an edit on the phone appears on desktop after a refresh
- [ ] My real 5–15 ideas captured
- [ ] Domain tests pass in CI
- [ ] The tracker itself is marked **shipped** in its own Main slot
