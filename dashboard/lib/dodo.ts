// Read-only Dodo balance lookup for the mandate summary page. Server-side only — this file must
// never be imported by a client component, and only ever reads DODO_API_KEY_READONLY, never the
// write key. See docs/06-DASHBOARD-SPEC.md § API routes.
//
// UNVERIFIED AGAINST A REAL ACCOUNT as of 2026-07-29 (blocker B-001 — no Dodo test-mode account
// exists yet). Written against the real `dodopayments` SDK's actual TypeScript types (verified by
// reading node_modules/dodopayments directly), NOT the spec sketch in docs/02-DODO-INTEGRATION.md,
// which turned out to not match the real SDK shape at all:
//   - There is no `creditEntitlementBalances.retrieve(reserveRef)` method. Balances are keyed by
//     (customer_id, credit_entitlement_id) via `client.creditEntitlements.balances.retrieve()`.
//   - `checkoutSessions.create()` returns `session_id`, not `session.id`.
//   - Resolving a checkout session to a customer requires a second hop through the payment:
//     session.payment_id -> client.payments.retrieve(payment_id).customer.customer_id.
// Full writeup in docs/OUTCOME.md's "Running list of open questions resolved" table. Once B-001
// clears, whatever `Ledger.fund()` (Phase 1c) actually stores as `reserveRef` should be re-checked
// against `resolveCustomerId()` below — it defensively handles either a customer id or a checkout
// session id, since Phase 1c's exact convention isn't decided yet.
import DodoPayments from 'dodopayments';

let client: DodoPayments | null = null;
function getClient(): DodoPayments {
  if (!client) client = new DodoPayments({ bearerToken: process.env.DODO_API_KEY_READONLY });
  return client;
}

async function resolveCustomerId(reserveRef: string): Promise<string> {
  if (reserveRef.startsWith('cus_')) return reserveRef; // already a customer id
  // Otherwise assume it's a checkout session id and resolve the real chain: session -> payment -> customer.
  const session = await getClient().checkoutSessions.retrieve(reserveRef);
  if (!session.payment_id) throw new Error('Checkout session has no payment_id yet (not completed)');
  const payment = await getClient().payments.retrieve(session.payment_id);
  const customerId = (payment as unknown as { customer?: { customer_id?: string } }).customer?.customer_id;
  if (!customerId) throw new Error('Payment has no resolvable customer_id');
  return customerId;
}

export interface ReserveBalance {
  balanceInr: number;
  available: true;
}

export interface ReserveBalanceUnavailable {
  available: false;
  reason: string;
}

/** Balance is stored as INR paise, same convention as the rest of the ledger (Ledger.fund(mandateId,
 * amountInrPaise)) — this is an assumption, not yet confirmed against a real entitlement's `unit`
 * config, since that requires the real account this is blocked on. */
export async function getReserveBalance(reserveRef: string): Promise<ReserveBalance | ReserveBalanceUnavailable> {
  const creditEntitlementId = process.env.DODO_CREDIT_ENTITLEMENT_ID;
  if (!process.env.DODO_API_KEY_READONLY || !creditEntitlementId) {
    return { available: false, reason: 'Dodo not yet configured (missing DODO_API_KEY_READONLY or DODO_CREDIT_ENTITLEMENT_ID)' };
  }
  try {
    const customerId = await resolveCustomerId(reserveRef);
    const balance = await getClient().creditEntitlements.balances.retrieve(customerId, {
      credit_entitlement_id: creditEntitlementId,
    });
    return { available: true, balanceInr: Number(balance.balance) / 100 };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : 'Unknown error reading Dodo balance' };
  }
}
