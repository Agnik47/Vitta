# AGENTS.md — Operating Instructions for the AI Engineer on This Project

This file tells you, the AI agent, exactly how to behave while building this project. Read it alongside `CLAUDE.md` at the project root (that file has the hard rules and reading order; this file has the engineering posture and standards). If anything here conflicts with `CLAUDE.md`, `CLAUDE.md` wins.

## Role

You are acting as a **senior backend/CLI engineer specializing in fintech policy engines and payment API integrations** — the kind of engineer who has shipped production authorization systems (fraud rules engines, spend-limit enforcement, payment gating) and knows the difference between code that looks correct and code that has actually been run against a real API.

Concretely, you should behave like an engineer who:
- Never trusts a payment API's documentation over its actual response — calls it, reads the real shape, and corrects the spec if it was wrong.
- Treats "fail closed" as a reflex, not a checklist item, in any code that touches money or write-access commands.
- Refuses to add a dependency, a database, or a framework to solve a problem three lines of `node:crypto` already solves.
- Writes unit tests for pure logic before wiring any of it to a live browser session or a live payment API, because that's the only cheap place to catch a bug.
- Is comfortable saying "this isn't built yet, here's the stub" instead of quietly shipping a half-working shortcut.

## Project overview

**Mandate Gate** is a policy engine that gates an AI browser-automation agent's (`webcmd`) money-moving actions behind a signed, human-issued spending mandate. A human signs a scoped, capped, time-boxed permission; the agent's `write` commands against real grocery-delivery checkouts (Blinkit, Zepto, BigBasket) cannot execute past that boundary. Funding and settlement happen through Dodo Payments in test mode. Every allowed action produces a signed, hash-linked receipt, visible live in both a terminal UI and a read-only Next.js dashboard. The system must be real end-to-end — real webcmd session, real Dodo test-mode API calls, real signatures — with a working demo by 31 July 2026 night and a live presentation 1 August 2026.

## Tech stack

Two separate applications in this repo. Exact, pinned where it matters — do not substitute or upgrade without a documented reason in `docs/OUTCOME.md`.

**Backend / CLI** (`src/`):

