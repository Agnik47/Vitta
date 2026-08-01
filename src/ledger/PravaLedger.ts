// PravaLedger implements Ledger using Prava's documented sandbox REST API.
// Verified from public Prava docs (2026-08-01): session creation returns `session_id` +
// `iframe_url`; mandates are listed by `customer_id`; a mandate returns decimal `remaining`;
// mandate charges accept an idempotent `reference`; and unused sessions can be revoked.
//
// Session creation does not document a resulting mandate id. This adapter therefore stores an
// opaque `prava-session:<sessionId>:<customerId>` reference. The customer id is unique to the
// Vitta mandate, so after passkey approval it can resolve the sole active Prava mandate via the
// documented list endpoint. Direct `mdt_...` references are also supported for manual attachment.
//
// Prava's Browser Harness currently documents Shopify, not Blinkit. draw() mints a one-time Prava
// credential but this repository cannot inject it into Blinkit's checkout; see README disclosure.
import type { Ledger } from './Ledger';

type FetchLike = typeof fetch;
interface PravaSession { session_id: string; iframe_url: string; }
interface PravaMandate { id: string; status: string; remaining: string; }
interface PravaListResponse { mandates: PravaMandate[]; }
interface PravaError { error?: { message?: string }; }
const SANDBOX_BASE_URL = 'https://sandbox.api.prava.space';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — required for PravaLedger. Check .env.`);
  return value;
}
function toMoney(paise: number): string {
  if (!Number.isInteger(paise) || paise <= 0) throw new Error('Prava amounts must be positive integer paise');
  return (paise / 100).toFixed(2);
}
function customerId(mandateId: string): string { return `vitta_${mandateId}`; }
function sessionRef(sessionId: string, userId: string): string { return `prava-session:${sessionId}:${userId}`; }
function parseSessionRef(ref: string): { sessionId: string; userId: string } | undefined {
  const match = /^prava-session:([^:]+):(.+)$/.exec(ref);
  return match ? { sessionId: match[1], userId: match[2] } : undefined;
}

export class PravaLedger implements Ledger {
  constructor(private readonly fetchImpl: FetchLike = fetch, private readonly baseUrl = process.env.PRAVA_API_BASE_URL || SANDBOX_BASE_URL) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init, headers: { Authorization: `Bearer ${requireEnv('PRAVA_SECRET_KEY')}`, ...(init.headers ?? {}) },
    });
    const body = await response.json() as T & PravaError;
    if (!response.ok) throw new Error(`Prava API ${init.method ?? 'GET'} ${path} failed: ${body.error?.message ?? `HTTP ${response.status}`}`);
    return body;
  }
  private async resolveMandate(reserveRef: string): Promise<string> {
    if (reserveRef.startsWith('mdt_')) return reserveRef;
    const session = parseSessionRef(reserveRef);
    if (!session) throw new Error(`Invalid Prava reserve reference: ${reserveRef}`);
    const result = await this.request<PravaListResponse>(`/v1/mandates?customer_id=${encodeURIComponent(session.userId)}&standing_only=true`);
    const active = result.mandates.filter((mandate) => mandate.status === 'active');
    if (active.length !== 1) throw new Error(`Prava session ${session.sessionId} has ${active.length} active mandates — passkey approval is not complete or the reserve is ambiguous`);
    return active[0].id;
  }
  async fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }> {
    const userId = customerId(mandateId); const amount = toMoney(amountInrPaise);
    const session = await this.request<PravaSession>('/v1/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        user_id: userId, user_email: requireEnv('PRAVA_USER_EMAIL'), total_amount: amount, currency: 'INR',
        purchase_context: [{ merchant_details: { name: 'Blinkit', url: 'https://blinkit.com', country_code_iso2: 'IN' }, product_details: [{ description: `Vitta mandate ${mandateId}`, unit_price: amount, quantity: 1 }] }],
        integration_type: 'full_checkout',
        mandate_setup: { intent: 'mandate_setup', recurring_frequency: 'one_time', merchant_scope: 'listed', max_charges: 1 },
        external_order_ref: mandateId, description: `Vitta spending mandate ${mandateId}`,
      }),
    });
    return { reserveRef: sessionRef(session.session_id, userId), checkoutUrl: session.iframe_url };
  }
  async balance(reserveRef: string): Promise<number> {
    const mandateId = await this.resolveMandate(reserveRef);
    const mandate = await this.request<PravaMandate>(`/v1/mandates/${encodeURIComponent(mandateId)}`);
    const remaining = Number(mandate.remaining);
    if (!Number.isFinite(remaining) || remaining < 0) throw new Error(`Prava mandate ${mandateId} returned an invalid remaining balance`);
    return Math.round(remaining * 100);
  }
  async draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void> {
    const mandateId = await this.resolveMandate(reserveRef);
    const result = await this.request<{ status: string; errorMessage?: string; credentials?: { token: string; dynamicCvv: string } }>(`/v1/mandates/${encodeURIComponent(mandateId)}/charge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: toMoney(amountInrPaise), reference: runId }),
    });
    if (result.status !== 'awaiting_result' || !result.credentials?.token || !result.credentials.dynamicCvv) throw new Error(`Prava did not issue a payment credential: ${result.errorMessage ?? result.status}`);
  }
  async release(reserveRef: string): Promise<void> {
    const session = parseSessionRef(reserveRef);
    if (!session) return;
    await this.request(`/v1/sessions/${encodeURIComponent(session.sessionId)}/revoke`, { method: 'POST' });
  }
  async credit(_reserveRef: string, _amountInrPaise: number, _idempotencyKey: string): Promise<void> {
    throw new Error('Prava does not document a credit/top-up API; create and approve a new mandate instead.');
  }
}
