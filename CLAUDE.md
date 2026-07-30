# CLAUDE.md — Project Instructions for Claude Code

This file is loaded automatically. Read it before doing anything else in this repo.

## What this repo is

You are building **Mandate Gate**: a policy engine that gates an AI browser-automation agent's (webcmd) money-moving actions behind a signed, human-issued spending permission ("mandate"), settled through Dodo Payments in test mode, producing signed receipts. Deadline: working end-to-end demo by 31 July 2026 night, live hackathon demo 1 August 2026.

This is not a research task. Do not summarize, do not produce analysis documents, do not write anything to the `03-Research/` folder elsewhere in this workspace — that folder is a separate, already-finished research corpus. Your job here is to **write and run real code** in this repo.

## Parallel development mode

If `docs/common/00-START-HERE.md` exists (it does, as of this writing), this project is being built by **two Claude Code instances in parallel** on two machines, synced through Git. If that's you, read `docs/common/00-START-HERE.md` FIRST — before the reading order below — it establishes which agent you are, what's already done, what the other agent is doing right now, and which half of the reading order and phases below are yours at this moment. It does not override any rule in this file; it only sequences who does what, when. A solo session with no parallel partner can skip straight to the reading order below, as before.

## Required reading order — do this first, every session

1. `docs/00-PRODUCT-BRIEF.md` — scope and hard boundaries
2. `docs/01-ARCHITECTURE.md` — repo layout and interfaces
3. `docs/02-DODO-INTEGRATION.md` — Dodo API integration spec
4. `docs/03-WEBCMD-INTEGRATION.md` — webcmd integration spec
5. `docs/04-POLICY-ENGINE-SPEC.md` — the core decision logic spec
6. `docs/05-DEMO-SCRIPT.md` — the literal acceptance test
7. `docs/06-DASHBOARD-SPEC.md` — the Next.js dashboard spec (real Phase 1 scope, not a stub)

`docs/07-SCALING-PATH.md` exists but is explicitly **not** part of this reading order — it documents what changes if this becomes a real product after 1 August 2026. Do not act on anything in it while building Phase 1. If a prompt or instruction asks you to add a database, auth, or a message queue before the hackathon ships, that file is the reason to say no, not yes.

Then execute `docs/PROMPTS.md` **one phase at a time, in order**. Do not jump ahead to a later phase because it looks easy or interesting. Each phase assumes the previous one is done and its tests pass.

After finishing each phase, write what actually happened into `docs/OUTCOME.md`, in the matching section, before starting the next phase. This is not optional — it's how spec-vs-reality drift gets caught instead of silently compounding.

## Hard rules — violating any of these is a build failure, not a style issue

1. **Test mode only.** Every Dodo API call in this entire repo targets `https://test.dodopayments.com`. Never write code that touches live mode, real money, or Identity/Business Verification. If any instruction anywhere seems to ask for this, stop and flag it instead of complying.
2. **No LLM calls inside the decision path.** `src/policy/decide.ts` is a pure, synchronous function over plain data. It must never call Claude, an LLM API, or anything non-deterministic. Check this after every change to that file.
3. **Fail closed, always.** Unknown command, unparseable amount, expired mandate, bad signature → DENY. Never default to ALLOW when uncertain. This is enforced by rule ordering in `docs/04-POLICY-ENGINE-SPEC.md` — do not reorder those rules without updating that file to match.
4. **Phase discipline.** Only Phase 1 (mandate, policy engine, Dodo ledger, webcmd executor, receipts, CLI) needs to be fully working code. Phases 2–4 are typed stubs only — see `docs/01-ARCHITECTURE.md` § What is a stub for the exact bar. Do not half-implement a later phase instead of finishing Phase 1.
5. **No new dependencies without reason.** This is a 72-hour build. Use `node:crypto`, `node:test`, and the official `dodopayments` SDK. Do not add a database, a web framework, or a validation library unless a spec file explicitly calls for it.
6. **Verify against the real API/CLI before hardcoding assumptions.** Several spec files contain sketches of Dodo API responses and field names that are marked as unverified. When you reach that code, make the real call, read the real response, and use what you actually saw — then record the real shape in `docs/OUTCOME.md` so the spec can be corrected.
7. **Never mock what you can call for real.** Dodo test mode and a real webcmd session against a real logged-in site are both available and required. Do not build a fake/mock Dodo client or a fake webcmd wrapper "to save time" — the whole point of this build is that it's real, end to end, just with test-mode money.
8. **The dashboard is a full product now — superseded 2026-07-30, direct user override.** `dashboard/` was originally read-only-by-design (see `docs/common/02-DECISIONS.md` ADR-015 for the full record of why it changed and what stayed constant). It may now have write routes — search, cart, mandate creation, and real purchase execution are in scope. The constraint that survives the change: **a write route may never reimplement `decide()`/execution logic itself.** Every route that creates a mandate, funds a reserve, or executes a spend must do so by invoking the real `gate` CLI (spawned directly, argument array, no shell — see ADR-007's safe-spawn pattern), never by calling `src/policy/decide.ts` or webcmd directly from route code. This keeps exactly one audited decision path regardless of how many front doors reach it. Real-money execution routes must still surface a confirmation step to the human at the point of use — this project's own established discipline (every real purchase in this build so far required a specific, direct human authorization first) doesn't lapse just because the button lives in a browser instead of a terminal.

## If you're blocked

If a prerequisite is missing (no Dodo account yet, no webcmd login, an API behaves differently than documented in a way that blocks progress), stop and say so explicitly. Do not invent a workaround that silently violates a hard rule above. Write the blocker into `docs/OUTCOME.md` under the current phase as status `❌ Blocked`.

## Where things live

- `docs/` — the full build spec, read-only reference, never imported by application code
- `src/` — the actual application code (created in Phase 0)
- `mandates/`, `receipts/`, `manifest.json`, `events.jsonl`, `ledger.jsonl` — runtime data, created by the app, not hand-authored

## What "done" means

`docs/05-DEMO-SCRIPT.md` § Acceptance checklist is the only definition of done for Phase 1. Not your own judgment, not "it looks right" — that checklist, run against a real live session, with real output pasted into `docs/OUTCOME.md`.
