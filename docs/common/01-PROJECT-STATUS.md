# 01 — Project Status (Live)

The current state of the world, at a glance. Update your own section every time you sync (see `00-START-HERE.md`). Never edit the other agent's section — if it's stale or wrong, that's a signal for them to fix at their next sync, or a `04-BLOCKERS.md` entry if it's actively blocking you.

**Last updated:** 2026-07-29, Agent A (Phase 1b complete)

---

## At a glance

- **Completed:** Phase 0 (scaffolding), Phase 1a (mandate schema, canonical JSON, Ed25519 sign/verify, renderConsent), Phase 1b (`decide()`).
- **Active:** Agent A starting Phase 1e (receipts and verify chain). Agent B still to start Phase 1c/1d (Phase 0 has been available to pull since 2026-07-28).
- **Pending:** Phases 1e-1h, 2-4, 5.
- **Project health:** 🟢 On track, but one important flag: Phase 1b found and fixed a real rule-order bug in `decide()` (read-access now fires before signature/expiry, not after — see `02-DECISIONS.md` ADR-003). If you last read `04-POLICY-ENGINE-SPEC.md` or `03-INTERFACES.md` before 2026-07-29, re-check the `decide()` rule order before relying on it from memory. Other findings so far (all resolved, logged in `docs/OUTCOME.md`): 2 toolchain issues in Phase 0, `DenyCode` missing `ALREADY_EXECUTED`, `renderConsent()`'s merchant-list join not matching the demo script's exact wording. Nothing currently blocked.

## Overall phase progress

Mirrors the phase list in `docs/PROMPTS.md`. Status values: `⏳ Not started` · `🔨 In progress` · `✅ Done, tests passing` · `❌ Blocked`.

| Phase | Owner | Status | Notes |
|---|---|---|---|
| 0 — Scaffolding | Agent A | ✅ Done, tests passing | `tsc --noEmit` + `npm test` both pass. See `docs/OUTCOME.md` for 2 deviations (GateEvent.ts written for real, DenyCode gained ALREADY_EXECUTED) and 2 toolchain findings (TS pinned to 5.9.3, test script drops the path arg). |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | Agent A | ✅ Done, tests passing | 9/9 real tests pass (5 required + 4 for a `renderConsent()` deviation, see `docs/OUTCOME.md`). |
| 1b — Policy Engine `decide()` | Agent A | ✅ Done, tests passing | 20/20 tests pass. Real rule-order bug found and fixed — see `02-DECISIONS.md` ADR-003. |
| 1c — Dodo Payments integration | Agent B | ⏳ Not started | |
| 1d — webcmd integration | Agent B | ⏳ Not started | |
| 1e — Receipts and verify chain | Agent A | 🔨 In progress | |
| 1f — CLI and two-pane UI | Agent A | ⏳ Not started | Needs 1a,1b,1c,1d,1e (see `05-PHASE-OWNERSHIP.md` for partial-start nuance) |
| 1g — Full end-to-end run | Agent A | ⏳ Not started | Needs 1f |
| 1h — Dashboard (Next.js) | Agent B | ⏳ Not started | Needs 1b + 1e; shell/scaffold can start earlier |
| 2-4 — Stub verification | Either | ⏳ Not started | Filler work — good to pick up while waiting on the other agent |
| 5 — Demo rehearsal | Both | ⏳ Not started | Joint session, not solo |

**A phase's `✅` reverts to `🔨 In progress` if a later integration run (Sync Point 5 or 7, see `07-INTEGRATION.md`) surfaces a bug in it. Don't leave a stale ✅ next to code that's since been proven wrong.**

## Integration & merge readiness

One row per Sync Point from `05-PHASE-OWNERSHIP.md` / `07-INTEGRATION.md`. This is the live tracker; those files describe the process each row follows.

| Sync Point | What it gates | Ready? | Blocking issue |
|---|---|---|---|
| 1 — Phase 0 → both tracks | Agent B starting any code | ✅ Ready | Phase 0 pushed — `tsc --noEmit` clean, `npm test` passes. Agent B: pull before writing any code. |
| 2 — Fan-out | Agent A (1a/1b/1e) ∥ Agent B (1c/1d) | ✅ Ready | Agent A starting 1a now. Agent B unblocked to start 1c/1d once pulled. |
| 3 — 1c+1d → 1f | Agent A wiring `gate run`/`gate fund` | ⏳ Not reached | Waiting on 1c, 1d |
| 4 — 1b+1e → 1h data routes | Agent B's dashboard API routes | ⏳ Not reached | Waiting on 1b, 1e |
| 5 — 1f → 1g | Real end-to-end demo run | ⏳ Not reached | Waiting on 1f |
| 6 — Stub verification | Phase 2-4 sign-off | ⏳ Not reached | Waiting on Phase 0 |
| 7 — Rehearsal | Live joint session, both tracks | ⏳ Not reached | Waiting on 1g, 1h |

## Agent A — status

**Current phase:** 1e (Receipts and verify chain) — starting next
**Current task:** Phase 1b just finished and about to push. Moving to Phase 1e per `docs/04-POLICY-ENGINE-SPEC.md` § The Receipt schema.
**Last commit:** Phase 1b — `decide()`, with a real rule-order fix (see `08-CHANGELOG.md`, `02-DECISIONS.md` ADR-003)
**Blocked on:** nothing

## Agent B — status

**Current phase:** 1d (webcmd) starting now; 1c (Dodo) blocked
**Current task:** Pulled and verified Phase 0 (`tsc --noEmit` + `npm test` clean on this machine too). Starting Phase 1d (self-serve: global webcmd install + `webcmd doctor`). Phase 1c cannot start until a real Dodo test-mode account/API keys exist — see `04-BLOCKERS.md`.
**Last commit:** — (about to push agent-b docs: `TASKS.md`, `ROADMAP.md`, `ERROR-HANDLING.md`, `WORKSPACE.md` update)
**Blocked on:** Phase 1c only — needs a real Dodo test-mode account + `.env` (`DODO_API_KEY`, `DODO_API_KEY_READONLY`) from the user. Phase 1d is unblocked and starting now.

## Repo state

- Git remote: `github.com/Agnik47/Vitta`, branch `main`. Both agents work directly on `main` — see `06-SYNC-WORKFLOW.md` for why no long-lived feature branches are used here.
- `src/` now exists with the full Phase 0 skeleton. `dashboard/` still does not exist — that's Agent B's Phase 1h, not part of Phase 0.
- TypeScript is pinned to `5.9.3` in `package.json` (not the `^7.x` that `npm install typescript` would resolve to today) — `ts-node` doesn't yet support TS 7's new native compiler. If you `npm install` a new package and notice `package-lock.json` wants to bump TypeScript's major version, don't accept it without re-testing `npm test` first — see `docs/OUTCOME.md` Phase 0 for the full finding.
