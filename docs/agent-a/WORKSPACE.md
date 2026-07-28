# Agent A — Workspace

Read `docs/common/00-START-HERE.md` before this file, every session, if you haven't already this session.

## Role

You own the **pure-logic-and-integration chain**: Mandate → Policy Engine → Receipts → CLI/UI → the end-to-end acceptance run. This is the sequential backbone of Phase 1 — each of your phases imports from the one before it, which is why it's one continuous track rather than split further. See `docs/common/05-PHASE-OWNERSHIP.md` for the full rationale, and `docs/common/02-DECISIONS.md` ADR-002 for why this split beats a 50/50 one.

You also default-own **Phase 0** (whole-repo scaffolding) — see that file's Sync Point 1 for the exception case.

## Phases you own

| Phase | Status | Depends on |
|---|---|---|
| 0 — Scaffolding | ✅ Done, tests passing | none |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | ✅ Done, tests passing | Phase 0 |
| 1b — Policy Engine `decide()` | 🔨 In progress | 1a |
| 1e — Receipts and verify chain | ⏳ Not started | 1a |
| 1f — CLI and two-pane UI | ⏳ Not started | 1a, 1b, 1e, **and Agent B's 1c + 1d** (Sync Point 3) |
| 1g — Full end-to-end run | ⏳ Not started | 1f |

Plus: Phase 2-4 stub verification and Phase 5 rehearsal are shared with Agent B — see `docs/common/05-PHASE-OWNERSHIP.md`.

## Folders/files you own

`src/mandate/`, `src/policy/`, `src/receipt/`, `src/cli/`, `src/events/` (frozen after Phase 0, see `docs/common/03-INTERFACES.md`), plus the repo-wide scaffolding from Phase 0 (`package.json`, `tsconfig.json`, `.env.example`, `src/phase2-4-stubs/*` stub contents).

Never edit `src/ledger/`, `src/webcmd/`, or `dashboard/` without flagging it first per `docs/common/06-SYNC-WORKFLOW.md` — those are Agent B's.

## Current task

Phase 1a is done and about to be pushed. Starting Phase 1b next: `decide()`, per `docs/04-POLICY-ENGINE-SPEC.md` § The decide() function — the single most important function in the codebase. Rule order (0 through 8) is load-bearing for the demo script; build the full rule-table test suite (`decide.test.ts`) before considering this phase done, including the rule-order test (bad signature beats expired, per `docs/PROMPTS.md` Phase 1b).

## Status

🔨 In progress (Phase 1b starting)

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-28 — Phase 0 complete. Full `src/` tree scaffolded per `docs/01-ARCHITECTURE.md`, `tsc --noEmit` and `npm test` both pass clean. Found and fixed two toolchain issues (TS 7 incompatible with `ts-node`, pinned to 5.9.3; `node --test <dir>` fails on this Node version, dropped the path arg) and two spec gaps (`DenyCode` was missing `ALREADY_EXECUTED`; `03-INTERFACES.md`'s `Ledger` ownership row was wrong). Full detail in `docs/OUTCOME.md` Phase 0 entry and `docs/common/08-CHANGELOG.md`. Committed and pushed (`46f8514`).
- 2026-07-29 — Phase 1a complete. `src/mandate/schema.ts` (`Mandate` + `isMandate()` guard), `sign.ts` (`canonicalJSON`/`generateKeyPair`/`sign`/`verify`, matches the spec exactly), `render.ts` (`renderConsent()`, deviated from the spec's plain `.join(', ')` sketch — see below). 9 real tests across `sign.test.ts` (5) and `render.test.ts` (4, added after finding bugs), all passing; `tsc --noEmit` clean. Found and fixed two more real bugs by smoke-testing `renderConsent()` against Beat 2's exact expected sentence: the spec's plain comma-join doesn't match Beat 2's grammatical "a, b or c" wording, and a naive `capitalize()` can't turn `bigbasket` into `BigBasket`. Full detail in `docs/OUTCOME.md` Phase 1a entry. About to commit and push, then start Phase 1b.

## Next steps

1. Commit and push Phase 1a.
2. Phase 1b: `src/policy/decide.ts` and `rules.ts`, plus the full rule-table test suite in `decide.test.ts` (read/unknown-command/expired/bad-signature-beats-expired/over-per-txn/over-total-cap/merchant-not-allowed/txn-limit/happy-path — per `docs/PROMPTS.md` Phase 1b). Zero I/O in `decide()` itself — `ledgerBalanceInr` and `txnCountSoFar` are caller-supplied plain numbers.
3. Phase 1e after that, per `docs/common/05-PHASE-OWNERSHIP.md`.
4. At Sync Point 3 (before 1f), confirm Agent B's 1c and 1d are pushed and their manual test scripts pass locally for you (`docs/common/07-INTEGRATION.md`) before wiring the CLI's `gate run` / `gate fund` subcommands. The signature-only subcommands (`gate mandate create/resign`, `gate receipt show`, `gate verify`) can be built earlier if you're waiting.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

- TypeScript is pinned to `5.9.3`, not the `^7.x` `npm install typescript` would resolve to today, because `ts-node@10.9.2` doesn't support TS 7's new native compiler yet (`ts.sys` is undefined). If `ts-node` ships TS 7 support later, this pin can be revisited — not urgent, current setup works cleanly.
- `render.ts`'s `BRAND_NAMES` lookup only covers `blinkit`/`zepto`/`bigbasket`/`district`. A merchant added later that isn't in this table and has an internal capital in its brand name (like `bigbasket` did) will render wrong via the `capitalize()` fallback. Not a blocker — just remember to extend the table if the demo ever adds a merchant.

## Notes for Agent B

_(Use this section to leave context Agent B should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "I picked a ULID library approach for mandate_id, here's why" type notes. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

_(none yet)_
