# 08 — Changelog & Handoff Log (Append-Only)

A running, chronological log of every sync-worthy change either agent makes. Every entry doubles as the **handoff note** for whatever it describes — write it assuming the other agent will read only this entry, not this conversation, to know what to do next.

This is the lightweight, per-commit companion to two other logs — don't duplicate into them, cross-reference instead:
- `docs/OUTCOME.md` (existing, unchanged) stays the authoritative, detailed, per-phase log with full pasted terminal output, per `CLAUDE.md`'s existing rule.
- `docs/common/02-DECISIONS.md` holds the *reasoning* behind any real judgment call — link to an ADR number here rather than re-explaining alternatives inline.

**Rules:**
1. Always append at the bottom. Never edit or delete another agent's entry.
2. New entry every time you push something the other agent should know about — not just at phase boundaries.
3. Fill in every field. "Files touched: various" is not useful to someone deciding whether to pull before continuing. "Known issues: none" and "Testing status: not run" are both valid answers — just don't leave the field blank.
4. If two entries land near-simultaneously and conflict on merge, keep both, order by timestamp — see `06-SYNC-WORKFLOW.md` § Conflict resolution.

**Entry template:**

```
## [YYYY-MM-DD HH:MM] — Agent A/B — short title

**What changed:**
**Why:**
**Files touched:**
**Testing status:** (what was run, pass/fail — "not yet run" is honest and fine, "not applicable" if docs-only)
**Known issues:** (rough edges, TODOs left behind, or "none")
**Other agent needs to:** (specific action, or "none")
**Interface changes:** (none, or describe — and confirm 03-INTERFACES.md was updated; link an ADR number from 02-DECISIONS.md if one was warranted)
**Blockers introduced/resolved:** (none, or ref 04-BLOCKERS.md entry ID)
```

---

## [2026-07-28] — Restructuring session — Parallel development docs created

