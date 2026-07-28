# 07 — Integration Workflow

Both of you are building one product. `06-SYNC-WORKFLOW.md` covers the git mechanics; this file covers the points where your two tracks actually combine, how to verify they combine correctly, and how to avoid regressing something that already worked. Live status for each checkpoint below lives in `01-PROJECT-STATUS.md`'s Integration & Merge Readiness table — update that table as you clear each one.

## The integration checkpoints

These are the same events as the Sync Points in `05-PHASE-OWNERSHIP.md` — this section adds the "how to verify compatibility" and "how to avoid regressions" detail for each one.

**Sync Point 1 (Phase 0 → both tracks):** Compatibility check = `tsc --noEmit` passes with the full scaffolded skeleton in place, per `docs/PROMPTS.md` Phase 0's own instruction. Whoever pulls this should re-run `tsc --noEmit` themselves before writing new code, not just trust that it passed on the other machine — environment differences (Node version, global installs) are exactly what this catches early.

**Sync Point 3 (1c+1d → 1f):** Before Agent A starts wiring `src/cli/gate.ts` against `src/ledger` and `src/webcmd`, run Agent B's own manual test scripts from `docs/PROMPTS.md` Phase 1c and 1d locally (the integration script hitting the real Dodo API, and the manifest-loading test script) — not just read that they passed. This catches "works on my machine" gaps (missing `.env` values, a different webcmd login state) before they're buried inside CLI wiring bugs, where they're much more expensive to isolate.

**Sync Point 4 (1b+1e → 1h data routes):** Before Agent B writes the dashboard's API routes, run `src/policy/decide.test.ts` and `src/receipt`'s chain tests locally to confirm the schemas about to be read (`Mandate`, `Receipt`) match expectations. The dashboard re-implements chain-verification logic independently (per `docs/06-DASHBOARD-SPEC.md`'s deliberate-duplication note) — if the local reimplementation and Agent A's `verifyReceipt()` ever disagree on a real receipt file, that's a bug in one of them, not an acceptable discrepancy. Cross-check against a real receipt Agent A has generated, not a hand-built fixture.

**Sync Point 5 (1f → 1g):** The full end-to-end run (`docs/05-DEMO-SCRIPT.md` Beats 1-8) is the actual integration test for the entire backend. Nothing before this point has proven the modules work *together* against real webcmd + real Dodo — unit tests prove each piece works in isolation. `1f` is not done until `1g` has run at least once for real, per `docs/PROMPTS.md`'s own phase ordering.

**Sync Point 7 (1g + 1h → Phase 5 rehearsal):** The full-system integration test, and the one place the two of you (or the user driving both halves) must be in the same session at the same time, not just synchronized async. Concretely verify, per `docs/06-DASHBOARD-SPEC.md`'s own acceptance checklist:
- The dashboard shows real data written by a real CLI run — not two different mock states that happen to look similar.
- Killing the dashboard process mid-demo does not affect the CLI's `gate run` sequence. Actually kill it and continue the CLI demo, don't just reason that it should be fine.
- The tamper test (`docs/05-DEMO-SCRIPT.md` Beat 7) performed on a receipt file flips the dashboard's `/receipts` status to invalid, live, without a manual refresh — this exercises the dashboard's file-polling path against a real filesystem change, not a simulated one.

## Regression avoidance

- Whenever you touch anything in `03-INTERFACES.md`'s registry (even an "additive" change), re-run the tests for every phase downstream of that contract before pushing — not just the phase you're currently working on. E.g., a `Mandate` field addition means re-running `decide.test.ts` and the receipt chain tests, not just `sign.test.ts`.
- Before declaring any phase done in `docs/OUTCOME.md`, re-run that phase's own acceptance criteria from `docs/PROMPTS.md` one more time on a clean pull — not the state you were iterating against mid-session, which may have accumulated local-only fixes you forgot to commit.
- If `1g`'s end-to-end run surfaces a bug in a module that was previously marked `✅ Done, tests passing` in `01-PROJECT-STATUS.md`, that phase's status reverts to `🔨 In progress` until it's re-verified.
- The two tracks' only real coupling point in running code is `src/cli/gate.ts` importing both `src/ledger` and `src/webcmd`. If a bug shows up there, check both sides' unit tests still pass in isolation before assuming the bug is in the wiring — it narrows down where to actually look.

## What integration testing is *not*, in this project

Per `CLAUDE.md` rule 7, neither of you builds a mock of the other's module to test against ("Never mock what you can call for real"). Agent A does not stub out `Ledger`/webcmd to unblock `1f` before `1c`/`1d` are real — that's exactly what Sync Point 3 exists to prevent. If you're blocked waiting on the other agent's real module, work on something else (see `05-PHASE-OWNERSHIP.md`'s Sync Point 3 note on filler work) rather than building a fake version of their work to route around the wait.
