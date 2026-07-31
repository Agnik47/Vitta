// Standalone CLI for the purchase agent — proves PurchaseAgent isn't dashboard-coupled (the
// dashboard's job runner spawns this exact same compiled file; see docs/OUTCOME.md's plan for the
// one-click purchase pipeline). Streams one NDJSON line per pipeline step on stdout as it happens,
// then a final result line — a caller doesn't have to wait for the whole run to see progress.
//
// Usage:
//   node dist/cli/agent.js buy --merchant blinkit \
//     --items '[{"productRef":"171258","productName":"Maggi Masala","quantity":1}]' \
//     [--clear-cart] [--min-cart 150] [--max-cart 2000] [--mandate mnd_...]
//
// `--items` carries every line for the one real checkout this job will perform — a Purchase Job is
// always scoped to a single merchant (a real checkout can't span two marketplaces), but a
// merchant's cart is naturally multi-line. Passed as one JSON argv element, not repeated flags —
// spawn() with an argument array never goes through a shell (ADR-007), so a JSON string in one
// element carries no injection risk regardless of what the product names contain.
//
// `--mandate` is optional — like `gate run`, this resolves the most recently created mandate on its
// own if omitted. It is only actually used for the auto-fund-and-retry step; the commit itself goes
// through `gate run`, which resolves its own mandate independently (this file never assumes they're
// the same object, only that they're the same file on disk).
import { PurchaseAgent, type PurchaseInput, type PurchaseItem, type PurchaseStepEvent } from '../agent/PurchaseAgent';
import { isPurchaseMerchant } from '../agent/merchants';
import { loadAllMandates } from './store';

function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[name] = true; // boolean flag, e.g. --clear-cart
      } else {
        flags[name] = next;
        i++;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function fail(message: string): never {
  process.stdout.write(JSON.stringify({ type: 'result', ok: false, failureReason: message }) + '\n');
  process.exit(1);
}

function resolveMostRecentMandateId(): string | undefined {
  const mandates = loadAllMandates();
  return mandates.length > 0 ? mandates[mandates.length - 1].mandate_id : undefined;
}

async function cmdBuy(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);

  const merchant = flags.merchant;
  if (!isPurchaseMerchant(merchant)) {
    fail('--merchant must be one of blinkit, zepto, bigbasket');
  }

  const itemsRaw = typeof flags.items === 'string' ? flags.items : undefined;
  if (!itemsRaw) fail('--items is required — a JSON array of {productRef, productName, quantity}');
  let items: PurchaseItem[];
  try {
    const parsed = JSON.parse(itemsRaw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('empty');
    items = parsed.map((raw, i) => {
      const r = raw as Record<string, unknown>;
      const productRef = typeof r.productRef === 'string' ? r.productRef : undefined;
      if (!productRef) throw new Error(`item ${i}: productRef is required`);
      const productName = typeof r.productName === 'string' ? r.productName : productRef;
      const quantityRaw = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity ?? 1);
      const quantity = Number.isInteger(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      return { productRef, productName, quantity };
    });
  } catch (err) {
    fail(`--items is not valid: ${(err as Error).message}`);
  }

  const minCartInr = typeof flags['min-cart'] === 'string' ? Number(flags['min-cart']) : undefined;
  const maxCartInr = typeof flags['max-cart'] === 'string' ? Number(flags['max-cart']) : undefined;
  const clearCartFirst = flags['clear-cart'] === true;
  const mandateId = typeof flags.mandate === 'string' ? flags.mandate : resolveMostRecentMandateId();

  const input: PurchaseInput = {
    merchant,
    items,
    clearCartFirst,
    minCartInr: minCartInr !== undefined && Number.isFinite(minCartInr) ? minCartInr : undefined,
    maxCartInr: maxCartInr !== undefined && Number.isFinite(maxCartInr) ? maxCartInr : undefined,
    mandateId,
  };

  const agent = new PurchaseAgent((event: PurchaseStepEvent) => {
    process.stdout.write(JSON.stringify({ type: 'step', ...event }) + '\n');
  });

  const result = await agent.run(input);
  process.stdout.write(JSON.stringify({ type: 'result', ...result }) + '\n');
  if (!result.ok) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'buy') {
    await cmdBuy(rest);
    return;
  }
  fail(`Unknown agent command "${command}". Usage: agent buy --merchant <m> --product <ref> [...]`);
}

main().catch((err: Error) => fail(err.message));
