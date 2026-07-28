# 02 — Architectural Decisions (ADR Log)

An append-only record of significant engineering judgment calls made during the build — the *why* behind a choice, not just the *what*. This is what lets the other agent (or a fresh session of you) understand a piece of code without asking "wait, why is it built this way?"

## What belongs here vs. elsewhere

Three different logs exist in this repo for three different kinds of information — don't duplicate across them:

- **`docs/OUTCOME.md`** (existing, unchanged) — spec-vs-reality corrections. "The spec guessed the balance field was called `balance`, the real API returns `available_credits`." Mandatory per `CLAUDE.md` rule 6, one entry per phase.
- **`08-CHANGELOG.md`** — terse, chronological, per-sync handoff notes. "I finished X, here's what changed, here's what you need to do." Every push-worthy change gets one.
- **This file** — a real decision with alternatives that were considered and rejected, where the reasoning itself is worth preserving. Not every changelog entry needs an ADR. An ADR is warranted when: you chose between two or more genuinely viable approaches, the choice affects code the other agent will touch, or you're changing something already marked 🔒 frozen in `03-INTERFACES.md`.

If you're not sure whether something rises to ADR-level, err toward writing it — a skipped ADR is invisible; an unnecessary one just costs a few minutes.

**Rules:**
1. Append at the bottom. Never edit or renumber a previous entry — if a decision is later reversed, add a new ADR that says so and mark the old one's status `Superseded by ADR-00X`, don't rewrite history.
2. Every entry gets the next sequential ADR number, regardless of which agent wrote it — check the last number in this file before assigning the next one, and if both of you add one in the same sync window, resolve the number collision the same way as any append-only conflict (`06-SYNC-WORKFLOW.md` § Conflict resolution): keep both, renumber whichever landed second.

**Entry template:**

```
## ADR-XXX — Short title

**Date:** YYYY-MM-DD
**Author:** Agent A/B
**Status:** Proposed / Accepted / Superseded by ADR-XXX

**What changed:**
**Why:**
**Alternatives considered:**
**Impact on other modules:**
**Required follow-up work:**
```

---

## ADR-001 — Trunk-based Git workflow, no per-agent feature branches

**Date:** 2026-07-28
**Author:** Restructuring session
**Status:** Accepted

**What changed:** Both agents commit and push directly to `main`. No long-lived `agent-a/*` or `agent-b/*` branches, no PR-based merge step.

**Why:** The phase split in `05-PHASE-OWNERSHIP.md` already keeps the two agents on disjoint directories almost the entire build (see ADR-002). The usual justification for feature branches — isolating conflicting concurrent work — mostly doesn't apply here. A PR step would add review latency neither agent needs, since the real gate is "did this phase's own tests/acceptance checklist pass," which is mechanical, not a human-judgment code review.

**Alternatives considered:**
- *Per-agent long-lived branches, merged at each Sync Point.* Rejected — this delays conflict discovery to the merge point instead of catching it immediately via frequent small pulls, which is worse in a 72-hour build where a late-discovered conflict costs disproportionately more.
- *PR + review before every merge to main.* Rejected — no second human reviewer exists in this setup (the "reviewer" is the phase's own test suite), so a PR step would be process theater that slows down sync without adding a real check.

**Impact on other modules:** None on code — this is pure workflow. Does mean both agents must be disciplined about small, frequent, tested commits (`06-SYNC-WORKFLOW.md`), since there's no branch boundary catching a broken push.

**Required follow-up work:** None. Revisit only if real file-level conflicts start happening often enough to suggest the disjoint-ownership assumption has broken down — see `05-PHASE-OWNERSHIP.md`'s note on what to do if that happens.

---

## ADR-002 — Dependency-driven phase split instead of 50/50

**Date:** 2026-07-28
**Author:** Restructuring session
**Status:** Accepted

**What changed:** Agent A owns the sequential pure-logic chain (Phase 0 → 1a → 1b → 1e → 1f → 1g). Agent B owns the two interface-only tracks that depend on nothing but Phase 0's contracts (1c Dodo, 1d webcmd), then moves to the fully separate dashboard (1h) once 1b+1e land.

**Why:** `decide()` takes `ledgerBalanceInr` and `txnCountSoFar` as plain arguments (`docs/04-POLICY-ENGINE-SPEC.md`) — it never imports `DodoCreditLedger` or the webcmd manifest loader directly. That existing architectural seam is what makes 1c/1d genuinely independent of 1a/1b/1e's internals, not just nominally assigned to a different person. Splitting by that seam maximizes real parallel time on disjoint files; a 50/50-by-phase-count split would either force an artificial handoff mid-chain (e.g. splitting 1a from 1b, which directly imports 1a's `sign()`/`verify()`) or leave one agent idle waiting on a dependency the other split wouldn't have created.

