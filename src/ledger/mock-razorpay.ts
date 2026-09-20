// An in-memory stand-in for the slice of Razorpay's test-mode API that RazorpayLedger uses. NOT part
// of the product: it exists so the ledger can be unit-tested and the sandbox can run the real gate
// end to end with no network and no keys. It models behaviour verified from Razorpay's docs:
//   • Basic auth with KEY_ID:KEY_SECRET; errors as { error: { code, description } }
//   • Orders: create / fetch / PATCH (notes replaced wholesale, max 15 keys) / fetch payments
//   • an Order's amount_paid is what has been CAPTURED (authorized money is not paid yet)
//   • capture requires an `authorized` payment and an amount EQUAL to the authorized amount
//   • refunds are partial or full and raise amount_refunded
// Two front ends over one model: a `fetch` fake (unit tests) and a local HTTP server (the sandbox,
// reached through RAZORPAY_API_BASE_URL, which RazorpayLedger already honours).
import http from 'node:http';

export const MOCK_KEY_ID = 'rzp_test_sandbox00000';
export const MOCK_KEY_SECRET = 'sandbox-key-secret';
const AUTH = `Basic ${Buffer.from(`${MOCK_KEY_ID}:${MOCK_KEY_SECRET}`).toString('base64')}`;

interface MockOrder {
  id: string;
  entity: 'order';
  amount: number;
  currency: string;
  receipt?: string;
  notes: Record<string, string | number | boolean>;
  created_at: number;
}

export interface MockPayment {
  id: string;
  entity: 'payment';
  amount: number;
  currency: 'INR';
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  amount_refunded: number;
  method: string;
  created_at: number;
}

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
}

export interface MockRazorpay {
  orders: Map<string, MockOrder>;
  payments: Map<string, MockPayment>;
  /** Every request received, in order. */
  requests: MockRequest[];
  /** Simulate the customer paying an order in Checkout. Returns the payment. */
  pay(orderId: string, opts?: { amountPaise?: number; status?: 'captured' | 'authorized' | 'failed' }): MockPayment;
  /** Make matching requests fail with HTTP 500 (outage / network-rejected simulation). */
  failWhen: ((req: MockRequest) => boolean) | undefined;
  handle(method: string, path: string, authorization: string | undefined, body: unknown): { status: number; json: unknown };
  /** Spent per the order's server-side note — what the ledger recorded on Razorpay. */
  spentPaise(orderId: string): number;
  /** Captured, net of refunds — what Razorpay itself says is held. */
  paidPaise(orderId: string): number;
}

let counter = 0;
const rid = (prefix: string): string => `${prefix}_SBX${(++counter).toString().padStart(6, '0')}${Math.random().toString(36).slice(2, 8)}`;

function err(status: number, description: string, code = 'BAD_REQUEST_ERROR') {
  return { status, json: { error: { code, description } } };
}

