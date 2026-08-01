// blinkit set-cart-quantity — set a product's cart quantity ABSOLUTELY (0 removes it).
//
// WHY THIS EXISTS
// ---------------
// The packaged `blinkit add-to-cart` is ADDITIVE, not absolute. Its own write step reads
//   quantity: current + quantity
// (clis/blinkit/add-to-cart.js, buildWriteCartEvaluate) — so calling it twice with --quantity 1
// leaves quantity 2, and there is no way at all to go DOWN. The packaged adapter set for Blinkit
// has no remove-from-cart, no update-quantity and no clear-cart: the only cart mutation it can
// express is "add more". That made a genuinely synchronized cart impossible — the dashboard could
// only ever push the real cart upward, so the two drifted apart permanently (a real ₹165 local cart
// against a real ₹330 Blinkit cart, observed live 2026-08-01), and stale items from previous
// sessions could never be cleared.
//
// This adapter adds the missing absolute-set primitive. With it, "make the real cart match what the
// human approved" becomes expressible for both directions, which is what the dashboard's cart-sync
// route is built on.
//
// HOW IT WRITES
// -------------
// Exactly the same mechanism the packaged add-to-cart already uses and that this project has
// verified live many times: Blinkit's web cart lives in localStorage under `cart`, keyed by product
// id, and the app is told about a change via a `SYNC_CART` redux dispatch; opening the cart panel
// then makes Blinkit reconcile it. Nothing here invents a new transport or touches a private API —
// it performs the same write the packaged adapter performs, just computing the target quantity
// absolutely instead of by addition.
//
// This is an ADDITIVE user-local adapter (a new command), not a modification of the installed
// package — the same sanctioned ~/.webcmd/clis override mechanism this repo already uses for
// place-order (ADR-016). `webcmd adapter reset blinkit` removes it.
import { CommandExecutionError, EmptyResultError, ArgumentError } from '@agentrhq/webcmd/errors';
import { cli, Strategy } from '@agentrhq/webcmd/registry';
import {
  DOMAIN,
  openCartPanel,
  readCartState,
  requireProductId,
  resolveCoordinates,
  summarizeCartResponse,
} from './utils.js';

/** Like utils.js's parseQuantity, but 0 is legal and meaningful here: it means "remove this line".
 *  The packaged helper rejects 0 outright (it only ever describes an amount to ADD), which is
 *  exactly the limitation this command exists to lift. */
function parseTargetQuantity(raw) {
  const quantity = raw === undefined || raw === null || raw === '' ? null : Number(raw);
  if (quantity === null || !Number.isInteger(quantity) || quantity < 0 || quantity > 12) {
    throw new ArgumentError('--quantity must be an integer between 0 and 12 (0 removes the item)');
  }
  return quantity;
}

/** Fetches the product's `cart_item` payload — only needed when ADDING a product that isn't in the
 *  cart yet, since an existing line already carries its own product payload. Same layout endpoint
 *  and same extraction the packaged add-to-cart uses. */
function buildCartItemEvaluate(productId, lat, lon) {
  return `
    (async () => {
      const headers = { lat: ${JSON.stringify(lat)}, lon: ${JSON.stringify(lon)}, app_client: 'consumer_web' };
      const resp = await fetch('/v1/layout/product/' + ${JSON.stringify(productId)}, { method: 'POST', credentials: 'include', headers });
      const json = await resp.json().catch(() => null);
      if (!resp.ok || !json) return { ok: false, status: resp.status };
      const snippets = json?.response?.snippets || [];
      const strip = snippets.find((snippet) => snippet?.widget_type === 'product_atc_strip')?.data || {};
      const action = strip.stepper_data_v2?.increment_actions?.default?.find((item) => item?.add_to_cart)
        || strip.rfc_actions_v2?.default?.find((item) => item?.remove_from_cart);
      const cartItem = action?.add_to_cart?.cart_item || action?.remove_from_cart?.cart_item || null;
      return [Boolean(cartItem), resp.status, cartItem, strip.inventory, strip.is_sold_out === true];
    })()
  `;
}

/** Reads just the current quantity of one product from the stored cart, without mutating anything.
 *  This is what makes the caller's delta computation honest — it reads the REAL current value
 *  rather than assuming the dashboard's copy is right. */
function buildReadQuantityEvaluate(productId) {
  return `
    (() => {
      const readJson = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
      };
      const cart = readJson('cart', { items: {} });
      const id = String(${JSON.stringify(productId)});
      return [true, id, Number(cart.items?.[id]?.quantity || 0)];
    })()
  `;
}

/** The absolute write. `cartItem` may be null when the line already exists (we keep its stored
 *  product payload) or when quantity is 0 (nothing to build). */
