# OUTCOME — Build Log

> This file is the running record of what actually happened, as it happened, against the plan in `PROMPTS.md`. Fill in the matching section immediately after each phase prompt finishes running — not at the end of the day, not from memory later. If something in the code ends up different from what `00`–`05` specified, write it here and update the relevant spec file too, so the two never drift apart.

Rules for using this file:

1. **Every entry gets a timestamp and a status.** Status is one of: ✅ Done as spec'd · ⚠️ Done with deviation (explain) · ❌ Blocked (explain what's needed) · ⏭ Skipped (explain why).
2. **Deviations are not failures — undocumented deviations are.** If Dodo's real API returned a different field name than the doc assumed, that's expected and fine; just write it down and fix the doc.
3. **Copy real terminal output in, don't paraphrase it.** "It worked" is not a log entry. The actual pasted output is.
4. Keep entries in chronological order, oldest first.

---

## Phase 0 — Project scaffolding

**Status:** ✅ Done as spec'd (with two recorded deviations, see below)
**Timestamp:** 2026-07-28, Agent A

- [x] Repo structure created matching `01-ARCHITECTURE.md`
- [x] `tsc --noEmit` passes
- [x] `.env.example` + `.gitignore` in place
- [x] `dodopayments` SDK installed

**What actually happened / deviations:**

Ran `npm init -y`, then `npm install --save-dev typescript ts-node @types/node` and `npm install dodopayments`. Created the full `src/` tree from `01-ARCHITECTURE.md` § Repo layout: every Phase 1 file (`src/mandate/*`, `src/policy/*`, `src/ledger/*`, `src/receipt/*`, `src/webcmd/*`, `src/cli/*`) got a one-line comment header only, per the Phase 0 prompt's literal instruction ("Do not implement any real logic yet"). The four Phase 2-4 stub files got their real stub content from `01-ARCHITECTURE.md` § What is a stub (typed classes, each throwing `Not implemented — see docs/01-ARCHITECTURE.md`).

**Deviation 1 — `src/events/GateEvent.ts` got real content, not a comment stub.** The literal Phase 0 instruction says every file gets a one-line comment, which would include this one. I deviated because `01-ARCHITECTURE.md` explicitly calls `GateEvent` "the one contract everything else is built around... populate every field in Phase 1... never restructure it later," gives its complete type definition already, has zero implementation dependencies (pure types, no logic), and — most concretely — the parallel-development docs already written in `docs/common/03-INTERFACES.md` and `05-PHASE-OWNERSHIP.md` tell Agent B to expect this file created for real in Phase 0. Leaving it as a comment would have made those already-published docs wrong on Agent B's very first pull. Writing an interface/type-only file has zero runtime logic, so this doesn't violate "scaffolding only."

**Deviation 2 — fixed a real spec inconsistency in `01-ARCHITECTURE.md`.** While writing `GateEvent.ts`, found that `05-DEMO-SCRIPT.md` Beat 8 requires a DENY with code `ALREADY_EXECUTED` (the idempotency-replay check), but the `DenyCode` union in `01-ARCHITECTURE.md` didn't include that value. Added `'ALREADY_EXECUTED'` to the union in `01-ARCHITECTURE.md` and to `GateEvent.ts` to match, per `CLAUDE.md` rule 6 (fix the doc when reality — here, cross-spec consistency — shows it was wrong).

**Deviation 3 — corrected `docs/common/03-INTERFACES.md`'s ownership note for the `Ledger` interface.** It previously said "Agent A defines (Phase 0) / Agent B implements (Phase 1c)." Re-checking `docs/PROMPTS.md` Phase 1c's actual instructions shows `src/ledger/Ledger.ts` (the interface itself, not just `DodoCreditLedger`) is explicitly a Phase 1c deliverable owned by Agent B — Phase 0 doesn't touch it. Fixed the registry row and left `Ledger.ts` as a one-line comment stub, consistent with every other Phase 1 file.

