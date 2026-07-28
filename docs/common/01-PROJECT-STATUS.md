# 01 — Project Status (Live)

The current state of the world, at a glance. Update your own section every time you sync (see `00-START-HERE.md`). Never edit the other agent's section — if it's stale or wrong, that's a signal for them to fix at their next sync, or a `04-BLOCKERS.md` entry if it's actively blocking you.

**Last updated:** 2026-07-29, Agent B (committed manifest.json, wired up real signature_valid using Agent A's Phase 1f keys)

---

## At a glance

- **Completed:** Phase 0, 1a, 1b, 1e (Agent A), Phase 1d's `manifest.ts` and Phase 1h (Agent B), Phase 1f (Agent A — but partial by necessity, see below).
- **Active:** Agent A's sequential track is done through 1f as far as it can go without Agent B's Phase 1c. `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify` are real, run, and verified. `gate run`/`gate fund` exist as honest "not available yet" dispatcher cases — genuinely cannot be implemented until `src/ledger/Ledger.ts` is real code. Agent B: Phase 1c still blocked on B-001, `execute()` still blocked on B-002.
- **Pending:** Phase 1c (Agent B, blocked), 1d's `execute()` verification (Agent B, blocked), 1g (Agent A, blocked on 1c), 2-4, 5.
- **Project health:** 🟡 On track overall, both open blockers now affect BOTH tracks' remaining work (1c/1g on Agent A's side too, not just Agent B's), plus important flags from this session: (1) Phase 1b's rule-order fix in `decide()` (see `02-DECISIONS.md` ADR-003) — re-check before relying on the old rule order from memory. (2) Phase 1f found and fixed 4 more real bugs (`renderConsent()`'s time format was wrong since Phase 1a; INR amounts weren't comma-grouped; `manifest.json` was wrongly gitignored — **now fixed and committed for real by Agent B**, 805 commands/228 write, `gate scan` can now be tested against real data on either machine). Phase 1f also resolved the gate-keypair-persistence gap Agent B flagged during Phase 1h (`src/cli/keys.ts`) — **Agent B has now wired this up on the dashboard side too**: `/api/receipts`' `signature_valid` is real, verified against a bootstrapped real gate keypair including a live tamper test that correctly distinguished a receipt's own signature failure from its chain-link failure. Full detail in `docs/OUTCOME.md`. Other older findings (all resolved): 2 toolchain issues in Phase 0, `DenyCode` missing `ALREADY_EXECUTED`, real webcmd manifest counts differing substantially from the spec's guesses (805 total/228 write vs. guessed ~302/~192), and the real Dodo SDK's balance model being customer-keyed rather than session-keyed. See `04-BLOCKERS.md` B-001/B-002 — both still open, blocking `gate run`/`gate fund`/Phase 1g on Agent A's side and Phase 1c/`execute()` on Agent B's side.

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
| 1f — CLI and two-pane UI | Agent A | ⚠️ Done with deviations | 5/7 subcommands real and verified (scan, mandate create/resign, receipt show, verify). `gate run`/`gate fund` genuinely can't be built — need `Ledger.ts` to exist as real code (Phase 1c). 45/45 tests pass. 4 real bugs found and fixed — see `docs/OUTCOME.md`. |
| 1g — Full end-to-end run | Agent A | ❌ Blocked | Needs `gate run`/`gate fund` real, which needs Phase 1c (B-001) and B-002 resolved. |
| 1h — Dashboard (Next.js) | Agent B | ⚠️ Done with deviations | Next.js 16.2.12. All 3 pages/routes verified in a real browser against real signed fixture data. `signature_valid` now real (wired to `keys/gate.public.pem` same day Phase 1f shipped it). One item pending: killing the dashboard mid-CLI-run can't be tested until `gate run` exists (Phase 1c). See `docs/OUTCOME.md`. |
| 2-4 — Stub verification | Either | ⏳ Not started | Filler work — good to pick up while waiting on the other agent |
| 5 — Demo rehearsal | Both | ⏳ Not started | Joint session, not solo |

**A phase's `✅` reverts to `🔨 In progress` if a later integration run (Sync Point 5 or 7, see `07-INTEGRATION.md`) surfaces a bug in it. Don't leave a stale ✅ next to code that's since been proven wrong.**

## Integration & merge readiness

One row per Sync Point from `05-PHASE-OWNERSHIP.md` / `07-INTEGRATION.md`. This is the live tracker; those files describe the process each row follows.

| Sync Point | What it gates | Ready? | Blocking issue |
|---|---|---|---|
| 1 — Phase 0 → both tracks | Agent B starting any code | ✅ Ready | Phase 0 pushed — `tsc --noEmit` clean, `npm test` passes. Agent B: pull before writing any code. |
| 2 — Fan-out | Agent A (1a/1b/1e) ∥ Agent B (1c/1d) | ✅ Ready | Agent A starting 1a now. Agent B unblocked to start 1c/1d once pulled. |
| 3 — 1c+1d → 1f | Agent A wiring `gate run`/`gate fund` | ⏳ Not reached | Still waiting on 1c specifically (1d's `manifest.ts` is real; `executor.ts` is implemented but unverified, B-002). The *other* `gate` subcommands are done — see Phase 1f's row above. |
| 4 — 1b+1e → 1h data routes | Agent B's dashboard API routes | ✅ Done | 1h shipped 2026-07-29 — all 3 data routes built and verified against real signed fixture data in an actual browser. |
| 5 — 1f → 1g | Real end-to-end demo run | ⏳ Not reached | Waiting on 1f |
| 6 — Stub verification | Phase 2-4 sign-off | ⏳ Not reached | Waiting on Phase 0 |
| 7 — Rehearsal | Live joint session, both tracks | ⏳ Not reached | Waiting on 1g. 1h is otherwise ready but has one item (CLI-kill-mid-run) only testable once 1g's CLI exists. |

## Agent A — status

**Current phase:** Phase 1f done as far as possible; Phase 1g genuinely blocked
**Current task:** Built everything in Phase 1f that doesn't need `Ledger` to be real code. `gate run`/`gate fund` — and therefore Phase 1g, the full end-to-end run — are stuck until Agent B's Phase 1c clears B-001. Moving to Phase 2-4 stub verification (shared filler work) while waiting, per `05-PHASE-OWNERSHIP.md`'s guidance not to sit idle.
**Last commit:** Phase 1f — CLI subcommands, two-pane UI, 4 real bugs fixed (see `08-CHANGELOG.md`)
**Blocked on:** B-001 (blocks `gate run`/`gate fund`/Phase 1g) — same blocker as Agent B's Phase 1c, now blocking both tracks' remaining real work.

## Agent B — status

**Current phase:** 1h (dashboard) done with deviations; 1d (webcmd) partial; 1c (Dodo) blocked
**Current task:** Pulled Agent A's Phase 1f. Committed a real `manifest.json` (805 commands, 228 write) as requested. Wired up the dashboard's `signature_valid` for real using `keys/gate.public.pem` — bootstrapped a real gate keypair via the actual `getOrCreateKeyPair()` (not a mock), verified against it including a live tamper test that correctly separated a signature failure from a chain-link failure. Both Phase 1h gaps flagged in `docs/agent-b/WORKSPACE.md` are now closed except the Dodo balance chain (still unverified live, B-001) and the CLI-kill-mid-run test (needs Phase 1c/1g). Phase 1d's `manifest.ts` is done and real-tested; `execute()` still blocked on B-002. Phase 1c still blocked on B-001. Considering Phase 2-4 stub verification next since both remaining blockers need the user.
**Last commit:** Phase 1h follow-up — real `manifest.json` + `signature_valid` wiring (see `08-CHANGELOG.md`)
**Blocked on:** B-001 (Phase 1c — real Dodo test-mode account + `.env` from the user) and B-002 (Phase 1d's `execute()` verification — webcmd browser connectivity bridge failing on this machine). Both in `04-BLOCKERS.md`. Neither blocks any further Phase 1h work — that's now fully done except the one Phase 1g-dependent checklist item.

## Repo state

- Git remote: `github.com/Agnik47/Vitta`, branch `main`. Both agents work directly on `main` — see `06-SYNC-WORKFLOW.md` for why no long-lived feature branches are used here.
- `src/` now exists with the full Phase 0 skeleton. `dashboard/` now exists too (Agent B's Phase 1h, own `package.json`/lockfile, Next.js 16.2.12) — never part of Phase 0's scaffolding.
- TypeScript is pinned to `5.9.3` in `package.json` (not the `^7.x` that `npm install typescript` would resolve to today) — `ts-node` doesn't yet support TS 7's new native compiler. If you `npm install` a new package and notice `package-lock.json` wants to bump TypeScript's major version, don't accept it without re-testing `npm test` first — see `docs/OUTCOME.md` Phase 0 for the full finding.
- **`manifest.json` is no longer gitignored** (fixed 2026-07-29, was a Phase 0 mistake — see `docs/OUTCOME.md` Phase 1f). **Done:** Agent B committed the real one (805 commands, 228 write) same day — `gate scan` can now be tested against real data on either machine.
- `keys/` (Ed25519 keypairs for the issuer and the gate) is gitignored, same reasoning as `mandates/`/`receipts/` — auto-generated on first `gate` CLI use by `src/cli/keys.ts`.
- **`.mcp.json` now exists at the repo root** (project-scoped, committed, no secrets) — registers Dodo's own `dodo-knowledge` MCP server (docs semantic search, no API key needed). Either agent gets it automatically on the next session start; a **session restart is required** for a newly-added project MCP server to connect (Claude Code shows an approval prompt on first use after restart — this is normal, not a bug). Useful right now for researching `docs/02-DODO-INTEGRATION.md`'s open questions without needing a real account. There's also a *separate* Dodo MCP for actually executing API calls (`dodopayments_api` / Code Mode, needs a real `DODO_PAYMENTS_API_KEY`) — worth adding once B-001 clears; not added yet since it needs real credentials neither agent has. Add it the same way: `claude mcp add --scope project --transport stdio dodopayments_api --env DODO_PAYMENTS_API_KEY="..." -- npx -y dodopayments-mcp` (per Dodo's own docs, fetched via the knowledge MCP).
