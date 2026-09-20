// RazorpayLedger — implements Ledger against Razorpay TEST mode (Orders + Payments APIs).
//
// The mapping, and where it is honest about Razorpay not being a wallet:
//   fund     Creates a Razorpay Order. The human pays it in Razorpay Checkout (test card / UPI), which
//            makes the money REAL in Razorpay's test ledger. reserveRef = `razorpay-order:<order_id>`.
//   balance  What Razorpay says was actually captured on that order (net of refunds), minus what Vitta
//            has drawn. Uncaptured, failed or refunded payments never count.
//   draw     Razorpay has no API to pay a third-party merchant, so a draw is a Vitta-side debit against
//            the funded order. It is recorded twice — an append-only local log and the order's
//            server-side `notes` — and the balance uses the LARGER of the two spent figures, so
//            deleting the local file cannot give money back. Idempotent on runId.
//   release  Refunds the unspent captured amount back to the payer, after first zeroing the balance.
//   credit   Rejected. An order's amount is fixed and topping up means a new, human-paid order — an
//            agent must never be able to add money.
//
// Test mode only: a key that is not `rzp_test_…` is refused outright (CLAUDE.md hard rule 1).
// Zero dependencies — plain fetch with Basic auth, like the ledger it replaces; the official SDK
// would add a runtime dependency to a project that has none.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import type { Ledger } from './Ledger';

const DEFAULT_BASE_URL = 'https://api.razorpay.com';
export const RESERVE_REF_PREFIX = 'razorpay-order:';
const ORDER_ID_RE = /^order_[A-Za-z0-9]{6,40}$/;

type FetchLike = typeof fetch;
type Notes = Record<string, string | number | boolean>;

interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
  // The API returns `[]` (an empty array) when there are no notes.
  notes: Notes | unknown[];
}

interface RazorpayPayment {
  id: string;
  amount: number;
  status: string;
  order_id: string;
  amount_refunded?: number;
}

interface RazorpayError {
  error?: { code?: string; description?: string };
}

