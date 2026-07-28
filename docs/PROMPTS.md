# PROMPTS — Phase-Based Build Prompts for Claude Code

> Copy one prompt at a time into Claude Code, in order. Do not skip ahead — each phase assumes the previous one is committed and passing its own tests. Every prompt tells Claude Code to read the relevant spec file(s) in `docs/` first — this is intentional, don't strip it out to save time.
>
> After running each phase, fill in the matching section of `OUTCOME.md` with what actually happened before moving to the next prompt.

---

## Phase 0 — Project scaffolding

```
Read docs/00-PRODUCT-BRIEF.md and docs/01-ARCHITECTURE.md in full.

Set up a new Node.js + TypeScript project at the root of this folder (sibling to docs/),
matching the exact repo layout in docs/01-ARCHITECTURE.md § Repo layout.

Concretely:
1. `npm init -y`, add TypeScript, ts-node, and a test runner (use Node's built-in
   `node:test` + `node --test` unless you have a strong reason to add a dependency —
   this is a 72-hour build, minimize new dependencies).
2. Create tsconfig.json targeting Node 20+, strict mode on.
3. Create every file and folder listed in the repo layout, each with a one-line
   comment header and, where the file is a Phase 2-4 stub, the stub content shown
   in docs/01-ARCHITECTURE.md § What is a stub.
4. Add a .env.example (not .env) documenting DODO_API_KEY, DODO_API_KEY_READONLY,
   DODO_ENV, DODO_WEBHOOK_SECRET — with placeholder values, and add .env to .gitignore.
5. `npm install dodopayments` (Dodo's official TS SDK) — do not install anything else yet.
6. Confirm `tsc --noEmit` passes with the scaffolded stub files in place.

Do not implement any real logic yet — this phase is scaffolding only. Report back
with the final file tree and confirm the build compiles.
```

---

## Phase 1a — Mandate schema, canonical JSON, Ed25519 signing

```
Read docs/04-POLICY-ENGINE-SPEC.md § The Mandate schema and § Canonical JSON + Ed25519 signing.

Implement, exactly as specified:
- src/mandate/schema.ts — the Mandate interface
- src/mandate/sign.ts — canonicalJSON(), generateKeyPair(), sign(), verify()
- src/mandate/render.ts — renderConsent()

Then write unit tests (src/mandate/sign.test.ts) that prove, with node:test:
1. Signing an object and verifying it unmodified passes.
2. Mutating any single field after signing causes verification to fail.
3. canonicalJSON() produces identical output regardless of input key order
   (e.g. {a:1,b:2} and {b:2,a:1} must canonicalize to the same string).

This must have zero dependency on webcmd, Dodo, or the filesystem beyond reading
its own inputs. Run the tests and paste the output. Do not proceed to Phase 1b
until all three tests pass.
```

---

## Phase 1b — Policy Engine (`decide()`)

```
Read docs/04-POLICY-ENGINE-SPEC.md § The decide() function in full, including the
rule table and the note about rule ordering being load-bearing for the demo script.

Implement src/policy/decide.ts exactly matching the Decision type, SpendRequest type,
and decide() function signature shown in the spec. Rule order (0 through 8, plus 9/10
noted as implementation-specific) must match exactly — the DENY reason a judge sees
during the live demo depends on which rule fires first.

decide() must have ZERO I/O: no filesystem reads, no network calls, no console output.
It receives mandate, publicKey, ledgerBalanceInr, and txnCountSoFar as plain arguments
and returns a plain Decision object.

Write src/policy/decide.test.ts covering every rule in the table:
- read access always allows regardless of mandate state
- unknown command (access undefined) denies with UNKNOWN_COMMAND
- expired mandate denies with EXPIRED even when amount is fine
- bad signature denies with BAD_SIGNATURE before any other rule can fire
  (construct a test where signature is bad AND mandate would otherwise be expired —
  confirm BAD_SIGNATURE wins, proving rule order)
- amount over per_txn_inr denies with OVER_PER_TXN_CAP and correct overBy value
- amount over remaining ledgerBalanceInr denies with OVER_TOTAL_CAP and correct overBy
- merchant not in mandate.scope.merchants denies with MERCHANT_NOT_ALLOWED
- txnCountSoFar >= max_txns denies with TXN_LIMIT_REACHED
- a request satisfying every rule allows

Run the tests and paste the full output. This is the single most important test
suite in the project — do not proceed until every case passes, including the
rule-order test.
```

---

## Phase 1c — Dodo Payments integration (test mode only)

