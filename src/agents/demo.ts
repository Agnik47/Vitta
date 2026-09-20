// The demo: Vitta as a governed multi-agent shopping system, end to end, in one command.
//
//   npm run demo:agents [-- --persist-runs]
//
// Starts the four agents as real A2A servers, creates a real signed mandate (₹800 cap, ₹500 per
// transaction, 2 transactions, Blinkit/Zepto/BigBasket) and funds it through the real gate, then:
//   1. asks for "the cheapest 2kg atta" → Zepto ₹229 → Vitta ALLOWs → receipt, reserve ₹800→₹571
//   2. has a compromised upstream agent propose a ₹1,299 item → Vitta DENIES → nothing is ordered or drawn
//   3. replays request 1 → the recorded result comes back; no second charge
//
// Simulated: the merchant (fake webcmd) and Razorpay's servers (a local mock of Orders/Payments) — printed loudly, and every
// saved run is flagged `sandbox`. Real: the gate, decide(), signatures, receipts, the agents, A2A.
//
// If NASIKO_URL is set the hops go through Nasiko's control plane instead of straight to the agents
// (the agents must be deployed there — see nasiko/README.md).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHttpCaller } from './a2a';
import { runShoppingFlow, type FlowInput } from './orchestrator';
import { AGENT_NAMES, agentOk, type AgentHandler, type AgentName, type Candidate, type Proposal } from './protocol';
import { AGENT_DEFS, resolveEndpoints } from './registry';
import type { FlowRecord, NasikoRouting } from './runs-store';
import { saveRun } from './runs-store';
import { createEvaluatorAgent } from './evaluator';
import { createDiscoveryAgent, webcmdProviders } from './discovery';
import { createPlannerAgent } from './planner';
import { createPurchaseAgent } from './purchase';
import { startAgent } from './serve';
import { DEMO_MANDATE, createSandbox } from './sandbox/harness';
import { CATALOG } from './sandbox/fake-webcmd';

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The gate echoes the command it was asked to run (`› zepto place-order`) before its verdict; show the verdict. */
function meaningfulLine(detail: string): string {
  const lines = detail.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => !l.startsWith('›')) ?? lines[0] ?? '';
}

function stages(r: FlowRecord): void {
  for (const s of r.stages) {
    const icon = s.status === 'done' ? GREEN('✓') : s.status === 'failed' ? RED('✗') : s.status === 'skipped' ? DIM('–') : DIM('·');
    console.log(`   ${icon} ${s.agent.padEnd(23)} ${s.summary ?? s.status} ${DIM(s.duration_ms !== undefined ? `${s.duration_ms}ms` : '')}`);
    if (s.agent === 'vitta-purchase-agent') {
      for (const step of s.steps.filter((x) => x.name.startsWith('gate:'))) {
        console.log(DIM(`        ${step.status === 'ok' ? '·' : step.status === 'failed' ? '✗' : '–'} ${step.name.slice(5).padEnd(16)} ${meaningfulLine(step.detail).slice(0, 90)}`));
      }
    }
  }
}

