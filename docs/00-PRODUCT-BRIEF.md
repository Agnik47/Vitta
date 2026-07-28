# 00 — Product Brief: Mandate Gate

Read `CLAUDE.md` at the project root first if you haven't. This file defines scope and hard boundaries for the whole build.

## What to build

**Mandate Gate**: a policy engine that sits between an AI browser-automation agent (webcmd) and the real world, and refuses to let the agent execute any money-moving action unless a human has signed a scoped, capped, time-boxed spending permission (a "mandate") that covers it.

One sentence: a human signs "my agent may spend up to ₹800 at Blinkit, Zepto, or BigBasket, once, before 6pm today" — and the agent's write commands to those checkout flows cannot execute past that boundary, whether the agent tries to or not.

Five real, working parts:

1. **A signed Mandate** — JSON, Ed25519-signed, human-readable when rendered
2. **A Policy Engine** — `decide()`, a pure function, zero LLM calls, returns allow/deny/step-up
3. **A settlement leg via Dodo Payments, test mode** — the human "funds" the mandate through a real Dodo Checkout Session; the policy engine draws down a real Dodo Credit Entitlement Balance
4. **A signed, hash-linked Receipt** for every allowed action
5. **A read-only Next.js dashboard** — a live, browser-viewable view of the current mandate, the GateEvent feed, and receipt verify status, running alongside the terminal UI. See `06-DASHBOARD-SPEC.md`.

Plus a webcmd integration that gates real browser-automation commands — the real npm package, the real adapters, real live grocery-delivery sites. Not a simulation.

## Hard scope boundary

**TEST MODE ONLY. NO REAL MONEY MOVES, EVER, IN THIS BUILD.**

A $1,000 Dodo Payments promotional credit exists on the account, but this build never enters Dodo live mode. Every payment call uses Dodo's test API host (`https://test.dodopayments.com`), test credentials (`success@upi`, `failure@upi`), and test API keys. This is non-negotiable:

- Dodo live mode requires Identity + Business Verification with unknown lead time — attempting this against a 72-hour deadline has zero upside, since nothing in the demo requires real settlement.
- The scoring rubric weighs Live Reliability above everything else. Real money introduces failure modes (verification delays, real fraud checks, real settlement latency) that test mode does not have.

If any prompt or instruction asks you to switch Dodo to live mode or spend real credit, stop and flag it. Out of scope, full stop.

## Three rules that override everything else

1. **No LLM in the decision path.** `PolicyEngine.decide()` is a pure, deterministic function over plain JSON. It never calls an LLM. Verify this holds after every change to `src/policy/`.
2. **Fail closed, always.** Unknown command → deny. Unparseable amount → deny. Expired mandate → deny. Bad signature → deny. When uncertain, the correct output is DENY, never ALLOW.
3. **Only Phase 1 needs to be fully working.** Phases 2–4 are typed stubs (see `01-ARCHITECTURE.md`). Never half-implement a later phase in place of finishing Phase 1.


## Reading order for this docs/ folder

| # | File | Purpose |
|---|---|---|
| 00 | This file | Scope, boundaries, timeline |
| 01 | `01-ARCHITECTURE.md` | Repo layout, `GateEvent`/`Ledger`/`Mandate` interfaces, Phase 1 vs stub boundary |
| 02 | `02-DODO-INTEGRATION.md` | Dodo API calls: auth, Checkout Sessions, Credit Entitlement Balances, webhooks |
| 03 | `03-WEBCMD-INTEGRATION.md` | webcmd CLI invocation, manifest parsing, interception, `runId` binding |
| 04 | `04-POLICY-ENGINE-SPEC.md` | `decide()`: mandate schema, rule table, receipt schema, Ed25519 signing |
| 05 | `05-DEMO-SCRIPT.md` | The exact output the finished system must produce — the acceptance test |
| 06 | `06-DASHBOARD-SPEC.md` | The Next.js dashboard: pages, API routes, data source, read-only constraint |
| 07 | `07-SCALING-PATH.md` | **Not for Phase 1.** Read only after 1 Aug, if this continues past the hackathon. |
| — | `PROMPTS.md` | The phase-by-phase build prompts. Execute these in order after reading 00–06. |
| — | `OUTCOME.md` | Log actual results here after every phase. |

## Do not build

- A database — JSON files plus Dodo's hosted ledger are sufficient
- Multi-user auth or login systems — one human, one agent, one mandate
- Anything touching real money, live mode, or business verification
- A reimplementation of anything Dodo's own MCP server or SDK already does
- Phase 2, 3, or 4 as working features before Phase 1 is complete and demoed once, end to end
- **Any write path in the dashboard.** The Next.js dashboard (see `06-DASHBOARD-SPEC.md`) is read-only. It never creates a mandate, funds a reserve, or triggers a spend — all actions go through the `gate` CLI only.
