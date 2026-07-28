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

Phase 1d is mostly done: `manifest.ts` fully implemented and real-tested (live fetch + disk-cache fallback both confirmed). `executor.ts`'s `execute()` is implemented per spec but **cannot be verified against a real live command** — `webcmd doctor` fails its Connectivity check on this machine (see `docs/common/04-BLOCKERS.md` B-002). The idempotency guard (`hasAlreadyDrawn`/`recordDraw`) inside `executor.ts` IS real-tested since it's pure filesystem logic with no browser dependency. Phase 1c remains blocked on a real Dodo account (B-001). Per the workflow correction from the user: this track works its own assigned phases (1c, 1d, then 1h) on its own pace and does not wait on or absorb Agent A's phases, regardless of Agent A's progress.

## Status

⚠️ Phase 1d partially done (manifest.ts ✅, executor.execute() blocked on B-002) — Phase 1c blocked on B-001

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-29 — Agent A pushed real Phase 0 (`46f8514`) while this session had independently drafted a duplicate local scaffold (uncommitted). Caught it via `git fetch` before pushing — discarded the local duplicate entirely, pulled Agent A's version, confirmed `tsc --noEmit` and `npm test` both pass clean on this machine too. Added `TASKS.md`, `ROADMAP.md`, `ERROR-HANDLING.md` to this folder per user request. Now starting real Phase 1d work (webcmd install, self-serve) and flagging Phase 1c's Dodo-account blocker to the user.
- 2026-07-29 — Installed `@agentrhq/webcmd@0.4.3` globally. `webcmd doctor` fails its Connectivity check (browser exec timeout) — daemon and Cloak runtime both report OK, but no browser-backed command has ever succeeded on this machine (confirmed via `webcmd profile list`). Manifest fetch (`webcmd list -f json`) is unaffected and works fine (805 real commands, 228 write-access). Implemented `src/webcmd/manifest.ts` for real, ran the required manual checks for real (write count, `blinkit/place-order` lookup, nonsense-command fail-closed check, plus the live-fetch-fails-falls-back-to-cache path) — all pass, pasted into `docs/OUTCOME.md`. Implemented `src/webcmd/executor.ts`'s `execute()` per spec (unverified — can't run a real command until B-002 clears) plus `hasAlreadyDrawn()`/`recordDraw()` idempotency guard against `ledger.jsonl` (real-tested, pure fs logic — see ADR-004 in `02-DECISIONS.md` for the entry-shape decision). Logged blocker B-002. `tsc --noEmit` and `npm test` (10/10) both still clean.

## Next steps

1. Phase 1c: still blocked until the user provides a real Dodo test-mode account + `.env` with `DODO_API_KEY`/`DODO_API_KEY_READONLY`. Do not mock this — see `CLAUDE.md` § "If you're blocked".
2. Phase 1d remainder: verify `execute()` against one real live webcmd write command the moment B-002 (browser connectivity) is resolved — likely needs the user to fix/configure the Cloak browser bridge on this machine. Until then, don't mark Phase 1d fully ✅.
3. If both B-001 and B-002 stay open for a while: pull forward the dashboard app shell (`docs/agent-b/ROADMAP.md` M5) — it needs neither.
4. Once 1c and 1d are done, tested, and pushed: check `docs/common/01-PROJECT-STATUS.md` for whether Agent A's 1b and 1e are done. If yes, start Phase 1h's data routes. If not yet, start the dashboard's app shell/scaffold (doesn't need frozen schemas) while you wait — see Sync Point 4 in `docs/common/05-PHASE-OWNERSHIP.md`.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

- `src/webcmd/executor.ts`'s `execute()` has never been run against a real webcmd command — see blocker B-002. The code is a direct match of the spec's sketch, so it's low-risk, but treat it as unverified until a real run happens.
- `ManifestCommand` in `manifest.ts` only types the 3 fields (`site`, `name`, `access`) actually consumed — the real payload has 14 fields per command. If a future phase needs another field (e.g. `columns` for display), extend the interface then rather than speculatively now.

## Notes for Agent A

_(Use this section to leave context Agent A should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "Dodo's real balance field turned out to be called X, here's the raw response" type notes, though the authoritative place for that is still docs/OUTCOME.md per CLAUDE.md's existing rule. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

- The real webcmd manifest has 805 commands (228 write), not the spec doc's guessed ~302/~192 — if Phase 1f/1g's demo script assumes a specific count anywhere, it doesn't need to; nothing in the demo script actually hardcodes these numbers, just flagging in case.
- `ledger.jsonl`'s entry shape is now concrete (`{ runId, reserveRef, amountInrPaise, ts }`, see ADR-004) — when you wire `gate run`/`gate fund` in Phase 1f, call `hasAlreadyDrawn(runId)` from `src/webcmd/executor.ts` before `Ledger.draw()`, and `recordDraw(...)` after a successful draw.
