# Agent B — Workspace

Read `docs/common/00-START-HERE.md` before this file, every session, if you haven't already this session.

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

_(Not started. Blocked on Agent A pushing Phase 0 — see `docs/common/04-BLOCKERS.md` if this is still true when you start a session. Once unblocked: Phase 1c, per `docs/PROMPTS.md` Phase 1c prompt and `docs/02-DODO-INTEGRATION.md`. That prompt requires a real Dodo test-mode account and API keys in a local, uncommitted `.env` before writing code — if that doesn't exist yet, stop and say so, per `CLAUDE.md` § "If you're blocked" — do not mock it.)_

## Status

⏳ Not started — waiting on Phase 0

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.

## Next steps

1. Confirm with the user (or the other Claude Code session) which agent identity you are, if ambiguous.
2. `git pull` and check `docs/common/01-PROJECT-STATUS.md` — wait until Phase 0 shows pushed before writing any code.
3. Once unblocked: Phase 1c (Dodo) and Phase 1d (webcmd), either order — they don't depend on each other. Both only need Phase 0's scaffolding and interface definitions (`Ledger`, the manifest access-map shape), not anything from Agent A's mandate/policy work.
4. Real integration test scripts required by both prompts (hitting the real Dodo API, and the real webcmd manifest) — run them for real and paste actual output into `docs/OUTCOME.md`, per `CLAUDE.md` rule 6 and 7. Do not proceed on the docs' sketched field names without verifying against the real API response.
5. Once 1c and 1d are done, tested, and pushed: check `docs/common/01-PROJECT-STATUS.md` for whether Agent A's 1b and 1e are done. If yes, start Phase 1h's data routes. If not yet, start the dashboard's app shell/scaffold (doesn't need frozen schemas) while you wait — see Sync Point 4 in `docs/common/05-PHASE-OWNERSHIP.md`.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

_(none yet)_

## Notes for Agent A

_(Use this section to leave context Agent A should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "Dodo's real balance field turned out to be called X, here's the raw response" type notes, though the authoritative place for that is still docs/OUTCOME.md per CLAUDE.md's existing rule. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

_(none yet)_
