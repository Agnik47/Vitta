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

Phase 1h (dashboard) is done, for real. Agent A's Phase 1f resolved the gate-key gap this session flagged — pulled it and wired up the dashboard's `signature_valid` for real the same day (see `docs/OUTCOME.md`). Also committed a real `manifest.json` per Agent A's request. Only two Phase 1h items remain open, both genuinely external: the Dodo balance chain (unverified live, B-001) and the CLI-kill-mid-run test (needs Phase 1g/1c to exist). Phase 1c remains blocked on a real Dodo account (B-001). Phase 1d's `execute()` remains blocked on the browser connectivity issue (B-002) — `manifest.ts` is done and real-tested. Per the workflow correction from the user: this track works its own assigned phases (1c, 1d, 1h) on its own pace and does not wait on or absorb Agent A's phases, regardless of Agent A's progress.

## Status

⚠️ Phase 1h done, only 2 external items remain (B-001-dependent balance check, Phase 1g-dependent kill test) — Phase 1d partial (manifest.ts ✅, execute() blocked on B-002) — Phase 1c blocked on B-001

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-29 — Agent A pushed real Phase 0 (`46f8514`) while this session had independently drafted a duplicate local scaffold (uncommitted). Caught it via `git fetch` before pushing — discarded the local duplicate entirely, pulled Agent A's version, confirmed `tsc --noEmit` and `npm test` both pass clean on this machine too. Added `TASKS.md`, `ROADMAP.md`, `ERROR-HANDLING.md` to this folder per user request. Now starting real Phase 1d work (webcmd install, self-serve) and flagging Phase 1c's Dodo-account blocker to the user.
- 2026-07-29 — Installed `@agentrhq/webcmd@0.4.3` globally. `webcmd doctor` fails its Connectivity check (browser exec timeout) — daemon and Cloak runtime both report OK, but no browser-backed command has ever succeeded on this machine (confirmed via `webcmd profile list`). Manifest fetch (`webcmd list -f json`) is unaffected and works fine (805 real commands, 228 write-access). Implemented `src/webcmd/manifest.ts` for real, ran the required manual checks for real (write count, `blinkit/place-order` lookup, nonsense-command fail-closed check, plus the live-fetch-fails-falls-back-to-cache path) — all pass, pasted into `docs/OUTCOME.md`. Implemented `src/webcmd/executor.ts`'s `execute()` per spec (unverified — can't run a real command until B-002 clears) plus `hasAlreadyDrawn()`/`recordDraw()` idempotency guard against `ledger.jsonl` (real-tested, pure fs logic — see ADR-004 in `02-DECISIONS.md` for the entry-shape decision). Logged blocker B-002. `tsc --noEmit` and `npm test` (10/10) both still clean.
- 2026-07-29 — Phase 1h (dashboard): Sync Point 4 opened once Agent A shipped 1b+1e, so built the whole thing in one session. Scaffolded Next.js 16.2.12 at `dashboard/`, implemented all 3 API routes + 3 pages + `lib/{types,hash,read,dodo}.ts` per `docs/06-DASHBOARD-SPEC.md`. Found the real Dodo SDK's balance model is customer-keyed, not session-keyed as the spec sketch assumed — see `docs/OUTCOME.md`'s open-questions table for the full real-type writeup; `lib/dodo.ts` implements the real resolution chain, marked unverified-live pending B-001. Found the gate's public-key persistence location is undefined (Phase 1f gap) — flagged below, shipped `chain_link_valid` for real and `signature_valid` as "pending" in the meantime. Generated real signed fixtures with the actual production crypto code, verified all 3 pages in an actual Chrome tab including a live tamper test (edited a receipt on disk, watched the second receipt's badge flip to invalid within one poll cycle, no manual refresh) — full writeup in `docs/OUTCOME.md`. Deleted the fixture data/generator afterward so no fake data lingers in the repo's gitignored runtime folders. `npm run build && npm run start` both clean, zero browser console errors.
- 2026-07-29 — Pulled Agent A's Phase 1f (`src/cli/keys.ts`, 5/7 `gate` subcommands real, 4 real bugs fixed, `manifest.json` un-gitignored). Committed the real `manifest.json` (805/228) as requested — `gate scan` can now be tested against real data on Agent A's machine too. Wired up the dashboard's `signature_valid` same day: added `verifySignature()` to `dashboard/lib/hash.ts` (duplicate of `src/mandate/sign.ts`'s `verify()`) and `loadGatePublicKeyPem()` to `dashboard/lib/read.ts` (reads `keys/gate.public.pem` via `MANDATE_GATE_DATA_DIR`, returns `null` gracefully if absent), `verifyChainLocal()` now takes the key and computes real signature checks. Verified for real: bootstrapped a local `keys/gate.*.pem` via the actual `getOrCreateKeyPair('gate')` (not a mock), signed real fixture receipts with it, confirmed `/api/receipts` shows real `signature_valid: true/false`, then repeated the tamper test watching all four signals — tampered receipt's own signature flipped false while its chain-link stayed true, untouched receipt's signature stayed true while its chain-link flipped false. Exactly the Beat 7 distinction, now with real crypto both ways. Deleted the bootstrapped key + fixtures afterward. `tsc --noEmit` clean on both `dashboard/` and root; `npm test` 45/45 (Agent A's new tests included).

## Next steps

1. Phase 1c: still blocked until the user provides a real Dodo test-mode account + `.env` with `DODO_API_KEY`/`DODO_API_KEY_READONLY`. Do not mock this — see `CLAUDE.md` § "If you're blocked".
2. Phase 1d remainder: verify `execute()` against one real live webcmd write command the moment B-002 (browser connectivity) is resolved — likely needs the user to fix/configure the Cloak browser bridge on this machine. Until then, don't mark Phase 1d fully ✅.
3. Phase 1h remainder (both genuinely external now): (a) confirm killing the dashboard mid-CLI-run doesn't affect the CLI — needs Phase 1g to exist; (b) re-test `/api/mandate`'s balance read against a real `Ledger.fund()`-produced `reserveRef` once B-001 clears, since `lib/dodo.ts`'s resolution logic is currently unverified live.
4. Otherwise, pick up Phase 2-4 stub verification (shared filler work, Agent A already started) while B-001/B-002 stay open — check in with `docs/common/01-PROJECT-STATUS.md` first to avoid duplicating what Agent A's already covered.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

- `src/webcmd/executor.ts`'s `execute()` has never been run against a real webcmd command — see blocker B-002. The code is a direct match of the spec's sketch, so it's low-risk, but treat it as unverified until a real run happens.
- `ManifestCommand` in `manifest.ts` only types the 3 fields (`site`, `name`, `access`) actually consumed — the real payload has 14 fields per command. If a future phase needs another field (e.g. `columns` for display), extend the interface then rather than speculatively now.
- `dashboard/lib/dodo.ts`'s balance-resolution chain (checkout session → payment → customer → balance) is written against the real SDK's TypeScript types but has never been run against a real account — see B-001. Low confidence it's 100% right until a real `reserveRef` from an actual `Ledger.fund()` call is available to test against.

## Notes for Agent A

_(Use this section to leave context Agent A should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "Dodo's real balance field turned out to be called X, here's the raw response" type notes, though the authoritative place for that is still docs/OUTCOME.md per CLAUDE.md's existing rule. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

- The real webcmd manifest has 805 commands (228 write), not the spec doc's guessed ~302/~192 — if Phase 1f/1g's demo script assumes a specific count anywhere, it doesn't need to; nothing in the demo script actually hardcodes these numbers, just flagging in case.
- `ledger.jsonl`'s entry shape is now concrete (`{ runId, reserveRef, amountInrPaise, ts }`, see ADR-004) — when you wire `gate run`/`gate fund` in Phase 1f, call `hasAlreadyDrawn(runId)` from `src/webcmd/executor.ts` before `Ledger.draw()`, and `recordDraw(...)` after a successful draw.
- **RESOLVED 2026-07-29** — the gate-keypair gap flagged above is fixed by your `src/cli/keys.ts` (`keys/gate.public.pem`, read via `MANDATE_GATE_DATA_DIR`). Dashboard's `/receipts` route now computes real `signature_valid`, verified against a bootstrapped keypair via your actual `getOrCreateKeyPair()`. Thanks for the clean design — no new config surface needed, exactly as your comment promised.
- One thing worth double-checking on your side when `gate run` first produces a real receipt: my `verifySignature()` in `dashboard/lib/hash.ts` destructures `const { sig, ...unsigned } = receipt` and verifies `unsigned` against `sig` — this matches `verifyReceipt()` in `src/receipt/chain.ts` exactly (`const { sig, ...rest } = receipt; return verify(rest, sig, gatePublicKey)`), so it should agree, but I've only tested it against my own bootstrapped fixtures, not a receipt your CLI actually produced end to end.
