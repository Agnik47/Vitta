# Mandate Gate — Current Features

A snapshot of what actually exists and works in this repo today, not what's planned. See `docs/OUTCOME.md` for the full build log and `docs/common/01-PROJECT-STATUS.md` for live status. Phases 2–4 below are intentionally typed stubs, not features — see `docs/01-ARCHITECTURE.md` § What is a stub.

One-sentence pitch: a human signs "my agent may spend up to ₹800 at Blinkit, Zepto, or BigBasket, once, before 6pm today," and an AI browser-automation agent's (webcmd) write commands to those checkout flows cannot execute past that boundary — enforced by a deterministic policy engine, backed by real (test-mode) money, with every allowed action producing a signed, tamper-evident receipt.

## 1. Signed spending mandates

- `gate mandate create` issues a JSON **Mandate**: which merchants (`blinkit`/`zepto`/`bigbasket`/`district`), a total cap, a per-transaction cap, a max transaction count, and an expiry timestamp.
- Every mandate is Ed25519-signed by the issuing human's key (`src/mandate/sign.ts`, `src/cli/keys.ts`) using canonical JSON, so any post-signing edit is detectable.
- `gate mandate resign <id> --cap <n>` re-signs a mandate with a new cap (e.g. after topping up).
- Mandates render as a plain-English consent sentence (`src/mandate/render.ts`) — e.g. *"Agent may spend up to ₹800 at Blinkit, Zepto or BigBasket, once, before 6:00 PM today"* — not just raw JSON, with correct Indian digit grouping (`₹1,500`) and brand-name casing (`BigBasket`, not `Bigbasket`).
- The issuer identity is a real `did:key:z6Mk...` DID, generated from the actual Ed25519 public key (`src/mandate/did.ts`).

## 2. Deterministic policy engine (`decide()`)

- `src/policy/decide.ts` — a pure, synchronous, zero-I/O, **zero-LLM** function that takes a spend request + mandate + ledger balance and returns `ALLOW` / `DENY` / `STEP_UP`.
- Fails closed on every axis, checked in a fixed, load-bearing order: bad signature → expired mandate → unknown command → merchant not in scope → unparseable amount → over per-transaction cap → over total remaining cap → transaction-count limit.
- Reads are always free — allowed instantly with no mandate/signature check at all, so an agent can browse/search without needing a mandate.
- Every DENY carries a specific typed reason code (`DenyCode`: `BAD_SIGNATURE`, `EXPIRED`, `UNKNOWN_COMMAND`, `MERCHANT_NOT_ALLOWED`, `AMOUNT_UNPARSEABLE`, `OVER_PER_TXN_CAP`, `OVER_TOTAL_CAP`, `TXN_LIMIT_REACHED`, `ALREADY_EXECUTED`, plus `CART_DRIFT`/`INSUFFICIENT_RESERVE` reserved for later), so a demo or a dashboard can show *why* something was refused, not just that it was.
- 11 unit tests, including a dedicated regression test proving reads bypass signature/expiry checks and writes don't.

## 3. Real webcmd (browser-automation) integration

- `src/webcmd/manifest.ts` pulls the **real, live** command manifest from `@agentrhq/webcmd` (805 real commands across real site adapters, 228 of them write-access) and classifies every command as `read` or `write` — with a disk-cache fallback if the live fetch fails, so a network blip never crashes the app.
- `src/webcmd/executor.ts` actually spawns real webcmd commands against a real, stealth-Chromium-backed browser session (`cloakbrowser`/Cloak) — not a mock, not a simulation — and binds a real `runId` to every execution.
- Unknown commands (not in the manifest) fail closed via policy Rule 3 rather than being silently allowed.

## 4. Real settlement via Dodo Payments (test mode)

- `src/ledger/DodoCreditLedger.ts` implements a `Ledger` interface against the real `dodopayments` SDK, **test mode only** (`https://test.dodopayments.com`, `environment: 'test_mode'` everywhere):
  - `fund()` — creates a real Dodo Checkout Session for the mandate's cap and returns the reserve reference plus the real checkout URL a human needs to complete payment.
  - `balance()` — reads the real, live Credit Entitlement Balance.
  - `draw()` — deducts real test-mode credits on an allowed spend, using Dodo's `idempotency_key` so a retried/duplicate `runId` can never double-charge (confirmed against the live API, not assumed).
  - `release()` — releases an unused reserve.
