// blinkit clear-cart — remove every line from the Blinkit cart.
//
// WHY THIS EXISTS
// ---------------
// Packaged webcmd has no clear-cart for Blinkit at all (verified against the real manifest: the
// site's only cart mutation is the additive `add-to-cart`). The purchase pipeline's own
// clear-cart-once-per-session step therefore always reported "blinkit does not have a clear-cart
// command" and skipped, which is how real items from earlier sessions survived into a later
// purchase — a human approving a ₹165 cart while the real Blinkit cart held ₹330 of accumulated
// residue (observed live, 2026-08-01).
//
// Uses the identical localStorage + SYNC_CART write path as the packaged add-to-cart and this
// repo's set-cart-quantity — see set-cart-quantity.js's header for the full reasoning. Additive
// user-local adapter; the installed package is untouched (`webcmd adapter reset blinkit` undoes it).
//
// SAFETY NOTE: this only ever empties a CART. It cannot place, pay for, or cancel an order, and it
// touches no money — an emptied cart is fully recoverable by adding items again.
import { CommandExecutionError } from '@agentrhq/webcmd/errors';
import { cli, Strategy } from '@agentrhq/webcmd/registry';
import { DOMAIN, gotoBlinkit, openCartPanel, readCartState, summarizeCartResponse } from './utils.js';

function buildClearCartEvaluate() {
  return `
    (() => {
      const readJson = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
      };
      const cart = readJson('cart', { count: 0, total: 0, chargeableDeliveryCost: 0, items: {}, promoInfo: [], paymentMode: null, step: [], version: 1, promo_id: '', CartAddressScreenVisible: false, uniqueSkuInCart: 0, cart_type: '', cart_state: 'invalid' });
      const removed = Object.keys(cart.items || {}).length;
      cart.items = {};
      cart.count = 0;
      cart.total = 0;
      cart.uniqueSkuInCart = 0;
      cart.version = 1;
      localStorage.setItem('cart', JSON.stringify(cart));
      window.__reduxStore__?.dispatch?.({ type: 'SYNC_CART', cart });
      return [true, removed];
    })()
  `;
}

cli({
  site: 'blinkit',
  name: 'clear-cart',
  access: 'write',
  description: 'Remove every line from the current Blinkit cart',
  domain: DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [],
  columns: ['status', 'removed', 'remaining', 'payable', 'message'],
  func: async (page) => {
    await gotoBlinkit(page, '/');
    const result = await page.evaluate(buildClearCartEvaluate()).catch((error) => {
      throw new CommandExecutionError(`blinkit clear-cart failed: ${error?.message || error}`);
    });
    const [ok, removed] = Array.isArray(result) ? result : [];
    if (!ok) throw new CommandExecutionError('blinkit clear-cart could not write the cart');

    // Read the real cart back and REPORT what it actually says, rather than asserting success from
    // the fact that the write returned. This is the exact failure this project already hit once:
    // a clear-cart that reported success while the real cart still held items, which then silently
    // inflated a human-approved cart. `remaining` is the honest, verifiable number — callers should
    // gate on it being 0, not on this command's exit code.
    await openCartPanel(page);
    const summary = summarizeCartResponse(await readCartState(page));

    return [{
      status: summary.itemCount === 0 ? 'cleared' : 'partial',
      removed,
      remaining: summary.itemCount,
      payable: summary.payable,
      message: summary.itemCount === 0
        ? `Cleared ${removed} line(s) — cart confirmed empty`
        : `Cleared ${removed} line(s) but ${summary.itemCount} item(s) still remain`,
    }];
  },
});

export const __test__ = {
  buildClearCartEvaluate,
};
