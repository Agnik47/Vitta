# Agent A — Durable Task Checklist

Checkbox-level tracking for Agent A's phases (0, 1a, 1b, 1e, 1c, 1f, 1g, plus shared 2-4/5 — **1c added 2026-07-29, reassigned from Agent B per ADR-005**), so progress survives a session restart without re-deriving it from `docs/PROMPTS.md` each time. `WORKSPACE.md` stays the narrative/current-task view; this is the mechanical one. Check items off as they're actually done and verified — not when merely attempted.

## Phase 0 — Scaffolding ✅ Done

- [x] `npm init`, TypeScript/ts-node/@types/node installed, `dodopayments` installed
- [x] `tsconfig.json` (strict), full `src/` tree per `01-ARCHITECTURE.md`
- [x] `.env.example` + `.gitignore`
- [x] `tsc --noEmit` clean
- [x] `GateEvent.ts` populated for real (deliberate deviation, see `docs/OUTCOME.md`)

## Phase 1a — Mandate schema, canonical JSON, Ed25519 signing ✅ Done

- [x] `Mandate` interface + `isMandate()` guard
- [x] `canonicalJSON()`, `generateKeyPair()`, `sign()`, `verify()`
- [x] `renderConsent()` (with the grammatical-list + brand-name fixes)
- [x] Round-trip, tamper, key-order-independence tests

## Phase 1b — Policy Engine `decide()` ✅ Done

- [x] `Decision`/`SpendRequest`/`decide()` implemented
- [x] All 9 rule-table tests + rule-order test (BAD_SIGNATURE beats EXPIRED)
- [x] Read-access-beats-signature regression test (ADR-003)
- [x] `decide()` confirmed zero I/O

## Phase 1e — Receipts and verify chain ✅ Done

- [x] `Receipt` interface
- [x] `buildAndSignReceipt()`, `verifyReceipt()`
- [x] `sha256Hex()`, `verifyChain()` (chain-walking, own design — spec described in prose only)
- [x] Two-receipt chain verifies cleanly
- [x] Tamper on receipt N breaks receipt N+1's chain link (not just N's own signature)

## Phase 1c — Dodo Payments integration ✅ Done (provisioning: Agent A; implementation: Agent B per ADR-006)

- [x] Real Dodo Payments account, Test Mode, provisioned for real: `DODO_API_KEY`, `DODO_API_KEY_READONLY`, top-up Product `pdt_0NkBmcZQJLSicxFMHlNHX`, `DODO_CREDIT_ENTITLEMENT_ID=cde_0NkBmcWcZ3I79sHr1UZCx`
- [x] `src/ledger/Ledger.ts` — implemented by Agent B, ADR-006
- [x] `src/ledger/DodoCreditLedger.ts` — `fund()`, `balance()`, `draw()`, `release()`, real-tested by Agent B, then re-verified live by Agent A during Phase 1g rehearsal (real funding, real balance read)
- [x] `draw()`'s idempotency confirmed for real — a repeat `createLedgerEntry()` call with the same `idempotency_key` does not double-deduct
- [x] `checkoutUrl` added to `Ledger.fund()`'s return type (found missing during Phase 1g rehearsal — see `docs/OUTCOME.md`)

## Phase 1f — CLI and two-pane UI ⚠️ Done with deviations (partial by necessity — see below)