```
Read docs/02-DODO-INTEGRATION.md in full, including the § Scope reminder
(test mode ONLY, no live mode, ever, in this build).

Before writing code: confirm a .env file exists locally (not committed) with
DODO_API_KEY and DODO_API_KEY_READONLY from a real Dodo test-mode account. If it
doesn't exist, stop and tell me to create the account and keys first — do not
mock this away.

Implement:
- src/ledger/Ledger.ts — the Ledger interface exactly as specified
- src/ledger/DodoCreditLedger.ts implementing fund(), balance(), draw(), release()
  using the real `dodopayments` SDK against https://test.dodopayments.com

For fund(): create a real Checkout Session as shown in docs/02-DODO-INTEGRATION.md,
tagged with metadata.mandate_id.

For balance(): call the SDK's Credit Entitlement Balance retrieval. IMPORTANT: the
exact method/field names in the doc are a sketch — install the SDK, inspect its
actual TypeScript types, and read one real API response before finalizing this
method. Tell me what the actual response shape was.

For draw(): deduct credit tagged with the runId. Check whether the SDK/API accepts
a request-side idempotency_key parameter — this is flagged as an open, unverified
question in the doc. If it does not, implement the fallback described in the doc
(check ledger.jsonl for the runId before calling draw() at all) inside
src/webcmd/executor.ts, not inside DodoCreditLedger itself — keep the ledger class
honest about what Dodo's API actually guarantees versus what our own code guarantees.

For release(): a test-mode no-op is acceptable for Phase 1.

Write a small integration script (not a unit test — this hits the real network)
that: creates a session, funds ₹800, reads the balance, draws ₹100 with a fake
runId, reads the balance again, and prints all raw API responses. Run it against
the real test-mode account and paste the actual output — I need to see the real
API shape, not an assumption.
```

---

## Phase 1d — webcmd integration

```
Read docs/03-WEBCMD-INTEGRATION.md in full.

Prerequisite: confirm `webcmd doctor` succeeds on this machine and `webcmd list -f json`
returns real data. If webcmd is not installed, run `npm i -g @agentrhq/webcmd@0.4.3`
first and tell me if `webcmd doctor` reports any failures — do not proceed past a
failing doctor check.

Implement:
- src/webcmd/manifest.ts — loadManifest() with live-fetch + disk-cache fallback,
  exactly as specified (never let a live-fetch failure crash the app)
- src/webcmd/executor.ts — execute() that spawns webcmd for ALLOW decisions,
  captures runId/columns/tracePath from its JSON output, and implements the
  idempotency fallback check against ledger.jsonl described in Phase 1c's prompt

Write a small manual test script that:
1. Loads the manifest and prints the count of write-access commands found
   (should print a real number close to ~192, not a hardcoded value)
2. Looks up `blinkit/place-order` and confirms its access is 'write'
3. Looks up a nonsense command name and confirms it returns undefined (fail-closed case)

Run this against the real webcmd installation and paste the actual output.
```

---

## Phase 1e — Receipts and the verify chain

```
Read docs/04-POLICY-ENGINE-SPEC.md § The Receipt schema in full.

Implement:
- src/receipt/schema.ts — the Receipt interface
- src/receipt/chain.ts — buildAndSignReceipt() and verifyReceipt(), using the
  same sign()/verify() from src/mandate/sign.ts (the gate has its own Ed25519
  keypair, separate from the mandate issuer's)

Add chain-walking logic: given a folder of receipt JSON files, sort by signed_at,
confirm each receipt's prev_receipt_hash matches sha256(canonicalJSON(previous
receipt)), and confirm each receipt's own signature verifies.

Write tests proving:
1. A valid two-receipt chain verifies cleanly end to end.
2. Editing any field in the first receipt (after generation) causes the SECOND
   receipt's chain link to fail, not just the first receipt's own signature —
   this is the tamper-test behavior the live demo relies on (docs/05-DEMO-SCRIPT.md
   Beat 7).

Run the tests and paste the output.
```

---

## Phase 1f — CLI and two-pane terminal UI

```
Read docs/05-DEMO-SCRIPT.md in full — this is the acceptance test for this phase.

Implement src/cli/gate.ts as the `gate` command with subcommands:
- gate scan
- gate mandate create --subject <s> --cap <n> --per-txn <n> --merchants <a,b,c> --expires <time>
- gate mandate resign <mandate_id> --cap <n>
- gate fund <mandate_id> --amount <n>
- gate run -- webcmd <site> <command> [args...]
- gate receipt show <receipt_id>
- gate verify <receipt_id>

Wire every subcommand to the real modules built in Phases 1a-1e — no mocked
output anywhere. The exact terminal output format for each subcommand is shown
in docs/05-DEMO-SCRIPT.md Beats 1 through 8 — match it as closely as practical,
but prioritize the DATA being real (real hashes, real runIds, real Dodo
references) over pixel-perfect formatting.

Implement src/cli/ui.ts as the two-pane terminal layout described in vault
Build/30 - MVP Architecture.md § C7 (agent pane left, gate decision log right,
status strip along the bottom showing RESERVE and SETTLEMENT state) — plain ANSI
in two panes, no web framework.

After this phase, do not run the full demo sequence yet — that's Phase 1g.
Confirm each subcommand runs individually without crashing first, and paste
the output of `gate scan` and `gate mandate create` against your real
environment.
```

---

## Phase 1g — Full end-to-end integration run (the real acceptance test)

