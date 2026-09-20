// A stand-in `webcmd` for the sandbox — a small in-memory Blinkit/Zepto/BigBasket. NOT part of the
// product: it exists so the real gate CLI, real decide(), real signatures, real receipts and the real
// PurchaseAgent can be run end to end without merchant logins or a browser, in tests and in the demo.
//
// It is put on PATH as `webcmd` (see harness.ts), so nothing in Vitta's trusted code is touched or
// parameterised for testing — the gate shells out to `webcmd` exactly as it does in production, and
// simply finds this one. Every invocation is appended to FAKE_WEBCMD_LOG, which is what lets a test
// prove that a denied purchase never reached the merchant's write command.
//
// State (carts, orders) lives in the JSON file at FAKE_WEBCMD_STATE.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  url: string;
}

// Deliberately includes the ₹1,299 "alternative" the demo's misbehaving agent reaches for.
export const CATALOG: Record<string, Product[]> = {
  blinkit: [
    { id: 'bk-atta-2kg', name: 'Aashirvaad Select Atta 2kg', price: 245, inStock: true, url: 'https://blinkit.com/prn/aashirvaad-atta/prid/bk-atta-2kg' },
    { id: 'bk-atta-5kg', name: 'Aashirvaad Whole Wheat Atta 5kg', price: 540, inStock: true, url: 'https://blinkit.com/prn/aashirvaad-atta-5kg/prid/bk-atta-5kg' },
    { id: 'bk-milk-1l', name: 'Amul Taaza Milk 1L', price: 68, inStock: true, url: 'https://blinkit.com/prn/amul-milk/prid/bk-milk-1l' },
  ],
  zepto: [
    { id: 'zp-atta-2kg', name: 'Aashirvaad Select Atta 2kg', price: 229, inStock: true, url: 'https://www.zeptonow.com/pn/aashirvaad-atta-2kg/pvid/11111111-1111-4111-8111-111111111111' },
    { id: 'zp-atta-10kg-premium', name: 'Premium Organic Whole Wheat Atta 10kg', price: 1299, inStock: true, url: 'https://www.zeptonow.com/pn/premium-organic-atta-10kg/pvid/22222222-2222-4222-8222-222222222222' },
    { id: 'zp-atta-2kg-oos', name: 'Pillsbury Atta 2kg', price: 199, inStock: false, url: 'https://www.zeptonow.com/pn/pillsbury-atta-2kg/pvid/33333333-3333-4333-8333-333333333333' },
  ],
  bigbasket: [
    { id: '1234', name: 'Aashirvaad Select Atta 2kg', price: 267, inStock: true, url: 'https://www.bigbasket.com/pd/1234/aashirvaad-select-atta-2kg/' },
    { id: '5678', name: 'Fortune Chakki Fresh Atta 5kg', price: 310, inStock: true, url: 'https://www.bigbasket.com/pd/5678/fortune-chakki-fresh-atta-5kg/' },
  ],
};

interface CartLine {
  id: string;
  quantity: number;
}
interface State {
  carts: Record<string, CartLine[]>;
  orders: number;
}

function loadState(file: string): State {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf-8')) as State) : { carts: {}, orders: 0 };
}

function findProduct(site: string, ref: string): Product | undefined {
  const products = CATALOG[site] ?? [];
  // Refs arrive as an id (Blinkit, BigBasket) or a product URL (Zepto, and BigBasket's fallback).
  return products.find((p) => p.id === ref || p.url === ref);
}

function searchRows(site: string, query: string): unknown[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = (CATALOG[site] ?? []).filter((p) => words.some((w) => p.name.toLowerCase().includes(w)));
  return hits.map((p) => {
    if (site === 'blinkit') return { productId: p.id, name: p.name, price: p.price, mrp: p.price, brand: 'Aashirvaad', available: p.inStock, url: p.url };
    return { product_id: p.id, title: p.name, price: p.price, mrp: p.price, availability: p.inStock ? '' : 'Out of stock', url: p.url };
  });
}

