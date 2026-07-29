# 05 — Demo Script (Acceptance Test)

Read `00-PRODUCT-BRIEF.md` through `04-POLICY-ENGINE-SPEC.md` first. This file is the acceptance test for the whole build: if the CLI produces this exact sequence of output, Phase 1 is done. Pitch narration and delivery notes for the live presentation are a separate concern, out of scope for this file — this file only covers what the code must produce.

## What this file is for

Everything in `01` through `04` describes components. This file describes the one continuous run that proves they work together. Every code block below is a literal terminal output the built system must produce, not an illustration.

## Pre-demo state

```
$ webcmd doctor
✓ browser bridge OK · daemon OK

$ webcmd list -f json > manifest.json
✓ 112 sites, 302 commands cached
```

## Beat 1 — Manifest scan

```
$ gate scan
✓ webcmd manifest loaded — 112 sites, 302 commands
  192 marked access:'write'
  0 currently governed
```

`gate scan` reads `manifest.json` (never live-fetches during a demo run) and prints counts computed from the real cached data, not hardcoded numbers.

## Beat 2 — Mandate creation

```
$ gate mandate create --subject "agent:grocery-runner" --cap 800 --per-txn 800 \
    --merchants blinkit,zepto,bigbasket --expires "18:00"

✓ MANDATE mnd_01J8FQ signed

  "agent:grocery-runner may spend up to ₹800 at Blinkit, Zepto or BigBasket,
   in one transaction, before 6:00 PM today."

  ed25519 · issuer did:key:z6Mk... · reserve ₹800 blocked (Dodo, test mode)
```

This must call the real `sign()` from `04-POLICY-ENGINE-SPEC.md`, the real `renderConsent()`, and the real `DodoCreditLedger.fund()` from `02-DODO-INTEGRATION.md`. The reserve line must reflect an actual Checkout Session ID, not a placeholder string.

## Beat 3 — Free reads

```
$ gate run -- webcmd blinkit search "atta"
AGENT                          GATE
› blinkit search "atta"        ✓ ALLOW  read   · free, no check

$ gate run -- webcmd blinkit add-to-cart --sku atta-5kg --qty 1
› blinkit add-to-cart ×7        ✓ ALLOW  write  · ₹0 committed

$ gate run -- webcmd blinkit cart
› blinkit cart                 ✓ ALLOW  read   · total ₹1,412
```

The `GATE` column must be a real `GateEvent` rendered to terminal, not a scripted string. Verify by running against a live webcmd session with cart contents that don't equal ₹1,412, and confirm the printed total matches.

## Beat 4 — The refusal (the demo's climax)

```
$ gate run -- webcmd blinkit place-order --confirm

✗ DENY  blinkit/place-order
  OVER_TOTAL_CAP
  cart ₹1,412 · mandate ₹800
  over by ₹612

  reserve untouched
  NO BROWSER ACTION TAKEN
  → step-up required
```

This must be produced by an actual DENY verdict from `decide()` (rule 7, `OVER_TOTAL_CAP`), with `overBy` computed from the real cart total captured in Beat 3, not hardcoded. Confirm no `spawn('webcmd', ...)` call happens on this path — the executor must never be invoked when `decide()` returns DENY.

## Beat 5 — Step-up and completion

```
$ gate mandate resign mnd_01J8FQ --cap 1500

✓ MANDATE mnd_01J8FR signed — ₹1,500

$ gate run -- webcmd blinkit place-order --confirm
✓ ALLOW  write
  ₹1,412 ≤ ₹1,500 · txn 1/1
  runId run_4821_1754... bound
  reserve ₹1,500 → drawn ₹1,412
✓ order submitted                     [Dodo Payments TEST MODE captured]
```

This is the first point the real executor (`src/webcmd/executor.ts`) spawns webcmd for real, captures a real `runId`, and `DodoCreditLedger.draw()` is called with that `runId` as the idempotency tag.

## Beat 6 — The receipt

```
$ gate receipt show rcp_9K2

✓ RECEIPT rcp_9K2 signed

  mandate  sha256:4f2a...        cart     blinkit · 7 items · ₹1,412
  payment  dodo_test · captured
  run      blinkit/place-order · run_4821_1754...
  evidence trace sha256:8c1d... · order #BLK-88213
  prev     sha256:0000...        (chain head)

$ gate verify rcp_9K2
✓ signature valid · chain intact
```

Every field must come from real data: the mandate hash from the actual signed mandate, the trace digest from webcmd's real `--trace` artifact (sha256 of the file), the order ID from webcmd's real command output.

## Beat 7 — Tamper test

```
$ sed -i 's/1412/9999/' receipts/rcp_9K2.json
$ gate verify rcp_9K2
✗ signature invalid — receipt tampered at field `cart.total_inr`
```

