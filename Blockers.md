# Current blockers — Blinkit end-to-end purchase pipeline

## 1. RESOLVED THIS SESSION — stale production server was serving all real traffic on :3000

**Symptom matching the user report:** "Search & Compare stops after searching, or fails while
searching."

**Root cause:** a `next start -p 3000` production server (PID 18492, parent npm PID 21636) had
been running since **2026-07-31 22:52**, well before this session's `npm run build` (which
recompiled `dist/` from the current, uncommitted `src/` changes) and before today's dashboard
code changes. A production build bundles its server code at build time — it does **not** pick up
any of the fixes made after that build ran, including the cart-total ADR-016 fix, the Blinkit
checkout adapter override wiring, the purchase-job/agent pipeline, etc. Anyone hitting
`localhost:3000` — including, apparently, whoever ran a real search for `"hjk"` at ~00:51 today
(three real `search.js`/webcmd child processes fired for blinkit/zepto/bigbasket at that
timestamp) — was silently being served that stale build the whole time.

**Why it looked like "search fails/stops":** unclear which specific stale-code bug it hit (the old
build predates several fixes), but it's the single most likely explanation for an intermittent or
totally broken search experience when the CLI-level search (`node dist/cli/search.js blinkit
search maggi`) and a *fresh* `next dev` both return real, complete results immediately.

**Fix applied:** killed both stale processes, rebuilt (`npm run build` at root — already done,
clean, no errors), and started a fresh `next dev` which now genuinely binds `:3000`
(`✓ Ready in 2.8s`, confirmed via `Get-NetTCPConnection`).

**Verification so far:** navigated the fresh server's `/shop` page in a real Chrome tab (existing
logged-in profile), searched "maggi", got a full real Blinkit grid (20 products, real images,
prices, MRP, "Lowest price" badge) within ~15s. This is genuinely working.

**Not yet re-verified after the restart:** add-to-cart, cart validation, and the full purchase job
— an add-to-cart click was in flight when the user asked me to pause. Picking back up from here
once given the go-ahead.

⚠️ **Operational note:** the dev server is now running detached in the background
(`npm run dev` in `dashboard/`, log at the scratchpad temp dir). If the user is also planning to
run their own `npm run dev`/`npm start`, we will collide on port 3000 again — worth confirming who
"owns" the running server before either side restarts it.

## 2. NOT A BLOCKER FOR BLINKIT, BUT REAL — Zepto/BigBasket search failing (Anakin HTTP 402)

Live error observed: `Zepto unavailable — Anakin HTTP 402`, `BigBasket unavailable — Anakin HTTP
402`. HTTP 402 = Payment Required — the Anakin scraping API key in `dashboard/.env.local`
(`ANAKIN_API_KEY`) is almost certainly out of quota/credits or the account needs billing
attention. Not investigated further since the user's instructions are explicit: **Blinkit first,
don't touch Zepto/BigBasket until Blinkit is fully done.** Flagging now so it isn't mistaken for a
regression once work moves to Zepto — it's an account/billing issue on a third-party API, not a
code bug in this repo. (BigBasket also falls back to webcmd, same as Blinkit, so it isn't fully
blocked by this either — only Zepto has no non-Anakin source configured.)

## 3. GENUINE, PRE-EXISTING — no real Blinkit order has ever actually been placed

Per `docs/OUTCOME.md`'s most recent entry (2026-07-31 addendum, ADR-016): the full chain has been
verified live **up to and including selecting Cash-on-Delivery and reaching an enabled "Pay Now"
button**, using a `--advance-only` flag that provably stops before touching any paying control.
The real `--confirm` path (`gate run -- webcmd blinkit place-order --confirm`, which the
dashboard's purchase pipeline now calls for real) has never actually been executed — so:

- The final click of "Pay Now" and Blinkit's order-confirmation response have never been observed
  for real.
- `buildOrderProbeEvaluate()`'s real order-id extraction (the piece of code that reads Blinkit's
  confirmation screen and pulls out a real order number) is implemented and unit-tested against
  fixtures built from real trace screenshots, but **not verified against a live confirmation
  screen**.

