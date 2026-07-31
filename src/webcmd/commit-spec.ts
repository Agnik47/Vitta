// Per-merchant commit semantics: which command actually spends money, and what counts as proof
// that the merchant really placed the order.
//
// Why this exists: `src/cli/gate.ts` previously decided both questions with one string comparison —
// `command === 'place-order' || command === 'checkout'` — plus one field check, `if (!row.orderId)`.
// Both were written against Blinkit and silently wrong for every other merchant in this build.
// Verified against the packaged manifest.json (805 commands, 109 sites), before this build added
// its own custom BigBasket adapters (2026-07-31 — see webcmd/clis/bigbasket/*.js, ejected via
// `webcmd adapter eject`, since none of these commands existed in the packaged install):
//
//   blinkit    place-order -> columns include a real `orderId`. `checkout` is access:'read'
//                             ("Review Blinkit checkout totals and blockers without placing an order").
//   zepto      place-order -> columns ["status","confirmed","message"]. NO orderId, so the old check
//                             would have rejected every genuinely successful Zepto order as "did NOT
//                             complete". Its `checkout` is access:'write' AND commits nothing
//                             ("Open Zepto checkout review without placing an order"), so the old
//                             check ALSO mis-priced it as a commit.
//   bigbasket  had no order-placing command at all in the packaged install — 7 commands total, and
//                             `checkout` was likewise "Open BigBasket checkout review without
//                             placing an order". A custom `place-order` adapter now exists, modeled
//                             on Blinkit's (same `--confirm` gate, same real `orderId` in its result
//                             columns) — see webcmd/clis/bigbasket/place-order.js's own header for
//                             why it is UNVERIFIED LIVE: add-to-cart's write path has a real,
//                             thoroughly-investigated reliability problem in this session that
//                             blocks getting a real cart to place an order from at all. The proof
//                             rule below is still the correct, strictest one (`orderId`) regardless
//                             of whether the underlying click mechanism turns out to work —
//                             fail-closed either way.
//
// Why it's a separate module rather than more code in gate.ts: this is pure logic over parsed JSON,
// i.e. genuinely unit-testable without a live browser — the same reasoning that moved
// resolveCartTotalInr() out of gate.ts into cart-total.ts. Given that the last serious failure in
// this project (ADR-013) was a receipt signed for an order that never happened, the function that
// decides "did this order really happen" belongs somewhere it can be exercised against every real
// payload shape as a fast test.

/** The single result row a commit command returns. Union of the real column schemas of
 *  `blinkit/place-order` (status, confirmed, itemCount, payable, orderId, url, message) and
 *  `zepto/place-order` (status, confirmed, message). */
export interface CommitResultRow {
  orderId?: string;
  status?: string;
  message?: string;
  confirmed?: boolean;
  url?: string;
}

export interface CommitSpec {
  /** The one command for this site that is treated as real spend. */
  commit: string;
  /** Which field of that command's own result row proves the merchant accepted the order.
   *  'none' means the merchant cannot confirm an order to us at all — the gate prices the spend,
   *  runs decide(), performs the last automated step, then hands off to the human. It never draws
   *  and never signs, because there is nothing merchant-issued to attest to. */
  proof: 'orderId' | 'confirmed' | 'none';
}

export const COMMIT_SPEC: Record<string, CommitSpec> = {
  blinkit: { commit: 'place-order', proof: 'orderId' },
  zepto: { commit: 'place-order', proof: 'confirmed' },
  bigbasket: { commit: 'place-order', proof: 'orderId' },
};

/** Statuses a merchant may report that mean "the order really went through". Anything not on this
 *  list — including an absent or empty status — is not proof (CLAUDE.md rule 3). */
const SUCCESS_STATUS = /^(success|succeeded|placed|ordered|completed|confirmed|ok)$/i;

/** Is `command` the money-moving command for `site`?
 *
 *  For a site with no spec, falls back to the original name-based heuristic. That's the
 *  conservative direction: an unrecognised commit-shaped command gets priced and cap-checked
 *  rather than waved through as a ₹0 write. */
export function isCommitCommand(site: string, command: string): boolean {
  const spec = COMMIT_SPEC[site];
  if (spec) return command === spec.commit;
  return command === 'place-order' || command === 'checkout';
}

/** Proof kind to apply for a site. Unknown sites get the strictest rule (`orderId`). */
export function commitProofKind(site: string): CommitSpec['proof'] {
  return COMMIT_SPEC[site]?.proof ?? 'orderId';
}

export interface CommitProofResult {
  /** True only when the merchant gave unambiguous evidence the order exists. */
  ok: boolean;
  /** The merchant's own order id, when it issues one. */
  orderId?: string;
  /** What was accepted as proof when there is no order id, for the receipt's evidence block. */
  commitProof?: string;
}

/** Decide whether a commit command's result row proves a real order was placed.
 *
 *  Fail closed: every path that isn't an unambiguous yes returns ok:false, and the caller then
 *  draws nothing and signs nothing. This generalises the ADR-013 guarantee past its original
 *  assumption that every merchant names its proof `orderId`. */
export function evaluateCommitProof(
  row: CommitResultRow | undefined,
  proof: CommitSpec['proof'],
): CommitProofResult {
  // No order-placing command exists for this merchant, so no row can ever prove one was placed.
  if (proof === 'none') return { ok: false };
  if (!row) return { ok: false };

  if (proof === 'orderId') {
    const orderId = typeof row.orderId === 'string' ? row.orderId.trim() : '';
    return orderId ? { ok: true, orderId } : { ok: false };
  }

  // proof === 'confirmed' (Zepto).
  //
  // NOT YET VERIFIED AGAINST A LIVE RUN. `confirmed` might mean "the order was placed", or it might
  // merely echo back that `--confirm true` was passed on the command line — the manifest doesn't
  // say. If it's the latter, trusting it alone would repeat ADR-013 exactly: a signed receipt for
  // an order that never happened. So it is deliberately not sufficient by itself; a success-shaped
  // `status` from the merchant is required alongside it. Correct this once a real Zepto
  // place-order payload has actually been observed (CLAUDE.md rule 6).
  if (row.confirmed !== true) return { ok: false };
  const status = typeof row.status === 'string' ? row.status.trim() : '';
  if (!SUCCESS_STATUS.test(status)) return { ok: false };
  const orderId = typeof row.orderId === 'string' ? row.orderId.trim() : '';
  return { ok: true, orderId: orderId || undefined, commitProof: `confirmed:${status}` };
}