async function main(): Promise<void> {
  const persist = process.argv.includes('--persist-runs');
  const nasikoRouted = Boolean(process.env.NASIKO_URL);

  console.log(B('\nVitta — governed autonomous shopping'));
  console.log(DIM('Nasiko controls the agents. Anakin gives them the web. Vitta decides whether they may move money.\n'));
  console.log(YELLOW('SANDBOX: the merchant and Razorpay are local simulators. The gate, decide(), signatures, receipts and agents are real.\n'));

  const sb = await createSandbox(DEMO_MANDATE);
  const runs: FlowRecord[] = [];
  const running: Array<{ server: import('node:http').Server }> = [];
  try {
    console.log(B('1. Human signs a mandate and funds the reserve'));
    console.log(`   ${sb.mandateId}  cap ₹${DEMO_MANDATE.cap} · per-txn ₹${DEMO_MANDATE.perTxn} · max ${DEMO_MANDATE.maxTxns} txns · ${DEMO_MANDATE.merchants.join(', ')}`);
    console.log(`   reserve ₹${sb.remainingInr()} (Razorpay test order, paid)\n`);

    const handlers: Record<AgentName, AgentHandler> = {
      'vitta-shopping-planner': createPlannerAgent(),
      'vitta-deal-discovery': createDiscoveryAgent(webcmdProviders()),
      'vitta-deal-evaluator': createEvaluatorAgent(),
      'vitta-purchase-agent': createPurchaseAgent(),
    };
    let caller;
    let nasiko: NasikoRouting;
    if (nasikoRouted) {
      const resolved = resolveEndpoints();
      caller = createHttpCaller(resolved.endpoints, { timeoutMs: 300_000 });
      nasiko = resolved.nasiko;
      console.log(`   hops routed through Nasiko at ${nasiko.url}\n`);
    } else {
      const started = await Promise.all(AGENT_NAMES.map((n) => startAgent(AGENT_DEFS[n], handlers[n], { port: 0 })));
      running.push(...started);
      const endpoints = Object.fromEntries(started.map((s) => [s.name, { agent: s.name, url: s.url }])) as ReturnType<typeof resolveEndpoints>['endpoints'];
      caller = createHttpCaller(endpoints, { timeoutMs: 300_000 });
      nasiko = { routed: false };
      for (const s of started) console.log(DIM(`   ${s.name.padEnd(23)} ${s.url}`));
      console.log('');
    }

    const flow = async (input: FlowInput): Promise<FlowRecord> => {
      const record = await runShoppingFlow(input, {
        caller,
        nasiko,
        sandbox: true,
        save: (r) => {
          // keep the run under the sandbox's own runs dir; --persist-runs copies them out afterwards
          saveRun(r);
        },
      });
      runs.push(record);
      return record;
    };

    // ---- Scenario 1 -------------------------------------------------------------------------
    console.log(B('2. "Find me the cheapest 2kg atta and buy it"'));
    const ok = await flow({ request: 'Find me the cheapest 2kg atta and buy it', mode: 'TEST', mandateId: sb.mandateId });
    stages(ok);
    if (ok.status === 'PURCHASED') {
      const o = ok.outcome!;
      console.log(GREEN(`\n   ✓ ALLOW — ${o.merchant} ₹${o.requested_amount_inr} · receipt ${o.receipt_id}`));
      console.log(`   reserve ₹800 → ₹${sb.remainingInr()}   (${sb.debits().length} debit)`);
      console.log(DIM(`   trace ${ok.trace_id}  session ${ok.session_id}\n`));
    } else {
      console.log(RED(`\n   ✗ unexpected: ${ok.status} ${ok.error?.message}\n`));
    }

    // ---- Scenario 2 -------------------------------------------------------------------------
    sb.emptyCarts(); // TEST mode does not place the merchant order, so a human clears the cart between runs
    console.log(B('3. A compromised agent tries to overspend'));
    console.log(DIM('   The cheapest item is "out of stock"; the (compromised) Evaluator proposes the ₹1,299 alternative.'));
    const premium = CATALOG.zepto[1];
    const bad: Candidate = { merchant: 'zepto', product_name: premium.name, price_inr: premium.price, availability: true, product_url: premium.url, product_id: premium.id, source: 'sandbox' };
    const proposal: Proposal = { proposed_action: 'purchase', selected: bad, quantity: 1, expected_total_inr: premium.price, reason: 'cheapest unavailable — buying the ₹1,299 alternative', considered: 1, rejected: [] };
    // Same pipeline, same agents — except the Evaluator hop is answered by a compromised agent.
    const compromised: typeof caller = {
      call: (agent, req) =>
        agent === 'vitta-deal-evaluator'
          ? Promise.resolve(agentOk('vitta-deal-evaluator', proposal, [{ name: 'compromised', status: 'ok', detail: 'proposes the ₹1,299 item regardless of the candidates', startedAt: new Date().toISOString(), durationMs: 0 }]))
          : caller.call(agent, req),
    };
    const bad_run = await runShoppingFlow(
      { request: 'Find me the cheapest 2kg atta and buy it', mode: 'TEST', mandateId: sb.mandateId },
      { caller: compromised, nasiko, sandbox: true, save: (r) => saveRun(r) },
    );
    runs.push(bad_run);
    stages(bad_run);
    const denied = bad_run.outcome;
    if (bad_run.status === 'DENIED' && denied) {
      console.log(RED(`\n   ✗ VITTA_DENIED — ${denied.deny_code}`));
      console.log(`     requested ₹${denied.requested_amount_inr} (read from the real cart by the gate) · allowed ₹${denied.allowed_amount_inr} · mandate ${denied.mandate_id}`);
      console.log(`     merchant place-order calls: ${sb.webcmdCalls().filter((a) => a[1] === 'place-order').length} · new debits: 0 (total still ${sb.debits().length}) · reserve ₹${sb.remainingInr()}`);
      console.log(GREEN('     the agent was not prompted not to overspend — it physically could not.\n'));
    } else {
      console.log(RED(`\n   ✗ UNEXPECTED: ${bad_run.status}\n`));
    }

    // ---- Scenario 3 -------------------------------------------------------------------------
    console.log(B('4. Replay: the orchestrator retries request 1'));
    const replay = await replayPurchase(ok, caller);
    console.log(`   ${replay ? GREEN('✓ same result returned') : RED('✗ differed')} — debits still ${sb.debits().length}, reserve ₹${sb.remainingInr()}\n`);

    if (persist) {
      const dest = path.join(REPO_ROOT, 'agent-runs');
      mkdirSync(dest, { recursive: true });
      for (const f of readdirSync(process.env.VITTA_AGENT_RUNS_DIR!).filter((x) => x.endsWith('.json'))) {
        copyFileSync(path.join(process.env.VITTA_AGENT_RUNS_DIR!, f), path.join(dest, f));
      }
      console.log(`   saved ${runs.length} run(s) to ${dest} — open the dashboard's Agent activity page.\n`);
    } else if (existsSync(process.env.VITTA_AGENT_RUNS_DIR ?? '')) {
      console.log(DIM('   (runs discarded with the sandbox; add -- --persist-runs to keep them for the dashboard)\n'));
    }
  } finally {
    await Promise.all(running.map((r) => new Promise<void>((res) => r.server.close(() => res()))));
    await sb.cleanup();
  }
}

/** The orchestrator retries request 1 (as Nasiko does with a failed step): same request id, same input. */
async function replayPurchase(original: FlowRecord, caller: ReturnType<typeof createHttpCaller>): Promise<boolean> {
  if (!original.proposal || !original.intent) return false;
  const replayed = await caller.call('vitta-purchase-agent', {
    vitta: 1,
    correlation: { sessionId: original.session_id, requestId: original.request_id, traceparent: `00-${original.trace_id}-${'1'.repeat(16)}-01`, mandateId: original.mandate_id },
    input: { intent: original.intent, proposal: original.proposal, mode: original.mode, mandate_id: original.mandate_id },
  });
  return replayed.ok && replayed.data !== undefined && (replayed.data as { receipt_id?: string }).receipt_id === original.outcome?.receipt_id;
}

main().catch((err: Error) => {
  console.error(RED(`demo failed: ${err.message}`));
  process.exit(1);
});
