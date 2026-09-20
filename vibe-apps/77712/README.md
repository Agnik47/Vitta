# Vitta Agent Ops

## 1. Document control

| pluginId | App name | Status | Last updated | Authoring client |
|---|---|---|---|---|
| 77712 | Vitta Agent Ops | built and tested locally; **not yet pushed to Studio** (see section 11) | 2026-09-20 | Claude Code |

## 2. Executive summary

Vitta lets AI agents shop on a person's behalf without being trusted with their money: four cooperating agents (Planner, Discovery, Evaluator, Purchase) find and propose a purchase, and a separate spending gate is the only thing that can allow one. Nasiko registers and routes three of the agents. Today the only way to see what those agents did is to read run files and terminal output. Vitta Agent Ops gives an operator one screen to answer three questions: *what did the agents just do*, *which agents are live*, and *why would the gate refuse a purchase*. Success is an operator finding the step where a run stopped, and its plain-language cause, in under half a minute. The app is a read-only view over a snapshot of Vitta's own records; it cannot start runs, spend, or change anything.

## 3. Goals & non-goals

### 3.1 Goals

- An operator can list every recorded run with its outcome, when it ran, and how long it took.
- An operator can search runs, filter by outcome, and sort, and can page through them.
- Opening a run shows each agent's step, status and time, and for a failed run where it stopped and why, in plain language, with the full message one click away.
- The Agents view shows which agents run in Nasiko (with version) and which run beside the gate, plus what each agent can and cannot do.
- The Spending rules view lists the gate's refusal reasons in the order the gate applies them.

### 3.2 Non-goals / out of scope

- Starting a run, funding a mandate, approving or making a purchase. The app is read-only.
- Live data. There is no connector to Vitta or Nasiko (see Decisions log); the data is a dated snapshot.
- Mandates and reserve balances. No mandate existed in Vitta's data directory when the snapshot was taken, so none are shown rather than invented.
- Linking to Nasiko's trace view. Nasiko files traces under its own id, not the run's trace id (open issue).
- Authentication screens. Access is left to the DronaHQ portal.

## 4. Users & access

| Persona | Need |
|---|---|
| Operator | See what the agents did, find the failing step, know what is deployed |
| Reviewer | Understand why the gate refuses a purchase |

Access mode: `portal_auth`. There is no login screen; the app is meant to be opened by people already signed in to the DronaHQ portal. It stores and shows no personal data: request text, run ids and agent names only.

## 5. Functional requirements

| ID | Requirement | Acceptance criteria | Priority | Status |
|---|---|---|---|---|
| FR-1 | List recorded runs | Table shows when, request, outcome badge, four progress dots, total time; default newest first | Must | Done |
| FR-2 | Search runs | Debounced (300 ms) text search over request, run id, error and outcome text | Must | Done |
| FR-3 | Filter and sort | Outcome filter lists only outcomes present in the data; sort by newest, oldest, slowest | Must | Done |
| FR-4 | Paginate | Five rows per page, Previous/Next, "Showing a–b of n"; page resets when filters change | Must | Done |
| FR-5 | Run detail | Drawer with steps (agent, status, time, summary), request intent, mode, routing, trace id with copy | Must | Done |
| FR-6 | Explain failures | Failed run shows the stopping agent and a plain sentence; full technical message behind "Show full message" | Must | Done |
| FR-7 | Agent registry | Four agent cards with role, what it does and cannot do, where it runs, version, and completed/failed/skipped counts derived from the runs | Should | Done |
| FR-8 | Spending rules | Eight refusal codes in evaluation order with plain meaning, plus three notes (reads allowed, needs approval, agents cannot add money) | Should | Done |
| FR-9 | Empty and edge states | "No runs match" with Clear filters; Escape and backdrop close the drawer | Must | Done |

## 6. User stories (approved)

| # | As a… | I want… | So that… | Status |
|---|---|---|---|---|
| 1 | Operator | to see every shopping run with its outcome | I know what the agents did | Approved |
| 2 | Operator | to search, filter and sort runs | I can find a failure quickly | Approved |
| 3 | Operator | to open a run and see each agent's step and time | I can see where it stopped | Approved |
| 4 | Operator | to see which agents are live and their versions | I know what is deployed | Approved |
| 5 | Reviewer | a plain explanation of each refusal reason | I understand why a purchase was blocked | Approved |

Approval note: the requester delegated scope decisions ("as per project understanding and codespace understanding") instead of answering clarifying questions, so these stories were chosen from the Vitta codebase and recorded here as approved by that delegation.

## 7. Screens & UX

| Screen | Purpose | Primary actions | Empty / loading / error notes |
|---|---|---|---|
| Runs | Overview and history of runs | Search, filter, sort, page, open a run | Empty: "No runs match" + Clear filters. No loading state (data is local to the app). |
| Run details (drawer) | One run, step by step | Copy trace id, show full message, close | Failed runs open with the cause first |
| Agents | Registry of the four agents | Read only | — |
| Spending rules | Gate refusal reasons | Read only | — |