`gate verify` must re-run `verifyReceipt()` against the on-disk file, not a cached in-memory copy — a real edit to the JSON file must cause a real verification failure.

## Beat 8 — Idempotency check

```
$ gate run -- webcmd blinkit place-order --confirm --run-id run_4821_1754...
✗ DENY  blinkit/place-order
  ALREADY_EXECUTED
  runId run_4821_1754... already drawn ₹1,412 — refusing to double-charge
```

Re-submitting a known `runId` must check `ledger.jsonl` and refuse to call `Ledger.draw()` a second time, even if `decide()` alone would return ALLOW.

## Acceptance checklist — Phase 1 is done only when every line below is true

- [x] Beats 1–6 run end-to-end against a real webcmd session on a real merchant site, with a real Dodo test-mode Checkout Session and Credit Entitlement Balance — **done 2026-07-29, Agent B.** Real ₹476 Blinkit order (2× Aashirvaad Atta 5kg), real Dodo test-mode draw (₹1,800 → ₹1,324), real signed receipt `rcp_ms66xl2ef9771fa00056`. See `docs/OUTCOME.md` Phase 1g addendum.
- [x] The DENY in Beat 4 is produced by `decide()`, and no `webcmd` subprocess is spawned on that path — confirmed prior session (Beats 1-4 rehearsal) and by code inspection (`execute()` unreachable from the DENY branch).
- [x] `gate verify` (Beats 6 and 7) reflects real signature verification, not a hardcoded pass/fail — confirmed 2026-07-29 against the real receipt above, both directions (valid → tampered `total_inr` → invalid → restored → valid again), CLI and dashboard `/api/receipts` both checked.
- [x] The whole run, timed, completes within 4 minutes — **done 2026-07-29: 84 seconds**, all 8 beats run continuously. Two conditions matter: run from a compiled build (`node dist/cli/gate.js`, not `ts-node` — that alone cost ~1 min of startup overhead), and fund via `gate fund --reserve-ref` (ADR-012) so no browser checkout interrupts the run. Full timings in `docs/OUTCOME.md` Phase 1g addendum 2.
- [x] A fallback recording of this exact sequence exists on disk, dated, before 31 Jul night — **done 2026-07-29**: `demo/mandate-gate-fallback-2026-07-29.mp4` (4m32s, 1920×1080). Per the user's explicit choice, this is a **narrated replay** of the real run's captured output, not a live screen capture (the alternative would have needed a second real purchase). Every line of terminal output in it is real, verbatim from this run. The video's own title card states it's a replay — see `demo/README.md` for exactly what it is and isn't.

Beat 8 (idempotency retry) now produces a real `DENY ALREADY_EXECUTED`, exactly as this file's sketch specifies — confirmed 2026-07-29. Earlier runs showed `TXN_LIMIT_REACHED` instead, which turned out to be an artifact of creating the mandate with `--max-txns 1`: `decide()`'s transaction-count rule fired before the idempotency guard was ever reached. Creating the mandate with `--max-txns 2` lets `decide()` return ALLOW on the retry so the guard itself is the thing that refuses. **Use `--max-txns 2` when demoing Beat 8.**

## ⚠️ Phase 1 is NOT fully closed — one blocking correctness bug remains

Every box above is checked, but two real bugs were found during the first complete end-to-end run (2026-07-29) and one is still open. Do not present Phase 1 as finished without reading `docs/OUTCOME.md`'s Phase 1g addendum 2 and `docs/common/02-DECISIONS.md` ADR-013.

1. **FIXED — `gate run` signed a receipt for an order that was never placed.** webcmd returned exit 0 and `status: "success"` while the browser had merely stopped at Blinkit's "Proceed To Pay" step; the gate drew real money and signed a `captured` receipt for a non-existent purchase, which `gate verify` then confirmed as valid (correctly — it *was* validly signed). Now fails closed: no merchant order id → no draw, no ledger entry, no receipt, non-zero exit. See ADR-013.
2. **STILL OPEN — the cart total fed to `decide()` is not always the real payable.** webcmd's `blinkit cart`/`checkout` reported `payable: 20` with zero fees while Blinkit's own UI showed ₹20 + ₹30 delivery + ₹5 handling = **₹55**. A ₹20 cart that is really ₹55 could clear a ₹50 cap. This directly contradicts `docs/03-WEBCMD-INTEGRATION.md` § Step 3's "authoritative total" premise and is a genuine policy-correctness gap, not cosmetic. Only invisible on large carts that clear the free-delivery threshold.

This is not a suggestion list — every box must be checked against a real run, with real pasted output, before Phase 1 is considered complete. Log the result in `docs/OUTCOME.md`. **Boxes are all checked, but item 2 above must be resolved before Phase 1 can honestly be called done.**
