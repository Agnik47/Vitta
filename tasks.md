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

- [~] Add to cart triggers a real `gate run -- webcmd blinkit add-to-cart <id> --quantity N` call
      (confirmed the request was issued and the button entered "Adding…" state; run interrupted
      before completion — needs a clean re-run to confirm it lands in the cart)
- [ ] Duplicate-item prevention — `dashboard/lib/cart-dedup.ts` / `cart-dedup.js` exist but not yet
      exercised live this session
- [ ] Minimum order value banner + remaining-amount + suggested top-up products
      (`min-cart-banner.tsx`, `/api/shop/config` minCartInr) — implemented, not yet exercised live
      this session
- [ ] Quantity +/- and remove on the Cart page — implemented, not yet exercised live this session
- [ ] "Proceed to Purchase" confirmation dialog → `/api/shop/purchase-run` — implemented
      (`cart/page.tsx`), not yet exercised live this session

## Purchase pipeline (Purchase Job → Purchase Agent → Gate CLI)

All of the following are **implemented in code** (`src/agent/PurchaseAgent.ts`,
`src/agent/gate-spawn.ts`, `dashboard/lib/purchase-job.ts`, `dashboard/lib/agent-cli.ts`,
`dashboard/app/api/shop/purchase-run/route.ts`, `dashboard/app/shop/purchase/[jobId]/page.tsx`)
and unit-tested (238/238 `npm test` passing, `tsc --noEmit` clean), but **not yet exercised as a
real live run this session**:

- [ ] Purchase Job created, state machine advances through
      `ADDING_TO_CART → VERIFYING_CART → WAITING_GATE → PAYING → ORDER_PLACED/RECEIPT_READY`
- [ ] Real add-to-cart for every cart line (fail-closed on first failure)
- [ ] Real cart read + verify (quantities, prices, total) via `resolveCartTotalInr`
- [ ] Order-value check: max is a hard rail; min auto-tops-up with a real cheap item
- [ ] Mandate Gate `decide()` call via `gate run -- webcmd blinkit place-order --confirm`
- [ ] Reserve verification against the real Dodo test-mode ledger
- [ ] Real Dodo draw on a genuine merchant confirmation only (never on policy ALLOW alone —
      ADR-013 discipline, already encoded in `PurchaseAgent.ts`)
- [ ] Real Blinkit checkout walk (COD selection via the vendored adapter override in
      `webcmd-adapters/blinkit/place-order.js`) — **verified live in a prior session up to
      "Pay Now" with `--advance-only`, never with real `--confirm`** (see `blocker.md`)
- [ ] Real order placement + Blinkit order-id extraction — **never exercised live**, per
      `docs/OUTCOME.md`'s last addendum
- [ ] Signed receipt written and chain-linked

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

## Not started

- [ ] Zepto end-to-end (explicitly deferred until Blinkit is fully verified, per instructions)
- [ ] BigBasket end-to-end (explicitly deferred; also has a known webcmd-side add-to-cart bug and
      no place-order command at all — search-and-compare only, documented in `docs/OUTCOME.md`)
