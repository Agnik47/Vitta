# 02 — Dodo Payments Integration

Read `00-PRODUCT-BRIEF.md` and `01-ARCHITECTURE.md` first. This file is the spec for `src/ledger/DodoCreditLedger.ts` against the real Dodo Payments test-mode API. Verified against `docs.dodopayments.com` as of 28 Jul 2026 — where something is marked unverified below, confirm it against the live API before writing code that depends on it, and record what you found in `docs/OUTCOME.md`.

## Why Dodo

Dodo's Credit-Based Billing is a hosted, webhook-backed reserve ledger — it replaces a hand-rolled JSON file outright. Its API also has a field literally named `mandate_min_amount_inr_paise`, a real bank-registered spending ceiling, which is the closest production analog to this entire project's concept.

## Scope reminder

**Test mode only.** Every call in this file targets `https://test.dodopayments.com`. The $1,000 promotional credit is not spent by any test-mode call and its live-mode terms are unverified — never build anything that assumes it's real or spendable. See `00-PRODUCT-BRIEF.md` § Hard scope boundary.

## Setup — do this before writing any code

1. Create a Dodo Payments account and switch to Test Mode in the dashboard.
2. Generate a write API key and a read-only API key (the dashboard has an explicit toggle for this — the same read/write split webcmd uses).
3. Store both in `.env` (never commit this file):
   ```
   DODO_API_KEY=sk_test_xxxxx        # write key: fund(), draw(), release()
   DODO_API_KEY_READONLY=sk_test_ro_xxxxx  # read key: balance()
   DODO_ENV=test
   ```
4. Create one test-mode Product representing "Agent Spend Credits" (INR-denominated) so its `product_id` can be referenced in Checkout Sessions below. Do this once, in the dashboard or via the Products API — it's a one-time setup step, not something the app does at runtime.
5. Install the Dodo CLI for local webhook testing — this removes the need to write a webhook simulator:
   ```
   curl -fsSL https://dodopayments.com/install.sh | sh
   dodo wh listen   # forwards live test-mode webhooks to localhost
   dodo wh trigger  # sends any of 22 mock event payloads on demand
   ```

## SDK

```
npm install dodopayments
```

```ts
import DodoPayments from 'dodopayments';

const client = new DodoPayments({
  bearerToken: process.env.DODO_API_KEY,
  environment: 'test_mode', // confirm the SDK's actual enum name at install time
});
```

If the SDK's environment enum differs from this at install time, override the base URL directly instead: `https://test.dodopayments.com` for test (never use `https://live.dodopayments.com` in this build).

## `fund()` — create the reserve

```ts
async function fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string }> {
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: 'prod_agent_credits', quantity: 1 }],
    allowed_payment_method_types: ['upi_collect', 'credit', 'debit'],
    billing_currency: 'INR',
    customer: {
      email: 'demo@mandategate.local',
      name: 'Mandate Gate Demo',
      phone_number: '+919876543210',
    },
    billing_address: { country: 'IN', zipcode: '560001' },
    return_url: 'https://mandategate.local/funded',
    metadata: { mandate_id: mandateId },
  });
  return { reserveRef: session.id };
}
```

**Do not build this around a subscription/recurring mandate.** Dodo's RBI e-mandate renewal flow has a documented 48–51 hour gap between charge initiation and the `payment.succeeded` webhook. `fund()` above is a one-time Checkout Session, which settles immediately in test mode via the test UPI credentials below. Getting this distinction wrong makes the demo silently hang for two days.

## `balance()` — read the reserve

```ts
async function balance(reserveRef: string): Promise<number> {
  const readClient = new DodoPayments({ bearerToken: process.env.DODO_API_KEY_READONLY });
  const entitlement = await readClient.creditEntitlementBalances.retrieve(reserveRef);
  return entitlement.balance; // UNVERIFIED field name — confirm against the real response
}
```

