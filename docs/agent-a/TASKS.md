# Agent A — Durable Task Checklist

Checkbox-level tracking for Agent A's phases (0, 1a, 1b, 1e, 1f, 1g, plus shared 2-4/5), so progress survives a session restart without re-deriving it from `docs/PROMPTS.md` each time. `WORKSPACE.md` stays the narrative/current-task view; this is the mechanical one. Check items off as they're actually done and verified — not when merely attempted.

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
- [x] `gate run -- webcmd <site> <command> [args...]` — dispatcher case exists, prints an honest blocked message (Phase 1c not real yet, B-001), exits non-zero. Cannot be completed until `src/ledger/Ledger.ts` is real code.
- [x] `gate fund <mandate_id> --amount <n>` — same as above.

**`src/cli/ui.ts`:**
- [x] Two-pane ANSI layout (agent pane left, gate decision log right, RESERVE/SETTLEMENT status strip)
- [x] Pure rendering functions, unit-tested (7 tests) with sample `GateEvent` data — not yet exercised in a live terminal since `gate run` (its real caller) isn't wired

**Before declaring 1f done:**
- [x] Each implemented subcommand run individually, real output pasted into `docs/OUTCOME.md`
- [x] `gate scan` and `gate mandate create` output pasted per `docs/PROMPTS.md` Phase 1f's own instruction
- [x] Open design question flagged, not guessed at: does `gate mandate resign` re-fund the reserve itself, or does that happen elsewhere? Documented in `docs/OUTCOME.md` Phase 1f and left as a Phase 1g item once Phase 1c is real — not resolved by guessing.
- [ ] `gate run`/`gate fund` remain genuinely incomplete — not a checkbox to close, a real dependency on Agent B's Phase 1c.

## Phase 1g — Full end-to-end run ⏳ Not started

Blocked until: Phase 1f's `gate run`/`gate fund` are real (needs Phase 1c), and B-002 (webcmd browser connectivity) is resolved so `execute()` can run for real.

- [ ] Full Beat 1-8 sequence run for real, timed
- [ ] `docs/05-DEMO-SCRIPT.md` § Acceptance checklist confirmed line by line
- [ ] Result logged in `docs/OUTCOME.md`

## Shared (either agent)

- [x] Phase 2-4 stub verification (`tsc --noEmit` on `src/phase2-4-stubs/*`, confirm nothing in Phase 1's runtime path imports them) — done 2026-07-29, all 4 stubs already correct, nothing to fix
- [ ] Phase 5 rehearsal (joint session — 3 timed runs, fallback recording, browser-less fallback path, `gate verify` on an older receipt)
