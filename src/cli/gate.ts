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
import { resolveCartTotalInr, type CheckoutRow, type CartLineRow } from '../webcmd/cart-total';
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
      case 'sniper':
        // Dynamically import so we don't load sniper dependencies for basic gate commands
        const { cmdSniper } = await import('./sniper.js');
        return await cmdSniper(rest);
      default:
        console.error(`Unknown command: ${command ?? '(none)'}`);
        console.error('Usage: gate <scan|mandate|receipt|verify|run|fund|sniper> ...');
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
  if (!mandateId) throw new Error('Usage: gate fund <mandate_id> --amount <n> | gate fund <mandate_id> --reserve-ref <ref>');
  // --reserve-ref attaches an ALREADY-FUNDED real reserve instead of creating a new checkout
  // session. Needed because ledger.fund() can only ever create a session a human must then pay
  // in a browser — impossible mid-demo, and the reason a full end-to-end run couldn't be repeated
  // without a fresh out-of-band payment every time. See docs/common/02-DECISIONS.md ADR-012.
  const existingReserveRef = flags['reserve-ref'];

  const mandate = loadMandate(mandateId);
  const { sig: existingSig, ...existingUnsigned } = mandate;
  const { publicKey: issuerPublicKey } = getOrCreateKeyPair('issuer');
  if (!verify(existingUnsigned, existingSig, issuerPublicKey)) {
    throw new Error(`Existing mandate ${mandateId}'s signature does not verify — refusing to fund a mandate that may have been tampered with.`);
  }

  const ledger = new DodoCreditLedger();
  const { privateKey } = getOrCreateKeyPair('issuer');

  if (existingReserveRef) {
    if (flags.amount) {
      throw new Error('--amount and --reserve-ref are mutually exclusive: --reserve-ref attaches an already-funded reserve, whose real balance is read from Dodo rather than asserted locally.');
    }
    // Read the REAL balance rather than trusting the ref. This is what makes attaching an existing
    // reserve safe: a typo'd, unpaid, or wrong-customer ref fails loudly here instead of producing
    // a mandate that claims to be funded and only fails later, mid-spend.
    let balanceInr: number;
    try {
      balanceInr = (await ledger.balance(existingReserveRef)) / 100;
    } catch (err) {
      throw new Error(`Could not read a real balance for reserve ${existingReserveRef}: ${(err as Error).message}. Not attaching a reserve this CLI can't verify.`);
    }
    if (balanceInr <= 0) {
      throw new Error(`Reserve ${existingReserveRef} has a real balance of ₹0 — refusing to attach an unfunded reserve.`);
    }

    const funded: Omit<Mandate, 'sig'> = {
      ...existingUnsigned,
      reserve: { type: 'dodo_credit_test', blocked_inr: balanceInr, ref: existingReserveRef },
    };
    const updatedMandate: Mandate = { ...funded, sig: sign(funded, privateKey) };
    saveMandate(updatedMandate);

    console.log(`✓ MANDATE ${mandateId} funded — ₹${formatInr(balanceInr)} (existing reserve)`);
    console.log(`  reserve reference ${existingReserveRef}`);
    console.log(`  real balance read from Dodo — no new checkout needed`);
    return;
  }

  const amountInr = Number(requireFlag(flags, 'amount'));
  if (Number.isNaN(amountInr) || amountInr <= 0) throw new Error('--amount must be a positive number');
  const amountInrPaise = Math.round(amountInr * 100);
  const { reserveRef, checkoutUrl } = await ledger.fund(mandateId, amountInrPaise);

  // Update and re-sign the mandate with the new reserve
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

/** The first row webcmd returns for a commit command (`place-order`/`checkout`). Only the fields
 * this CLI actually consumes are typed — the real payload carries the command's full `columns`
 * schema. `orderId` empty/absent means the merchant never confirmed an order (see cmdRun). */
