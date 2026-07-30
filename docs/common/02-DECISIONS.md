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

---

## ADR-010 — Final-stretch task split: Agent B runs the real Beats 5-8 rehearsal, Agent A takes the dashboard's presentation layer

**Date:** 2026-07-29 (later still)
**Author:** Restructuring session, per direct user instruction
**Status:** Accepted

**What changed:** For the remainder of the build (`docs/common/09-HACKATHON-WOW-PLAN.md`), ownership diverges from the standing split in `05-PHASE-OWNERSHIP.md` in one specific, scoped way:

- **Agent B** takes Plan Phase 1 — running the real Beats 5-8 rehearsal (`place-order` → signed receipt → `gate verify` → tamper test → idempotency-retry) to close `docs/05-DEMO-SCRIPT.md`'s acceptance checklist for real, plus recording the required fallback video. This is squarely inside Agent B's existing ownership (`src/webcmd/`, and the I/O-rails track generally) — no reassignment needed here, just a priority call.
- **Agent A** takes Plan Phase 2 (and, following on from it, Phase 3) — the dashboard's **visual/presentation layer only**: `dashboard/app/**/page.tsx`, `dashboard/components/**/*.tsx`, `dashboard/app/globals.css` and any new presentational components. This *is* a reassignment — `dashboard/` (the entire app) is listed as Agent B's in `05-PHASE-OWNERSHIP.md`'s table and Agent A's own `WORKSPACE.md` explicitly says "never edit `dashboard/` without flagging it first." Per direct user instruction, that boundary is redrawn for this stretch only.

**Why:** Direct user instruction — the user split the remaining work this way explicitly, not a judgment call either agent or this session made unilaterally. The scoping (presentation-only, not the whole app) is this entry's own addition, to keep the reassignment from re-creating the exact file-conflict risk `05-PHASE-OWNERSHIP.md` was designed to avoid.

**Alternatives considered:**
- *Reassign all of `dashboard/` to Agent A, mirroring how ADR-005 reassigned the whole of `src/ledger/`.* Rejected — unlike Phase 1c's ledger (which nobody had started), `dashboard/lib/*` and `dashboard/app/api/**` are real, already-verified data-reading/Dodo-balance/chain-verification logic Agent B built and tested end-to-end (including a live tamper test). Handing the whole app over would mean Agent A re-deriving working code instead of restyling it, and would risk the real logic regressing under a visual rewrite. Splitting by layer (presentation vs. data) avoids both.
- *Have Agent B do the visual work too, since they already own `dashboard/`.* Rejected by the user's explicit instruction — also, running Beats 5-8 (Phase 1) and a full visual rewrite (Phase 2) back-to-back on one agent serializes two large, independent tasks that can otherwise run in parallel on two machines, which is the entire point of the two-agent setup (ADR-002).

**Impact on other modules:** None to frozen interfaces — this is a task/ownership change, not a code contract change. `dashboard/lib/*` (types, `read.ts`, `hash.ts`, `dodo.ts`) and `dashboard/app/api/**` (the three GET routes) stay Agent B's; Agent A must not edit those without flagging first, same rule as before, just for the reverse direction now. If Phase 2's visual work needs a *new* field surfaced from an API route that doesn't exist yet (e.g., a running ALLOW/DENY counter for the `/events` redesign), that's a request to Agent B, not a same-agent edit.

**Required follow-up work:** `docs/common/05-PHASE-OWNERSHIP.md`, `docs/common/01-PROJECT-STATUS.md`, and both agents' `WORKSPACE.md` files updated to point here and to `09-HACKATHON-WOW-PLAN.md`. Revert to the standing split automatically once Phase 2/3 of the wow-plan are done — this ADR does not change `dashboard/`'s ownership for anything beyond the current hackathon stretch.

---

## ADR-011 — `network_order_id` was hardcoded `undefined`; now extracted from webcmd's real `place-order` output

**Date:** 2026-07-29 (later still)
**Author:** Agent B, found while inspecting the receipt from the real Beat 5 `place-order` run
**Status:** Accepted

