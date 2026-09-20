// Runs a shopping request through the four-agent pipeline.
//
//   node dist/cli/shop.js run "find me the cheapest 2kg atta under ₹300 and buy it" --mode test
//   node dist/cli/shop.js run --intent-json '<ShoppingIntent>' --session <id> --mode test   (Price Sniper)
//   [--run-id <id>]  name the run up front · [--] everything after is request text, verbatim
//   node dist/cli/shop.js list | show <run_id>
//
// Agents are reached over A2A: straight to their URLs (`serve all` in another terminal), through
// Nasiko when NASIKO_URL is set, or `--in-process` to run all four in this process (still the real
// gate underneath — only the network hop is skipped).
//
// `--mode` is required for `run`. TEST settles against the sandbox reserve without driving the
// merchant's checkout; LIVE places a real order. It is never defaulted here, because a forgotten
// flag must not decide which of those happens.
import { createHttpCaller, createInProcessCaller } from '../agents/a2a';
import { createHandler } from '../agents/serve';
import { runShoppingFlow, type FlowInput } from '../agents/orchestrator';
import { AGENT_NAMES, isShoppingIntent, type AgentName, type ExecutionMode } from '../agents/protocol';
import { AGENT_DEFS, resolveEndpoints } from '../agents/registry';
import { listRuns, loadRun, saveRun, type FlowRecord, type FlowStage, type NasikoRouting } from '../agents/runs-store';
import { recordActivity } from './activity-log';

/** Flags that never take a value, so `--review "find biscuit"` cannot swallow the request as its value. */
const BOOLEAN_FLAGS = new Set(['review', 'in-process', 'json']);

export function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string | true> } {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      // Everything after a bare `--` is the request text, verbatim — so a request can never be
      // mistaken for a flag (the dashboard passes user-typed text this way).
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (BOOLEAN_FLAGS.has(a.slice(2)) || next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else {
        flags[a.slice(2)] = next;
        i++;
      }
    } else positionals.push(a);
  }
  return { positionals, flags };
}

const ICON: Record<FlowStage['status'], string> = { pending: '·', running: '●', done: '✓', failed: '✗', skipped: '–' };

function stageLine(s: FlowStage): string {
  const name = s.agent.padEnd(24);
  const ms = s.duration_ms !== undefined ? ` (${s.duration_ms}ms)` : '';
  return `  ${ICON[s.status]} ${name} ${s.summary ?? s.status}${ms}`;
}

function printFinal(r: FlowRecord): void {
  console.log('');
  console.log(`  run ${r.run_id} · session ${r.session_id} · trace ${r.trace_id}`);
  console.log(`  routed via ${r.nasiko.routed ? `Nasiko (${r.nasiko.url})` : 'direct A2A'} · mode ${r.mode}`);
  console.log('');
  for (const s of r.stages) console.log(stageLine(s));
  // Nasiko keys its trace view by its own id, not ours — print those so a hop can be found there.
  const nasikoTraces = r.stages.filter((s) => s.nasiko_trace_id);
  if (nasikoTraces.length > 0) {
    console.log('');
    console.log("  Nasiko traces (Observability → search by id):");
    for (const s of nasikoTraces) console.log(`    ${s.agent.padEnd(24)} ${s.nasiko_trace_id}`);
  }
  console.log('');
  const o = r.outcome;
  switch (r.status) {
    case 'PURCHASED':
      console.log(`✓ PURCHASED — ${o?.merchant} ₹${o?.requested_amount_inr} · receipt ${o?.receipt_id ?? '—'} · mandate ${o?.mandate_id ?? '—'}`);
      break;
    case 'HANDOFF':
      console.log(`✓ APPROVED, hand-off — the merchant needs a final human step (${o?.merchant})`);
      break;
    case 'DENIED':
      console.log(`✗ DENIED by Vitta — ${o?.deny_code ?? r.error?.code}`);
      if (o?.requested_amount_inr !== undefined) console.log(`  requested ₹${o.requested_amount_inr}${o.allowed_amount_inr !== undefined ? ` · allowed ₹${o.allowed_amount_inr}` : ''} · mandate ${o.mandate_id ?? '—'}`);
      console.log('  the browser action was not executed and nothing was drawn');
      break;
    case 'STEP_UP_REQUIRED':
      console.log(`✗ STEP-UP REQUIRED — ${r.error?.message}`);
      break;
    case 'NO_PRODUCTS':
      console.log(`✗ NO PRODUCTS — ${r.error?.message}`);
      break;
    case 'NO_PURCHASE':
      console.log(`– Nothing bought — ${r.proposal?.reason}`);
      if (r.proposal?.selected) console.log(`  To review it yourself, add it to your cart: ${cartUrl()}`);
      break;
    case 'REVIEW':
      console.log(`→ READY FOR YOUR REVIEW — ${r.proposal?.selected?.product_name} at ${r.proposal?.selected?.merchant} for ₹${r.proposal?.expected_total_inr}`);
      console.log('  Nothing was bought. Add it to your cart and press "Proceed to purchase" — the mandate and the gate decide from there:');
      console.log(`  ${cartUrl()}`);
      break;
    default:
      console.log(`✗ FAILED — ${r.error?.code}: ${r.error?.message}`);
  }
}