/** Where a customer completes the payment for an order: the dashboard's Checkout page. */
export function checkoutUrlFor(orderId: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = (env.RAZORPAY_CHECKOUT_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/pay/razorpay/${orderId}`;
}

export function reserveRefFor(orderId: string): string {
  return `${RESERVE_REF_PREFIX}${orderId}`;
}

export function parseReserveRef(reserveRef: string): string {
  if (reserveRef.startsWith(RESERVE_REF_PREFIX)) {
    const id = reserveRef.slice(RESERVE_REF_PREFIX.length);
    if (ORDER_ID_RE.test(id)) return id;
  }
  throw new Error(
    `Invalid Razorpay reserve reference "${reserveRef}" — expected razorpay-order:<order_id>. ` +
      'A mandate funded through an older rail has to be funded again with `gate fund`.',
  );
}

function asNotes(notes: RazorpayOrder['notes']): Notes {
  return Array.isArray(notes) ? {} : (notes as Notes);
}

function toPaise(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

// ---------------------------------------------------------------------------------------------
// The local debit log: append-only JSON lines, one file next to the other gate state.
// ---------------------------------------------------------------------------------------------

type LogEntry =
  | { kind: 'debit'; reserveRef: string; amountPaise: number; reference: string; ts: string }
  | { kind: 'void'; reserveRef: string; reference: string; ts: string };

export function ledgerLogPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.RAZORPAY_LEDGER_PATH ?? './razorpay-ledger.jsonl';
}

function readLog(file: string): LogEntry[] {
  if (!existsSync(file)) return [];
  const entries: LogEntry[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {
      // A torn/partial trailing line is ignored, never allowed to crash a balance read.
    }
  }
  return entries;
}

/** Live debits for one reserve: every debit that was not later voided. */
function liveDebits(entries: LogEntry[], reserveRef: string): Array<Extract<LogEntry, { kind: 'debit' }>> {
  const voided = new Set(entries.filter((e) => e.kind === 'void' && e.reserveRef === reserveRef).map((e) => e.reference));
  return entries.filter((e): e is Extract<LogEntry, { kind: 'debit' }> => e.kind === 'debit' && e.reserveRef === reserveRef && !voided.has(e.reference));
}

const LOCK_RETRIES = 100;
const LOCK_WAIT_MS = 50;
const LOCK_STALE_MS = 30_000;

async function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  for (let attempt = 0; ; attempt++) {
    try {
      // mkdir is atomic: exactly one caller creates it.
      mkdirSync(lock);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true });
      } catch {
        // lock vanished between the checks — just retry
      }
      if (attempt >= LOCK_RETRIES) throw new Error('Could not acquire the Razorpay ledger lock — another draw is in progress.');
      await new Promise((r) => setTimeout(r, LOCK_WAIT_MS));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------

export class RazorpayLedger implements Ledger {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  private get baseUrl(): string {
    return (this.env.RAZORPAY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private authHeader(): string {
    // RAZORPAY_TEST_API / RAZORPAY_TEST_SECRET are accepted as aliases for the key pair.
    const keyId = this.env.RAZORPAY_KEY_ID || this.env.RAZORPAY_TEST_API;
    const keySecret = this.env.RAZORPAY_KEY_SECRET || this.env.RAZORPAY_TEST_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set — required for RazorpayLedger. Check .env.');
    }
    // Hard rule: test mode only. A live key is refused before a single request is made.
    if (!keyId.startsWith('rzp_test_')) {
      throw new Error('RAZORPAY_KEY_ID is not a test-mode key (expected rzp_test_…). Vitta only runs against Razorpay test mode.');
    }
    return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: this.authHeader(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new Error(`Razorpay API ${method} ${path} returned a non-JSON response (HTTP ${response.status})`);
    }
    if (!response.ok) {
      const description = (parsed as RazorpayError).error?.description;
      throw new Error(`Razorpay API ${method} ${path} failed: ${description ?? `HTTP ${response.status}`}`);
    }
    return parsed as T;
  }

  private fetchOrder(orderId: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>('GET', `/v1/orders/${encodeURIComponent(orderId)}`);
  }

  private async fetchPayments(orderId: string): Promise<RazorpayPayment[]> {
    const result = await this.request<{ items?: RazorpayPayment[] }>('GET', `/v1/orders/${encodeURIComponent(orderId)}/payments`);
    return Array.isArray(result.items) ? result.items : [];
  }

  /** Only orders Vitta itself created are reserves. Any other order is refused, so a `--reserve-ref`
   *  typo (or someone else's order) can never be attached as spendable money. */
  private assertVittaOrder(order: RazorpayOrder): Notes {
    const notes = asNotes(order.notes);
    if (typeof notes.vitta_mandate_id !== 'string' || !notes.vitta_mandate_id) {
      throw new Error(`Razorpay order ${order.id} was not created by Vitta (no vitta_mandate_id note) — refusing to treat it as a reserve.`);
    }
    return notes;
  }

  /** Money actually received and still held: captured payments net of refunds, never more than the
   *  order itself reports paid. Authorized-but-uncaptured, failed and refunded payments are worth 0. */
  private paidPaise(order: RazorpayOrder, payments: RazorpayPayment[]): number {
    const captured = payments
      .filter((p) => p.status === 'captured')
      .reduce((sum, p) => sum + Math.max(0, toPaise(p.amount) - toPaise(p.amount_refunded)), 0);
    return Math.min(captured, toPaise(order.amount_paid));
  }

  private spentPaise(reserveRef: string, notes: Notes): number {
    const local = liveDebits(readLog(ledgerLogPath(this.env)), reserveRef).reduce((s, e) => s + e.amountPaise, 0);
    const remote = toPaise(notes.vitta_spent_paise);
    // The larger figure wins: whichever record knows about more spending is the one to believe.
    return Math.max(local, remote);
  }

  // ---- Ledger ---------------------------------------------------------------------------------

  async fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }> {
    if (!Number.isInteger(amountInrPaise) || amountInrPaise < 100) {
      throw new Error('Razorpay amounts are integer paise, minimum 100 (₹1).');
    }
    const order = await this.request<RazorpayOrder>('POST', '/v1/orders', {
      amount: amountInrPaise,
      currency: 'INR',
      // receipt is capped at 40 chars and should be unique: mandate id + a time suffix.
      receipt: `${mandateId}-${Date.now().toString(36)}`.slice(0, 40),
      notes: { vitta_mandate_id: mandateId, vitta_spent_paise: '0' },
    });
    if (!ORDER_ID_RE.test(order.id ?? '')) throw new Error('Razorpay returned an order without a usable id.');
    return { reserveRef: reserveRefFor(order.id), checkoutUrl: checkoutUrlFor(order.id, this.env) };
  }

  async balance(reserveRef: string): Promise<number> {
    const orderId = parseReserveRef(reserveRef);
    const order = await this.fetchOrder(orderId);
    const notes = this.assertVittaOrder(order);
    if (notes.vitta_released === '1') return 0;
    const payments = await this.fetchPayments(orderId);
    return Math.max(0, this.paidPaise(order, payments) - this.spentPaise(reserveRef, notes));
  }

  async draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void> {
    const orderId = parseReserveRef(reserveRef);
    if (!Number.isInteger(amountInrPaise) || amountInrPaise <= 0) throw new Error('Razorpay draw amounts must be positive integer paise.');
    if (!runId || runId.length > 200) throw new Error('A draw needs a runId (its idempotency key).');
    const file = ledgerLogPath(this.env);

    await withLock(file, async () => {
      // Idempotent on runId: a replayed draw is a no-op, never a second debit.
      if (liveDebits(readLog(file), reserveRef).some((e) => e.reference === runId)) return;

      const order = await this.fetchOrder(orderId);
      const notes = this.assertVittaOrder(order);
      if (notes.vitta_released === '1') throw new Error(`Razorpay reserve ${orderId} has been released — nothing left to draw.`);
      const payments = await this.fetchPayments(orderId);
      const spent = this.spentPaise(reserveRef, notes);
      const available = this.paidPaise(order, payments) - spent;
      if (amountInrPaise > available) {
        throw new Error(`Insufficient Razorpay reserve: ₹${(amountInrPaise / 100).toFixed(2)} requested, ₹${(Math.max(0, available) / 100).toFixed(2)} available.`);
      }

      // Local record first: if anything below fails, the money is treated as spent (fail closed),
      // and only voided again if we can positively say the remote write did not happen.
      appendFileSync(file, JSON.stringify({ kind: 'debit', reserveRef, amountPaise: amountInrPaise, reference: runId, ts: new Date().toISOString() } satisfies LogEntry) + '\n');
      try {
        await this.request<RazorpayOrder>('PATCH', `/v1/orders/${encodeURIComponent(orderId)}`, {
          notes: { ...notes, vitta_spent_paise: String(spent + amountInrPaise), vitta_last_ref: runId.slice(0, 100) },
        });
      } catch (err) {
        appendFileSync(file, JSON.stringify({ kind: 'void', reserveRef, reference: runId, ts: new Date().toISOString() } satisfies LogEntry) + '\n');
        throw new Error(`Could not record the draw on Razorpay (${(err as Error).message}) — nothing was drawn.`);
      }
    });
  }

  async release(reserveRef: string): Promise<void> {
    const orderId = parseReserveRef(reserveRef);
    const order = await this.fetchOrder(orderId);
    const notes = this.assertVittaOrder(order);
    if (notes.vitta_released === '1') return;
    const payments = await this.fetchPayments(orderId);
    const paid = this.paidPaise(order, payments);
    const unspent = Math.max(0, paid - this.spentPaise(reserveRef, notes));

    // Zero the reserve BEFORE refunding: if the refund then fails, the money is stuck (safe, and
    // refundable by hand in the Razorpay dashboard) rather than refunded AND still spendable.
    await this.request<RazorpayOrder>('PATCH', `/v1/orders/${encodeURIComponent(orderId)}`, {
      notes: { ...notes, vitta_released: '1', vitta_spent_paise: String(Math.max(paid, toPaise(notes.vitta_spent_paise))) },
    });

    let remaining = unspent;
    for (const p of payments.filter((x) => x.status === 'captured')) {
      if (remaining <= 0) break;
      const refundable = Math.max(0, toPaise(p.amount) - toPaise(p.amount_refunded));
      const amount = Math.min(remaining, refundable);
      if (amount <= 0) continue;
      await this.request('POST', `/v1/payments/${encodeURIComponent(p.id)}/refund`, { amount, notes: { vitta_reason: 'reserve released', vitta_order: orderId } });
      remaining -= amount;
    }
  }

  async credit(_reserveRef: string, _amountInrPaise: number, _idempotencyKey: string): Promise<void> {
    throw new Error('A Razorpay order has a fixed amount and cannot be topped up. Create a new order with `gate fund` — a human-paid step an agent can never take.');
  }

  // ---- Razorpay-specific (not on the Ledger interface) -----------------------------------------

  /** Who this reserve belongs to — the mandate id stamped on the order when Vitta created it. */
  async reserveOwner(reserveRef: string): Promise<string> {
    const order = await this.fetchOrder(parseReserveRef(reserveRef));
    return String(this.assertVittaOrder(order).vitta_mandate_id);
  }

  /** Captures any payment on this order that is `authorized` but not yet `captured` (accounts on
   *  manual capture). Razorpay refunds authorized payments left uncaptured, so a human-confirmed
   *  funding step completes them. Idempotent: captured payments are skipped. */
  async settle(reserveRef: string): Promise<{ captured: string[] }> {
    const orderId = parseReserveRef(reserveRef);
    const captured: string[] = [];
    for (const p of await this.fetchPayments(orderId)) {
      if (p.status !== 'authorized') continue;
      // Razorpay requires the capture amount to equal the authorized amount, exactly.
      await this.request('POST', `/v1/payments/${encodeURIComponent(p.id)}/capture`, { amount: p.amount, currency: 'INR' });
      captured.push(p.id);
    }
    return { captured };
  }
}