**What was found:** `src/cli/gate.ts`'s receipt-building code for the commit path passed `evidence: { trace_digest: result.traceDigest, network_order_id: undefined }` unconditionally — no code anywhere ever read a real order id, even though webcmd's own manifest declares `blinkit/place-order`'s real output columns as `["status","confirmed","itemCount","payable","orderId","url","message"]`, i.e. the real `orderId` was sitting in `execute()`'s returned `result.columns` the whole time. This was invisible until now because Beats 1-4 (the only prior live rehearsal) never reached an actual commit command — `add-to-cart` and other non-commit writes don't build a receipt at all. `docs/05-DEMO-SCRIPT.md`'s Beat 6 explicitly requires "the order ID from webcmd's real command output" as one of the fields that "must come from real data."

**What changed:** `src/cli/gate.ts`'s commit-path receipt-building now does `const resultRows = Array.isArray(result.columns) ? (result.columns as Array<{ orderId?: string }>) : []; const networkOrderId = resultRows[0]?.orderId;` and passes `network_order_id: networkOrderId` — extracted defensively (some sites/commands may have no `orderId` field at all, matching the schema's own `?` optionality) rather than assumed present.

**Why extracted defensively rather than required:** `Receipt.evidence.network_order_id` is already typed optional (`?`) in `src/receipt/schema.ts` — the schema itself acknowledges not every command returns one. Throwing if absent would be inventing a stricter contract than the one already agreed on, for no documented reason.

**Deliberately not changed:** the receipt already produced by the real Beat 5 run (`rcp_ms66xl2ef9771fa00056`, predates this fix) keeps `network_order_id: undefined`. Editing an already-signed receipt to backfill a field would be indistinguishable from the exact tampering `verifyReceipt()` exists to catch, and would break its own signature outright — the entire point of signing is that a receipt's content is fixed at signing time. The real order still genuinely succeeded (`payment.status: "captured"`, a real ₹476 ledger draw, confirmed via the real Dodo balance dropping by exactly that amount) — the receipt is just missing this one non-critical evidentiary field, honestly, rather than having a fabricated one.

**Alternatives considered:**
- *Re-run `place-order` to get a receipt with the field populated.* Rejected — that's a second real purchase, a decision for the user, not something to do unilaterally just to make a receipt look more complete.
- *Backfill `network_order_id` onto the existing receipt file directly.* Rejected outright — see "Deliberately not changed" above; this would corrupt the receipt's own signature, the opposite of what the field is meant to add confidence in.
- *Make `network_order_id` required (non-optional) now that a real extraction path exists.* Rejected — no spec file asks for this, and some real commands legitimately have no order id to report; matching the existing optional schema is the conservative choice.

