# 01 — Project Status (Live)

The current state of the world, at a glance. Update your own section every time you sync (see `00-START-HERE.md`). Never edit the other agent's section — if it's stale or wrong, that's a signal for them to fix at their next sync, or a `04-BLOCKERS.md` entry if it's actively blocking you.

**Last updated:** 2026-07-29 (later same day), Agent B (real Dodo account end-to-end verification for the dashboard; found+fixed a real SDK environment bug relevant to `DodoCreditLedger.ts`)

---

## At a glance

- **Completed:** Phase 0, 1a, 1b, 1e (Agent A), Phase 1d's `manifest.ts` and Phase 1h (Agent B, fully done as of this update), Phase 1f (Agent A — but partial by necessity, see below), Phase 1c provisioning (Agent A — real account, entitlement, product, and a real paid test purchase; `DodoCreditLedger.ts` itself not written yet, deliberately out of scope for that session).
- **Active:** **B-001 is now fully resolved** — a real Dodo test-mode account exists, real credentials work, and the user shared them with both agents' machines. Agent A's next step on Phase 1c is un-blocked: write `src/ledger/DodoCreditLedger.ts`. Only remaining blocker is B-002 (webcmd browser connectivity, machine-specific to Agent B) — affects Phase 1d's `execute()` verification and, downstream, Phase 1g.
- **Pending:** `DodoCreditLedger.ts` implementation (Agent A), 1d's `execute()` verification (Agent B, blocked on B-002), 1g (Agent A, blocked on B-002 + the ledger implementation), 5.
- **Project health:** 🟢 On track, B-001 fully cleared. Important flags from this session: (1) Phase 1b's rule-order fix in `decide()` (see `02-DECISIONS.md` ADR-003) — re-check before relying on the old rule order from memory. (2) Phase 1f's 4 bug fixes and the `manifest.json` un-gitignoring, both already committed. (3) **Phase 1c fully provisioned for real** (Agent A) — real Credit Entitlement `cde_0NkBmcWcZ3I79sHr1UZCx`, real Product, a real user-completed test purchase, `credit.added` webhook fired, balance readable at 100000 credits (= ₹1,000). (4) **The user then shared those same credentials directly with Agent B's machine**, who used them to verify the dashboard's Dodo balance lookup against the real account end to end (both the checkout-session and direct-customer-id resolution paths, both return the real ₹1,000) — and in doing so found a real bug worth knowing before writing `DodoCreditLedger.ts`: **the `DodoPayments` SDK client defaults to `environment: 'live_mode'` when that option is omitted**, silently sending calls to the live host instead of `https://test.dodopayments.com`, failing there with a generic 401 that looks like a bad key rather than a wrong environment. Fix: pass `environment: 'test_mode'` explicitly to every `new DodoPayments(...)` construction. Full writeup: `docs/OUTCOME.md` Phase 1h addendum and Phase 1c entry. Other older findings (all resolved): 2 toolchain issues in Phase 0, `DenyCode` missing `ALREADY_EXECUTED`, real webcmd manifest counts differing substantially from the spec's guesses, the real Dodo SDK's balance model being customer-keyed rather than session-keyed, and a real `balance` field type inconsistency (SDK types say `string`, the wire says `number`). See `04-BLOCKERS.md` — B-001 in Resolved, B-002 still Open.

## Overall phase progress

Mirrors the phase list in `docs/PROMPTS.md`. Status values: `⏳ Not started` · `🔨 In progress` · `✅ Done, tests passing` · `❌ Blocked`.

