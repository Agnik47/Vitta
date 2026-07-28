# 05 — Phase Ownership and Sync Points

This is the split: who builds what, in what order, and the exact points where the two of you must stop and synchronize before continuing. This is not a 50/50 file-count split — it follows the actual data/import dependencies already established in `docs/01-ARCHITECTURE.md` and `docs/PROMPTS.md`. The full reasoning, alternatives considered, and rejection notes live in `02-DECISIONS.md` (ADR-002) — this file is the operational reference; read that ADR once for the "why," come back here for the day-to-day "what."

## The split, and why (short version — see ADR-002 for the full case)

`decide()` takes `ledgerBalanceInr` and `txnCountSoFar` as plain numbers (`docs/04-POLICY-ENGINE-SPEC.md`) — it never imports `DodoCreditLedger` or webcmd's manifest loader directly (`docs/01-ARCHITECTURE.md` § `Ledger` interface). That's the seam the whole project's modularity claim rests on, and it's also the seam that makes two-agent parallelism real instead of nominal:

- **Agent A owns the "pure logic" chain**: mandate → policy → receipts → CLI. These phases depend on *each other* in sequence, so they stay with one agent to avoid a mid-stream handoff every few hours.
- **Agent B owns the "I/O rails"**: Dodo ledger and webcmd. These depend on nothing but the interfaces Phase 0 defines — not on each other, and not on any implementation detail inside `src/mandate` or `src/policy`.
- **Agent B then moves to the dashboard** once `1b` and `1e` land — `docs/PROMPTS.md` itself flags this as the parallel-friendly option. The dashboard is `dashboard/`, a fully separate app with its own `package.json` — zero file overlap with Agent A.

Net effect: for nearly the entire build, the two of you are editing disjoint directories. The only points that require a real handoff are the Sync Points below.

## Ownership table

| Phase | Prompt (`docs/PROMPTS.md`) | Owner | Depends on | Owns (folders/files) |
|---|---|---|---|---|
| 0 — Scaffolding | Phase 0 | Agent A (default — see Sync Point 1) | none | whole repo skeleton, `package.json`, `tsconfig.json`, `.env.example` |
| 1a — Mandate/signing | Phase 1a | Agent A | Phase 0 | `src/mandate/` |
| 1b — `decide()` | Phase 1b | Agent A | 1a | `src/policy/` |
| 1e — Receipts/chain | Phase 1e | Agent A | 1a | `src/receipt/` |
| 1f — CLI/UI | Phase 1f | Agent A | 1a, 1b, 1e, **and** 1c, 1d (Sync Point 3) | `src/cli/`, `src/events/` |
| 1g — E2E run | Phase 1g | Agent A (B on call to debug their own modules) | 1f | none — a test run, updates `docs/OUTCOME.md` |
| 1c — Dodo ledger | Phase 1c | Agent B | Phase 0 | `src/ledger/` |
| 1d — webcmd | Phase 1d | Agent B | Phase 0 | `src/webcmd/` |
| 1h — Dashboard | Phase 1h | Agent B | 1b + 1e (Sync Point 4); shell can start after 1c/1d | `dashboard/` (entire app) |
| 2-4 — Stub verify | Phase 2-4 | Either, whoever is idle | Phase 0 | `src/phase2-4-stubs/` (verify only — no feature work) |
| 5 — Rehearsal | Phase 5 | Both, jointly, live | 1g **and** 1h | none — a checklist, run together |

`src/events/GateEvent.ts` is created once during Phase 0 and is jointly owned in the sense that everyone reads it — but per `docs/01-ARCHITECTURE.md`, it's frozen from day one ("populate every field... never restructure it later"). Neither agent should need to touch it again after Phase 0. If one of you thinks it needs to change, that's a `03-INTERFACES.md` change-protocol event (and likely a `02-DECISIONS.md` ADR), not a quick edit.

## Sync points — the only places you must stop and coordinate

