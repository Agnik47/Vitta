# Agent B — Workspace

Read `docs/common/00-START-HERE.md` before this file, every session, if you haven't already this session.

See also, in this same folder: `TASKS.md` (durable checklist for 1c/1d/1h), `ROADMAP.md` (milestones against the deadline), `ERROR-HANDLING.md` (failure modes specific to the ledger/webcmd/dashboard I/O rails).

## Role

You own the **I/O rails**: the real Dodo Payments test-mode integration and the real webcmd integration — the two modules that talk to the outside world and that `decide()` deliberately stays decoupled from (it takes their outputs as plain arguments). Once both are done, you move entirely onto the **dashboard** (`dashboard/`), a fully separate Next.js app. See `docs/common/05-PHASE-OWNERSHIP.md` for the full rationale on why this split keeps you and Agent A on disjoint files almost the whole build, and `docs/common/02-DECISIONS.md` ADR-002 for the decision record.

## Phases you own

| Phase | Status | Depends on |
|---|---|---|
| 1c — Dodo Payments integration (test mode) | ❌ Blocked (B-001) | Phase 0 (Agent A) |
| 1d — webcmd integration | ⚠️ Partial (manifest.ts ✅, execute() blocked on B-002) | Phase 0 (Agent A) |
| 1h — Dashboard (Next.js, read-only) | ⚠️ Done with deviations — see `docs/OUTCOME.md` | 1b + 1e (Agent A, both shipped) — done |

Plus: Phase 2-4 stub verification and Phase 5 rehearsal are shared with Agent A — see `docs/common/05-PHASE-OWNERSHIP.md`.

## Folders/files you own

`src/ledger/`, `src/webcmd/`, `dashboard/` (entire app, own `package.json`, never mixed into the root one).

Never edit `src/mandate/`, `src/policy/`, `src/receipt/`, or `src/cli/` without flagging it first per `docs/common/06-SYNC-WORKFLOW.md` — those are Agent A's.

## Current task

Phase 1h (dashboard) is done, for real, against Agent A's shipped 1b+1e — see `docs/OUTCOME.md` for the full acceptance-checklist walkthrough (Next.js 16.2.12, all three pages/routes verified in an actual browser against real cryptographically-signed fixture data, tamper test confirmed live). One checklist item (kill dashboard mid-CLI-run) can't be tested until Phase 1f exists. Phase 1c remains blocked on a real Dodo account (B-001). Phase 1d's `execute()` remains blocked on the browser connectivity issue (B-002) — `manifest.ts` is done and real-tested. Per the workflow correction from the user: this track works its own assigned phases (1c, 1d, 1h) on its own pace and does not wait on or absorb Agent A's phases, regardless of Agent A's progress.

## Status

⚠️ Phase 1h done with deviations (see `docs/OUTCOME.md`) — Phase 1d partial (manifest.ts ✅, execute() blocked on B-002) — Phase 1c blocked on B-001

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-29 — Agent A pushed real Phase 0 (`46f8514`) while this session had independently drafted a duplicate local scaffold (uncommitted). Caught it via `git fetch` before pushing — discarded the local duplicate entirely, pulled Agent A's version, confirmed `tsc --noEmit` and `npm test` both pass clean on this machine too. Added `TASKS.md`, `ROADMAP.md`, `ERROR-HANDLING.md` to this folder per user request. Now starting real Phase 1d work (webcmd install, self-serve) and flagging Phase 1c's Dodo-account blocker to the user.
- 2026-07-29 — Installed `@agentrhq/webcmd@0.4.3` globally. `webcmd doctor` fails its Connectivity check (browser exec timeout) — daemon and Cloak runtime both report OK, but no browser-backed command has ever succeeded on this machine (confirmed via `webcmd profile list`). Manifest fetch (`webcmd list -f json`) is unaffected and works fine (805 real commands, 228 write-access). Implemented `src/webcmd/manifest.ts` for real, ran the required manual checks for real (write count, `blinkit/place-order` lookup, nonsense-command fail-closed check, plus the live-fetch-fails-falls-back-to-cache path) — all pass, pasted into `docs/OUTCOME.md`. Implemented `src/webcmd/executor.ts`'s `execute()` per spec (unverified — can't run a real command until B-002 clears) plus `hasAlreadyDrawn()`/`recordDraw()` idempotency guard against `ledger.jsonl` (real-tested, pure fs logic — see ADR-004 in `02-DECISIONS.md` for the entry-shape decision). Logged blocker B-002. `tsc --noEmit` and `npm test` (10/10) both still clean.
- 2026-07-29 — Phase 1h (dashboard): Sync Point 4 opened once Agent A shipped 1b+1e, so built the whole thing in one session. Scaffolded Next.js 16.2.12 at `dashboard/`, implemented all 3 API routes + 3 pages + `lib/{types,hash,read,dodo}.ts` per `docs/06-DASHBOARD-SPEC.md`. Found the real Dodo SDK's balance model is customer-keyed, not session-keyed as the spec sketch assumed — see `docs/OUTCOME.md`'s open-questions table for the full real-type writeup; `lib/dodo.ts` implements the real resolution chain, marked unverified-live pending B-001. Found the gate's public-key persistence location is undefined (Phase 1f gap) — flagged below, shipped `chain_link_valid` for real and `signature_valid` as "pending" in the meantime. Generated real signed fixtures with the actual production crypto code, verified all 3 pages in an actual Chrome tab including a live tamper test (edited a receipt on disk, watched the second receipt's badge flip to invalid within one poll cycle, no manual refresh) — full writeup in `docs/OUTCOME.md`. Deleted the fixture data/generator afterward so no fake data lingers in the repo's gitignored runtime folders. `npm run build && npm run start` both clean, zero browser console errors.