| Phase | Owner | Status | Notes |
|---|---|---|---|
| 0 — Scaffolding | Agent A | ✅ Done, tests passing | `tsc --noEmit` + `npm test` both pass. See `docs/OUTCOME.md` for 2 deviations (GateEvent.ts written for real, DenyCode gained ALREADY_EXECUTED) and 2 toolchain findings (TS pinned to 5.9.3, test script drops the path arg). |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | Agent A | ✅ Done, tests passing | 9/9 real tests pass (5 required + 4 for a `renderConsent()` deviation, see `docs/OUTCOME.md`). |
| 1b — Policy Engine `decide()` | Agent A | ✅ Done, tests passing | 20/20 tests pass. Real rule-order bug found and fixed — see `02-DECISIONS.md` ADR-003. |
| 1c — Dodo Payments integration | **Agent A** (reassigned 2026-07-29, ADR-005) | ⚠️ Provisioning done, `DodoCreditLedger.ts` not yet written | B-001 fully resolved — real account, entitlement, product, real paid test purchase, balance verified 3 independent ways (see `docs/OUTCOME.md`). Not blocked on anything external anymore; implementation is the next step. Note the `environment: 'test_mode'` SDK-client gotcha Agent B found — see "At a glance" above. |
| 1d — webcmd integration | Agent B | ⚠️ Partial | `manifest.ts` done + real-tested (805 commands, 228 write). `executor.ts` implemented but `execute()` unverified — `webcmd doctor` fails Connectivity check, see B-002. Idempotency guard (`hasAlreadyDrawn`/`recordDraw`) done + real-tested. |
| 1e — Receipts and verify chain | Agent A | ✅ Done, tests passing | 24/24 tests pass, no spec deviations this phase. |
| 1f — CLI and two-pane UI | Agent A | ⚠️ Done with deviations | 5/7 subcommands real and verified (scan, mandate create/resign, receipt show, verify). `gate run`/`gate fund` genuinely can't be built — need `Ledger.ts` to exist as real code (Phase 1c). 45/45 tests pass. 4 real bugs found and fixed — see `docs/OUTCOME.md`. |
| 1g — Full end-to-end run | Agent A | ❌ Blocked | Needs `gate run`/`gate fund` real (i.e. `DodoCreditLedger.ts` written) and B-002 resolved. B-001 itself no longer blocks this. |
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
| 3 — 1c+1d → 1f | Agent A wiring `gate run`/`gate fund` | ⏳ Not reached | 1c is Agent A's own work (ADR-005), B-001 resolved — just needs `DodoCreditLedger.ts` written now. Still waiting on Agent B's 1d `execute()` to be live-verified (B-002). The *other* `gate` subcommands are done — see Phase 1f's row above. |
| 4 — 1b+1e → 1h data routes | Agent B's dashboard API routes | ✅ Done | 1h shipped 2026-07-29 — all 3 data routes built and verified against real signed fixture data in an actual browser. |
| 5 — 1f → 1g | Real end-to-end demo run | ⏳ Not reached | Waiting on 1f |
| 6 — Stub verification | Phase 2-4 sign-off | ✅ Done | Confirmed 2026-07-29 — all 4 stubs already met the definition. |
| 7 — Rehearsal | Live joint session, both tracks | ⏳ Not reached | Waiting on 1g. 1h is otherwise ready but has one item (CLI-kill-mid-run) only testable once 1g's CLI exists. |

## Agent A — status

**Current phase:** 1c (Dodo Payments integration) — reassigned here 2026-07-29, ADR-005
**Current task:** Per direct user instruction, taking over Phase 1c from Agent B (see ADR-005 for the reasoning — B-002 would have kept blocking Agent B even after B-001 clears, while `src/ledger/` has zero webcmd dependency). Asked the user for the concrete Dodo test-mode account/keys needed. Not writing any `src/ledger/` code until they exist, per `CLAUDE.md` § "If you're blocked."
**Last commit:** Phase 2-4 stub verification (previous task) — all 4 files confirmed correct (see `08-CHANGELOG.md`)
**Blocked on:** B-001 (real Dodo test-mode account) — now the only thing blocking Agent A's own Phase 1c, not just Agent B's.

## Agent B — status

