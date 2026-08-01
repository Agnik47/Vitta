import assert from 'node:assert/strict';
import test from 'node:test';
import { PravaLedger } from './PravaLedger';

const savedEnv = { ...process.env };
function useEnv(): void { process.env.PRAVA_SECRET_KEY = 'sk_test_x'; process.env.PRAVA_USER_EMAIL = 'demo@example.com'; }
function restoreEnv(): void { for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, savedEnv); }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

test('fund creates a Prava mandate setup session', async () => {
  useEnv(); let request: Request | undefined;
  const ledger = new PravaLedger(async (input, init) => { request = new Request(input, init); return json({ session_id: 'sess_1', iframe_url: 'https://checkout.prava.space/s/sess_1' }, 201); });
  const result = await ledger.fund('mnd_1', 80000);
  assert.equal(result.reserveRef, 'prava-session:sess_1:vitta_mnd_1');
  assert.equal(result.checkoutUrl, 'https://checkout.prava.space/s/sess_1');
  assert.deepEqual(await request!.json(), {
    user_id: 'vitta_mnd_1', user_email: 'demo@example.com', total_amount: '800.00', currency: 'INR',
    purchase_context: [{ merchant_details: { name: 'Blinkit', url: 'https://blinkit.com', country_code_iso2: 'IN' }, product_details: [{ description: 'Vitta mandate mnd_1', unit_price: '800.00', quantity: 1 }] }],
    integration_type: 'full_checkout', mandate_setup: { intent: 'mandate_setup', recurring_frequency: 'one_time', merchant_scope: 'listed', max_charges: 1 }, external_order_ref: 'mnd_1', description: 'Vitta spending mandate mnd_1',
  });
  restoreEnv();
});

test('balance resolves an approved Prava mandate and fails clearly while approval is pending', async () => {
  useEnv();
  const responses = [json({ mandates: [{ id: 'mdt_1', status: 'active', remaining: '123.45' }] }), json({ id: 'mdt_1', status: 'active', remaining: '123.45' })];
  const ledger = new PravaLedger(async () => responses.shift()!);
  assert.equal(await ledger.balance('prava-session:sess_1:vitta_mnd_1'), 12345);
  const pending = new PravaLedger(async () => json({ mandates: [] }));
  await assert.rejects(() => pending.balance('prava-session:sess_1:vitta_mnd_1'), /passkey approval is not complete/);
  restoreEnv();
});

test('draw uses runId as Prava idempotency reference and propagates API failure', async () => {
  useEnv(); let chargeBody: unknown;
  const ledger = new PravaLedger(async (input, init) => {
    if (String(input).includes('/charge')) { chargeBody = await new Request(input, init).json(); return json({ status: 'awaiting_result', credentials: { token: '4111', dynamicCvv: '123' } }); }
    return json({ id: 'mdt_1', status: 'active', remaining: '100.00' });
  });
  await ledger.draw('mdt_1', 1200, 'run_1');
  assert.deepEqual(chargeBody, { amount: '12.00', reference: 'run_1' });
  const failing = new PravaLedger(async () => json({ error: { message: 'network rejected' } }, 503));
  await assert.rejects(() => failing.balance('mdt_1'), /network rejected/);
  restoreEnv();
});

test('release revokes a setup session and credit documents Prava limitation', async () => {
  useEnv(); let url = '';
  const ledger = new PravaLedger(async (input) => { url = String(input); return json({ success: true }); });
  await ledger.release('prava-session:sess_1:vitta_mnd_1');
  assert.match(url, /\/v1\/sessions\/sess_1\/revoke$/);
  await assert.rejects(() => ledger.credit('mdt_1', 100, 'topup'), /does not document a credit/);
  restoreEnv();
});
