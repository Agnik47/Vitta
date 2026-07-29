# Vitta (Mandate Gate) — Project Overview

## What this is

**Vitta** (repo name; product name **Mandate Gate**) is a policy engine that sits between an AI browser-automation agent and the real world, and refuses to let that agent execute any money-moving action unless a human has signed a scoped, capped, time-boxed spending permission — a **mandate** — that covers it.

One sentence: a human signs *"my agent may spend up to ₹800 at Blinkit, Zepto, or BigBasket, once, before 6pm today,"* and the agent's write commands to those checkout flows physically cannot execute past that boundary, whether the agent tries to or not.

Built as a 72-hour hackathon project. Every payment call runs against Dodo Payments' test-mode API — no real money moves anywhere in this build.

## The problem it addresses

AI agents that can drive a real browser (via [webcmd](https://www.npmjs.com/package/@agentrhq/webcmd), a real automation tool with 805 real site commands) can also click "place order." Nothing about an LLM's own judgment is a reliable enough safety boundary for that — it can be wrong, manipulated, or simply asked to do more than the human meant. Mandate Gate's answer is to move that boundary *outside* the LLM entirely: a deterministic, non-AI policy function is the only thing standing between an agent's write command and it actually happening, and that function's rules come from a cryptographically signed human decision, not a prompt.

## The five real, working parts

1. **A signed Mandate** — JSON, Ed25519-signed, renders as a plain-English sentence a human can actually read before approving.
2. **A Policy Engine (`decide()`)** — a pure, synchronous, zero-I/O, zero-LLM function. Same inputs always produce the same allow/deny/step-up output.
3. **Real settlement via Dodo Payments, test mode** — a human funds the mandate through a real Dodo Checkout Session; the policy engine draws down a real Dodo Credit Entitlement Balance on every allowed spend.
4. **A signed, hash-chained Receipt** for every allowed action — tamper with one receipt and the *next* receipt's chain link breaks, not just the tampered one's own signature.
5. **A read-only Next.js dashboard** — live view of the current mandate, the decision feed, and receipt verify status, running alongside a terminal UI. It can never take an action itself.

Plus a real webcmd integration — the actual npm package, real site adapters, a real (stealth-Chromium-backed) browser session. Not a simulation of browser automation; an actual one, just gated.

## How a spend actually happens (data flow)

```
1. gate mandate create --cap 800 --merchants blinkit,zepto,bigbasket --expires "18:00"
   → builds + Ed25519-signs a Mandate → mandates/mnd_xxx.json

2. gate fund mnd_xxx --amount 800
   → DodoCreditLedger.fund() creates a real Dodo Checkout Session (test mode)
   → human completes the test-card payment → reserveRef stored on the mandate

3. Agent runs a read command (webcmd blinkit cart)
   → reads are free — decide() short-circuits to ALLOW, no mandate/signature check at all

4. Agent runs a write command (webcmd blinkit place-order)
   → decide(request, mandate, ledgerBalance, txnCount, now) evaluates the full rule table
   → DENY  → nothing executes, ledger untouched, a typed reason code is returned
   → ALLOW → the real browser command runs, DodoCreditLedger.draw() deducts the spend
             (idempotent — a retried runId can never double-charge),
             a Receipt is built, signed, and hash-linked to the previous one
```

Every one of these — allow or deny, read or write — emits exactly one `GateEvent`, the single contract the terminal UI, `events.jsonl`, and the dashboard all read from.

## Why decisions are deterministic, not AI

`src/policy/decide.ts` never calls an LLM and never makes a network call. It's a pure function: mandate + spend request + current ledger balance + transaction count + timestamp in, one of `ALLOW` / `DENY` / `STEP_UP` out — always the same answer for the same inputs. The rule order is fixed and load-bearing (bad signature → expired → unknown command → merchant not in scope → unparseable amount → over per-transaction cap → over total cap → transaction limit), and every failure mode defaults to **DENY**, never to ALLOW. This is what makes the safety boundary auditable: a judge, a dispute, or a future incident review can re-run the exact same inputs through `decide()` and get the exact same answer, with no model non-determinism in the loop.

## Architecture at a glance

```
src/
├── mandate/     Mandate schema, canonical-JSON + Ed25519 signing, did:key issuer, plain-English rendering
├── policy/      decide() — the core rule engine, pure/synchronous/zero-LLM
├── ledger/      Ledger interface + DodoCreditLedger (real Dodo test-mode settlement)
├── receipt/     Receipt schema + hash-chain build/verify
├── webcmd/      Real webcmd manifest fetch + command execution
├── events/      GateEvent — the one contract everything else reads
├── cli/         `gate` — the only way a human or agent takes any action
└── phase2-4-stubs/  Typed stubs for dispute export, MCP server, chaos testing — not built yet, by design

dashboard/       Separate Next.js app, own package.json, strictly read-only (GET-only API routes)
docs/            The full build spec — read-only reference, never imported by application code
mandates/ receipts/ manifest.json events.jsonl ledger.jsonl   Runtime data, created by the app
```

No database — JSON files plus Dodo's own hosted ledger are the entire persistence layer. No auth system — one human, one agent, one mandate at a time.

## Tech stack

- **Language:** TypeScript on Node.js, no framework for the core (`node:crypto` for Ed25519 signing, zero dependencies there)
- **Payments:** the official `dodopayments` SDK, test mode only
- **Browser automation:** `@agentrhq/webcmd` (pinned version), backed by a real stealth-Chromium runtime
- **Dashboard:** Next.js (App Router), Tailwind, its own independent app/build
- **Validation:** hand-written type guards — no `zod` or similar
- **Tests:** `node --test`, no external test framework

## Current status

All of Phase 1 — mandate, policy engine, Dodo ledger, webcmd integration, receipts, and the `gate` CLI — is real, implemented, and tested (45/45 tests passing, both the CLI and dashboard type-check clean). A live end-to-end rehearsal has confirmed, for real: mandate creation, real Dodo funding and payment, real merchant login/search/cart actions, and a real policy DENY against an over-cap cart. The one thing deliberately not yet exercised is placing an actual real-money order on a live merchant site through the gated `place-order` path — that's a pending decision, not a missing feature. Phases 2–4 (dispute export, MCP server, chaos testing) are intentionally typed stubs, out of scope for this build. See `docs/OUTCOME.md` for the full build log and `FEATURES.md` for the detailed current feature list.

## Where to look next

- `FEATURES.md` — what's actually built, feature by feature
- `docs/00-PRODUCT-BRIEF.md` through `06-DASHBOARD-SPEC.md` — the full design spec
- `docs/OUTCOME.md` — real terminal output and findings from every build phase
- `docs/common/01-PROJECT-STATUS.md` — live status if this is being built by two people/sessions in parallel
