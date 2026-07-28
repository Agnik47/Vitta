# Agent B — Workspace

Read `docs/common/00-START-HERE.md` before this file, every session, if you haven't already this session.

See also, in this same folder: `TASKS.md` (durable checklist for 1c/1d/1h), `ROADMAP.md` (milestones against the deadline), `ERROR-HANDLING.md` (failure modes specific to the ledger/webcmd/dashboard I/O rails).

## Role

You own the **I/O rails**: the real Dodo Payments test-mode integration and the real webcmd integration — the two modules that talk to the outside world and that `decide()` deliberately stays decoupled from (it takes their outputs as plain arguments). Once both are done, you move entirely onto the **dashboard** (`dashboard/`), a fully separate Next.js app. See `docs/common/05-PHASE-OWNERSHIP.md` for the full rationale on why this split keeps you and Agent A on disjoint files almost the whole build, and `docs/common/02-DECISIONS.md` ADR-002 for the decision record.

## Phases you own

| Phase | Status | Depends on |
|---|---|---|
| 1c — Dodo Payments integration (test mode) | ⏳ Not started | Phase 0 (Agent A) |
| 1d — webcmd integration | ⏳ Not started | Phase 0 (Agent A) |
| 1h — Dashboard (Next.js, read-only) | ⏳ Not started | 1b + 1e (Agent A) for the data-reading routes; the app shell can start right after 1c/1d, see Sync Point 4 |

Plus: Phase 2-4 stub verification and Phase 5 rehearsal are shared with Agent A — see `docs/common/05-PHASE-OWNERSHIP.md`.

## Folders/files you own

`src/ledger/`, `src/webcmd/`, `dashboard/` (entire app, own `package.json`, never mixed into the root one).

Never edit `src/mandate/`, `src/policy/`, `src/receipt/`, or `src/cli/` without flagging it first per `docs/common/06-SYNC-WORKFLOW.md` — those are Agent A's.

## Current task

Phase 0 confirmed pulled and verified on this machine (`tsc --noEmit` clean, `npm test` passes — same result Agent A reported). Starting Phase 1d (webcmd) first since it's self-serve (just an npm global install); Phase 1c (Dodo) needs a real test-mode account + API keys that only the user can create — see `docs/common/04-BLOCKERS.md`. Per the workflow correction from the user: this track works its own assigned phases (1c, 1d, then 1h) on its own pace and does not wait on or absorb Agent A's phases, regardless of Agent A's progress.

## Status

🔨 In progress — Phase 0 verified locally, starting 1c/1d

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-29 — Agent A pushed real Phase 0 (`46f8514`) while this session had independently drafted a duplicate local scaffold (uncommitted). Caught it via `git fetch` before pushing — discarded the local duplicate entirely, pulled Agent A's version, confirmed `tsc --noEmit` and `npm test` both pass clean on this machine too. Added `TASKS.md`, `ROADMAP.md`, `ERROR-HANDLING.md` to this folder per user request. Now starting real Phase 1d work (webcmd install, self-serve) and flagging Phase 1c's Dodo-account blocker to the user.

## Next steps

1. Phase 1d: `npm i -g @agentrhq/webcmd@0.4.3`, run `webcmd doctor`, and if it passes, implement `src/webcmd/manifest.ts` + `executor.ts` for real per `docs/03-WEBCMD-INTEGRATION.md`.
2. Phase 1c: blocked until the user provides a real Dodo test-mode account + `.env` with `DODO_API_KEY`/`DODO_API_KEY_READONLY`. Do not mock this — see `CLAUDE.md` § "If you're blocked".
3. Real integration test scripts required by both prompts (hitting the real Dodo API, and the real webcmd manifest) — run them for real and paste actual output into `docs/OUTCOME.md`, per `CLAUDE.md` rule 6 and 7. Do not proceed on the docs' sketched field names without verifying against the real API response.
4. Once 1c and 1d are done, tested, and pushed: check `docs/common/01-PROJECT-STATUS.md` for whether Agent A's 1b and 1e are done. If yes, start Phase 1h's data routes. If not yet, start the dashboard's app shell/scaffold (doesn't need frozen schemas) while you wait — see Sync Point 4 in `docs/common/05-PHASE-OWNERSHIP.md`.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

_(none yet)_

## Notes for Agent A

_(Use this section to leave context Agent A should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "Dodo's real balance field turned out to be called X, here's the raw response" type notes, though the authoritative place for that is still docs/OUTCOME.md per CLAUDE.md's existing rule. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

_(none yet)_