interface CommitResultRow {
  orderId?: string;
  status?: string;
  message?: string;
}

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
  let cartMerchantBlocked = false;
  let cartBlockedReason = '';
  if (!isCommitCommand) {
    cartAmountInr = 0;
  } else {
    // ADR-014: for commit commands, ask webcmd for BOTH the cart (per-line) and the checkout
    // (grand-total with fees). `blinkit/checkout` is the read command whose manifest description is
    // literally "Review Blinkit checkout totals and blockers without placing an order" — this is
    // exactly the number decide() needs, not the cart-line subtotal that ADR-013 discovered was
    // silently under-reporting for small orders. Both reads are `access: 'read'` in the manifest,
    // so this costs a browser round-trip but no gate work or ledger touch. The resolver
    // (`resolveCartTotalInr`) then returns MAX of every price-shaped field either payload exposes,
    // matching the fail-closed invariant (CLAUDE.md rule 3).
    let checkoutPayload: CheckoutRow | undefined;
    let cartLines: CartLineRow[] | undefined;
    try {
      const checkoutResult = execSync(`webcmd ${site} checkout -f json`).toString();
      const parsedCheckout: unknown = JSON.parse(checkoutResult);
      // The `checkout` command returns a single-row array (per its columns schema) — take row 0.
      if (Array.isArray(parsedCheckout) && parsedCheckout.length > 0) {
        checkoutPayload = parsedCheckout[0] as CheckoutRow;
      } else if (parsedCheckout && typeof parsedCheckout === 'object' && !Array.isArray(parsedCheckout)) {
        checkoutPayload = parsedCheckout as CheckoutRow;
      }
    } catch (err) {
      // A checkout-read failure is not fatal on its own — the cart-line fallback below still
      // provides a lower-bound total. Surface the reason on stderr so a demo operator can see it.
      console.error(`  (checkout read failed, falling back to cart lines: ${(err as Error).message})`);
    }
    try {
      const cartResult = execSync(`webcmd ${site} cart -f json`).toString();
      const parsedCart: unknown = JSON.parse(cartResult);
      if (Array.isArray(parsedCart)) {
        cartLines = parsedCart as CartLineRow[];
      }
    } catch (err) {
      // Same reasoning as checkout: if `cart` fails but `checkout` succeeded, checkoutPayload
      // alone is enough to resolve a total. If BOTH failed, resolveCartTotalInr() will throw.
      console.error(`  (cart read failed: ${(err as Error).message})`);
    }
    try {
      const resolution = resolveCartTotalInr(checkoutPayload, cartLines);
      cartAmountInr = resolution.amountInr;
      cartItemCount = resolution.itemCount;
      cartMerchantBlocked = resolution.merchantBlocked;
      cartBlockedReason = resolution.blockedReason;
    } catch (err) {
      throw new Error(`Failed to resolve cart total: ${(err as Error).message}`);
    }
  }

  // If the merchant itself says checkout can't proceed, refuse before decide() even fires. This is
  // categorically a step-up situation (missing address, slot unavailable, cart validation error) —
  // an ALLOW here would attest to an order the merchant would have refused to place. See ADR-014.
  if (cartMerchantBlocked) {
    const event: GateEvent = {
      event_id: generateId('evt'),
      ts: new Date().toISOString(),
      mandate_id: mandate.mandate_id,
      mandate_hash: sha256Hex(mandate),
      command: fullCommand,
      access: 'write',
      verdict: 'STEP_UP',
      amount_inr: cartAmountInr,
      reserve_ref: mandate.reserve.ref || undefined,
    };
    appendEvent(event);
    console.log(formatGateEventLine(event));
    console.log(`  merchant blocked checkout: ${cartBlockedReason}`);
    console.log('  reserve unchanged');
    console.log('  NO BROWSER ACTION TAKEN');
    console.log('  → resolve the merchant-side issue and retry');
    process.exitCode = 1;
    return;
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
    // If balance lookup fails, treat as zero balance (fail closed).
    //
    // But SAY SO. Swallowing this silently makes an unreachable ledger look identical to an
    // exhausted mandate: decide() returns OVER_TOTAL_CAP and the operator reads
    // "cart ₹179 · mandate ₹500 · over by ₹179" — arithmetic that cannot be true unless the
    // balance was 0. Hit for real on 2026-07-31 by running `node dist/cli/gate.js` without the
    // DODO_* vars loaded (the CLI expects a shell that has sourced .env; use
    // `node --env-file=.env` otherwise). The verdict stays fail-closed either way — this only
    // makes the cause visible instead of costing a demo several minutes of misdiagnosis.
    ledgerBalanceInr = 0;
    console.error(
      `  (reserve balance read failed — treating as ₹0, which will DENY: ${(err as Error).message})`,
    );
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

    // Real webcmd output for a commit command (found live, docs/03-WEBCMD-INTEGRATION.md never
    // specified this): `result.columns` is a bare array of row objects matching that command's own
    // `columns` schema — blinkit/place-order's schema includes a real `orderId` field.
    const resultRows = Array.isArray(result.columns) ? (result.columns as Array<CommitResultRow>) : [];
    const commitRow = resultRows[0];
    const networkOrderId = commitRow?.orderId;

    // FAIL CLOSED: webcmd exiting 0 does NOT mean the order was actually placed. Found live —
    // a real `blinkit place-order --confirm` returned exit 0, `status: "success"` in its own trace,
    // and no error, while the browser had merely stopped at Blinkit's "Proceed To Pay" step: no
    // order was created, the cart still held the item, and `orderId` came back empty. Before this
    // check, that path still drew real money from the reserve and signed a receipt attesting to a
    // purchase that never happened — the single worst failure mode for a product whose entire claim
    // is that a receipt proves what the agent did. Nothing is drawn, recorded, or signed unless the
    // merchant actually gave us an order id. See docs/common/02-DECISIONS.md ADR-013.
    if (!networkOrderId) {
      console.log(`✗ ${fullCommand} did NOT complete — no order id returned by ${site}`);
      if (commitRow?.status) console.log(`  merchant status: ${commitRow.status}`);
      if (commitRow?.message) console.log(`  merchant message: ${commitRow.message}`);
      console.log('');
      console.log('  reserve untouched — nothing drawn');
      console.log('  NO RECEIPT WRITTEN — refusing to attest to an order the merchant never confirmed');
      if (result.tracePath) console.log(`  evidence: ${result.tracePath}`);
      process.exitCode = 1;
      return;
    }

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
