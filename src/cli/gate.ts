#!/usr/bin/env node
// `gate` CLI entrypoint. See docs/05-DEMO-SCRIPT.md for the exact terminal output each
// subcommand targets, and docs/PROMPTS.md Phase 1f for the subcommand list.
//
// `gate run` and `gate fund` are NOT implemented in this phase — both need src/ledger/Ledger.ts
// to exist as real code, which is Agent B's Phase 1c, currently blocked on B-001 (no real Dodo
// test-mode account yet — see docs/common/04-BLOCKERS.md). Per CLAUDE.md rule 7 ("never mock what
// you can call for real"), these print an honest blocked message and exit non-zero rather than
// faking a Ledger call. Every other subcommand (scan, mandate create/resign, receipt show, verify)
// is fully real — no mocked output anywhere, per docs/PROMPTS.md Phase 1f's own instruction.
import { loadManifest } from '../webcmd/manifest';
import { sign, verify } from '../mandate/sign';
import { renderConsent } from '../mandate/render';
import { publicKeyToDidKey } from '../mandate/did';
import { generateId } from '../mandate/id';
import { formatInr } from '../mandate/currency';
import type { Mandate } from '../mandate/schema';
import { verifyChain, CHAIN_HEAD_HASH } from '../receipt/chain';
import { getOrCreateKeyPair } from './keys';
import { saveMandate, loadMandate, loadAllMandates, loadReceipt, loadAllReceipts } from './store';