function buildSetQuantityEvaluate(productId, quantity, cartItem) {
  return `
    (() => {
      const id = String(${JSON.stringify(productId)});
      const quantity = ${quantity};
      const incoming = ${JSON.stringify(cartItem)};
      const readJson = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
      };
      const cart = readJson('cart', { count: 0, total: 0, chargeableDeliveryCost: 0, items: {}, promoInfo: [], paymentMode: null, step: [], version: 1, promo_id: '', CartAddressScreenVisible: false, uniqueSkuInCart: 0, cart_type: '', cart_state: 'invalid' });
      cart.items = cart.items || {};
      const before = Number(cart.items[id]?.quantity || 0);

      if (quantity === 0) {
        delete cart.items[id];
      } else if (cart.items[id]) {
        // Existing line: keep the product payload Blinkit already stored, change only the quantity.
        cart.items[id] = { ...cart.items[id], quantity: quantity };
      } else if (incoming) {
        cart.items[id] = {
          product: {
            product_id: incoming.product_id,
            price: incoming.price,
            image_url: incoming.image_url,
            unit: incoming.unit,
            mrp: incoming.mrp,
            group_id: incoming.group_id,
            merchant_id: incoming.merchant_id,
            name: incoming.product_name || incoming.display_name,
            brand: incoming.brand
          },
          quantity: quantity
        };
      } else {
        // Asked to set a positive quantity for a product not in the cart, with no payload to build
        // it from. Report it rather than silently writing a malformed line.
        return [false, id, before, 0, 0, 'no cart payload available for this product'];
      }

      const values = Object.values(cart.items);
      cart.count = values.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      cart.total = values.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.product?.price || 0), 0);
      cart.uniqueSkuInCart = values.length;
      cart.version = 1;
      localStorage.setItem('cart', JSON.stringify(cart));
      window.__reduxStore__?.dispatch?.({ type: 'SYNC_CART', cart });
      return [true, id, before, Number(cart.items[id]?.quantity || 0), cart.count, ''];
    })()
  `;
}

cli({
  site: 'blinkit',
  name: 'set-cart-quantity',
  access: 'write',
  description: 'Set a Blinkit cart line to an exact quantity (0 removes it)',
  domain: DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'productId', required: true, positional: true, help: 'Blinkit product id' },
    { name: 'quantity', type: 'int', required: true, help: 'Exact quantity to end up with (0-12; 0 removes the item)' },
  ],
  columns: ['status', 'productId', 'previousQuantity', 'quantity', 'itemCount', 'itemsTotal', 'payable', 'message'],
  func: async (page, kwargs) => {
    const productId = requireProductId(kwargs.productId);
    const target = parseTargetQuantity(kwargs.quantity);

    await page.goto(`https://blinkit.com/prn/x/prid/${productId}`).catch((error) => {
      throw new CommandExecutionError(`blinkit set-cart-quantity navigation failed: ${error?.message || error}`);
    });

    const current = await page.evaluate(buildReadQuantityEvaluate(productId)).catch((error) => {
      throw new CommandExecutionError(`blinkit set-cart-quantity cart read failed: ${error?.message || error}`);
    });
    const [, , currentQuantity] = Array.isArray(current) ? current : [true, productId, 0];

    // Only fetch the product payload when we genuinely need to CREATE a line. Skipping it for
    // decrements/removals keeps this fast and means a delisted product can still be removed from a
    // cart even if its product page no longer resolves.
    let cartItem = null;
    if (target > 0 && currentQuantity === 0) {
      const { lat, lon } = await resolveCoordinates(page, kwargs);
      const found = await page.evaluate(buildCartItemEvaluate(productId, lat, lon)).catch((error) => {
        throw new CommandExecutionError(`blinkit set-cart-quantity product read failed: ${error?.message || error}`);
      });
      const [foundOk, , payload, , soldOut] = Array.isArray(found) ? found : [];
      if (!foundOk || !payload) throw new EmptyResultError('blinkit set-cart-quantity', `No cart payload for product ${productId}`);
      if (soldOut) throw new CommandExecutionError(`Product ${productId} is sold out`);
      cartItem = payload;
    }

    const updated = await page.evaluate(buildSetQuantityEvaluate(productId, target, cartItem)).catch((error) => {
      throw new CommandExecutionError(`blinkit set-cart-quantity write failed: ${error?.message || error}`);
    });
    const [ok, , previousQuantity, appliedQuantity, , failureReason] = Array.isArray(updated) ? updated : [];
    if (!ok) throw new CommandExecutionError(`Could not set product ${productId} to quantity ${target}: ${failureReason || 'unknown reason'}`);

    // Read the REAL cart back rather than reporting the value we just wrote — the whole point of
    // this command is to be trustworthy as a synchronization primitive, and "I wrote it" is not the
    // same fact as "the cart now says it". Deliberately does NOT call ensureCartHasItems(): an
    // empty cart is a legitimate, successful outcome here (it's what removing the last item means),
    // unlike add-to-cart where empty would indicate failure.
    await openCartPanel(page);
    const summary = summarizeCartResponse(await readCartState(page));

    return [{
      status: target === 0 ? 'removed' : 'set',
      productId,
      previousQuantity,
      quantity: appliedQuantity,
      itemCount: summary.itemCount,
      itemsTotal: summary.itemsTotal,
      payable: summary.payable,
      message: target === 0 ? `Removed (was ${previousQuantity})` : `Set to ${appliedQuantity} (was ${previousQuantity})`,
    }];
  },
});

export const __test__ = {
  parseTargetQuantity,
  buildSetQuantityEvaluate,
  buildReadQuantityEvaluate,
};
