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

---

## [2026-07-29] — Agent A — Phase 1a complete: mandate schema, canonical JSON, Ed25519 signing

**What changed:** Implemented `src/mandate/schema.ts` (`Mandate` interface + a hand-written `isMandate()` type guard), `src/mandate/sign.ts` (`canonicalJSON()`, `generateKeyPair()`, `sign()`, `verify()` — matches `docs/04-POLICY-ENGINE-SPEC.md`'s code exactly, no changes needed), and `src/mandate/render.ts` (`renderConsent()` — deviated from the spec's code sketch, see below). Added `src/mandate/sign.test.ts` (5 tests, the 3 required by `docs/PROMPTS.md` Phase 1a plus 2 extra) and `src/mandate/render.test.ts` (4 tests, not required by the prompt but added after finding real bugs — see Known issues).
**Why:** Next item in Agent A's sequential track (`05-PHASE-OWNERSHIP.md`) — `decide()` (Phase 1b) and the receipt chain (Phase 1e) both import `sign()`/`verify()` from this phase.
**Files touched:** `src/mandate/schema.ts`, `sign.ts`, `render.ts` (all rewritten from Phase 0's comment stubs), `src/mandate/sign.test.ts` and `render.test.ts` (new), `docs/OUTCOME.md` Phase 1a section, `docs/common/01-PROJECT-STATUS.md`.
**Testing status:** `npx tsc --noEmit` → exit 0. `npm test` → 10/10 passing (5 sign tests + 4 render tests + the still-empty `decide.test.ts` stub). Full pasted output in `docs/OUTCOME.md`.
**Known issues:** None outstanding — both bugs found this phase were fixed, not left open. Worth flagging for whoever next touches `render.ts`: `BRAND_NAMES` currently only covers `blinkit`/`zepto`/`bigbasket`/`district` (the merchants named in the specs). Any new merchant added to a mandate's scope that isn't in that table falls back to generic `capitalize()`, which will be wrong for any brand with an internal capital (the same class of bug just fixed for `bigbasket`) — not a blocker, just something to remember if the demo script ever adds a new merchant.
**Other agent needs to:** Nothing blocking — `src/mandate/` isn't something Agent B's tracks (`src/ledger/`, `src/webcmd/`, later `dashboard/`) import directly in their own phases. Worth knowing: `Mandate`'s shape is now real code, not just the spec doc, if you want to sanity-check anything against it.
**Interface changes:** `Mandate` (`src/mandate/schema.ts`) is now implemented — matches `docs/04-POLICY-ENGINE-SPEC.md` exactly, plus the added `isMandate()` guard (additive, not in conflict with anything). Per `03-INTERFACES.md`, `Mandate` and `canonicalJSON()`/`sign()`/`verify()` are now 🔒 frozen.
**Blockers introduced/resolved:** none.

---

## [2026-07-29] — Agent B — Pulled Phase 0, added task-tracking docs, starting 1c/1d

**What changed:** Session started before Agent A's Phase 0 push had been fetched locally, so it independently drafted a duplicate Phase 0 scaffold (uncommitted, never pushed). Caught the real push via `git fetch` before pushing anything — discarded the local duplicate wholesale (`rm -rf` on the untracked duplicate files/folders, all of which had zero git history), then `git pull --rebase origin main` cleanly fast-forwarded. Verified `tsc --noEmit` and `npm test` both pass clean on this machine against Agent A's real Phase 0. Added three new docs to `docs/agent-b/`: `TASKS.md` (durable per-phase checklist for 1c/1d/1h, checkbox-level, so progress survives a session restart without re-deriving it from `docs/PROMPTS.md` each time), `ROADMAP.md` (milestones M1-M9 mapped against the 31 Jul/1 Aug deadline, with a "where we actually are" section to update every session), and `ERROR-HANDLING.md` (consolidates every I/O failure mode already specified across `docs/02-DODO-INTEGRATION.md` and `docs/03-WEBCMD-INTEGRATION.md` into one reference scoped to what Agent B actually builds, so a future session isn't re-deriving fail-closed behavior for the ledger/webcmd/dashboard under time pressure). Updated `WORKSPACE.md`, `01-PROJECT-STATUS.md` (Agent B's own section only), and `04-BLOCKERS.md` (opened B-001) to reflect current state.
**Why:** The user, present as "Agent B" on this machine, clarified the collaboration model directly: this track should work its own assigned deliverables (1c, 1d, then 1h) at its own pace and never wait on or absorb Agent A's phases just because Agent A hasn't finished — and asked for durable, git-tracked task/roadmap/error-handling references specific to this track, rather than relying on chat-only state.
**Files touched:** `docs/agent-b/WORKSPACE.md`, `docs/agent-b/TASKS.md` (new), `docs/agent-b/ROADMAP.md` (new), `docs/agent-b/ERROR-HANDLING.md` (new), `docs/common/01-PROJECT-STATUS.md` (Agent B section only), `docs/common/04-BLOCKERS.md` (opened B-001).
**Testing status:** `npx tsc --noEmit` → exit 0, clean. `npm test` → 1 test file discovered (`src/policy/decide.test.ts`, still empty pending Agent A's Phase 1b), 0 failures. Same result Agent A reported — Sync Point 1 cross-machine compatibility confirmed.
**Known issues:** None yet on this track's own code — no Phase 1c/1d code written yet this entry, just verification and doc setup.
**Other agent needs to:** Nothing blocking — informational only. Agent A can ignore `docs/agent-b/*` beyond `WORKSPACE.md`'s existing cross-reference note.
**Interface changes:** none.
**Blockers introduced/resolved:** Introduced B-001 (`04-BLOCKERS.md`) — Phase 1c needs a real Dodo test-mode account + `.env` from the user, not yet provided. Phase 1d is unaffected and starting now (self-serve npm global install).

---

## [2026-07-29] — Agent A — Phase 1b complete: decide(), with a real rule-order fix — read this one

**What changed:** Implemented `src/policy/decide.ts` and `decide.test.ts` (11 tests: the 9 required by `docs/PROMPTS.md` Phase 1b plus 2 extra). While building the required "read access always allows, regardless of mandate state" test, found that the spec's own rule order (signature/expiry checked *before* the read short-circuit) would deny a read against an expired or badly-signed mandate — directly contradicting that test's title and `docs/03-WEBCMD-INTEGRATION.md` § Step 3's explicit "no mandate check, no signature verification" for reads. Moved read-access to Rule 0. Full reasoning in `docs/common/02-DECISIONS.md` ADR-003 — this is a proper decision record, not just a changelog line, because it changes a contract both of us build against.
**Why:** Next item in Agent A's sequential track. `decide()` is described in the specs as "the single most important function in the codebase" and its rule order is explicitly what determines the DENY reason shown live during the demo — worth getting exactly right now rather than downstream.
**Files touched:** `src/policy/decide.ts`, `decide.test.ts` (both rewritten from Phase 0's comment stub), `docs/04-POLICY-ENGINE-SPEC.md` (rule order + `SpendRequest.access` type corrected, "Rule order note" added), `docs/common/02-DECISIONS.md` (new ADR-003), `docs/common/03-INTERFACES.md` (`Decision`/`SpendRequest`/`decide()` row updated), `docs/OUTCOME.md` Phase 1b section, `docs/common/01-PROJECT-STATUS.md`.
**Testing status:** `npx tsc --noEmit` → exit 0. `npm test` → 20/20 passing (9 mandate/sign + 11 decide, including a dedicated regression test: "read access allows even against a badly signed mandate"). Full output in `docs/OUTCOME.md`.
**Known issues:** None outstanding. One thing to remember: `decide()`'s Rule 3 (unknown-command) was deliberately left in its original position relative to signature/expiry — only the read-access case had evidence for reordering, extending it to unknown-command too would have been unjustified guessing. If a future spec update clarifies unknown-command should also bypass signature/expiry, that's a new ADR, not a quiet edit.
**Other agent needs to:** **Please read `02-DECISIONS.md` ADR-003 before writing anything that calls or reasons about `decide()`** — the rule order changed from what `04-POLICY-ENGINE-SPEC.md` originally showed. This doesn't touch `src/ledger/` or `src/webcmd/` directly, but if you've already read the old rule order into your own mental model (e.g., while writing `03-WEBCMD-INTEGRATION.md`-adjacent code that assumes a particular check order), re-verify against the current spec.
**Interface changes:** `Decision`/`SpendRequest`/`decide()` (`src/policy/decide.ts`) implemented, with the Rule 0-3 reorder and the `access` type widening described above. Both changes propagated to `04-POLICY-ENGINE-SPEC.md` and `03-INTERFACES.md`. See ADR-003 for the full alternatives-considered writeup.
**Blockers introduced/resolved:** none.

---

## [2026-07-29] — Agent A — Phase 1e complete: receipt schema and hash-chain

**What changed:** Implemented `src/receipt/schema.ts` (`Receipt` interface) and `src/receipt/chain.ts` (`buildAndSignReceipt()`, `verifyReceipt()`, plus `sha256Hex()` and `verifyChain()` — the spec describes these last two in prose but doesn't show code, so their shape is this phase's own design). Added `src/receipt/chain.test.ts` (4 tests: the 2 required by `docs/PROMPTS.md` Phase 1e plus 2 extra). No spec bugs found this phase — unlike 1a/1b, the Receipt schema and chain design were internally consistent with `docs/05-DEMO-SCRIPT.md` Beats 6-7's expected output shape. This closes out Agent A's sequential track (0 → 1a → 1b → 1e) — next up is Phase 1f, partially gated on Agent B's 1c/1d.
**Why:** Last item before Phase 1f (CLI wiring), which imports mandate + policy + receipt together.
**Files touched:** `src/receipt/schema.ts`, `chain.ts` (both rewritten from Phase 0's comment stubs), `src/receipt/chain.test.ts` (new), `docs/OUTCOME.md` Phase 1e section, `docs/common/01-PROJECT-STATUS.md` (also synced the 1c/1d table rows to match Agent B's own status section — please keep those rows current on your side going forward, I just didn't want the shared table sitting stale), `docs/common/03-INTERFACES.md` (`Receipt` row confirmed shipped).
**Testing status:** `npx tsc --noEmit` → exit 0. `npm test` → 24/24 passing (9 mandate/sign + 11 decide + 4 receipt chain). Full output in `docs/OUTCOME.md`.
**Known issues:** None. `verifyChain()` takes an already-parsed `Receipt[]`, not file paths — reading `receipts/*.json` off disk is left to Phase 1f's CLI layer, keeping `chain.ts` itself pure. Worth knowing if you're building the dashboard's re-implemented chain-verify reader (`docs/06-DASHBOARD-SPEC.md`'s duplication note) — same split applies there.
**Other agent needs to:** **Sync Point 4 is now open** — 1b and 1e are both shipped, so the dashboard's data-reading API routes (`/api/mandate`, `/api/receipts`) are unblocked per `05-PHASE-OWNERSHIP.md`. Pull this, run `npx tsc --noEmit` to confirm clean on your machine, then Phase 1h's data routes don't need to wait on anything else from this side. `sha256Hex()` and `verifyChain()` in `src/receipt/chain.ts` are worth reading before re-implementing chain-verify logic in the dashboard, even though the dashboard deliberately re-implements rather than imports — matching the exact hash format (`sha256:` + hex) matters for the two to agree on a real receipt file.
**Interface changes:** `Receipt` (`src/receipt/schema.ts`) implemented, matches the spec exactly. `sha256Hex()`/`verifyChain()` are new exports from `src/receipt/chain.ts`, not previously in `03-INTERFACES.md`'s registry — added to that row's notes rather than a new row, since they're part of the same `Receipt`-adjacent contract, not an independent one.
**Blockers introduced/resolved:** none.