- A separate, file-based idempotency guard (`ledger.jsonl` + `hasAlreadyDrawn()`/`recordDraw()`) provides belt-and-suspenders protection against double-execution even if the Dodo-side key were ever bypassed.
- `gate fund <mandate_id> --amount <n>` is the human-facing command that actually funds a mandate's reserve.

## 5. Signed, hash-chained receipts

- Every allowed write command produces a `Receipt` (`src/receipt/schema.ts`): what was bought, from where, for how much, which mandate authorized it, the webcmd `run_id`, and the Dodo payment reference.
- Receipts are Ed25519-signed by the *gate's* own key (distinct from the mandate issuer's key) and hash-chained to the previous receipt (`prev_receipt_hash`), so tampering with any one receipt breaks the chain link of the *next* one, not just its own signature — a stronger tamper-evidence property than per-receipt signing alone.
- `gate receipt show <id>` and `gate verify <id>` inspect and cryptographically verify a receipt (both its own signature and its chain link) from the command line.

## 6. `gate` CLI — the only way to take action

- `gate scan` — lists the real webcmd manifest and counts read vs. write commands.
- `gate mandate create` / `gate mandate resign` — issue/update signed mandates.
- `gate fund` — fund a mandate's Dodo reserve.
- `gate run -- webcmd <site> <command> [args...]` — the core action path: loads the current mandate, classifies the command via the manifest, for a real commit action (`place-order`/`checkout`) fetches the authoritative cart total from the live site, calls `decide()`, and on ALLOW executes the real browser command, draws the ledger, and signs+chains a receipt. Non-commit writes (e.g. `add-to-cart`) execute with correctly zero committed spend. On DENY, nothing touches the browser, the ledger, or a receipt.
- `gate verify` — the tamper-detection command described above.
- A live two-pane terminal UI (`src/cli/ui.ts`) shows the agent's actions on one side and the gate's decision log + reserve/settlement status on the other, in real time.

## 7. Read-only dashboard (Next.js)

- A separate `dashboard/` app, entirely GET-only — it can never create a mandate, fund a reserve, trigger a spend, or call webcmd. All real actions happen exclusively through the `gate` CLI.
- **Mandate page** (`/`) — current mandate summary plus a live Dodo reserve balance lookup against the real account.
- **Events page** (`/events`) — a live-polling feed of every `GateEvent` (every decision, allow or deny, with its reason code).
- **Receipts page** (`/receipts`) — every receipt's verify status, independently re-computing both signature validity and hash-chain validity (not just trusting the CLI's own verdict) — a live tamper test confirms a single edited field flips exactly the right badge (the tampered receipt's own signature, or the *next* receipt's chain link) within one poll cycle.

## What's explicitly not built yet (typed stubs only, by design)

- **Dispute-pack export** (Phase 2) — will bundle `{mandate, event, receipt, trace}` on a Dodo dispute webhook.
- **MCP server** (Phase 3) — will expose `mandate.check`/`mandate.request_spend`/`mandate.get_receipt` as MCP tools calling the same `decide()`.
- **Chaos testing** (Phase 4) — will kill webcmd mid-flight and replay duplicate runIds to prove the cap can never be exceeded under failure.

These throw `"Phase N not implemented"` if called — they exist only so the rest of the codebase can type-check against their eventual shape, per `docs/01-ARCHITECTURE.md`.

## Hard boundaries (by design, not missing features)

- **No LLM anywhere in the decision path** — `decide()` is pure, deterministic, synchronous data-in/data-out.
- **Test mode only, always** — no code path in this repo can reach Dodo's live host or move real money through Dodo.
- **Fail closed** — every ambiguous or unverifiable state (bad signature, expired mandate, unparseable amount, unknown command) denies, never defaults to allow.
