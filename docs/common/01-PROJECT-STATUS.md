# 01 — Project Status (Live)

The current state of the world, at a glance. Update your own section every time you sync (see `00-START-HERE.md`). Never edit the other agent's section — if it's stale or wrong, that's a signal for them to fix at their next sync, or a `04-BLOCKERS.md` entry if it's actively blocking you.

**Last updated:** 2026-07-29, Agent B (Phase 1h done)

---

## At a glance

- **Completed:** Phase 0 (scaffolding), Phase 1a (mandate schema, canonical JSON, Ed25519 sign/verify, renderConsent), Phase 1b (`decide()`), Phase 1e (receipts and verify chain), Phase 1d's `manifest.ts` (webcmd manifest loading, real-tested), Phase 1h (dashboard — see caveat below).
- **Active:** Agent A's sequential track is done through 1e — next is Phase 1f (CLI), gated on Agent B's 1c/1d (Sync Point 3, see notes below on the signature-only subcommands that don't need to wait). Agent B has `executor.ts` implemented but blocked on verifying `execute()` for real (B-002); Phase 1c not started, blocked on a real Dodo account (B-001).
- **Pending:** Phase 1c, 1d (Agent B, partial), 1f, 1g, 2-4, 5. Phase 1h has one open item (CLI-kill-mid-run test) that needs Phase 1f to exist.
- **Project health:** 🟡 On track overall, two open blockers both on Agent B's track (neither affects Agent A), plus one important flag: Phase 1b found and fixed a real rule-order bug in `decide()` (read-access now fires before signature/expiry, not after — see `02-DECISIONS.md` ADR-003). If you last read `04-POLICY-ENGINE-SPEC.md` or `03-INTERFACES.md` before 2026-07-29, re-check the `decide()` rule order before relying on it from memory. Phase 1e shipped with no deviations. Phase 1h surfaced a real gap: the gate's Ed25519 public key (Phase 1f's job to persist) has no defined disk location yet — the dashboard's `/receipts` route ships `chain_link_valid` for real now and marks `signature_valid` "pending" until that exists; see `docs/agent-b/WORKSPACE.md` § Notes for Agent A. Other findings so far (all resolved, logged in `docs/OUTCOME.md`): 2 toolchain issues in Phase 0, `DenyCode` missing `ALREADY_EXECUTED`, `renderConsent()`'s merchant-list join not matching the demo script's exact wording, real webcmd manifest counts differing substantially from the spec's guesses (805 total/228 write vs. guessed ~302/~192), and the real Dodo SDK's balance model being customer-keyed rather than session-keyed as `02-DODO-INTEGRATION.md` assumed. See `04-BLOCKERS.md` B-001 (no Dodo test account yet) and B-002 (webcmd browser bridge failing its connectivity check on Agent B's machine).

## Overall phase progress

Mirrors the phase list in `docs/PROMPTS.md`. Status values: `⏳ Not started` · `🔨 In progress` · `✅ Done, tests passing` · `❌ Blocked`.

| Phase | Owner | Status | Notes |
|---|---|---|---|
| 0 — Scaffolding | Agent A | ✅ Done, tests passing | `tsc --noEmit` + `npm test` both pass. See `docs/OUTCOME.md` for 2 deviations (GateEvent.ts written for real, DenyCode gained ALREADY_EXECUTED) and 2 toolchain findings (TS pinned to 5.9.3, test script drops the path arg). |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | Agent A | ✅ Done, tests passing | 9/9 real tests pass (5 required + 4 for a `renderConsent()` deviation, see `docs/OUTCOME.md`). |
| 1b — Policy Engine `decide()` | Agent A | ✅ Done, tests passing | 20/20 tests pass. Real rule-order bug found and fixed — see `02-DECISIONS.md` ADR-003. |
| 1c — Dodo Payments integration | Agent B | ❌ Blocked | No real Dodo test-mode account/`.env` yet — see `04-BLOCKERS.md` B-001. |
| 1d — webcmd integration | Agent B | ⚠️ Partial | `manifest.ts` done + real-tested (805 commands, 228 write). `executor.ts` implemented but `execute()` unverified — `webcmd doctor` fails Connectivity check, see B-002. Idempotency guard (`hasAlreadyDrawn`/`recordDraw`) done + real-tested. |
| 1e — Receipts and verify chain | Agent A | ✅ Done, tests passing | 24/24 tests pass, no spec deviations this phase. |
| 1f — CLI and two-pane UI | Agent A | ⏳ Not started | Needs 1a,1b,1c,1d,1e (see `05-PHASE-OWNERSHIP.md` for partial-start nuance) |
| 1g — Full end-to-end run | Agent A | ⏳ Not started | Needs 1f |
| 1h — Dashboard (Next.js) | Agent B | ⚠️ Done with deviations | Next.js 16.2.12. All 3 pages/routes verified in a real browser against real signed fixture data, incl. a live tamper test. One item pending: killing the dashboard mid-CLI-run can't be tested until Phase 1f exists. See `docs/OUTCOME.md`. |
| 2-4 — Stub verification | Either | ⏳ Not started | Filler work — good to pick up while waiting on the other agent |
| 5 — Demo rehearsal | Both | ⏳ Not started | Joint session, not solo |

**A phase's `✅` reverts to `🔨 In progress` if a later integration run (Sync Point 5 or 7, see `07-INTEGRATION.md`) surfaces a bug in it. Don't leave a stale ✅ next to code that's since been proven wrong.**

## Integration & merge readiness

One row per Sync Point from `05-PHASE-OWNERSHIP.md` / `07-INTEGRATION.md`. This is the live tracker; those files describe the process each row follows.

| Sync Point | What it gates | Ready? | Blocking issue |
|---|---|---|---|
| 1 — Phase 0 → both tracks | Agent B starting any code | ✅ Ready | Phase 0 pushed — `tsc --noEmit` clean, `npm test` passes. Agent B: pull before writing any code. |
| 2 — Fan-out | Agent A (1a/1b/1e) ∥ Agent B (1c/1d) | ✅ Ready | Agent A starting 1a now. Agent B unblocked to start 1c/1d once pulled. |
| 3 — 1c+1d → 1f | Agent A wiring `gate run`/`gate fund` | ⏳ Not reached | Waiting on 1c, 1d. Agent A is unblocked to build the *other* `gate` subcommands now, per `05-PHASE-OWNERSHIP.md`'s partial-start note. |
| 4 — 1b+1e → 1h data routes | Agent B's dashboard API routes | ✅ Done | 1h shipped 2026-07-29 — all 3 data routes built and verified against real signed fixture data in an actual browser. |
| 5 — 1f → 1g | Real end-to-end demo run | ⏳ Not reached | Waiting on 1f |
| 6 — Stub verification | Phase 2-4 sign-off | ⏳ Not reached | Waiting on Phase 0 |
| 7 — Rehearsal | Live joint session, both tracks | ⏳ Not reached | Waiting on 1g. 1h is otherwise ready but has one item (CLI-kill-mid-run) only testable once 1g's CLI exists. |

## Agent A — status

**Current phase:** 1f (CLI and two-pane UI) next, but partially gated — see below
**Current task:** Phase 1e just finished and about to push. Sequential track (0, 1a, 1b, 1e) is now fully done. Phase 1f needs Agent B's 1c+1d for the `gate run`/`gate fund` subcommands (Sync Point 3) — starting with the subcommands that don't need them (`gate mandate create/resign`, `gate scan`, `gate receipt show`, `gate verify`) while 1c/1d are in flight.
**Last commit:** Phase 1e — receipt schema + hash chain, no deviations (see `08-CHANGELOG.md`)
**Blocked on:** nothing outright, but `gate run`/`gate fund` specifically wait on Agent B's 1c/1d

## Agent B — status

**Current phase:** 1h (dashboard) done with deviations; 1d (webcmd) partial; 1c (Dodo) blocked
**Current task:** Pulled forward Phase 1h once Sync Point 4 opened and built the whole dashboard (not just the shell) since 1c/1d were both blocked on external prerequisites anyway. All 3 pages/routes verified for real in a browser, including a live tamper test. One Phase 1h item (kill dashboard mid-CLI-run) waits on Agent A's Phase 1f. Phase 1d's `manifest.ts` is done and real-tested; `execute()` still blocked on B-002. Phase 1c still blocked on B-001.
**Last commit:** Phase 1h — dashboard (see `08-CHANGELOG.md`)
**Blocked on:** B-001 (Phase 1c — real Dodo test-mode account + `.env` from the user) and B-002 (Phase 1d's `execute()` verification — webcmd browser connectivity bridge failing on this machine). Both in `04-BLOCKERS.md`. Neither blocks any further Phase 1h work — that's now waiting on Agent A's Phase 1f instead.

## Repo state

- Git remote: `github.com/Agnik47/Vitta`, branch `main`. Both agents work directly on `main` — see `06-SYNC-WORKFLOW.md` for why no long-lived feature branches are used here.
- `src/` now exists with the full Phase 0 skeleton. `dashboard/` now exists too (Agent B's Phase 1h, own `package.json`/lockfile, Next.js 16.2.12) — never part of Phase 0's scaffolding.
- TypeScript is pinned to `5.9.3` in `package.json` (not the `^7.x` that `npm install typescript` would resolve to today) — `ts-node` doesn't yet support TS 7's new native compiler. If you `npm install` a new package and notice `package-lock.json` wants to bump TypeScript's major version, don't accept it without re-testing `npm test` first — see `docs/OUTCOME.md` Phase 0 for the full finding.
