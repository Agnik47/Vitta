# 01 — Project Status (Live)

The current state of the world, at a glance. Update your own section every time you sync (see `00-START-HERE.md`). Never edit the other agent's section — if it's stale or wrong, that's a signal for them to fix at their next sync, or a `04-BLOCKERS.md` entry if it's actively blocking you.

**Last updated:** 2026-07-29 (later same day), Agent B (`src/ledger/DodoCreditLedger.ts` implemented and real-tested, per direct user instruction — see ADR-006)

---

## At a glance

- **Completed:** Phase 0, 1a, 1b, 1e (Agent A), Phase 1d's `manifest.ts` and Phase 1h (Agent B, fully done), Phase 1f (Agent A — but partial by necessity, see below), Phase 1c (real provisioning by Agent A + real `Ledger`/`DodoCreditLedger` implementation by Agent B, per direct user instruction — see `02-DECISIONS.md` ADR-006).
- **Active:** `gate run`/`gate fund` can now be wired to real code in `src/cli/gate.ts` (Agent A's file) — the ledger they call now exists and is real-tested. The only remaining blocker anywhere is B-002 (webcmd browser connectivity, machine-specific to Agent B) — affects Phase 1d's `execute()` verification and, downstream, Phase 1g's full Beat 1-8 run.
- **Pending:** `gate run`/`gate fund` wiring in `src/cli/gate.ts` (Agent A), 1d's `execute()` verification (Agent B, blocked on B-002), 1g (blocked on B-002), 5.
- **Project health:** 🟢 On track, both `Ledger` and the dashboard fully real now. Important flags from this session: (1) Phase 1b's rule-order fix in `decide()` (see `02-DECISIONS.md` ADR-003) — re-check before relying on the old rule order from memory. (2) Phase 1f's 4 bug fixes and the `manifest.json` un-gitignoring, both already committed. (3) **Phase 1c fully provisioned for real** (Agent A) — real Credit Entitlement `cde_0NkBmcWcZ3I79sHr1UZCx`, real Product, a real user-completed test purchase, `credit.added` webhook fired, balance readable at 100000 credits (= ₹1,000). (4) **The user then shared those same credentials with Agent B's machine directly**, who first used them to verify the dashboard's Dodo balance lookup end to end and found a real bug: **the `DodoPayments` SDK client defaults to `environment: 'live_mode'` when that option is omitted**, silently hitting the live host and failing with a misleading 401. Fix: pass `environment: 'test_mode'` explicitly on every client construction — already applied in both the dashboard and `DodoCreditLedger.ts`. (5) **The user then directly instructed Agent B to implement `src/ledger/DodoCreditLedger.ts` itself**, superseding ADR-005's reassignment for this specific file — Agent B confirmed Agent A hadn't started it first (see ADR-006), then implemented and real-tested `fund()`/`balance()`/`draw()`/`release()` against the live account, including confirming Dodo's `idempotency_key` genuinely prevents a double `draw()` (previously an open question). Full writeup: `docs/OUTCOME.md` Phase 1c follow-up entry. Other older findings (all resolved): 2 toolchain issues in Phase 0, `DenyCode` missing `ALREADY_EXECUTED`, real webcmd manifest counts differing substantially from the spec's guesses, the real Dodo SDK's balance model being customer-keyed rather than session-keyed, and a real `balance` field type inconsistency (SDK types say `string`, the wire says `number`). See `04-BLOCKERS.md` — B-001 Resolved, B-002 still Open.

## Overall phase progress

Mirrors the phase list in `docs/PROMPTS.md`. Status values: `⏳ Not started` · `🔨 In progress` · `✅ Done, tests passing` · `❌ Blocked`.

| Phase | Owner | Status | Notes |
|---|---|---|---|
| 0 — Scaffolding | Agent A | ✅ Done, tests passing | `tsc --noEmit` + `npm test` both pass. See `docs/OUTCOME.md` for 2 deviations (GateEvent.ts written for real, DenyCode gained ALREADY_EXECUTED) and 2 toolchain findings (TS pinned to 5.9.3, test script drops the path arg). |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | Agent A | ✅ Done, tests passing | 9/9 real tests pass (5 required + 4 for a `renderConsent()` deviation, see `docs/OUTCOME.md`). |
| 1b — Policy Engine `decide()` | Agent A | ✅ Done, tests passing | 20/20 tests pass. Real rule-order bug found and fixed — see `02-DECISIONS.md` ADR-003. |
| 1c — Dodo Payments integration | Provisioning: Agent A. Implementation: **Agent B**, per direct user instruction, 2026-07-29 (ADR-006 — supersedes ADR-005 for this specific file) | ✅ Done, tests passing | `Ledger`/`DodoCreditLedger` fully implemented and real-tested: `fund()`/`balance()`/`draw()`/`release()` all verified against the live account, including a real confirmation that `idempotency_key` prevents double-`draw()`. Full output in `docs/OUTCOME.md`. |
| 1d — webcmd integration | Agent B | ⚠️ Partial | `manifest.ts` done + real-tested (805 commands, 228 write). `executor.ts` implemented but `execute()` unverified — `webcmd doctor` fails Connectivity check, see B-002. Idempotency guard (`hasAlreadyDrawn`/`recordDraw`) done + real-tested. |
| 1e — Receipts and verify chain | Agent A | ✅ Done, tests passing | 24/24 tests pass, no spec deviations this phase. |
| 1f — CLI and two-pane UI | Agent A | ⚠️ Done with deviations | 5/7 subcommands real and verified (scan, mandate create/resign, receipt show, verify). `gate run`/`gate fund` genuinely can't be built — need `Ledger.ts` to exist as real code (Phase 1c). 45/45 tests pass. 4 real bugs found and fixed — see `docs/OUTCOME.md`. |
| 1g — Full end-to-end run | Agent A | ❌ Blocked | `DodoCreditLedger.ts` now exists and is real-tested — only remaining blocker is wiring `gate run`/`gate fund` to it in `src/cli/gate.ts`, plus B-002 (webcmd) for the full Beat 1-8 run. |
| 1h — Dashboard (Next.js) | Agent B | ✅ Done | Next.js 16.2.12. All 3 pages/routes verified in a real browser against real signed fixture data. `signature_valid` real (Phase 1f keys). Dodo balance lookup now verified against the real account too (both resolution paths, real ₹1,000 shown). Only remaining item: killing the dashboard mid-CLI-run, needs Phase 1g's real `gate run` to exist. See `docs/OUTCOME.md`. |
| 2-4 — Stub verification | Agent A | ✅ Done, tests passing | All 4 stub files already met the definition, nothing needed fixing. Picked up before Agent B to avoid duplicate effort — see `08-CHANGELOG.md`. |
| 5 — Demo rehearsal | Both | ⏳ Not started | Joint session, not solo |

**A phase's `✅` reverts to `🔨 In progress` if a later integration run (Sync Point 5 or 7, see `07-INTEGRATION.md`) surfaces a bug in it. Don't leave a stale ✅ next to code that's since been proven wrong.**

## Integration & merge readiness

One row per Sync Point from `05-PHASE-OWNERSHIP.md` / `07-INTEGRATION.md`. This is the live tracker; those files describe the process each row follows.

| Sync Point | What it gates | Ready? | Blocking issue |
|---|---|---|---|
| 1 — Phase 0 → both tracks | Agent B starting any code | ✅ Ready | Phase 0 pushed — `tsc --noEmit` clean, `npm test` passes. Agent B: pull before writing any code. |
| 2 — Fan-out | Agent A (1a/1b/1e) ∥ Agent B (1c/1d) | ✅ Ready | Agent A starting 1a now. Agent B unblocked to start 1c/1d once pulled. |
| 3 — 1c+1d → 1f | Agent A wiring `gate run`/`gate fund` | ✅ Ready for the ledger half | `DodoCreditLedger.ts` is real and tested (Agent B, ADR-006) — Agent A can wire `gate run`/`gate fund` to it now. `execute()` itself is still unverified live (B-002), so a full real `gate run` demo still can't be rehearsed on Agent B's machine even once wired. |
| 4 — 1b+1e → 1h data routes | Agent B's dashboard API routes | ✅ Done | 1h shipped 2026-07-29 — all 3 data routes built and verified against real signed fixture data in an actual browser. |
| 5 — 1f → 1g | Real end-to-end demo run | ⏳ Not reached | Waiting on 1f |
| 6 — Stub verification | Phase 2-4 sign-off | ✅ Done | Confirmed 2026-07-29 — all 4 stubs already met the definition. |
| 7 — Rehearsal | Live joint session, both tracks | ⏳ Not reached | Waiting on 1g. 1h is otherwise ready but has one item (CLI-kill-mid-run) only testable once 1g's CLI exists. |

## Agent A — status

**Current phase:** 1g (full end-to-end run) — Phase 1c's provisioning half is done (own work, B-001 resolved) and its implementation half landed from Agent B (ADR-006, pulled 2026-07-29) while this session was in progress.
**Current task:** Pulled Agent B's `Ledger.ts`/`DodoCreditLedger.ts` and read it plus ADR-006/08-CHANGELOG.md. Found and fixed a real local gap: this machine's `.env` was missing `DODO_TOPUP_PRODUCT_ID`, which the new code requires — added the real value (`pdt_0NkBmcZQJLSicxFMHlNHX`) from this session's own Phase 1c provisioning. Confirmed `webcmd` is not installed on this machine at all (untested here, separate from Agent B's B-002 connectivity failure on theirs). Next: wire `gate run`/`gate fund` in `src/cli/gate.ts` (own file, currently honest "not available yet" stubs) to the now-real `Ledger`/`execute()`/`hasAlreadyDrawn`/`recordDraw`/`buildAndSignReceipt`, per `docs/05-DEMO-SCRIPT.md` Beats 3-6 and `docs/03-WEBCMD-INTEGRATION.md` § Step 3's "always fetch the authoritative cart total via a read before deciding on a write" rule.
**Last commit:** Phase 1c: B-001 resolved — Dodo credit reserve provisioned and verified live (`8d14162`)
**Blocked on:** Nothing for the wiring itself. Live rehearsal of Beats 1-6 needs a working `webcmd` install + passing `doctor` connectivity check on some machine — not yet true on this one, and B-002 says not true on Agent B's either.