**Sync Point 1 — after Phase 0.** Agent A runs Phase 0 by default, commits, pushes, and posts in `08-CHANGELOG.md`. Agent B does not write any code file until they've pulled this. If Agent A isn't available first, Agent B may run Phase 0 instead — it's ownership-agnostic scaffolding. Whoever does it announces it; the *other* agent is the one who must pull before starting.

**Sync Point 2 — fan-out.** Once Phase 0 is pulled, Agent A starts 1a → 1b → 1e in sequence. Agent B starts 1c and 1d (either order, or interleaved — they don't depend on each other). Fully parallel, disjoint folders, no coordination needed until the next sync point.

**Sync Point 3 — before 1f (CLI wiring).** `1f` imports both the ledger (`src/ledger`) and webcmd (`src/webcmd`) modules, so Agent A needs Agent B's 1c *and* 1d done, tested, and pushed first. Nuance: not every `gate` subcommand needs both — `gate mandate create`, `gate mandate resign`, `gate receipt show`, and `gate verify` don't touch webcmd or the ledger's `draw()`/`balance()` at all. Agent A can implement and test those subcommands as soon as 1a/1b/1e are ready, without waiting. Only `gate run` and `gate fund` are blocked on Agent B's modules. If Agent B is behind, Agent A should build the non-blocked subcommands, or pick up Phase 2-4 stub verification as filler — not sit idle, and not start guessing at `src/ledger`/`src/webcmd`'s shape to avoid waiting.

**Sync Point 4 — before 1h's data-reading logic.** The dashboard's *app shell* (Next.js scaffold, `package.json`, folder structure, static layout) doesn't need frozen schemas and can start as soon as Agent B is done with 1c/1d. The API routes that actually read `mandates/*.json`, `receipts/*.json`, and `events.jsonl` do need `1b` (decide()/types) and `1e` (receipt schema + chain-walking logic) finished and pushed, per `docs/PROMPTS.md` Phase 1h's own prerequisite note. Agent B pulls before writing those specific routes.

**Sync Point 5 — before 1g (E2E run).** Needs `1f` fully done. Agent B doesn't need to be involved, but should pull Agent A's latest before continuing their own dashboard work, since 1g may surface a bug that changes a shared schema.

**Sync Point 6 — Phase 2-4 stub verification.** No real coordination needed; whichever agent has downtime does it. Trivial, low-conflict, `git pull --rebase` before and after is enough.

**Sync Point 7 — Phase 5 rehearsal.** This is the one phase that is genuinely joint, not just synchronized async — both agents (or the user, running both agents' finished work together) need to run the CLI and dashboard side by side, confirm they're independent (kill the dashboard mid-run, confirm the CLI is unaffected per `docs/06-DASHBOARD-SPEC.md`'s acceptance checklist), and time the full sequence. Schedule this as a live joint session, not an async handoff.

Track live readiness for each of these in `01-PROJECT-STATUS.md`'s Integration & Merge Readiness table — this file describes the process, that table tracks whether you've actually cleared each gate right now.

## What "balanced" means here

This isn't 50/50 by phase count (Agent A: 0, 1a, 1b, 1e, 1f, 1g — six items; Agent B: 1c, 1d, 1h — three), but it's balanced in real effort: `1f`/`1g` are integration-heavy wiring-and-debugging work, and `1h` is a full Next.js app with three pages, three API routes, and its own acceptance checklist (`docs/06-DASHBOARD-SPEC.md`) — not a small task. The split was chosen to maximize the *time* both agents spend working in parallel on disjoint files, not to make the phase list look even.

## If disjoint ownership breaks down in practice

If you find yourselves repeatedly needing to touch the same files despite this split, or a Sync Point keeps leaving one agent idle longer than expected, don't quietly work around it — write an ADR in `02-DECISIONS.md` proposing a different split, get it into `01-PROJECT-STATUS.md`, and adjust. The split is a means to an end (parallel throughput), not a rule to preserve for its own sake.
