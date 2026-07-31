# Blinkit end-to-end purchase pipeline — task checklist

Working doc for the current push to get **Blinkit** fully working end-to-end (search → cart →
purchase job → gate → receipt) before touching Zepto/BigBasket. Source of truth is the current
codebase, not `docs/*.md` (those are historical/spec reference, several phases stale — see
`docs/OUTCOME.md` for the real build history up to 2026-07-31).

Legend: `[x]` verified working (real run, not just reading code) · `[~]` implemented, not yet
live-verified this session · `[ ]` not done / broken.

## Search & Compare

- [x] Blinkit search returns real products (verified live: `maggi` query → 20 real Blinkit
      products, real prices, real images, real MRP/discount badges, "Lowest price" badge)
- [x] Blinkit search does **not** go through Anakin (confirmed by design — Blinkit needs a delivery
      location Anakin's scraper can't set) — it uses the local webcmd browser session directly,
      which is already logged in
- [ ] Zepto / BigBasket search — currently failing live with `Anakin HTTP 402` (quota/billing on
      the Anakin account). Out of scope for the Blinkit-first priority, but noted so it isn't
      mistaken for a code bug later. See `blocker.md`.
- [~] Card fields: image, title, brand, marketplace badge, price, MRP/discount, availability,
      Add to cart, View — all present in `live-search-results.tsx` and confirmed rendering live.
- [ ] **Gap vs. requested flow:** there is no quantity selector on the product card itself before
      Add to cart. Clicking "Add to cart" adds qty 1; quantity is only adjustable afterward, on
      the Cart page (`+`/`-` stepper). The user's spec lists "Quantity Selector" as a per-card
      element. Needs a decision: add a pre-add quantity stepper to the card, or confirm the
      add-then-adjust-in-cart flow is acceptable.

## Cart

- [x] Add to cart triggers a real `gate run -- webcmd blinkit add-to-cart <id> --quantity N` call —
      verified live repeatedly (each real call 15-55s), lands in both the local cart and the real
      Blinkit cart
- [x] Duplicate-item prevention — verified live: adding the same real product twice increments the
      existing line's quantity rather than creating a second row
- [x] Minimum order value banner + remaining-amount + suggested top-up products — **was built but
      never wired into the cart page, and had two real bugs; both fixed this session:**
      1. `MinCartBanner`'s "suggested top-ups" were hardcoded fake products with invented ids/prices
         (`topup-blinkit-milk`, ₹28 "Amul Taaza Toned Milk" that doesn't exist under that id) —
         directly violated "never fabricate marketplace responses." Rewritten to search the real
         `/api/shop/search` endpoint (same staple-query order `PurchaseAgent.ts` uses server-side)
         and suggest real, priced, in-stock products.
      2. The suggestion-search effect never completed — `loadingSuggestions` was both set inside the
         effect and listed in the effect's own dependency array, so setting it to `true`
         re-triggered the effect, whose cleanup cancelled the very fetch that had just started,
         every time. The real search always completed successfully server-side (confirmed via dev
         server logs); the UI just never found out. Fixed by removing it from the dependency array.
      3. Also replaced the banner's own hardcoded per-merchant minimum-value table (which
         duplicated, and could drift from, `/api/shop/config`'s `SHOP_MIN_CART_INR` — the app's own
         documented single source of truth) with a fetch of that same endpoint.
      Verified live end-to-end: real shortfall shown, real suggestions rendered, clicking one does a
      real add-to-cart, banner recalculates live, flips to "Minimum order value satisfied" once
      crossed.
- [x] Quantity +/- and remove on the Cart page — work, but **only against local state — confirmed
      this session that neither ever calls the real merchant.** Documented as a known limitation
      below rather than fixed (see "Known gaps").
- [x] "Proceed to Purchase" confirmation dialog → `/api/shop/purchase-run` — wired and reachable;
      button correctly stays disabled (verified: click has no effect, no dialog opens) until the
      **verified real cart total** clears the minimum. Not yet actually clicked/confirmed — that's
      the real-money checkpoint, see `blocker.md`.
- [x] **New this session — real-cart reconciliation.** Found live that the dashboard's local
      (sessionStorage) cart model can seriously diverge from the actual Blinkit cart — observed a
      real case of local total ₹158 vs actual real cart ₹220 (extra real products present server-
      side that the local model never knew about, almost certainly residue from an earlier test
      session that was never cleared). `/api/shop/cart-read` already existed for exactly this
      reconciliation but wasn't wired into the UI — same "built but not connected" pattern as the
      min-cart banner. Wired it into the cart page: a "Verified real Blinkit cart: ₹X · N item(s)"
      line (with manual refresh) is now the authoritative number for the minimum-order-value banner
      and the Proceed gate, with an explicit mismatch warning when it disagrees with the local
      estimate — never silently trusting the optimistic local total for a real-money decision.

## Purchase pipeline (Purchase Job → Purchase Agent → Gate CLI)

All of the following are implemented in code (`src/agent/PurchaseAgent.ts`,
`src/agent/gate-spawn.ts`, `dashboard/lib/purchase-job.ts`, `dashboard/lib/agent-cli.ts`,
`dashboard/app/api/shop/purchase-run/route.ts`, `dashboard/app/shop/purchase/[jobId]/page.tsx`)
and unit-tested (238/238 `npm test` passing, `tsc --noEmit` clean). **First real live run attempted
this session — found and fixed one serious money-safety bug; see below.**

- [x] Purchase Job created, state machine advances through
      `ADDING_TO_CART → VERIFYING_CART → WAITING_GATE → PAYING` — verified live