## Agent B — status

**Current phase:** 1h (dashboard) fully done; Phase 1c's `Ledger`/`DodoCreditLedger` implemented, per direct user instruction (ADR-006); 1d (webcmd) partial
**Current task:** After verifying the dashboard's Dodo integration against the real account (previous entry), the user directly instructed this session to implement `src/ledger/DodoCreditLedger.ts` — confirmed Agent A hadn't started it first (still a comment stub), then wrote `Ledger.ts` + `DodoCreditLedger.ts` for real (`fund()`/`balance()`/`draw()`/`release()`), applied the `environment: 'test_mode'` fix from the start, and ran a real integration test against the live account: real checkout session created, real balance read, real draw + idempotency-key re-draw (confirmed no double-deduction — a previously open question, now answered), real balance restored afterward so the shared demo account is unaffected. Full record in `docs/OUTCOME.md` and `02-DECISIONS.md` ADR-006. This isn't reclaiming Phase 1c from Agent A unilaterally — it's the user resolving the exact coordination question ADR-005 flagged. Only remaining blocker on this track: B-002 (webcmd browser connectivity).
**Last commit:** `src/ledger/DodoCreditLedger.ts` implemented and real-tested (see `08-CHANGELOG.md`)
**Blocked on:** B-002 only (Phase 1d's `execute()` verification — webcmd browser connectivity bridge failing on this machine).

## Repo state

- Git remote: `github.com/Agnik47/Vitta`, branch `main`. Both agents work directly on `main` — see `06-SYNC-WORKFLOW.md` for why no long-lived feature branches are used here.
- `src/` now exists with the full Phase 0 skeleton. `dashboard/` now exists too (Agent B's Phase 1h, own `package.json`/lockfile, Next.js 16.2.12) — never part of Phase 0's scaffolding.
- TypeScript is pinned to `5.9.3` in `package.json` (not the `^7.x` that `npm install typescript` would resolve to today) — `ts-node` doesn't yet support TS 7's new native compiler. If you `npm install` a new package and notice `package-lock.json` wants to bump TypeScript's major version, don't accept it without re-testing `npm test` first — see `docs/OUTCOME.md` Phase 0 for the full finding.
- **`manifest.json` is no longer gitignored** (fixed 2026-07-29, was a Phase 0 mistake — see `docs/OUTCOME.md` Phase 1f). **Done:** Agent B committed the real one (805 commands, 228 write) same day — `gate scan` can now be tested against real data on either machine.
- `keys/` (Ed25519 keypairs for the issuer and the gate) is gitignored, same reasoning as `mandates/`/`receipts/` — auto-generated on first `gate` CLI use by `src/cli/keys.ts`.
- **Real Dodo test-mode credentials now populated in `.env` (root) and `dashboard/.env.local` on Agent B's machine too** — the user shared the same account Agent A provisioned in Phase 1c. Both files remain gitignored, never committed. `.env.example` gained a new var, `DODO_TOPUP_PRODUCT_ID` (the `pdt_...` id, needed by `fund()`) — not in the original spec's env list.
- **`src/ledger/DodoCreditLedger.ts` is real now, not a stub** — `environment: 'test_mode'` is applied there too (see "At a glance" above for why that matters).
- **`.mcp.json` now exists at the repo root** (project-scoped, committed, no secrets) — registers Dodo's own `dodo-knowledge` MCP server (docs semantic search, no API key needed). Either agent gets it automatically on the next session start; a **session restart is required** for a newly-added project MCP server to connect (Claude Code shows an approval prompt on first use after restart — this is normal, not a bug). Useful right now for researching `docs/02-DODO-INTEGRATION.md`'s open questions without needing a real account. There's also a *separate* Dodo MCP for actually executing API calls (`dodopayments_api` / Code Mode, needs a real `DODO_PAYMENTS_API_KEY`) — worth adding once B-001 clears; not added yet since it needs real credentials neither agent has. Add it the same way: `claude mcp add --scope project --transport stdio dodopayments_api --env DODO_PAYMENTS_API_KEY="..." -- npx -y dodopayments-mcp` (per Dodo's own docs, fetched via the knowledge MCP).