**TypeScript toolchain finding (real, not from the spec's guesses):** `npm install typescript` resolved to `typescript@7.0.2` (the new native/Go-ported compiler). Two real incompatibilities surfaced against it:
1. `moduleResolution: "node"` is rejected outright — TS 7 removed the legacy `node10` resolution mode. Fixed by using `"module": "node16"` / `"moduleResolution": "node16"` in `tsconfig.json`.
2. `ts-node` (10.9.2, latest) crashes on `require('ts-node/register')` against TS 7 — its `configuration.js` reads `ts.sys.fileExists` and `ts.sys` is `undefined` on the new compiler, meaning `ts-node` hasn't been updated for TS 7's API surface yet.

Resolution: pinned `typescript` to `5.9.3` (latest stable 5.x), which `ts-node` supports cleanly. `tsc --noEmit` and `node --require ts-node/register --test` (via `npm run typecheck` / `npm test`) both pass against 5.9.3. Recommend re-testing against TS 7 later once `ts-node` catches up, but not worth blocking Phase 1 on it now — this is exactly the kind of "verify against the real thing, not the doc's assumption" case `CLAUDE.md` rule 6 anticipates, just against a tool's actual behavior instead of an external API.

**Second real finding — `node --test` directory-argument bug (or at least, surprising behavior) on Node 22.18.0 / Windows.** The Phase 0 prompt's own suggested pattern (`node:test` + `node --test`) needed one adjustment: passing an explicit directory (`node --test ./src` or `node --test src`) fails with `Cannot find module '...\src'` — Node tries to run the directory as if it were the main entry script rather than using it as a recursive test-discovery root. This reproduces with or without `--require ts-node/register`, so it isn't a `ts-node` issue. Fix: omit the path argument entirely — `node --test` with no path already recursively discovers `**/*.test.ts` under the current working directory (and correctly skips `node_modules`). Final `package.json` test script: `"test": "node --require ts-node/register --test"`.

**Installed versions (for reference):** `typescript@5.9.3`, `ts-node@10.9.2` (latest), `dodopayments@2.43.0`, Node `v22.18.0`, npm `11.6.2`.

**Verification run:**
```
$ npx tsc --noEmit
(no output, exit 0)

$ npm test
> node --require ts-node/register --test
TAP version 13
# Subtest: src\policy\decide.test.ts
ok 1 - src\policy\decide.test.ts
# tests 1
# pass 1
# fail 0
```


---

## Phase 1a — Mandate schema, canonical JSON, Ed25519 signing

**Status:** ✅ Done as spec'd (with two recorded deviations in `render.ts`, see below)
**Timestamp:** 2026-07-29, Agent A

- [x] Sign/verify round-trip test passes
- [x] Tamper-detection test passes
- [x] canonicalJSON key-order independence test passes

**What actually happened / deviations:**

Implemented `src/mandate/schema.ts` (the `Mandate` interface plus a hand-written `isMandate()` structural type guard — no validation library, per `CLAUDE.md` § Package choices), `src/mandate/sign.ts` (`canonicalJSON()`, `generateKeyPair()`, `sign()`, `verify()` — copied faithfully from `04-POLICY-ENGINE-SPEC.md`'s code, no changes needed), and `src/mandate/render.ts` (`renderConsent()`).

**Deviation — `renderConsent()` doesn't match `04-POLICY-ENGINE-SPEC.md`'s code sketch verbatim, and that's deliberate.** The spec's sketch does `m.scope.merchants.map(capitalize).join(', ')`. Smoke-testing it against the mandate from `05-DEMO-SCRIPT.md` Beat 2 surfaced two real problems:
1. Beat 2's exact required output is `"...at Blinkit, Zepto or BigBasket, in one transaction..."` — a grammatical list with a trailing "or", not a flat comma join. The spec's own sketch would have produced `"Blinkit, Zepto, Bigbasket"`.
2. A generic `capitalize()` cannot turn `bigbasket` (webcmd's lowercase site key) into `BigBasket` (the brand's actual capitalization) — it has no way to know where the internal capital belongs.

Per `docs/AGENTS.md` § UI rules ("`docs/05-DEMO-SCRIPT.md` is the equivalent of an attached design file... treat every code block in it as exact"), Beat 2's wording wins over the plainer code sketch in `04-POLICY-ENGINE-SPEC.md`. Implemented a `joinWithOr()` grammatical-list helper and a small `BRAND_NAMES` lookup table (`blinkit`, `zepto`, `bigbasket`, `district` — the merchants named across `03-WEBCMD-INTEGRATION.md` and `05-DEMO-SCRIPT.md`) with a `capitalize()` fallback for anything not in the table. Added `src/mandate/render.test.ts` (not required by `docs/PROMPTS.md` Phase 1a's prompt, which only asks for `sign.test.ts` — added anyway since I'd just found two real bugs in code the acceptance test checks byte-for-byte) covering both fixes plus the fallback path.

**Test run (`src/mandate/sign.test.ts`, 5 tests, all required by `docs/PROMPTS.md` Phase 1a plus one extra keypair-isolation check):**
```
ok 1 - signing an object and verifying it unmodified passes
ok 2 - mutating any single field after signing causes verification to fail
ok 3 - canonicalJSON() produces identical output regardless of top-level key order
ok 4 - canonicalJSON() is deterministic through nested objects and arrays of objects
ok 5 - a signature from one keypair does not verify against a different keypair
```

**Test run (`src/mandate/render.test.ts`, 4 tests, added for the deviation above):**
```
ok 1 - renders a Beat-2-shaped sentence with a grammatical "a, b or c" merchant list
ok 2 - bigbasket renders as BigBasket, not Bigbasket — brand name, not a generic capitalize()
ok 3 - a two-merchant mandate joins with "or" and no comma
ok 4 - an unlisted merchant falls back to a plain capitalized name
```

Full suite: `npm test` → 10/10 passing (9 real + the still-empty `decide.test.ts` stub, which will gain real tests in Phase 1b). `npx tsc --noEmit` → exit 0.


---

## Phase 1b — Policy Engine (`decide()`)

**Status:** ✅ Done as spec'd (with one significant, well-evidenced rule-order correction — see below)
**Timestamp:** 2026-07-29, Agent A

- [x] All rule-table unit tests pass (0 through 8)
- [x] Rule-order test (BAD_SIGNATURE beats EXPIRED) passes
- [x] `decide()` confirmed to have zero I/O — takes only plain data (`SpendRequest`, `Mandate`, `publicKey`, `ledgerBalanceInr`, `txnCountSoFar`, `now`), no filesystem/network/console calls anywhere in the function

**What actually happened / deviations:**

**Significant deviation — reordered Rule 0-3, and updated `04-POLICY-ENGINE-SPEC.md` to match.** Before writing tests, cross-checked the spec's decide() sketch against `03-WEBCMD-INTEGRATION.md` § Step 3, which says read commands get "no mandate check, no ledger touch, no signature verification." The spec's own decide() had signature (Rule 0) and expiry (Rule 1) checks running *before* the read short-circuit (Rule 3) — meaning a read against an expired or badly-signed mandate would be denied, directly contradicting `03-WEBCMD-INTEGRATION.md`, and also directly contradicting the literal wording of `docs/PROMPTS.md` Phase 1b's own required test: "read access always allows, **regardless of mandate state**." Two independent spec sources and the acceptance test itself all pointed the same direction, so this reads as a genuine bug in the original sketch, not an intentional design choice.

Fixed by moving the read-access check to Rule 0 (fires before anything else). Signature, expiry, and unknown-command checks kept their relative order among each other, just shifted down one slot each (now Rules 1, 2, 3). Rules 4-8 (merchant/amount/per-txn/total-cap/txn-limit) are unchanged in content and position. Updated `docs/04-POLICY-ENGINE-SPEC.md`'s code block and added a "Rule order note" explaining the correction, per `CLAUDE.md` rule 3's requirement to update the spec file whenever rule order changes. Confirmed this doesn't affect `05-DEMO-SCRIPT.md`'s scripted `OVER_TOTAL_CAP` scenario — that's a write request, unreachable until Rule 4 regardless of how 0-3 are ordered.

Deliberately did **not** reorder "unknown command" (Rule 3) relative to signature/expiry, even though the same "check cheap things first" logic might suggest it — nothing in either spec or the required tests provides evidence for that change, so extending the fix beyond what the read-access case actually demonstrated would have been guessing, not correcting a proven bug.

**Second deviation — `SpendRequest.access` widened to include `undefined`.** The spec typed it `'read' | 'write'` only, which makes Rule 3's `req.access === undefined` check unreachable dead code under TypeScript — the type itself guarantees it can never be true. `03-WEBCMD-INTEGRATION.md`'s manifest lookup (`Map<string, 'read'|'write'>`) naturally returns `undefined` for an unrecognized command, so the type just needed to say what the real caller's data actually looks like. This is a fail-closed correctness issue, not a style nit: without it, an unrecognized command could never actually hit the `UNKNOWN_COMMAND` deny path through the type system as originally sketched.

Did not implement `rules.ts` — `docs/PROMPTS.md` Phase 1b's prompt only asks for `decide.ts` and `decide.test.ts`; `rules.ts` is described in `01-ARCHITECTURE.md`'s repo layout as "the ordered rule table as data + functions" but nothing currently needs that decomposition, and inventing content for it now would be exactly the kind of unrequested abstraction `CLAUDE.md`/`AGENTS.md` warn against. Left as its Phase 0 comment stub.

**Test run (`src/policy/decide.test.ts`, 11 tests — the 9 required by `docs/PROMPTS.md` Phase 1b plus 2 extra: an `AMOUNT_UNPARSEABLE` case, and a dedicated regression test proving read beats a bad signature):**
```
ok - read access always allows, regardless of mandate state
ok - read access allows even against a badly signed mandate — proves Rule 0 (read) fires before Rule 1 (signature)
ok - unknown command (access undefined) denies with UNKNOWN_COMMAND
ok - expired mandate denies with EXPIRED even if amount is fine
ok - bad signature denies with BAD_SIGNATURE before any other rule can fire (beats EXPIRED)
ok - amount over per_txn_inr denies with OVER_PER_TXN_CAP and correct overBy
ok - amount over remaining ledgerBalanceInr denies with OVER_TOTAL_CAP and correct overBy
ok - merchant not in mandate.scope.merchants denies with MERCHANT_NOT_ALLOWED
ok - txnCountSoFar >= max_txns denies with TXN_LIMIT_REACHED
ok - amount unparseable (undefined) denies with AMOUNT_UNPARSEABLE
ok - a request satisfying every rule allows
```

Full suite: `npm test` → 20/20 passing (9 mandate/sign + 11 decide). `npx tsc --noEmit` → exit 0.


---

## Phase 1c — Dodo Payments integration

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Dodo test-mode account created, API keys obtained
- [ ] `fund()` creates a real Checkout Session — paste session ID/response below
- [ ] `balance()` — **record the ACTUAL field name Dodo's API returns** (doc's guess may be wrong)
- [ ] `draw()` — **record whether request-side idempotency_key is actually supported** (open question in the spec)
- [ ] Integration script run against real API — output pasted below

**What actually happened / deviations:**

**Real API response shapes observed (paste raw JSON):**


---

## Phase 1d — webcmd integration

**Status:** ⏳ Not started
**Timestamp:**

- [ ] `webcmd doctor` passes on the build machine
- [ ] `loadManifest()` returns real data, write-command count recorded: ___
- [ ] Fail-closed behavior confirmed for an unknown command
- [ ] Live-fetch-fails-fall-back-to-cache path tested at least once

**What actually happened / deviations:**


---

## Phase 1e — Receipts and verify chain

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Two-receipt chain verifies cleanly
- [ ] Tampering with receipt N breaks verification of receipt N+1's chain link

**What actually happened / deviations:**


---

## Phase 1f — CLI and two-pane UI

**Status:** ⏳ Not started
**Timestamp:**

- [ ] All `gate` subcommands run without crashing
- [ ] Two-pane UI legible / correctly formatted

**What actually happened / deviations:**


---

## Phase 1g — End-to-end run (the real acceptance test)

**Status:** ⏳ Not started
**Timestamp:**

**Full pasted terminal output of the complete Beat 1–8 run:**

```
(paste here)
```

**Elapsed time of the run:**

**Acceptance checklist from `05-DEMO-SCRIPT.md`, checked against this real run:**

- [ ] Beats 1–6 ran against real webcmd + real Dodo, end to end
- [ ] Beat 4's DENY confirmed to NOT spawn a webcmd subprocess
- [ ] `gate verify` reflected real signature checks, not hardcoded output
- [ ] Full run completed within 4 minutes
- [ ] Fallback recording exists, dated

**Gaps found and how they were fixed:**


---

## Phase 1h — Dashboard (Next.js, read-only)

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Next.js version actually installed: ___
- [ ] `/`, `/events`, `/receipts` all show real data, not mocked
- [ ] Confirmed no API route writes anywhere (code-reviewed, not assumed)
- [ ] Confirmed only `DODO_API_KEY_READONLY` is used in this app, never the write key
- [ ] `npm run build && npm run start` tested on the actual demo machine
- [ ] Dashboard process killed mid-rehearsal — CLI demo path confirmed unaffected

**What actually happened / deviations:**


---

## Phase 2-4 — Stub verification

**Status:** ⏳ Not started
**Timestamp:**

- [ ] All four stub files compile
- [ ] No Phase-1 runtime path imports any stub
- [ ] Any stub not meeting the definition — what was fixed:

**What actually happened / deviations:**


---

## Phase 5 — Rehearsal results

**Status:** ⏳ Not started
**Timestamp:**

| Run # | Network | Duration | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Fallback video recorded:** Y/N, path:
**Browser-less fallback path rehearsed:** Y/N
**`gate verify` tested on an older receipt:** Y/N, result:
**Bugs found during rehearsal:**


---

## Running list of open questions resolved during the build

(Move items here from the "Open questions" sections of `02-DODO-INTEGRATION.md` and `01-ARCHITECTURE.md` once answered for real, with the real answer.)

| Question | Where it was open | Real answer found | Date |
|---|---|---|---|
| Does Dodo's checkout/payment API accept a request-side idempotency key? | `02-DODO-INTEGRATION.md` | | |
| Exact field name for Credit Entitlement Balance | `02-DODO-INTEGRATION.md` | | |
| Is the $1,000 promotional credit visible/real in the dashboard? | vault `_TASKS & STATUS` Q8 | | |

---

## Final pre-hackathon status (fill in night of 31 Jul)

**What shipped, exactly:**

**What was cut, and why:**

**Known risks going into Saturday:**

**Confidence level for the live demo (1–5):**

---

This log exists so spec-vs-reality drift is visible, not lost. Update it every time a phase in `PROMPTS.md` finishes running.