**What changed:** Created `docs/common/` (this file and its siblings), `docs/agent-a/WORKSPACE.md`, `docs/agent-b/WORKSPACE.md`, and added a short pointer section to root `CLAUDE.md` so any session that reads it discovers this structure.
**Why:** Two Claude Code instances are about to build this project in parallel on two machines, syncing through Git. This structure exists so both stay synchronized on current state, ownership, and interfaces without re-deriving it from scratch or drifting apart.
**Files touched:** `docs/common/00-START-HERE.md`, `01-PROJECT-STATUS.md`, `02-PHASE-OWNERSHIP.md`, `03-INTERFACES.md`, `04-SYNC-WORKFLOW.md`, `05-INTEGRATION.md`, `06-CHANGELOG.md`, `07-BLOCKERS.md`, `docs/agent-a/WORKSPACE.md`, `docs/agent-b/WORKSPACE.md`, `CLAUDE.md` (additive pointer only, no existing rules changed).
**Testing status:** Not applicable — documentation only, no code exists yet.
**Known issues:** None.
**Other agent needs to:** Both agents (A and B) should read `docs/common/00-START-HERE.md` in full before starting Phase 0 or any other work. Nothing has been built yet (`src/` and `dashboard/` don't exist) — this is pure setup ahead of Phase 0.
**Interface changes:** none — no code exists yet.
**Blockers introduced/resolved:** none.

---

## [2026-07-28] — Restructuring session (upgrade pass) — Decisions log added, reading order sequenced, handoff fields expanded

**What changed:** Renumbered `docs/common/` so the reading order is explicit from filenames (state docs `01-04` read fully every session, process docs `05-07` read once, this log `08` skimmed every session). Added `02-DECISIONS.md`, a genuinely new ADR-style log for architectural judgment calls — nothing like it existed before this pass. Added a live "Integration & Merge Readiness" table and an "At a glance" completed/active/pending rollup to `01-PROJECT-STATUS.md`. Expanded this file's entry template with `Testing status` and `Known issues` fields. Added an explicit "What 'merge' means here" and "Testing before merge" section to `06-SYNC-WORKFLOW.md` (previously implicit). Seeded `02-DECISIONS.md` with two real ADRs (ADR-001: trunk-based git workflow, ADR-002: the dependency-driven phase split) documenting decisions that were already made in the prior pass but not previously recorded with alternatives/impact/follow-up.
**Why:** The user asked for the workflow to explicitly support: recorded architectural decisions with alternatives considered, richer per-task handoff notes (testing status, known issues), a live integration/merge-readiness view, and a reading order sequenced by category (health → completed/active/pending → decisions → interfaces → blockers → then workspace). The prior structure covered status/interfaces/blockers/changelog well but had no dedicated decision log and left "merge"/"testing before merge" implicit rather than named.
**Files touched:** `docs/common/00-START-HERE.md` (rewritten), `01-PROJECT-STATUS.md` (expanded), `02-DECISIONS.md` (new), `03-INTERFACES.md` (change-protocol updated to require ADRs for frozen-contract changes), `04-BLOCKERS.md` (moved from old `07-BLOCKERS.md`, content unchanged), `05-PHASE-OWNERSHIP.md` (moved from old `02-PHASE-OWNERSHIP.md`, cross-references updated), `06-SYNC-WORKFLOW.md` (moved from old `04-SYNC-WORKFLOW.md`, merge/testing sections added), `07-INTEGRATION.md` (moved from old `05-INTEGRATION.md`, cross-references updated), `08-CHANGELOG.md` (this file, moved from old `06-CHANGELOG.md`, template expanded), `docs/agent-a/WORKSPACE.md` and `docs/agent-b/WORKSPACE.md` (cross-references updated to new file numbers, "Known issues" subsection added).
**Testing status:** Not applicable — documentation only, no code exists yet.
**Known issues:** None. The old filenames (`02-PHASE-OWNERSHIP.md`, `04-SYNC-WORKFLOW.md`, `05-INTEGRATION.md`, `06-CHANGELOG.md`, `07-BLOCKERS.md`) were deleted as part of this renumbering — confirm no external link or note refers to the old paths before relying on them.
**Other agent needs to:** Nothing yet — still pre-Phase-0, no work has started. Whichever agent starts first should follow the new `00-START-HERE.md` reading order as written.
**Interface changes:** None — no code contracts exist yet. This pass only restructured documentation.
**Blockers introduced/resolved:** none.

---

## [2026-07-28] — Agent A — Phase 0 complete: repo scaffolding

**What changed:** Ran `docs/PROMPTS.md` Phase 0. `npm init`, installed `typescript`/`ts-node`/`@types/node` (dev) and `dodopayments` (prod), wrote `tsconfig.json`, created the full `src/` tree from `docs/01-ARCHITECTURE.md` § Repo layout (one-line comment stubs for every Phase 1 file, real typed stub content for the four Phase 2-4 files), wrote `.env.example` and `.gitignore`. `tsc --noEmit` and `npm test` both pass clean.
**Why:** First task in the phase-ownership split — Phase 0 is a prerequisite for both agents' tracks (Sync Point 1, `05-PHASE-OWNERSHIP.md`).
**Files touched:** `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`, all 19 files under `src/` (see `docs/OUTCOME.md` Phase 0 entry for the full list and per-file rationale), plus doc corrections: `docs/01-ARCHITECTURE.md` (added missing `ALREADY_EXECUTED` to `DenyCode`), `docs/common/03-INTERFACES.md` (fixed the `Ledger` interface ownership row — it's a Phase 1c/Agent B deliverable, not Phase 0), `docs/OUTCOME.md` Phase 0 section, `docs/common/01-PROJECT-STATUS.md`.
**Testing status:** `npx tsc --noEmit` → exit 0, clean. `npm test` → 1 test file discovered (`src/policy/decide.test.ts`, currently empty since Phase 1b hasn't run), 0 failures. Full output pasted in `docs/OUTCOME.md`.
**Known issues:** None outstanding. Two toolchain issues were found and fixed during this phase (not left as known issues): `npm install typescript` resolves to `7.0.2` today, which `ts-node` doesn't support (`ts.sys` undefined) — pinned to `5.9.3` instead. `node --test <directory>` fails on Node 22.18.0 — fixed by dropping the path argument and relying on `--test`'s default recursive discovery from cwd. Full detail in `docs/OUTCOME.md`.
**Other agent needs to:** Agent B — pull this, run `npx tsc --noEmit` yourself to confirm it's clean on your machine too (Sync Point 1's own compatibility check per `07-INTEGRATION.md`), then start Phase 1c and/or 1d. Note the TypeScript version pin above before your own `npm install` touches `package-lock.json`.
**Interface changes:** `GateEvent`/`DenyCode` (`src/events/GateEvent.ts`) created for real, not left as a comment stub — deliberate deviation from the literal Phase 0 instruction, justified in `docs/OUTCOME.md`. `DenyCode` gained `ALREADY_EXECUTED`, which was missing from the original spec despite `docs/05-DEMO-SCRIPT.md` Beat 8 needing it. `Ledger` interface ownership corrected in `03-INTERFACES.md` (Agent B/Phase 1c, not Agent A/Phase 0) — `src/ledger/Ledger.ts` itself is still just a comment stub right now.
**Blockers introduced/resolved:** none.
