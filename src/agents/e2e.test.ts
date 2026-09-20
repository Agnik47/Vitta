// End to end through the REAL gate. What is real: the four agents (over real HTTP A2A), PurchaseAgent,
// the spawned `gate` CLI, decide(), Ed25519 mandates/authorizations/receipts, the receipt chain,
// ledger.jsonl, RazorpayLedger's HTTP calls. What is simulated: the merchant (a fake `webcmd` on PATH)
// and Razorpay's servers (a local mock of Orders/Payments) — see sandbox/harness.ts. The fake webcmd logs every call, which
// is how these tests prove a denied purchase never reached the merchant's write command.
//
// Needs the compiled gate (`npm run build`; `npm test` runs it first via `pretest`).
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { createHttpCaller, createInProcessCaller } from './a2a';
import { runShoppingFlow } from './orchestrator';
import { createDiscoveryAgent, webcmdProviders } from './discovery';
import { createEvaluatorAgent } from './evaluator';
import { createPlannerAgent } from './planner';
import { createPurchaseAgent } from './purchase';
import { AGENT_DEFS, agentCard, resolveEndpoints } from './registry';
import { startAgent } from './serve';
import { AGENT_NAMES, type AgentHandler, type AgentName, type Candidate, type Proposal, type PurchaseOutcome, type ShoppingIntent } from './protocol';
import { newCorrelation } from './a2a';
import { DEMO_MANDATE, createSandbox, sandboxSupported, type Sandbox } from './sandbox/harness';
import { CATALOG } from './sandbox/fake-webcmd';
import { runSearch } from '../agent/gate-spawn';
import { getOrCreateKeyPair } from '../cli/keys';
import { loadMandate, saveMandate } from '../cli/store';
import { sign } from '../mandate/sign';

const skip = sandboxSupported() ? false : 'sandbox needs a POSIX shell shim for webcmd';

function handlers(): Record<AgentName, AgentHandler> {
  return {
    'vitta-shopping-planner': createPlannerAgent(),
    'vitta-deal-discovery': createDiscoveryAgent(webcmdProviders()),
    'vitta-deal-evaluator': createEvaluatorAgent(),
    'vitta-purchase-agent': createPurchaseAgent(),
  };
}

const zeptoAtta = CATALOG.zepto[0];
const zeptoPremium = CATALOG.zepto[1];

function candidateFrom(p: (typeof CATALOG)['zepto'][number]): Candidate {
  return { merchant: 'zepto', product_name: p.name, price_inr: p.price, availability: true, product_url: p.url, product_id: p.id, source: 'sandbox' };
}

function proposalFor(p: (typeof CATALOG)['zepto'][number], why: string): Proposal {
  return { proposed_action: 'purchase', selected: candidateFrom(p), quantity: 1, expected_total_inr: p.price, reason: why, considered: 1, rejected: [] };
}

const intent: ShoppingIntent = {
  raw_request: 'buy atta',
  product_query: 'atta 2kg',
  category: 'groceries',
  quantity: 1,
  purchase_required: true,
  preferred_merchants: [],
  source: 'user',
};

async function purchase(requestId: string, proposal: Proposal, mandateId?: string) {
  return createPurchaseAgent()({ vitta: 1, correlation: newCorrelation({ requestId, mandateId }), input: { intent, proposal, mode: 'TEST', mandate_id: mandateId } });
}

const gateEvents = (sb: Sandbox) =>
  existsSync(path.join(sb.dir, 'events.jsonl'))
    ? readFileSync(path.join(sb.dir, 'events.jsonl'), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { verdict: string; code?: string; command: string; amount_inr?: number })
    : [];
const dirCount = (sb: Sandbox, name: string) => (existsSync(path.join(sb.dir, name)) ? readdirSync(path.join(sb.dir, name)).filter((f) => f.endsWith('.json')).length : 0);
const placedOrders = (sb: Sandbox) => sb.webcmdCalls().filter((argv) => argv[1] === 'place-order');

