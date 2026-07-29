# Agent B — Task List

This is the durable, git-tracked checklist for Agent B's own deliverables. Unlike a chat-only todo list, this survives a session restart or a machine switch — check here first, every session, to know exactly what's done and what's next. Check off items as they're completed; don't wait for a whole phase to finish before checking off its sub-items.

Scope discipline: everything below is work **assigned to Agent B**. Agent A's phases (0, 1a, 1b, 1e, 1f, 1g) are not this agent's job to implement, wait for, or absorb — if something here is blocked on Agent A's output, it's marked as such and left blocked, not worked around. See `docs/common/05-PHASE-OWNERSHIP.md` for the full ownership split.

---

## Phase 1c — Dodo Payments integration (test mode) — **implemented 2026-07-29 (later same day), per direct user instruction — ADR-006**

Reassigned to Agent A earlier the same day (ADR-005), then the user directly instructed this session to implement it after confirming Agent A hadn't started — see ADR-006 for the full timing.

- [x] Confirm a real Dodo test-mode account exists with `DODO_API_KEY` / `DODO_API_KEY_READONLY` — done, the user shared real credentials (Agent A's Phase 1c provisioning), populated in `.env`
- [x] `src/ledger/Ledger.ts` — was still a comment stub, written for real to match `docs/01-ARCHITECTURE.md` exactly
- [x] `src/ledger/DodoCreditLedger.ts implements Ledger`
  - [x] `fund()` — real Checkout Session, `credit_entitlements` override matching `amountInrPaise`, tagged `metadata.mandate_id` — creates the session for real; cannot complete payment itself (prohibited agent action)
  - [x] `balance()` — real `creditEntitlements.balances.retrieve()`, confirmed against the real account
  - [x] `draw()` — real `creditEntitlements.balances.createLedgerEntry()` with `idempotency_key: runId` — **confirmed for real that a repeat call with the same runId does not double-deduct**
  - [x] `release()` — no-op, confirmed doesn't throw
- [x] Integration script (real network) — created session, read real balance, drew ₹100 with a fake runId, re-drew with the same runId (idempotency check), read balance again, restored it afterward — full output in `docs/OUTCOME.md`
- [x] Update `docs/common/03-INTERFACES.md` — done, `Ledger`/`DodoCreditLedger` row now 🔒 frozen, shipped

## Phase 1d — webcmd integration

Spec: `docs/03-WEBCMD-INTEGRATION.md`. Prompt: `docs/PROMPTS.md` § Phase 1d.

- [x] Confirm `webcmd doctor` succeeds on this machine; install `@agentrhq/webcmd@0.4.3` globally if missing — **now succeeds for real** ("Connectivity: connected in 3.1s — Everything looks good!"). B-002 fully resolved 2026-07-29 — see `docs/common/04-BLOCKERS.md` and `02-DECISIONS.md` ADR-007.
- [x] `src/webcmd/manifest.ts` — `loadManifest()`: live-fetch with disk-cache fallback; a live-fetch failure must never crash the app — done, real-tested, both live and fallback paths confirmed.
- [x] `src/webcmd/executor.ts` — `execute()`: spawns webcmd for ALLOW decisions, captures `runId`/`columns`/`tracePath` — **now real-tested against a live browser command.** Three real bugs found and fixed in the process (unsafe Windows process spawning, a real command-injection risk in the naive fix, and a `runId`/`tracePath` shape that never matched webcmd's actual output) — full record in `docs/OUTCOME.md` and ADR-007. Idempotency guard (`hasAlreadyDrawn`/`recordDraw` against `ledger.jsonl`) real-tested since Phase 1d, unaffected — see ADR-004.
- [x] Manual test script:
  - [x] Prints count of write-access commands found — real number: **228** (not ~192 as the doc guessed)
  - [x] Looks up `blinkit/place-order`, confirms `access === 'write'` — confirmed
  - [x] Looks up a nonsense command name, confirms `undefined` returned (fail-closed case) — confirmed
- [x] Run against the real webcmd install, paste actual output into `docs/OUTCOME.md` (Phase 1d section) — done, see that section for full output including the doctor failure and the fallback-to-cache test.
- [x] **Follow-up, 2026-07-29 (later still):** `execute()` verified against two real live browser commands (a read: `duckduckgo/search`; a write: `github/login`, chosen for zero side effects) via `execute()` itself, not just the raw CLI. Real `runId` (UUID), real `columns` data, honest `tracePath: ''`.

Phase 1d is now fully done — no open items.

## Phase 1h — Dashboard (Next.js, read-only)

Spec: `docs/06-DASHBOARD-SPEC.md`. Prompt: `docs/PROMPTS.md` § Phase 1h. Depends on Agent A's 1b + 1e for the data routes (Sync Point 4) — the app shell does not.

- [x] App shell: `create-next-app` scaffold at `dashboard/` (own `package.json`, App Router, Tailwind) — Next.js 16.2.12, React 19.2.4, Tailwind v4
- [x] Record the exact Next.js version installed into `docs/OUTCOME.md`
- [x] `GET /api/mandate`, `GET /api/events`, `GET /api/receipts` — GET-only, read-only, no exceptions — done, code-reviewed, no writes anywhere
- [x] Pages: `/` (mandate summary + live Dodo balance), `/events` (live feed, 1.8s polling, no WebSockets/SSE), `/receipts` (verify status) — done, all verified against real fixture data in an actual browser tab
- [x] Verify no route imports `DODO_API_KEY` (write key) — only `DODO_API_KEY_READONLY` — grepped, confirmed clean
- [x] `npm run build && npm run start` (not `next dev`), confirm all three pages show real data — done for real; data was fixture data generated with the production signing code (Phase 1f/CLI doesn't exist yet to produce it directly, see `docs/OUTCOME.md` for why that's not a mock)
- [ ] Kill the dashboard process mid-run, confirm the CLI demo sequence is completely unaffected — **cannot test yet** — needs Phase 1g (full `gate run`) to exist. The only remaining open item in this phase.
- [x] Go through `docs/06-DASHBOARD-SPEC.md` § Acceptance checklist explicitly, log results into `docs/OUTCOME.md` — done, one item pending (above)
- [x] **Follow-up, same day:** wired up real `signature_valid` in `/api/receipts` using `keys/gate.public.pem` (Phase 1f's `src/cli/keys.ts`) — verified against a bootstrapped real keypair, including a live tamper test distinguishing signature vs. chain-link failure. See `docs/OUTCOME.md`.
- [x] **Follow-up, same day:** committed the real `manifest.json` (805 commands, 228 write) Agent A requested, so `gate scan` is testable against real data on both machines.
- [x] **Follow-up, same day (later):** the user shared real Dodo test-mode credentials directly — verified `/api/mandate`'s balance lookup against the real account (both the checkout-session and direct-customer-id resolution paths), found and fixed a real `environment: 'test_mode'` SDK-client bug along the way (was silently hitting the live API host). Confirmed real "₹1,000" balance in an actual browser tab. See `docs/OUTCOME.md` Phase 1h addendum.

## Shared / filler work (pick up when blocked on the above)

- [ ] Phase 2-4 stub verification (`docs/PROMPTS.md` § Phase 2-4) — either agent, whoever is idle
- [ ] Phase 5 rehearsal — joint, live session with Agent A, not solo

---

## Current blockers against this list

See `docs/common/04-BLOCKERS.md` for the live, shared version of this.
- Phase 1d's `execute()` still needs the webcmd browser bridge (B-002) fixed on this machine — `webcmd doctor` fails its Connectivity check.
- Phase 1c is no longer this track's blocker to track (reassigned, ADR-005) — B-001 itself is resolved as of 2026-07-29.

Not a reason to pick up Agent A's phases instead — see the scope note at the top of this file.
