import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiscoveryAgent,
  dashboardProviders,
  normalizeDashboardProduct,
  normalizeWebcmdRow,
  parseAvailability,
  webcmdProviders,
  type DiscoveryDeps,
  type ProviderResult,
} from './discovery';
import type { Candidate, MerchantId, ShoppingIntent } from './protocol';
import { newCorrelation } from './a2a';
import type { CliResult } from '../agent/gate-spawn';

const intent: ShoppingIntent = {
  raw_request: 'x',
  product_query: 'atta 2kg',
  category: 'groceries',
  quantity: 1,
  purchase_required: true,
  preferred_merchants: [],
  source: 'user',
};

function cand(merchant: MerchantId, price: number): Candidate {
  return { merchant, product_name: 'Aashirvaad Atta 2kg', price_inr: price, availability: true, source: 'fake' };
}

const ok = (merchant: MerchantId, price: number): ProviderResult => ({ ok: true, source: 'fake', candidates: [cand(merchant, price)] });
const fail = (error: string, source = 'fake'): ProviderResult => ({ ok: false, source, candidates: [], error });
const never = () => Promise.reject(new Error('product() not expected'));

async function run(deps: DiscoveryDeps, i: ShoppingIntent = intent) {
  return createDiscoveryAgent(deps)({ vitta: 1, correlation: newCorrelation(), input: { intent: i } });
}

test('normalizes each merchant’s real webcmd row shape', () => {
  const blinkit = normalizeWebcmdRow('blinkit', { productId: '42', name: 'Amul Milk', price: 68, available: true, url: 'https://blinkit.com/p/42' });
  assert.deepEqual(blinkit, { merchant: 'blinkit', product_name: 'Amul Milk', price_inr: 68, availability: true, product_url: 'https://blinkit.com/p/42', product_id: '42', source: 'webcmd' });

  const zepto = normalizeWebcmdRow('zepto', { product_id: 'z1', title: 'Atta 2kg', price: 229, availability: '', url: 'https://www.zeptonow.com/pn/x' });
  assert.equal(zepto?.product_name, 'Atta 2kg');
  assert.equal(zepto?.availability, true); // blank availability = in stock (only exceptions are flagged)

  const oos = normalizeWebcmdRow('bigbasket', { product_id: '9', title: 'Eggs', price: 90, availability: 'Out of stock' });
  assert.equal(oos?.availability, false);
});

test('a row with no real name or price is dropped, never defaulted', () => {
  assert.equal(normalizeWebcmdRow('zepto', { title: 'No price' }), undefined);
  assert.equal(normalizeWebcmdRow('zepto', { title: 'Zero', price: 0 }), undefined);
  assert.equal(normalizeWebcmdRow('zepto', { price: 100 }), undefined);
  assert.equal(normalizeDashboardProduct({ merchant: 'zepto', name: '', priceInr: 10 }, 'anakin'), undefined);
});

test('a non-http product URL is not carried onto a candidate', () => {
  const c = normalizeWebcmdRow('zepto', { product_id: 'z', title: 'T', price: 5, url: 'javascript:alert(1)' });
  assert.equal(c?.product_url, undefined);
});

test('availability parsing', () => {
  assert.equal(parseAvailability(true), true);
  assert.equal(parseAvailability(''), true);
  assert.equal(parseAvailability('Out of stock'), false);
  assert.equal(parseAvailability('In stock'), true);
  assert.equal(parseAvailability('mystery'), false);
  assert.equal(parseAvailability(undefined), false);
});

test('searches all three merchants and returns their candidates', async () => {
  const r = await run({ search: async (m) => ok(m, 200), product: never });
  assert.ok(r.ok);
  if (r.ok) {
    const data = r.data as { candidates: Candidate[] };
    assert.deepEqual(data.candidates.map((c) => c.merchant), ['bigbasket', 'blinkit', 'zepto']);
    assert.equal(r.steps.filter((s) => s.name.startsWith('search:')).length, 3);
  }
});

test('preferred merchants narrow the search', async () => {
  const asked: string[] = [];
  await run({ search: async (m) => { asked.push(m); return ok(m, 1); }, product: never }, { ...intent, preferred_merchants: ['zepto'] });
  assert.deepEqual(asked, ['zepto']);
});

test('one merchant failing is reported, not fatal, while others succeed', async () => {
  const r = await run({ search: async (m) => (m === 'blinkit' ? fail('spawn webcmd ENOENT', 'webcmd') : ok(m, 250)), product: never });
  assert.ok(r.ok);
  if (r.ok) {
    const data = r.data as { candidates: Candidate[]; merchant_errors: Array<{ merchant: string; error: string }> };
    assert.equal(data.candidates.length, 2);
    assert.deepEqual(data.merchant_errors, [{ merchant: 'blinkit', error: 'spawn webcmd ENOENT', source: 'webcmd' }]);
  }
});

test('every merchant failing is a DISCOVERY_ERROR; an Anakin failure is classified ANAKIN_ERROR', async () => {
  const all = await run({ search: async () => fail('webcmd exploded'), product: never });
  assert.equal(all.ok, false);
  if (!all.ok) assert.equal(all.error.code, 'DISCOVERY_ERROR');

  const anakin = await run({ search: async () => fail('Anakin HTTP 402', 'anakin'), product: never });
  assert.equal(anakin.ok, false);
  if (!anakin.ok) {
    assert.equal(anakin.error.code, 'ANAKIN_ERROR');
    assert.match(anakin.error.message, /402/); // the original reason survives
  }
});

