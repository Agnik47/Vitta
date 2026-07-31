# webcmd adapter overrides

Version-controlled overrides for webcmd's packaged site adapters. Full rationale:
`docs/common/02-DECISIONS.md` **ADR-016**.

```bash
node webcmd-adapters/install.mjs                      # install / update
node webcmd-adapters/blinkit/place-order.verify.mjs   # 37 offline checks, no browser
webcmd blinkit place-order --advance-only -f json     # live dry run, spends nothing
webcmd adapter reset blinkit                          # undo, restore packaged behaviour
```

## How the override works

`dist/src/main.js` discovers `BUILTIN_CLIS` first, then `USER_CLIS` (`~/.webcmd/clis/`), and
`registerCommand` is last-write-wins. A file in the user directory therefore **shadows** the
packaged command. This is webcmd's own sanctioned extension point — `adapter-shadow.js` exists to
report shadowing, and `webcmd adapter reset <site>` exists to undo it. The installed package is
never modified, so its tests keep passing.

`install.mjs` also copies the packaged `utils.js` alongside the override (unmodified — the override
imports it relatively). Re-run the installer after upgrading webcmd to re-sync it.

## `blinkit/place-order`

| File | What it is |
| --- | --- |
| `blinkit/place-order.js` | The override. Deployed to `~/.webcmd/clis/blinkit/`. |
| `blinkit/place-order.upstream-0.4.3.js` | The verbatim packaged original, for diffing. |
| `blinkit/place-order.verify.mjs` | Offline checks against a stub DOM built from real trace labels. |

### Why it exists

The packaged adapter matches only `/^place order$/i`, `/^pay( now)?$/i`, `/^cash on delivery$/i`
— all `^…$`-anchored — so Blinkit's compound `"₹184 TOTAL Proceed To Pay ›"` bar never matches and
the command reports `blocked` while exiting 0. That is **deliberate upstream policy**, not a bug:
the package's own test asserts `expect(script).not.toContain('Proceed')`. It will only click a
genuinely-final control on an already-advanced checkout. This project needs one screen further.

### What it adds

1. **Walks the funnel.** Classifies visible controls as ADVANCE (moves no money), COMMIT (can
   charge), or BLOCKED (needs a human), deepest-node-wins, and steps through them with a bounded
   budget. ADVANCE beats COMMIT on ties so `"…Proceed To Pay ₹184"` is never mistaken for a
   paying button.
2. **Reaches into the payment iframe.** Blinkit renders payment methods via Zomato zpaykit in a
   cross-origin iframe, invisible to a top-level `querySelectorAll`. Uses `page.frames()` +
   `page.evaluateInFrame()`.
3. **Selects Cash on Delivery.** The DOM renders it as just `Cash` — the name "Cash on Delivery"
   appears only in zpaykit's API payload. Opening that section *is* the selection. Success is
   confirmed by the parent page's "Pay Now" becoming **enabled**, not by matching a label.
4. **Never clicks a disabled control.** A greyed "Pay Now" is reported as disabled, never counted
   as a commit.
5. **`--advance-only`.** Walks to the payment step and stops, provably never touching a paying
   control. This is how the fix was verified live without spending money — use it for any dry run.

### Honesty properties (these are the point)

- A commit click that returns no order id reports `submitted_unconfirmed`, **never** `placed`, and
  warns that an order may exist so nobody retries into a double charge.
- Hitting a human-only rail (UPI PIN, OTP, 3DS) reports `action_required`, not success.
- `gate run` still fails closed on an empty `orderId` (ADR-013): no ledger draw, no signed receipt.

### Statuses

| `status` | Meaning |
| --- | --- |
| `no-op` | Neither `--confirm` nor `--advance-only` given. Nothing touched. |
| `advanced` | `--advance-only` reached the payment step and stopped. |
| `action_required` | Stopped at a step a human must complete. Nothing charged. |
| `placed` | Merchant returned a real order id. The only success status. |
| `submitted_unconfirmed` | A paying control was clicked but no order id appeared. **Verify manually.** |
| `failed` | Merchant reported a payment/order failure. |