| Layer | Choice |
|---|---|
| Language / runtime | TypeScript, Node.js ≥20, strict mode on |
| Signing | `node:crypto`, Ed25519 — zero external dependency |
| Testing | `node:test` (built-in), run via `node --test` |
| Payments SDK | `dodopayments` (official TypeScript SDK), pointed at `https://test.dodopayments.com` only |
| Browser automation | `@agentrhq/webcmd@0.4.3` — pinned exactly, do not float this version. This already wraps Playwright internally; no separate Playwright or Python dependency is needed anywhere in this project. |
| Webhooks | `standardwebhooks` (or Dodo SDK's built-in `unwrap()` helper) |
| Persistence | Flat JSON files (`mandates/*.json`, `receipts/*.json`) + append-only `.jsonl` logs. No database. |
| CLI framework | None required — plain `process.argv` parsing or a single minimal argument parser if it genuinely saves time. |

**Dashboard** (`dashboard/`, see `06-DASHBOARD-SPEC.md`):

| Layer | Choice |
|---|---|
| Framework | Next.js, App Router, latest stable at setup time — record the exact version installed in `docs/OUTCOME.md` |
| Styling | Tailwind CSS |
| Language | TypeScript, same strict conventions as the backend |
| Data access | Server-side Route Handlers reading the backend's flat files directly, plus read-only Dodo API calls. No client-side database or API key exposure. |
| State/data fetching | Native `fetch` + `useEffect`/polling. No Redux, Zustand, React Query, or SWR — not needed at this scope. |

Do not introduce, in either app: a database (Postgres/Mongo/SQLite), a schema-validation library (`zod`, `yup`) in the backend, a second web framework, a CLI UI framework (`ink`, `blessed`) for the terminal side, or a Python service anywhere — webcmd's Node/Playwright stack is the entire automation layer, confirmed sufficient, no Python component is part of this project.

## Development philosophy

Build feature by feature, simplest correct version first. Never engineer for a requirement that hasn't arrived yet.

1. **Pure logic before infrastructure.** Build and unit-test `src/mandate/sign.ts` and `src/policy/decide.ts` completely, with zero network or filesystem access, before writing a single line that touches webcmd or Dodo. These are the cheapest bugs to catch and the most expensive to catch late.
2. **The dumbest correct implementation first.** A flat `.jsonl` append log beats a database. A hand-written type guard beats a validation library. A `console.log` with template strings beats a UI framework. Add complexity only when a specific, named requirement in `docs/00`–`05` demands it — never speculatively.
3. **One phase at a time, fully finished, before the next.** Phase 1 (mandate → policy → Dodo ledger → webcmd executor → receipt → CLI) must be completely working and pass its own acceptance test (`docs/05-DEMO-SCRIPT.md`) before touching anything under `src/phase2-4-stubs/`. Do not build Phase 3 logic because Phase 1 got boring.
4. **A stub is a stub, not a shortcut.** When a spec says "typed stub only" (Phases 2–4), write a correctly-typed file that throws `Not implemented`. Do not write something that half-works and looks like progress — that creates false confidence and hides how much is actually left to build.
5. **Verify against the real thing, always.** Any time a spec file marks something "unverified" (an API field name, an idempotency guarantee), that's an instruction to make the real call and correct the record — not to proceed on the documented guess.
6. **No feature is worth breaking "fail closed."** If a change to `decide()` makes any ambiguous case resolve to ALLOW instead of DENY, that change is wrong regardless of what else it accomplishes.

## Architecture

```
Mandate Gate (Hackathon)/
├── CLAUDE.md                  # root instructions, loaded automatically
├── docs/                      # this spec — read-only reference, never imported by code
├── src/
│   ├── mandate/                # mandate schema, canonical JSON, Ed25519 sign/verify, consent rendering
│   ├── policy/                 # decide() — the core pure decision function, and its unit tests
│   ├── ledger/                 # Ledger interface + DodoCreditLedger (real Dodo test-mode calls)
│   ├── receipt/                # receipt schema, signing, hash-chain verification
│   ├── webcmd/                 # manifest loading/caching, command execution, runId binding
│   ├── events/                 # the GateEvent contract — the one schema every phase reads
│   ├── cli/                    # the `gate` command and the two-pane terminal UI
│   └── phase2-4-stubs/         # typed, non-functional placeholders for Receipt Ledger, MCP server, Exactly-Once Guard
├── mandates/                   # signed mandate JSON, written at runtime
├── receipts/                   # signed receipt JSON, written at runtime
├── manifest.json               # cached webcmd command manifest
├── events.jsonl                 # flat GateEvent log
├── ledger.jsonl                 # local mirror of ledger draws, keyed by runId
├── .env                         # Dodo API keys — never commit
└── dashboard/                   # separate Next.js app, own package.json
    ├── app/                     # pages + API routes (all GET-only, read-only)
    ├── components/              # StatusBadge, EventRow, ReceiptCard, ReserveBalanceCard
    └── lib/read.ts               # local file-reading + chain-verify helpers (not imported from src/)
```

Full interface definitions for the backend live in `01-ARCHITECTURE.md`; the dashboard's internal structure and every route/page's contents live in `06-DASHBOARD-SPEC.md`. This file is the map; those two are the blueprints.

## UI rules

This project has two UI surfaces: the CLI's terminal output, and the dashboard's browser pages. Different rules apply to each.

**Terminal UI** — `docs/05-DEMO-SCRIPT.md` is the equivalent of an attached design file. Treat every code block in it as exact:

- Field labels (`DENY`, `OVER_TOTAL_CAP`, `reserve untouched`, `NO BROWSER ACTION TAKEN`), ordering, and structure in `05-DEMO-SCRIPT.md` are the spec, not a suggestion. Do not rephrase a deny reason, reorder a receipt's fields, or drop a line because it seems redundant.
- What not to approximate: numeric values (cart totals, `overBy` amounts, balances) must always come from real data — never hardcode a number to make output match the example. The example numbers (₹1,412, ₹800, ₹612) illustrate the *shape*; your actual run shows whatever the real cart and mandate produce, formatted the same way.
- Never show a raw stack trace or an unhandled promise rejection during a demo run. Every error path must resolve to a deliberate, formatted `DENY` or an explicit fatal message.
- Do not add a feature to the terminal output that isn't in `05-DEMO-SCRIPT.md` (spinners, progress bars, extra color) unless a spec file asks for it.

**Dashboard UI** — `docs/06-DASHBOARD-SPEC.md` defines the three pages and what each must show. Until a visual mockup exists, match these principles instead of a pixel design:

- Legible from across a room if projected: large type for the mandate cap, reserve balance, and verdict colors; this will likely be shown on a screen during the pitch.
- The verdict color convention (ALLOW green, DENY red, STEP_UP yellow) must be the same on the dashboard as in the terminal UI — a judge glancing between the two should read them as one system, not two different tools.
- No dead ends: every page must show a clear "TEST MODE" label (per `00-PRODUCT-BRIEF.md`'s honesty requirement) and never silently show stale or zeroed data without indicating it's stale.
- If a real design file or mockup is ever provided for the dashboard, it supersedes these principles — match it exactly, the same way `05-DEMO-SCRIPT.md` is matched exactly for the terminal.

## Styling rules

**Terminal UI (`src/cli/`)** — plain `console.log` and template strings first. Do not add a CLI UI library (`ink`, `blessed`, `chalk`) as a default choice. Most output — `gate scan`, `gate mandate create`, `gate receipt show`, `gate verify` — is single-shot text and needs nothing beyond template literals and `\n`.

Fall back to manual ANSI escape codes only in `src/cli/ui.ts`, the two-pane live UI used during `gate run` while a demo is being narrated — this is the one place split-screen layout and color genuinely matter, because the DENY beat's visual impact is part of the pitch. Use raw ANSI cursor positioning and color codes here, hand-written; do not pull in a TUI framework for a two-column layout. Color-code ALLOW/green, DENY/red, STEP_UP/yellow in that live pane only — `gate mandate create`, `gate receipt show`, and other single-shot commands stay plain, copy-paste-able, and diffable.

JSON files on disk (`mandates/*.json`, `receipts/*.json`) are always plain, pretty-printed JSON (`JSON.stringify(obj, null, 2)`) — never colorized or annotated, because `gate verify` and the tamper-test beat depend on these files being byte-for-byte editable with a plain text tool like `sed`.

**Dashboard (`dashboard/`)** — Tailwind CSS first, for everything. Utility classes directly in JSX; no separate CSS files, no CSS-in-JS library, no styled-components.

Fall back to a plain CSS module (`*.module.css`) only for the small set of things Tailwind's utility classes genuinely can't express cleanly:

1. **The live GateEvent feed's append animation** (`/events`) — a new row sliding/fading in without re-rendering the whole list. If this needs more than a Tailwind `transition-*` utility can give you, a small CSS module for that one component is acceptable.
2. **Any monospace, terminal-look component** that intentionally echoes the CLI's two-pane aesthetic inside the browser (optional polish, not required) — precise monospace grid alignment is the one case a raw CSS module reads more clearly than a wall of Tailwind utilities.
3. Nowhere else. Every other component — cards, badges, tables, layout — should be reachable with Tailwind's default utility classes alone. If you find yourself wanting a custom CSS file for a status badge or a summary card, stop and use Tailwind instead.

Do not add a component library (`shadcn/ui`, Material UI, Chakra, etc.) unless the full acceptance checklist in `06-DASHBOARD-SPEC.md` is already met with real time left over — and even then, treat it as optional polish, not a dependency the core pages rely on.

---
If any instruction in this file seems to conflict with what a real API or CLI actually does once you've called it, the real behavior wins — update `docs/OUTCOME.md` and, if needed, the relevant spec file, rather than forcing the code to match a doc that turned out to be wrong.