**Testing:** Real. Found by inspecting the actual real receipt produced by the actual real Beat 5 `place-order` run. `npx tsc --noEmit` → exit 0. `npm test` → 45/45, no regressions (no test exercises the commit-path receipt-building branch directly — it's covered by this session's live, real verification instead, consistent with how the rest of `cmdRun()`'s live-execution paths have been verified throughout this build).

**Impact on other modules:** `Receipt.evidence.network_order_id`'s type is unchanged (still optional) — this is a bug fix inside `gate.ts`, not an interface change. Every future commit-path receipt (any site/command whose manifest declares an `orderId` column) will now carry the real value.

**Required follow-up work:** None outstanding on this specific fix. Worth a quick real check the first time a *different* merchant's `place-order`-equivalent command is exercised (if the demo ever expands beyond Blinkit) — confirm that merchant's manifest also declares an `orderId` column, or the field will correctly stay absent rather than error.

---

## ADR-012 — `gate fund --reserve-ref`: attach an already-funded real reserve instead of always creating a new checkout

**Date:** 2026-07-29 (later still)
**Author:** Agent B
**Status:** Accepted

**What was found:** `gate fund` could only ever call `DodoCreditLedger.fund()`, which creates a *new* Dodo checkout session that a human must then pay in a browser. That's correct and necessary the first time, but it meant **a full end-to-end demo run could never be repeated without an out-of-band human payment first** — and, more seriously, that a live on-stage demo could not fund a mandate at all inside its own runtime (a browser checkout mid-demo is neither fast nor something the agent may do — entering payment details is a prohibited agent action). Meanwhile the real, already-paid reserve retains an unspent balance across runs (₹1,324 at the time of this change), sitting unusable by any new mandate.

**What changed:** `gate fund <mandate_id> --reserve-ref <ref>` attaches an existing reserve to a mandate and re-signs it, with **no new checkout session**. `--amount` and `--reserve-ref` are mutually exclusive (erroring if both are given, rather than silently preferring one).

**The safety property that makes this acceptable:** the attached balance is **read live from Dodo**, never asserted locally. `blocked_inr` is set from the real `ledger.balance(ref)` response, and the command refuses outright if the balance can't be read (bad/unknown ref → real 404 surfaced) or reads as ₹0. So a typo'd or unpaid ref fails loudly at fund time instead of producing a mandate that *claims* to be funded and only fails later, mid-spend. This keeps the fail-closed posture of `CLAUDE.md` rule 3 — the CLI never attaches a reserve it cannot verify against the real API.

**Alternatives considered:**
- *Hand-edit the mandate JSON to point at the existing reserve.* Rejected outright — that breaks the mandate's own Ed25519 signature, which is the entire artifact the product is built around. Any legitimate reserve change must go through a re-sign, which is precisely what this command does.
- *Let `--amount` optionally skip payment when the customer already has credit.* Rejected — conflates two genuinely different operations ("add funds" vs "point at existing funds") behind one flag, and would make `--amount`'s meaning depend on invisible remote state.
- *Leave it, and require a fresh human checkout before every full rehearsal.* Rejected — it makes repeated end-to-end verification expensive enough that it won't get done, which is exactly how the ADR-013 bug below survived unnoticed until the second full run.

**Testing:** Real, all three paths, against the live account: attaching the real paid session `cks_0NkEvKofSCvb33CvbrQVl` correctly read ₹1,324 from Dodo and re-signed the mandate; passing `--amount` alongside `--reserve-ref` errored as intended; a bogus ref (`cks_totallyfakeref123`) produced a real Dodo 404, surfaced verbatim, and attached nothing. Then exercised end-to-end as Beat 2b of the full timed run. `tsc --noEmit` clean, `npm test` 45/45.

**Impact on other modules:** None. Additive CLI flag; `Ledger`/`DodoCreditLedger` untouched; `Mandate`'s shape unchanged (the reserve is populated exactly as `--amount` would populate it, just from a verified existing ref).

**Required follow-up work:** None. Worth knowing for the live demo: fund with `--reserve-ref` ahead of time (or as Beat 2b) so no browser checkout is ever needed during the run itself.

---

## ADR-013 — `gate run` drew real money and signed a receipt for an order that was never placed; now fails closed on a missing order id

**Date:** 2026-07-29 (later still)
**Author:** Agent B, found during the first complete end-to-end timed run
**Status:** Accepted

**What was found — the most serious bug of the build.** A real `gate run -- webcmd blinkit place-order --confirm` printed `ALLOW`, reported `✓ blinkit/place-order executed`, drew a real ₹20 from the Dodo reserve, wrote a `ledger.jsonl` entry, and signed a receipt with `payment.status: "captured"` — **and no order existed.** The cart still held the item afterward, and `orderId` came back empty.

webcmd gave every outward sign of success: exit code 0, its own trace `receipt.json` recording `"status": "success"`, and `summary.md` reporting `## Error - none`. The only truthful signal anywhere was the empty `orderId` field, plus webcmd's own final screenshot — which showed the browser sitting on Blinkit's cart panel at the **"Proceed To Pay ₹55"** button. The adapter had driven the flow up to the payment step and stopped there, which it reports as success because *the command it was asked to run* completed without error.

This is the worst possible failure mode for this specific product: a cryptographically signed receipt is the artifact the entire pitch rests on, and it was attesting to a purchase that never happened. Every layer downstream — the receipt chain, the dashboard, `gate verify` — would have faithfully confirmed that false receipt as valid, because it *was* validly signed. Signature validity says the record wasn't tampered with; it says nothing about whether the record was true when written. Nothing in the pipeline was checking the latter.

**Why it survived until now:** the earlier real run (₹476) was above Blinkit's free-delivery threshold, completed for real, and emptied the cart — so the happy path looked fine. The failure only appears on an order small enough to attract delivery/handling fees, which routes the UI into a payment step the adapter doesn't complete. A single successful run had been treated as proof the commit path worked.

**What changed:** in `cmdRun()`'s commit path, `execute()`'s returned rows are now inspected **before** anything is drawn, recorded, or signed. If the merchant returned no `orderId`, the CLI prints an explicit failure (surfacing webcmd's own `status`/`message` and the trace path), touches neither the ledger nor `ledger.jsonl`, writes **no receipt**, and exits non-zero. Ordering matters: the draw/record/sign block was moved to *after* this check, not merely guarded around.

**Alternatives considered:**
- *Trust webcmd's exit code and `status: "success"`.* This is what the code did, and it is exactly the bug. A third-party adapter's notion of "the command ran" is not the same claim as "the merchant created an order," and money must only move on the latter.
- *Also require `status === 'placed'` or similar.* Rejected as the primary check — the real status string vocabulary isn't documented anywhere and varies per adapter; a non-empty merchant-issued order id is the strongest, most portable evidence that the merchant actually committed. `status`/`message` are surfaced in the failure output for the operator rather than being load-bearing.
- *Write the receipt anyway but mark it unconfirmed.* Rejected — an unconfirmed receipt is not a weaker receipt, it's a different thing entirely, and emitting one would invite exactly the misreading this ADR exists to prevent. No order, no receipt.

**Cleanup of the bad run's real side effects:** the ₹20 draw was reversed against the live Dodo account (real `credit` ledger entry, balance restored ₹1,304 → ₹1,324, verified by reading it back), and the false receipt plus its `ledger.jsonl` line were deleted. The remaining ₹476 receipt still verifies (`✓ signature valid · chain intact`).

**Second, separate real bug found at the same time (not fixed here — see follow-up):** webcmd's `blinkit checkout`/`cart` **under-report the real payable.** For this cart they reported `payable: 20, deliveryCharge: 0, handlingCharge: 0`, while Blinkit's own UI in the same session showed items ₹20 + delivery ₹30 + handling ₹5 = **₹55 grand total.** The gate therefore made its decision against ₹20 when the merchant would have charged ₹55. That is a policy-correctness issue, not a cosmetic one: a ₹20 cart that is really ₹55 could pass a ₹50 cap. `docs/03-WEBCMD-INTEGRATION.md` § Step 3's whole premise is that the cart total used for `decide()` is *authoritative*, and for small orders it currently isn't.

**Impact on other modules:** No interface changes. `decide()` untouched. The dashboard is unaffected (it reads receipts; there will simply be no receipt for a non-order). Behaviour change: a `place-order` that doesn't produce an order id now exits 1 with no receipt, where it previously exited 0 with one.

**Required follow-up work:**
1. **The fee under-reporting is still open** and is the more dangerous of the two for policy correctness. Options to weigh: prefer the *larger* of cart/checkout payable, parse the real grand total from the checkout page, or treat a fee-bearing checkout as a step-up trigger. Needs a real decision, not a guess.
2. The ₹476 receipt's order was confirmed only indirectly (its cart emptied); its `network_order_id` is empty because it predates ADR-011. It is almost certainly a real completed order, but it is not *proven* by an order id, and shouldn't be described as if it were.
3. Worth re-testing the commit path against a cart above the free-delivery threshold to confirm the fixed path still writes a receipt on a genuine success.

---

## ADR-014 — Cart total fed to `decide()` is now MAX of every price-shaped field webcmd exposes (checkout.payable, checkout.itemsTotal+fees, cart.line-sum), read via a new `resolveCartTotalInr()` in `src/webcmd/cart-total.ts`

**Date:** 2026-07-30
**Author:** Agent B, closing ADR-013 follow-up 1
**Status:** Accepted

**What changed:**
- Added `src/webcmd/cart-total.ts` — a new module containing `resolveCartTotalInr(checkoutRow, cartLines)`, a **pure function** over already-parsed JSON. It returns `{amountInr, itemCount, sources, merchantBlocked, blockedReason}`.
- Added `src/webcmd/cart-total.test.ts` — 20 unit tests covering: the exact ADR-013 shape (₹20 reported / ₹55 actually charged); the ₹300 happy path; per-txn/total-cap regression checks; `checkoutBlocked`/`validations` step-up detection; source-precedence disagreements; every unresolvable-input path throws.
- Rewrote the commit-path cart-fetch block in `src/cli/gate.ts` (`cmdRun()`): now runs BOTH `webcmd <site> checkout -f json` AND `webcmd <site> cart -f json`, passes both payloads to `resolveCartTotalInr()`, and refuses (STEP_UP + explicit reason + exit 1) if the merchant itself signals `checkoutBlocked` or non-empty `validations` — before `decide()` even fires.

**What the fix ACTUALLY guarantees:** the number handed to `decide()` is the MAX of every price-shaped field webcmd surfaces for the cart. If any single field under-reports (the ADR-013 failure mode), the others still guard the cap. If webcmd's ENTIRE JSON uniformly under-reports (payable AND fees all wrong), we cannot detect that at this layer — that's a webcmd bug, out of scope per `CLAUDE.md` rule 7 and `docs/03-WEBCMD-INTEGRATION.md § Do not`.

**Why:** ADR-013 left three candidate fixes explicitly unchosen ("prefer larger", "parse grand total off checkout page", "treat fee-bearing checkout as step-up"). Investigating further pinned down the specific real-payload shape that made this decision less abstract:
- `blinkit/checkout`'s manifest columns are `[status, itemCount, itemsTotal, deliveryCharge, handlingCharge, payable, cartState, checkoutBlocked, validations]` — every fee component is a separate field, plus a `payable` grand total, plus explicit merchant-blocking signals. Its own description in `manifest.json` is literally *"Review Blinkit checkout totals and blockers without placing an order."* This IS the right command to ask for the commit-path total; the previous `cart` sum wasn't wrong so much as not-the-authoritative-view-of-the-order.
- `blinkit/cart`'s per-line `payable`/`total` is still useful as a lower-bound cross-check — if a stale checkout read gave a smaller number than fresh cart lines, taking the larger fails closed.
- The MAX-of-everything reconciliation subsumes candidate (a) "prefer larger of cart/checkout" cleanly and also catches the intra-checkout case where `payable` ≠ `itemsTotal + fees`.

Ended up NOT picking candidate (c) "treat any fee-bearing checkout as step-up" because that would deny legitimate ALLOWs the moment Blinkit charges any delivery fee (a routine, expected cost) — the cap check itself is the appropriate gate for that, not a categorical refusal.

Ended up NOT picking candidate (b) "parse the real grand total off the checkout page" because it requires bypassing webcmd's JSON contract to read the DOM directly, which is explicitly disallowed (`docs/03-WEBCMD-INTEGRATION.md § Do not`).

**Alternatives considered:**
- *Bake the resolver into `decide()` directly.* Rejected — `decide()` MUST stay pure and fee-agnostic (`CLAUDE.md` rule 2). Composing multiple read commands and reconciling their fields is I/O-shaped resolution, categorically on the webcmd side of the seam.
- *Inline the resolver in `cmdRun()` without a separate module.* Rejected — pulling it out makes it unit-testable against the exact ADR-013 payload with zero webcmd runtime, and gives the fix a home outside a 500-line CLI dispatcher.
- *Simply switch from `cart` to `checkout`, no MAX.* Rejected — `checkout` was also part of the ADR-013 under-report (`payable: 20`), so picking one command over the other doesn't fix the underlying "one field lied" case. MAX-of-all subsumes both.
- *Add a categorical "if payable < some_threshold require step-up" safety belt.* Rejected — inventing a magic threshold makes the tool worse on every legitimately small cart, and would still miss cases where webcmd under-reports at any total (nothing forces the bug to only appear below some threshold).

**Testing:**
- **20 new unit tests, all passing** (`src/webcmd/cart-total.test.ts`) — including the ADR-013 exact shape as a named regression test, and the ₹300 cart across ALLOW/DENY/OVER_PER_TXN_CAP scenarios. Total suite now 65/65 (was 45/45).
- **Live runtime sanity via ts-node**: called `resolveCartTotalInr()` directly against the ADR-013 payload (returned `55`, source `checkout.itemsTotal+fees`) and the ₹300 payload (returned `300`, sources `checkout.payable`+`checkout.itemsTotal+fees`). Not just "the types compile" — the actual pure logic on both real-shaped payloads produces the right numbers.
- **`tsc --noEmit` clean** on both root and `dashboard/`; **full build (`tsc`) clean**; **`node dist/cli/gate.js` starts cleanly**.
- **Not yet re-run against a live Blinkit session end to end.** This session is on a Mac without webcmd/cloakbrowser/`.env`/a Blinkit login — the live end-to-end verification requires the same Windows machine that ran Beats 5-8 originally. A concrete step-by-step recipe for that live test is in `docs/agent-b/LIVE-TEST-RECIPE-CART-300.md` (created this session). The four scenarios it covers are: ₹300 ALLOW under ₹500 cap; ₹300 DENY under ₹250 per-txn; ₹300 DENY under insufficient reserve; the ADR-013 regression (small cart with real fees under a ₹50 cap). Flagging explicitly rather than pretending unit tests are the same as a live run.

**Impact on other modules:**
- `decide()` — unchanged. Still pure, still fee-agnostic; the reconciled number just arrives cleaner.
- `docs/03-WEBCMD-INTEGRATION.md` — Step 4 ("Extract the real amount") is currently written as `const { total } = JSON.parse(cartResult)` against `blinkit cart`. That sketch was always guessed (there is no `total` field on the real cart response — see ADR-013's predecessor context), and now it also under-specifies which command to call. Should be updated to point at `resolveCartTotalInr()` and note that `checkout` (not `cart`) is the canonical grand-total source. Not done in this ADR — kept scope tight; flagging as follow-up 1 below.
- No interface contract changed (`docs/common/03-INTERFACES.md` unchanged) — `Decision`, `SpendRequest`, `Mandate`, `Receipt`, `GateEvent` all still have their frozen shapes.
- `src/cli/gate.ts`'s commit path now emits a new terminal message when the merchant itself blocks checkout ("merchant blocked checkout: <reason>") + a STEP_UP event. Additive; no existing event codes changed.

**Required follow-up work:**
1. **Update `docs/03-WEBCMD-INTEGRATION.md` § Step 4** to point at the resolver and describe the MAX-of-everything reconciliation.
2. **Live end-to-end test at ₹300** on the machine with webcmd/Blinkit — recipe in `docs/agent-b/LIVE-TEST-RECIPE-CART-300.md`. Not doing this here would be dishonest about what's proven; the resolver is proven exhaustively at the unit level and its wiring compiles, but nothing in this repo has exercised the fix against a real merchant response yet.
3. If the live test uncovers a webcmd payload shape not yet covered (e.g. a totally-different-per-line schema on another merchant), add it to `cart-total.test.ts` as a named regression — the whole point of extracting the resolver is that each real-world discovery becomes one more fast test, not a manual rehearsal note.

---

## ADR-015 — Dashboard is no longer read-only: `CLAUDE.md` rule 8 superseded by direct user instruction

**Date:** 2026-07-30
**Author:** Agent A, on direct, explicit, twice-confirmed user instruction
**Status:** Accepted — supersedes `CLAUDE.md`'s original rule 8 and this file's own framing of the dashboard everywhere it assumed GET-only

**What changed:** `dashboard/` is no longer constrained to GET-only API routes. It is becoming a full shopping-flow product: search (mock catalog), compare (mock, 4 merchants), cart, checkout with mandate selection, and a real "execute" action that triggers an actual `gate run -- webcmd blinkit place-order --confirm` for real Blinkit items — real money, real signed receipt, same as every other real execution in this build. `CLAUDE.md` rule 8 has been rewritten in place (not just here) to reflect this.

**Why:** Direct user instruction, given after I raised the conflict explicitly and explained the tradeoffs (see this session's chat — not reproduced here, but the short version: the original rule existed to keep exactly one audited path for money to move, and to avoid a web-facing write surface with its own injection/process-spawning risk). The user considered that and overrode it anyway, twice — first picking "Option 2: real gate integration" over a fake-success-state demo button, then explicitly saying "Change CLAUDE.md Rule... dashboard is No More now read-only. it should Full Fledged Functional Product." This is the project owner's call to make about their own project's architecture; it is not a case of an untrusted instruction to route around — it came directly from the user in chat, not from any observed/injected content.

**What did NOT change, and why this isn't "anything goes":**
- **`decide()` itself is still never called by dashboard code directly**, and neither is webcmd. Every write route that creates a mandate, funds a reserve, or executes a spend does so by **spawning the real `gate` CLI as a subprocess** (argument array, no shell — the exact safe-spawn discipline ADR-007 already established for `execute()`'s own webcmd invocation), never by re-implementing policy/execution logic inside a Next.js route handler. This means there is still exactly one place spend decisions get made, regardless of whether the request originated from a terminal or a browser click — the two front doors converge on the same gate.
- **No LLM in the decision path** — still absolute, untouched by this ADR. The shopping UI's "search"/"compare" are static mock data, not a live model call, and the real decision on execute is still `decide()` running inside the spawned CLI process, deterministic as ever.
- **Fail-closed** — still absolute. A malformed request to a new write route must reject before it reaches `gate`, the same way a malformed CLI arg already does.
- **Real-money confirmation discipline carries over.** Every real purchase in this project so far (Beats 5-8, the various live-test sessions) required a specific, direct human go-ahead before the money-moving command actually ran — that pattern doesn't lapse just because the trigger is now a web button instead of a terminal command. The UI itself should surface a real confirm step before calling the execute route, and I will not fire a live test purchase through this new path without asking in chat first, same as every prior real purchase in this build.
- **Only Blinkit gets the real loop.** webcmd's real, tested integration in this project is Blinkit only (805 commands, live-rehearsed multiple times). Zepto/BigBasket/District stay illustrative comparison data in the new shop flow, clearly labeled as such — inventing real scraping/integration for three more merchants in the time remaining would be exactly the scope-creep `09-HACKATHON-WOW-PLAN.md`'s "Explicit non-goals" section already warned against, and nothing about this ADR changes that non-goal.

**Alternatives considered:**
- *Keep the dashboard read-only, have it generate the exact CLI command for the user to paste into a terminal instead.* This was my own proposal before the override — real execution, zero new write-surface, same audited single path. Explicitly rejected by the user in favor of a real in-browser button.
- *Add the write capability in a separate service outside `dashboard/`, leaving the documented dashboard itself technically read-only.* Not seriously pursued — this would violate the spirit of what was asked while nominally preserving the letter of the old rule, which is exactly the kind of workaround `CLAUDE.md`'s own "if blocked, stop and flag, don't invent a workaround" guidance warns against. If the rule changes, it changes for real, documented as such.

**Impact on other modules — this is the important part for Agent B:** `dashboard/lib/*` and `dashboard/app/api/**` are Agent B's owned files per `05-PHASE-OWNERSHIP.md`, and Agent B built the existing three API routes (`/api/mandate`, `/api/events`, `/api/receipts`) as GET-only specifically because `03-INTERFACES.md` and `CLAUDE.md` told them to. **New write routes being added under this ADR are new files** (e.g. `/api/shop/*`, or new POST handlers alongside the existing GET ones) — I am not modifying Agent B's existing GET routes' behavior, only adding alongside them. Still, this is a real, load-bearing assumption changing out from under code Agent B already shipped believing it was permanent ("frozen," per `03-INTERFACES.md`'s own language for the dashboard API row) — if Agent B is mid-session when this lands, their own understanding of "dashboard never writes" is now stale the moment they pull. Flagging this as prominently as this build's docs mechanism allows: `01-PROJECT-STATUS.md`, `03-INTERFACES.md`'s dashboard row, and this ADR all point at each other.

**Required follow-up work:**
1. `03-INTERFACES.md`'s dashboard API row status updated to reflect write routes now exist (done, same session).
2. `01-PROJECT-STATUS.md` updated with the new task (done, same session).
3. Any real-money test of the new execute path needs a live, explicit, in-chat go-ahead before it runs — not implied by this ADR's existence.
4. If Agent B's own session touches `dashboard/lib/*` or the existing API routes concurrently, normal conflict resolution applies (`06-SYNC-WORKFLOW.md`) — the new routes are additive, so a clean rebase should be the common case, but flagging since this is a bigger simultaneous change than this project's usual small-diff pushes.