export function createMockRazorpay(): MockRazorpay {
  const orders = new Map<string, MockOrder>();
  const payments = new Map<string, MockPayment>();
  const requests: MockRequest[] = [];

  const orderPayments = (orderId: string) => [...payments.values()].filter((p) => p.order_id === orderId);
  const paid = (orderId: string) =>
    orderPayments(orderId).filter((p) => p.status === 'captured').reduce((s, p) => s + p.amount - p.amount_refunded, 0);
  const view = (o: MockOrder) => {
    const amount_paid = paid(o.id);
    const attempted = orderPayments(o.id).length > 0;
    return { ...o, amount_paid, amount_due: o.amount - amount_paid, attempts: orderPayments(o.id).length, status: amount_paid >= o.amount ? 'paid' : attempted ? 'attempted' : 'created' };
  };

  const self: MockRazorpay = {
    orders,
    payments,
    requests,
    failWhen: undefined,
    pay(orderId, opts = {}) {
      const order = orders.get(orderId);
      if (!order) throw new Error(`mock: no such order ${orderId}`);
      const payment: MockPayment = {
        id: rid('pay'),
        entity: 'payment',
        amount: opts.amountPaise ?? order.amount,
        currency: 'INR',
        status: opts.status ?? 'captured',
        order_id: orderId,
        amount_refunded: 0,
        method: 'card',
        created_at: Math.floor(Date.now() / 1000),
      };
      payments.set(payment.id, payment);
      return payment;
    },
    spentPaise: (orderId) => Number(orders.get(orderId)?.notes.vitta_spent_paise ?? 0),
    paidPaise: paid,
    handle(method, path, authorization, body) {
      const req = { method, path, body };
      requests.push(req);
      if (authorization !== AUTH) return err(401, 'Authentication failed', 'BAD_REQUEST_ERROR');
      if (self.failWhen?.(req)) return err(500, 'The sandbox is having a bad day', 'SERVER_ERROR');
      const b = (body ?? {}) as Record<string, unknown>;

      if (method === 'POST' && path === '/v1/orders') {
        if (!Number.isInteger(b.amount) || (b.amount as number) < 100) return err(400, 'Order amount less than minimum amount allowed');
        if (b.currency !== 'INR') return err(400, 'The currency is invalid');
        const notes = (b.notes ?? {}) as MockOrder['notes'];
        if (Object.keys(notes).length > 15) return err(400, 'Notes can have at most 15 key-value pairs');
        const order: MockOrder = { id: rid('order'), entity: 'order', amount: b.amount as number, currency: 'INR', receipt: b.receipt as string | undefined, notes, created_at: Math.floor(Date.now() / 1000) };
        orders.set(order.id, order);
        return { status: 200, json: view(order) };
      }

      const orderMatch = /^\/v1\/orders\/([^/]+)(\/payments)?$/.exec(path);
      if (orderMatch) {
        const order = orders.get(decodeURIComponent(orderMatch[1]));
        if (!order) return err(400, 'The id provided does not exist');
        if (method === 'GET' && orderMatch[2]) {
          const items = orderPayments(order.id);
          return { status: 200, json: { entity: 'collection', count: items.length, items } };
        }
        if (method === 'GET') return { status: 200, json: view(order) };
        if (method === 'PATCH') {
          const notes = b.notes as MockOrder['notes'] | undefined;
          if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return err(400, 'notes must be an object');
          if (Object.keys(notes).length > 15) return err(400, 'Notes can have at most 15 key-value pairs');
          order.notes = notes; // replaced, not merged — the ledger always sends the full set
          return { status: 200, json: view(order) };
        }
      }

      const payMatch = /^\/v1\/payments\/([^/]+)\/(capture|refund)$/.exec(path);
      if (payMatch && method === 'POST') {
        const payment = payments.get(decodeURIComponent(payMatch[1]));
        if (!payment) return err(400, 'The id provided does not exist');
        if (payMatch[2] === 'capture') {
          if (payment.status !== 'authorized') return err(400, 'This payment has already been captured');
          if (b.amount !== payment.amount) return err(400, 'The amount you are trying to capture differs from the authorised amount');
          if (b.currency !== 'INR') return err(400, 'The currency passed does not match the payment');
          payment.status = 'captured';
          return { status: 200, json: payment };
        }
        if (payment.status !== 'captured') return err(400, 'The payment has not been captured');
        const amount = Number(b.amount);
        if (!Number.isInteger(amount) || amount <= 0 || amount > payment.amount - payment.amount_refunded) return err(400, 'The refund amount is greater than the amount available for refund');
        payment.amount_refunded += amount;
        if (payment.amount_refunded === payment.amount) payment.status = 'refunded';
        return { status: 200, json: { id: rid('rfnd'), entity: 'refund', amount, payment_id: payment.id } };
      }
      return err(404, `mock: no such endpoint ${method} ${path}`, 'NOT_FOUND');
    },
  };
  return self;
}

/** A `fetch` replacement bound to a mock — hand it to `new RazorpayLedger(fetchFor(mock), env)`. */
export function mockFetch(mock: MockRazorpay, baseUrl = 'https://api.razorpay.com'): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (!String(input).startsWith(baseUrl)) throw new Error(`mock fetch: unexpected host ${url.origin}`);
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const { status, json } = mock.handle(init?.method ?? 'GET', url.pathname, headers.get('authorization') ?? undefined, body);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

export interface RunningMockRazorpay extends MockRazorpay {
  url: string;
  close(): Promise<void>;
}

/** The same model behind a local HTTP server — for the sandbox, where the gate runs as a child process. */
export async function startMockRazorpay(): Promise<RunningMockRazorpay> {
  const mock = createMockRazorpay();
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        res.writeHead(400).end(JSON.stringify({ error: { description: 'invalid json' } }));
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { status, json } = mock.handle(req.method ?? 'GET', url.pathname, req.headers.authorization, body);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return Object.assign(mock, {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