**Alternatives considered:**
- *Straight backend/frontend split* (Agent A: all of `src/`, Agent B: `dashboard/` only). Rejected — leaves Agent B fully idle until 1b+1e are done, and gives Agent A zero parallelism within the backend the whole time Agent B is idle.
- *Even 50/50 by phase count.* Rejected — phase count isn't a good proxy for effort or for independence; see the full reasoning and effort-balance discussion in `05-PHASE-OWNERSHIP.md`.

**Impact on other modules:** Defines the folder-ownership boundaries referenced throughout `docs/common/` and both `docs/agent-*/WORKSPACE.md` files. Any change to this split should update `05-PHASE-OWNERSHIP.md` and both workspace files' "Folders/files you own" sections.

**Required follow-up work:** None currently. If Sync Point 3 or 4 (`05-PHASE-OWNERSHIP.md`) repeatedly causes one agent to sit idle in practice, that's worth a new ADR reconsidering the split, not a silent workaround.

---

## ADR-003 — `decide()`'s read-access check moved to Rule 0, ahead of signature/expiry

**Date:** 2026-07-29
**Author:** Agent A (Phase 1b)
**Status:** Accepted

**What changed:** In `src/policy/decide.ts`, the read-access short-circuit is now Rule 0 — it fires before the signature check and the expiry check, which are now Rules 1 and 2. Originally (per `docs/04-POLICY-ENGINE-SPEC.md`'s first draft) read-access was Rule 3, checked *after* signature and expiry. `SpendRequest.access` also widened from `'read' | 'write'` to `'read' | 'write' | undefined`.

**Why:** Two independent sources plus the acceptance test itself all pointed the same direction, and the original ordering contradicted all three: (1) `docs/03-WEBCMD-INTEGRATION.md` § Step 3 says reads get "no mandate check, no ledger touch, no signature verification"; (2) `docs/PROMPTS.md` Phase 1b's required test is literally titled "read access always allows, regardless of mandate state"; (3) with the original ordering, a read against an expired or badly-signed mandate would be denied — that's not "regardless of mandate state," that's exactly state-dependent. This isn't a fail-closed violation despite moving a check earlier — `CLAUDE.md`'s fail-closed rule is scoped to money-moving actions, and reads categorically can't spend money regardless of mandate validity, which is precisely why `03-WEBCMD-INTEGRATION.md` designed them to bypass mandate checks in the first place.

**Alternatives considered:**
- *Leave the original order, treat `03-WEBCMD-INTEGRATION.md` and the Phase 1b test title as loose/aspirational language rather than literal requirements.* Rejected — two separately-authored spec files and the acceptance test's own wording all agree; treating that as coincidental rather than intentional seemed like the less likely explanation, and `CLAUDE.md` rule 6 explicitly directs correcting the spec when reality (here, cross-spec consistency) shows it was wrong rather than building around a known-wrong assumption.
- *Also move "unknown command" (Rule 3) ahead of signature/expiry, on the theory that cheap/mandate-independent checks should generally run first.* Rejected — no spec file or required test provides evidence for this. Unlike the read case, nothing establishes that an unrecognized command should bypass signature/expiry checks. Extending the fix on inferred symmetry alone would have been guessing, not correcting a demonstrated bug. Left unknown-command in its original relative position (now Rule 3, still after signature/expiry).

**Impact on other modules:** `docs/04-POLICY-ENGINE-SPEC.md` updated to match (code block + a new "Rule order note" explaining the change). `docs/common/03-INTERFACES.md`'s registry row for `Decision`/`SpendRequest`/`decide()` flags the reorder explicitly so Agent B (or anyone reasoning about `decide()` from memory/an earlier read of the spec) doesn't build against the stale ordering. Does not affect `docs/05-DEMO-SCRIPT.md`'s scripted `OVER_TOTAL_CAP` beat — that path is a write request, unreachable until Rule 4 regardless of how Rules 0-3 are ordered among themselves. No impact on Agent B's Phase 1c/1d work (neither imports `decide()`).

**Required follow-up work:** None. `src/policy/decide.test.ts` includes a dedicated regression test ("read access allows even against a badly signed mandate") that will fail loudly if this ever regresses.