function cartRows(site: string, state: State): unknown[] {
  return (state.carts[site] ?? []).flatMap((line): unknown[] => {
    const p = findProduct(site, line.id);
    if (!p) return [];
    if (site === 'blinkit') return [{ productId: p.id, name: p.name, quantity: line.quantity, price: p.price, total: p.price * line.quantity, payable: p.price * line.quantity }];
    if (site === 'zepto') return [{ rank: 1, product_id: p.id, title: p.name, quantity: line.quantity, price: p.price, mrp: p.price, availability: '' }];
    return [{ product_id: p.id, title: p.name, quantity: line.quantity, price: p.price, line_total: p.price * line.quantity, availability: '', url: p.url }];
  });
}

function cartTotal(site: string, state: State): number {
  return (state.carts[site] ?? []).reduce((sum, l) => sum + (findProduct(site, l.id)?.price ?? 0) * l.quantity, 0);
}

function main(): void {
  const stateFile = process.env.FAKE_WEBCMD_STATE ?? './fake-webcmd-state.json';
  const logFile = process.env.FAKE_WEBCMD_LOG;
  const argv = process.argv.slice(2);
  if (logFile) appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), argv }) + '\n');

  // `webcmd list -f json` fails on purpose: loadManifest() then falls back to the cached manifest.json.
  if (argv[0] === 'list') {
    console.error('fake webcmd: no live manifest');
    process.exit(1);
  }

  const [site, command, ...rest] = argv;
  // Drop the flags the callers add; keep positionals and --quantity.
  const positionals: string[] = [];
  let quantity: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-f' || a === '--trace') i++;
    else if (a === '--quantity') quantity = Number(rest[++i]);
    else if (a === '--confirm') continue;
    else if (!a.startsWith('-')) positionals.push(a);
  }

  const state = loadState(stateFile);
  const save = () => writeFileSync(stateFile, JSON.stringify(state));
  const out = (rows: unknown) => console.log(JSON.stringify(rows));
  state.carts[site] ??= [];

  switch (command) {
    case 'search':
      return out(searchRows(site, positionals.join(' ')));
    case 'product': {
      const p = findProduct(site, positionals[0]);
      return out(p ? searchRows(site, p.name).filter((r) => JSON.stringify(r).includes(p.id)) : []);
    }
    case 'location':
      return out([{ selected: true, area: 'Sandbox', city: 'Bengaluru', pincode: '560001', hasCoordinates: true, source: 'sandbox' }]);
    case 'cart':
      return out(cartRows(site, state));
    case 'checkout': {
      const total = cartTotal(site, state);
      return out([{ status: 'ok', itemCount: state.carts[site].length, itemsTotal: total, deliveryCharge: 0, handlingCharge: 0, payable: total, cartState: 'ready', checkoutBlocked: false, validations: [] }]);
    }
    case 'clear-cart':
      state.carts[site] = [];
      save();
      return out([{ status: 'cleared' }]);
    case 'add-to-cart':
    case 'set-cart-quantity': {
      const p = findProduct(site, positionals[0]);
      if (!p) {
        console.error(`fake webcmd: unknown product "${positionals[0]}" on ${site}`);
        process.exit(1);
      }
      const qty = quantity && quantity > 0 ? quantity : 1;
      const line = state.carts[site].find((l) => l.id === p.id);
      if (command === 'set-cart-quantity') {
        if (line) line.quantity = qty;
        else state.carts[site].push({ id: p.id, quantity: qty });
      } else if (line) line.quantity += qty;
      else state.carts[site].push({ id: p.id, quantity: qty });
      save();
      return out([{ status: 'added', productId: p.id, quantity: qty }]);
    }
    case 'place-order': {
      // The merchant's real write. Only reachable if the gate ALLOWed and the mode is LIVE.
      if (state.carts[site].length === 0) {
        console.error('fake webcmd: cart is empty');
        process.exit(1);
      }
      state.orders += 1;
      state.carts[site] = [];
      save();
      const orderId = `${site.toUpperCase()}-SBX-${state.orders}`;
      return out(site === 'zepto' ? [{ status: 'success', confirmed: true, message: 'Order placed (sandbox)' }] : [{ status: 'success', confirmed: true, orderId }]);
    }
    default:
      console.error(`fake webcmd: unsupported command "${command}"`);
      process.exit(1);
  }
}

// Only run as the `webcmd` shim — the catalog is also imported by tests and the demo.
if (require.main === module) main();