- [x] Real add-to-cart for every cart line (fail-closed on first failure) — verified live
- [x] Real cart read + verify (quantities, prices, total) via `resolveCartTotalInr` — verified live
- [x] Order-value check: max is a hard rail; min auto-tops-up with a real cheap item — cart cleared
      the minimum on its own this run, auto-topup path not exercised
- [x] Mandate Gate `decide()` call via `gate run -- webcmd blinkit place-order --confirm` —
      verified live: real ALLOW, real signed Transaction Authorization
      (`auth_ms9egei810d4765703fc`), reserve verified sufficient
- [ ] Reserve draw — not reached (see below)
- [ ] Real Blinkit checkout walk to a placed order — **stopped short this run**, see below
- [ ] Real order placement + Blinkit order-id extraction — still never exercised live
- [ ] Signed receipt written and chain-linked — not reached

### 🔴 Serious bug found via the first real run — fixed

The first real `--confirm` purchase run (₹160 intended: Maggi×1, Nandini×2, Arokya×1, Amul Lactose
Free×1) correctly authorized and correctly refused to draw/sign (merchant never confirmed an order
— ADR-013 discipline held). But the evidence trail exposed something worse than the checkout
blocker itself: **the real cart the job actually tried to check out was ₹354 across 10 items**,
not the ₹160/4-items the human approved — including a product (`Sids Farm Buffalo A2 Milk`) never
selected this run at all, and every intended quantity roughly doubled (Maggi 1→2, Arokya 1→2,
Nandini 2→4). This happened *despite* the job's own "Clearing previous session's cart: Cart
cleared" step reporting success.

**Root cause, confirmed live with isolated, controlled tests:**
1. `blinkit add-to-cart <id> --quantity N` is **additive, not absolute** — verified by calling it
   twice with `--quantity 1` on an empty cart and getting quantity 2, not 1. `PurchaseAgent.ts` had
   implicitly assumed it was safe to add each item once from a clean baseline.
2. `clear-cart` reporting success is **not sufficient evidence the real cart is actually empty** —
   the live job's own "cleared" cart still held real, priced items by the time the adds ran.
   Combined with (1), this silently inflated a human-approved cart by more than double.

**Fix applied (`src/agent/PurchaseAgent.ts`, Step 1):** `clear-cart` is now followed by a real cart
read; if the cart isn't confirmed empty (`cartItemCount === 0`), it retries clearing up to 3 times,
and if it still can't confirm empty, the whole run fails closed with a clear reason rather than
adding anything on top of an unverified cart. Rebuilt, `tsc --noEmit` clean, `npm test` 238/238.
**Not yet re-verified with a second live run** — that's next.

### Checkout blocker observed this run (separate from the bug above)

`merchant status: blocked` — "No final place-order/payment button is visible. Complete
address/payment selection in the browser checkout first." The real trace screenshot
(`traces/20260731203317-3a4fc634/screenshots/0001.png`) shows this was likely wrong or at least
premature: a real, enabled **"Proceed To Pay ₹359"** button *was* visible in the cart panel at that
moment — the automated funnel-walker's own detection logic may not have progressed past the cart
step for this particular (unexpectedly large, 10-item) cart. Given the cart was wrong to begin with
(see bug above), this needs re-testing against a correctly-sized real cart before concluding
anything about the checkout walker itself.

## Purchase Result page (`/shop/purchase/[jobId]`)

- [x] Page exists and implements every required field: status banner, marketplace, product,
      quantities (via items), amount, order id, payment status, receipt id + signature +
      verification, gate verdict, timestamp, download receipt button, link to full decision log
- [x] Two-stage tracking (Transaction Authorized vs. Merchant Order Confirmed vs. Receipt
      Generated) implemented as three independent milestone badges — matches ADR-013's
      "ALLOW ≠ order placed" discipline
- [ ] Not yet seen rendering a real completed (or real in-progress) job this session

## Infra / environment

- [x] Root project builds clean (`npm run build` / `tsc --noEmit`, no errors)
- [x] Full test suite passes: **238/238**, 0 failures
- [x] `webcmd doctor` — daemon/runtime/connectivity all OK, `default` profile connected
- [x] `.env` / `dashboard/.env.local` fully populated (Dodo test-mode keys, Anakin key, data dir)
- [x] **Found and fixed:** a stale `next start -p 3000` production server (built pre-session, from
      before the current uncommitted fixes) was squatting on port 3000, so all real dashboard
      traffic — including, apparently, a live search someone ran for `"hjk"` at ~00:51 — was being
      served by old, unrebuilt code. Killed it and started a fresh `next dev` bound to :3000.
      **This is the leading suspect for the reported "search stops/fails" symptom** — see
      `blocker.md`.

## Known gaps (not fixed this session — flagging, not blocking)

- Quantity `+`/`-` steppers and the trash/remove button on the Cart page are **local-only** — they
  never call a real webcmd "update quantity" or "remove from cart" command. The real merchant cart
  can therefore only grow via this UI, never shrink, until a Purchase Job's own `clearCartFirst`
  step wipes it. The real-cart reconciliation panel added this session makes this honestly visible
  (it'll show a mismatch) rather than hiding it, but doesn't fix the underlying one-way-door.
- No quantity selector on the product card itself before "Add to cart" (still add-then-adjust).
- The real Blinkit cart used for testing today accumulated cross-session cruft (a "Sids Farm
  Buffalo A2 Milk" line appeared that no click in this session added) — resolved for any real
  purchase by the Purchase Job's existing per-session `clearCartFirst` step, not chased further.

## Not started

- [ ] Zepto end-to-end (explicitly deferred until Blinkit is fully verified, per instructions)
- [ ] BigBasket end-to-end (explicitly deferred; also has a known webcmd-side add-to-cart bug and
      no place-order command at all — search-and-compare only, documented in `docs/OUTCOME.md`)
