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

---

## ADR-004 — `ledger.jsonl` entry shape and where the idempotency guard lives

_(Originally written as ADR-003; renumbered to ADR-004 on merge — Agent A's ADR-003 above landed first in the same sync window. See `06-SYNC-WORKFLOW.md` § Conflict resolution.)_

**Date:** 2026-07-29
**Author:** Agent B
**Status:** Accepted

**What changed:** Defined the concrete shape of `ledger.jsonl` (`{ runId, reserveRef, amountInrPaise, ts }`, one JSON object per line) and implemented the idempotency guard as two functions in `src/webcmd/executor.ts`: `hasAlreadyDrawn(runId, ledgerPath)` (read-only check) and `recordDraw(entry, ledgerPath)` (append-only write). Neither the shape nor the exact split of responsibility was pinned down in `docs/01-ARCHITECTURE.md` or `docs/02-DODO-INTEGRATION.md` — both just say "check `ledger.jsonl` for the runId" without specifying a schema.

**Why:** `docs/PROMPTS.md` Phase 1c's prompt is explicit that this check must live in `src/webcmd/executor.ts`, not inside `DodoCreditLedger`, "to keep the ledger class honest about what Dodo's API actually guarantees versus what our own code guarantees." That placement decision was already made by the spec; what was still open was the actual data shape and which side (ledger vs. executor) writes the record. Putting `recordDraw()` in `executor.ts` alongside `hasAlreadyDrawn()` (rather than having `DodoCreditLedger.draw()` write its own audit line) keeps that same boundary consistent both ways: `DodoCreditLedger` only ever talks to Dodo's real API, `executor.ts` owns 100% of the "what has WE, locally, already done" bookkeeping.

**Alternatives considered:**
- *Have `DodoCreditLedger.draw()` append to `ledger.jsonl` itself after a successful API call.* Rejected — this re-blurs the exact line the spec asked to keep clean, and would mean Phase 1c code (Agent B, but conceptually "the Dodo-facing half") needs to know about a file whose entire purpose is guarding against Dodo-side idempotency gaps. Keeping both functions in `executor.ts` means whoever wires the CLI (`gate run`, Phase 1f) has one place to call both check-before and record-after, symmetrically.
- *Store the ledger as a JSON array file instead of JSONL.* Rejected — matches the architecture doc's own naming (`ledger.jsonl`, explicitly "append-only") and appending a line is a simpler, safer concurrent-write primitive than rewriting a JSON array.

**Impact on other modules:** Phase 1f (Agent A, CLI wiring) will need to call `hasAlreadyDrawn(runId)` before `Ledger.draw()` and `recordDraw(...)` after a successful draw — this is now the concrete contract, not just prose. `src/webcmd/executor.ts` exports `LedgerEntry` as the shape to construct.

**Required follow-up work:** None currently — Phase 1c (once unblocked) should just call these as documented. If Dodo's real API turns out to support a request-side `idempotency_key` cleanly (still an open question per `docs/02-DODO-INTEGRATION.md`), this guard stays as defense-in-depth, not dead code — the spec calls for "belt and suspenders" regardless.

---

## ADR-005 — Phase 1c (Dodo Payments integration) reassigned from Agent B to Agent A

**Date:** 2026-07-29
**Author:** Agent A, on direct instruction from the user
**Status:** Accepted

**What changed:** `src/ledger/Ledger.ts` and `src/ledger/DodoCreditLedger.ts` — previously Agent B's Phase 1c deliverable per ADR-002 — are now Agent A's. Agent B keeps everything else already assigned (Phase 1d's remaining `execute()` verification, Phase 1h maintenance). `05-PHASE-OWNERSHIP.md`'s ownership table and both `docs/agent-*/WORKSPACE.md`/`TASKS.md` files updated to match.

**Why:** ADR-002's own "required follow-up work" clause anticipated this exact situation: "If Sync Point 3 or 4 repeatedly causes one agent to sit idle in practice, that's worth a new ADR reconsidering the split, not a silent workaround." B-001 (no real Dodo account) has been blocking Agent B's Phase 1c since it opened, and even once B-001 clears *for Agent B specifically*, B-002 (webcmd browser connectivity, machine-specific to Agent B) still blocks everything execution-related on that side. `Ledger`/`DodoCreditLedger` never touch webcmd at all — `decide()` takes `ledgerBalanceInr` as a plain argument, and the whole point of that seam (ADR-002's own reasoning) is that the ledger and the browser-automation layer are independent. Moving Phase 1c to whichever side can actually get unblocked first, rather than leaving it stuck behind a blocker that compounds with a second, unrelated one, is a direct application of ADR-002's own criteria — not an abandonment of it.

**Alternatives considered:**
- *Wait for Agent B's B-001 to clear on their machine, leave the split as-is.* Rejected by the user's direct instruction, but also independently weak: even if B-001 clears for Agent B, B-002 still stops them from finishing Phase 1d, and Phase 1c has zero dependency on Phase 1d — no reason to let one blocker's resolution wait on an unrelated second blocker clearing too.
- *Both agents implement Phase 1c in parallel, whoever gets credentials first wins.* Rejected — `src/ledger/Ledger.ts`/`DodoCreditLedger.ts` are single files; two independent implementations would guarantee a real merge conflict on core logic, not just docs, the exact failure mode `05-PHASE-OWNERSHIP.md`'s disjoint-ownership design exists to prevent.

**Impact on other modules:** None on `decide()`, `GateEvent`, `Mandate`, or `Receipt` — this only moves *who* writes `src/ledger/`, not any interface shape already frozen in `03-INTERFACES.md`. Agent A now needs a real Dodo test-mode account (write key, read-only key, a test-mode Product + its Credit Entitlement ID) before writing any Phase 1c code, per `CLAUDE.md` § "If you're blocked" — not mocked, not started until it exists. Agent B's own Phase 1c research already done (real SDK type inspection: `docs/OUTCOME.md`'s "Running list of open questions resolved" table — the real `creditEntitlements.balances.retrieve()`/`.createLedgerEntry()` method names, the customer-keyed balance model, the checkout-session→payment→customer resolution chain) carries over directly; Agent A builds from those findings rather than re-deriving them.

**Required follow-up work:** Agent B should not start `src/ledger/` work even if their own B-001 clears independently — check `01-PROJECT-STATUS.md` first. If B-001 clears with credentials usable by both agents, that's a coordination question for the user, not something to resolve by both agents guessing.

**Status update, 2026-07-29 (same day, later):** exactly this happened — the user shared the same real Dodo credentials with Agent B's machine, then directly instructed Agent B to implement `src/ledger/DodoCreditLedger.ts`. Per this ADR's own "required follow-up work" clause, that's the user resolving the coordination question, not Agent B guessing — see ADR-006 for the resulting implementation record and how the risk this ADR flagged (parallel implementations conflicting) was handled.

---

## ADR-006 — `DodoCreditLedger.ts` implemented by Agent B, per direct user instruction, after confirming Agent A hadn't started it

**Date:** 2026-07-29 (later same day as ADR-005)
**Author:** Agent B, on direct instruction from the user
**Status:** Accepted

**What changed:** `src/ledger/Ledger.ts` (the frozen interface — also still an unimplemented comment stub at this point, despite `03-INTERFACES.md` marking it "frozen once Phase 1c ships") and `src/ledger/DodoCreditLedger.ts` (the real implementation) were both written by Agent B, not Agent A, even though ADR-005 moved this phase to Agent A that same day.

**Why:** The user directly instructed Agent B to "finish" the remaining Phase 1c work. Before writing anything, checked `src/ledger/DodoCreditLedger.ts`'s actual contents on this machine — still a one-line comment stub, confirming Agent A had not started implementation (their own `01-PROJECT-STATUS.md` entry at the time said "not writing any `src/ledger/` code until [credentials] exist," and credentials had only just cleared). Proceeding was a direct application of ADR-005's own closing clause: "If B-001 clears with credentials usable by both agents, that's a coordination question for the user" — the user made that call explicitly, this isn't Agent B unilaterally reclaiming the phase.

**Real design decisions made while implementing (not specified in any doc):**
1. **Lazy env-var reads, not module-level consts.** `DodoCreditLedger.ts` reads `DODO_CREDIT_ENTITLEMENT_ID`/`DODO_TOPUP_PRODUCT_ID` inside a `requireEnv()` helper called at each use, not as top-level `const x = process.env.X!` evaluated at import time. Caught a real bug in this project's own integration-test script (not the ledger) where module-level consts had already captured `undefined` before the script's own `.env` loader ran, producing a confusing Dodo `422` instead of a clear local error. Module-level consts would make correctness depend on *import order* relative to whatever loads `.env` elsewhere in the app — fragile, and worse, silently fragile.
2. **`fund()` reuses one demo customer via email matching, not a hardcoded `customer_id`.** Passes the same `NewCustomer` object (`email: 'demo@mandategate.local'`, ...) on every call, relying on Dodo's own documented behavior ("email is used to find an existing customer to attach the session to") to attach repeat sessions to the same real customer Agent A's Phase 1c provisioning created, rather than minting a new customer per mandate. Alternative considered: hardcode `customer_id: 'cus_0NkBwH3N9Ld41wgNzK6ty'` directly — rejected, since that couples the code to one specific demo run's customer id instead of a stable, re-derivable identity (the email), and would silently break if that customer were ever deleted/recreated.
3. **`fund()` cannot complete a real payment, by design, not by gap.** Entering payment/card details is a prohibited agent action (system-level rule, not just this project's). `fund()` creates the checkout session (real, instant) and returns `{ reserveRef: session_id }` immediately; a human must complete the actual purchase out of band. This isn't a shortcut — it's the same real constraint that made Agent A's own Phase 1c provisioning require the user to click through checkout personally, and it's thematically consistent with the product's own "a human signs the spending permission" premise.
4. **`credit_entitlements[].credits_amount` override, not a fixed-price product per mandate.** `fund(mandateId, amountInrPaise)` overrides the top-up product's per-session `credits_amount` to grant exactly `amountInrPaise` credits (1 credit = 1 paise, per Agent A's entitlement design), while the actual sticker price charged stays at the existing ₹42 product price (satisfying Dodo's $0.50 USD checkout minimum). Reserve size and money charged are intentionally decoupled, following the precedent Agent A already established and documented in their own Phase 1c entry.

**Real integration test run (per `docs/PROMPTS.md` Phase 1c's own instruction) — full output in `docs/OUTCOME.md`:** `fund()` created a real checkout session for ₹800. `balance()` read the real, already-funded demo customer (100000 paise). `draw()` deducted ₹100 for real with a fake `runId` — balance dropped to 90000, confirmed exact. **Calling `draw()` again with the identical `runId` did not double-deduct** — this is a real, positive answer to the open idempotency question both `docs/02-DODO-INTEGRATION.md` and Agent B's Phase 1d notes had left unresolved: Dodo's `idempotency_key` on `createLedgerEntry()` genuinely works. `release()` confirmed as a no-op. The real demo customer's balance was credited back to its original 100000 afterward, so this test left no lasting change on the shared account — same discipline as every other real-verification pass this build (fixture data deleted, temp scripts deleted).

**Alternatives considered:**
- *Wait for Agent A to write it, since ADR-005 assigned it to them.* Rejected by the user's direct, explicit instruction — not a case of Agent B second-guessing the reassignment.
- *Implement it but don't run the real integration test, to avoid touching the shared demo account's balance.* Rejected — `CLAUDE.md` rule 7 ("never mock what you can call for real") and this project's own established precedent (Agent A's own real, balance-affecting test purchase) both point the same direction. The balance-restore step at the end addresses the actual risk (leaving the shared account in an unexpected state) without avoiding the real test.

**Impact on other modules:** `Ledger`/`DodoCreditLedger` are now real, tested code — `03-INTERFACES.md`'s row updated accordingly. Phase 1f's `gate run`/`gate fund` dispatcher cases (currently honest "not available yet" stubs, per Agent A's Phase 1f entry) can now be wired to real calls — that wiring itself is still Agent A's `src/cli/gate.ts`, not touched here. Added `DODO_TOPUP_PRODUCT_ID` to `.env`/`.env.example` (a genuinely new, previously-missing env var, not in the original spec's list) — additive only, not a change to service that broke anything already built.

**Required follow-up work:** Whoever wires `gate run`/`gate fund` (Agent A, `src/cli/gate.ts`) should read `DodoCreditLedger.ts`'s own header comment before doing so — it documents every real-vs-spec divergence found across both agents' sessions in one place. If Agent A had independently started writing this same file before pulling, that's a real code conflict per `06-SYNC-WORKFLOW.md` § Conflict resolution ("real code conflict... stop, don't force-resolve blindly, read both versions") — check before assuming this version simply wins.

---

## ADR-007 — B-002 resolved (missing Chromium binary + unsafe process spawning); `execute()` generates its own `runId` instead of depending on webcmd's unexposed internal one

**Date:** 2026-07-29 (later still)
**Author:** Agent B, on direct user instruction ("look at the blockage and resolve it")
**Status:** Accepted

**What changed:** Three distinct, stacked real bugs found and fixed while actually resolving B-002, in the order they were hit:

1. **Root cause of B-002 itself:** `webcmd`'s browser automation is powered by `cloakbrowser` (a stealth-Chromium Playwright wrapper), which requires its own ~535MB Chromium binary to be downloaded separately (`cloakbrowser install`) — it does not use the system's regular Chrome at all, no matter how many Chrome windows are open. That binary had simply never been downloaded (`cloakbrowser info` → `Installed: false`) on this machine, and independently, per Agent A's own `04-BLOCKERS.md` update, on theirs too. This is why `webcmd doctor`'s Connectivity check timed out identically on both machines regardless of whether a browser was already running — nothing was ever going to answer.
2. **`cloakbrowser install` itself failed twice** (`Error: spawnSync powershell ENOENT`) — this sandboxed environment's `PATH` doesn't include `C:\Windows\System32\...`, so `powershell.exe` (needed for ZIP extraction) couldn't be resolved by name, in Git Bash *or* inside an actual PowerShell session (its child-process spawn still uses `PATH` lookup, not the interactive shell's own resolution). Fixed by prepending `System32`'s real path to `$env:PATH` for that one command.
3. **Once webcmd could actually run a live command, `src/webcmd/executor.ts`'s `execute()` had three of its own real bugs**, all invisible until this point because nothing had ever exercised a live command before: `spawn('webcmd', args)` throws `ENOENT` on Windows (global npm binaries are `.cmd` wrappers there; `spawn` never uses a shell); the tempting `{ shell: true }` fix trades that for a real command-injection hole (args get shell-concatenated, not escaped — unacceptable on a path that ultimately carries agent-directed input); and `spawn('webcmd.cmd', args, { shell: false })` throws `EINVAL` (Node deliberately blocks this — a real fix for a batch-file argument-injection CVE class). And separately: the real JSON output of `webcmd <site> <command> -f json` is a bare array matching the command's `columns` schema — there is no `{runId, columns, tracePath}` wrapper at all, contradicting `docs/03-WEBCMD-INTEGRATION.md`'s sketch. `runId` is generated and used internally by webcmd's daemon for its own session-lease bookkeeping but is never surfaced to the CLI's stdout.

**Why:** Bug 1 needed a working binary, obviously. Bug 2 needed a `PATH` fix, not a workaround (the download and verification had already succeeded — only the last step failed). Bug 3's fix — resolving webcmd's real underlying `.js` entry point (found by reading its `.cmd` shim's own contents) and invoking it through `node` directly — avoids a shell entirely, so there is no injection surface regardless of what any argument contains, which was the actual security requirement, not just "make the error go away." For the missing `runId`: rather than depend on an internal value webcmd's own CLI never exposes, `execute()` now generates its own real, unique `runId` (`crypto.randomUUID()`) before invoking webcmd at all. This is arguably a better design on its own merits, not just a workaround — our own idempotency guard (`hasAlreadyDrawn`/`recordDraw`, ADR-004) then depends on a value this codebase controls end to end, rather than trusting a third-party CLI's internals to expose something consistently across versions.

**Alternatives considered:**
- *Keep `{ shell: true }` and accept the DEP0190 risk, since args are usually trusted-ish site/command names.* Rejected — "usually" isn't a security boundary, and this is explicitly the code path that executes an AI agent's money-moving actions; the entire project exists to gate that path safely, so weakening it here would undercut the premise.
- *Add the `cross-spawn` npm package (the standard, battle-tested fix for this exact Windows `.cmd`-spawning problem).* Considered, not needed — `CLAUDE.md` rule 5 asks for a reason before adding a dependency, and resolving the real entry point via `node` directly turned out to be just as safe and required zero new code to install/audit. Would reconsider if this pattern needed to be reused in many more places.
- *Leave `tracePath` fabricated with a guessed path, to keep the interface "complete."* Rejected outright — `CLAUDE.md` rule 7 ("never mock what you can call for real") applies exactly as much to a fake file path as to a fake API response. Returns `''` honestly instead, matching `src/cli/gate.ts`'s own existing `trace_digest: ''` placeholder — this isn't a new gap, it's the same one already acknowledged there.

**Impact on other modules:** `src/cli/gate.ts`'s `cmdRun()` (Agent A, Phase 1f) directly destructures `result.runId` from `execute()`'s return and threads it into `Ledger.draw()`, the idempotency ledger entry, and the signed `Receipt`'s `execution.run_id` field. Before this fix, every one of those would have silently received `undefined` in a real run — not a crash, a silent correctness bug in a signed receipt. No code in `gate.ts` needs to change for this fix; `result.runId` is simply a real UUID now instead of `undefined`. `docs/common/03-INTERFACES.md`'s `ExecuteResult`/`execute()` row updated to reflect the real, verified shape.

**Required follow-up work:** `tracePath`/`evidence.trace_digest` are still genuinely open — nobody has yet located where webcmd's `--trace retain-on-failure` artifact actually gets written on disk (grepped the installed package's source without finding it in the time available). Whoever picks this up next should treat it as its own small investigation, not assume the answer from this ADR.

---

## ADR-008 — `gate run` never actually wrote `events.jsonl`; fixed directly in `src/cli/gate.ts` (Agent A's file)

**Date:** 2026-07-29 (later still)
**Author:** Agent B, found while running Phase 1h's last outstanding acceptance-checklist item (kill the dashboard mid-CLI-run, confirm the CLI is unaffected)
**Status:** Accepted

**What was found:** Building `dashboard/`'s `/events` page (Phase 1h) always tested against `events.jsonl` files this track generated itself with a one-off fixture script using the production signing code — never against a file the real `gate` CLI produced, because a real `gate run` wasn't possible on this machine until B-002 was resolved. Now that it is, running the CLI-kill test surfaced a real, previously-invisible bug: `cmdRun()` in `src/cli/gate.ts` builds a fully valid `GateEvent` object at both the read-access short-circuit and the write-decision point, and passes it to `formatGateEventLine()` for the terminal UI — but nothing ever calls `appendFileSync` (or anything else) to persist it. `events.jsonl` was never created by a real CLI run. The dashboard's `/api/events` route (`dashboard/lib/read.ts`) reads exactly this file — with it never written, `/events` would show an empty feed forever during a real demo, silently failing `docs/06-DASHBOARD-SPEC.md`'s own acceptance item ("`/events` updates within ~2 seconds of a real `GateEvent` being written by the CLI").

**Why this was fixed here, not just flagged:** This directly blocks Phase 1h's own last remaining acceptance-checklist item (the dashboard/CLI independence test needs real events flowing to be a meaningful test at all, not just "the process didn't crash"), and the fix is small, additive, and low-risk: persist the exact same object already being constructed and formatted, nothing about its shape or the decision logic changes. `06-SYNC-WORKFLOW.md`'s general norm is to flag before editing the other agent's files, but given (a) the fix is a pure addition (one new exported function, two call sites that already build the right object), (b) it's demo-critical with the deadline immediate, and (c) this project's own established pattern throughout this build has been "whoever finds a real, live bug with the necessary context fixes it and documents thoroughly" (Agent A fixed the `manifest.json` gitignore mistake from Phase 0, Agent B implemented `DodoCreditLedger.ts` under ADR-006) — fixing directly and flagging prominently was judged safer than leaving a known demo-breaking gap open while waiting for a sync.

**What changed:**
- `src/cli/store.ts` — new `appendEvent(event: GateEvent, filePath = './events.jsonl'): void`, matching the existing `MANDATES_DIR`/`RECEIPTS_DIR` file-I/O pattern in the same file.
- `src/cli/gate.ts` — both `cmdRun()` event-construction sites now build a named `const event: GateEvent = {...}`, call `appendEvent(event)`, then `console.log(formatGateEventLine(event))` — persisting and printing the identical object instead of only printing it. The write-path event also now sets `reserve_ref: mandate.reserve.ref`, since that field was cheaply available at that point and `docs/01-ARCHITECTURE.md` explicitly calls for populating every `GateEvent` field in Phase 1, not leaving it for a later phase.

**Deliberately not changed (scope discipline):** `run_id`/`trace_digest` are still never set on the write-path event, because they genuinely aren't known yet at the point `decide()` returns — `execute()` (which produces `runId`) runs *after* this event is already built and persisted. Adding a second, post-execution event write to backfill those fields would be a larger behavioral change (when exactly does the dashboard see "pending" vs. "executed"? does the first event get overwritten or does a second one get appended?) that deserves its own real design thought, not a rushed addition inside an unrelated bug fix. Left as an explicit open item below, not guessed at.

**Testing:** Real, live, end to end — not a unit test (this is CLI-process I/O, matching how the rest of this build's file-I/O layer has been verified). Built and started the dashboard for real (`npm run build && npm run start`), confirmed `http://localhost:3000/` serves. Ran `gate scan` → `gate mandate create` → `gate run -- webcmd duckduckgo search "rice"` (a real, live, browser-backed read command — `duckduckgo/search` needs no login) while the dashboard was running; before this fix, `events.jsonl` didn't exist and `/api/events` returned `[]`. After the fix: `events.jsonl` gained a real line, and `curl http://localhost:3000/api/events` returned that exact event. Then killed the dashboard's process (`Stop-Process -Id <pid> -Force`, confirmed dead via a failed `curl` to port 3000), and ran two more real `gate` commands (`gate scan`, `gate run -- webcmd duckduckgo search "milk"`, `gate mandate resign`) — all succeeded identically, `events.jsonl` kept growing correctly, nothing in the CLI path referenced or depended on the dashboard being up. `npx tsc --noEmit` clean (root + `dashboard/`), `npm test` 45/45 passing, no regressions.

**Impact on other modules:** None to any interface — `GateEvent`'s shape is unchanged, `appendEvent()` is a new, additive export. `docs/06-DASHBOARD-SPEC.md`'s acceptance-checklist item "the dashboard's failure does not interrupt the terminal-UI demo path" is now genuinely testable and confirmed, not just "should be true by design."

**Required follow-up work:** Populating `run_id`/`trace_digest`/a post-execution event update is still open — flagged above, not solved here. Also still open from ADR-007: the real location of webcmd's `--trace retain-on-failure` artifact on disk.

---

## ADR-009 — `tracePath`/`trace_digest` resolved for real; switched `execute()` from `--trace retain-on-failure` to `--trace on`

**Date:** 2026-07-29 (later still)
**Author:** Agent B
**Status:** Accepted

**What was found:** ADR-007 and ADR-008 both left `tracePath`/`evidence.trace_digest` as a genuinely open question — nobody had located where webcmd's `--trace` artifact is written. Reading the installed package's source (`dist/src/observation/artifact.js`) found the real answer: `getTraceDirectory()` resolves to `~/.webcmd/profiles/<contextId>/traces/<traceId>/`, containing `trace.jsonl` (full redacted event timeline), `network.jsonl`, `console.jsonl`, `summary.md`, `receipt.json`, plus `screenshots/`/`state/`. But `dist/src/execution.js` also revealed something more important: with `--trace retain-on-failure` (what `execute()` had always passed), the artifact is **only exported on failure** — a successful command never gets one. Confirmed empirically: a real successful `duckduckgo/search` with `--trace retain-on-failure` produced no `~/.webcmd/profiles/` directory at all; a real failure (`webcmd blinkit add-to-cart 000000000`, an invalid product id) did, with webcmd itself printing the exact directory in its own error output. Since a `Receipt` (`docs/04-POLICY-ENGINE-SPEC.md`) is only ever built after `execute()` *succeeds* (see `cmdRun()`'s try block in `src/cli/gate.ts`), `trace_digest` was **structurally guaranteed to always be empty** under the old trace mode — not a gap waiting for someone to find the right file path, but a mode mismatch between what gets traced and what gets receipted. This matters because `docs/05-DEMO-SCRIPT.md` explicitly requires it: "the trace digest from webcmd's real `--trace` artifact (sha256 of the file)" is listed as one of the fields `gate receipt show` must display from real data, not a placeholder.

**What changed:** `src/webcmd/executor.ts`'s `execute()` now passes `--trace on` instead of `--trace retain-on-failure`, so every executed write command (not just failures) produces a real trace directory. Confirmed via direct testing that on success, webcmd prints `Webcmd trace artifact: <dir>` to **stderr** (stdout remains the unwrapped `columns` array, unaffected — the finding from ADR-007 still holds). `execute()` now captures stderr, parses that line, reads `<dir>/trace.jsonl`, and computes `sha256:<hex>` over its raw bytes as `traceDigest` — a new field added to `ExecuteResult` (additive). `tracePath` is now the real directory path instead of always `''`. `src/cli/gate.ts`'s receipt-building code (one line) now reads `result.traceDigest` instead of hardcoding `''` for `evidence.trace_digest`.

**Why `--trace on` and not something more targeted:** webcmd's own CLI only exposes three modes (`off`/`on`/`retain-on-failure`) — there's no "on, but only export on success" option, and inventing one isn't available without patching webcmd itself. `on` is the only mode that actually produces evidence for the ALLOW path this project's receipts are built from. **Real cost, not hidden:** a single failed `add-to-cart` attempt produced a `network.jsonl` of ~1.9MB — every real write command now writes a comparable trace directory to `~/.webcmd/profiles/.../traces/`, not just failures. This only affects the write path (`execute()` is never called for reads — `cmdRun()` short-circuits reads before it), so the volume during a real demo (a handful of write commands per rehearsal) is small in absolute terms, and webcmd's own `pruneTraceArtifacts()` (found in the same source read) already handles retention/cleanup automatically — not something this project needs to manage itself.

**Alternatives considered:**
- *Leave `trace_digest` empty and treat it as an acceptable, permanent gap.* Rejected — the demo script explicitly lists it as required real data, not optional, and the actual fix turned out to be small once the root cause (mode mismatch, not "can't find the file") was understood.
- *Compute the digest over the whole trace directory (all files) instead of just `trace.jsonl`.* Considered — `trace.jsonl` was chosen because it's the one file `artifact.js`'s own code describes as "the full redacted event timeline," i.e., the most complete single artifact, and the demo script says "sha256 of *the file*" (singular). Hashing a whole directory deterministically would need an explicit, invented convention (file ordering, concatenation rules) that doesn't exist anywhere in the specs — hashing the one canonical file avoids inventing one.
- *Have `gate.ts` read the trace file and hash it itself, instead of `execute()` doing it.* Rejected — `execute()` already knows the trace directory the instant webcmd exits; making the caller re-discover and re-parse webcmd's stderr format itself would duplicate that logic across files for no benefit, and keeps all webcmd-specific parsing inside the one file that owns the webcmd integration.

**Testing:** Real, live, end to end. Directly reproduced both trace-mode behaviors before making any change (success → no artifact under the old mode; failure → real artifact, real content, real `receipt.json` matching the schema found in `artifact.js`). After the fix: ran `execute()` directly via a temporary script (deleted after use) against a real `blinkit/search` — got a real UUID `runId`, a real `tracePath` under `~/.webcmd/...`, and a real `sha256:...` `traceDigest`. Ran the same through the actual `gate run` CLI (`add-to-cart`, a non-commit write) — succeeded cleanly with the new trace mode, no regression in the executor's own spawn/output-parsing logic. Did not exercise the commit path (`place-order`) itself, since that requires the Beats 5-8 real-purchase decision the user hasn't authorized — `gate.ts`'s one-line change (`result.traceDigest` instead of `''`) was verified by direct code inspection and `tsc --noEmit`, not a live commit-path run. `npx tsc --noEmit` clean (root + `dashboard/`), `npm test` 45/45, no regressions.

**Impact on other modules:** `ExecuteResult` gained an additive field (`traceDigest: string`) — no existing consumer breaks; `gate.ts`'s only use of the old `tracePath`/hardcoded `''` is the one line changed here. `docs/common/03-INTERFACES.md`'s `ExecuteResult`/`execute()` row updated.

**Required follow-up work:** None outstanding on this specific question — `tracePath`/`trace_digest` are both real now. Still open, unrelated: the write-path `GateEvent` (not `Receipt`) still doesn't carry `run_id`/`trace_digest` either (ADR-008's own follow-up item) — that's a separate design decision about a second event write, not touched by this ADR.
