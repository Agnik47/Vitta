# Agent A — Roadmap

Milestones against the hackathon deadline (working demo by 2026-07-31 night, live demo 2026-08-01). Update the "where we actually are" section every session — this file is a milestone map, not a task-by-task log (that's `TASKS.md`; narrative detail is `WORKSPACE.md`'s progress log).

## Milestones

| # | Milestone | Depends on | Target | Status |
|---|---|---|---|---|
| M1 | Repo scaffolded, `tsc --noEmit` clean | — | Day 1 morning | ✅ Done (2026-07-28) |
| M2 | Mandate signing proven (sign/verify/tamper tests pass) | M1 | Day 1 | ✅ Done (2026-07-29) |
| M3 | `decide()` proven correct, including rule order | M2 | Day 1 | ✅ Done (2026-07-29) — found and fixed a real rule-order bug, see ADR-003 |
| M4 | Receipt chain proven (tamper test breaks the right thing) | M2 | Day 1-2 | ✅ Done (2026-07-29) |
| M5 | `gate` CLI runs every subcommand that doesn't need Ledger/webcmd | M2, M3, M4, Agent B's `manifest.ts` | Day 2 | ✅ Done (2026-07-29) |
| M6 | `gate run`/`gate fund` wired against a real `Ledger` | M5, **Phase 1c — now Agent A's own phase (ADR-005), blocked on B-001** | Day 2-3 | ⏳ Blocked — real Dodo account confirmed to exist, keys/Product/Credit-Entitlement-ID still needed |
| M7 | Full Beat 1-8 end-to-end run, timed, real | M6, **B-002 resolved** (webcmd browser connectivity) | Day 3 | ⏳ Blocked |
| M8 | Demo rehearsed 3x under 4 minutes, fallback recording made | M7, Agent B's 1h (done) | Day 3, before 31 Jul night | ⏳ Not started |
| M9 | Live hackathon demo | M8 | 2026-08-01 | ⏳ Not started |

## Where we actually are (update every session)

**As of 2026-07-29 (Phase 1c reassigned, ADR-005):** M1-M5 done, Phase 2-4 stub verification also done. Per direct user instruction, Phase 1c (Dodo Payments integration, `src/ledger/`) moved from Agent B to Agent A — B-002 would keep blocking Agent B on webcmd execution even after B-001 clears, while the ledger has zero webcmd dependency and can unblock independently. Full ownership-change reasoning in `docs/common/02-DECISIONS.md` ADR-005.

User confirmed a real Dodo test-mode account exists (shared a Promotions-tab screenshot) — but it showed a $1,000 *fee-waiver* promotion, not spendable credit, and doesn't complete what's actually needed: `DODO_API_KEY`, `DODO_API_KEY_READONLY`, a test-mode "Agent Spend Credits" Product, and that Product's Credit Entitlement ID. Asked the user for these directly. This finding closed a long-open spec question (`docs/OUTCOME.md`'s open-questions table) — worth knowing this promotion exists and isn't a shortcut, in case it comes up again later.

**Critical path risk, unchanged in substance, now owned by Agent A instead of split across two agents:** M6/M7 wait on B-001 (Dodo credentials) and, for M7 specifically, B-002 (Agent B's webcmd browser connectivity, machine-specific, not fixable from this side). Real account confirmed — genuine progress — but the specific keys/Product/Credit-Entitlement-ID are still outstanding.

**What's NOT blocked and worth prioritizing while waiting:** the full unit test suite (45 tests), the dashboard (done), all CLI subcommands that don't need Ledger/webcmd (done). M6 is a fully-scoped, well-understood task the moment credentials land — Agent B already did the hard research (real SDK method names, the customer-keyed balance model) so this isn't starting from the spec's guesses.
