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
| 1b — Policy Engine `decide()` | ✅ Done, tests passing | 1a |
| 1e — Receipts and verify chain | ✅ Done, tests passing | 1a |
| 1f — CLI and two-pane UI | ⏳ Not started | 1a, 1b, 1e, **and Agent B's 1c + 1d** (Sync Point 3) |
| 1g — Full end-to-end run | ⏳ Not started | 1f |

Plus: Phase 2-4 stub verification and Phase 5 rehearsal are shared with Agent B — see `docs/common/05-PHASE-OWNERSHIP.md`.

## Folders/files you own

`src/mandate/`, `src/policy/`, `src/receipt/`, `src/cli/`, `src/events/` (frozen after Phase 0, see `docs/common/03-INTERFACES.md`), plus the repo-wide scaffolding from Phase 0 (`package.json`, `tsconfig.json`, `.env.example`, `src/phase2-4-stubs/*` stub contents).

Never edit `src/ledger/`, `src/webcmd/`, or `dashboard/` without flagging it first per `docs/common/06-SYNC-WORKFLOW.md` — those are Agent B's.

## Current task

Phase 1e is done and about to be pushed. That closes out the sequential track (0 → 1a → 1b → 1e). Next is Phase 1f (CLI + two-pane UI), but `gate run`/`gate fund` specifically need Agent B's 1c/1d (Sync Point 3) — B-001 (`04-BLOCKERS.md`) means Phase 1c is still blocked on a real Dodo account as of this writing. Starting with the CLI subcommands that don't need Agent B's modules: `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify`.

## Status

🔨 In progress (Phase 1f starting, partial — see Current task)

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.
- 2026-07-28 — Phase 0 complete. Full `src/` tree scaffolded per `docs/01-ARCHITECTURE.md`, `tsc --noEmit` and `npm test` both pass clean. Found and fixed two toolchain issues (TS 7 incompatible with `ts-node`, pinned to 5.9.3; `node --test <dir>` fails on this Node version, dropped the path arg) and two spec gaps (`DenyCode` was missing `ALREADY_EXECUTED`; `03-INTERFACES.md`'s `Ledger` ownership row was wrong). Full detail in `docs/OUTCOME.md` Phase 0 entry and `docs/common/08-CHANGELOG.md`. Committed and pushed (`46f8514`).
- 2026-07-29 — Phase 1a complete. `src/mandate/schema.ts` (`Mandate` + `isMandate()` guard), `sign.ts` (`canonicalJSON`/`generateKeyPair`/`sign`/`verify`, matches the spec exactly), `render.ts` (`renderConsent()`, deviated from the spec's plain `.join(', ')` sketch — see below). 9 real tests across `sign.test.ts` (5) and `render.test.ts` (4, added after finding bugs), all passing; `tsc --noEmit` clean. Found and fixed two more real bugs by smoke-testing `renderConsent()` against Beat 2's exact expected sentence: the spec's plain comma-join doesn't match Beat 2's grammatical "a, b or c" wording, and a naive `capitalize()` can't turn `bigbasket` into `BigBasket`. Full detail in `docs/OUTCOME.md` Phase 1a entry. Committed and pushed (`b8e9882`).
- 2026-07-29 — Phase 1b complete. `src/policy/decide.ts` + `decide.test.ts` (11 tests). Found a real, significant rule-order bug: the spec's decide() checked signature/expiry *before* the read-access short-circuit, which would deny a read against an expired/badly-signed mandate — contradicting both `docs/03-WEBCMD-INTEGRATION.md`'s explicit "no signature verification" for reads and the required test's own title ("read access always allows, regardless of mandate state"). Moved read-access to Rule 0. Wrote up the full reasoning as `docs/common/02-DECISIONS.md` ADR-003 (not just a changelog note — this changes a contract). Also widened `SpendRequest.access` to include `undefined` (the original `'read'|'write'`-only type made the `UNKNOWN_COMMAND` check unreachable dead code). Updated `docs/04-POLICY-ENGINE-SPEC.md` to match, per CLAUDE.md's rule-order-change requirement. 20/20 tests passing, `tsc --noEmit` clean. Did NOT implement `rules.ts` — not required by the Phase 1b prompt, left as its Phase 0 stub. Full detail in `docs/OUTCOME.md` Phase 1b entry. Committed, pushed — hit a real merge conflict in `08-CHANGELOG.md` with Agent B (who'd pushed their own Phase 0 sync entry in the meantime), resolved per `06-SYNC-WORKFLOW.md`'s append-only-conflict protocol (kept both entries, ordered by push order). Rebased cleanly, re-verified `tsc --noEmit`/`npm test` after, pushed (`37bf928`).
- 2026-07-29 — Phase 1e complete. `src/receipt/schema.ts` (`Receipt`) and `chain.ts` (`buildAndSignReceipt()`, `verifyReceipt()` from the spec exactly, plus `sha256Hex()`/`verifyChain()` — the spec describes these in prose, no code shown, so their shape here is this phase's own design). 4 tests, all passing, no spec bugs found this time. Also synced `01-PROJECT-STATUS.md`'s 1c/1d table rows to match what Agent B had already written in their own status section (table was getting stale — I didn't invent anything, just propagated). Full detail in `docs/OUTCOME.md` Phase 1e entry. About to commit and push, then start Phase 1f.

## Next steps

1. Commit and push Phase 1e.
2. Phase 1f: `src/cli/gate.ts` + `src/cli/ui.ts`, per `docs/05-DEMO-SCRIPT.md` and `docs/PROMPTS.md` Phase 1f. Build in dependency order — start with `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify` (need only 1a/1b/1e, already done). Do NOT start `gate run`/`gate fund` until Agent B's 1c/1d are pushed and their manual test scripts pass locally (Sync Point 3, `docs/common/07-INTEGRATION.md`) — check `04-BLOCKERS.md`/`01-PROJECT-STATUS.md` each session for whether B-001 has cleared.
3. Phase 1g (full end-to-end run) after 1f is complete, per `docs/common/05-PHASE-OWNERSHIP.md`.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

- TypeScript is pinned to `5.9.3`, not the `^7.x` `npm install typescript` would resolve to today, because `ts-node@10.9.2` doesn't support TS 7's new native compiler yet (`ts.sys` is undefined). If `ts-node` ships TS 7 support later, this pin can be revisited — not urgent, current setup works cleanly.
- `render.ts`'s `BRAND_NAMES` lookup only covers `blinkit`/`zepto`/`bigbasket`/`district`. A merchant added later that isn't in this table and has an internal capital in its brand name (like `bigbasket` did) will render wrong via the `capitalize()` fallback. Not a blocker — just remember to extend the table if the demo ever adds a merchant.
- `src/policy/rules.ts` is still just its Phase 0 comment stub — not populated in Phase 1b, since nothing currently needs the "rule table as data" decomposition `01-ARCHITECTURE.md` describes for it. If Phase 1f's CLI later wants a friendlier rule-name lookup for display, that's the natural point to fill it in.

## Notes for Agent B

_(Use this section to leave context Agent B should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "I picked a ULID library approach for mandate_id, here's why" type notes. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

_(none yet)_
