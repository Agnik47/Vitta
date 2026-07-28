# Agent A — Roadmap

Milestones against the hackathon deadline (working demo by 2026-07-31 night, live demo 2026-08-01). Update the "where we actually are" section every session — this file is a milestone map, not a task-by-task log (that's `TASKS.md`; narrative detail is `WORKSPACE.md`'s progress log).

## Milestones

| # | Milestone | Depends on | Target | Status |
|---|---|---|---|---|
| M1 | Repo scaffolded, `tsc --noEmit` clean | — | Day 1 morning | ✅ Done (2026-07-28) |
| M2 | Mandate signing proven (sign/verify/tamper tests pass) | M1 | Day 1 | ✅ Done (2026-07-29) |
| M3 | `decide()` proven correct, including rule order | M2 | Day 1 | ✅ Done (2026-07-29) — found and fixed a real rule-order bug, see ADR-003 |
| M4 | Receipt chain proven (tamper test breaks the right thing) | M2 | Day 1-2 | ✅ Done (2026-07-29) |
| M5 | `gate` CLI runs every subcommand that doesn't need Agent B's Ledger/webcmd | M2, M3, M4, Agent B's `manifest.ts` | Day 2 | 🔨 In progress |
| M6 | `gate run`/`gate fund` wired against a real `Ledger` | M5, **Agent B's Phase 1c (blocked on B-001)** | Day 2-3 | ⏳ Blocked — not on Agent A's side |
| M7 | Full Beat 1-8 end-to-end run, timed, real | M6, **B-002 resolved** (webcmd browser connectivity) | Day 3 | ⏳ Blocked |
| M8 | Demo rehearsed 3x under 4 minutes, fallback recording made | M7, Agent B's 1h (done) | Day 3, before 31 Jul night | ⏳ Not started |
| M9 | Live hackathon demo | M8 | 2026-08-01 | ⏳ Not started |

## Where we actually are (update every session)

**As of 2026-07-29 (Phase 1f done, partial by necessity):** M1-M5 done. `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify`, and `src/cli/ui.ts` are all real, run, and verified against real signed data (including the full Beat 7 tamper test). Also resolved the gate-keypair-persistence gap Agent B flagged during Phase 1h, and found/fixed 4 more real bugs along the way (time formatting, currency formatting, a `.gitignore` mistake blocking `gate scan` from ever being testable on this machine, plus Phase 1b's rule-order fix from earlier). Full detail in `docs/OUTCOME.md` and `docs/common/08-CHANGELOG.md`.

M6 (`gate run`/`gate fund`) is now confirmed, not just anticipated, to be fully blocked on Agent B's Phase 1c (B-001) — `src/ledger/Ledger.ts` genuinely doesn't exist as code yet, so there's nothing for the CLI to wire against. Both subcommands exist as honest "not available" dispatcher cases rather than silently absent or faked. M7 additionally needs B-002 (webcmd browser connectivity) resolved.

**Critical path risk, sharpened:** B-001 is no longer just blocking Agent B's Phase 1c — it now blocks Phase 1g on Agent A's side too, since M6/M7 can't start without it. The two tracks' remaining real work has converged on the same single external blocker (a Dodo test-mode account). If this isn't cleared soon, essentially nothing money-moving-related can progress on either side regardless of how complete each track's own code is. This isn't a new risk, just confirmed and sharper than the earlier note below.

**What's NOT blocked and worth prioritizing given the above:** the full unit test suite is now at 45 tests across mandate/policy/receipt/cli, the dashboard is done, all CLI subcommands that don't need Ledger/webcmd are done — what's left that doesn't need B-001/B-002 is Phase 2-4 stub verification (picking this up next) and continuing to harden/rehearse what already exists. M6/M7 are now a fully-scoped, well-understood integration task waiting on exactly one external prerequisite, not an open-ended one.
