# Live-test recipe — ADR-014 cart-total fix at ₹300

Run this on the machine that already has `webcmd`, `cloakbrowser`, `.env` populated, and a real
Blinkit login. Produced as part of the ADR-014 session, on a machine without webcmd — so this
covers the specific rigorous-testing scenario the user asked for ("make cart value to 300, do
rigorous testing") that requires a real merchant session to actually run.

The resolver logic itself is covered by 20 unit tests in `src/webcmd/cart-total.test.ts` — this
recipe is for verifying the wiring end to end against a real merchant, which is the part unit
tests can never prove.

## Prerequisites (from the workspace file's Known issues list)

```bash
# 1. Fresh terminal — load .env explicitly, this project never auto-loads it.
set -a && source .env && set +a

# 2. Confirm Blinkit is still logged in (sessions go stale between rehearsals).
webcmd blinkit whoami
#   → expected: logged_in: true, real user_id

# 3. Confirm cloakbrowser is present (B-002's real root cause on both machines).
cloakbrowser info | grep -i installed
#   → expected: Installed: true
```

## Preparing the ₹300 cart

Blinkit's free-delivery threshold is typically ~₹200 for a paid user. **A ₹300 cart should
genuinely have zero delivery/handling fees** — this is the "everything agrees" happy path, and it
lets us verify the fixed code doesn't invent extra spend from thin air on well-behaved orders.

```bash
# Empty the cart first — otherwise leftover items from prior rehearsals will skew the total.
# (Blinkit doesn't have a single "clear cart" command per the manifest; remove items
# individually via `add-to-cart <productId> --quantity 0` for each existing line if needed.)
webcmd blinkit cart -f json
#   → note any existing line productIds

# Add ~₹300 worth of items. Exact SKUs will vary by location, but the pattern:
webcmd blinkit search "atta 5kg" -f json           # find a product ~₹150
webcmd blinkit add-to-cart <productId> --quantity 2   # ₹150 x 2 = ₹300

# Confirm the real cart:
webcmd blinkit cart -f json
#   → expect line items summing to ~₹300 via each line's `payable`
webcmd blinkit checkout -f json
#   → expect: payable ≈ 300, deliveryCharge: 0, handlingCharge: 0
#     (if fees appear, the cart landed below the free-delivery threshold — add another item)
```

## Building against the ADR-014 fix

```bash
cd /path/to/Vitta
git pull --rebase origin main          # pick up this session's cart-total.ts + gate.ts changes
rm -rf dist && npm test                 # expect 65/65 pass (was 45; +20 for cart-total)
npx tsc --noEmit                        # expect clean
npx tsc                                 # rebuild dist/ for the timed run pattern
```

## Test A — ₹300 ALLOW (cap = ₹500)

Should succeed. The resolver returns 300, decide() returns ALLOW, and the fixed commit path
(ADR-013's fail-closed check) requires the merchant to return a real orderId before signing
anything.

```bash
gate mandate create \
  --subject agent:grocery-runner \
  --cap 500 --per-txn 500 \
  --merchants blinkit --expires 23:59
#   → note the mnd_... id

# Fund by attaching the existing paid reserve (ADR-012 — no browser checkout mid-test).
gate fund <mandate_id> --reserve-ref <cks_... from prior session>
#   → real balance read from Dodo

gate run -- webcmd blinkit place-order --confirm
#   → expect: ALLOW · runId <uuid> · receipt rcp_...
#   → expect: real order id in `gate receipt show <rcp_...>`
```

**What to verify** (record in `docs/OUTCOME.md` under Phase 1g addendum 3):
- `gate run`'s printed `amount_inr` matches Blinkit's UI total exactly (not the cart-line sum
  alone).
- The signed receipt's `cart.total_inr` equals what the merchant actually charged.
- `network_order_id` is populated (ADR-011 fix).
- Ledger draw amount matches what decide() saw.

## Test B — ₹300 DENY OVER_PER_TXN_CAP (per-txn = ₹250)

Same cart, different mandate — should DENY with the real fee-inclusive total.

```bash
gate mandate create \
  --subject agent:grocery-runner \
  --cap 500 --per-txn 250 \
  --merchants blinkit --expires 23:59
gate fund <mandate_id> --reserve-ref <cks_...>
gate run -- webcmd blinkit place-order --confirm
#   → expect: DENY OVER_PER_TXN_CAP
#   → expect: transaction ₹300 · limit ₹250, over by ₹50
#   → NO webcmd browser action, NO ledger draw, NO receipt
```

## Test C — ₹300 DENY OVER_TOTAL_CAP (reserve balance < 300)

If the funded reserve is already low enough (or intentionally attach a smaller reserve), verify
Rule 7 fires. Skip if the current reserve is large — this rule is already covered by decide's own
unit tests; the useful thing here is only that the resolver hands the right number.

## Test D — the ADR-013 bug is caught (small cart, ₹50 cap)

The regression test. Load the cart down to ONE small item (a ₹20 product), then attempt
`place-order` under a ₹50 cap. Before ADR-014 this quietly ALLOWed and drew ₹20 for a ₹55 order.
After ADR-014 this must DENY.

```bash
# Reduce the cart to a single small item (~₹20)
webcmd blinkit checkout -f json
#   → expect: payable: 20, deliveryCharge: 30, handlingCharge: 5   (or similar small-cart fees)

gate mandate create \
  --subject agent:grocery-runner \
  --cap 50 --per-txn 50 \
  --merchants blinkit --expires 23:59
gate fund <mandate_id> --reserve-ref <cks_...>
gate run -- webcmd blinkit place-order --confirm
#   → expect: DENY OVER_PER_TXN_CAP (transaction ₹55 · limit ₹50)
#   → BEFORE THE FIX: this would have ALLOWed with ₹20 and drawn real money
```

If webcmd on that run returns `deliveryCharge: 0, handlingCharge: 0` for a genuinely fee-bearing
small cart (the exact ADR-013 shape), the resolver will still return the LARGER of `payable` and
`itemsTotal+fees`. If webcmd's ENTIRE payload uniformly under-reports (payable=20 AND fees=0), we
cannot detect that at this layer — that's a webcmd bug outside our scope. Note it in OUTCOME.md
if reproduced; do not attempt to patch webcmd (`docs/03-WEBCMD-INTEGRATION.md § Do not`).

## Cleanup

Reverse Test A's ₹300 draw against the real reserve, same way ADR-013 reversed its own accidental
₹20 draw:

```bash
# (only for Test A, which actually drew real money)
# Use the Dodo SDK directly via a temp script — see docs/OUTCOME.md Phase 1g addendum 2's
# cleanup section for the exact createLedgerEntry({type: 'credit', ...}) call.
```

Delete any test mandates created above (they're just JSON files under `mandates/`).