**Foundational pieces (new this phase, not explicitly named in the spec but required to make the CLI real):**
- [x] `generateId()` — shared ID generator (`src/mandate/id.ts`)
- [x] `publicKeyToDidKey()` — real did:key encoding (`src/mandate/did.ts`)
- [x] `formatInr()` — Indian digit-grouped currency formatting (`src/mandate/currency.ts`), found missing while running `gate mandate resign` for real
- [x] `getOrCreateKeyPair()` — persistent issuer/gate keypairs on disk (`src/cli/keys.ts`) — resolves the gap Agent B flagged
- [x] `keys/` added to `.gitignore`
- [x] `manifest.json` **removed** from `.gitignore` (was a Phase 0 mistake — Agent A's machine has no webcmd install, so a shared cache is required for `gate scan` to ever be testable here; see `docs/OUTCOME.md`)

**Subcommands (per `docs/PROMPTS.md` Phase 1f and `docs/05-DEMO-SCRIPT.md`):**
- [x] `gate scan` — real counting logic, verified against a local test fixture (real webcmd manifest.json not yet available on this machine — pending Agent B pushing theirs)
- [x] `gate mandate create --subject <s> --cap <n> --per-txn <n> --merchants <a,b,c> --expires <time>` — real, run and verified
- [x] `gate mandate resign <mandate_id> --cap <n> [--per-txn <n>]` — real, run and verified
- [x] `gate receipt show <receipt_id>` — real, run and verified against a real signed receipt fixture
- [x] `gate verify <receipt_id>` — real, run and verified, including the full Beat 7 tamper test (`sed -i` on a real receipt file)
- [x] `gate run -- webcmd <site> <command> [args...]` — fully implemented and real-tested live: reads free, non-commit writes execute with ₹0/no ledger touch, commit writes (place-order/checkout) fetch real cart total, call `decide()`, execute+draw+receipt on ALLOW, `--run-id` retry check on the commit path. 3 real bugs found+fixed during live testing (see `docs/OUTCOME.md` Phase 1g).
- [x] `gate fund <mandate_id> --amount <n>` — fully implemented and real-tested live: real Dodo checkout created, real payment completed, real balance verified.

**`src/cli/ui.ts`:**
- [x] Two-pane ANSI layout (agent pane left, gate decision log right, RESERVE/SETTLEMENT status strip)
- [x] Pure rendering functions, unit-tested (7 tests) with sample `GateEvent` data — not yet exercised in a live terminal since `gate run` (its real caller) isn't wired

**Before declaring 1f done:**
- [x] Each implemented subcommand run individually, real output pasted into `docs/OUTCOME.md`
- [x] `gate scan` and `gate mandate create` output pasted per `docs/PROMPTS.md` Phase 1f's own instruction
- [x] Open design question flagged, not guessed at: does `gate mandate resign` re-fund the reserve itself, or does that happen elsewhere? Documented in `docs/OUTCOME.md` Phase 1f and left as a Phase 1g item once Phase 1c is real — not resolved by guessing.
- [x] `gate run`/`gate fund` — fully implemented and real-tested. Phase 1f is now fully done, no deviations remaining.

## Phase 1g — Full end-to-end run 🔨 In progress — Beats 1-4 real, Beats 5-8 pending

Both prerequisites (Phase 1c real, B-002 resolved) are now clear on this machine.

- [x] Beats 1-4 run for real: scan, mandate create, fund (real Dodo checkout+payment), real blinkit login, search, add-to-cart (₹0, no receipt), real cart read, real DENY (OVER_PER_TXN_CAP) against a real cart with no webcmd call on that path
- [ ] Beats 5-8 (real place-order, receipt, verify, idempotency-retry) — **deliberately not run**, needs a real blinkit purchase which the user held off on for this rehearsal pass. Not a code gap — see `docs/OUTCOME.md` Phase 1g for the full reasoning and what's proven vs. pending.
- [ ] `docs/05-DEMO-SCRIPT.md` § Acceptance checklist confirmed line by line — partially done, see `docs/OUTCOME.md`
- [x] Result logged in `docs/OUTCOME.md` (updated live as the rehearsal progressed)
- [ ] Timed full run + fallback recording — needs Phase 5's joint rehearsal, or a follow-up solo session once Beats 5-8 are decided

## Shared (either agent)

- [x] Phase 2-4 stub verification (`tsc --noEmit` on `src/phase2-4-stubs/*`, confirm nothing in Phase 1's runtime path imports them) — done 2026-07-29, all 4 stubs already correct, nothing to fix
- [ ] Phase 5 rehearsal (joint session — 3 timed runs, fallback recording, browser-less fallback path, `gate verify` on an older receipt) — this is where Beats 5-8 should get their real run, if not done sooner