## 8. Data & integrations

- Mode: **independent**. No connectors, no SDK files, no `dronahq.connectors.json`.
- Entities (all inside `src/main.jsx`): `RUNS` (6 records), `AGENTS` (4), `RULES` (8), status maps.
- `RUNS` are real records exported from Vitta's run store (`node dist/cli/shop.js`, fields: run id, times, outcome, mode, request text, trace id, routing, per-agent stages, error, intent, proposal) on 2026-09-20. Agent versions are those registered in Nasiko that day. Rules are those coded in Vitta's `src/policy/decide.ts`.
- Business rules: outcome tones (ok / bad / hold / neutral) come from the status maps; the Failed banner uses the first stage whose status is `failed`; the total time is `completed_at − started_at`.

## 9. Non-functional / constraints

- OWASP-aligned codegen: all data is rendered as React text nodes; no `dangerouslySetInnerHTML`, `eval` or `document.write`; no secrets, tokens or connector ids in source.
- CDN scripts are limited to React 18, ReactDOM 18, Babel standalone and Tailwind (unpkg / Tailwind CDN), as the platform requires. Versions are pinned to major only (open issue).
- Full-height iframe shell: `#root`'s first child uses `h-[100dvh]`.
- Works at phone width (tables scroll horizontally; the drawer becomes full-width).
- Product language only in the UI; technical detail (the raw error message, the trace id) is behind explicit controls.

## 10. Decisions log

| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 2026-09-20 | Independent mode with a dated snapshot | A DronaHQ-hosted app cannot reach Vitta or Nasiko, which run on a local machine and expose no public URL | Dependent app with a REST connector (needs a public, authenticated endpoint that does not exist) |
| 2026-09-20 | Seed with real run records, not invented ones | The runs are Vitta's own (including five genuine failures with distinct causes), so the demo is honest | Hand-written sample rows |
| 2026-09-20 | No mandate or balance screen | Vitta's data directory held no mandate; showing amounts would be invention | A "Mandates" tab with placeholder figures |
| 2026-09-20 | Rules screen is reference only, no "check a purchase" simulator | Vitta's design is a single policy engine; a client-side copy of it could drift from the real gate | Client-side `decide()` replica |
| 2026-09-20 | Single `src/main.jsx` | Preview loads one Babel entry with no module resolution; the platform guidance prefers one file | Many component files (would not load in Preview) |
| 2026-09-20 | `portal_auth` access | The app shows agent activity; it should not be open to anyone with the link | `public` |
| 2026-09-20 | Clarifying-questions gate satisfied by the requester's delegation | Requester asked for the app to be built from project understanding | Asking before building |

## 11. Open issues & risks

- **Push to Studio is blocked (2026-09-20).** The app record exists (pluginId 77712) but every `vibe_write_file`, `vibe_list_files` and `vibe_save_app` call returns "Storage not configured", so the files are not in Studio and its preview is empty. This is a server-side setting of the DronaHQ MCP workspace, not an app defect. Retry the push once it is fixed (section 12).
- **Static data.** The snapshot goes stale as Vitta runs more requests. Fix: a dependent version once Vitta exposes an authenticated read endpoint.
- **Trace linking.** The run's trace id is Vitta's own; Nasiko records dispatches under a different id, so the id cannot be pasted into Nasiko's trace search. Needs Vitta to store Nasiko's `trace_meta` id.
- **Preview not confirmed by a browser.** The source was transpiled and server-rendered with React 18 (all screens, both drawer states, no errors) but Studio Preview has not been opened. If it is blank, read `logs/preview-run.json` first.
- **Pinned CDN versions.** React is pinned to major 18 only.

## 12. Session handoff (MCP continuity)

- Local mirror: `/Users/vidipghosh/Desktop/Vitta/vibe-apps/77712/` (Flow C, `mcp-local-mirror`). **Until a push succeeds, the local copy is the source of truth**; Studio has an empty app.
- To push: for each of `index.html`, `src/main.jsx`, `README.md`, `ARCHITECTURE.md` call `vibe_write_file` (pluginId 77712, full content), then `vibe_save_app`, then `vibe_preview_url`. If Preview is blank, read `logs/preview-run.json` first. Do not recreate the app or invent ids.
- Meanwhile the app runs as a plain static page: open `index.html` in a browser (it needs internet for the CDN scripts).
- To refresh the data: re-export runs from Vitta (`node dist/cli/shop.js list`, then `show <id>`), replace `RUNS` in `src/main.jsx`, update agent versions in `AGENTS`, save.

## 13. Project layout

| Path | Description |
|---|---|
| `index.html` | Full HTML document: React, ReactDOM, Babel, Tailwind CDNs, colour tokens, full-height styles, entry script |
| `src/main.jsx` | The whole app: data, helpers, UI primitives, Runs / Agents / Spending rules screens, shell |
| `README.md` | This document (requirements and handoff) |
| `ARCHITECTURE.md` | Technical design |
| `.dronahq/workspace.json` | Local mirror manifest (local copy only) |

## 14. Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