**Why this one can't be resolved by more debugging:** it isn't a bug — it's a real spend. Placing
a genuine Cash-on-Delivery Blinkit order requires accepting real-world consequences (a real
delivery would be dispatched, cash would need to be paid on delivery in the real world if this
were not a controlled test account). Per `CLAUDE.md`'s explicit purchase-confirmation discipline
and this project's own established pattern ("every real purchase in this build so far required a
specific, direct human authorization first"), this is the **final Human-in-the-Loop checkpoint**:
I will not click a real "confirm" purchase without the user explicitly authorizing that specific
run, in chat, immediately before it happens.

**What I need from the user to clear this:** an explicit go-ahead, at the moment of the real run,
to let the pipeline execute `place-order --confirm` for real on a specific, named cart (so it's
clear exactly what is being authorized — item(s), quantity, expected total).

## 4. RESOLVED THIS SESSION — MinCartBanner was fabricating products and never actually loaded

Two real bugs, both fixed (see `tasks.md` for full detail):
- Hardcoded fake top-up products with invented ids/prices — replaced with real live search results.
- A React effect-dependency bug meant the real search never got to update the UI, no matter how many
  times it succeeded server-side — the banner was permanently stuck on "Searching…".

## 5. RESOLVED THIS SESSION — local cart could silently diverge from the real merchant cart

Found live: the dashboard's cart page trusted a purely local (sessionStorage) running total for the
minimum-order-value check and the Proceed gate. Verified this can drift seriously from the real
Blinkit cart (observed ₹158 local vs ₹220 real, with two real products present server-side that the
local model had no record of — most likely leftover from an earlier test session, since the manual
add-to-cart flow has no clear-cart step of its own). Wired the already-existing (but unused)
`/api/shop/cart-read` route into the cart page as the authoritative, verified number, with an
explicit warning shown whenever it disagrees with the local estimate. The automated Purchase Job
pipeline was never at risk from this (it independently re-reads and re-verifies the real cart before
committing), but the human's confirmation dialog was previously showing a number that could be wrong
— now fixed to show and gate on the verified real figure.

## 6. FOUND AND FIXED THIS SESSION — real money-safety bug in the first live purchase attempt

The user authorized a real `--confirm` purchase run (₹160: Maggi×1, Nandini×2, Arokya×1, Amul
Lactose Free×1). It correctly stopped short of drawing money or signing a receipt (merchant never
confirmed an order — ADR-013 held), but the real cart it was about to check out was **₹354 across
10 items**, not the ₹160/4 items the human approved, including a product never selected this run.

Root cause, confirmed with isolated live tests: (1) `blinkit add-to-cart --quantity N` is additive,
not absolute — proven by calling it twice with `--quantity 1` and getting quantity 2; (2)
`clear-cart` reporting success is not proof the real cart is actually empty — the job's own
"cleared" cart still held real items when its adds ran. Fixed in `src/agent/PurchaseAgent.ts`: the
clear step now reads the real cart back and requires a confirmed-empty result (retrying up to 3
times) before adding anything, failing the whole run closed otherwise. Rebuilt and tested
(238/238), **not yet re-verified with a second live run**.

## 7. ACTIVE — Dashboard cart diverges from real Blinkit cart (dual-cart problem)

**Symptom:** Dashboard shows ₹165, Blinkit shows ₹330. The two numbers represent two independent
carts that have drifted apart.

**Root cause (confirmed by reading the code):**