**Unverified — confirm before finalizing.** The SDK's generated method/field names may differ from the sketch above. Call the real API, read the real response shape, and use what you find. Record the real shape in `docs/OUTCOME.md`. If the SDK doesn't expose this cleanly, fall back to a direct `fetch()` against the REST endpoint with the bearer token.

## `draw()` — deduct on spend

```ts
async function draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void> {
  await client.creditEntitlements.deduct(reserveRef, {
    amount: amountInrPaise,
    idempotency_key: runId,
  });
}
```

**Unverified — confirm before finalizing.** No request-side idempotency-key parameter was confirmed on the checkout-session/payment-create endpoints as of 28 Jul 2026. `webhook-id` gives idempotency on the receiving side (webhooks), not necessarily on outbound create/deduct calls. Verify this directly against the current API reference or SDK types. If the SDK doesn't accept `idempotency_key`, implement a guard in `src/webcmd/executor.ts` instead: check whether `runId` already appears in `ledger.jsonl` before calling `draw()` at all. Do this check either way — belt and suspenders.

## `release()` — Phase 1, test mode

```ts
async function release(reserveRef: string): Promise<void> {
  // Test mode: no real money to return. A no-op is acceptable for Phase 1.
  // Optionally issue a test-mode refund via client.refunds.create({ payment_id: reserveRef })
  // if the demo should show a real refund webhook firing.
}
```

## Webhooks

Dodo follows the Standard Webhooks spec (`standardwebhooks.com`): HMAC SHA256, three headers (`webhook-id`, `webhook-signature`, `webhook-timestamp`), 8 retry attempts with exponential backoff.

```ts
import { Webhook } from 'standardwebhooks'; // or Dodo's own SDK unwrap() helper

const wh = new Webhook(process.env.DODO_WEBHOOK_SECRET!);

app.post('/webhooks/dodo', express.raw({ type: 'application/json' }), (req, res) => {
  const payload = wh.verify(req.body, req.headers); // throws if signature invalid
  const webhookId = req.headers['webhook-id']; // dedupe on this before acting
  switch (payload.type) {
    case 'payment.succeeded': /* mark reserve funded */ break;
    case 'payment.failed': /* mark funding failed, surface to demo UI */ break;
    case 'CreditLedgerEntry': /* optional: log to events.jsonl */ break;
    case 'dispute.opened': /* Phase 2 territory — log only in Phase 1 */ break;
  }
  res.sendStatus(200);
});
```

Use `dodo wh listen` for local development instead of writing a mock webhook sender.

## Test credentials — use these exact values

| Purpose | Value |
|---|---|
| UPI success | `success@upi` |
| UPI failure | `failure@upi` |
| Card success (India, Visa) | `4576238912771450`, exp `06/32`, CVV `123` |
| Card decline (India, Visa) | `4706131211212123` |

## Feature parity — test mode vs live mode

| Capability | Test mode | Live mode |
|---|---|---|
| Create products, checkout sessions, payment links | Yes | Yes |
| Simulate payments (cards, UPI, wallets) | Yes | No, real only |
| Webhooks fire | Yes | Yes |
| Refunds, transaction history | Yes (simulated) | Yes (real) |

Nothing this build needs is test-mode-restricted. There is no feature gap that justifies attempting live mode before the deadline.

## Rate limits

Tier 0 default: 40 req/s burst, 240 req/min sustained. Not a concern at demo scale — no throttling logic needed.

## Do not build

- A reimplementation of Dodo's own MCP server (`mcp.dodopayments.com/sse`) or Knowledge MCP
- A webhook simulator — `dodo wh trigger` already does this
- Any Identity/Business Verification or live-mode flow
- A subscription/recurring-mandate flow — the 48-hour settlement delay makes it unusable for a live demo; use Checkout Sessions

## Open questions — resolve before Phase 4, not blocking for Phase 1

1. Does `checkoutSessions.create()` / the payment-create endpoint accept a request-side idempotency key natively? Check the current API reference directly.
2. Confirm the exact field name Dodo's SDK returns for a Credit Entitlement Balance (`balance`? `available_credits`? `remaining`?) — read the actual JSON response once.