/** One line in the decision log for every run of the four agents, however it ended. */
function recordAgentRun(r: FlowRecord): void {
  const failed = r.status === 'FAILED' || r.status === 'DENIED' || r.status === 'STEP_UP_REQUIRED';
  const pick = r.proposal?.selected;
  const summaries: Record<string, string> = {
    PURCHASED: `Agents completed a purchase: ${pick?.product_name ?? 'the pick'} at ${pick?.merchant ?? ''}`,
    HANDOFF: 'Agents got approval; the merchant needs a final human step',
    REVIEW: `Agents picked ${pick?.product_name ?? 'a product'} at ${pick?.merchant ?? ''} for ₹${r.proposal?.expected_total_inr ?? '?'} and handed it to you to review`,
    NO_PURCHASE: r.proposal?.selected ? 'Agents found a pick but placed no order' : 'Agents found nothing eligible to buy',
    NO_PRODUCTS: 'Agents found no products',
    DENIED: 'The mandate refused the agents\' purchase',
    STEP_UP_REQUIRED: 'The agents\' purchase needs a step-up approval',
    FAILED: 'The agents\' run failed',
  };
  recordActivity({
    action: 'agents.run',
    outcome: failed ? 'FAILURE' : r.status === 'NO_PURCHASE' || r.status === 'NO_PRODUCTS' ? 'INFO' : 'SUCCESS',
    summary: `${summaries[r.status] ?? `Agents run ended ${r.status}`} — "${(r.request_text ?? r.intent?.raw_request ?? '').slice(0, 80)}"`,
    run_id: r.run_id,
    ...(r.mandate_id ? { mandate_id: r.mandate_id } : {}),
    ...(pick && r.proposal?.expected_total_inr !== undefined ? { amount_inr: r.proposal.expected_total_inr } : {}),
    ...(failed ? { error: r.error?.message ?? r.outcome?.deny_code ?? r.status } : {}),
    details: { status: r.status, mode: r.mode, source: r.source },
  });
}

/** Where the person reviews the pick: the dashboard's cart. */
function cartUrl(): string {
  return `${(process.env.VITTA_DASHBOARD_URL || 'http://localhost:3000').replace(/\/+$/, '')}/shop/cart`;
}

async function cmdRun(argv: string[]): Promise<void> {
  const { positionals, flags } = parseArgs(argv);

  const modeRaw = typeof flags.mode === 'string' ? flags.mode.toUpperCase() : undefined;
  if (modeRaw !== 'TEST' && modeRaw !== 'LIVE') {
    throw new Error('--mode test|live is required (it is never defaulted: it decides whether a real order is placed).');
  }
  const mode = modeRaw as ExecutionMode;

  const flow: FlowInput = {
    mode,
    mandateId: typeof flags.mandate === 'string' ? flags.mandate : undefined,
    sessionId: typeof flags.session === 'string' ? flags.session : undefined,
    requestId: typeof flags['run-id'] === 'string' ? flags['run-id'] : undefined,
    // --review: stop at a proposal and hand it to a human instead of buying it.
    review: flags.review === true,
  };
  if (typeof flags['intent-json'] === 'string') {
    const parsed: unknown = JSON.parse(flags['intent-json']);
    if (!isShoppingIntent(parsed)) throw new Error('--intent-json is not a valid ShoppingIntent.');
    flow.intent = parsed;
  } else {
    const request = positionals.join(' ').trim();
    if (!request) throw new Error('Usage: shop run "<shopping request>" --mode test|live');
    flow.request = request;
  }

  let caller;
  let nasiko: NasikoRouting;
  if (flags['in-process']) {
    const handlers = Object.fromEntries(AGENT_NAMES.map((n) => [n, createHandler(AGENT_DEFS[n].short)])) as Record<AgentName, ReturnType<typeof createHandler>>;
    caller = createInProcessCaller(handlers);
    nasiko = { routed: false };
  } else {
    const resolved = resolveEndpoints();
    caller = createHttpCaller(resolved.endpoints);
    nasiko = resolved.nasiko;
  }

  const printed = new Map<string, string>();
  const record = await runShoppingFlow(flow, {
    caller,
    nasiko,
    save: (r) => {
      saveRun(r);
      if (flags.json) return;
      for (const s of r.stages) {
        const line = stageLine(s);
        if ((s.status === 'done' || s.status === 'failed' || s.status === 'skipped') && printed.get(s.agent) !== line) {
          printed.set(s.agent, line);
          console.log(line);
        }
      }
    },
  });

  recordAgentRun(record);
  if (flags.json) console.log(JSON.stringify(record, null, 2));
  else printFinal(record);
  if (record.status !== 'PURCHASED' && record.status !== 'HANDOFF' && record.status !== 'NO_PURCHASE' && record.status !== 'REVIEW') process.exitCode = 1;
}

function cmdList(): void {
  for (const r of listRuns()) {
    console.log(`${r.started_at}  ${r.run_id}  ${r.status.padEnd(16)} ${r.source.padEnd(12)} ${r.request_text ?? ''}`);
  }
}

function cmdShow(argv: string[]): void {
  const id = argv[0];
  if (!id) throw new Error('Usage: shop show <run_id>');
  const r = loadRun(id);
  if (!r) throw new Error(`No run ${id}`);
  printFinal(r);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'run') return cmdRun(rest);
  if (command === 'list') return cmdList();
  if (command === 'show') return cmdShow(rest);
  throw new Error('Usage: shop <run|list|show> ...');
}

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
}
