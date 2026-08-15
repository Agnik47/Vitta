# Monad Payments Integration — Plan

Status: draft, not started. Written 2026-08-15 against the current `main` (Prava-only settlement
rail, per `README.md` / commit `95e593a`). No code in this repo depends on anything below yet.

---

## 1. What Monad actually is (and isn't)

[docs.monad.xyz](https://docs.monad.xyz/) describes Monad as an EVM-compatible Layer-1 blockchain
— 10,000 TPS, 300ms blocks, mainnet live (v0.15.1, chain ID **143**, native token **MON**). It is
**not** a payments processor. There is no "Monad Checkout" SDK, no hosted mandate/session API like
Prava's, no card-issuing product. Integrating it means talking to an EVM chain directly:
JSON-RPC calls, a signed transaction, a smart contract if any spend logic needs to live on-chain.
Concretely:

- **RPC access**: public endpoints `rpc.monad.xyz`, `rpc1-3.monad.xyz`, `rpc-mainnet.monadinfra.com`
  (rate-limited 15–300 rps), `wss://` variants for subscriptions. A dedicated RPC provider
  (Alchemy/QuickNode/Ankr, all already listed as Monad partners) is the realistic choice once this
  moves past prototyping — public endpoints are fine for read-only balance checks, not for a
  money-moving path under load.
- **Explorers**: MonadVision, Monadscan — useful for the dashboard's receipt chain to link out to a
  real, independently-verifiable transaction (something Prava/Dodo receipts can't do today).
- **Tooling**: Monad advertises "first-class support for leading Ethereum dev tools" — Foundry,
  Hardhat, viem, ethers.js all apply unmodified.

## 2. Why this is a materially different kind of integration than Prava/Dodo

Both prior rails (`src/ledger/DodoCreditLedger.ts` — retired, and the current
`src/ledger/PravaLedger.ts`) are **custodial fiat rails**: a third party holds INR, exposes a REST
API, and returns a spendable balance in paise. `Ledger.fund/balance/draw/release/credit` was shaped
around that model.

Monad is **non-custodial**: nobody holds funds on your behalf. Whoever controls the private key
that signs a transaction controls the money, full stop. That changes what "funding a mandate" and
"drawing against it" even mean, and surfaces the core design decision this plan has to make first.

### The critical open question: where does mandate enforcement live?

- **Option A — off-chain ledger, on-chain settlement.** `MonadLedger` still implements the existing
  `Ledger` interface. `fund()` asks the human to send crypto to a Vitta-controlled wallet or escrow
  contract; `draw()` has the gate's own backend sign and broadcast a transfer out of that wallet.
  Mandate rules (cap, expiry, merchant scope) stay enforced exactly where they are today — in
  `decide()` — and Monad is just a different pipe for moving value. Fastest to build, reuses nearly
  everything, but the backend now holds a hot wallet's private key, which is a bigger blast radius
  than a REST bearer token.
- **Option B — on-chain mandate contract.** A Solidity contract (`MandateEscrow.sol`) holds the
  human's deposited funds and enforces cap/expiry/merchant-scope *on-chain*, releasing funds only to
  a pre-approved payout address when called by an authorized signer (the agent's own session key).
  This is a much closer match to the project's actual thesis — "a cryptographically signed human
  decision is the only thing standing between an agent and a spend" — because the boundary becomes
  enforced by the chain itself, not by trusting the gate's Node process. Significantly more work:
  contract development, audit-grade care (this is unaudited financial code moving real value), a
  session-key or account-abstraction scheme so the agent can draw without ever touching the human's
  main key.

**Recommendation:** prototype Option A first (mirrors the existing `Ledger` shape, ships in days),
treat Option B as the "real" version worth building once Option A proves the plumbing — call this
out to the user explicitly rather than silently picking one. This plan scaffolds Option A and
records Option B's shape so the interface doesn't need to be redesigned later.

### The unsolved problem this shares with Prava

Neither Blinkit, Zepto, nor BigBasket accept on-chain payment. Prava hit exactly this wall (see
`README.md`'s "Prava integration and current checkout boundary" section) — its Browser Harness only
token-presents at Shopify. Monad has no checkout-presentment story at all; a merchant would need to
accept crypto directly (none of the three do) or there'd need to be a **crypto → fiat off-ramp**
(e.g. a card-issuing bridge funded by an on-chain balance) sitting between `MonadLedger.draw()` and
the merchant's checkout. Without that bridge, Monad can only ever be a *funding/escrow* rail behind
a receipt, exactly like Prava is today for Blinkit — not an actual checkout payment method. This
should be surfaced to the user as a go/no-go question before real engineering time goes in.

## 3. Proposed technology stack

| Concern | Choice | Why |
|---|---|---|
| Chain client library | [`viem`](https://viem.sh) | TypeScript-first, tree-shakeable, the modern default for new EVM integrations; project is already all-TS. `ethers.js` v6 is the fallback if a dependency forces it. |
| Network (dev) | Monad Testnet | Never touch mainnet MON while building; confirm current testnet chain ID/RPC from `docs.monad.xyz/developer-essentials/network-information` at build time — testnets get reset/renumbered. |
| Network (prod) | Monad Mainnet, chain ID `143` | Only after Option A/B decision is made and the off-ramp question (§2) is resolved. |
| RPC provider | Public endpoint for read-only balance polling during prototyping; a dedicated provider (Alchemy/QuickNode — both already Monad RPC partners) once `draw()` broadcasts real transactions | Public endpoints are rate-limited (15–300 rps) and offer no SLA; fine for `balance()` reads, risky for the money-moving path. |
| Settlement asset | An ERC-20 stablecoin on Monad (USDC if/when bridged, else a Monad-native stable) over native MON | Mandate amounts are INR-denominated; a volatile native-token balance makes "fund ₹800" meaningless without a live oracle. A stablecoin still needs an INR↔USD rate but avoids native-token price risk on top of that. |
| Key management (Option A) | Backend signer key in a secrets manager / KMS, never in `.env` in plaintext beyond local dev | This key can move real value the instant it's compromised — same class of risk the repo's existing `CLAUDE.md` rule 8 / ADR-015 ("route code never calls the ledger directly, only the gate CLI") already exists to contain for Dodo/Prava; a hot wallet key deserves at least that much isolation. |
| Contract tooling (Option B, if pursued) | Foundry | Fast, TS-adjacent workflow, standard for new Solidity work; would need an actual security review before any mainnet deploy — this repo has no in-house contract audit capability today. |
| Explorer links | MonadVision or Monadscan | Attach the real tx hash to the receipt chain so a Monad-settled receipt is independently verifiable — something no current rail offers. |

## 4. Where it plugs into the existing codebase

Mirrors the pattern `PravaLedger.ts` already established:

- **`src/ledger/MonadLedger.ts`** — new `Ledger` implementation (`fund`, `balance`, `draw`,
  `release`, `credit`). `decide()` in the gate never changes — it only ever sees a `Ledger`'s
  outputs, per the existing architecture note in `src/ledger/Ledger.ts`.
- **`dashboard/lib/monad.ts`** — server-only read path for the dashboard's balance UI, same shape as
  the retired `dashboard/lib/dodo.ts` / current `dashboard/lib/prava.ts` (never expose the signer
  key to client code, read-only viem client only).
- **`dashboard/app/api/shop/mandate/fund/route.ts`** — extend to accept a Monad reserve ref
  alongside the existing Dodo/Prava-shaped one, still only *attaching* an already-funded reserve
  (never completing funding from route code — same rule that already governs this file).
  Realistically "funding" here means the human sends crypto from their own wallet (e.g. via a
  WalletConnect-style flow) rather than the backend ever holding a raw checkout form.
  `checkoutUrl` in `Ledger.fund()`'s return type becomes something like "connect your wallet and
  send X to address Y" instead of a hosted checkout page.
  and MetaMask/WalletConnect UI is required somewhere in the dashboard's funding flow.
- **`dashboard/lib/execution-mode.tsx`** — the TEST/LIVE toggle's blurb currently says "Settles
  against your real Dodo test reserve"; a rail selector (Prava vs. Monad) would live near here if
  both rails coexist, or the copy just changes if Monad replaces Prava outright.
- **`dashboard/components/mandate/reserve-balance-gauge.tsx`**,
  **`dashboard/components/layout/sidebar-balance-stat.tsx`** — balance display, would need a
  crypto-amount + INR-equivalent (via rate lookup) rendering instead of a flat paise number.
- **Env vars** (naming to match existing `PRAVA_*`/`DODO_*` convention):
  `MONAD_RPC_URL`, `MONAD_CHAIN_ID`, `MONAD_SIGNER_KEY` (or a KMS reference, not a raw key, for
  anything beyond local dev), `MONAD_SETTLEMENT_TOKEN_ADDRESS` (if using an ERC-20), and, if Option
  B is pursued, `MONAD_MANDATE_CONTRACT_ADDRESS`.

## 5. Currency conversion

Every mandate amount in this codebase is INR paise (`Ledger.fund(mandateId, amountInrPaise)`).
Monad settlement is crypto-denominated. This needs one of:

1. A live INR↔token rate lookup at `fund()`/`draw()` time (adds an external price-feed dependency
   and slippage risk between quote and settlement), or
2. Restating the mandate itself in stablecoin units for any mandate funded via Monad, with the
   dashboard showing an approximate INR figure for human readability only.

(2) is simpler and avoids trusting a price oracle inside the money-moving path; worth confirming
with the user before building either.

## 6. Phased rollout

1. **Read-only spike** — `dashboard/lib/monad.ts` reads a testnet wallet/contract balance via viem,
   rendered somewhere in the dashboard. No money moves. Validates RPC access and the viem setup.
2. **`MonadLedger` (Option A) on testnet** — implement `fund/balance/draw/release/credit` against a
   backend-held testnet wallet. Exercise it through the existing `gate` CLI path exactly like
   `PravaLedger` is exercised today, never adding a second code path that calls the ledger directly
   (ADR-015).
3. **Decide the off-ramp question (§2)** — before any mainnet work, get an explicit answer on
   whether Monad is (a) an escrow/proof-of-funds layer with Blinkit/Zepto/BigBasket purchases still
   simulated (same disclosure model Prava uses today), or (b) meant to actually pay a merchant,
   which requires a crypto→fiat bridge this repo does not have.
4. **Mainnet, small caps, real receipts** — only after 1–3, and only with the key-management story
   in §3 resolved (no hot key in plaintext env vars in anything but local dev).
5. **(Optional, later) Option B on-chain mandate contract** — revisit once Option A is proven and
   there's appetite for a real Solidity security review.

## 7. Open questions for the user

- Is the goal a Monad rail *alongside* Prava (user picks per-mandate), or a *replacement*?
- Is a real merchant purchase required, or is "funds provably escrowed on-chain, purchase still
  simulated" an acceptable outcome — same disclosure posture the project already uses for Prava?
- Who holds the signer key day-to-day, and is a KMS/secrets-manager integration in scope, or is a
  local `.env` key acceptable for a hackathon/demo-grade build?
- Testnet-only for now, or is mainnet MON/stablecoin budget available for a live demo?
