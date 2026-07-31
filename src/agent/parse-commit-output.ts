// Pure parsing of `gate run -- webcmd <site> place-order --confirm`'s stdout — extracted so the
// logic PurchaseAgent's auto-fund-and-retry decision depends on is unit-testable without a live
// browser, same reasoning as src/webcmd/cart-total.ts and src/webcmd/commit-spec.ts.
//
// Every pattern here matches a real, existing gate.ts console.log line (see src/cli/gate.ts's
// cmdRun): the verdict line (formatGateEventLine's ALLOW/DENY/STEP_UP prefix), the OVER_TOTAL_CAP
// "over by ₹N" line, the receipt/amount/order-id lines this build added to the commit-success path.

export interface ParsedCommitOutput {
  verdict?: 'ALLOW' | 'DENY' | 'STEP_UP';
  denyCode?: string;
  /** How much the reserve is short, when the DENY was OVER_TOTAL_CAP — feeds the auto-fund amount. */
  overBy?: number;
  /** The real, signed TransactionAuthorization gate.ts creates the moment decide() returns ALLOW
   *  for a commit command — present on every ALLOW, whether or not the merchant later confirms. */
  authorizationId?: string;
  receiptId?: string;
  orderId?: string;
  commitProof?: string;
  amountInr?: number;
  /** BigBasket-style hand-off URL, for a merchant with `commit-spec.ts` proof:'none' — not used by
   *  any of the three currently configured merchants (all three now have a real orderId path) but
   *  kept for a future site that lands in that state. */
  handoffUrl?: string;
}

const VERDICT_RE = /^✗?\s*(ALLOW|DENY|STEP_UP)/m;
// The real line (src/cli/ui.ts formatGateEventLine) is `DENY  <command> · <CODE> · ₹<amount>` — the
// code sits between two " · " separators, not adjacent to the word "DENY" itself (verified: an
// earlier /DENY\s+([A-Z_]+)/ version of this regex never matched the real format at all, caught by
// this file's own tests against real gate.ts output rather than hand-assumed strings).
const DENY_CODE_RE = /·\s*([A-Z][A-Z_]+)\s*·/;
const OVER_BY_RE = /over by ₹([\d,]+(?:\.\d+)?)/;
const AUTHORIZATION_RE = /TRANSACTION AUTHORIZED (auth_[a-z0-9]+)/;
const RECEIPT_RE = /receipt (rcp_[a-z0-9]+)/;
// Anchored to the START of the line (the `m`-flag `^`) — found live: a bare /order id (\S+)/ also
// matches gate.ts's real FAILURE line "no order id returned by blinkit", since "order id" appears
// mid-sentence there too, and incorrectly extracted "returned" as a fake order id. The real success
// line (this build's own addition to gate.ts) always starts with two spaces then "order id ", never
// appearing after other text — verified by this file's own tests, including that exact failure line.
const ORDER_ID_RE = /^\s*order id (\S+)/m;
const COMMIT_PROOF_RE = /^\s*commit proof (\S+)/m;
const AMOUNT_RE = /amount ₹([\d,]+(?:\.\d+)?)/;
const HANDOFF_RE = /finish here: (https:\/\/\S+)/;

function parseInrAmount(match: RegExpExecArray | null): number | undefined {
  if (!match) return undefined;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

// gate.ts's formatGateEventLine() always emits raw ANSI color codes unconditionally (docs/AGENTS.md's
// deliberate design for the real interactive two-pane terminal) — it does no TTY detection, so a
// spawned child process's stdout (this file's real input, via gate-spawn.ts) carries them too. Found
// live: `VERDICT_RE`'s `^✗?\s*(ALLOW|...)` anchors to the true start of the line, which is the
// escape sequence itself (`\x1b[32m\x1b[1mALLOW...`), not "ALLOW" — so the match silently failed and
// `verdict` came back undefined on every real run, collapsing "authorized but awaiting merchant
// confirmation" into a generic denial. Stripping codes before parsing is the fix, not touching
// gate.ts's own terminal output — that coloring is correct and wanted for a human reading a live
// terminal, this file's job is just to read past it.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function parseCommitOutput(stdout: string): ParsedCommitOutput {
  const plain = stdout.replace(ANSI_RE, '');
  return {
    verdict: VERDICT_RE.exec(plain)?.[1] as 'ALLOW' | 'DENY' | 'STEP_UP' | undefined,
    denyCode: DENY_CODE_RE.exec(plain)?.[1],
    overBy: parseInrAmount(OVER_BY_RE.exec(plain)),
    authorizationId: AUTHORIZATION_RE.exec(plain)?.[1],
    receiptId: RECEIPT_RE.exec(plain)?.[1],
    orderId: ORDER_ID_RE.exec(plain)?.[1],
    commitProof: COMMIT_PROOF_RE.exec(plain)?.[1],
    amountInr: parseInrAmount(AMOUNT_RE.exec(plain)),
    handoffUrl: HANDOFF_RE.exec(plain)?.[1],
  };
}
