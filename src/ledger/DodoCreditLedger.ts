// DodoCreditLedger implements Ledger — real Dodo test-mode API calls. See docs/02-DODO-INTEGRATION.md.
//
// Real API shapes verified against a live account (docs/OUTCOME.md Phase 1c/1h), not the spec's
// original sketch, which didn't match the actual installed SDK:
//   - No `creditEntitlementBalances.retrieve(reserveRef)` method exists. Balances are keyed by
//     (customer_id, credit_entitlement_id) via `client.creditEntitlements.balances.retrieve()`.
//   - draw() uses `client.creditEntitlements.balances.createLedgerEntry()`, not a `.deduct()`
//     method (which doesn't exist) — and it DOES accept a real `idempotency_key` param.
//   - `checkoutSessions.create()` returns `session_id`, not `session.id`.
//   - A checkout-session-shaped `reserveRef` resolves to a customer only via a second hop:
//     `session.payment_id -> payments.retrieve(payment_id).customer.customer_id`.
//   - `balance` is a JSON number on the wire, even though the SDK's own generated types declare
//     it a `string` — coerce explicitly, never trust the type alone.
//   - The `DodoPayments` client defaults to `environment: 'live_mode'` when unset. MUST pass
//     `'test_mode'` explicitly or every call silently hits the live host and fails there with a
//     generic 401 that looks like a bad key, not a wrong environment.
//
// Credits are 1:1 with INR paise (the Credit Entitlement was created with unit: "INR paise",
// precision: 0) — treat "credits" and "paise" as the same integer throughout, no conversion.
//
// fund() cannot complete a real payment itself — entering payment/card details is a prohibited
// agent action even in test mode. It creates the checkout session (real, instant, no payment
// needed) and returns immediately; a human completes the actual checkout out of band, exactly
// like the mandate's own "a human signs..." premise. balance()/draw()/release() are the parts
// fully exercisable by the agent once a session has been paid.
import DodoPayments from 'dodopayments';
import type { Ledger } from './Ledger';

// Read lazily, not as module-level consts — this module may be imported before whatever loads
// .env into process.env has run (import ordering, not env-loading order, would otherwise decide
// this silently). A clear error beats a confusing 422 from Dodo about a field that "looks" present.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — required for DodoCreditLedger. Check .env.`);
  return value;
}
const creditEntitlementId = () => requireEnv('DODO_CREDIT_ENTITLEMENT_ID');
const topupProductId = () => requireEnv('DODO_TOPUP_PRODUCT_ID');

function makeClient(bearerToken: string | undefined): DodoPayments {
  return new DodoPayments({ bearerToken, environment: 'test_mode' });
}

const writeClient = () => makeClient(process.env.DODO_API_KEY);
const readClient = () => makeClient(process.env.DODO_API_KEY_READONLY);

/** A mandate's `reserveRef` may be a checkout-session id (the shape `fund()` returns) or, once
 * resolved, a customer id directly. Resolves either to the real `customer_id` that
 * `balance()`/`draw()` need. */
async function resolveCustomerId(reserveRef: string): Promise<string> {
  if (reserveRef.startsWith('cus_')) return reserveRef;
  const session = await readClient().checkoutSessions.retrieve(reserveRef);
  if (!session.payment_id) {
    throw new Error(`Checkout session ${reserveRef} has no payment_id yet — funding not completed`);
  }
  const payment = await readClient().payments.retrieve(session.payment_id);
  const customerId = (payment as unknown as { customer?: { customer_id?: string } }).customer?.customer_id;
  if (!customerId) throw new Error(`Payment ${session.payment_id} has no resolvable customer_id`);
  return customerId;
}

export class DodoCreditLedger implements Ledger {
  async fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string }> {
    const session = await writeClient().checkoutSessions.create({
      product_cart: [
        {
          product_id: topupProductId(),
          quantity: 1,
          credit_entitlements: [{ credit_entitlement_id: creditEntitlementId(), credits_amount: String(amountInrPaise) }],
        },
      ],
      allowed_payment_method_types: ['upi_collect', 'credit', 'debit'],
      billing_currency: 'INR',
      // Same email every call — Dodo attaches the session to the existing customer it already
      // matches (per its own "email used to find an existing customer" behavior), so repeated
      // fund() calls reuse one real demo customer rather than creating a new one each time.
      customer: { email: 'demo@mandategate.local', name: 'Mandate Gate Demo', phone_number: '+919876543210' },
      billing_address: { country: 'IN', zipcode: '560001' },
      return_url: 'https://mandategate.local/funded',
      metadata: { mandate_id: mandateId },
    });
    return { reserveRef: session.session_id };
  }

  async balance(reserveRef: string): Promise<number> {
    const customerId = await resolveCustomerId(reserveRef);
    const result = await readClient().creditEntitlements.balances.retrieve(customerId, {
      credit_entitlement_id: creditEntitlementId(),
    });
    return Number(result.balance); // paise — coerced explicitly, see the wire-vs-SDK-type note above
  }

  async draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void> {
    const customerId = await resolveCustomerId(reserveRef);
    await writeClient().creditEntitlements.balances.createLedgerEntry(customerId, {
      credit_entitlement_id: creditEntitlementId(),
      amount: String(amountInrPaise),
      entry_type: 'debit',
      idempotency_key: runId,
    });
  }

  async release(_reserveRef: string): Promise<void> {
    // Test mode: no real money to return. A no-op is acceptable for Phase 1 — see docs/02-DODO-INTEGRATION.md.
  }
}