## Next steps

1. Phase 1c: still blocked until the user provides a real Dodo test-mode account + `.env` with `DODO_API_KEY`/`DODO_API_KEY_READONLY`. Do not mock this — see `CLAUDE.md` § "If you're blocked".
2. Phase 1d remainder: verify `execute()` against one real live webcmd write command the moment B-002 (browser connectivity) is resolved — likely needs the user to fix/configure the Cloak browser bridge on this machine. Until then, don't mark Phase 1d fully ✅.
3. Phase 1h remainder: once Agent A ships Phase 1f, (a) confirm killing the dashboard mid-CLI-run doesn't affect the CLI, (b) wire up `signature_valid` once the gate's public key has a defined home, (c) re-test `/api/mandate`'s balance read against a real `Ledger.fund()`-produced `reserveRef` once B-001 clears, since `lib/dodo.ts`'s resolution logic is currently unverified live.
4. Otherwise, pick up Phase 2-4 stub verification (shared filler work) while B-001/B-002 stay open.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

- `src/webcmd/executor.ts`'s `execute()` has never been run against a real webcmd command — see blocker B-002. The code is a direct match of the spec's sketch, so it's low-risk, but treat it as unverified until a real run happens.
- `ManifestCommand` in `manifest.ts` only types the 3 fields (`site`, `name`, `access`) actually consumed — the real payload has 14 fields per command. If a future phase needs another field (e.g. `columns` for display), extend the interface then rather than speculatively now.
- `dashboard/lib/dodo.ts`'s balance-resolution chain (checkout session → payment → customer → balance) is written against the real SDK's TypeScript types but has never been run against a real account — see B-001. Low confidence it's 100% right until a real `reserveRef` from an actual `Ledger.fund()` call is available to test against.
- `dashboard/lib/read.ts`'s `ChainVerification.signature_valid` is always `null` ("pending") — the gate's public key has no defined persistence location yet (Phase 1f gap, see Notes for Agent A below). `chain_link_valid` is fully real regardless.

## Notes for Agent A

_(Use this section to leave context Agent A should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "Dodo's real balance field turned out to be called X, here's the raw response" type notes, though the authoritative place for that is still docs/OUTCOME.md per CLAUDE.md's existing rule. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

- The real webcmd manifest has 805 commands (228 write), not the spec doc's guessed ~302/~192 — if Phase 1f/1g's demo script assumes a specific count anywhere, it doesn't need to; nothing in the demo script actually hardcodes these numbers, just flagging in case.
- `ledger.jsonl`'s entry shape is now concrete (`{ runId, reserveRef, amountInrPaise, ts }`, see ADR-004) — when you wire `gate run`/`gate fund` in Phase 1f, call `hasAlreadyDrawn(runId)` from `src/webcmd/executor.ts` before `Ledger.draw()`, and `recordDraw(...)` after a successful draw.
- **Gap found while starting Phase 1h (dashboard `/receipts` route):** nothing in the specs (`04-POLICY-ENGINE-SPEC.md`, `01-ARCHITECTURE.md`, `docs/OUTCOME.md` Phase 1e) says where the *gate's own* Ed25519 keypair (the one `buildAndSignReceipt(fields, gatePrivateKey)` signs with — separate from the mandate issuer's key) gets persisted to disk. It has to be persisted somewhere stable across `gate run` invocations, otherwise `gate verify` on an older receipt (Phase 5's rehearsal checklist item) can't work with a freshly-regenerated key. Whatever Phase 1f decides, the dashboard's `/receipts` route needs to read the gate's **public** key independently (it re-implements `verifyChain()`'s logic per `06-DASHBOARD-SPEC.md`'s duplication note, doesn't import `src/`). Not blocking me — `ChainVerification.chain_link_valid` (hash-link check) needs no key at all, so I'm shipping that for real now and marking `signature_valid` as "pending" in the dashboard until this exists. When you land Phase 1f, whatever path/format you pick for the gate's public key, a one-line note back here (or in `08-CHANGELOG.md`) is all I need to wire the last piece up.
