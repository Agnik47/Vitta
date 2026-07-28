# Agent B — Roadmap

Timeline and milestones for Agent B's slice of the build, against the hard deadline in `docs/00-PRODUCT-BRIEF.md`: a working end-to-end demo by **31 July 2026 night**, live hackathon demo **1 August 2026**. Today is **28 July 2026** — roughly 3 days out.

This is Agent B's own pacing plan, not a shared commitment Agent A is bound by. It exists so a fresh session (or a status check from Agent A) can see at a glance whether Agent B's track is on schedule, without re-deriving it from the task list. Update the "Where we actually are" section every session; don't let it go stale.

## Milestones

| Milestone | Target | Depends on | Notes |
|---|---|---|---|
| M1 — Dodo test account confirmed, `.env` populated | ASAP, before any 1c code | Nothing — a manual/human step | Hard blocker until resolved; see `docs/common/04-BLOCKERS.md` |
| M2 — `webcmd doctor` passing | ASAP, before any 1d code | Nothing — a manual/human step | Hard blocker until resolved |
| M3 — Phase 1c done (Dodo ledger, real integration script run + pasted output) | Day 1 (28-29 Jul) | M1, Phase 0 scaffolding | `src/ledger/` |
| M4 — Phase 1d done (webcmd manifest + executor, real test script run + pasted output) | Day 1 (28-29 Jul) | M2, Phase 0 scaffolding | `src/webcmd/`; M3/M4 order-independent, can interleave |
| M5 — Dashboard app shell scaffolded | As soon as M3+M4 land | M3, M4 | Doesn't need Agent A's frozen schemas — start immediately, don't wait idle |
| M6 — Dashboard data routes (`/api/mandate`, `/api/events`, `/api/receipts`) | Day 2 (29-30 Jul) | Agent A's 1b + 1e pushed (Sync Point 4) | If Agent A is behind, keep building shell/static pages, don't block |
| M7 — Dashboard pages wired to real data, build+start verified, acceptance checklist passed | Day 2-3 (30-31 Jul) | M6 | `docs/06-DASHBOARD-SPEC.md` § Acceptance checklist is the actual gate |
| M8 — Phase 2-4 stub verification (filler, whenever idle) | Opportunistic | Phase 0 | Low effort, pick up during any wait on Agent A |
| M9 — Joint Phase 5 rehearsal | Day 3, before 1 Aug | Agent A's 1g + this track's 1h | Live joint session, not async |

## Where we actually are

_(Update every session — one line per milestone, most recent state.)_

- **2026-07-28:** Phase 0 scaffolding drafted locally (uncommitted) as a working baseline — package.json, tsconfig.json, full `src/` skeleton, `.env.example`, `dodopayments` installed. M1 and M2 are both open: no `.env` with real Dodo keys yet, no webcmd installed yet. Both are hard blockers for M3/M4 — cannot write real Phase 1c/1d code until resolved. Working on docs/task-tracking in the meantime; will pick up M3/M4 the moment M1/M2 clear, without waiting on Agent A's own phases.
- **2026-07-29:** Pulled Agent A's real Phase 0. M2 cleared partially (webcmd installed, but its browser-connectivity check fails — new blocker B-002) → M4 (webcmd) done except `execute()`'s live verification. M1 still open (no Dodo account) → M3 (Dodo) still fully blocked, B-001. M5-M7 (dashboard) pulled forward hard once Agent A shipped 1b+1e (Sync Point 4 opened same day) — built the whole dashboard in one pass rather than just the shell, since M1/M2 were still blocking M3/M4 anyway: Next.js app, 3 API routes, 3 pages, verified in an actual browser against real signed fixture data including a live tamper test. M7's acceptance checklist passes except the CLI-kill-mid-run item, which needs Phase 1f to exist first. M8/M9 not started.

## Sequencing rule

M3 and M4 don't depend on each other or on Agent A's 1a/1b/1e — work whichever of M1/M2 clears first, do that phase, then the other. Do not sit idle waiting for both blockers to clear before starting anything: if only M1 clears, do 1c; if only M2 clears, do 1d.

M5 (dashboard shell) is the one thing on this roadmap with zero upstream dependency at all besides Node/npm existing — if both M1 and M2 stay blocked for a while, this is legitimate work to pull forward rather than idling, per `docs/common/05-PHASE-OWNERSHIP.md` Sync Point 4's "shell can start after 1c/1d" note (shell scaffolding specifically doesn't even need that — only the data routes do).
