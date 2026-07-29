#!/usr/bin/env node
// `gate` CLI entrypoint. See docs/05-DEMO-SCRIPT.md for the exact terminal output each
// subcommand targets, and docs/PROMPTS.md Phase 1f for the subcommand list.
import { execSync } from 'node:child_process';
import { loadManifest } from '../webcmd/manifest';
import { sign, verify } from '../mandate/sign';
import { renderConsent } from '../mandate/render';
import { publicKeyToDidKey } from '../mandate/did';
import { generateId } from '../mandate/id';
import { formatInr } from '../mandate/currency';
import type { Mandate } from '../mandate/schema';
import { decide } from '../policy/decide';
import { verifyChain, CHAIN_HEAD_HASH, buildAndSignReceipt, sha256Hex } from '../receipt/chain';
import type { Receipt } from '../receipt/schema';
import { DodoCreditLedger } from '../ledger/DodoCreditLedger';
import { execute, hasAlreadyDrawn, recordDraw, type LedgerEntry } from '../webcmd/executor';
import { formatGateEventLine, formatAgentLine } from './ui';
import { getOrCreateKeyPair } from './keys';
import { saveMandate, loadMandate, loadAllMandates, loadReceipt, loadAllReceipts, saveReceipt, appendEvent } from './store';
import type { GateEvent } from '../events/GateEvent';