**Current phase:** 1h (dashboard) fully done; 1d (webcmd) partial; 1c no longer mine (ADR-005)
**Current task:** The user shared the real Dodo credentials from Agent A's Phase 1c provisioning directly with this session. Populated `.env` + `dashboard/.env.local` and tested the dashboard's Dodo balance lookup against the real account — found and fixed a real bug (SDK client defaulting to `environment: 'live_mode'`, silently hitting the live host and failing with a misleading 401). After the fix, verified both resolution paths for real via the actual `/api/mandate` route, confirmed visually in Chrome: real "₹1,000" balance, zero console errors. Flagged the environment bug prominently for Agent A since it'll bite `DodoCreditLedger.ts` too if not applied there. Phase 1h now has exactly one open item left (CLI-kill-mid-run, needs Phase 1g). Phase 1d's `manifest.ts` is done and real-tested; `execute()` still blocked on B-002. Considering Phase 2-4 stub verification next (Agent A already did it, so checking in first to avoid duplicate effort) since B-002 is the only remaining blocker on this track.
**Last commit:** Real Dodo account end-to-end verification for the dashboard, `environment: 'test_mode'` bug fix (see `08-CHANGELOG.md`)
**Blocked on:** B-002 only (Phase 1d's `execute()` verification — webcmd browser connectivity bridge failing on this machine). B-001 is resolved and no longer affects this track at all.

## Repo state

- Git remote: `github.com/Agnik47/Vitta`, branch `main`. Both agents work directly on `main` — see `06-SYNC-WORKFLOW.md` for why no long-lived feature branches are used here.
- `src/` now exists with the full Phase 0 skeleton. `dashboard/` now exists too (Agent B's Phase 1h, own `package.json`/lockfile, Next.js 16.2.12) — never part of Phase 0's scaffolding.
- TypeScript is pinned to `5.9.3` in `package.json` (not the `^7.x` that `npm install typescript` would resolve to today) — `ts-node` doesn't yet support TS 7's new native compiler. If you `npm install` a new package and notice `package-lock.json` wants to bump TypeScript's major version, don't accept it without re-testing `npm test` first — see `docs/OUTCOME.md` Phase 0 for the full finding.
- **`manifest.json` is no longer gitignored** (fixed 2026-07-29, was a Phase 0 mistake — see `docs/OUTCOME.md` Phase 1f). **Done:** Agent B committed the real one (805 commands, 228 write) same day — `gate scan` can now be tested against real data on either machine.
- `keys/` (Ed25519 keypairs for the issuer and the gate) is gitignored, same reasoning as `mandates/`/`receipts/` — auto-generated on first `gate` CLI use by `src/cli/keys.ts`.
- **Real Dodo test-mode credentials now populated in `.env` (root) and `dashboard/.env.local` on Agent B's machine too** — the user shared the same account Agent A provisioned in Phase 1c. Both files remain gitignored, never committed. **Reminder for whoever writes `DodoCreditLedger.ts`:** the SDK client needs `environment: 'test_mode'` passed explicitly — it defaults to `live_mode` otherwise (see "At a glance" above for the full finding).
- **`.mcp.json` now exists at the repo root** (project-scoped, committed, no secrets) — registers Dodo's own `dodo-knowledge` MCP server (docs semantic search, no API key needed). Either agent gets it automatically on the next session start; a **session restart is required** for a newly-added project MCP server to connect (Claude Code shows an approval prompt on first use after restart — this is normal, not a bug). Useful right now for researching `docs/02-DODO-INTEGRATION.md`'s open questions without needing a real account. There's also a *separate* Dodo MCP for actually executing API calls (`dodopayments_api` / Code Mode, needs a real `DODO_PAYMENTS_API_KEY`) — worth adding once B-001 clears; not added yet since it needs real credentials neither agent has. Add it the same way: `claude mcp add --scope project --transport stdio dodopayments_api --env DODO_PAYMENTS_API_KEY="..." -- npx -y dodopayments-mcp` (per Dodo's own docs, fetched via the knowledge MCP).
