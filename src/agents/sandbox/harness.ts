// Assembles the sandbox: an isolated working directory, a fake `webcmd` on PATH, a local Razorpay
// mock, and a REAL mandate — created, signed and funded through the real gate CLI: `gate fund`
// creates the Razorpay order, a simulated customer pays it, `gate fund --reserve-ref` attaches it. Used by the end-to-end
// tests and by `npm run demo:agents`.
//
// What is real here: the gate CLI, decide(), Ed25519 mandates and receipts, the receipt chain, the
// ledger.jsonl idempotency file, RazorpayLedger's HTTP calls, PurchaseAgent, and the four agents.
// What is simulated: the merchant (fake-webcmd) and Razorpay's servers (ledger/mock-razorpay). That is stated on
// every run's output — a simulated merchant is never presented as a real one.
//
// The gate reads its data from the current directory (./mandates, ./keys, ./events.jsonl,
// ./manifest.json), so the harness chdir's into the sandbox and restores the old cwd on cleanup.
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGate, type CliResult } from '../../agent/gate-spawn';
import { MOCK_KEY_ID, MOCK_KEY_SECRET, startMockRazorpay, type RunningMockRazorpay } from '../../ledger/mock-razorpay';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

export interface SandboxOptions {
  /** The Razorpay order's amount — what `gate fund --amount` asks the customer to pay. */
  reserveInr: number;
  /** What the simulated customer actually pays (default: the full amount). */
  paidInr?: number;
  cap: number;
  perTxn: number;
  maxTxns: number;
  merchants: string[];
}

export const DEMO_MANDATE: SandboxOptions = {
  reserveInr: 800,
  cap: 800,
  perTxn: 500,
  maxTxns: 2,
  merchants: ['blinkit', 'zepto', 'bigbasket'],
};

export interface Debit {
  /** INR (paise / 100). */
  amount: number;
  reference: string;
}

export interface Sandbox {
  dir: string;
  razorpay: RunningMockRazorpay;
  mandateId: string;
  /** The Razorpay order that is this mandate's reserve. */
  orderId: string;
  /** Every draw the ledger recorded (its local append-only log, voids removed). */
  debits(): Debit[];
  /** What the gate would read as the reserve balance now: captured − max(local, remote spent). */
  remainingInr(): number;
  /** Every `webcmd` invocation the gate or an agent made, in order. */
  webcmdCalls(): string[][];
  /** Merchant WRITE calls that actually reached the (fake) merchant. */
  merchantWrites(): string[][];
  /** What a human does between TEST-mode purchases: TEST never drives the merchant's checkout, so the
   *  cart still holds the item, and Zepto/BigBasket have no clear-cart command for an agent to use. */
  emptyCarts(): void;
  gate(args: string[]): Promise<CliResult>;
  cleanup(): Promise<void>;
}

const WRITE_COMMANDS = new Set(['place-order', 'add-to-cart', 'set-cart-quantity', 'clear-cart']);

export function sandboxSupported(): boolean {
  return process.platform !== 'win32';
}

