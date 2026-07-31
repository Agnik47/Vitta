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