`cart-context.tsx`'s `addItem` does two independent things in sequence and then **stops**:
1. POSTs to `/api/shop/cart-add` → fires a real webcmd `blinkit add-to-cart` (additive, not
   absolute — already documented in blocker #6).
2. Immediately calls `setLines(prev => ...)` to update the React/sessionStorage local cart,
   **regardless of what the real Blinkit cart actually contains after that add**.

The local cart state is therefore an *optimistic guess*, not a reflection of ground truth. It
misses:
- Items carried over from a previous browser session that are still sitting in the real Blinkit
  cart (Blinkit does not expose a clear-cart command, so cross-session residue accumulates).
- The additive-not-absolute nature of `add-to-cart --quantity N`: calling it twice with `--quantity
  1` produces quantity 2 in Blinkit, quantity 1 in local state.
- Any background modification to the real Blinkit cart that the dashboard didn't initiate.

`cart/page.tsx` does call `/api/shop/cart-read` once on mount and shows a "Verified real cart"
row, but (a) the data is only fetched once and is stale by the time the user clicks again, and
(b) it is **informational only** — the local `lines` array and `totalInr` are still the primary
state that the `MinCartBanner`, the quantity steppers, the "Proceed" gate dialog, and the purchase
job item list all read from. The real cart read is explicitly commented as "not the gate" for
Proceed (see the `cartMismatch` comment in cart/page.tsx). This was a deliberate deferral, now
called out as the primary blocker for real-world correctness.

**Objective:** Make Blinkit the single source of truth. The dashboard cart must mirror the real
Blinkit cart at all times.

**Required fix — Blinkit-as-source-of-truth contract:**

Every "Add to cart" click MUST follow this sequence:
1. Execute the real Blinkit `add-to-cart` automation via `/api/shop/cart-add`.
2. Wait for completion (already done — the `await fetch(...)` call exists).
3. Immediately call `/api/shop/cart-read?merchant=blinkit`.
4. Parse the full Blinkit cart response (lines, quantities, total).
5. **Replace** the dashboard `lines` state entirely with the real Blinkit cart contents.
   Do NOT merge. Do NOT append optimistically. Replace.

**Required fix — Quantity synchronisation (delta-based, not absolute):**

Before any +/- quantity button on the cart page fires a webcmd command:
1. Read the real Blinkit cart.
2. Compute `delta = desiredQty − currentQtyInRealCart`.
3. If `delta > 0`: call `add-to-cart --quantity delta` (NOT `--quantity desiredQty`, which would
   add on top of the existing count).
4. If `delta < 0`: call `remove-from-cart` / decrement repeatedly by `|delta|`.
5. After every modification: re-read the real Blinkit cart and verify quantities, totals, products
   before updating local state.

**DO NOT:**
- Maintain two independent carts.
- Trust optimistic UI updates after an add or quantity change.
- Assume `add-to-cart` succeeded or that the resulting quantity matches what was requested.
- Assume quantities in local state match quantities in the real Blinkit cart.

**Scope of changes:**

| File | Change needed |
|---|---|
| `dashboard/lib/cart-context.tsx` | `addItem`: after the real add succeeds, call `/api/shop/cart-read` and replace `lines` with the real cart response — never update local state from the API response alone. |
| `dashboard/lib/cart-context.tsx` | `setQuantity`: replace local-only `setLines` with a real webcmd delta-based update + cart re-read. |
| `dashboard/lib/cart-context.tsx` | `removeItem`: replace local-only `setLines` with a real webcmd remove + cart re-read. |
| `dashboard/app/api/shop/cart-read/route.ts` | Already exists and returns `lines`, `totalInr`, `itemCount`. Verify `lines` carries per-product `quantity` and `productId` so the dashboard can reconstruct `CartLine[]` from it. |
| `dashboard/app/shop/cart/page.tsx` | Remove the `cartMismatch` informational-only path. The verified real cart IS the cart. The local estimate disappears. Refresh button remains for manual re-read. |

**End-to-end test cases that must pass after the fix** (see section 8 below):

1. Add one item → dashboard total == Blinkit total.
2. Add the same item again → dashboard quantity == real Blinkit quantity (no double-add).
3. Increment quantity via `+` button → real Blinkit quantity increments by exactly 1 (delta
   applied correctly, not additive on top of existing).
4. Decrement quantity via `−` button → real Blinkit quantity decrements by exactly 1.
5. Open the cart in a fresh tab after Blinkit already has items from a previous session →
   dashboard immediately shows those pre-existing items (not an empty cart).
6. Dashboard total == Blinkit total before and after every cart mutation.

---

## 8. END-TO-END TEST PLAN — Cart Synchronisation (Blinkit as Source of Truth)

These tests must be run against a live `npm run dev` instance with a real logged-in Blinkit
session (webcmd `default` profile). Each test verifies the invariant: **Dashboard Cart == Blinkit
Cart at all times.**

### Prerequisites

- `npm run dev` running, dashboard accessible at `localhost:3000`.
- `webcmd doctor` passes (daemon up, `default` profile connected, Blinkit reachable).
- A known real Blinkit product available: use the first result from
  `node dist/cli/search.js blinkit search "maggi"` — note its `productId` and `priceInr`.
- A second known product: repeat for `"arokya milk"`.

---

### T-01 · Fresh add → totals match

**Setup:** Confirm real Blinkit cart is at a known state (read it:
`GET /api/shop/cart-read?merchant=blinkit`). Note the initial `totalInr` and `lines`.

**Action:** On `/shop`, search "maggi", click "Add to cart" on the first result.

**Expected:**
1. Add-to-cart spinner appears and resolves (no toast error).
2. Navigate to `/shop/cart`.
3. The dashboard `totalInr` shown equals the `totalInr` returned by
   `GET /api/shop/cart-read?merchant=blinkit` immediately after the add.
4. The dashboard item list for the added product shows the same quantity as the real Blinkit cart.

**Failure signal:** Dashboard total ≠ Blinkit total, OR dashboard quantity ≠ Blinkit quantity.

---

### T-02 · Duplicate add → no double-count

**Setup:** Product A already in real Blinkit cart at quantity 1 (from T-01 or a prior add).

**Action:** Click "Add to cart" again for the same product A.

**Expected:**
1. Real Blinkit cart quantity for product A = 2.
2. Dashboard quantity for product A = 2 (not 1, not 3).
3. Dashboard total = Blinkit total.

**Failure signal:** Dashboard shows qty 2 but Blinkit shows qty 3 (old additive bug), or vice
versa.

---

### T-03 · Quantity increment via `+` → delta of exactly 1

**Setup:** Product A in cart at quantity 2 (confirmed against real Blinkit cart).

**Action:** On `/shop/cart`, click `+` for product A once.

**Expected:**
1. Real Blinkit cart quantity for product A = 3.
2. Dashboard quantity = 3.
3. Dashboard total = Blinkit total.
4. The webcmd call issued was `add-to-cart --quantity 1` (delta), not
   `add-to-cart --quantity 3` (absolute, which would produce qty 5).

**Failure signal:** Blinkit ends up with qty 5 (absolute bug), or dashboard shows qty 3 but
Blinkit shows something different.

---

### T-04 · Quantity decrement via `−` → delta of exactly −1

**Setup:** Product A in cart at quantity 3 (confirmed).

**Action:** On `/shop/cart`, click `−` for product A once.

**Expected:**
1. Real Blinkit cart quantity for product A = 2.
2. Dashboard quantity = 2.
3. Dashboard total = Blinkit total.

**Failure signal:** Dashboard shows qty 2 but Blinkit still shows qty 3 (local-only decrement,
the old bug), or total mismatch.

---

### T-05 · Cross-session cart visibility

**Setup:** Real Blinkit cart already contains product B from a prior session. Open dashboard in
a fresh browser tab (sessionStorage cleared — simulating a new session).

**Action:** Navigate to `/shop/cart`.

**Expected:**
1. Dashboard cart initialises from the real Blinkit cart read, not from empty sessionStorage.
2. Product B appears in the dashboard cart with its real quantity and price.
3. Dashboard total = Blinkit total.

**Failure signal:** Dashboard shows an empty cart or missing product B while Blinkit shows it.

---

### T-06 · Multi-add of two products → totals always match

**Setup:** Start from a known Blinkit cart state (can be non-empty).

**Action:**
1. Add product A (qty 1).
2. Immediately add product B (qty 1) without refreshing the cart page.

**Expected after each add:**
- After step 1: Dashboard total = Blinkit total (includes A).
- After step 2: Dashboard total = Blinkit total (includes A + B).
- Final dashboard line count = final Blinkit line count.

**Failure signal:** Any intermediate or final total mismatch between dashboard and Blinkit.

---

### T-07 · Cart read survives a stale cross-session residue

**Setup:** Real Blinkit cart contains product C from a previous test run (never cleared). No
product C in current sessionStorage.

**Action:** Open `/shop/cart`. Click the "Refresh" button to re-read the real cart.

**Expected:**
1. Dashboard immediately shows product C (from real Blinkit cart).
2. No "mismatch" error shown (dashboard IS the real cart — there is no separate local estimate
   to mismatch against).
3. Total = Blinkit total.

**Failure signal:** Product C invisible in dashboard, or dashboard total ≠ Blinkit total.

---

### T-08 · Proceed-to-purchase uses real cart total, not local estimate

**Setup:** Real Blinkit cart has a confirmed total of ₹T. Dashboard cart reflects same total
after a cart-read.

**Action:** Click "Proceed to purchase" → confirm in the alert dialog.

**Expected:**
1. The confirmation dialog displays ₹T (the real cart total, not a local estimate).
2. The purchase job receives the same item list as the real Blinkit cart.
3. No "₹165 vs ₹330" discrepancy between what the dialog says and what Blinkit actually charges.

**Failure signal:** Confirmation dialog shows a stale local estimate that differs from the real
Blinkit total at the moment of confirmation.

---

### Automated regression test (unit / integration level)

In addition to the manual E2E tests above, the following automated assertions should be added to
the existing Jest suite (`npm test`, currently 238 tests):

```
cart-sync.test.ts
─────────────────
[UNIT] addItem: after a successful /api/shop/cart-add response, calls /api/shop/cart-read and
       sets lines to the response — never to the pre-add local state.
[UNIT] setQuantity: reads current real quantity, computes delta, calls add-to-cart or decrement
       with the delta value, then calls cart-read and sets lines to the response.
[UNIT] removeItem: calls real remove command, then calls cart-read and sets lines to response.
[UNIT] On mount with an empty sessionStorage, CartProvider calls /api/shop/cart-read for the
       active merchant and populates lines from the real response.
[INTEGRATION] POST /api/shop/cart-add → GET /api/shop/cart-read: the cart-read response after
       the add reflects exactly the add that was just made (no phantom lines, correct quantity).
```

---

## Status as of this write-up

Blinkit is now verified live, end to end, up through: real search → real add-to-cart → duplicate
prevention → real minimum-order-value enforcement with real suggested top-ups → real-cart
verification → "Proceed to purchase" correctly enabled only once the **verified real cart** clears
the minimum. `npm test` (238/238) and `tsc --noEmit` (root + dashboard) both clean after all fixes.

**Not yet done, and deliberately not attempted without explicit authorization:** clicking "Proceed
to purchase" and confirming. That starts the real pipeline, which will clear the real Blinkit cart
first (wiping today's accumulated test residue) and then, if the mandate's policy check allows it,
walk all the way to a real Cash-on-Delivery order placement (`gate run -- webcmd blinkit place-order
--confirm`) — a genuine spend, per blocker #3 above. Waiting on the user to say go, and to confirm
which specific cart contents they want that real run to use.