describe('the four agents over the real gate', { skip }, () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await createSandbox(DEMO_MANDATE);
  });
  afterEach(async () => {
    await sb.cleanup();
  });

  // ---- the positive demo ---------------------------------------------------------------------

  test('DEMO 1 — cheapest 2kg atta: Planner → Discovery → Evaluator picks Zepto ₹229 → Vitta ALLOWs → receipt, reserve ₹800→₹571', async () => {
    const record = await runShoppingFlow({ request: 'Find me the cheapest 2kg atta and buy it', mode: 'TEST', mandateId: sb.mandateId }, { caller: createInProcessCaller(handlers()), save: () => {} });

    assert.equal(record.status, 'PURCHASED', JSON.stringify(record.error));
    assert.equal(record.proposal?.selected?.merchant, 'zepto');
    assert.equal(record.proposal?.selected?.price_inr, 229);
    const o = record.outcome as PurchaseOutcome;
    assert.equal(o.verdict, 'ALLOW');
    assert.equal(o.requested_amount_inr, 229);
    assert.equal(o.mandate_id, sb.mandateId);
    assert.match(o.receipt_id ?? '', /^rcp_/);
    assert.match(o.authorization_id ?? '', /^auth_/);
    assert.ok(o.run_id, 'the gate’s own run id is read back from the signed receipt');

    // Money: exactly one charge, of exactly the cart total, keyed by the gate's run id.
    assert.deepEqual(sb.debits(), [{ amount: 229, reference: o.run_id! }]);
    assert.equal(sb.remainingInr(), 571);
    // TEST mode never drives the merchant's checkout.
    assert.equal(placedOrders(sb).length, 0);
    // The receipt chain the gate wrote verifies.
    assert.equal(dirCount(sb, 'receipts'), 1);
    const verify = await sb.gate(['verify', o.receipt_id!]);
    assert.match(verify.stdout, /signature valid · chain intact/);
    // The same run is visible to a UI: every stage done, span per stage.
    assert.ok(record.stages.every((s) => s.status === 'done' && s.span_id));
  });

  test('DEMO 1 over real HTTP A2A servers (each agent on its own port), one trace id end to end', async () => {
    const running = await Promise.all(AGENT_NAMES.map((n) => startAgent(AGENT_DEFS[n], handlers()[n], { port: 0 })));
    try {
      const endpoints = Object.fromEntries(running.map((r) => [r.name, { agent: r.name, url: r.url }])) as ReturnType<typeof resolveEndpoints>['endpoints'];
      const record = await runShoppingFlow({ request: 'buy the cheapest 2kg atta under ₹300', mode: 'TEST' }, { caller: createHttpCaller(endpoints, { timeoutMs: 120_000 }), save: () => {} });
      assert.equal(record.status, 'PURCHASED', JSON.stringify(record.error));
      assert.equal(record.proposal?.selected?.merchant, 'zepto');
      // every agent published a card at the well-known path
      for (const r of running) {
        const card = (await (await fetch(`${r.url}/.well-known/agent-card.json`)).json()) as Record<string, unknown>;
        assert.equal(card.name, r.name);
        assert.deepEqual(card, agentCard(AGENT_DEFS[r.name], r.url));
      }
    } finally {
      await Promise.all(running.map((r) => new Promise<void>((res) => (r.server as Server).close(() => res()))));
    }
  });

  // ---- the negative demo ---------------------------------------------------------------------

  test('DEMO 2 — a misbehaving upstream agent proposes the ₹1,299 alternative: Vitta DENIES OVER_PER_TXN_CAP, the merchant is never asked to order, nothing is drawn', async () => {
    const r = await purchase('req_overspend', proposalFor(zeptoPremium, 'cheapest is out of stock; buying the ₹1,299 alternative'), sb.mandateId);

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'VITTA_DENIED');
    const o = r.error.details as PurchaseOutcome;
    assert.equal(o.status, 'DENIED');
    assert.equal(o.deny_code, 'OVER_PER_TXN_CAP');
    assert.equal(o.requested_amount_inr, 1299, 'the amount is the gate’s reading of the REAL cart, not the agent’s claim');
    assert.equal(o.allowed_amount_inr, 500);
    assert.equal(o.mandate_id, sb.mandateId);

    // The browser/merchant write never happened.
    assert.equal(placedOrders(sb).length, 0, 'place-order must never reach the merchant after a DENY');
    // No money moved, no receipt, no authorization (a DENY never gets one).
    assert.equal(sb.debits().length, 0);
    assert.equal(sb.remainingInr(), 800);
    assert.equal(dirCount(sb, 'receipts'), 0);
    assert.equal(dirCount(sb, 'authorizations'), 0);
    // The denial is on the record.
    const denies = gateEvents(sb).filter((e) => e.verdict === 'DENY');
    assert.equal(denies.length, 1);
    assert.equal(denies[0].code, 'OVER_PER_TXN_CAP');
    assert.equal(denies[0].command, 'zepto/place-order');
    assert.equal(denies[0].amount_inr, 1299);
  });

  test('DEMO 2 through the orchestrator: the flow ends DENIED with Vitta’s reason, not a generic failure', async () => {
    const h = handlers();
    // The Evaluator is compromised: whatever it is shown, it proposes the ₹1,299 item.
    h['vitta-deal-evaluator'] = async (req) => {
      const good = await createEvaluatorAgent()(req);
      if (!good.ok) return good;
      return { ...good, data: proposalFor(zeptoPremium, 'compromised evaluator') };
    };
    const record = await runShoppingFlow({ request: 'buy the cheapest 2kg atta', mode: 'TEST', mandateId: sb.mandateId }, { caller: createInProcessCaller(h), save: () => {} });
    assert.equal(record.status, 'DENIED');
    assert.equal(record.error?.code, 'VITTA_DENIED');
    assert.equal(record.outcome?.deny_code, 'OVER_PER_TXN_CAP');
    assert.equal(record.outcome?.requested_amount_inr, 1299);
    assert.equal(record.outcome?.allowed_amount_inr, 500);
    assert.equal(placedOrders(sb).length, 0);
    assert.equal(sb.debits().length, 0);
  });

  // ---- security guarantees -------------------------------------------------------------------

  test('SEC — expired mandate is denied EXPIRED, at the first gated write, nothing drawn', async () => {
    const m = loadMandate(sb.mandateId);
    const { sig, ...unsigned } = m;
    const { privateKey } = getOrCreateKeyPair('issuer');
    const expired = { ...unsigned, scope: { ...unsigned.scope, expires_at: new Date(Date.now() - 60_000).toISOString() } };
    saveMandate({ ...expired, sig: sign(expired, privateKey) });

    const r = await purchase('req_expired', proposalFor(zeptoAtta, 'cheapest'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'VITTA_DENIED');
      assert.equal((r.error.details as PurchaseOutcome).deny_code, 'EXPIRED');
    }
    assert.equal(placedOrders(sb).length, 0);
    assert.equal(sb.debits().length, 0);
  });

  test('SEC — a mandate whose signature does not verify is denied BAD_SIGNATURE', async () => {
    const file = path.join(sb.dir, 'mandates', `${sb.mandateId}.json`);
    const tampered = JSON.parse(readFileSync(file, 'utf-8'));
    tampered.scope.per_txn_inr = 999_999; // someone raises their own limit without re-signing
    writeFileSync(file, JSON.stringify(tampered));

    const r = await purchase('req_badsig', proposalFor(zeptoAtta, 'cheapest'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'VITTA_DENIED');
      assert.equal((r.error.details as PurchaseOutcome).deny_code, 'BAD_SIGNATURE');
    }
    assert.equal(placedOrders(sb).length, 0);
    assert.equal(sb.debits().length, 0);
  });

  test('SEC — a merchant outside the mandate’s scope is denied MERCHANT_NOT_ALLOWED', async () => {
    await sb.cleanup();
    sb = await createSandbox({ ...DEMO_MANDATE, merchants: ['blinkit'] });
    const r = await purchase('req_scope', proposalFor(zeptoAtta, 'cheapest'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'VITTA_DENIED');
      assert.equal((r.error.details as PurchaseOutcome).deny_code, 'MERCHANT_NOT_ALLOWED');
    }
    assert.equal(sb.debits().length, 0);
    assert.equal(placedOrders(sb).length, 0);
  });

  test('SEC — insufficient reserve is denied OVER_TOTAL_CAP: the cart is ₹229 but only ₹100 of the ₹800 order was actually paid', async () => {
    await sb.cleanup();
    sb = await createSandbox({ ...DEMO_MANDATE, paidInr: 100 });
    const r = await purchase('req_reserve', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'VITTA_DENIED');
      const o = r.error.details as PurchaseOutcome;
      assert.equal(o.deny_code, 'OVER_TOTAL_CAP');
      assert.equal(o.requested_amount_inr, 229);
    }
    assert.equal(sb.debits().length, 0);
    assert.equal(sb.remainingInr(), 100);
    assert.equal(placedOrders(sb).length, 0);
  });

  test('SEC — a Razorpay outage fails closed and says so (LEDGER_ERROR), rather than looking like a cap denial', async () => {
    await sb.razorpay.close();
    const r = await purchase('req_outage', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.equal(r.ok, false);
    if (!r.ok) {
      const o = r.error.details as PurchaseOutcome;
      assert.equal(o.ledger_unreachable, true);
      assert.equal(o.deny_code, 'OVER_TOTAL_CAP'); // the gate's own fail-closed verdict is preserved…
    }
    assert.equal(placedOrders(sb).length, 0); // …and nothing was ordered.
  });

  test('SEC — an unknown webcmd command is refused by the gate and never reaches the merchant', async () => {
    const before = sb.webcmdCalls().length;
    const run = await sb.gate(['run', '--', 'webcmd', 'zepto', 'frobnicate-everything', '--confirm']);
    assert.equal(run.ok, false);
    assert.match(run.stdout + run.stderr, /Unknown command/);
    const after = sb.webcmdCalls().slice(before).filter((argv) => argv[1] === 'frobnicate-everything');
    assert.equal(after.length, 0, 'the unknown command must not be forwarded to webcmd');
  });

  test('SEC — the Discovery Agent’s search path cannot reach a write: the read-only CLI refuses place-order', async () => {
    const r = await runSearch(['zepto', 'place-order']);
    assert.equal(r.ok, false);
    assert.match(r.stdout, /not a known read-access command/);
    assert.equal(placedOrders(sb).length, 0);
  });

  test('SEC — replaying the SAME request id does not double-charge (agent-layer idempotency)', async () => {
    const proposal = proposalFor(zeptoAtta, 'cheapest');
    const first = await purchase('req_dupe', proposal, sb.mandateId);
    assert.ok(first.ok);
    const second = await purchase('req_dupe', proposal, sb.mandateId);
    const third = await purchase('req_dupe', proposal, sb.mandateId);

    // compare as the wire would carry them: the persisted result is JSON, which drops undefined keys
    const wire = (v: unknown) => JSON.parse(JSON.stringify(v));
    assert.deepEqual(wire(second), wire(first));
    assert.deepEqual(wire(third), wire(first));
    assert.equal(sb.debits().length, 1, 'exactly one charge');
    assert.equal(sb.remainingInr(), 571);
    assert.equal(dirCount(sb, 'receipts'), 1, 'exactly one receipt');
  });

  test('SEC — the mandate’s transaction limit holds across separate requests (max 2): the third is TXN_LIMIT_REACHED', async () => {
    const a = await purchase('req_t1', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    sb.emptyCarts(); // TEST mode leaves the cart populated; a human empties it between purchases
    const b = await purchase('req_t2', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.ok(a.ok && b.ok);
    sb.emptyCarts();
    const c = await purchase('req_t3', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.equal(c.ok, false);
    if (!c.ok) assert.equal((c.error.details as PurchaseOutcome).deny_code, 'TXN_LIMIT_REACHED');
    assert.equal(sb.debits().length, 2);
    assert.equal(sb.remainingInr(), 800 - 229 * 2);
  });

  test('SEC — the receipt chain stays valid after several purchases and a denial in between', async () => {
    const a = await purchase('req_c1', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    sb.emptyCarts();
    await purchase('req_c2', proposalFor(zeptoPremium, 'overspend'), sb.mandateId); // denied
    sb.emptyCarts();
    const b = await purchase('req_c3', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.ok(a.ok && b.ok);
    assert.equal(dirCount(sb, 'receipts'), 2);
    for (const r of [a, b]) {
      if (!r.ok) return;
      const v = await sb.gate(['verify', (r.data as PurchaseOutcome).receipt_id!]);
      assert.match(v.stdout, /chain intact/);
    }
  });

  test('a non-empty cart at a merchant with no clear-cart is refused before anything is added', async () => {
    // put something in the Zepto cart out-of-band (as a human might)
    const fake = path.join(sb.dir, 'fake-webcmd-state.json');
    writeFileSync(fake, JSON.stringify({ carts: { zepto: [{ id: 'zp-atta-2kg', quantity: 3 }] }, orders: 0 }));
    const r = await purchase('req_dirty', proposalFor(zeptoAtta, 'cheapest'), sb.mandateId);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error.message, /already holds 3 item/);
    assert.equal(sb.merchantWrites().length, 0, 'nothing was written to the merchant');
    assert.equal(sb.debits().length, 0);
  });

  test('LIVE mode: an ALLOWed purchase really reaches the merchant’s place-order, exactly once — and a DENY still does not', async () => {
    const live = await createPurchaseAgent()({
      vitta: 1,
      correlation: newCorrelation({ requestId: 'req_live_ok' }),
      input: { intent, proposal: proposalFor(zeptoAtta, 'cheapest'), mode: 'LIVE', mandate_id: sb.mandateId },
    });
    assert.ok(live.ok, JSON.stringify(live));
    assert.equal(placedOrders(sb).length, 1);
    assert.equal(sb.debits().length, 1);

    const denied = await createPurchaseAgent()({
      vitta: 1,
      correlation: newCorrelation({ requestId: 'req_live_deny' }),
      input: { intent, proposal: proposalFor(zeptoPremium, 'overspend'), mode: 'LIVE', mandate_id: sb.mandateId },
    });
    assert.equal(denied.ok, false);
    assert.equal(placedOrders(sb).length, 1, 'the DENIED live purchase added no second order');
    assert.equal(sb.debits().length, 1);
  });

  test('the Price Sniper path: a pinned Blinkit product at/under target buys through the same gate', async () => {
    const blinkit = CATALOG.blinkit[0];
    const pinned: ShoppingIntent = {
      raw_request: 'price sniper',
      product_query: blinkit.name,
      category: 'groceries',
      quantity: 1,
      max_price_inr: 250,
      purchase_required: true,
      preferred_merchants: ['blinkit'],
      source: 'price-sniper',
      pinned: { merchant: 'blinkit', product_id: blinkit.id },
    };
    const record = await runShoppingFlow({ intent: pinned, mode: 'TEST', sessionId: 'ses_sniper' }, { caller: createInProcessCaller(handlers()), save: () => {} });
    assert.equal(record.status, 'PURCHASED', JSON.stringify(record.error));
    assert.equal(record.stages[0].status, 'skipped');
    assert.equal(record.outcome?.merchant, 'blinkit');
    assert.equal(record.outcome?.requested_amount_inr, 245);
    assert.equal(sb.debits().length, 1);
    // Blinkit could be cleared first, so the agent asked the gate to do that (a gated ₹0 write).
    assert.ok(sb.webcmdCalls().some((argv) => argv[0] === 'blinkit' && argv[1] === 'clear-cart'));
  });

  test('the Price Sniper never buys above its target: the gate is not even reached', async () => {
    const blinkit = CATALOG.blinkit[0];
    const pinned: ShoppingIntent = {
      raw_request: 'price sniper',
      product_query: blinkit.name,
      category: 'groceries',
      quantity: 1,
      max_price_inr: 200, // below Blinkit's ₹245
      purchase_required: true,
      preferred_merchants: ['blinkit'],
      source: 'price-sniper',
      pinned: { merchant: 'blinkit', product_id: blinkit.id },
    };
    const record = await runShoppingFlow({ intent: pinned, mode: 'TEST' }, { caller: createInProcessCaller(handlers()), save: () => {} });
    assert.equal(record.status, 'NO_PURCHASE');
    assert.equal(sb.merchantWrites().length, 0);
    assert.equal(sb.debits().length, 0);
  });
});
