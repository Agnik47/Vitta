# Vitta on Nasiko

Nasiko is the **control plane** for Vitta's four shopping agents: it registers them, routes calls to
them, and traces each hop. It is not a policy engine — spending authority stays with Vitta's gate.

| | Responsibility |
|---|---|
| **Nasiko** | agent registry & identity, routing (`/api/orchestrator/a2a`), per-hop traces, agent lifecycle |
| **Anakin** | the agents' access to the web (product search, via the dashboard's Anakin-first source) |
| **Vitta** | mandates, `decide()`, the real-cart pricing, the reserve ledger, receipts |
| **Razorpay** | the test-mode order that is the funded reserve the gate draws from |

## Status — read this first

What has been **verified** (run, not assumed):

- Each agent serves the A2A contract Nasiko documents — `GET /` health (200), unauthenticated
  `GET /.well-known/agent-card.json`, JSON-RPC `message/send` returning the documented
  `result.task.artifacts[].parts[].text` shape — checked over real HTTP, and from inside a built
  Docker image (`docker build` + `docker run` of the Planner, then `curl`).
- A W3C `traceparent` sent with a request reaches the agent and is echoed in its correlation, and the
  orchestrator gives every hop its own span under one trace id (`src/agents/*.test.ts`).

Verified against a **real local Nasiko** (the Docker Compose stack from `Nasiko-Labs/nasiko`, dashboard
on `localhost:8080`; no Rust needed). `bash nasiko/deploy.sh all --upload` imported the Planner, Discovery
and Evaluator through `POST /api/import/upload`; Nasiko built and started all three, and dispatch through
`POST /api/orchestrator/a2a` worked hop by hop (Planner, Discovery and Evaluator each answered through
Nasiko). Running it against the real thing turned up three mismatches with what the docs suggested, all
fixed in `src/agents/a2a.ts` and pinned in `a2a.test.ts`:

1. The orchestrator only deserializes the A2A v1 enum role — `ROLE_USER` — and answers 400 to `user`.
2. Nasiko calls agents with the v1 method names: `SendStreamingMessage` first, then `SendMessage` when the
   agent answers with a JSON-RPC error. The agents used to serve only `message/send`, so both attempts
   failed and Nasiko relayed the placeholder "No response". They now serve both spellings.
3. The orchestrator always replies as an event stream (`text/event-stream`), even for a plain send. The
   client now reads the `artifactUpdate` events.

Also verified, once Anakin had credits: a request with no buy words ran Planner → Discovery → Evaluator
through Nasiko on live Anakin results (15–30 real candidates; Blinkit fails in the container because
`webcmd` is not in the image) and ended `NO_PURCHASE`, the Purchase hop skipped. Two limits you will meet:

- Nasiko's shared HTTP client cuts every agent call off at 60 s, so Discovery gives each merchant search its
  own 50 s deadline (`VITTA_DISCOVERY_TIMEOUT_MS`); a slow merchant is then one recorded failure, not a dead hop.
- The dashboard's Anakin key can be overridden by a stale `ANAKIN_API_KEY` in `dashboard/.env.local`
  (`runtime-env.ts` lets it win over the root `.env`) — an out-of-credit key there shows up as HTTP 402.

Traces: Nasiko keys its trace view by its own id, announced in each dispatch stream's `trace_meta` event, not by
our `traceparent` (looking ours up returns 404). The client now captures that id and stores it on each stage as
`nasiko_trace_id`; `shop run` prints them, and `GET /api/observability/trace/<id>` resolved each to an
`a2a.dispatch` span (allow a few seconds — Nasiko indexes a trace shortly after the call). The Purchase hop is
direct, so it has none.

What has **not** been verified:

- A real purchase. The Purchase agent was reached directly with a synthetic proposal and failed closed at the
  empty-cart check (`spawn webcmd ENOENT`) before the gate ran — nothing spent, no mandate touched. A run that
  actually buys needs `webcmd` with logged-in merchant sessions and a funded Razorpay mandate on the machine
  running the gate; neither was available. The Evaluator's proposal-to-purchase handoff is covered by unit tests.
- Whether the agents' own OpenTelemetry spans (beyond Nasiko's `a2a.dispatch` span per hop) show up.
  **The dashboard's trace panel shows only what Nasiko actually returns — it invents nothing.**
- The Rust `nasiko` CLI path (`nasiko validate` / `nasiko deploy`): `deploy.sh` without `--upload` still
  calls it and has not been run.
- Agent → agent ACL. Not used: the orchestrator calls each agent itself (Nasiko's agent→agent calls
  are default-deny and the open-source edition has no endpoint to grant them).

## Deploy