async function main(): Promise<void> {
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
        return await cmdRun(rest);
      case 'fund':
        return await cmdFund(rest);
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
  console.log(`  reserve: not yet funded — run \`gate fund ${mandate.mandate_id} --amount <n>\` to fund`);
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
// gate fund — fund a mandate's reserve via Dodo Payments credit top-up
// ---------------------------------------------------------------------------------------------

async function cmdFund(args: string[]): Promise<void> {
  const { positionals, flags } = parseArgs(args);
  const mandateId = positionals[0];
  if (!mandateId) throw new Error('Usage: gate fund <mandate_id> --amount <n>');
  const amountInr = Number(requireFlag(flags, 'amount'));
  if (Number.isNaN(amountInr) || amountInr <= 0) throw new Error('--amount must be a positive number');

  const mandate = loadMandate(mandateId);
  const { sig: existingSig, ...existingUnsigned } = mandate;
  const { publicKey: issuerPublicKey } = getOrCreateKeyPair('issuer');
  if (!verify(existingUnsigned, existingSig, issuerPublicKey)) {
    throw new Error(`Existing mandate ${mandateId}'s signature does not verify — refusing to fund a mandate that may have been tampered with.`);
  }

  const ledger = new DodoCreditLedger();
  const amountInrPaise = Math.round(amountInr * 100);
  const { reserveRef, checkoutUrl } = await ledger.fund(mandateId, amountInrPaise);

  // Update and re-sign the mandate with the new reserve
  const { privateKey } = getOrCreateKeyPair('issuer');
  const funded: Omit<Mandate, 'sig'> = {
    ...existingUnsigned,
    reserve: { type: 'dodo_credit_test', blocked_inr: amountInr, ref: reserveRef },
  };
  const sig = sign(funded, privateKey);
  const updatedMandate: Mandate = { ...funded, sig };
  saveMandate(updatedMandate);

  console.log(`✓ MANDATE ${mandateId} funded — ₹${formatInr(amountInr)}`);
  console.log(`  reserve reference ${reserveRef}`);
  if (checkoutUrl) {
    console.log(`  checkout required: complete the Dodo Payments purchase at ${checkoutUrl}`);
  } else {
    console.log(`  checkout required: open your browser to complete the Dodo Payments purchase before running commands`);
  }
}

// ---------------------------------------------------------------------------------------------
// gate run — decide, execute, and record a webcmd action under a mandate
// ---------------------------------------------------------------------------------------------

async function cmdRun(args: string[]): Promise<void> {
  // Parse: args = ["--", "webcmd", "blinkit", "search", "atta"]
  const dashDashIndex = args.indexOf('--');
  if (dashDashIndex < 0) {
    throw new Error('Usage: gate run -- webcmd <site> <command> [args...]');
  }

  const webcmdArgs = args.slice(dashDashIndex + 1);
  if (webcmdArgs[0] !== 'webcmd') {
    throw new Error('Only webcmd is supported');
  }
  if (webcmdArgs.length < 3) {
    throw new Error('Usage: gate run -- webcmd <site> <command> [args...]');
  }

  const site = webcmdArgs[1];
  const command = webcmdArgs[2];
  const rawCmdArgs = webcmdArgs.slice(3);
  // --run-id is a gate-CLI-level flag (Beat 8's idempotency-retry test), not a webcmd argument —
  // strip it out before anything is passed through to the real webcmd process.
  let explicitRunId: string | undefined;
  const cmdArgs: string[] = [];
  for (let i = 0; i < rawCmdArgs.length; i++) {
    if (rawCmdArgs[i] === '--run-id') {
      explicitRunId = rawCmdArgs[i + 1];
      i++;
    } else {
      cmdArgs.push(rawCmdArgs[i]);
    }
  }
  const fullCommand = `${site}/${command}`;

  // Load the most recent mandate
  const allMandates = loadAllMandates();
  if (!allMandates.length) {
    throw new Error('No mandates found. Create one first: gate mandate create ...');
  }
  const mandate = allMandates[allMandates.length - 1];

  // Get keys and manifest
  const manifest = loadManifest();
  const access = manifest.get(fullCommand);
  const { publicKey: issuerPublicKey } = getOrCreateKeyPair('issuer');
  const { privateKey: gatePrivateKey } = getOrCreateKeyPair('gate');

  // Render agent action
  const agentLine = formatAgentLine(`${site} ${command} ${cmdArgs.join(' ')}`);
  console.log(agentLine);

  // Rule 0: reads are free
  if (access === 'read') {
    const event: GateEvent = {
      event_id: generateId('evt'),
      ts: new Date().toISOString(),
      mandate_id: mandate.mandate_id,
      mandate_hash: sha256Hex(mandate),
      command: fullCommand,
      access: 'read',
      verdict: 'ALLOW',
    };
    appendEvent(event);
    console.log(formatGateEventLine(event));
    return;
  }

  // For writes, fetch cart total via a read first
  if (access !== 'write') {
    throw new Error(`Unknown command "${fullCommand}" (not in manifest)`);
  }

  // Only the actual commit action (place-order/checkout) represents real spend — per
  // docs/03-WEBCMD-INTEGRATION.md's command table, other write commands like add-to-cart are
  // "gated, but ₹0 committed until checkout." Fetching the cart for those would be an unnecessary
  // browser round-trip and, worse, would incorrectly deny them if the cart total exceeds the cap
  // before the agent ever tries to actually spend anything.
  const isCommitCommand = command === 'place-order' || command === 'checkout';

  let cartAmountInr: number;
  let cartItemCount = 0;
  if (!isCommitCommand) {
    cartAmountInr = 0;
  } else {
    try {
      const cartCmd = `${site} cart -f json`;
      const cartResult = execSync(`webcmd ${cartCmd}`).toString();
      const parsed: unknown = JSON.parse(cartResult);
      // Real shape (found live, not the spec's guess): a bare array of line items, each with its
      // own `payable`/`total` — there is no cart-wide object with a single total_inr field. The
      // authoritative total is the sum across all lines, not any one line's own value.
      if (Array.isArray(parsed)) {
        const lines = parsed as Array<{ payable?: number; total?: number; quantity?: number }>;
        cartAmountInr = lines.reduce((sum, line) => sum + (line.payable ?? line.total ?? 0), 0);
        cartItemCount = lines.reduce((sum, line) => sum + (line.quantity ?? 1), 0);
      } else {
        const cartData = parsed as { total?: number; total_inr?: number };
        if (cartData.total_inr === undefined && cartData.total === undefined) {
          throw new Error('Cart total could not be determined (missing total_inr/total field)');
        }
        cartAmountInr = cartData.total_inr ?? cartData.total ?? 0;
      }
    } catch (err) {
      throw new Error(`Failed to fetch cart total: ${(err as Error).message}`);
    }
  }

  // Call decide()
  const now = new Date();
  const ledger = new DodoCreditLedger();
  let ledgerBalanceInr = 0;
  try {
    if (mandate.reserve.ref) {
      const balancePaise = await ledger.balance(mandate.reserve.ref);
      ledgerBalanceInr = balancePaise / 100;
    }
  } catch (err) {
    // If balance lookup fails, treat as zero balance (fail closed)
    ledgerBalanceInr = 0;
  }

  const allReceipts = loadAllReceipts();
  const txnCountForThisMandate = allReceipts.filter((r) => r.mandate_hash === sha256Hex(mandate)).length;

  const decision = decide(
    { command: fullCommand, site, access: 'write', amountInr: cartAmountInr },
    mandate,
    issuerPublicKey,
    ledgerBalanceInr,
    txnCountForThisMandate,
    now,
  );

  const event: GateEvent = {
    event_id: generateId('evt'),
    ts: now.toISOString(),
    mandate_id: mandate.mandate_id,
    mandate_hash: sha256Hex(mandate),
    command: fullCommand,
    access: 'write',
    verdict: decision.verdict,
    code: decision.verdict === 'DENY' ? decision.code : undefined,
    amount_inr: cartAmountInr,
    reserve_ref: mandate.reserve.ref || undefined,
  };
  appendEvent(event);
  console.log(formatGateEventLine(event));

  if (decision.verdict === 'DENY') {
    if (decision.code === 'OVER_TOTAL_CAP') {
      console.log(`  cart ₹${formatInr(cartAmountInr)} · mandate ₹${formatInr(mandate.scope.cap_inr)}`);
      if (decision.overBy) {
        console.log(`  over by ₹${formatInr(decision.overBy)}`);
      }
    }
    if (decision.code === 'OVER_PER_TXN_CAP') {
      console.log(`  transaction ₹${formatInr(cartAmountInr)} · limit ₹${formatInr(mandate.scope.per_txn_inr)}`);
      if (decision.overBy) {
        console.log(`  over by ₹${formatInr(decision.overBy)}`);
      }
    }
    console.log('');
    console.log('  reserve untouched');
    console.log('  NO BROWSER ACTION TAKEN');
    console.log('  → step-up required');
    process.exitCode = 1;
    return;
  }

  if (decision.verdict === 'STEP_UP') {
    console.log('  reserve unchanged');
    console.log('  NO BROWSER ACTION TAKEN');
    console.log('  → mandate re-signature required');
    process.exitCode = 1;
    return;
  }

  // ALLOW, non-commit write (e.g. add-to-cart): execute the browser action, no ledger/receipt —
  // "gated, but ₹0 committed until checkout" per docs/03-WEBCMD-INTEGRATION.md.
  if (!isCommitCommand) {
    try {
      await execute(site, command, cmdArgs);
      console.log(`  ₹0 committed`);
    } catch (err) {
      throw new Error(`Execution failed: ${(err as Error).message}`);
    }
    return;
  }

  // ALLOW, commit command: Beat 8's idempotency-retry check — a caller-supplied --run-id that's
  // already in ledger.jsonl is refused before any webcmd/Ledger call, even though decide() alone
  // would return ALLOW (it has no notion of runId). Belt-and-suspenders per ADR-004.
  const cartAmountPaise = Math.round(cartAmountInr * 100);
  if (explicitRunId && hasAlreadyDrawn(explicitRunId)) {
    console.log(`✗ DENY  ${fullCommand}`);
    console.log(`  ALREADY_EXECUTED`);
    console.log(`  runId ${explicitRunId} already drawn ₹${formatInr(cartAmountInr)} — refusing to double-charge`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await execute(site, command, cmdArgs);
    const runId = result.runId;

    // Draw from ledger
    if (mandate.reserve.ref) {
      await ledger.draw(mandate.reserve.ref, cartAmountPaise, runId);
    }

    // Record the draw for idempotency
    const ledgerEntry: LedgerEntry = {
      runId,
      reserveRef: mandate.reserve.ref,
      amountInrPaise: cartAmountPaise,
      ts: new Date().toISOString(),
    };
    recordDraw(ledgerEntry);

    // Real webcmd output for a commit command (found live, docs/03-WEBCMD-INTEGRATION.md never
    // specified this): `result.columns` is a bare array of row objects matching that command's own
    // `columns` schema — blinkit/place-order's schema includes a real `orderId` field, but nothing
    // ever read it before this fix, so every receipt's `network_order_id` was hardcoded `undefined`
    // regardless of whether the order actually succeeded. Extract it defensively — some sites/commands
    // may not have an orderId field at all, so this stays optional exactly like the schema says.
    const resultRows = Array.isArray(result.columns) ? (result.columns as Array<{ orderId?: string }>) : [];
    const networkOrderId = resultRows[0]?.orderId;

    // Build and sign receipt
    const receipt: Receipt = buildAndSignReceipt(
      {
        receipt_id: generateId('rcp'),
        mandate_hash: sha256Hex(mandate),
        cart: { merchant: site, items: cartItemCount, total_inr: cartAmountInr },
        payment: { rail: 'dodo_test', reserve_ref: mandate.reserve.ref, status: 'captured' },
        execution: { command: fullCommand, run_id: runId, profile: '' },
        evidence: { trace_digest: result.traceDigest, network_order_id: networkOrderId },
        prev_receipt_hash: allReceipts.length === 0 ? CHAIN_HEAD_HASH : sha256Hex(allReceipts[allReceipts.length - 1]),
      },
      gatePrivateKey,
    );
    saveReceipt(receipt);

    console.log(`✓ ${fullCommand} executed · runId ${runId}`);
    console.log(`  receipt ${receipt.receipt_id}`);
  } catch (err) {
    throw new Error(`Execution failed: ${(err as Error).message}`);
  }
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