test('merchants that answer with nothing → NO_PRODUCTS_FOUND', async () => {
  const r = await run({ search: async () => ({ ok: true, source: 'fake', candidates: [] }), product: never });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'NO_PRODUCTS_FOUND');
});

test('a provider that throws is contained as that merchant’s failure', async () => {
  const r = await run({ search: async (m) => { if (m === 'zepto') throw new Error('boom'); return ok(m, 1); }, product: never });
  assert.ok(r.ok);
});

test('a pinned intent (Price Sniper) looks up that one product and does not search', async () => {
  let searched = false;
  const r = await run(
    { search: async () => { searched = true; return ok('blinkit', 1); }, product: async (m, id) => ({ ok: true, source: 'webcmd', candidates: [{ ...cand(m, 240), product_id: id }] }) },
    { ...intent, pinned: { merchant: 'blinkit', product_id: 'bk-1' } },
  );
  assert.ok(r.ok);
  assert.equal(searched, false);
  if (r.ok) assert.equal((r.data as { candidates: Candidate[] }).candidates[0].product_id, 'bk-1');
});

test('rejects an input with no valid intent', async () => {
  const r = await createDiscoveryAgent({ search: async () => ok('zepto', 1), product: never })({ vitta: 1, correlation: newCorrelation(), input: {} });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'INVALID_REQUEST');
});

test('webcmd provider parses the search CLI’s JSON and reports its failures faithfully', async () => {
  const cli = (stdout: string, stderr = ''): Promise<CliResult> => Promise.resolve({ ok: true, stdout, stderr, exitCode: 0, timedOut: false });
  const good = webcmdProviders(() => cli(JSON.stringify({ ok: true, rows: [{ product_id: 'z', title: 'Atta 2kg', price: 229, availability: '' }] })));
  const result = await good.search('zepto', 'atta');
  assert.ok(result.ok);
  assert.equal(result.candidates[0].price_inr, 229);

  const authFail = webcmdProviders(() => cli(JSON.stringify({ ok: false, message: 'not logged in' })));
  const failed = await authFail.search('blinkit', 'atta');
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'not logged in');

  const garbage = await webcmdProviders(() => cli('<html>')).search('zepto', 'atta');
  assert.equal(garbage.ok, false);
});

test('dashboard provider reads the Anakin-first search response and keeps the real source', async () => {
  const fetchImpl = (async (url: string | URL | Request) => {
    assert.match(String(url), /\/api\/shop\/search\?q=atta&merchant=zepto$/);
    return new Response(
      JSON.stringify({ ok: true, results: [{ merchant: 'zepto', ok: true, source: 'anakin', products: [{ merchant: 'zepto', name: 'Atta 2kg', priceInr: 229, available: true, url: 'https://www.zeptonow.com/pn/a' }] }] }),
      { status: 200 },
    );
  }) as typeof fetch;
  const result = await dashboardProviders('http://dash.local/', fetchImpl).search('zepto', 'atta');
  assert.ok(result.ok);
  assert.equal(result.source, 'anakin');
  assert.equal(result.candidates[0].source, 'anakin');
  assert.equal(result.candidates[0].price_inr, 229);
});

test('dashboard provider surfaces a merchant-level failure (e.g. Anakin 402) rather than an empty list', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ ok: true, results: [{ merchant: 'zepto', ok: false, source: 'anakin', products: [], error: 'Anakin HTTP 402' }] }), { status: 200 })) as unknown as typeof fetch;
  const result = await dashboardProviders('http://dash.local', fetchImpl).search('zepto', 'atta');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Anakin HTTP 402');
  assert.equal(result.source, 'anakin');
});

test('a merchant that never answers times out on its own and the other merchants still carry the hop', async () => {
  // Nasiko cuts an agent call off at 60s; one slow scrape must cost only that merchant, not the hop.
  const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('merchant=zepto')) {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
    }
    const merchant = String(url).includes('merchant=bigbasket') ? 'bigbasket' : 'blinkit';
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true, results: [{ merchant, ok: true, source: 'anakin', products: [{ merchant, name: 'Atta 2kg', priceInr: 229, available: true, url: `https://x/${merchant}` }] }] }), { status: 200 }),
    );
  }) as typeof fetch;

  const slow = await dashboardProviders('http://dash.local', fetchImpl, undefined, 40).search('zepto', 'atta');
  assert.equal(slow.ok, false);
  assert.match(slow.error ?? '', /no answer from the dashboard within/);

  const r = await run(dashboardProviders('http://dash.local', fetchImpl, undefined, 40));
  assert.ok(r.ok);
  if (r.ok) {
    const data = r.data as { candidates: Array<{ merchant: string }>; merchant_errors: Array<{ merchant: string; error: string }> };
    assert.deepEqual(data.candidates.map((c) => c.merchant).sort(), ['bigbasket', 'blinkit']);
    assert.deepEqual(data.merchant_errors.map((e) => e.merchant), ['zepto']);
  }
});

test('dashboard provider reports an unreachable dashboard', async () => {
  const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
  const result = await dashboardProviders('http://dash.local', fetchImpl).search('zepto', 'atta');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /ECONNREFUSED/);
});
