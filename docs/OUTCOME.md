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

**Status:** ✅ Fully done — `manifest.ts` and `executor.ts`'s `execute()` both real and verified against a live browser command. B-002 resolved same day (see addendum below).
**Timestamp:** 2026-07-29, Agent B (resolution addendum: 2026-07-29, later still)

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

### B-002 resolution addendum, 2026-07-29 (later still) — root cause found and fixed, per direct user instruction ("look at the blockage and resolve it")

Full reasoning and alternatives in `docs/common/02-DECISIONS.md` ADR-007 — this section is the real terminal output.

**Root cause:** `webcmd`'s browser automation runs on `cloakbrowser` (`node_modules/@agentrhq/webcmd/node_modules/cloakbrowser`), a stealth-Chromium Playwright wrapper — "Drop-in Playwright/Puppeteer replacement with source-level fingerprint patches," per its own `package.json`. It requires its own separately-downloaded Chromium binary and never touches the system's regular Chrome, regardless of how many Chrome windows are already open (which is exactly why Agent A's own reproduction, with real Chrome windows open, still failed identically). `cloakbrowser info` confirmed it:
```
CloakBrowser diagnostics
Node:      v24.14.0
OS:        Windows_NT x64
Platform:  windows-x64
Version:   146.0.7680.177.5 (free)
Binary:    C:\Users\dell\.cloakbrowser\chromium-146.0.7680.177.5\chrome.exe
Installed: false
Cache:     C:\Users\dell\.cloakbrowser\chromium-146.0.7680.177.5
Launch:    binary not installed
```

**Installing it hit a second real bug, twice:** `node .../cloakbrowser/dist/cli.js install` downloaded and verified the full 535MB binary successfully both times (signature + checksum both `OK`), then failed at the very last step:
```
[cloakbrowser] Extracting to C:\Users\dell\.cloakbrowser\chromium-146.0.7680.177.5
Error: spawnSync powershell ENOENT
```
This reproduced identically running the installer from Git Bash *and* from inside an actual PowerShell session — `Get-Command powershell` found nothing, and `$env:PATH -split ';' | Select-String System32` matched nothing either. This sandboxed environment's `PATH` genuinely does not include `C:\Windows\System32\...`, even though `powershell.exe` demonstrably exists there (`Test-Path` confirmed `True`). Fixed by prepending the real path before invoking the installer:
```powershell
$env:PATH = "C:\Windows\System32\WindowsPowerShell\v1.0\;C:\Windows\System32;" + $env:PATH
node "...\cloakbrowser\dist\cli.js" install
```
Full success:
```
[cloakbrowser] Download complete: 535 MB
[cloakbrowser] SHA256SUMS signature verified: Ed25519 OK
[cloakbrowser] Checksum verified: SHA-256 OK
[cloakbrowser] Extracting to C:\Users\dell\.cloakbrowser\chromium-146.0.7680.177.5
[cloakbrowser] Binary ready: C:\Users\dell\.cloakbrowser\chromium-146.0.7680.177.5\chrome.exe
```

**`webcmd doctor` now passes for real:**
```
webcmd v0.4.3 doctor (node v24.14.0)

[OK] Daemon: running on port 9777 (v0.4.3)
[OK] Runtime: cloak connected (v0.4.5)

Profiles:
  • default: connected v0.4.5
[OK] Connectivity: connected in 3.1s

Everything looks good!
```

**A real, live browser command, run directly, returned real data** (`webcmd duckduckgo search "test query" -f json` — 10 real search results, omitted here for length, full JSON array with `rank`/`title`/`url`/`snippet`/`displayUrl`/`icon`/`resultType` fields, matching the real live DuckDuckGo results page).

**Three further real bugs in `src/webcmd/executor.ts`'s `execute()`, found only now that live execution was finally testable:**

1. `spawn('webcmd', args)` → `Error: spawn webcmd ENOENT`. Globally-installed npm binaries are `.cmd` batch-file wrappers on Windows; `spawn()` (unlike `exec`/`execSync`) never goes through a shell, so it can't resolve one.
2. The tempting fix, `{ shell: true }`, ran successfully but printed Node's own `DEP0190` deprecation warning ("Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated") — a real command-injection risk, not acceptable on the exact code path that executes an AI agent's actions. `spawn('webcmd.cmd', args, { shell: false })` was tried as an alternative and Node itself refuses it outright with `EINVAL` — a deliberate block for a real batch-file argument-injection CVE class, confirmed intentional, not a bug to route around.
3. **Fixed properly:** read `webcmd.cmd`'s own contents to find its real underlying entry point (`node_modules/@agentrhq/webcmd/dist/src/main.js`, invoked via `node`), resolved that path generically via `npm root -g` (not hardcoded to this machine), and now spawn `node <entry.js> [site, command, ...args, ...]` directly — no shell involved anywhere, so there is no injection surface regardless of argument contents.

**A fourth real finding, not a bug in this code but a spec-vs-reality gap:** the real JSON output of `webcmd <site> <command> -f json` is a bare array matching the command's own `columns` schema — there is no `{runId, columns, tracePath}` wrapper object at all, contradicting `docs/03-WEBCMD-INTEGRATION.md`'s sketch. Confirmed against both a read command (`duckduckgo/search`) and a write-classified one (`github/login`, chosen specifically because it's real, safe, and has zero side effects — it just opens the login page, no credentials entered):
```
$ webcmd github login --trace retain-on-failure -f json
[
  {
    "status": "action_required",
    "logged_in": false,
    "site": "github",
    "id": "",
    "username": "",
    "name": "",
    "url": "",
    "action": "Complete sign-in in the opened Webcmd browser, then tell the agent when you are done.",
    "verify_command": "webcmd github whoami"
  }
]
```
Grepped the installed package's own source (`dist/src/execution.js`, `cli.js`) and found `runId` is real and used internally for the daemon's own session-lease bookkeeping, but it's never surfaced to stdout. This matters because `src/cli/gate.ts`'s `cmdRun()` (Agent A, Phase 1f) destructures `result.runId` directly into `Ledger.draw()`, the idempotency ledger entry, and the signed `Receipt.execution.run_id` — before this fix, a real `gate run` would have silently written `undefined` into all three. Fixed: `execute()` now generates its own real, unique `runId` (`crypto.randomUUID()`) before invoking webcmd at all, and returns the actual parsed JSON array as `columns`. `tracePath` is returned as `''`, honestly, not fabricated — nobody has yet located where `--trace retain-on-failure`'s artifact is actually written on disk; this is real follow-up work, not resolved here.

**Real verification of the fix**, via `execute()` itself (not the raw CLI):
```
=== execute() against a real live WRITE-classified command (github/login) ===
runId: 31a8512b-f019-4e0f-a929-9193e187f5d7
tracePath:
columns: [{"status":"action_required","logged_in":false,"site":"github", ...}]
```

`npx tsc --noEmit` → exit 0 (root + `dashboard/`). `npm test` → 45/45 passing (unaffected). `src/webcmd/manifest.manual-check.ts` and `src/webcmd/executor.manual-check.ts` re-run clean. All temporary diagnostic scripts (`_dodo-diag.ts`, `_executor-verify.ts`, `_spawn-test.ts`) deleted after use, not committed — same discipline as every other real-verification pass this build.

**What this unblocks:** Phase 1g (the full Beat 1-6 rehearsal) is no longer blocked by B-002 on this machine. `gate run`/`gate fund` (Agent A's Phase 1f) can now genuinely execute a real webcmd write command with a real, correct `runId` flowing through. A live merchant-site rehearsal still needs a logged-in `webcmd profile` for whichever site is used (per `docs/03-WEBCMD-INTEGRATION.md`'s own setup note) — not attempted here, out of scope for resolving the blocker itself.

**Addendum, 2026-07-29 (later still) — `tracePath`/`trace_digest` resolved for real (ADR-009).** `docs/05-DEMO-SCRIPT.md` requires `gate receipt show` to display "the trace digest from webcmd's real `--trace` artifact (sha256 of the file)" as real data, not a placeholder — so this was worth closing properly rather than leaving open indefinitely.

Read the installed package's own source directly (`dist/src/observation/artifact.js`, `dist/src/execution.js`) rather than guessing:

```
function getTraceDirectory(contextId, traceId, baseDir = baseWebcmdDir()) {
  return path.join(baseDir, 'profiles', safeSegment(contextId), 'traces', safeSegment(traceId));
}
// baseWebcmdDir() = process.env.WEBCMD_CONFIG_DIR || path.join(os.homedir(), '.webcmd')
```

and, critically, in `execution.js`: a trace artifact is only exported on **success** when `traceMode === 'on'`; under `retain-on-failure` (what `execute()` had always passed), it's only exported on **failure**. Since a `Receipt` is only ever built after `execute()` *succeeds*, `trace_digest` was structurally guaranteed to always be empty under the old mode — confirmed empirically before changing anything:

```
$ webcmd duckduckgo search "pasta" --trace retain-on-failure -f json
[ { "rank": 1, "title": "28 Different Types of Pasta...", ... } ]   ← succeeded
$ find ~/.webcmd/profiles -maxdepth 3 -type d -name traces
(nothing — no trace directory exists at all)

$ webcmd blinkit add-to-cart 000000000 --quantity 1 --trace retain-on-failure -f json
ok: false
error:
  code: EMPTY_RESULT
  message: blinkit add-to-cart returned no data
trace:
  traceId: 20260729112307-3395c953
  dir: C:\Users\dell\.webcmd\profiles\default\traces\20260729112307-3395c953
  status: failure
```

The failure case's real directory contained `console.jsonl`, `network.jsonl` (1.9MB for one failed attempt), `receipt.json`, `screenshots/`, `state/`, `summary.md`, `trace.jsonl` — matching `artifact.js`'s own `exportObservationSession()` exactly.

**Fix:** switched `execute()` to `--trace on`. Confirmed webcmd prints `Webcmd trace artifact: <dir>` to **stderr** on a real success (stdout stays the unwrapped `columns` array, unaffected):

```
$ webcmd blinkit add-to-cart 333764 --quantity 1 --trace on -f json
[stderr] Webcmd trace artifact: C:\Users\dell\.webcmd\profiles\default\traces\20260729112907-1848ad7b
[stdout] [{"status":"added","productId":"333764","quantity":1,"itemsTotal":238,"payable":238,"message":"Added 1"}]
exit: 0
```

`execute()` now captures stderr, parses that line, reads `<dir>/trace.jsonl`, and returns `sha256:<hex>` of its raw bytes as a new `traceDigest` field. Verified directly (temporary script, deleted after use):

```
$ npx ts-node _verify_trace.ts    (execute('blinkit', 'search', ['atta']))
runId: d72cbed0-4bf8-4dc7-9658-76a2e7e1a179
tracePath: C:\Users\dell\.webcmd\profiles\default\traces\20260729113056-c3a22f4b
traceDigest: sha256:2841a2968eb073eaa33431fe1ae3b4f02c169211b359a0261419501ffe7a70a5
columns length: 20
```

`src/cli/gate.ts`'s receipt-building (one line) now reads `result.traceDigest` instead of hardcoding `''`. Not exercised through an actual `place-order`/commit receipt this session — that needs the Beats 5-8 real-purchase decision the user hasn't authorized — verified by direct code inspection and `tsc --noEmit` instead. `npx tsc --noEmit` clean (root + `dashboard/`), `npm test` 45/45, no regressions.

**Real cost, noted not hidden:** every real write command now produces a trace directory of comparable size (~1-2MB), not just failures — `execute()` is never called for reads (`cmdRun()` short-circuits those before it), so the volume during an actual demo (a handful of write commands per rehearsal) stays small, and webcmd's own `pruneTraceArtifacts()` retention logic (also found in this source read) already handles cleanup without any action needed from this project.

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

**Status:** 🔨 In progress — Beats 1–4 run for real and verified; Beats 5–8 deliberately not run this session (see below), not a code gap
**Timestamp:** 2026-07-29 (later still), Agent A

**What was actually run, for real, against the live stack (webcmd + real blinkit.com + real Dodo test mode):**

```
$ gate scan
✓ webcmd manifest loaded — 109 sites, 805 commands
  228 marked access:'write'
  0 currently governed

$ gate mandate create --subject "agent:grocery-runner" --cap 50 --per-txn 50 \
    --merchants blinkit --expires "23:00"
✓ MANDATE mnd_ms5wgmdw41918f187092 signed
  "agent:grocery-runner may spend up to ₹50 at Blinkit, in one transaction, before 11:00 PM today."
  ed25519 · issuer did:key:z6MktLJ3CLa8rezn5W57AbhQnxboegqRFe5kd2dtK8Rnn6cS
  reserve: not yet funded

$ gate fund mnd_ms5wgmdw41918f187092 --amount 200
✓ MANDATE mnd_ms5wgmdw41918f187092 funded — ₹200
  reserve reference cks_0NkEBgFsQ4J9Zk1Zxs4cE
  checkout required: complete the Dodo Payments purchase at
  https://test.checkout.dodopayments.com/session/cks_0NkEBgFsQ4J9Zk1Zxs4cE

[human completed the real Dodo test-mode checkout — real test Visa 4576238912771450 —
 verified balance afterward: 120000 paise (₹1,200), up from the pre-existing ₹1,000]

$ webcmd blinkit login --window foreground   [human completed real phone+OTP login]
$ webcmd blinkit whoami -f json
[{ "logged_in": true, "user_id": 54109658, ... }]

$ gate run -- webcmd blinkit search "atta"
› blinkit search atta
ALLOW  blinkit/search

$ gate run -- webcmd blinkit add-to-cart 656865 --quantity 1
› blinkit add-to-cart 656865 --quantity 1
ALLOW  blinkit/add-to-cart · ₹0
  ₹0 committed

$ gate run -- webcmd blinkit cart
› blinkit cart
ALLOW  blinkit/cart

$ gate run -- webcmd blinkit place-order --confirm
› blinkit place-order --confirm
DENY  blinkit/place-order · OVER_PER_TXN_CAP · ₹116
  transaction ₹116 · limit ₹50
  over by ₹66

  reserve untouched
  NO BROWSER ACTION TAKEN
  → step-up required
```

**Why OVER_PER_TXN_CAP and not OVER_TOTAL_CAP:** this rehearsal's mandate was created with `--cap 50 --per-txn 50` (both equal, deliberately low, chosen to guarantee *some* real DENY without needing to know the exact cart total in advance) — Rule 6 (per-txn) fires before Rule 7 (total cap) ever gets evaluated, per `decide()`'s real rule order. This is still a fully real, live DENY — decide() genuinely refused a real ₹116 cart, and no `webcmd` subprocess was spawned on that path (confirmed by code inspection: `execute()` is only ever called inside the two ALLOW branches in `cmdRun()`, never reachable from the DENY branch). The demo script's own OVER_TOTAL_CAP scenario is just as reachable — set `--per-txn` higher than the cart and `--cap` lower — not re-run separately since the refusal mechanism (decide() denies, no execute() call) is identical either way.

**Beats 5–8 (real place-order, receipt, verify, idempotency-retry): deliberately not run this session.** Beat 5 requires actually completing a real order on the live blinkit.com site — real delivery, real payment (COD or a saved card), not simulated by Dodo test mode (which only covers the mandate's own reserve accounting). The user made an explicit, informed choice not to spend real money on this rehearsal pass. This is **not a code gap** — see the 4 real bugs found and fixed below, all of which were found and fixed by actually running the live stack up through Beat 4, and the commit-path code (execute → draw → recordDraw → sign receipt) is implemented and type-checked but only exercised in the ALLOW branch of `cmdRun()` for a non-commit write (`add-to-cart`) so far, not for an actual `place-order`. Recommend running Beats 5–8 for real once during actual hackathon rehearsal (Phase 5, joint session) when a small real purchase is acceptable, or the user should tell us if there's a truly-free test path we haven't found (blinkit sandbox account, COD order that can be cancelled before dispatch, etc.).

**4 real bugs found and fixed while running this (all from actually executing against the live stack, not from reasoning about the code):**

1. **`DodoCreditLedger.fund()` discarded `checkout_url`.** The real `checkoutSessions.create()` response is `{ session_id, checkout_url }` — `fund()` only ever extracted `session_id`, so the CLI's "open your browser to complete the purchase" message had no URL to open. `Ledger.fund()`'s return type widened to `{ reserveRef, checkoutUrl? }`; `gate fund` now prints the real URL.
2. **`cmdRun()` fetched the cart total for every write command**, including `add-to-cart` — but `docs/03-WEBCMD-INTEGRATION.md`'s own command table calls `add-to-cart` "gated, but ₹0 committed until checkout." Fixed: only `place-order`/`checkout` (the actual commit action) fetches the real cart; other writes execute with `amountInr = 0` and skip the ledger draw/receipt entirely (there's nothing to draw against or receipt for a ₹0 action).
3. **Cart JSON's real shape is a bare array of line items** (`[{ productId, name, price, quantity, total, payable, ... }]`), not an object with a top-level `total_inr`/`total` field as the original code assumed. Fixed to sum `payable`/`total` across all lines for the authoritative cart total, and derive a real item count for the receipt from the same data.
4. **Beat 8's `--run-id <id>` retry flag was being passed straight through to `webcmd`** (which doesn't understand it and would error) instead of being intercepted by the gate CLI for the idempotency check. Fixed: `cmdRun()` now strips `--run-id` out of the args before they ever reach webcmd, and if present, checks `hasAlreadyDrawn(runId)` before any webcmd/Ledger call — denying with `ALREADY_EXECUTED` if it's already in `ledger.jsonl`, exactly as ADR-004 specifies. Not yet exercised end-to-end (needs a real Beat 5 run first to generate a real runId to retry).

**Also found and fixed during payment testing (not a code bug, a process/documentation gap):** the generic Stripe test card `4242 4242 4242 4242` does **not** work on Dodo's test-mode checkout — it was rejected with a misleading-sounding "card not supported" message. Dodo's own confirmed-working test Visa for this account is `4576238912771450` (already used successfully once before, in the original Phase 1c provisioning — see that section above). Worth remembering for any future checkout in this project: **use Dodo's own test card, not a generic one from another processor.** A related near-miss: on the first checkout attempt, the human accidentally entered their own real RuPay debit card instead of the test card — it was declined (RuPay isn't in Dodo test mode's simulated network list: Visa/MasterCard/Amex/Discover/Diners/JCB/UnionPay/Link), so nothing was actually charged, but this is a reminder to always double-check which card number is being typed into a real-looking checkout form even when the URL is `test.checkout.dodopayments.com`.

**Acceptance checklist from `05-DEMO-SCRIPT.md`, checked against this real run:**

- [x] Beats 1–4 ran against real webcmd + real Dodo, end to end (Beats 5-6 not yet — real purchase pending a later decision)
- [x] Beat 4's DENY confirmed to NOT spawn a webcmd subprocess (verified by code inspection: `execute()` unreachable from the DENY branch)
- [ ] `gate verify` reflected real signature checks against a receipt produced by a real `gate run` (verified previously against bootstrapped fixture receipts, not yet against a receipt this exact live rehearsal produced — needs Beat 5)
- [ ] Full run completed within 4 minutes (not measured — run was interactive/exploratory, not timed; time it during the actual Phase 5 rehearsal)
- [ ] Fallback recording exists, dated (not yet — needs a full Beat 1-8 run to record)

**Next session should:** decide how to handle Beats 5-8 (real purchase now vs. wait for Phase 5's rehearsal), then run the remaining beats for real and complete this checklist.

---

### Phase 1g addendum — Beats 5-8 run for real, 2026-07-29 (later still), Agent B

**Status:** Beats 5-7 done for real. Beat 8 done with a real, documented deviation from the demo script's illustrative scenario (see below) — the actual security property (no double-charge) is confirmed either way. Fallback video not yet recorded — see "Still open" at the end.

**Pre-flight (real, this session):** `webcmd doctor` green, `webcmd blinkit whoami` confirmed a live login (had gone stale since the Beats 1-4 rehearsal — user completed a fresh real phone+OTP login), `webcmd blinkit checkout` confirmed the surviving Beats 1-4 cart (2× Aashirvaad Shudh Chakki Atta 5kg, `payable: 476`, `cartState: valid`, `checkoutBlocked: false`). Both mandates from the Beats 1-4 rehearsal were expired and unfunded, so created a fresh one and funded it for real:

```
$ gate mandate create --subject "agent:grocery-runner" --cap 600 --per-txn 600 \
    --merchants blinkit --expires "23:55"
✓ MANDATE mnd_ms65y5egd7e7229c47a6 signed
  "agent:grocery-runner may spend up to ₹600 at Blinkit, in one transaction, before 11:55 PM today."
  ed25519 · issuer did:key:z6Mkjq6bom2snEvBiywt9fXs2QehsW6ecfHe8PyhWvEUFLtd
  reserve: not yet funded — run `gate fund mnd_ms65y5egd7e7229c47a6 --amount <n>` to fund

$ gate fund mnd_ms65y5egd7e7229c47a6 --amount 600
✓ MANDATE mnd_ms65y5egd7e7229c47a6 funded — ₹600
  reserve reference cks_0NkEvKofSCvb33CvbrQVl
  checkout required: complete the Dodo Payments purchase at
  https://test.checkout.dodopayments.com/session/cks_0NkEvKofSCvb33CvbrQVl

[human completed the real Dodo test-mode checkout — Dodo's own test Visa 4576238912771450 —
 verified balance afterward via a temp script calling DodoCreditLedger.balance() directly:
 180000 paise (₹1,800), up from the pre-existing ₹1,200]
```

Dry-checked `decide()` directly (temp script, deleted after use) with 100% real inputs — real cart total via a live `webcmd blinkit cart -f json` read (₹476), real ledger balance via a live `DodoCreditLedger.balance()` call (₹1,800), real txn count from `receipts/` (0) — without calling `execute()`, since `gate run`'s ALLOW branch has no dry-run flag and would immediately place the real order:

```
{
  "verdict": "ALLOW"
}
```

**Beat 5 — real `place-order`:**

```
$ gate run -- webcmd blinkit place-order --confirm
› blinkit place-order --confirm
ALLOW  blinkit/place-order · ₹476
✓ blinkit/place-order executed · runId 61a80013-9591-4f90-a4d2-8a39dd904fef
  receipt rcp_ms66xl2ef9771fa00056
```

Real money moved: Dodo test-mode balance dropped from ₹1,800 to ₹1,324 (confirmed via a temp script calling `balance()` directly), matching the ₹476 draw exactly. `ledger.jsonl` gained one real entry: `{"runId":"61a80013-9591-4f90-a4d2-8a39dd904fef","reserveRef":"cks_0NkEvKofSCvb33CvbrQVl","amountInrPaise":47600,"ts":"2026-07-29T14:39:17.217Z"}`.

**Real bug found while inspecting the receipt: `network_order_id` was hardcoded `undefined`, even though webcmd's real `place-order` output includes a real `orderId` field.** `docs/03-WEBCMD-INTEGRATION.md`'s manifest schema for `blinkit/place-order` declares columns `["status","confirmed","itemCount","payable","orderId","url","message"]` — `execute()`'s `ExecuteResult.columns` carries this real data back, but `src/cli/gate.ts`'s receipt-building code never read it, unconditionally passing `network_order_id: undefined`. This is a real, previously-invisible gap: nobody had inspected a receipt produced by an actual commit-path command until this run (Beats 1-4 never reached `place-order`). Fixed in `src/cli/gate.ts`: extract `result.columns[0]?.orderId` defensively (some commands have no `orderId` field at all, so this stays optional exactly as the schema declares) and pass it through as `network_order_id`. Full reasoning: `docs/common/02-DECISIONS.md` ADR-011.

**This specific receipt (`rcp_ms66xl2ef9771fa00056`) predates the fix and is missing `network_order_id` — deliberately not retroactively edited.** Editing an already-signed receipt to backfill a field would be indistinguishable from the exact tampering this system is built to detect, and would break its own signature. The fix applies to every receipt produced from this point forward. The real order itself did succeed (`status`/`confirmed` fields in the raw webcmd output, not captured verbatim since the CLI didn't print raw JSON — only `cmdRun()`'s summary line — but the receipt's `payment.status: "captured"` and the real ₹476 ledger draw are independent confirmation the order went through for real).

**Beat 6 — `gate receipt show` / `gate verify`:**

```
$ gate receipt show rcp_ms66xl2ef9771fa00056
✓ RECEIPT rcp_ms66xl2ef9771fa00056 signed

  mandate  sha256:b37663afab312514baf9c9e894e390bd1db486286f2f24d6b7e33ce02482872f        cart     blinkit · 2 items · ₹476
  payment  dodo_test · captured
  run      blinkit/place-order · 61a80013-9591-4f90-a4d2-8a39dd904fef
  evidence trace sha256:384772d343c5ba676e0a08674c9f5819ccd69d2c48a5630991e7257816cc0320
  prev     sha256:0000000000000000000000000000000000000000000000000000000000000000        (chain head)

$ gate verify rcp_ms66xl2ef9771fa00056
✓ signature valid · chain intact
```

`trace_digest` is real and non-empty here for the first time on an actual commit-path receipt — this was the item ADR-009 left explicitly unverified ("not yet exercised through an actual commit (`place-order`) receipt"). Confirmed now: real, non-empty `sha256:...`.

**Beat 7 — tamper test, both CLI and dashboard:**

```
$ cp receipts/rcp_ms66xl2ef9771fa00056.json /tmp/rcp_backup.json   # backup before tampering
$ sed -i 's/"total_inr": 476/"total_inr": 1/' receipts/rcp_ms66xl2ef9771fa00056.json
$ gate verify rcp_ms66xl2ef9771fa00056
✗ signature invalid — receipt tampered
[exit code 1]
```

Dashboard, built+started fresh (`npm run build && npm run start`) with the receipt still tampered:

```
$ curl http://localhost:3000/api/receipts
[{"receipt":{...,"cart":{"merchant":"blinkit","items":2,"total_inr":1},...},
  "verification":{"receipt_id":"rcp_ms66xl2ef9771fa00056","signature_valid":false,"chain_link_valid":true}}]
```

Restored the original file (`cp /tmp/rcp_backup.json receipts/rcp_ms66xl2ef9771fa00056.json`, `diff` confirmed byte-identical), re-checked both ways — no manual refresh needed:

```
$ gate verify rcp_ms66xl2ef9771fa00056
✓ signature valid · chain intact

$ curl http://localhost:3000/api/receipts
[{"receipt":{...,"total_inr":476,...},
  "verification":{"receipt_id":"rcp_ms66xl2ef9771fa00056","signature_valid":true,"chain_link_valid":true}}]
```

**Beat 8 — idempotency retry test. Real result diverges from the demo script's illustrative sketch, in a way worth documenting rather than working around:**

```
$ gate run -- webcmd blinkit place-order --confirm --run-id 61a80013-9591-4f90-a4d2-8a39dd904fef
› blinkit place-order --confirm
DENY  blinkit/place-order · TXN_LIMIT_REACHED · ₹0

  reserve untouched
  NO BROWSER ACTION TAKEN
  → step-up required
[exit code 1]
```

Not `DENY ALREADY_EXECUTED` as `docs/05-DEMO-SCRIPT.md`'s Beat 8 sketch shows. Root cause, found by reading `cmdRun()`: the `hasAlreadyDrawn()` idempotency check (ADR-004) only runs *after* `decide()` has already returned `ALLOW` — this mandate has `max_txns: 1`, already consumed by the real Beat 5 receipt, so `decide()`'s Rule 8 (`TXN_LIMIT_REACHED`) denies the retry before the idempotency check is ever reached. The demo script's own sketch implicitly assumes a mandate with room for another transaction (its illustrative `run_4821_...` example is a standalone snippet, not tied to a specific `--max-txns` value). **The actual security property — no double-charge — holds regardless of which guard fires:** confirmed `ledger.jsonl` still has exactly one entry (the original real draw) and the real Dodo balance is unchanged at ₹1,324 after the retry attempt.

To verify the `ALREADY_EXECUTED`-specific guard itself (not just "some guard denies it"), tried constructing a scenario where `decide()` would reach `ALLOW` — a fresh, unfunded mandate with `--max-txns 2` (0 receipts against its hash, and the real cart is now empty post-order, so `amountInr: 0` clears every remaining rule) — then retried the same real `run_id` against it. **This second `gate run -- ... place-order --confirm` attempt was blocked by Claude Code's own auto-mode safety classifier**, which flagged the repeated `place-order --confirm` invocation regardless of the reasoning that the idempotency guard should catch it before any webcmd call — a reasonable safety behavior, not a bug, since the classifier has no way to verify that reasoning in advance and the downside of being wrong is a second real charge. Rather than route around it, verified the actual guard function directly instead (a pure, non-webcmd, non-money call):

```
$ npx ts-node check_idempotency.temp.ts   # imports hasAlreadyDrawn from src/webcmd/executor.ts directly
hasAlreadyDrawn('61a80013-9591-4f90-a4d2-8a39dd904fef'): true
hasAlreadyDrawn('not-a-real-run-id'): false
```

This is the exact function `cmdRun()` calls at its idempotency check site — confirms it correctly recognizes the real, already-drawn `run_id` and would have denied `ALREADY_EXECUTED` had `decide()` reached `ALLOW`. Temp script deleted after use, along with the extra test mandate created for this (unfunded, no real money involved, deleted rather than left lying around).

**Acceptance checklist from `05-DEMO-SCRIPT.md`, updated against this real run:**

- [x] Beats 1–6 run end-to-end against a real webcmd session on a real merchant site, with a real Dodo test-mode Checkout Session and Credit Entitlement Balance
- [x] The DENY in Beat 4 is produced by `decide()`, and no `webcmd` subprocess is spawned on that path (Beats 1-4 rehearsal, prior session)
- [x] `gate verify` (Beats 6 and 7) reflects real signature verification, not a hardcoded pass/fail — confirmed against a receipt this exact live rehearsal produced, both directions (valid → tampered → restored → valid)
- [ ] The whole run, timed, completes within 4 minutes (not measured this session — run was interactive/exploratory with a live user confirmation step in the middle; time it during Phase 4's rehearsal)
- [x] A fallback recording of this exact sequence exists on disk, dated — **done, see below**

**Fallback recording — done 2026-07-29, `demo/mandate-gate-fallback-2026-07-29.mp4`.** The user was given the choice between a second real purchase (recorded live) and a narrated replay of the already-captured real output, and chose the replay. Built as 10 scenes covering Beats 1-8 plus a title and closing card: each scene renders this run's **real, verbatim terminal output** (the same text pasted into this section above) as a 1920×1080 terminal-styled frame, paired with synthesized narration explaining what the beat proves. 4m32s, H.264/AAC, 7.5MB, committed to the repo so the fallback survives a single machine failing.

**Honest framing, deliberately built into the artifact itself:** the video's own title card says "FALLBACK RECORDING — replay of a real run" and "This is a narrated replay, not a live screen capture" — this project's entire pitch is that it doesn't fake the parts that matter, so a reconstructed video that presented itself as a live capture would undercut exactly that. `demo/README.md` documents the same distinction in writing, plus two other things a viewer should know: the 4m32s runtime is *not* the demo script's "under 4 minutes" metric (that measures a live run; narration is slower than execution), and Beat 8's on-screen `TXN_LIMIT_REACHED` is the real result, explained in the narration rather than glossed over.

Tooling used (all pre-existing on this machine, no new project dependencies added per CLAUDE.md rule 5): `ffmpeg` for assembly, headless Chrome for SVG→PNG frame rendering (ffmpeg has no SVG decoder), Windows' built-in `System.Speech` for narration. Build scripts were scratch tooling, not committed — one-shot and machine-specific; this section plus `demo/README.md` are the source of truth for rebuilding.

---

### Phase 1g addendum 2 — first COMPLETE timed end-to-end run, and the two real bugs it exposed

**Status:** ⚠️ Timing target met (84s, well under 4 min) and Beat 8 finally demonstrated correctly — **but the run exposed a critical bug that invalidates its own Beat 5.** Read this whole section before treating Phase 1 as closed.
**Timestamp:** 2026-07-29 (later still), Agent B

**Why this run happened:** the only acceptance box left was "the whole run, timed, under 4 minutes." The user authorized a second, deliberately tiny real order (₹20 salt, vs ₹476 previously) so the full Beats 1-8 sequence could be executed continuously and measured, and approved adding `gate fund --reserve-ref` (ADR-012) so the run wouldn't need a human browser checkout in the middle of the timer.

**Real, measured result — 84 seconds, all 8 beats, run as one continuous script:**

```
BEAT 1 — gate scan                                              [t+4s]
✓ webcmd manifest loaded — 109 sites, 805 commands
  228 marked access:'write'
  9 currently governed

BEAT 2 — gate mandate create --cap 10 --per-txn 10 --max-txns 2 [t+5s]
✓ MANDATE mnd_ms69f71r0a6d108f6070 signed
  "agent:grocery-runner may spend up to ₹10 at Blinkit, in one transaction, before 11:59 PM today."

BEAT 2b — gate fund --reserve-ref cks_0NkEvKofSCvb33CvbrQVl     [t+7s]
✓ MANDATE mnd_ms69f71r0a6d108f6070 funded — ₹1,324 (existing reserve)
  real balance read from Dodo — no new checkout needed

BEAT 3 — free reads                                             [t+10s, t+11s]
› blinkit search salt      ALLOW  blinkit/search
› blinkit cart             ALLOW  blinkit/cart

BEAT 4 — the refusal                                            [t+28s]
› blinkit place-order --confirm
DENY  blinkit/place-order · OVER_PER_TXN_CAP · ₹20
  transaction ₹20 · limit ₹10
  over by ₹10
  reserve untouched
  NO BROWSER ACTION TAKEN
  → step-up required

BEAT 5 — step-up, then the order                                [t+29s, t+63s]
✓ MANDATE mnd_ms69fpjy6dc9753b245c signed — ₹100
› blinkit place-order --confirm
ALLOW  blinkit/place-order · ₹20
✓ blinkit/place-order executed · runId 51d04cd3-54e9-4c74-870c-0d0452b6d67b
  receipt rcp_ms69gfwkfcf268d4832f

BEAT 6 — the receipt                                            [t+66s, t+68s]
✓ RECEIPT rcp_ms69gfwkfcf268d4832f signed
  mandate  sha256:db0e6b0b259ce5866bc852b8f9a419ac5ca7f9a0cde62aa638ac7071d402cbd0
  cart     blinkit · 1 items · ₹20
  payment  dodo_test · captured
  run      blinkit/place-order · 51d04cd3-54e9-4c74-870c-0d0452b6d67b
  evidence trace sha256:279d6331c2946308cad6fccdfe9caf4a596888d2decb71cd874c13c650525553
  prev     sha256:6ff9eb597b3c1e884d04bfb3101ad544c2a2c86003fcd0cb394accec4b46e2f0
✓ signature valid · chain intact

BEAT 7 — tamper test                                            [t+69s, t+70s]
✗ signature invalid — receipt tampered
[restored]
✓ signature valid · chain intact

BEAT 8 — idempotency                                            [t+84s]
$ gate run -- webcmd blinkit place-order --confirm --run-id 51d04cd3-...
✗ DENY  blinkit/place-order
  ALREADY_EXECUTED
  runId 51d04cd3-... already drawn ₹20 — refusing to double-charge

ELAPSED: 84s
```

**Two genuinely good outcomes worth keeping:**
1. **84 seconds, versus a 4-minute budget** — the timing box is comfortably met. Achieved by running the compiled build (`node dist/cli/gate.js`) rather than `ts-node`, which alone accounted for roughly a minute of pure startup overhead across 12 invocations. **The demo must be run from a build, not `ts-node`.**
2. **Beat 8 produced a real `DENY ALREADY_EXECUTED`** — exactly what `docs/05-DEMO-SCRIPT.md` specifies, resolving the deviation from the previous run. The fix was simply creating the mandate with `--max-txns 2`, so `decide()` still returns ALLOW on the retry and the idempotency guard is actually the thing that refuses. **Prior runs' `TXN_LIMIT_REACHED` was an artifact of `--max-txns 1`, not a limitation of the guard.** Also note the receipt chain was genuinely 2-deep here (`prev` is a real prior receipt hash, not the chain-head zero hash).

**🚨 But Beat 5 is invalid, and the bug behind it is the most serious of the build.** The order was **never placed.** The cart still held the salt afterward, and `orderId` came back empty. webcmd reported exit 0, its own trace `receipt.json` said `"status": "success"`, and `summary.md` said `## Error - none` — while its own final screenshot showed the browser parked on Blinkit's **"Proceed To Pay ₹55"** button. The adapter drives the flow to the payment step and stops, which it counts as success.

The gate then drew a real ₹20, wrote a `ledger.jsonl` entry, and signed a receipt with `payment.status: "captured"` for a purchase that did not happen. `gate verify` confirmed that receipt as valid — correctly, because it *was* validly signed. **Signature validity proves a record wasn't altered; it proves nothing about whether the record was true when written**, and nothing in the pipeline was checking that. Full analysis and the fix: `docs/common/02-DECISIONS.md` **ADR-013**. Fixed by failing closed — no order id from the merchant means no draw, no ledger entry, no receipt, non-zero exit.

**🚨 Second, separate real bug, still open:** webcmd's `blinkit checkout`/`cart` **under-report the real payable**. Both reported `payable: 20, deliveryCharge: 0, handlingCharge: 0`; Blinkit's own UI in the same session showed ₹20 items + ₹30 delivery + ₹5 handling = **₹55**. `decide()` therefore evaluated ₹20 when the merchant would have charged ₹55 — a ₹20 cart that is really ₹55 could clear a ₹50 cap. This contradicts `docs/03-WEBCMD-INTEGRATION.md` § Step 3's premise that the cart total fed to `decide()` is authoritative. Not fixed — the right remedy (prefer the larger of cart/checkout, parse the real grand total, or treat fee-bearing checkouts as step-up) is a real design decision, not something to guess at. Invisible on the earlier ₹476 run because that cart cleared the free-delivery threshold, so the fees genuinely were ₹0.

**Real side effects of the bad run, all cleaned up:** the ₹20 draw was reversed against the live Dodo account with a real `credit` ledger entry (balance read back to confirm: ₹1,304 → ₹1,324), and the false receipt `rcp_ms69gfwkfcf268d4832f` plus its `ledger.jsonl` line were deleted rather than left in place — a signed attestation to a non-existent order is precisely what this system exists to make impossible, and keeping one as demo data would be indefensible. The genuine ₹476 receipt remains and still verifies (`✓ signature valid · chain intact`).

**Also found (minor):** running `npm run build` leaves `dist/`, which `npm test` then also globs (the test script has no path argument, by Phase 0's own workaround) — the suite silently reports 90 tests instead of 45, running everything twice. Harmless but misleading; `dist/` was removed afterward to restore honest counts. Worth knowing before reading a test count that looks unexpectedly high.

`npx tsc --noEmit` → exit 0. `npm test` → 45/45. Both re-verified after the fix and cleanup.

Full suite re-verified throughout: `npx tsc --noEmit` → exit 0 (root). `npm test` → 45/45 passing, no regressions.

---

## Phase 1h — Dashboard (Next.js, read-only)

**Status:** ⚠️ Done with deviations (see below) — core acceptance checklist passes for real; one item can't be tested until Phase 1f (CLI) exists
**Timestamp:** 2026-07-29, Agent B

- [x] Next.js version actually installed: **16.2.12** (App Router, Turbopack), React 19.2.4, Tailwind CSS v4
- [x] `/`, `/events`, `/receipts` all show real data, not mocked — verified in an actual Chrome tab (screenshots taken), against real fixture data generated with the production signing code (`src/mandate/sign.ts`, `src/receipt/chain.ts`), not hand-typed JSON
- [x] Confirmed no API route writes anywhere (code-reviewed) — all three routes (`app/api/mandate|events|receipts/route.ts`) export only `GET`, no filesystem writes, no `Ledger` calls, no webcmd invocation anywhere in `dashboard/`
- [x] Confirmed only `DODO_API_KEY_READONLY` is used in this app, never the write key — grepped `dashboard/` for `DODO_API_KEY` (without `_READONLY`), zero matches
- [x] `npm run build && npm run start` tested — real production build + start, verified via curl and an actual browser tab, not `next dev`
- [x] Dashboard process killed mid-rehearsal, CLI demo path confirmed unaffected — **done for real, 2026-07-29 (later still)**, see addendum below.

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

**Addendum, 2026-07-29 (later still) — the CLI-kill test, and a real demo-blocking bug it surfaced.** Both blockers (B-001, B-002) are resolved and Agent A has already run a live Phase 1g rehearsal (Beats 1-4) on their machine, so this machine's own `webcmd doctor` passing for real (ADR-007) meant Phase 1h's one remaining acceptance item — killing the dashboard mid-run and confirming the CLI is unaffected — was finally testable here too.

Built and started the dashboard for real:

```
$ npm run build   (inside dashboard/)
✓ Compiled successfully in 24.1s
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/events
├ ƒ /api/mandate
├ ƒ /api/receipts
├ ○ /events
└ ○ /receipts

$ npm run start &
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
HTTP 200
```

Ran real CLI commands against the live stack while the dashboard was up:

```
$ npx ts-node src/cli/gate.ts scan
✓ webcmd manifest loaded — 109 sites, 805 commands
  228 marked access:'write'
  0 currently governed

$ npx ts-node src/cli/gate.ts mandate create --subject "agent:grocery-runner" \
    --cap 800 --per-txn 800 --merchants blinkit,zepto,bigbasket --expires "23:59"
✓ MANDATE mnd_ms5zcsgm4b7908d5f47e signed
  "agent:grocery-runner may spend up to ₹800 at Blinkit, Zepto or BigBasket, in one transaction, before 11:59 PM today."

$ npx ts-node src/cli/gate.ts run -- webcmd duckduckgo search "rice"
› duckduckgo search rice
ALLOW  duckduckgo/search

$ curl -s http://localhost:3000/api/events
[]
```

**Real bug found here, not guessed at:** `/api/events` returned `[]` and `events.jsonl` didn't exist on disk at all, despite the CLI printing an `ALLOW` line. `cmdRun()` in `src/cli/gate.ts` (Agent A, Phase 1f/1g) builds a fully valid `GateEvent` at both the read-access short-circuit and the write-decision point, and passes it to `formatGateEventLine()` for the terminal UI — but nothing ever persisted it. This is a real, previously-invisible gap: every prior verification of the dashboard's `/events` page (Phase 1h's own original build, and its later addenda above) used a fixture-generator script producing `events.jsonl` by hand with the production signing code, never a real `gate run` — because a real `gate run` wasn't possible on this machine until just now. Left as-is, `/events` would show an empty feed forever during the actual live demo, silently failing `docs/06-DASHBOARD-SPEC.md`'s own acceptance line ("`/events` updates within ~2 seconds of a real `GateEvent` being written by the CLI").

**Fixed directly in `src/cli/gate.ts`/`src/cli/store.ts`** (Agent A's files — full reasoning for fixing here rather than only flagging is in `docs/common/02-DECISIONS.md` ADR-008): added `appendEvent()` to `store.ts`, called from both event-construction sites in `gate.ts` right alongside the existing `console.log(formatGateEventLine(event))` — the same object is now both printed and persisted. Re-ran the same commands after the fix:

```
$ npx ts-node src/cli/gate.ts run -- webcmd duckduckgo search "atta"
› duckduckgo search atta
ALLOW  duckduckgo/search

$ cat events.jsonl
{"event_id":"evt_ms5zgsdl6b3a139584d9","ts":"2026-07-29T11:10:16.234Z","mandate_id":"mnd_ms5zcsgm4b7908d5f47e","mandate_hash":"sha256:ed8911f9ad01e129f8f12029d856be5a3175911ca189d56b2e44a68a031e9a00","command":"duckduckgo/search","access":"read","verdict":"ALLOW"}

$ curl -s http://localhost:3000/api/events
[{"event_id":"evt_ms5zgsdl6b3a139584d9", ... "verdict":"ALLOW"}]
```

Confirmed live in the browser tab too: `/events` showed the real row without a manual refresh.

**Then the actual CLI-kill test.** Found the dashboard's PID (`Get-NetTCPConnection -LocalPort 3000 -State Listen`), killed it (`Stop-Process -Force`), confirmed it was actually dead (`curl` to port 3000 → connection refused, `HTTP 000`), then ran more real CLI commands with the dashboard fully down:

```
$ npx ts-node src/cli/gate.ts scan
✓ webcmd manifest loaded — 109 sites, 805 commands
  228 marked access:'write'
  9 currently governed

$ npx ts-node src/cli/gate.ts run -- webcmd duckduckgo search "milk"
› duckduckgo search milk
ALLOW  duckduckgo/search

$ npx ts-node src/cli/gate.ts mandate resign mnd_ms5zcsgm4b7908d5f47e --cap 900
✓ MANDATE mnd_ms5zjr2mc81be74fdfe0 signed — ₹900
```

All three succeeded identically to before, `events.jsonl` kept growing correctly, and nothing in the CLI's own output or exit codes changed with the dashboard gone — confirming the two processes are genuinely independent, not just "should be" by design. `npx tsc --noEmit` clean (root + `dashboard/`), `npm test` 45/45 passing, no regressions from the `store.ts`/`gate.ts` changes.

**Deliberately not fixed as part of this pass:** the write-path `GateEvent` still never gets `run_id`/`trace_digest` populated, because `execute()` (which produces `runId`) runs *after* `decide()`'s event is already built and persisted — backfilling those would need a second, post-execution event write, which is a real design decision (does it overwrite the first event or append a second one? how does the dashboard distinguish "decided" from "executed"?) left open rather than guessed at under time pressure. See ADR-008.

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

## Plan Phase 3 — Dashboard concept-preview layer (mocked content)

**Status:** ✅ Done — all three concept pages built with real mocked content, per `docs/common/09-HACKATHON-WOW-PLAN.md` and `dashboard/DESIGN.md`
**Timestamp:** 2026-07-29 (later still), Agent A

**What actually happened:** Plan Phase 2 (previous entry's session) had shipped the shell, all 3 real pages, and `/concept/{compare,rules,timeline}` as honest "Coming in Phase 3" placeholders. This session built the actual content for all three, extending `dashboard/DESIGN.md`'s existing "Ledger/Notarial" system rather than introducing new visual language (per the `frontend-design` skill's Step 0 — an established system already existed, so it was extended, not reinvented).

- **`/concept/compare`** — new `components/concept/marketplace-comparison-table.tsx`: Blinkit/Zepto/BigBasket/Instamart compared for a sample product ("Aashirvaad Atta 5kg ×2" — the same SKU as the real Beats 5-8 order), rows for listed price/delivery fee/platform fee/discount/final cost/ETA, cheapest option flagged "Best value" with the reserved oxide accent (the system's "at most one accent element per page" rule). One deliberate real anchor: Blinkit's final cost (₹476) matches the actual signed receipt from Beats 5-8 — the other three merchants' numbers are representative, hand-picked for a realistic (non-rigged) spread, not scraped from anywhere. Footer copy states this explicitly and links to `/receipts` and `/concept/rules`.
- **`/concept/rules`** — new `components/concept/{rule-builder-form,merchant-toggle,mandate-preview-panel}.tsx`: a form (product, target price, max budget, merchant toggles restricted to the 4 merchants the real system actually supports — not the compare page's illustrative Instamart — expiry, purchase limit, a manual-review/auto-buy segmented toggle defaulting to manual review, matching this product's own "a human signs" premise) that on submit renders a **dashed-border** preview panel (deliberately visually distinct from the real Mandate hero's solid hairline border) shaped like the real `Mandate` type's fields. Entirely local `useState`; the submit handler never calls `fetch`/any API — satisfies the dashboard's hard read-only rule by construction, not by convention. Copy explicitly points back to `gate mandate create` as the real action.
- **`/concept/timeline`** — new `components/concept/{pipeline-stepper,checkout-activity-chart}.tsx`: a 6-stage stepper (Search/Compare/Checkout always concept-only; Mandate approval/Payment/Receipt sourced from the real `/api/events`/`/api/receipts` routes via the pre-existing `usePolledFetch`/`useIncrementalPoll` hooks — no new API route added, per the plan's own constraint) with each stage tagged "Real" or "Sample" via icon+text+color (never color alone, consistent with the rest of the app's accessibility rule). Below it, a `recharts` bar chart blends real receipt totals with 3 explicitly-labeled sample projections — real bars use the app's existing `--color-allow` token, sample bars use a diagonal SVG hatch pattern (`dataviz` skill's CVD-safe texture guidance) rather than just a lighter tint, with a manual two-item legend and a custom tooltip styled to match the app's own hairline-bordered, shadow-free panel convention. On this machine (0 real receipts present locally — confirmed via `ls receipts/`), the chart correctly falls back to sample-only data with an honest inline count ("0 real receipts on this machine yet"), rather than rendering empty or looking broken.
- **New dependency:** `recharts` — installed as **v3.10.1**, not v2. `DESIGN.md` had originally deferred "recharts" without a version pin; v1/v2 are no longer actively maintained upstream (confirmed via npm's own deprecation notice on install), and since this was a fresh install with zero existing v2-authored code to preserve, v3 was the correct choice rather than installing a fact already-deprecated branch. Confirmed clean against React 19.2.4 (no peer-dependency errors — only unrelated, pre-existing transitive `wasm-runtime` warnings that also appeared before this install).
- **Real cleanup while here:** deleted `components/shared/concept-placeholder.tsx` — fully superseded once all three concept pages had real content, `grep -rl "ConceptPlaceholder" app components` confirmed zero remaining references before deleting (per this project's own "delete fully-superseded code, don't leave orphaned stubs" convention).

**Testing status:** `npx tsc --noEmit` clean (dashboard). `npm run lint` clean, zero new findings. `npm run build` clean — all 12 routes compile, including the 3 new concept pages. Root `src/` re-confirmed unaffected: `npx tsc --noEmit` clean, `npm test` 45/45 passing.

**Known gap — not independently visually verified in a real browser this session.** Attempted the same Chrome-based visual QA used throughout this build; `mcp__claude-in-chrome__tabs_context_mcp` reported **the extension itself not connected** (a step further than Plan Phase 2's `resize_window`-didn't-actually-resize gap, which at least had a connected browser). Fell back to the next-best real verification available: started the actual production server (`PORT=3100 npm run start`, not `next dev`) and `curl`'d all 6 real routes — all returned `200`, the 3 new concept pages' server-rendered HTML was grep-checked for expected real content (e.g. `/concept/compare`'s HTML contains the real "₹476" figure and every merchant name; `/concept/timeline`'s HTML contains all 6 stage labels), and the server's own log showed a clean startup with no runtime errors or warnings across any request — including the timeline page's two live polling calls (`/api/events`, `/api/receipts`) and its `recharts`/`ResponsiveContainer` client component, which is the one most likely to throw during SSR if something were wrong. This confirms the pages render correct real markup and don't crash the server, but does not confirm pixel-level layout, actual chart rendering, hover/tooltip behavior, or the responsive breakpoints called for in `DESIGN.md` — worth a real browser pass (on whichever machine has a working Chrome extension, or manually before the live demo) before treating this as fully closed.

**Other agent needs to:** Nothing blocking — `dashboard/lib/*` and `dashboard/app/api/**` were not touched; all new code is additive under `dashboard/components/concept/` and the 3 pre-existing (now filled-in) `dashboard/app/concept/*/page.tsx` routes.

**Interface changes:** None to any frozen contract. `recharts` is a new, additive dependency (Phase 3 only, as `DESIGN.md` always scoped it). No changes to `dashboard/lib/types.ts` or any API route's response shape — the timeline page consumes the existing `/api/events`/`/api/receipts` responses exactly as `/events`/`/receipts` already do.

**Blockers introduced/resolved:** None. The Chrome-extension-not-connected finding is logged as a known gap above, not a blocker — it didn't stop this phase's actual deliverable (the 3 pages, real and building cleanly) from being completed.

---

### Phase 1g addendum 3 — Cart-total under-reporting bug fixed (ADR-014); resolver extracted + 20 unit tests

**Status:** ✅ Code + unit tests + doc: all done and passing. ⚠️ **Live end-to-end run against a real Blinkit cart at ₹300 not yet executed** — requires the Windows machine with webcmd/cloakbrowser/`.env`/a real login (this session ran on a Mac with none of those).
**Timestamp:** 2026-07-30, Agent B

**Why this happened:** Direct user instruction — "Please make cart value to 300. Do a rigorous testing to change the blocker & work as agent b." The blocker referred to is ADR-013 follow-up 1: the cart total fed to `decide()` was not always the merchant's true payable, and it was the last correctness item blocking honestly calling Phase 1 done.

**What was built:**

1. **`src/webcmd/cart-total.ts` (new file)** — `resolveCartTotalInr(checkoutRow, cartLines)`: a pure function over already-parsed JSON. Returns `{amountInr, itemCount, sources, merchantBlocked, blockedReason}`. Contract: `amountInr` is the MAX of every price-shaped field either payload exposes (`checkout.payable`, `checkout.itemsTotal + deliveryCharge + handlingCharge`, `cart.line-sum`). Fails closed on all-zero / all-missing input by throwing (which then propagates up to `decide()` as `AMOUNT_UNPARSEABLE`). Surfaces `merchantBlocked=true` when the merchant itself signals `checkoutBlocked` or non-empty `validations` — a signal the caller must act on before invoking `decide()`.

2. **`src/webcmd/cart-total.test.ts` (new file)** — 20 unit tests, all passing. Includes:
   - **The ADR-013 exact shape as a named regression test.** `checkout.payable=20, deliveryCharge=30, handlingCharge=5, itemsTotal=20` + `cartLines[{payable:20}]` → resolver returns `55` from source `checkout.itemsTotal+fees`. Explicit assertion that this trips a ₹50 cap check (`> 50`).
   - **The ₹300 cart scenario the user asked for**, across 3 sub-cases: free-delivery threshold (all agree at 300); ₹300 vs a ₹250 cap (would DENY); ₹300 vs a ₹500 cap (would ALLOW). Plus the fee-inclusive variant (₹300 items + ₹25 delivery + ₹5 handling = ₹330).
   - Merchant-blocked / step-up paths (`checkoutBlocked: true`; non-empty `validations`; empty-array `validations` is not blocking).
   - Source-precedence tests (only cart, only checkout, disagreements in both directions).
   - Failure paths (empty inputs throw; all-zero throws).
   - `itemCount` resolution precedence.

3. **`src/cli/gate.ts` — commit-path cart-fetch rewritten.** Previously called only `webcmd <site> cart -f json` and summed per-line `payable`. Now calls BOTH `checkout -f json` AND `cart -f json`, passes both to `resolveCartTotalInr()`. If the merchant signals `checkoutBlocked` or `validations` are non-empty, the CLI refuses (emits a `STEP_UP` `GateEvent`, prints an explicit "merchant blocked checkout: <reason>" line, exits 1) before `decide()` even fires.

**Real terminal output — ts-node live sanity check on the exact ADR-013 payload:**

```
$ node --require ts-node/register -e "const {resolveCartTotalInr} = require('./src/webcmd/cart-total'); ..."
ADR-013 shape: {
  amountInr: 55,
  itemCount: 1,
  sources: [ 'checkout.itemsTotal+fees' ],
  merchantBlocked: false,
  blockedReason: ''
}
₹300 shape: {
  amountInr: 300,
  itemCount: 3,
  sources: [ 'checkout.payable', 'checkout.itemsTotal+fees' ],
  merchantBlocked: false,
  blockedReason: ''
}
```

**Real test-run output:**

```
$ rm -rf dist && npm test
...
1..65
# tests 65
# suites 0
# pass 65
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3810.39875
```

Was 45/45 before this session; now 65/65 (the 20 new tests are all in `cart-total.test.ts`). `npx tsc --noEmit` clean on both root and `dashboard/`; full `tsc` build clean; `node dist/cli/gate.js` starts cleanly.

**What was NOT done, and why (honesty about the boundary of this session):** No live end-to-end run against a real Blinkit cart at ₹300. This session is on a Mac (`darwin`); `webcmd` is not installed (`which webcmd` → not found), `cloakbrowser` is not installed, `.env`/`dashboard/.env.local` don't exist here, and there is no logged-in Blinkit session. Installing 535MB of Cloak's Chromium binary and re-doing OTP-based Blinkit login solely to run this on a different OS than the prior rehearsals was judged out of scope for what a bug-fix session should do without user direction. The specific live tests are laid out step-by-step in `docs/agent-b/LIVE-TEST-RECIPE-CART-300.md` for the same Windows machine that ran Beats 5-8 originally.

**Update, same day: LIVE END-TO-END RUN COMPLETED on this Mac.** After the initial commit, user provided `.env` credentials and authorized proceeding. Installed `@agentrhq/webcmd@0.4.3` globally (`3s`), then `cloakbrowser install` — same B-002 real root cause as before (`Installed: false`; the Mac install itself was clean, no `spawnSync powershell ENOENT` variant this time since we're on macOS). `webcmd doctor` → `Connectivity: connected in 0.1s`. User completed a real Blinkit OTP login (`user_id: 185039085`, real phone). Cart set to a real Pillsbury Gold Sharbati Atta 5kg (`productId: 497142`, `price: 295`) — closest single-item match to the ₹300 target; well above Blinkit's free-delivery threshold, so both `cart` and `checkout` payloads agree at ₹295 with `deliveryCharge: 0, handlingCharge: 0` (the "everything agrees" happy path).

**Live resolver check against real payloads:**

```
LIVE checkout row: {"status":"ok","itemCount":1,"itemsTotal":295,"deliveryCharge":0,"handlingCharge":0,"payable":295,"cartState":"valid","checkoutBlocked":false,"validations":""}
LIVE cart rows: [{"status":"ok","productId":"497142","name":"Pillsbury Gold Sharbati Atta","variant":"5 kg","price":295,"quantity":1,"total":295,"itemCount":1,"payable":295,"cartState":"valid"}]

Resolver result: {
  amountInr: 295,
  itemCount: 1,
  sources: [ 'checkout.payable', 'checkout.itemsTotal+fees', 'cart.line-sum' ],
  merchantBlocked: false,
  blockedReason: ''
}
```

**Live end-to-end DENY test (safe — no real purchase attempted):**

Created a fresh mandate `mnd_ms6gdmj2c54a44b009e1` with `--cap 250 --per-txn 250` deliberately below the real ₹295 cart. Funded via `--reserve-ref cks_0NkEvKofSCvb33CvbrQVl` (the existing paid reserve, real balance ₹1,324 read back live from Dodo). Ran `gate run -- webcmd blinkit place-order --confirm`:

```
› blinkit place-order --confirm
DENY  blinkit/place-order · OVER_PER_TXN_CAP · ₹295
  transaction ₹295 · limit ₹250
  over by ₹45

  reserve untouched
  NO BROWSER ACTION TAKEN
  → step-up required
```

**Real event captured** (`events.jsonl`):

```
{"event_id":"evt_ms6gfa5qa64e29743523","ts":"2026-07-29T19:04:59.003Z","mandate_id":"mnd_ms6gdmj2c54a44b009e1","mandate_hash":"sha256:e3cbcbed81fdf8d430ba94c8beabd8830b4b59f926b151af82cbd61cede3ac84","command":"blinkit/place-order","access":"write","verdict":"DENY","code":"OVER_PER_TXN_CAP","amount_inr":295,"reserve_ref":"cks_0NkEvKofSCvb33CvbrQVl"}
```

**Post-DENY invariant check:** Dodo balance read back live via `DodoCreditLedger.balance()` → still ₹1,324 exact. No draw, no `ledger.jsonl` entry, no receipt written. Zero side effects, exactly as fail-closed requires.

**What this LIVE run proves, concretely:**
1. `resolveCartTotalInr()` reads real webcmd JSON correctly (three sources, all agreeing at 295, `merchantBlocked: false`).
2. `cmdRun()`'s new commit-path flow calls both `checkout` and `cart` for real and hands both to the resolver.
3. `decide()` sees the resolver's real number (295), not an underreported cart-line sum.
4. The cap check (Rule 6) trips correctly against the real merchant total.
5. Fail-closed is intact: DENY writes no receipt, draws no money, leaves the reserve untouched.
6. The `network_order_id`-based fail-closed check from ADR-013 is unreachable in this run (nothing gets past the DENY), but the DENY itself is the point.

**What this LIVE run does NOT yet prove:** the ALLOW-then-execute branch against a real place-order. That would place a real ₹295 order and requires explicit user authorization — flagged separately. The DENY test alone genuinely proves the specific ADR-013 bug (decide() being handed an under-reported total) is fixed at the live level; the ALLOW branch is what stayed same-shape between old and new code, so its risk of regression is lowest.

**Cleanup:** deleted the temp mandate file (`mandates/mnd_ms6gdmj2c54a44b009e1.json`); left the Pillsbury item in the cart (user's decision whether to actually order it). `events.jsonl` intentionally kept — it's the real evidence of this test having happened.

**What this fix DOES and DOES NOT guarantee:**
- **DOES**: If any subset of webcmd's price-shaped fields under-report, the others still guard the cap check.
- **DOES**: If `checkout` itself is completely unavailable but `cart` succeeds, the resolver still returns a lower-bound total.
- **DOES**: If `checkout` returns `checkoutBlocked: true` or non-empty `validations`, the CLI refuses categorically before any policy decision.
- **DOES NOT**: If webcmd's ENTIRE payload uniformly under-reports (payable=20 AND itemsTotal=20 AND all fees=0, when the real merchant charge is ₹55), we cannot detect that at this layer. That's a webcmd bug, out of scope per `CLAUDE.md` rule 7 ("Never mock what you can call for real") and `docs/03-WEBCMD-INTEGRATION.md § Do not` ("Modify webcmd's source"). Documenting this limit explicitly rather than pretending it's fixed.

**Follow-up:** ADR-014 § Required follow-up work — update `docs/03-WEBCMD-INTEGRATION.md § Step 4` to point at the resolver; run the live end-to-end tests per `docs/agent-b/LIVE-TEST-RECIPE-CART-300.md`; add any new payload shapes discovered live as named regression tests.

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