export async function createSandbox(opts: SandboxOptions = DEMO_MANDATE): Promise<Sandbox> {
  if (!sandboxSupported()) throw new Error('The sandbox puts a shell shim named `webcmd` on PATH and is not supported on Windows.');
  const distGate = path.join(REPO_ROOT, 'dist', 'cli', 'gate.js');
  const fakeWebcmd = path.join(REPO_ROOT, 'dist', 'agents', 'sandbox', 'fake-webcmd.js');
  for (const f of [distGate, fakeWebcmd]) {
    if (!existsSync(f)) throw new Error(`${f} is missing — run \`npm run build\` first (the gate runs from compiled output).`);
  }

  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vitta-sandbox-'));
  mkdirSync(path.join(dir, 'bin'));
  copyFileSync(path.join(REPO_ROOT, 'manifest.json'), path.join(dir, 'manifest.json'));

  // gate-spawn finds the compiled CLIs at <cwd>/dist first. Linking the repo's dist here makes that
  // hold from inside the sandbox even when the agents themselves run from src/ under ts-node.
  // 'junction' is what works on Windows without administrator rights; other platforms ignore the type.
  symlinkSync(path.join(REPO_ROOT, 'dist'), path.join(dir, 'dist'), 'junction');

  const shim = path.join(dir, 'bin', 'webcmd');
  writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${fakeWebcmd}" "$@"\n`);
  chmodSync(shim, 0o755);

  const razorpay = await startMockRazorpay();
  const logFile = path.join(dir, 'webcmd-calls.jsonl');

  // Undo everything done so far. Also used when setup itself fails: a half-built sandbox must not
  // leave a listening server holding the process open, nor the cwd/env changed.
  const teardown = async (): Promise<void> => {
    await razorpay.close();
    process.chdir(previousCwd);
    for (const k of Object.keys(process.env)) if (!(k in previousEnv)) delete process.env[k];
    Object.assign(process.env, previousEnv);
    rmSync(dir, { recursive: true, force: true });
  };

  process.chdir(dir);
  Object.assign(process.env, {
    PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    FAKE_WEBCMD_STATE: path.join(dir, 'fake-webcmd-state.json'),
    FAKE_WEBCMD_LOG: logFile,
    RAZORPAY_API_BASE_URL: razorpay.url,
    RAZORPAY_KEY_ID: MOCK_KEY_ID,
    RAZORPAY_KEY_SECRET: MOCK_KEY_SECRET,
    RAZORPAY_LEDGER_PATH: path.join(dir, 'razorpay-ledger.jsonl'),
    VITTA_AGENT_RUNS_DIR: path.join(dir, 'agent-runs'),
  });

  let mandateId: string;
  let orderId: string;
  try {
    const created = await runGate([
      'mandate', 'create',
      '--subject', 'agent:vitta-purchase',
      '--cap', String(opts.cap),
      '--per-txn', String(opts.perTxn),
      '--merchants', opts.merchants.join(','),
      '--max-txns', String(opts.maxTxns),
      '--expires', '23:59',
    ]);
    const id = /MANDATE (mnd_[a-z0-9]+)/i.exec(created.stdout)?.[1];
    if (!created.ok || !id) throw new Error(`Sandbox mandate creation failed: ${created.stderr || created.stdout}`);
    // 1. the human asks to fund: the gate creates the Razorpay order and re-signs the mandate with it
    const funded = await runGate(['fund', id, '--amount', String(opts.reserveInr)]);
    const ref = /reserve reference\s+(razorpay-order:order_\S+)/.exec(funded.stdout)?.[1];
    if (!funded.ok || !ref) throw new Error(`Sandbox funding failed: ${funded.stderr || funded.stdout}`);
    orderId = ref.slice('razorpay-order:'.length);
    // 2. the customer pays it in Checkout (simulated), 3. the human confirms and the gate attaches the real balance
    razorpay.pay(orderId, { amountPaise: Math.round((opts.paidInr ?? opts.reserveInr) * 100) });
    const attached = await runGate(['fund', id, '--reserve-ref', ref]);
    if (!attached.ok) throw new Error(`Sandbox reserve attach failed: ${attached.stderr || attached.stdout}`);
    mandateId = id;
  } catch (err) {
    await teardown();
    throw err;
  }

  const readDebits = (): Debit[] => {
    const file = path.join(dir, 'razorpay-ledger.jsonl');
    if (!existsSync(file)) return [];
    const entries = readFileSync(file, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { kind: string; amountPaise?: number; reference: string });
    const voided = new Set(entries.filter((e) => e.kind === 'void').map((e) => e.reference));
    return entries.filter((e) => e.kind === 'debit' && !voided.has(e.reference)).map((e) => ({ amount: (e.amountPaise ?? 0) / 100, reference: e.reference }));
  };

  const readCalls = (): string[][] =>
    existsSync(logFile)
      ? readFileSync(logFile, 'utf-8')
          .split('\n')
          .filter(Boolean)
          .map((l) => (JSON.parse(l) as { argv: string[] }).argv)
      : [];

  return {
    dir,
    razorpay,
    mandateId,
    orderId,
    debits: readDebits,
    remainingInr: () => {
      const local = readDebits().reduce((sum, d) => sum + d.amount * 100, 0);
      return (razorpay.paidPaise(orderId) - Math.max(local, razorpay.spentPaise(orderId))) / 100;
    },
    webcmdCalls: readCalls,
    merchantWrites: () => readCalls().filter((argv) => WRITE_COMMANDS.has(argv[1])),
    emptyCarts: () => {
      const file = path.join(dir, 'fake-webcmd-state.json');
      const orders = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf-8')) as { orders: number }).orders : 0;
      writeFileSync(file, JSON.stringify({ carts: {}, orders }));
    },
    gate: (args) => runGate(args),
    cleanup: teardown,
  };
}
