# Idea Tracker

A personal app for choosing **one** project and finishing it. Ideas go through **Inbox → Score → Commit → Ship or Kill**.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Plan and progress: [docs/PLAN.md](docs/PLAN.md)

## How it works

1. **Capture** ideas with the **+** button (or press `n` on desktop). They cool down for 7 days.
2. **Score** an idea after its cooldown on money, passion, audience, effort and confidence. Optionally copy the AI review prompt into Claude or ChatGPT and paste the answer back.
3. **Commit** the best-ranked idea to one of two slots, **Main** (money/audience) or **Fun** (passion). Each project gets a finish line, a due date up to 8 weeks out, and 3–5 milestones.
4. **Check in** weekly. A banner reminds you after 7 days without one.
5. **Ship** or **Kill** a project, with a short post-mortem, to free its slot.

## Run locally

```bash
cd idea-tracker
npm install
npm run dev        # http://localhost:5173/Playground/
npm test           # domain, merge and sync tests
npm run build      # production build in dist/ (set BASE_PATH=/ to serve from the root)
```

## Set up sync between phone and desktop (once)

Your ideas are stored as `ideas.json` in a **private** GitHub repo of your own. The app code and its data stay separate.

1. **Create a private repo**, e.g. `my-ideas-data`. It can be empty, but initialise it with a README so the `main` branch exists.
2. **Create a fine-grained token**: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - *Repository access:* **Only select repositories** → `my-ideas-data`
   - *Permissions:* **Contents → Read and write**
   - Set an expiry (e.g. 1 year) and put a reminder in your calendar.
3. Open the app → **Settings** → fill in the owner, repo and token → **Connect**. Do this on each device.

The token is stored only in that browser's localStorage and is sent only to `api.github.com`. The production build enforces this with a Content-Security-Policy. "Disconnect" in Settings removes it.

## Deploy to GitHub Pages

The workflow `.github/workflows/idea-tracker-pages.yml` runs the tests, builds the app and deploys it on every push to `main` that touches `idea-tracker/`.

1. Repo → **Settings → Pages → Source: GitHub Actions**. (On a free plan Pages needs a public repo. That's fine: your ideas live in the private data repo.)
2. Merge to `main`. The app is published at `https://<you>.github.io/Playground/`.
3. **Install it:** on Android/Chrome use *Add to Home screen* / *Install app*; on iOS Safari use *Share → Add to Home Screen*; on desktop Chrome use the install icon in the address bar.

## Code layout

```
src/domain/    pure business rules: scoring, cooldown, transitions, merge, AI prompt (fully unit-tested)
src/storage/   localStorage cache, GitHub contents API, sync engine (pull → merge → push, conflict retry)
src/state/     React context wiring the domain and the sync engine together
src/pages/     Focus, Inbox, Ranked, Idea detail, Commit, Archive, Settings
src/components/ shared UI and sheets (capture, check-in, ship/kill, skip cooldown)
```
