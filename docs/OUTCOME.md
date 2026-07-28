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

**Status:** ✅ Provisioning + live verification complete — B-001 fully cleared. Real money-path proven end to end in test mode: product → checkout → paid → `credit.added` webhook → 100000 credits readable via the read-only key. `src/ledger/DodoCreditLedger.ts` implementation itself still not written (deliberately out of scope for this session — see below).
**Timestamp:** 2026-07-29 (later same day), Agent A

- [x] Dodo test-mode account confirmed to exist (user screenshot, Settings → Promotions)
- [x] All required API keys/IDs obtained — `DODO_API_KEY` (write) and `DODO_API_KEY_READONLY` were both already present in `.env` (found populated this session; `04-BLOCKERS.md`/this file's earlier entry were stale — only `DODO_CREDIT_ENTITLEMENT_ID` and the Product were genuinely still missing). Both keys verified live this session (see below). `DODO_WEBHOOK_SECRET` remains empty — out of scope for this session's task, still optional per `docs/02-DODO-INTEGRATION.md`.
- [x] Credit Entitlement created for real via `client.creditEntitlements.create()`: `cde_0NkBmcWcZ3I79sHr1UZCx`, name "Agent Spend Credits", `unit: "INR paise"`, `precision: 0` (see design decision below)
- [x] Top-up Product created for real via `client.products.create()`, credit entitlement attached: `pdt_0NkBmcZQJLSicxFMHlNHX`, name "Agent Spend Credits Top-Up", one-time price ₹1,000.00 (100000 paise), 100000 credits granted on purchase
- [x] `fund()`-shaped Checkout Session created for real via `client.checkoutSessions.create()`: `cks_0NkBmhmGVSy7WTCPOd8oh` → `https://test.checkout.dodopayments.com/session/cks_0NkBmhmGVSy7WTCPOd8oh`
- [x] Test purchase completed — **done by the user, not the agent** (completing a hosted checkout means entering card/UPI details, a prohibited agent action even in test mode). Paid with the test Visa `4576238912771450`. Session actually used: `cks_0NkBw28CUxmbI2KsSdVFu` (the third session minted — see the price-reduction note below; the first two went stale unused).
- [x] Entitlement confirmed present in that customer's credit entitlements, **read with the read-only key** — real output below. Customer created by the purchase: `cus_0NkBwH3N9Ld41wgNzK6ty`. Balance: `100000` credits (= ₹1,000.00 of reserve at 1 credit = 1 paise), `overage: 0`.
- [x] `balance()` field name — **CONFIRMED against a real live balance.** The field is `balance` (the doc's original guess was right), reached via `client.creditEntitlements.balances.retrieve(customerID, { credit_entitlement_id })`. **But its TYPE is not what the SDK's own types claim — see the finding below.**
- [ ] `draw()` idempotency — not re-tested this session; Agent B's real-SDK-types finding (documented in the open-questions table below) still stands, unchanged.
- [x] Integration script run against the real API — output pasted below

**What actually happened / deviations:**

**Correction to this file's own earlier entry.** The previous Phase 1c status (and `docs/common/04-BLOCKERS.md` B-001) said `DODO_API_KEY_READONLY` was still missing. It was not — `.env` already had a real value on that line when this session started; only the comment above it hadn't been updated. Ran a live probe (`creditEntitlements.retrieve()` with the read-only key → succeeded; `creditEntitlements.create()` with the same key → `401`) to confirm it's genuinely scoped read-only, not just present. Lesson for whoever picks this up next: trust `.env`'s actual contents over a blocker doc's prose when they disagree, then verify live either way.

**Real design decision — how "INR-denominated reserve credits" maps onto the SDK's actual fields.** The installed `dodopayments@2.43.0` SDK's real `CreditEntitlementCreateParams` has no `credit_type: 'fiat'` option at all (the `credit-based-billing` skill installed this session via `npx skills add dodopayments/skills` shows a `credit_type`/`unit_currency` fiat-credit example, but that field doesn't exist anywhere in the actual installed SDK types or the live API's `422` validation — skill docs and the real SDK disagree here, and the real SDK wins per `CLAUDE.md` rule 6). The only real fields are `unit` (a free-text label) and `precision` (decimal places). Chose `unit: "INR paise"`, `precision: 0` — i.e. 1 credit = 1 paise — specifically so it lines up 1:1 with the integer-paise arithmetic `docs/02-DODO-INTEGRATION.md`'s `fund()`/`draw()` sketches already use (`amountInrPaise: number`), with no rupees↔paise conversion step anywhere in `DodoCreditLedger.ts`. Whoever implements that file next should treat "credits" and "paise" as the same integer, not convert between them.

**Real field-name correction, caught by an actual `422`, not by reading docs.** `Product`'s own id field is `product_id`, not `id` — `ProductEntitlementSummary` (a nested type in the same file) happens to have an `id` field, and a first pass at the provisioning script misread that nested interface as belonging to `Product` itself. First checkout-session attempt failed with a real `422 Failed to deserialize... missing field product_id`, which is what caught it. Fixed and reran; the entitlement/product from the failed attempt were reused (find-by-name-first logic), not duplicated — confirmed by the retry response reporting `"created": false` for both.

**Real API response shapes observed:**
```json
{
  "entitlement": {
    "id": "cde_0NkBmcWcZ3I79sHr1UZCx",
    "name": "Agent Spend Credits",
    "unit": "INR paise",
    "precision": 0,
    "created": false
  },
  "product": {
    "id": "pdt_0NkBmcZQJLSicxFMHlNHX",
    "name": "Agent Spend Credits Top-Up",
    "created": false
  },
  "checkout_session": {
    "session_id": "cks_0NkBmhmGVSy7WTCPOd8oh",
    "checkout_url": "https://test.checkout.dodopayments.com/session/cks_0NkBmhmGVSy7WTCPOd8oh"
  }
}
```
Read-only key probe: `creditEntitlements.retrieve()` → `200`, real entitlement JSON back. `creditEntitlements.create()` with the same key → `401 status code (no body)`.

**Cleanup:** the provisioning script (`_dodo-setup.ts`) and the read-only-key probe script (`_dodo-verify-readonly.ts`) were one-off, root-level, not part of `src/`, and deleted after use — same fixture-discipline precedent as Phase 1h's `_gen-fixtures.ts`. If this provisioning needs to be rerun (e.g. a fresh checkout session because the one above went stale), the logic is fully reconstructable from this entry: find-or-create by name via `creditEntitlements.list()`/`products.list()`, then `checkoutSessions.create({ product_cart: [{ product_id: 'pdt_0NkBmcZQJLSicxFMHlNHX', quantity: 1 }], ... })`.

**Webhook payload shapes — captured for real from `dodo wh trigger`, 2026-07-29.** Installed the Dodo CLI (`v3.4.0`) and probed five event types against a throwaway `node:http` receiver (no new deps, no express, no `standardwebhooks` — a shape probe, not a real handler; deleted after use). Four real findings, three of which contradict `docs/02-DODO-INTEGRATION.md`:

1. **`payment.succeeded` is correct; the CLI's argument name is the odd one out.** `dodo wh trigger`'s supported-event list advertises `payment.success` and `refund.success`, but the actual JSON body's `type` field reads `payment.succeeded` / `refund.succeeded`. The doc's handler sketch (`case 'payment.succeeded'`) was right all along — the CLI's CLI-argument vocabulary and the on-the-wire `type` vocabulary simply differ. **Switch on the wire `type`, not on the CLI's arg names.**

2. **`dodo wh trigger` sends NO Standard Webhooks signature headers at all.** The doc says three headers (`webhook-id`, `webhook-signature`, `webhook-timestamp`) and to dedupe on `webhook-id`. The real captured headers were only: `content-type`, `connection`, `user-agent: Bun/1.3.14`, `accept`, `host`, `accept-encoding`, `content-length`. That's it. This makes sense once you notice the `Bun/1.3.14` user-agent: offline `trigger` payloads are synthesized **locally by the CLI binary itself** and never round-trip through Dodo's servers, so nothing ever signed them. **Consequence: signature verification and `webhook-id` dedupe cannot be tested with `dodo wh trigger` — only with `dodo wh listen` against a real event.** Anyone writing the real handler must not conclude "signatures work" from a green offline test.

3. **The doc's `case 'CreditLedgerEntry':` event name appears to be wrong.** No credit-related event exists in the CLI's offline trigger list at all. The real dashboard's webhook event catalog (seen directly in the Dodo dashboard's "Subscribe to events" picker) lists them under a `credit` group as `credit.added`, `credit.balance_low`, `credit.deducted`, `credit.expired`, `credit.manual_adjustment` — dotted lowercase, matching every other event's convention, not a PascalCase `CreditLedgerEntry`. Not yet confirmed against a live delivered payload, so recorded as "almost certainly `credit.*`" rather than settled.

4. **Minor: the CLI's offline `payment.failed` fixture is internally inconsistent.** Its envelope says `"type":"payment.failed"` but the nested `data.status` still reads `"succeeded"`, with `error_code`/`error_message` both `null`. A real failed payment would presumably not look like that. Don't write logic that trusts `data.status` based on offline fixtures.

Real envelope shape (consistent across all five events) — top level is `{business_id, data, timestamp, type}`, with the entity under `data` and a second discriminator `data.payload_type` (`"Payment"` / `"Refund"` / `"Dispute"` / `"Subscription"`):
```json
{
  "business_id": "bus_test",
  "type": "payment.succeeded",
  "timestamp": "2026-07-28T21:50:26.002Z",
  "data": {
    "payload_type": "Payment",
    "payment_id": "pay_test",
    "checkout_session_id": "cks_123",
    "status": "succeeded",
    "currency": "USD",
    "total_amount": 400,
    "settlement_amount": 400,
    "customer": { "customer_id": "cus_test", "email": "john.doe@example.com", "name": "Test user", "phone_number": "+15555550100", "metadata": {} },
    "product_cart": [{ "product_id": "pdt_test", "quantity": 1 }],
    "metadata": {},
    "payment_method": "card", "card_last_four": "4242", "card_network": "VISA",
    "invoice_id": "inv_test", "subscription_id": null, "disputes": [], "refunds": [],
    "error_code": null, "error_message": null, "created_at": "...", "updated_at": null
  }
}
```
Note `data.metadata` and `data.customer.customer_id` are both present on payment events — that's how `fund()`'s `metadata: { mandate_id }` comes back, and how a checkout session resolves to the `customer_id` that `balances.retrieve()` needs, without the two-hop `checkoutSessions.retrieve → payments.retrieve` chain Agent B documented from SDK types. Worth confirming against a live event before relying on it.

**Live end-to-end verification, 2026-07-29 — the checkout was actually paid and the credits actually landed.** Four findings, one of which contradicts a previously-recorded entry in this very file.

**FINDING A — `balance` is a `number` on the wire, but the SDK types declare it `string`. This is a real trap.** Agent B's earlier open-questions entry (below) recorded, from reading `balances.ts`'s TypeScript, that "`balance` is a `string` (decimal), not a `number`." The actual live JSON says otherwise:
```json
{ "id": "cdb_0NkBwY5jCqg232zXsjbpn", "customer_id": "cus_0NkBwH3N9Ld41wgNzK6ty",
  "credit_entitlement_id": "cde_0NkBmcWcZ3I79sHr1UZCx",
  "balance": 100000, "overage": 0,
  "last_transaction_at": "2026-07-28T22:01:36.931280Z", ... }
```
`100000` — unquoted, a JSON number. Meanwhile the **ledger entry** for the very same transaction reports `"amount": "100000"` and `"balance_after": "100000"` — quoted strings. So the same API is genuinely inconsistent between the balance object (number) and the ledger object (string), and the SDK's generated types are wrong about the balance one. **`balance()` must not assume either — coerce explicitly (`Number(x)`), and never `===`-compare a balance against a ledger amount without coercing both.** This is exactly the class of bug `CLAUDE.md` rule 6 exists to catch, and it was only visible by making the real call.

**FINDING B — Standard Webhooks signature headers ARE present on live events, confirming the offline-trigger caveat above was the whole story.** The live `POST` carried `webhook-id: msg_3H9MzzHVbSUwcrGphkKn687qiIZ`, `webhook-signature: v1,Gn1KJ3JY2WKz6xZGdiilJ2nPYsKU9qMrAqLAcHlDQvg=`, `webhook-timestamp: 1785276097`, with `user-agent: Svix-Webhooks/rolling`. So Dodo's webhook delivery really is Svix-backed Standard Webhooks, exactly as `docs/02-DODO-INTEGRATION.md` says — the earlier "no signature headers" finding applies **only** to `dodo wh trigger`'s locally-synthesized offline payloads, not to real deliveries. Both halves of that had to be observed to state either correctly.

**FINDING C — the doc's `case 'CreditLedgerEntry':` isn't wrong, it's matching the wrong field.** The real credit event has `type: "credit.added"` at the envelope level and `data.payload_type: "CreditLedgerEntry"` nested inside. Both strings are real; they live on different fields. The handler switches on `payload.type`, so it must use `'credit.added'` there — `'CreditLedgerEntry'` would only match if switching on `payload.data.payload_type`. Supersedes the "almost certainly `credit.*`" guess recorded above; now settled with a real payload.

**FINDING D — `metadata` propagates from the checkout session onto BOTH the payment and the credit-ledger events.** The `metadata: { purpose: 'agent-spend-reserve-setup' }` passed to `checkoutSessions.create()` came back verbatim on `payment.succeeded`'s `data.metadata` **and** on `credit.added`'s `data.metadata`. This is the mechanism `fund()` should use to carry `mandate_id` through to settlement — and it means a webhook consumer can tie a credit grant back to its mandate without any extra lookup. Also note both events expose `customer_id` directly (`data.customer.customer_id` on the payment, `data.customer_id` on the credit event), so **the two-hop `checkoutSessions.retrieve → payments.retrieve` chain Agent B documented is only needed on the polling path, not the webhook path.**

Real `credit.added` body (live, abridged to the fields that matter):
```json
{ "type": "credit.added", "business_id": "bus_0NidpUR3LLwbZ99t97YEe",
  "timestamp": "2026-07-28T22:01:36.931280Z",
  "data": { "payload_type": "CreditLedgerEntry", "transaction_type": "credit_added",
    "id": "cdl_0NkBwY5qjgbQoKxaoyp8A", "grant_id": "cdg_0NkBwY5lTQz7cE3rJJHPm",
    "credit_entitlement_id": "cde_0NkBmcWcZ3I79sHr1UZCx",
    "customer_id": "cus_0NkBwH3N9Ld41wgNzK6ty",
    "amount": "100000", "balance_before": "0", "balance_after": "100000",
    "is_credit": true, "overage_before": "0", "overage_after": "0",
    "description": "Credits granted for OneTime payment",
    "metadata": { "purpose": "agent-spend-reserve-setup" } } }
```

**Price reduction, and a scope-boundary note.** The product was first created at ₹1,000.00. The user asked to lower it for repeated testing, worried about spending real money. Clarified that test mode never touches real funds (the checkout page carries Dodo's own "Test Mode" badge), but lowered it anyway since a smaller number is less noisy across many demo runs: ₹1,000.00 → ₹1.00 → finally **₹42.00**, because Dodo enforces a **$0.50 USD minimum** on checkout and rejected anything below it. The real payment confirms the floor: `settlement_amount: 50`, `settlement_currency: "USD"` (i.e. exactly $0.50) against `total_amount: 4956` INR paise (₹49.56, incl. ₹7.56 GST). **Credits granted were deliberately left at 100000 throughout** — `products.update()` leaves `credit_entitlements` unchanged when the field is omitted, so the reserve stayed ₹1,000-sized while the sticker price fell. Sticker price and reserve size are independent here, which is fine for a demo but worth knowing before anyone "fixes" the apparent mismatch.

**Not done this session, and why:** `src/ledger/DodoCreditLedger.ts` itself (the actual `fund()`/`balance()`/`draw()`/`release()` implementation) was not started. The task this session was scoped narrowly to provisioning the entitlement/product/checkout-session and confirming the two API keys — not to writing the ledger code, per the explicit instruction that framed this session's work. B-001 is now unblocked for that follow-up work whenever it's picked up.

---

### Phase 1c follow-up — `DodoCreditLedger.ts` implemented and real-tested

**Status:** ✅ Done — implemented and verified against the real account, including a real answer to the previously-open idempotency question
**Timestamp:** 2026-07-29 (later same day), Agent B, on direct user instruction — see `docs/common/02-DECISIONS.md` ADR-006 for the full reassignment-timing reasoning

- [x] `src/ledger/Ledger.ts` — was still an unimplemented comment stub despite `03-INTERFACES.md` calling it "frozen"; written for real, matches `docs/01-ARCHITECTURE.md`'s interface exactly
- [x] `src/ledger/DodoCreditLedger.ts implements Ledger` — `fund()`, `balance()`, `draw()`, `release()` all real
- [x] Integration script run against the real API — output below
- [x] `draw()` idempotency — **CONFIRMED for real**, resolving the open question both `docs/02-DODO-INTEGRATION.md` and Agent B's Phase 1d notes had left unanswered: calling `draw()` twice with the identical `runId` does **not** double-deduct.

**What actually happened / deviations:**

Before writing anything, confirmed `src/ledger/DodoCreditLedger.ts` was still just a comment stub on this machine (Agent A hadn't started it) — checked specifically to avoid the exact parallel-implementation conflict `docs/common/02-DECISIONS.md` ADR-005 flagged as a rejected alternative. See ADR-006 for the full reasoning behind proceeding.

Implemented against the real API shapes both agents had already found (not re-deriving anything): `client.creditEntitlements.balances.retrieve()`/`.createLedgerEntry()`, the checkout-session→payment→customer resolution chain, `environment: 'test_mode'` passed explicitly on every client construction (the live-mode-default bug found while building the dashboard, `docs/OUTCOME.md` Phase 1h addendum — this alone would have made every real call in this file fail with a misleading 401 if missed here too).

**Real design decisions, none specified in any spec doc — see ADR-006 for full alternatives-considered writeups:**
1. Env vars (`DODO_CREDIT_ENTITLEMENT_ID`, `DODO_TOPUP_PRODUCT_ID`) read lazily via a `requireEnv()` helper at each call site, not as module-level consts — caught a real bug in this session's own first integration-test attempt where import ordering silently captured `undefined` before the test script's `.env` loader had run, producing a confusing Dodo `422` ("missing field `credit_entitlement_id`") instead of a clear local error, even though the field genuinely was being sent — it was just `undefined`.
2. `fund()` passes the same demo customer email every call rather than a hardcoded `customer_id`, relying on Dodo's documented "email finds an existing customer" behavior to reuse Agent A's already-provisioned real customer.
3. `fund()` creates the checkout session and returns immediately — it cannot and does not attempt to complete a real payment, since entering payment credentials is a prohibited agent action. A human completing checkout out of band is the same real constraint Agent A's own provisioning ran into, not a shortcut specific to this implementation.
4. `credit_entitlements[].credits_amount` is overridden per-session to grant exactly `amountInrPaise` credits, independent of the top-up product's fixed ₹42 sticker price — same decoupling Agent A already established.
5. Added `DODO_TOPUP_PRODUCT_ID=pdt_0NkBmcZQJLSicxFMHlNHX` to `.env`/`.env.example` — a new env var, not in the original spec's list, needed because `fund()` must reference the real top-up product Agent A created.

**Real integration test run** (`_ledger-integration-test.ts`, root-level, deleted after use — same discipline as every prior real-verification pass this build). `fund()` can only create a session, not complete payment (see above), so this test exercises `balance()`/`draw()`/`release()` against the already-funded real demo customer (`cus_0NkBwH3N9Ld41wgNzK6ty`, 100000 paise from Agent A's Phase 1c purchase) and restores its balance afterward so no lasting change is left on the shared account:

```
=== fund(): create a real checkout session for ₹800 ===
fund() returned: {
  "reserveRef": "cks_0NkCFQTyse1Xf5MB20LEP"
}
(session created for real; a human would complete payment via its checkout_url — not done here, see comment above)

=== balance(): read the ALREADY-FUNDED real demo customer ===
balance() returned (paise): 100000

=== draw(): deduct ₹100 (10000 paise) with a fake runId ===
draw() completed, runId = run_integration_test_1785282052432

=== balance(): read again, should be exactly 10000 lower ===
balance() returned (paise): 90000
difference: 10000 (expect 10000)

=== draw() idempotency check: same runId again, should not double-deduct ===
Second draw() with same runId did not throw. Balance after: 90000 (expect unchanged from 90000 )

=== release(): no-op, confirm it does not throw ===
release() completed (no-op, as expected)

=== Restore: credit back whatever was actually deducted, to leave the real demo account unchanged ===
Credited back 10000 paise. Balance restored to: 100000 (expect 100000 )
```

`npx tsc --noEmit` → exit 0 on the whole project throughout (root + `dashboard/`). No unit tests added — this is a live-API integration file, matching the same manual-verification pattern used for every other real Dodo/webcmd integration point in this build, per `docs/PROMPTS.md` Phase 1c's own instruction to write an integration script, not a unit-test suite, for this phase.

**What this does and doesn't unlock:** `gate run`/`gate fund` can now be wired to real calls in `src/cli/gate.ts` (still Agent A's file, not touched here). Phase 1g (the full demo script run) still additionally needs B-002 (webcmd browser connectivity) resolved on Agent B's machine before a complete Beat 1-8 run is possible there — this phase's own scope (the ledger) is fully done and real either way.

---

## Phase 1d — webcmd integration

**Status:** ⚠️ Done with deviation — `manifest.ts` fully done and verified for real; `executor.ts`'s `execute()` implemented per spec but UNVERIFIED against a live command (browser connectivity blocker, see `docs/common/04-BLOCKERS.md` B-002)
**Timestamp:** 2026-07-29, Agent B

- [x] `webcmd doctor` passes on the build machine — **actually: FAILS.** Daemon OK, Runtime (Cloak) connected, Connectivity FAIL ("Browser exec command timed out after 8s"). See real output below.
- [x] `loadManifest()` returns real data, write-command count recorded: **228 write / 577 read / 805 total** (spec's doc guessed "~192" write and "~302" total — both real numbers are notably higher)
- [x] Fail-closed behavior confirmed for an unknown command (`accessMap.get()` on a nonsense site/command returns `undefined`)
- [x] Live-fetch-fails-fall-back-to-cache path tested at least once (ran the manual-check script with `PATH` stripped of webcmd's location — confirmed `execSync` throws, caught, falls back to the 805-entry disk cache, identical results)

**What actually happened / deviations:**

Installed `@agentrhq/webcmd@0.4.3` globally (`npm i -g @agentrhq/webcmd@0.4.3`) — clean install, no errors. Ran `webcmd doctor`, which reported a genuine failure (pasted below) — per `docs/PROMPTS.md` Phase 1d's explicit "do not proceed past a failing doctor check," stopped before attempting to implement/verify anything that requires live browser execution. Diagnosed further to scope the actual blast radius before flagging it: `webcmd list -f json` (the manifest fetch `loadManifest()` depends on) works perfectly and needs no live browser session — it returned real, large data (805 commands total). Confirmed `blinkit/place-order` really is classified `access: 'write'`. Confirmed no Chrome/browser process was running on the machine at all (`tasklist | grep chrome` empty) and that `webcmd profile list` reports zero active Cloak runtime profiles, meaning no browser-backed command has ever succeeded here — consistent with the Connectivity check's failure, not a fluke.

Given this scoping, implemented `src/webcmd/manifest.ts` for real (matches `docs/03-WEBCMD-INTEGRATION.md` § Step 1 exactly, with the `ManifestCommand` interface trimmed to the three fields actually consumed — the real payload carries 14 fields, not the 5 in the spec's sketch). Wrote `src/webcmd/manifest.manual-check.ts` (not a `*.test.ts`, so it's excluded from `npm test`'s auto-discovery — run directly via `ts-node`) and ran it for real; output below.

Also implemented `src/webcmd/executor.ts`'s `execute()` matching `docs/03-WEBCMD-INTEGRATION.md` § Step 5 exactly, plus `hasAlreadyDrawn()`/`recordDraw()` — the idempotency guard against `ledger.jsonl` that `docs/PROMPTS.md` Phase 1c's prompt requires to live in this file, not in `DodoCreditLedger`. The `ledger.jsonl` entry shape (`{ runId, reserveRef, amountInrPaise, ts }`) wasn't specified anywhere in the docs, so this is a real design decision — see `docs/common/02-DECISIONS.md` ADR-004. `hasAlreadyDrawn()`/`recordDraw()` are pure filesystem logic with zero webcmd/browser dependency, so they ARE genuinely tested for real (round-trip script, output below) despite the connectivity blocker. `execute()` itself could not be exercised against a real webcmd subprocess — any real invocation would hit the same timeout the doctor check hit — so it is implemented but not verified, and Phase 1d is marked ⚠️ rather than ✅ for exactly that reason. Per `CLAUDE.md` rule 7, this is not being papered over with a fake/mocked subprocess to manufacture a passing test.

**Real `webcmd doctor` output:**
```
webcmd v0.4.3 doctor (node v24.14.0)

[OK] Daemon: running on port 9777 (v0.4.3)
[OK] Runtime: cloak connected (v0.4.5)
[FAIL] Connectivity: failed (Browser exec command timed out after 8s; it may still complete in the browser.)

Issues:
  • Browser connectivity test failed: Browser exec command timed out after 8s; it may still complete in the browser.
```

**Real `webcmd list -f json` shape observed** (fields present on every entry; only `site`/`name`/`access` are consumed by `loadManifest()`):
```
command, site, name, aliases, description, access, strategy, browser, args, columns, domain, example, defaultFormat, siteSession
```

**`manifest.manual-check.ts` real output:**
```
Total commands loaded: 805
Write-access commands: 228
blinkit/place-order access: write
nonsense command lookup: undefined (fail-closed, correct)
```

**Fallback-to-cache test** (ran the same script with `PATH` restricted to just Node's own install dir, excluding webcmd's global-bin location):
```
'webcmd' is not recognized as an internal or external command,
operable program or batch file.
Total commands loaded: 805
Write-access commands: 228
blinkit/place-order access: write
nonsense command lookup: undefined (fail-closed, correct)
```
(The "not recognized" line is `execSync`'s own stderr passthrough on failure — `loadManifest()` caught the thrown error and fell back to `manifest.json`, same 805 entries, no crash.)

**`executor.manual-check.ts` real output** (ledger idempotency guard only — `execute()` not exercised, see above):
```
Before any record — unseen runId: false
After recording — same runId: true
After recording — different runId: false
Cleaned up test ledger file.
```

`npx tsc --noEmit` → exit 0 after every step above. `npm test` → 10/10 passing throughout (unaffected — no unit tests added this phase, `*.manual-check.ts` files are deliberately excluded from `node --test`'s discovery).


---

## Phase 1e — Receipts and verify chain

**Status:** ✅ Done as spec'd — no deviations this phase
**Timestamp:** 2026-07-29, Agent A

- [x] Two-receipt chain verifies cleanly
- [x] Tampering with receipt N breaks verification of receipt N+1's chain link

**What actually happened / deviations:**

Implemented `src/receipt/schema.ts` (`Receipt` interface, matches `04-POLICY-ENGINE-SPEC.md` exactly) and `src/receipt/chain.ts` (`buildAndSignReceipt()`, `verifyReceipt()` — both copied faithfully from the spec's code, no changes needed — plus `sha256Hex()` and `verifyChain()`, which the spec describes in prose but doesn't show code for).

No spec bugs found this phase, unlike 1a/1b — the Receipt schema and chain logic were internally consistent and matched cleanly against `docs/05-DEMO-SCRIPT.md` Beats 6-7's expected output shape (`sha256:` prefix on hashes, `sha256:0000...` for the chain head).

**Design notes on the two functions the spec described but didn't show code for:**
- `sha256Hex(obj)`: `sha256:` + hex digest of `sha256(canonicalJSON(obj))`. Exported generically (not `hashReceipt`-specific) because `Receipt.mandate_hash` needs the exact same "sha256 of canonicalJSON(x)" computation — Phase 1f's CLI can reuse this directly instead of duplicating it when it builds real receipts.
- `verifyChain(receipts, gatePublicKey)`: sorts by `signed_at`, then for each receipt checks both its own signature (`verifyReceipt()`) and whether `prev_receipt_hash` matches `sha256Hex()` of the immediately preceding receipt (or `CHAIN_HEAD_HASH` for the first). Takes an already-parsed `Receipt[]`, not file paths — reading `receipts/*.json` off disk is a CLI-layer (Phase 1f) concern, `chain.ts` itself stays pure per the same "logic before I/O" pattern as `decide()`.

**Test run (`src/receipt/chain.test.ts`, 4 tests — the 2 required by `docs/PROMPTS.md` Phase 1e plus 2 extra: a round-trip check and a chain-head-only case):**
```
ok - buildAndSignReceipt() + verifyReceipt() round-trip: an unmodified receipt verifies
ok - a single-receipt chain (chain head only) verifies cleanly
ok - a valid two-receipt chain verifies cleanly end to end
ok - editing any field in the first receipt breaks the SECOND receipt's chain link, not just the first receipt's own signature
```
The last test explicitly asserts three things at once, matching the prompt's emphasis: the tampered first receipt's own signature fails, the untouched second receipt's own signature still passes, and the second receipt's chain link fails anyway — proving the chain link is a distinct check from either receipt's own signature.

Full suite: `npm test` → 24/24 passing. `npx tsc --noEmit` → exit 0.


---

## Phase 1f — CLI and two-pane UI

**Status:** ⚠️ Done with deviations — partial by necessity, not choice. `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify` are real and verified end to end. `gate run`/`gate fund` are NOT implemented — both need `src/ledger/Ledger.ts` to exist as real code, which is Phase 1c (Agent B), blocked on B-001. They exist as dispatcher cases that fail with an honest, specific message rather than being silently absent or mocked.
**Timestamp:** 2026-07-29, Agent A

- [x] Every implemented subcommand runs without crashing (`scan`, `mandate create`, `mandate resign`, `receipt show`, `verify`) — real output pasted below
- [x] Two-pane UI (`src/cli/ui.ts`) implemented as pure, unit-tested rendering functions — legibility not yet confirmed in an attached terminal, since `gate run` (its real caller) isn't wired yet
- [ ] `gate run`/`gate fund` — blocked on Phase 1c, see below

**What actually happened / deviations:**

This phase needed more new foundational infrastructure than any prior one, because Phases 1a-1e only ever took `KeyObject`s as function arguments — nothing before this needed to persist a keypair across separate CLI process invocations. Built, in order:

**New foundational pieces (not explicitly named in any spec file, but required to make the CLI real):**
- `src/mandate/id.ts` — `generateId(prefix)`. The spec says "ULID recommended" for `mandate_id`/`receipt_id`/`event_id`, but nothing downstream parses an ID's timestamp back out or validates ULID format, so a spec-correct Crockford-base32 ULID would be complexity with no payoff. Implemented a simpler real scheme instead: timestamp (base36) + crypto-random suffix — genuinely unique, not byte-for-byte ULID format.
- `src/mandate/did.ts` — `publicKeyToDidKey()`. A **real** `did:key` (W3C did-method-key) encoder: extracts the raw 32-byte Ed25519 public key via `KeyObject.export({format:'jwk'})`, prepends the real multicodec prefix for ed25519-pub (`[0xed, 0x01]`), hand-writes a base58btc encoder (no library — `node:crypto` + a ~15-line big-integer division loop). Verified against 5 real generated keys before writing any test: every one produced the well-known `did:key:z6Mk` prefix, matching `docs/05-DEMO-SCRIPT.md`'s example exactly. Not cryptographically load-bearing anywhere (`decide()` verifies against a `publicKey` argument, never by parsing `mandate.issuer`) but doing it correctly costs little and means the field is a real, independently-decodable identifier rather than a cosmetic string.
- `src/mandate/currency.ts` — `formatInr()`. Found while running `gate mandate resign` for real: raw interpolation produced `₹1500`, not the demo script's `₹1,500`. `Intl.NumberFormat('en-IN')` handles Indian lakh/crore digit grouping correctly out of the box (verified: `1500`→`"1,500"`, `100000`→`"1,00,000"`) — zero new dependency. Applied everywhere an INR amount is displayed: `renderConsent()`, `gate mandate resign`, `gate receipt show`, and `src/cli/ui.ts`'s event/status-strip formatters.
- `src/cli/keys.ts` — `getOrCreateKeyPair('issuer' | 'gate')`. **This is the answer to a real gap Agent B found** while building the dashboard's `/receipts` route (see `docs/agent-b/WORKSPACE.md` § Notes for Agent A): the gate's own Ed25519 keypair had no defined disk location. Design: `keys/{issuer,gate}.{private,public}.pem`, gitignored entirely (never committed — consistent with `mandates/`/`receipts/` being per-machine state, and private keys should never touch git history regardless). Auto-generates on first use; on subsequent calls, loads and reuses the same keypair (verified: a signature made after the second `getOrCreateKeyPair()` call verifies against a key loaded fresh from disk, proving it's the same key, not a new one). Refuses to silently regenerate if exactly one of the two PEM files exists (inconsistent/corrupt state) — throws instead, per `docs/agent-a/ERROR-HANDLING.md`'s policy of never silently orphaning something already signed with an existing key. **For Agent B:** the dashboard can read `keys/gate.public.pem` via the same `MANDATE_GATE_DATA_DIR` env var it already uses for `mandates/`/`receipts/`/`events.jsonl` — no new configuration surface.
- `src/cli/store.ts` — file I/O for `mandates/`/`receipts/`, split out of `gate.ts` to keep the dispatcher focused. `loadAllReceipts()` throws loudly on any malformed file (used by `gate verify`'s chain walk — a silently-dropped receipt could make verification pass when it shouldn't); `loadAllMandates()` silently skips a file that fails `isMandate()` (informational use only, by `gate scan`'s governed-count).

**Real bugs found this phase, all by actually running the CLI, not by inspection:**
1. **`renderConsent()`'s time formatting was wrong** (a Phase 1a bug, only surfaced now): the spec's `toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})` produces `"06:00 pm"` on this Node/ICU version (77.1) — leading zero, lowercase am/pm — not Beat 2's `"6:00 PM"`. Fixed: `hour:'numeric'` (drops the leading zero) plus an explicit uppercase pass on the am/pm marker (en-IN's default casing isn't controllable via `Intl` options alone). Verified against both an evening and a morning time.
2. **The currency formatting gap** described above (`₹1500` vs `₹1,500`).
3. **A real cross-machine `.gitignore` mistake from Phase 0**: `manifest.json` was gitignored, but Agent A's machine has no `webcmd` install (by design — that's Agent B's territory) and no way to generate one. Un-ignored it — it's a relatively stable cache of external reference data, not per-run demo state like `mandates/`/`receipts/`/`ledger.jsonl`, which stay gitignored. **Agent B: please commit your real `manifest.json`** (805 commands, 228 write, per your own B-002 entry) so `gate scan` can be verified against real data on this side too — right now it's only been tested against a small hand-built local fixture (never committed, deleted after use), which proves the counting logic is correct but isn't "real" in the sense this project otherwise insists on.
4. **`SpendRequest.access` and `gate mandate resign`'s per-txn-cap gap were caught earlier (Phase 1b), not this phase** — noting only to avoid duplicate-sounding entries; not re-litigating here.

**Design decisions made to fill genuine spec gaps (not guessed at silently):**
- `gate mandate create` has no `--categories` or `--max-txns` flag anywhere in `docs/05-DEMO-SCRIPT.md` Beat 2 or `docs/PROMPTS.md`'s subcommand list, but `Mandate.scope` requires both. Defaulted `categories` to `["groceries"]` (the product brief's whole scenario) and `max_txns` to `1` (matching Beat 5's implied "txn 1/1"), both with optional flag overrides.
- `gate mandate resign --cap 1500` (Beat 5) with no `--per-txn` flag: defaulted `per_txn_inr` to the new cap value. Without this, the retry in Beat 5 would still fail Rule 6 (per-txn cap), since the original mandate's `per_txn_inr` was 800.
- `gate mandate create`'s reserve line: prints an honest "not yet funded" message rather than Beat 2's "reserve ₹800 blocked" — funding is `gate fund`, a separate command per `docs/01-ARCHITECTURE.md`'s own data flow, and it's blocked on Phase 1c regardless.
- **Left as an explicitly open question, not guessed at**: whether `gate mandate resign` should itself top up the Dodo reserve (Beat 5's `gate run` retry shows `reserve ₹1,500 → drawn ₹1,412`, implying the reserve grew, but resign's own output line shows no reserve change, and the mechanism depends entirely on `Ledger`, which doesn't exist as code yet). Logged in `docs/agent-a/TASKS.md` as a Phase 1g item to resolve once Phase 1c is real, not resolved by guessing here.
- `gate verify`'s failure message doesn't name the specific tampered field (Beat 7's illustrative `"tampered at field cart.total_inr"` would require diffing against a stored original, which nothing in this system keeps) — reports the failure honestly without inventing a field name.

**Real CLI runs (all commands below, actually executed, not illustrative):**

```
$ gate mandate create --subject "agent:grocery-runner" --cap 800 --per-txn 800 --merchants blinkit,zepto,bigbasket --expires "18:00"
✓ MANDATE mnd_ms52bt99fcfb7e41d819 signed

  "agent:grocery-runner may spend up to ₹800 at Blinkit, Zepto or BigBasket, in one transaction, before 6:00 PM today."

  ed25519 · issuer did:key:z6MksTKc3mEANyANjcbMwpYD9zqtBuLnwKArT1X2XxgZ9vni
  reserve: not yet funded — run `gate fund mnd_ms52bt99fcfb7e41d819 --amount <n>` once available (blocked on Phase 1c, see docs/common/04-BLOCKERS.md B-001)

$ gate mandate resign mnd_ms52bt99fcfb7e41d819 --cap 1500
✓ MANDATE mnd_ms52bvlh67abe339bae9 signed — ₹1,500

$ gate receipt show rcp_ms52cnbt186a601beacb
✓ RECEIPT rcp_ms52cnbt186a601beacb signed

  mandate  sha256:4f2a9b1c...        cart     blinkit · 7 items · ₹1,412
  payment  dodo_test · captured
  run      blinkit/place-order · run_4821_1754000000
  evidence trace sha256:8c1d2e3f...
  prev     sha256:0000...        (chain head)

$ gate verify rcp_ms52cnbt186a601beacb
✓ signature valid · chain intact

$ sed -i 's/1412/9999/' receipts/rcp_ms52cnbt186a601beacb.json
$ gate verify rcp_ms52cnbt186a601beacb
✗ signature invalid — receipt tampered

$ gate verify rcp_ms52cnc17bb8bf66975c   # the second, untouched receipt
✗ chain link invalid — a prior receipt in this chain doesn't match its recorded hash

$ gate scan   # against a small local fixture manifest — see deviation 3 above
✓ webcmd manifest loaded — 3 sites, 8 commands
  4 marked access:'write'
  0 currently governed    # (with no mandates present)
  3 currently governed    # (with the two mandates above present, matching their merchants)

$ gate run -- webcmd blinkit place-order --confirm
✗ gate run is not available yet.
  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001
  (no real Dodo test-mode account yet). src/webcmd/executor.ts is implemented but
  unverified against a live command — see B-002. See docs/common/04-BLOCKERS.md.

$ gate fund mnd_x --amount 800
✗ gate fund is not available yet.
  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001
  (no real Dodo test-mode account yet). See docs/common/04-BLOCKERS.md.
```

All receipt/mandate fixtures used above were generated with the actual production signing code (`buildAndSignReceipt()`, `sign()`), never hand-typed fake JSON — then deleted after testing, along with the temporary fixture manifest.json, so no fake data lingers in the repo's gitignored runtime folders (mirroring Agent B's own fixture-cleanup practice for the dashboard).

Full suite: `npm test` → 45/45 passing (24 from Phases 1a/1b/1e + 21 new: `id` (2), `did` (3), `currency` (3), `keys` (4), `ui` (7), `render`'s 2 new time-format tests). `npx tsc --noEmit` → exit 0.

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

**Status:** ⚠️ Done with deviations (see below) — core acceptance checklist passes for real; one item can't be tested until Phase 1f (CLI) exists
**Timestamp:** 2026-07-29, Agent B

- [x] Next.js version actually installed: **16.2.12** (App Router, Turbopack), React 19.2.4, Tailwind CSS v4
- [x] `/`, `/events`, `/receipts` all show real data, not mocked — verified in an actual Chrome tab (screenshots taken), against real fixture data generated with the production signing code (`src/mandate/sign.ts`, `src/receipt/chain.ts`), not hand-typed JSON
- [x] Confirmed no API route writes anywhere (code-reviewed) — all three routes (`app/api/mandate|events|receipts/route.ts`) export only `GET`, no filesystem writes, no `Ledger` calls, no webcmd invocation anywhere in `dashboard/`
- [x] Confirmed only `DODO_API_KEY_READONLY` is used in this app, never the write key — grepped `dashboard/` for `DODO_API_KEY` (without `_READONLY`), zero matches
- [x] `npm run build && npm run start` tested — real production build + start, verified via curl and an actual browser tab, not `next dev`
- [ ] Dashboard process killed mid-rehearsal, CLI demo path confirmed unaffected — **cannot test yet**, Phase 1f (`gate` CLI) doesn't exist. Revisit once Agent A ships it; nothing about this app's design should make it fail (it's fully read-only, own process, own port), but "should" isn't "confirmed."

**What actually happened / deviations:**

Scaffolded with `npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm`, then `npm install dodopayments` inside `dashboard/` (its own dependency tree, separate lockfile, per `docs/06-DASHBOARD-SPEC.md`). This Next.js version ships its own `AGENTS.md` warning that it has breaking changes from older Next.js conventions — read its bundled `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and the actual generated `app/page.tsx`/`app/layout.tsx` before writing any route/page code, rather than assuming prior-knowledge conventions still applied. They mostly did (Route Handlers, `params` as a `Promise`, App Router file conventions) — no exotic API surface was actually needed for this app's scope.

Implemented exactly the structure in `docs/06-DASHBOARD-SPEC.md`: `lib/types.ts`, `lib/hash.ts` (`canonicalJSON()`/`sha256Hex()`/`CHAIN_HEAD_HASH`, byte-for-byte duplicates of `src/mandate/sign.ts` and `src/receipt/chain.ts` — verified by testing the tamper-test scenario, see below), `lib/read.ts` (mandate/events/receipts file reading + local chain verification), `lib/dodo.ts` (balance lookup), three API routes, three pages, four components (`StatusBadge`, `EventRow`, `ReceiptCard`, `ReserveBalanceCard`).

**Deviation 1 — real SDK types diverge substantially from `docs/02-DODO-INTEGRATION.md`'s balance-read sketch.** Discovered by reading the installed `dodopayments` package's actual `.d.ts` files directly (no live account needed for this, though B-001 still blocks an actual call): there is no `creditEntitlementBalances.retrieve(reserveRef)` method. Balances are keyed by `(customer_id, credit_entitlement_id)` via `client.creditEntitlements.balances.retrieve()`; resolving a checkout-session-style `reserveRef` to a customer requires a second hop (`checkoutSessions.retrieve(id).payment_id` → `payments.retrieve(payment_id).customer.customer_id`). `lib/dodo.ts` implements this real chain, handles either convention defensively (a `cus_...` id used directly, or a session id resolved through the chain), and is clearly marked unverified-live pending B-001 — same posture as Phase 1d's `execute()`. Full writeup with the exact real interfaces in this file's "Running list of open questions resolved" table above. Added `DODO_CREDIT_ENTITLEMENT_ID` to `.env.example` (root) and `dashboard/.env.local.example` — needed by this real chain, not in the original spec's env var list.

**Deviation 2 — RESOLVED 2026-07-29, same day, once Agent A's Phase 1f shipped `src/cli/keys.ts`.** `signature_valid` is now a real boolean, not always `null`. `dashboard/lib/hash.ts` gained `verifySignature()` (duplicate of `src/mandate/sign.ts`'s `verify()`, per the same duplication note as `canonicalJSON()`/`sha256Hex()`), `dashboard/lib/read.ts` gained `loadGatePublicKeyPem()` (reads `keys/gate.public.pem` via `MANDATE_GATE_DATA_DIR`, returns `null` gracefully if it doesn't exist yet rather than throwing — no receipt has ever been signed on a fresh machine until the CLI runs once), and `verifyChainLocal()` now takes the key and computes real signature checks alongside chain-link checks.

**Verified for real, not just "it compiles":** bootstrapped a real local `keys/gate.{private,public}.pem` via the actual `getOrCreateKeyPair('gate')` from `src/cli/keys.ts` (not a mock — the same function `gate run` will call), signed two real fixture receipts with it, and confirmed via the dashboard's `/api/receipts` route: both receipts showed `signature_valid: true, chain_link_valid: true`. Then repeated the tamper test from before, this time watching all four signals at once: editing `rcp_fixture001`'s `total_inr` flipped **its own** `signature_valid` to `false` (real crypto catching the tamper directly) while its `chain_link_valid` stayed `true` (correctly unaffected — that check is about the *previous* receipt), and flipped `rcp_fixture002`'s `chain_link_valid` to `false` while its `signature_valid` stayed `true` (untouched receipt, still correctly signed, but now provably linked to a corrupted predecessor). All four values reverted correctly after undoing the edit. Deleted the bootstrapped `keys/` and fixture data afterward, same cleanup discipline as before.

**Deviation 3 — "current mandate" resolution is an undocumented design call.** `mandates/` can hold more than one file (`gate mandate resign` creates a new `mandate_id` rather than mutating the original, per `05-DEMO-SCRIPT.md` Beat 3-4). `readCurrentMandate()` picks the greatest `mandate_id` by string sort (ULIDs sort lexicographically by creation time) — not specified anywhere else, documented as a comment in `lib/read.ts`.

**Real verification, not just "it compiles":** Generated real, cryptographically valid fixtures (a signed mandate, two hash-chained signed receipts, four `GateEvent`s) using the actual production `sign()`/`buildAndSignReceipt()` functions from `src/mandate/sign.ts`/`src/receipt/chain.ts` — not hand-typed JSON, not a dashboard-side mock — via a one-off script (`_gen-fixtures.ts`, deleted after use, not committed). Ran `npm run build && npm run start` for real. Confirmed via `curl` and an actual Chrome tab (`mcp__claude-in-chrome`):
- `/` showed the real mandate fields, correct expiry countdown, and the balance card correctly displaying "Unavailable — Dodo not yet configured (missing DODO_API_KEY_READONLY or DODO_CREDIT_ENTITLEMENT_ID)" (both env vars were deliberately left unset to test this real degradation path, not a happy-path-only test)
- `/events` showed all 4 events, reverse-chronological, color-coded verdict badges, and confirmed via network-request inspection that polling correctly uses `?since=<last_event_id>` and appends only new rows rather than re-fetching the whole list
- `/receipts` showed both receipts with `chain_link_valid: true`. **Then performed the actual tamper test**: edited `total_inr` in `receipts/rcp_fixture001.json` on disk while the dashboard was running, waited for the next poll cycle (no manual refresh) — the SECOND receipt's badge flipped live from "chain valid" to "chain INVALID" in the browser, while the tampered receipt's own badge stayed "chain valid" (only its own field changed, its own link to `CHAIN_HEAD_HASH` is unaffected) — this is the exact distinction `05-DEMO-SCRIPT.md` Beat 7 and this file's Phase 1e entry require. Reverted the edit afterward.
- Zero console errors in the browser tab throughout.

Fixed a Turbopack build warning ("whole project traced unintentionally") by setting `turbopack.root` in `next.config.ts` to the dashboard's own directory (it's a genuinely separate app, not a workspace member of the outer repo) and adding a `turbopackIgnore` comment on the one dynamic `process.cwd()` path resolution in `lib/read.ts` — cosmetic, not a functional bug, but worth doing cleanly since it flagged real over-tracing.

`npm audit` in `dashboard/` reports 12 high-severity advisories, all pre-existing in `create-next-app`'s own scaffold dependency tree (eslint/postcss/sharp transitive deps), not introduced by adding `dodopayments`. Fixing them requires downgrading Next.js itself (`npm audit fix --force` → Next 9.x) — not worth it for a locally-run demo dashboard; noting instead of silently ignoring.

Deleted the fixture data and generator script after verification (`_gen-fixtures.ts`, the fixture `mandates/`/`receipts/`/`events.jsonl` files) so no fake data is sitting in the repo's runtime-data folders — those paths are gitignored anyway, but leaving fabricated data around risked confusing a future real demo run or Agent A's own Phase 1f testing.

**Addendum, 2026-07-29 (later same day) — real Dodo account end-to-end verification, and a real bug caught by it.** The user provided real Dodo test-mode credentials (the same account Agent A provisioned in Phase 1c — `DODO_CREDIT_ENTITLEMENT_ID=cde_0NkBmcWcZ3I79sHr1UZCx`, a real funded customer `cus_0NkBwH3N9Ld41wgNzK6ty`, a real paid checkout session `cks_0NkBw28CUxmbI2KsSdVFu`). Populated `.env` (root) and `dashboard/.env.local` (read-only key + entitlement id only, never the write key) and tested `lib/dodo.ts`'s balance-resolution chain for real, not just against SDK types.

**Real bug found and fixed:** `lib/dodo.ts`'s `DodoPayments` client never set `environment: 'test_mode'`. The SDK's own doc comment (`node_modules/dodopayments/client.d.ts`) says `environment` defaults to `live_mode` when unset — every call was silently going to `https://live.dodopayments.com` instead of `https://test.dodopayments.com`, and failing there with a generic `401 Unauthorized` (test keys don't work against the live host). This is exactly the kind of live-mode leak `CLAUDE.md` Hard Rule 1 exists to prevent, caught only by making a real call and getting a real, unexpected error — a `401` with test keys against what I assumed was already the test host was surprising enough to dig into, rather than just retrying. Fixed by passing `environment: 'test_mode'` explicitly (confirmed via the same client.d.ts comment: `test_mode` → `https://test.dodopayments.com`, matching `docs/02-DODO-INTEGRATION.md`'s original guess, which was right all along — my code just never applied it).

**After the fix, verified both resolution paths for real, via the actual `/api/mandate` route (not a bypass script):**
- A real fixture mandate with `reserve.ref = 'cks_0NkBw28CUxmbI2KsSdVFu'` (Agent A's real paid checkout session) → `/api/mandate` correctly walked the full 2-hop chain (`checkoutSessions.retrieve` → `payments.retrieve` → `customer.customer_id` = `cus_0NkBwH3N9Ld41wgNzK6ty`, matching Agent A's own record exactly) → `creditEntitlements.balances.retrieve()` → **`balanceInr: 1000`**, matching Agent A's confirmed ₹1,000.00 reserve exactly. Confirmed visually in an actual Chrome tab: the mandate page's balance card showed "₹1,000" with zero console errors.
- A second fixture mandate with `reserve.ref = 'cus_0NkBwH3N9Ld41wgNzK6ty'` (the direct-customer-id shortcut path) → same result, `balanceInr: 1000`.
- Also independently confirmed Agent A's FINDING A from outside the dashboard: `balances.retrieve()`'s real response has `"balance": 100000` as an unquoted JSON number, not a string — my `Number(balance.balance)` coercion already handled this correctly regardless (a no-op on an already-numeric value), so no code change was needed there, just confirmation.

Deleted the diagnostic scripts (`_dodo-diag.ts`, a second `_gen-fixtures.ts` pass) and both test mandates afterward, same cleanup discipline as before. `.env`/`dashboard/.env.local` now hold real credentials locally (both gitignored, never committed).

**What this does and doesn't mean for the wider build:** the dashboard's Dodo integration is now genuinely end-to-end verified against a live test-mode account — no longer "unverified live." This does **not** mean Phase 1g (the full demo script) can run yet: `src/ledger/DodoCreditLedger.ts` itself still doesn't exist (Agent A's Phase 1c, explicitly out of scope for their provisioning-only session — see the entry above), and `gate run`'s webcmd execution is still blocked on B-002 on this machine. Whoever writes `DodoCreditLedger.ts` should apply the same `environment: 'test_mode'` fix — it's a generic SDK-client gotcha, not something specific to the dashboard's code path.

---

## Phase 2-4 — Stub verification

**Status:** ✅ Done as spec'd — all four stub files already met the definition, nothing needed fixing
**Timestamp:** 2026-07-29, Agent A

- [x] All four stub files compile (`npx tsc --noEmit` → exit 0)
- [x] No Phase-1 runtime path imports any stub (`grep -r "phase2-4-stubs" src/` → zero matches outside `src/phase2-4-stubs/` itself)
- [x] Any stub not meeting the definition — none. All four already satisfied every point of `docs/01-ARCHITECTURE.md` § What is a stub, unchanged since Phase 0.

**What actually happened / deviations:**

Re-read `docs/01-ARCHITECTURE.md` § What is a stub and § Phase 2/3/4, then re-checked all four files against the four-point definition:
1. **Compiles** — confirmed, `tsc --noEmit` clean.
2. **Correctly typed export matching the doc** — `ReceiptChain` and `DisputePackExporter` match the doc's own code blocks verbatim (same class name, same constructor-throws pattern). `mcp-server.ts` and `ChaosTestRunner.ts` only had prose in the architecture doc (no code block) — the Phase 0 decision to add a minimally-typed `MandateAwareMcpServer`/`ChaosTestRunner` class with one throwing method still holds up as the right reading of "exports a correctly-typed class/function," since the doc's prose describes what each would eventually expose.
3. **Throws explicit "not implemented" or is a documented no-op** — all four throw `new Error('Phase N not implemented — see docs/01-ARCHITECTURE.md')`. Nothing partially works.
4. **Not imported by any Phase 1 runtime path** — confirmed via `grep -r "phase2-4-stubs" src/`, zero matches anywhere outside the folder itself.

No changes made to any of the four files — this phase's job was to *confirm*, not implement, and confirmation is all that was needed. Picked this up ahead of Agent B specifically to avoid duplicate effort — both of us were independently circling it in the same sync window (see `docs/common/08-CHANGELOG.md`).


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
| Does Dodo's checkout/payment API accept a request-side idempotency key? | `02-DODO-INTEGRATION.md` | **Partially, from real SDK types (not yet a live call — B-001 still blocks that).** `checkoutSessions.create()`'s params (`CheckoutSessionCreateParams`) have no `idempotency_key` field at all — no evidence funding itself is natively idempotent. But the actual spend-deduction operation is a different, real SDK method than the doc guessed (`client.creditEntitlements.balances.createLedgerEntry(customerID, { credit_entitlement_id, entry_type: 'debit', amount, idempotency_key })` — not `creditEntitlements.deduct()`, which doesn't exist), and its params (`BalanceCreateLedgerEntryParams`) DO include a real `idempotency_key?: string \| null` field. So the piece that actually matters for `draw()` (the deduct call) has native idempotency support; the `ledger.jsonl` guard built in Phase 1d (`hasAlreadyDrawn`/`recordDraw`, see ADR-004) stays as defense-in-depth per the spec's "belt and suspenders" instruction, not because native support is absent. | 2026-07-29, Agent B |
| Exact field name for Credit Entitlement Balance | `02-DODO-INTEGRATION.md` | **From real SDK types (not a live response yet):** the doc's guess of `balance` was correct, but the *shape around it* is not what the sketch assumed. There is no `creditEntitlementBalances.retrieve(reserveRef)` method at all. The real hierarchy is `client.creditEntitlements.balances.retrieve(customerID, { credit_entitlement_id })` → `CustomerCreditBalance { id, balance: string, credit_entitlement_id, customer_id, overage, ... }` — keyed by **customer**, not by checkout-session id. `balance` is a `string` (decimal), not a `number`. **⚠️ CORRECTED 2026-07-29 by Agent A against a real live call: the SDK's type is WRONG here — the wire actually returns `"balance": 100000` as a JSON *number*, while the ledger object's `amount`/`balance_after` for the same transaction ARE quoted strings. Coerce explicitly; see Phase 1c FINDING A.** This means `Ledger.fund()`'s `reserveRef` can't simply be the checkout session's `session_id` (also note: the field is `session_id`, not `.id` as the doc's sketch used) if `balance()`/`draw()` need a customer id — resolving a session to its customer requires `checkoutSessions.retrieve(session_id).payment_id` → `payments.retrieve(payment_id).customer.customer_id`. Recorded here now so whoever picks up Phase 1c (still blocked on B-001) doesn't re-derive this from scratch; the dashboard's `/api/mandate` route (Phase 1h) implements this resolution chain for real, marked unverified-live pending B-001, same as Phase 1d's `execute()`. | 2026-07-29, Agent B |
| Is the $1,000 promotional credit visible/real in the dashboard? | vault `_TASKS & STATUS` Q8 | **Resolved, and the answer changes the picture.** The user confirmed a real Dodo test-mode account exists and shared a screenshot of Settings → Promotions: "Promo Name: Replit x Dodo Payments," "Fee waiver still available on $0.00 / $1,000.00," "Transaction Fee and Transaction Fixed Fee are waived until the threshold is reached," expires 7 Oct 2026. **This is a transaction-fee waiver on Dodo's own processing fees, not a spendable credit balance.** It's a completely different Dodo feature from the Credit-Based Billing ("Agent Spend Credits" Product + Credit Entitlement) this project's `Ledger.fund()`/`balance()`/`draw()` are built around. It doesn't provide `DODO_API_KEY`/`DODO_API_KEY_READONLY`/a Product/a Credit Entitlement ID, and doesn't change what B-001 still needs. Likely moot for this build anyway — test-mode transactions already involve no real money and (typically) no real processing fees regardless of any promotion, since nothing here ever enters live mode (`CLAUDE.md` Hard rule 1). Good news it does confirm: the account itself is real and in Test Mode — genuine progress toward clearing B-001, just not the whole thing. | 2026-07-29, Agent A |

---

## Final pre-hackathon status (fill in night of 31 Jul)

**What shipped, exactly:**

**What was cut, and why:**

**Known risks going into Saturday:**

**Confidence level for the live demo (1–5):**

---

This log exists so spec-vs-reality drift is visible, not lost. Update it every time a phase in `PROMPTS.md` finishes running.