function main(): void {
  const [command, ...rest] = process.argv.slice(2);

  try {
    switch (command) {
      case 'scan':
        return cmdScan();
      case 'mandate':
        return cmdMandate(rest);
      case 'receipt':
        return cmdReceipt(rest);
      case 'verify':
        return cmdVerify(rest);
      case 'run':
        return cmdRun();
      case 'fund':
        return cmdFund();
      default:
        console.error(`Unknown command: ${command ?? '(none)'}`);
        console.error('Usage: gate <scan|mandate|receipt|verify|run|fund> ...');
        process.exitCode = 1;
    }
  } catch (err) {
    // Never let a raw stack trace reach the terminal during a demo — every error path resolves
    // to a deliberate, formatted message, per docs/AGENTS.md § UI rules.
    console.error(`✗ ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// gate scan
// ---------------------------------------------------------------------------------------------

function cmdScan(): void {
  const manifest = loadManifest();
  const entries = [...manifest.entries()];
  const totalCommands = entries.length;
  const writeCount = entries.filter(([, access]) => access === 'write').length;
  const uniqueSites = new Set(entries.map(([key]) => key.split('/')[0])).size;

  const activeMandates = loadAllMandates().filter((m) => new Date(m.scope.expires_at) > new Date());
  const governedMerchants = new Set(activeMandates.flatMap((m) => m.scope.merchants));
  const governedCount = entries.filter(([key, access]) => access === 'write' && governedMerchants.has(key.split('/')[0])).length;

  console.log(`✓ webcmd manifest loaded — ${uniqueSites} sites, ${totalCommands} commands`);
  console.log(`  ${writeCount} marked access:'write'`);
  console.log(`  ${governedCount} currently governed`);
}

// ---------------------------------------------------------------------------------------------
// gate mandate create / resign
// ---------------------------------------------------------------------------------------------

function cmdMandate(args: string[]): void {
  const [sub, ...rest] = args;
  if (sub === 'create') return cmdMandateCreate(rest);
  if (sub === 'resign') return cmdMandateResign(rest);
  throw new Error(`Unknown mandate subcommand "${sub}". Usage: gate mandate <create|resign> ...`);
}

function cmdMandateCreate(args: string[]): void {
  const { flags } = parseArgs(args);
  const subject = requireFlag(flags, 'subject');
  const capInr = Number(requireFlag(flags, 'cap'));
  const perTxnInr = Number(requireFlag(flags, 'per-txn'));
  const merchants = requireFlag(flags, 'merchants')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const expiresAt = parseExpiryTime(requireFlag(flags, 'expires'));
  // Neither docs/05-DEMO-SCRIPT.md Beat 2 nor docs/PROMPTS.md Phase 1f's subcommand list shows a
  // --categories or --max-txns flag, but Mandate.scope requires both. Defaulting categories to
  // ["groceries"] (the product brief's whole scenario) and max_txns to 1 (matching Beat 5's
  // implied "txn 1/1"), with optional flags as an escape hatch. See docs/OUTCOME.md Phase 1f.
  const categories = flags.categories ? flags.categories.split(',').map((c) => c.trim()) : ['groceries'];
  const maxTxns = flags['max-txns'] ? Number(flags['max-txns']) : 1;

  const { privateKey, publicKey } = getOrCreateKeyPair('issuer');
  const issuerDid = publicKeyToDidKey(publicKey);

  const unsigned: Omit<Mandate, 'sig'> = {
    mandate_id: generateId('mnd'),
    issuer: issuerDid,
    subject,
    scope: { categories, merchants, cap_inr: capInr, per_txn_inr: perTxnInr, max_txns: maxTxns, expires_at: expiresAt },
    // Not funded yet — gate fund is a separate step (docs/01-ARCHITECTURE.md's own data flow
    // treats create and fund as two commands) and is itself blocked on Phase 1c. blocked_inr: 0 /
    // ref: '' is this codebase's "unfunded" sentinel state until Ledger.fund() is real.
    reserve: { type: 'dodo_credit_test', blocked_inr: 0, ref: '' },
  };
  const sig = sign(unsigned, privateKey);
  const mandate: Mandate = { ...unsigned, sig };
  saveMandate(mandate);

  console.log(`✓ MANDATE ${mandate.mandate_id} signed\n`);
  console.log(`  "${renderConsent(mandate)}"\n`);
  console.log(`  ed25519 · issuer ${issuerDid}`);
  console.log(`  reserve: not yet funded — run \`gate fund ${mandate.mandate_id} --amount <n>\` once available (blocked on Phase 1c, see docs/common/04-BLOCKERS.md B-001)`);
}

function cmdMandateResign(args: string[]): void {
  const { positionals, flags } = parseArgs(args);
  const mandateId = positionals[0];
  if (!mandateId) throw new Error('Usage: gate mandate resign <mandate_id> --cap <n> [--per-txn <n>]');
  const existing = loadMandate(mandateId);

  const { privateKey, publicKey } = getOrCreateKeyPair('issuer');
  const { sig: existingSig, ...existingUnsigned } = existing;
  if (!verify(existingUnsigned, existingSig, publicKey)) {
    throw new Error(`Existing mandate ${mandateId}'s signature does not verify — refusing to resign against a mandate that may have been tampered with.`);
  }

  const newCap = Number(requireFlag(flags, 'cap'));
  // --per-txn isn't shown in docs/05-DEMO-SCRIPT.md Beat 5 ("gate mandate resign ... --cap 1500"
  // only), but per_txn_inr must also rise for the demo's later retry to pass Rule 6 (it was 800
  // originally, and the retry's ₹1,412 cart would otherwise still exceed it). Defaulting
  // per_txn_inr to the new cap when --per-txn isn't given. See docs/OUTCOME.md Phase 1f.
  const newPerTxn = flags['per-txn'] ? Number(flags['per-txn']) : newCap;

  const unsigned: Omit<Mandate, 'sig'> = {
    mandate_id: generateId('mnd'),
    issuer: existing.issuer,
    subject: existing.subject,
    scope: { ...existing.scope, cap_inr: newCap, per_txn_inr: newPerTxn },
    // Carried forward as-is. Whether/how the reserve itself grows to cover the new cap is an open
    // question that depends on Ledger (Phase 1c, not yet real) — see docs/OUTCOME.md Phase 1f and
    // docs/agent-a/TASKS.md. Not guessed at here.
    reserve: existing.reserve,
  };
  const sig = sign(unsigned, privateKey);
  const resigned: Mandate = { ...unsigned, sig };
  saveMandate(resigned);

  console.log(`✓ MANDATE ${resigned.mandate_id} signed — ₹${formatInr(newCap)}`);
}

// ---------------------------------------------------------------------------------------------
// gate receipt show
// ---------------------------------------------------------------------------------------------

function cmdReceipt(args: string[]): void {
  const [sub, ...rest] = args;
  if (sub === 'show') return cmdReceiptShow(rest);
  throw new Error(`Unknown receipt subcommand "${sub}". Usage: gate receipt show <receipt_id>`);
}

function cmdReceiptShow(args: string[]): void {
  const { positionals } = parseArgs(args);
  const receiptId = positionals[0];
  if (!receiptId) throw new Error('Usage: gate receipt show <receipt_id>');
  const receipt = loadReceipt(receiptId);

  console.log(`✓ RECEIPT ${receipt.receipt_id} signed\n`);
  console.log(`  mandate  ${receipt.mandate_hash}        cart     ${receipt.cart.merchant} · ${receipt.cart.items} items · ₹${formatInr(receipt.cart.total_inr)}`);
  console.log(`  payment  ${receipt.payment.rail} · ${receipt.payment.status}`);
  console.log(`  run      ${receipt.execution.command} · ${receipt.execution.run_id}`);
  const orderSuffix = receipt.evidence.network_order_id ? ` · order #${receipt.evidence.network_order_id}` : '';
  console.log(`  evidence trace ${receipt.evidence.trace_digest}${orderSuffix}`);
  const chainHeadNote = receipt.prev_receipt_hash === CHAIN_HEAD_HASH ? '        (chain head)' : '';
  console.log(`  prev     ${receipt.prev_receipt_hash}${chainHeadNote}`);
}

// ---------------------------------------------------------------------------------------------
// gate verify
// ---------------------------------------------------------------------------------------------

function cmdVerify(args: string[]): void {
  const { positionals } = parseArgs(args);
  const receiptId = positionals[0];
  if (!receiptId) throw new Error('Usage: gate verify <receipt_id>');

  const allReceipts = loadAllReceipts();
  const { publicKey: gatePublicKey } = getOrCreateKeyPair('gate');
  const results = verifyChain(allReceipts, gatePublicKey);
  const result = results.find((r) => r.receipt_id === receiptId);
  if (!result) throw new Error(`No receipt found with id "${receiptId}"`);

  if (result.signature_valid && result.chain_link_valid) {
    console.log('✓ signature valid · chain intact');
    return;
  }
  // Beat 7's illustrative output names the exact tampered field ("cart.total_inr") — that
  // requires a stored copy of the original to diff against, which nothing in this system keeps.
  // Reporting honestly that verification failed, without inventing a field name we can't actually
  // determine. See docs/OUTCOME.md Phase 1f.
  if (!result.signature_valid) {
    console.log('✗ signature invalid — receipt tampered');
  } else {
    console.log("✗ chain link invalid — a prior receipt in this chain doesn't match its recorded hash");
  }
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------------------------
// gate run / gate fund — not implemented this phase, honest blocked messages only
// ---------------------------------------------------------------------------------------------

function cmdRun(): void {
  console.error('✗ gate run is not available yet.');
  console.error('  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001');
  console.error('  (no real Dodo test-mode account yet). src/webcmd/executor.ts is implemented but');
  console.error('  unverified against a live command — see B-002. See docs/common/04-BLOCKERS.md.');
  process.exitCode = 1;
}

function cmdFund(): void {
  console.error('✗ gate fund is not available yet.');
  console.error('  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001');
  console.error('  (no real Dodo test-mode account yet). See docs/common/04-BLOCKERS.md.');
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

function parseArgs(args: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[i + 1] ?? '';
      i++;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function requireFlag(flags: Record<string, string>, name: string): string {
  const value = flags[name];
  if (!value) throw new Error(`Missing required --${name} flag`);
  return value;
}

/** Parses an "HH:MM" (24-hour) time into an ISO 8601 timestamp for today, in local time —
 * consistent with renderConsent()'s toLocaleTimeString() display, which also uses local time. */
function parseExpiryTime(timeStr: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!match) throw new Error(`--expires must be in HH:MM (24-hour) format, got "${timeStr}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`--expires "${timeStr}" is not a valid time`);
  const expiry = new Date();
  expiry.setHours(hours, minutes, 0, 0);
  return expiry.toISOString();
}

main();