```
Read docs/05-DEMO-SCRIPT.md in full again, and docs/00-PRODUCT-BRIEF.md § Timeline.

Run the ENTIRE Beat 1 through Beat 8 sequence for real:
- real webcmd session, logged into a real merchant site
- real Dodo test-mode Checkout Session and Credit Entitlement Balance
- a cart total that genuinely exceeds the mandate cap (to trigger a real
  OVER_TOTAL_CAP deny, not a scripted one)
- a real re-sign and successful completion
- a real receipt chain with a real tamper test

Time the full run with a stopwatch. Paste the FULL terminal output, start to
finish, plus the elapsed time.

Then go through docs/05-DEMO-SCRIPT.md § Acceptance checklist and confirm or
deny each line item explicitly. Any unchecked item is a Phase 1 gap — fix it
before considering Phase 1 complete. Do not move to Phase 2-4 stubs or the
demo rehearsal until every acceptance checklist item is checked.

Once this passes, write a summary of this run into docs/OUTCOME.md under
"Phase 1g — End-to-end run" (see docs/OUTCOME.md for the exact section to fill in).
```

---

## Phase 1h — Dashboard (Next.js, read-only)

```
Read docs/06-DASHBOARD-SPEC.md in full.

Prerequisite: Phase 1e (receipts/chain) must be done and the GateEvent/Mandate/Receipt
schemas frozen — this phase reads files whose shape came from those phases. If you're
running phases sequentially, do this after Phase 1g. If a second engineer/session is
available, it can start as soon as 1b and 1e are both done, in parallel with 1c/1d/1f.

Scaffold a separate Next.js app at dashboard/ (its own package.json, App Router,
Tailwind CSS) exactly matching the folder structure in docs/06-DASHBOARD-SPEC.md.
Record the exact Next.js version `create-next-app` installs into docs/OUTCOME.md.

Implement the three pages and three API routes described in the spec:
- GET /api/mandate, GET /api/events, GET /api/receipts
- / (mandate summary + live Dodo balance), /events (live feed), /receipts (verify status)

HARD CONSTRAINT: no API route in dashboard/app/api/ may call anything that writes —
no mandate creation, no Ledger.fund()/draw()/release(), no webcmd invocation of any
kind. Every route in this app is GET-only and read-only. Do not import DODO_API_KEY
(the write key) anywhere in this app — only DODO_API_KEY_READONLY.

Use polling (1.5-2s interval) for the live /events feed, not WebSockets or SSE, per
the spec's reasoning. Do not add a state-management library or a component library
beyond Tailwind unless the acceptance checklist below is already fully met with
time to spare.

Once built, run `npm run build && npm run start` (not `next dev`) and confirm all
three pages show real data from an actual mandate/events.jsonl/receipts produced by
the CLI in earlier phases — not mocked data. Then kill the dashboard process and
confirm the CLI demo (Phase 1g's sequence) is completely unaffected — the two must
be fully independent.

Go through docs/06-DASHBOARD-SPEC.md § Acceptance checklist explicitly and confirm
each line. Log the results into docs/OUTCOME.md under "Phase 1h — Dashboard".
```

---

## Phase 2-4 — Stub verification (not implementation)

```
Read docs/01-ARCHITECTURE.md § What is a stub and § Phase 2/3/4 sections.

Confirm the stub files created in Phase 0 (src/phase2-4-stubs/*) still match the
"what is a stub" definition exactly:
1. Each file compiles under `tsc --noEmit`.
2. Each exported class/function is correctly typed against the interfaces
   described in docs/01-ARCHITECTURE.md.
3. Each method either throws an explicit "not implemented" error or is a
   documented no-op — nothing partially works.
4. Nothing in src/cli, src/policy, src/webcmd, or src/ledger imports anything
   from src/phase2-4-stubs/.

Do NOT implement real logic for these phases now. This step exists only to prove
the modular architecture claim holds — that Phase 1 shipped without needing to
touch these files, and that they're ready to be filled in after the hackathon
without restructuring anything in Phase 1.

Report which of the four stub files (if any) do not yet meet this definition,
and fix only what's needed to satisfy it — no feature work.
```

---

## Phase 5 — Demo rehearsal and fallback recording

```
Read docs/05-DEMO-SCRIPT.md.

This is not a coding prompt — it's a checklist to execute:
1. Run the full Phase 1g sequence three times, timed, confirming it completes
   within 4 minutes each time.
2. Run it once on venue-like wifi and once on a phone hotspot if possible.
3. Record a full successful run as a screen-capture video, no audio needed,
   under 4 minutes, as the fallback described in the reliability playbook.
4. Rehearse the "browser-less" fallback path once: submit a spend request
   with a hardcoded cart total (no live webcmd call) and confirm the DENY/ALLOW
   beats still work from mandate + ledger state alone.
5. Confirm `gate verify` works on a receipt generated in an earlier session
   (not just one generated seconds ago) — this surfaces clock/serialization bugs.

Log the results of each of these five steps into docs/OUTCOME.md under
"Phase 5 — Rehearsal results", including the three timed run durations and
any bug found during rehearsal.
```

---

**After every phase:** update `OUTCOME.md`. Do not skip this — it's how deviations from this spec get tracked instead of silently forgotten.
