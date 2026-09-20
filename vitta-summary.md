# Vitta — Project Overview

## The Problem

We are about to hand AI agents a browser and a credit card. An agent that can search a grocery site can also click "Place Order". Today, the only thing standing between "find me some peanut butter" and a ₹4,000 charge is the model's own judgment — and a model can be wrong, jailbroken, or simply more enthusiastic than you intended.

**"I'll prompt it not to overspend" is not a spending control.** It's a suggestion written in the same channel an attacker can write to.

---

## The Solution

**Move the boundary outside the model entirely.**

A human signs a scoped, capped, time-boxed spending permission—a _mandate_. An AI agent's money-moving actions then either execute or get denied against it. **No LLM sits in the decision path.**

### How it works:

1. **Human signs a mandate:** "My agent may spend up to ₹800 at Blinkit, in one transaction, before 6:00 PM today."
2. **Agent issues a command** through the gate.
3. **Pure policy engine decides** (pure, deterministic, zero I/O, zero LLM).
4. **If allowed:** real browser command runs → reserve is drawn → signed receipt emitted.
5. **If denied:** nothing executes, reserve untouched.

---

## Architecture

### Core Components

| Component | Purpose |
|---|---|
| **Mandate** | Ed25519-signed JSON document with merchant scope, total cap, per-txn cap, max transactions, expiry |
| **Policy Engine** | `decide()` — pure, synchronous function. Returns `ALLOW` / `DENY` / `STEP_UP` |
| **Razorpay Reserve** | Real test-mode Orders & Payments API. Mandate cannot spend without a funded reserve. |
| **Receipt Chain** | Signed, hash-linked receipts. Edit one and break all subsequent ones. |
| **Dashboard** | Next.js + React: live mandate, Razorpay balance, decision feed, real storefront |
| **CLI** | `gate` — the only way an action is ever taken |

---

## Multi-Agent Shopping: Nasiko × Anakin × Vitta

**Nasiko controls the agents. Anakin gives them the web. Vitta decides whether they may move money.**

```
"Find me the cheapest 2kg atta under ₹300 and buy it"
                        │
                        ▼
              ┌───────────────────┐
              │  Nasiko           │  registry · routing · per-hop traces
              └─────────┬─────────┘
   ┌──────────┬─────────┴───┬──────────────┐
   ▼          ▼             ▼              ▼
 Planner → Discovery  →  Evaluator  →  Purchase Agent
 (intent)  (Anakin)      (proposal)          │
                                            ▼
                                     ┌─────────────┐
                                     │ Vitta gate  │  reads REAL cart · decide() · no LLM
                                     └──────┬──────┘
                                  ALLOW ────┴──── DENY / STEP_UP
```

---

## Integration Points

### Where Nasiko is Used

**Control plane for four shopping agents.**

- **Responsibility:** Agent registry, identity, routing (`/api/orchestrator/a2a`), per-hop traces, agent lifecycle
- **Verified:** A2A contract, W3C `traceparent` echoing, real local Nasiko deployment tested
- **Located in:** `nasiko/` directory; deployment via `node nasiko/deploy.js`
- **Agents:** Planner, Discovery, Evaluator (in Nasiko); Purchase Agent (direct HTTP, not containerized)

**How it's configured:**
```bash
NASIKO_URL=<the control plane>
NASIKO_TOKEN=...
NASIKO_AGENT_ID_PLANNER=...
NASIKO_AGENT_ID_DISCOVERY=...
NASIKO_AGENT_ID_EVALUATOR=...
NASIKO_AGENT_ID_PURCHASE=...   # or leave unset if running Purchase Agent locally
```

---

### Where Anakin is Used

**Web access layer for the agents.**

- **Responsibility:** Product search across merchants (Blinkit, Zepto, BigBasket)
- **Access:** Read-only search CLI; agents cannot place orders through Anakin
- **Located in:** Used via dashboard's Anakin-first search (`dashboard/lib/runtime-env.ts`)
- **Limitation:** Requires Anakin API credits; Discovery has a 50-second timeout per merchant
- **Verified:** Against live Anakin with real product candidates (15–30 per search)

**How it's used:**
```bash
# Discovery agent searches via Anakin
VITTA_DASHBOARD_URL=<dashboard for Anakin-first search>
ANAKIN_API_KEY=<Anakin credits>
```

---

### Where DronaHQ is Used

**Agent activity dashboard & monitoring.**

- **Responsibility:** Vitta Agent Ops — a DronaHQ Vibe app for visualizing agent runs, traces, and activity
- **Located in:** Referenced in recent commit `feat: Vitta Agent Ops, a DronaHQ Vibe app (local mirror, pluginId 77712)`
- **Purpose:** Live monitoring of shopping agent executions, proposal evaluations, purchase outcomes
- **Status:** Local development mirror; can be extended for production observability

---

## Key Decisions & Trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **No LLM in policy engine** | Ensures deterministic, auditable decisions | More upfront work to design the rules |
| **Real Razorpay, test mode only** | No guessing on balance; live reserve checked every time | Test mode only — no live production yet |
| **Agent container vs. direct** | Purchase Agent runs locally (not in Nasiko) | Cannot easily scale Purchase Agent horizontally; must co-locate with gate |
| **Mandate expiry, not refresh** | Clear, human-visible boundaries | Time-boxed; human must re-sign for longer periods |
| **Idempotent by request ID** | Prevents double-charging on retries | Requires tracking request IDs across runs |

---

## Tech Stack

- **Language:** TypeScript · Node 20+
- **Policy engine:** Hand-written pure function (no framework)
- **Signing:** `node:crypto` Ed25519
- **Payments:** Razorpay REST API (test mode only)
- **Browser automation:** `@agentrhq/webcmd` (109 sites, 807 commands, 230 write)
- **Dashboard:** Next.js 16 · React 19 · Tailwind v4 · shadcn/ui
- **Tests:** `node:test` — **702 passing**

---

## Demo & Quickstart

```bash
# Full demo (no merchant logins or Razorpay keys needed)
npm install && npm run demo:agents

# Run for real
npm run build
npm run agents                                      # four agents as A2A servers
node dist/cli/shop.js run "cheapest 2kg atta under ₹300" --mode test
```

---

## Deployment Strategy

### Agents via Nasiko (Docker)
```bash
# 1. Start Nasiko control plane
docker compose up -d    # localhost:8080

# 2. Deploy agents
NASIKO_PASSWORD=<pwd> VITTA_DASHBOARD_URL=http://host.docker.internal:3000 \
  node nasiko/deploy.js all --upload

# 3. Configure Vitta
export NASIKO_URL=http://localhost:8080
export NASIKO_AGENT_ID_PLANNER=...
# (all four agent IDs)

# 4. Run a request
node dist/cli/shop.js run "cheapest 2kg atta under ₹300" --mode test
```

### Purchase Agent (Local)
```bash
# Run locally next to the gate (has access to mandates, keys, webcmd)
node dist/agents/serve.js purchase

# Configure:
export VITTA_AGENT_PURCHASE_URL=http://127.0.0.1:9104
# (leave NASIKO_AGENT_ID_PURCHASE unset)
```

---

## What's Left to Verify

- A real purchase through Nasiko (needs `webcmd` with logged-in sessions + funded mandate)
- Agent OpenTelemetry spans beyond Nasiko's `a2a.dispatch`
- Rust `nasiko` CLI path (`nasiko validate` / `nasiko deploy`)
- Agent → agent ACL in Nasiko
