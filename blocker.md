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

## Status as of this write-up

Paused mid-verification at the user's request ("wait i will say start then u start again").
Everything above reflects real findings already gathered; nothing further will be clicked/run in
the live browser or against the real gate CLI until the user says to continue.
