# 07 — Scaling Path (Post-Hackathon, Not Phase 1)

Do not read this for the purpose of building anything before 1 August 2026. This file documents what changes if Mandate Gate becomes a real, ongoing product instead of a single hackathon demo — and just as importantly, what does NOT need to change, because it was already built correctly. Nothing in this file is a Phase 1 task.

## Verdict: the current stack does not need to change for Phase 1

Backend: Node.js ≥20, TypeScript, flat JSON files + Dodo's hosted Credit-Based Billing ledger, `@agentrhq/webcmd@0.4.3`. Dashboard: Next.js (App Router) + Tailwind CSS, read-only. This is the right stack for the 72-hour deadline. Reasoning, checked on merit rather than habit:

- **Node/TypeScript is not really a choice — it's a constraint.** `@agentrhq/webcmd` is a Node package with no equivalent API surface in another language. Building the gating layer in Python or Go would mean shelling out to a Node subprocess anyway, which adds a process boundary and serialization overhead for zero benefit. TypeScript throughout (backend, Dodo's official SDK, Next.js dashboard) also means `Mandate`, `GateEvent`, and `Receipt` are the same types everywhere, no translation layer needed.
- **Flat JSON files are correct at this scale**, not a shortcut taken under pressure. One human, one agent, one mandate, running for a few hours on one machine has no concurrent-write problem a database would solve. Introducing Postgres now would cost real build-hours (schema, migrations, a connection pool, ORM setup) for zero user-facing benefit before Saturday.
- **The `Ledger` interface and the `GateEvent` contract already exist so that scaling later doesn't require a rewrite.** This is the actual point of the Phase 1 discipline established in `01-ARCHITECTURE.md`: the boring parts (a JSON file, a flat log) are swappable without touching `decide()`, the CLI, or the dashboard's read contracts. Scaling this system later is a data-layer swap, not an architecture change — see the table below.

If anything in this project's docs seemed to suggest the current stack was a placeholder to "fix later," that's not accurate — it was chosen deliberately for the constraints that actually apply before 1 August.

## What changes if this becomes a real, ongoing product — later, not now

| Concern | Phase 1 (now) | At real scale (only if this continues past the hackathon) |
|---|---|---|
| Mandate/receipt storage | Flat JSON files (`mandates/*.json`, `receipts/*.json`) | Postgres, one row per mandate/receipt. The `Mandate` and `Receipt` TypeScript interfaces become the table schemas almost unchanged — this is a migration, not a redesign, because the shapes were already stable contracts. |
| Event log | Append-only `events.jsonl` | A Postgres table indexed on `mandate_id`/`ts`, or a real event stream (e.g. Kafka, SQS) if multiple independent services need to subscribe. `GateEvent`'s shape doesn't need to change — only where it gets written. |
| Concurrency / multi-agent | One human, one agent, one mandate (explicit non-goal for Phase 1) | Multiple concurrent mandates need row-level locking or optimistic concurrency on the ledger-balance check before `decide()` is called. `decide()` itself needs zero changes — it already takes the current balance as a plain argument; only the caller that fetches that balance needs a transactional read. |
| Auth | None (explicit non-goal) | Real auth for mandate issuers (humans) and agent identity (subjects). This sits entirely outside `decide()` and the `GateEvent` schema, so it's purely additive. |
| Dashboard data access | Direct file reads + a second, deliberately duplicated Dodo balance call (see `06-DASHBOARD-SPEC.md` for why duplication was the right call at this scale) | Once a real database exists, the duplication argument disappears on its own — the dashboard's API routes query the same database the backend writes to. A shared `packages/types` workspace becomes worth its setup cost once there's more than one short-lived hackathon build to justify it. |
| Observability | Terminal UI + dashboard only | Structured logging and tracing (e.g. OpenTelemetry) across `decide()` calls, webcmd invocations, and Dodo API calls — useful once there's an on-call rotation, not before. |
| Multi-agent programmatic access | Phase 3 MCP server stub only | This is already the correct long-term answer to "how does this scale to being called by many agents or external systems." No new stack decision needed — build the Phase 3 stub for real. |

## What should never change, at any scale

- `PolicyEngine.decide()` stays a pure, synchronous function with zero I/O. Every row in the table above is possible only because this holds — don't let a future request to "just add a cache lookup inside `decide()`" break it.
- Fail-closed behavior on unknown/unparseable/expired/invalid input.
- `GateEvent` as the single schema every consumer reads. Extend it with new optional fields if a real need arises; never restructure or remove existing fields out from under something already reading them.

## When to act on this file

Not before 1 August 2026, and not at all unless Mandate Gate is continuing as a real product after the hackathon. This file exists so a real infrastructure decision (Postgres? a message queue? multi-tenant auth?) doesn't get made under hackathon time pressure, and so flat JSON files are never mistaken for a design mistake in a future review — they were the correct choice for what Phase 1 actually needed to do.
