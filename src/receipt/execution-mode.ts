// ExecutionMode — which settlement path a purchase run took.
//
// Both modes run the IDENTICAL pipeline: real search, real add-to-cart against the real merchant
// cart, real cart verification, real mandate signature/expiry/cap checks through decide(), real
// reserve balance read, real Prava draw, real signed + chain-linked receipt. Nothing is stubbed,
// mocked, or bypassed in either mode, and there is exactly one decision path (CLAUDE.md rule 8).
//
// The single difference is whether the MERCHANT's own checkout is driven to a placed order:
//
//   LIVE — webcmd walks Blinkit's real checkout funnel and the order is really placed. A receipt is
//          only signed if the merchant itself returns proof of an order (ADR-013). This is the
//          existing behaviour and is completely unchanged.
//
//   TEST — the merchant's checkout is NOT driven. The run stops after the mandate authorizes the
//          spend, settles against the real Prava test-mode reserve, and signs a receipt marked TEST
//          carrying NO merchant order id, because no merchant order exists.
//
// Why TEST mode is needed at all: Blinkit's payment step requires a human (UPI QR scanned on a
// phone), and Cash-on-Delivery is intermittently unavailable — observed live 2026-08-01, a run
// reached "Select Payment Method" with COD showing "This payment method is not available at the
// moment". That leaves the automated pipeline genuinely unable to finish, which is correct
// behaviour but makes the end-to-end flow undemonstrable. TEST mode exercises every part this
// project actually owns without needing a phone in someone's hand.
//
// NOTE on the word "test": every Prava call in this repo is already test-mode-only and always has
// been (CLAUDE.md hard rule 1) — LIVE mode does not mean live money at Prava. The distinction here is
// purely about the MERCHANT side.

export type ExecutionMode = 'TEST' | 'LIVE';

/** The CLI default is LIVE so that existing scripts, and every `gate run` invocation written before
 *  this flag existed, behave exactly as they did before. The dashboard deliberately defaults its own
 *  toggle to TEST — a safer default for a UI where a click could otherwise place a real order — and
 *  passes the mode explicitly on every call. */
export const DEFAULT_EXECUTION_MODE: ExecutionMode = 'LIVE';

export function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === 'TEST' || value === 'LIVE';
}

/** Parses a `--mode` argument. Accepts either case. Fails closed on anything unrecognized rather
 *  than silently assuming one — an unreadable mode must never quietly become LIVE and place a real
 *  order, nor quietly become TEST and skip one the caller wanted. */
export function parseExecutionMode(raw: string | undefined): ExecutionMode {
  if (raw === undefined || raw === '') return DEFAULT_EXECUTION_MODE;
  const upper = String(raw).toUpperCase();
  if (isExecutionMode(upper)) return upper;
  throw new Error(`--mode must be "test" or "live", got "${raw}"`);
}

/** The mode a receipt was produced under. Receipts written before this field existed are LIVE by
 *  definition — every one of them came from a real merchant order that really was placed. */
export function receiptExecutionMode(mode: ExecutionMode | undefined): ExecutionMode {
  return mode ?? 'LIVE';
}
