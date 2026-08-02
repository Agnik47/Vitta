# Mandate Gate (Vitta)

> **An AI spending policy engine.** A human signs a scoped, capped, time-boxed spending permission — a *mandate* — and an AI browser-automation agent's money-moving actions either execute or get denied based on that mandate's rules. Every decision is deterministic, cryptographically signed, and produces a tamper-evident receipt chain.

---

## What it does

AI agents that drive a real browser (via [webcmd](https://www.npmjs.com/package/@agentrhq/webcmd)) can also click "place order." A language model's own judgment is not a reliable safety boundary for real purchases — it can be wrong, manipulated, or simply asked to do more than the human intended.

Mandate Gate moves that boundary *outside* the model entirely. A pure, deterministic policy function is the only thing standing between an agent's write command and it actually happening, and that function's rules come from a cryptographically signed human decision, not a prompt.

**One sentence:** A human signs *"my agent may spend up to ₹800 at Blinkit before 6 pm today"* and the agent physically cannot exceed that boundary — whether it tries to or not.

---

## User and problem

Vitta is for people who let an AI agent prepare grocery purchases but need a deterministic, signed boundary between an agent's intent and any spend. It prevents a browser agent from exceeding the merchant, amount, transaction-count, and expiry limits that its owner explicitly approved.

## Prava integration and current checkout boundary

Vitta creates a Prava sandbox mandate-setup session for the signed cap. The owner completes Prava's passkey approval, then each permitted draw mints a merchant- and amount-scoped, single-use Prava credential with the Vitta run ID as Prava's idempotency reference. Prava is therefore the authorization rail, not a decorative button.

Prava's documented Browser Harness currently supports Shopify, not Blinkit. This repository cannot present Prava's credential at Blinkit's checkout today. Blinkit checkout is consequently a separately disclosed simulation/test step; no receipt or demo should claim that Prava paid a Blinkit order until a supported token-presenting integration is implemented.

## What existed before this hackathon vs. what was built during it

Before Aug 1, 2026: the mandate/policy engine, Ed25519 signing, receipt chain, webcmd/Blinkit integration, dashboard, and the Prava test integration. During Aug 1–2, 2026: the Prava REST integration, Prava ledger tests, schema migration, and hackathon disclosure material. `demo/mandate-gate-fallback-2026-07-29.mp4` predates the hackathon and depicts the old Prava flow; it must be replaced with a Prava-flow recording or clearly retained only as a historical artifact.

## What worked, what did not, and what we learned

The documented Prava session, mandate lookup, remaining-balance, idempotent charge, and session-revoke APIs fit the ledger boundary and are covered by mocked unit tests. A direct Prava-to-Blinkit payment did not work because the documented Prava Browser Harness is Shopify-only. The important lesson is that authorization evidence is not a completed merchant transaction: the UI and demo must preserve that distinction.

## Live demo (84 seconds)

The full end-to-end flow — mandate creation, real Prava session funding, a live merchant search, a policy DENY, a policy ALLOW with a placed order, receipt generation, and tamper detection — runs in under 90 seconds. A fallback video is committed at `demo/mandate-gate-fallback-2026-07-29.mp4`.

---


The full end-to-end flow — mandate creation, real Prava session funding, a live merchant search, a policy DENY, a policy ALLOW with a placed order, receipt generation, and tamper detection — runs in under 90 seconds. A fallback video is committed at `demo/mandate-gate-fallback-2026-07-29.mp4`.

---

## The five working parts

| # | Component | What it does |
|---|---|---|
| 1 | **Mandate** | A JSON document signed with Ed25519. Specifies merchant scope, total spend cap, per-transaction cap, max transactions, and expiry. Renders as plain English the human can read before signing. |
| 2 | **Policy Engine (`decide()`)** | A pure, synchronous, zero-I/O, zero-LLM function. Same inputs always produce the same `ALLOW` / `DENY` / `STEP_UP`. Never calls a network, never consults a model. |
| 3 | **Prava Payments (sandbox)** | The human funds the mandate through a Prava mandate-setup session. On `ALLOW`, the engine mints a single-use card credential. On `DENY`, no money moves. |
| 4 | **Receipt chain** | Every `ALLOW` produces a signed, hash-linked receipt. Tamper with any receipt and the *next* receipt's chain link breaks — not just the tampered one's signature. |
| 5 | **Dashboard** | A Next.js app showing the live mandate, Prava balance, policy decision feed, and receipt verification status. Also the real shopping interface: search, cart, and one-click purchase with mandate gating. |

---

## How a spend happens

```
1. gate mandate create --cap 800 --merchants blinkit --expires "18:00"
   → builds + Ed25519-signs a Mandate → mandates/mnd_xxx.json

2. gate fund mnd_xxx --amount 800
   → creates a Prava sandbox mandate-setup session
   → human completes test-card payment → reserveRef stored on the mandate

3. Agent runs a read command (e.g. blinkit cart)
   → reads are free — decide() short-circuits to ALLOW, no mandate check

4. Agent runs a write command (e.g. blinkit place-order)
   → decide(request, mandate, ledgerBalance, txnCount, now) evaluates the full rule table
   → DENY  → nothing executes, ledger untouched, typed reason code returned
   → ALLOW → real browser command runs, Prava issues the token,
             a Receipt is signed and hash-linked to the previous one
```

Every decision emits a `GateEvent` — the single contract the CLI, `events.jsonl`, and the dashboard all read.

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript on Node.js 20+ |
| Policy engine | Hand-written pure function — no framework, no LLM |
| Signing | `node:crypto` — Ed25519, zero external dependencies |
| Payments | Prava REST API, sandbox only |
| Browser automation | `@agentrhq/webcmd` — real stealth-Chromium, 800+ real site commands |
| Dashboard | Next.js 16 (App Router) + Tailwind CSS + shadcn/ui |
| Tests | `node:test` — 238 passing, no external test framework |

---

## Repository layout

```
mandate-gate/
├── src/
│   ├── mandate/          # Mandate schema, Ed25519 signing, plain-English rendering
│   ├── policy/           # decide() — the core rule engine (pure / sync / zero-I/O)
│   ├── ledger/           # Prava Sandbox integration (REST API)
│   ├── receipt/          # Receipt schema, hash-chain build/verify
│   ├── webcmd/           # webcmd manifest fetch + safe command execution
│   ├── agent/            # Purchase agent — cart sync, gate spawn, state machine
│   ├── events/           # GateEvent — the one schema every consumer reads
│   └── cli/              # `gate` CLI — the only way actions are taken
│
├── dashboard/            # Next.js app (search, cart, mandate, events, receipts)
│   ├── app/api/shop/     # Cart sync, search, purchase-run routes
│   ├── lib/              # cart-context, cart-sync, real-cart, gate-cli
│   └── components/       # UI components
│
├── webcmd-adapters/
│   └── blinkit/          # Custom adapters: set-cart-quantity, clear-cart, place-order
│
├── mandates/             # Runtime: mandate JSON files
├── receipts/             # Runtime: signed receipt JSON files
├── authorizations/       # Runtime: transaction authorization JSON files
├── events.jsonl          # Runtime: append-only policy decision log
├── ledger.jsonl          # Runtime: Prava draw/credit audit trail
└── keys/                 # Runtime: Ed25519 keypairs (gitignored)
```

---

## Getting started

### Prerequisites

- Node.js 20+
- `@agentrhq/webcmd` installed globally: `npm install -g @agentrhq/webcmd`
- A Prava developer account (Dashboard) with Sandbox access
- A Blinkit account logged into the webcmd browser session (`webcmd blinkit whoami`)

### 1. Install dependencies

```bash
# Root (CLI + policy engine)
node webcmd-adapters/install.mjs
```

Verify:
```bash
webcmd scan | grep -E "set-cart-quantity|clear-cart"
```

### 2. Configure environment

```bash
# Root CLI
cp .env.example .env
# Fill in PRAVA_SECRET_KEY, PRAVA_USER_EMAIL, PRAVA_API_BASE_URL

# Dashboard
cp dashboard/.env.local.example dashboard/.env.local
# Fill in the same Prava secret key
```

**Prava Sandbox Test Card:**
Use this test card in the Prava Sandbox:
- **Card Number**: `4622943123232200`
- **CVV**: `93`
- **Expiry**: `12/27`
*Note: Test cards have a max daily limit of 30 transactions.*

### 4. Build

```bash
npm run build          # compiles src/ → dist/
```

### 5. Run tests

```bash
npm test               # 238 tests, node:test runner
```

### 6. Start the dashboard

```bash
cd dashboard && npm run dev
# → http://localhost:3000
```

---

## CLI reference

All commands are run as `node dist/cli/gate.js <command>` from the repo root.

| Command | What it does |
|---|---|
| `gate mandate create` | Create and sign a new mandate |
| `gate mandate resign` | Update and re-sign an existing mandate |
| `gate fund <mandateId> --amount <n>` | Fund a mandate via a Prava mandate-setup session |
| `gate run -- webcmd <site> <cmd>` | Execute a webcmd command through the policy gate |
| `gate receipt show <receiptId>` | Display a receipt |
| `gate verify <receiptId>` | Verify a receipt's signature and chain link |
| `gate scan` | List all available webcmd commands |

### Common webcmd commands (Blinkit)

```bash
# Search
node dist/cli/gate.js run -- webcmd blinkit search --query "maggi"

# Add to cart (absolute quantity — idempotent)
node dist/cli/gate.js run -- webcmd blinkit set-cart-quantity <productId> --quantity 2

# Clear the entire cart
node dist/cli/gate.js run -- webcmd blinkit clear-cart

# Place an order (requires mandate ALLOW)
node dist/cli/gate.js run -- webcmd blinkit place-order --confirm
```

---

## Policy engine rules

`decide()` evaluates rules in this exact order. The first matching rule wins.

| # | Rule | Verdict |
|---|---|---|
| 0 | Read-only command (`access: 'read'`) | `ALLOW` — free, no mandate check |
| 1 | Mandate missing or signature invalid | `DENY: BAD_SIGNATURE` |
| 2 | Mandate expired | `DENY: EXPIRED` |
| 3 | Command not in manifest | `DENY: UNKNOWN_COMMAND` |
| 4 | Merchant not in mandate scope | `DENY: MERCHANT_NOT_ALLOWED` |
| 5 | Amount unparseable | `DENY: AMOUNT_UNPARSEABLE` |
| 6 | Amount exceeds per-transaction cap | `DENY: OVER_PER_TXN_CAP` |
| 7 | Total spend would exceed cap | `DENY: OVER_TOTAL_CAP` |
| 8 | Transaction limit reached | `DENY: TXN_LIMIT_REACHED` |
| 9 | Same `runId` already executed | `DENY: ALREADY_EXECUTED` |
| 10 | All checks pass | `ALLOW` |

`decide()` is a pure function. It never calls a network, never calls an LLM, and never throws — unknown/invalid inputs always produce `DENY`, never `ALLOW`.

---

## Cart synchronisation

The dashboard mirrors the real Blinkit cart exactly. Every cart mutation follows four steps:

1. **Read** the real merchant cart
2. **Compute** the delta between real quantity and desired quantity
3. **Write** an absolute target quantity (not "add N more") — idempotent
4. **Verify** the merchant now reports the desired quantity before updating the UI

This replaced an optimistic local model that could silently diverge from Blinkit (observed live: dashboard ₹165 vs real cart ₹330; a human-approved ₹160 purchase was actually ₹354).

---

## Receipt chain

Each receipt contains the SHA-256 hash of the previous receipt (`prev_receipt_hash`). The chain is verified by:

1. Checking the Ed25519 signature on each receipt against the gate's public key
2. Confirming `receipt[i].prev_receipt_hash === sha256(receipt[i-1])`

Tampering with any field in any receipt breaks every subsequent chain link — even if the attacker re-signs the tampered receipt, they cannot forge the private key used by the gate.

---

## Safety guarantees

- **Sandbox only.** Every Prava API call targets `https://sandbox.api.prava.space`. No live-mode code exists in this repo.
- **Fail closed.** Any unknown command, unparseable amount, expired mandate, or bad signature produces `DENY`. The default is never `ALLOW`.
- **No LLM in the decision path.** `decide()` is deterministic — a future audit can re-run the exact same inputs and get the exact same verdict.
- **Human-in-the-loop for real purchases.** The dashboard requires explicit confirmation before starting a purchase job. The CLI's `--confirm` flag must be explicitly passed.
- **Idempotent draws.** The same `runId` cannot draw from the Prava ledger twice — both at the application level and enforced by Prava's idempotency reference.

---

## Money safety note

This project operates in **Prava Sandbox mode** using test keys. No real money moves anywhere in this build. Switching to live mode requires business verification with Prava and is explicitly out of scope.

---

## License

ISC