```bash
# 1a. a control plane, Docker only (the route used to verify this) — the Nasiko quickstart, Part 1
git clone https://github.com/Nasiko-Labs/nasiko.git && cd nasiko && cp .env.example .env   # set ADMIN_PASSWORD, OPENAI_API_KEY, SECRETS_ENCRYPTION_KEY, JWT_SECRET
docker compose up -d                                       # dashboard + API on http://localhost:8080
# 1b. …or the Rust CLI route (needs Rust) — https://docs.nasiko.com/quickstart
#     git clone https://github.com/Nasiko-Labs/nasiko-rs.git && cd nasiko-rs && cargo install --path cli --force && nasiko up && nasiko auth login

# 2. stage + deploy the agents (from the Vitta repo)
bash nasiko/deploy.sh all --dry-run        # stage only; also what CI can run
# Docker route — no CLI: zips each project and POSTs it to /api/import/upload. `all` skips `purchase`.
NASIKO_PASSWORD=<admin password> VITTA_DASHBOARD_URL=http://host.docker.internal:3000 bash nasiko/deploy.sh all --upload
# CLI route:
bash nasiko/deploy.sh planner              # or discovery | evaluator | purchase | all
# Re-running --upload redeploys an existing agent as the next patch version (Nasiko refuses a version it has seen).
# Not `/api/agents/upload`: that one insists on a Python main.py and rejects these Node agents.

# 3. tell Vitta where they are (.env) — --upload prints the ids; the CLI route writes <stage>/.nasiko/agent.json
NASIKO_URL=<the control plane, e.g. http://localhost:8080>
NASIKO_TOKEN=...   # from POST /api/auth/login {"username":"admin","password":…} → .token (valid ~7 days)
NASIKO_AGENT_ID_PLANNER=...  NASIKO_AGENT_ID_DISCOVERY=...  NASIKO_AGENT_ID_EVALUATOR=...  NASIKO_AGENT_ID_PURCHASE=...

# 4. run a request; every hop now goes through Nasiko
node dist/cli/shop.js run "cheapest 2kg atta under ₹300" --mode test
```

Then open Nasiko's dashboard → Observability and search for the "Nasiko traces" ids the CLI prints under the
stages (one per hop dispatched through Nasiko; they are also stored on each stage of the run record as
`nasiko_trace_id`). The `trace` id on the run's header line is Vitta's own W3C trace id, which Nasiko does not
index. Agents that need secrets get them the Nasiko way — `--upload` sets
`VITTA_DASHBOARD_URL` on Discovery for you (the CLI route: `nasiko secrets set VITTA_DASHBOARD_URL …
--agent vitta-deal-discovery`); a deployed container does not read your `.env`. Discovery reaches the
dashboard's Anakin-first search from inside Docker via `http://host.docker.internal:<dashboard port>`.

## The Purchase Agent is different

The Planner, Discovery and Evaluator are pure or network-only and containerize cleanly. The **Purchase
Agent** is not: it spawns the `gate` CLI, which needs the signed mandates and keys directories, Razorpay
test credentials, and a `webcmd` with logged-in merchant browser sessions — state that lives on a user's
machine, not in an image. `nasiko/Dockerfile` builds it (it starts, and refuses every purchase for
want of a mandate), but a container that can really buy needs those mounted, and Nasiko's docs do not
cover registering an agent that runs outside its own containers. Until that is settled, run the
Purchase Agent next to the gate (`node dist/agents/serve.js purchase`) and register only the other three
in Nasiko. Set `VITTA_AGENT_PURCHASE_URL=http://127.0.0.1:9104` (leave `NASIKO_AGENT_ID_PURCHASE` unset):
an explicit per-agent URL keeps that hop direct while the rest go through Nasiko. The run record and the
dashboard say which hops were direct. Nasiko can only trace the hops it dispatched, so the Purchase
Agent's hop is expected to appear only in Vitta's own run record (unconfirmed until run against Nasiko).

## Files

- `agents/<name>/AgentCard.json` — generated from `src/agents/registry.ts` (`npm run nasiko:cards`); a test fails if they drift.
- `Dockerfile` — one recipe, `AGENT` selects the agent; `deploy.sh` stages one project dir per agent.

> **`VITTA_DASHBOARD_URL` is baked into the Discovery container when it is deployed** — the container does not read `.env` or the caller's environment. If Discovery searches through a dashboard that is not the one you are running (or one on an older build), its results silently lack whatever that build lacks. Point it at the dashboard you actually use and redeploy:
> `VITTA_DASHBOARD_URL=http://host.docker.internal:3000 bash nasiko/deploy.sh discovery --upload`. Check what a running container has with `docker exec <discovery container> printenv VITTA_DASHBOARD_URL`.
