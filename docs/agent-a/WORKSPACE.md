# Agent A — Workspace

Read `docs/common/00-START-HERE.md` before this file, every session, if you haven't already this session.

## Role

You own the **pure-logic-and-integration chain**: Mandate → Policy Engine → Receipts → CLI/UI → the end-to-end acceptance run. This is the sequential backbone of Phase 1 — each of your phases imports from the one before it, which is why it's one continuous track rather than split further. See `docs/common/05-PHASE-OWNERSHIP.md` for the full rationale, and `docs/common/02-DECISIONS.md` ADR-002 for why this split beats a 50/50 one.

You also default-own **Phase 0** (whole-repo scaffolding) — see that file's Sync Point 1 for the exception case.

## Phases you own

| Phase | Status | Depends on |
|---|---|---|
| 0 — Scaffolding | ⏳ Not started | none |
| 1a — Mandate schema, canonical JSON, Ed25519 signing | ⏳ Not started | Phase 0 |
| 1b — Policy Engine `decide()` | ⏳ Not started | 1a |
| 1e — Receipts and verify chain | ⏳ Not started | 1a |
| 1f — CLI and two-pane UI | ⏳ Not started | 1a, 1b, 1e, **and Agent B's 1c + 1d** (Sync Point 3) |
| 1g — Full end-to-end run | ⏳ Not started | 1f |

Plus: Phase 2-4 stub verification and Phase 5 rehearsal are shared with Agent B — see `docs/common/05-PHASE-OWNERSHIP.md`.

## Folders/files you own

`src/mandate/`, `src/policy/`, `src/receipt/`, `src/cli/`, `src/events/` (frozen after Phase 0, see `docs/common/03-INTERFACES.md`), plus the repo-wide scaffolding from Phase 0 (`package.json`, `tsconfig.json`, `.env.example`, `src/phase2-4-stubs/*` stub contents).

Never edit `src/ledger/`, `src/webcmd/`, or `dashboard/` without flagging it first per `docs/common/06-SYNC-WORKFLOW.md` — those are Agent B's.

## Current task

_(Not started. First task: Phase 0 scaffolding, per `docs/PROMPTS.md` Phase 0 prompt and `docs/01-ARCHITECTURE.md` § Repo layout. Read `docs/00-PRODUCT-BRIEF.md` and `docs/01-ARCHITECTURE.md` in full first, per that prompt's own instruction.)_

## Status

⏳ Not started

## Progress log

_(Append new entries at the bottom, most recent last. Include date, what you did, what passed/failed, and anything the reader would need to resume mid-task.)_

- 2026-07-28 — Workspace file created as part of the parallel-development docs restructuring. No implementation work has started yet.

## Next steps

1. Confirm with the user (or the other Claude Code session) which agent identity you are, if ambiguous.
2. Run Phase 0 per `docs/PROMPTS.md`, confirm `tsc --noEmit` passes, push, log completion in `docs/common/08-CHANGELOG.md` and `docs/OUTCOME.md`.
3. Wait for nothing — proceed straight to Phase 1a once Phase 0 is committed (you don't need to wait for Agent B to pull before starting 1a, only Agent B needs to wait for your push).
4. Phase 1a → 1b → 1e in sequence, per `docs/common/05-PHASE-OWNERSHIP.md`.
5. At Sync Point 3 (before 1f), confirm Agent B's 1c and 1d are pushed and their manual test scripts pass locally for you (`docs/common/07-INTEGRATION.md`) before wiring the CLI's `gate run` / `gate fund` subcommands. The signature-only subcommands (`gate mandate create/resign`, `gate receipt show`, `gate verify`) can be built earlier if you're waiting.

## Known issues / rough edges

_(Running list of anything you're leaving unfinished, hacky, or worth a second look — not a bug tracker, just enough that the other agent (or you, next session) isn't surprised. Clear an item when it's fixed; move anything genuinely blocking into `docs/common/04-BLOCKERS.md` instead.)_

_(none yet)_

## Notes for Agent B

_(Use this section to leave context Agent B should know but that doesn't rise to the level of a changelog entry or a blocker — e.g. "I picked a ULID library approach for mandate_id, here's why" type notes. If it's a real design decision with alternatives, it likely belongs in `docs/common/02-DECISIONS.md` instead — use this section for lighter background.)_

_(none yet)_
