// Agent 4 — Purchase Agent. Takes the Evaluator's proposal and tries to buy it — through the gate.
//
// This is the existing PurchaseAgent (src/agent/PurchaseAgent.ts) given an A2A face; none of its
// mechanics are reimplemented. Every merchant write it makes is a spawned `gate run -- webcmd ...`,
// and the gate — not this file, not a model — reads the REAL merchant cart, prices it, runs
// decide(), and either refuses (DENY/STEP_UP: the browser action never happens, nothing is drawn) or
// authorizes. This file never imports decide(), the webcmd executor, or a ledger, and has no way to
// reach the merchant except through the gate CLI (enforced by src/agents/security.test.ts).
//
// Two things it deliberately does NOT do:
//   • It does not pre-check the proposal against the mandate. That would be a second, weaker policy
//     engine. An over-cap proposal is sent to the gate like any other and refused there, on the
//     real cart total, with the gate's own reason.
//   • It does not auto-fund. PurchaseAgent can top up a reserve within the mandate cap when handed a
//     mandate id; an autonomous agent should never be able to add money, so none is passed.
import { runSearch } from '../agent/gate-spawn';
import { PurchaseAgent, type PurchaseInput, type PurchaseResult, type PurchaseStepEvent } from '../agent/PurchaseAgent';
import { parseCommitOutput } from '../agent/parse-commit-output';
import { loadAllMandates, loadAuthorization, loadReceipt } from '../cli/store';
import { fileIdempotencyStore, type IdempotencyStore } from './idempotency';
import { resolveProductRef } from './product-ref';
import { invalidInput } from './usage-hint';
import {
  AgentFault,
  StepRecorder,
  agentFail,
  agentOk,
  isProposal,
  isShoppingIntent,
  type AgentError,
  type AgentHandler,
  type AgentResult,
  type ExecutionMode,
  type MerchantId,
  type Proposal,
  type PurchaseOutcome,
  type PurchaseStatus,
  type ShoppingIntent,
} from './protocol';

const NAME = 'vitta-purchase-agent' as const;

export interface MandateSummary {
  mandate_id: string;
  per_txn_inr: number;
  cap_inr: number;
}

/** Which merchants have a `clear-cart` command in manifest.json. Verified against it (and re-checked
 *  by purchase.test.ts, so this cannot silently drift): only Blinkit does. For the others the agent
 *  cannot empty a cart, so it checks the real cart is already empty instead of buying on top of it. */
export const CAN_CLEAR_CART: Record<MerchantId, boolean> = { blinkit: true, zepto: false, bigbasket: false };

export interface CartCount {
  ok: boolean;
  itemCount?: number;
  message?: string;
}

export interface PurchaseDeps {
  runPurchase: (input: PurchaseInput, onEvent: (event: PurchaseStepEvent) => void) => Promise<PurchaseResult>;
  /** A real, read-only look at the merchant's cart — never a write. */
  readCartItemCount: (merchant: MerchantId) => Promise<CartCount>;
  /** The mandate `gate run` will resolve — same rule as the gate: the most recently created one. */
  currentMandate: () => MandateSummary | undefined;
  /** The gate's own run id, read back from the signed receipt or authorization it wrote. */
  runIdFor: (ids: { receipt_id?: string; authorization_id?: string }) => string | undefined;
  idempotency: IdempotencyStore;
}

export function defaultPurchaseDeps(): PurchaseDeps {
  return {
    runPurchase: (input, onEvent) => new PurchaseAgent(onEvent).run(input),
    readCartItemCount: async (merchant) => {
      const result = await runSearch([merchant, 'cart']);
      try {
        const parsed = JSON.parse(result.stdout.trim() || '{}') as { ok?: boolean; cartItemCount?: number; message?: string };
        return { ok: parsed.ok === true, itemCount: parsed.cartItemCount, message: parsed.message };
      } catch {
        return { ok: false, message: result.stderr.trim() || 'could not parse the cart read' };
      }
    },
    currentMandate: () => {
      const all = loadAllMandates();
      const latest = all[all.length - 1];
      return latest ? { mandate_id: latest.mandate_id, per_txn_inr: latest.scope.per_txn_inr, cap_inr: latest.scope.cap_inr } : undefined;
    },
    runIdFor: ({ receipt_id, authorization_id }) => {
      try {
        if (receipt_id) return loadReceipt(receipt_id).execution.run_id;
        if (authorization_id) return loadAuthorization(authorization_id).run_id;
      } catch {
        // best-effort trace metadata only; never affects the outcome
      }
      return undefined;
    },
    idempotency: fileIdempotencyStore(),
  };
}

// ---------------------------------------------------------------------------------------------
// PurchaseResult -> PurchaseOutcome. Pure, so every real gate outcome is unit-testable.
// ---------------------------------------------------------------------------------------------

export function toOutcome(
  result: PurchaseResult,
  mandate: MandateSummary | undefined,
  runId: string | undefined,
): PurchaseOutcome {
  const failure = (result.failureReason ?? '').trim();

  // A denial can land on an EARLIER gated write (an expired mandate, a bad signature or an
  // out-of-scope merchant all stop at add-to-cart, before place-order is ever tried). PurchaseAgent
  // reports those as a pre-authorization failure with no verdict, but the gate's own DENY line is
  // right there in the text — recover it, so a Vitta denial is never flattened into "purchase failed".
  const fromText = result.verdict || result.ok ? undefined : parseCommitOutput(failure);
  const verdict = result.verdict ?? (fromText?.verdict === 'DENY' || fromText?.verdict === 'STEP_UP' ? fromText.verdict : undefined);
  const denyCode = result.denyCode ?? (verdict === 'DENY' ? fromText?.denyCode : undefined);

  const status: PurchaseStatus = result.ok
    ? result.handoff
      ? 'HANDOFF'
      : 'PURCHASED'
    : verdict === 'DENY'
      ? 'DENIED'
      : verdict === 'STEP_UP'
        ? 'STEP_UP_REQUIRED'
        : result.awaitingMerchantConfirmation
          ? 'AWAITING_MERCHANT'
          : 'FAILED';

  return {
    status,
    merchant: result.merchant,
    mode: result.mode,
    mandate_id: mandate?.mandate_id,
    verdict,
    deny_code: denyCode,
    // For a DENY the reason is Vitta's own code, verbatim — never paraphrased into "purchase failed".
    reason: verdict === 'DENY' && denyCode ? denyCode : failure ? failure.slice(0, 600) : undefined,
    requested_amount_inr: result.finalAmountInr,
    allowed_amount_inr: denyCode === 'OVER_PER_TXN_CAP' ? mandate?.per_txn_inr : undefined,
    authorization_id: result.authorizationId,
    receipt_id: result.receiptId,
    order_id: result.orderId,
    run_id: runId,
    ledger_unreachable: /reserve balance read failed/i.test(failure) ? true : undefined,
    events: result.events.map((e) => ({ step: e.step, status: e.status, detail: e.detail, timestamp: e.timestamp })),
  };
}

function inr(n: number | undefined): string {
  return n === undefined ? '₹?' : `₹${n.toLocaleString('en-IN')}`;
}

/** The structured error a non-PURCHASED outcome maps to. The original reason always survives. */
export function outcomeError(outcome: PurchaseOutcome): AgentError | undefined {
  switch (outcome.status) {
    case 'PURCHASED':
    case 'HANDOFF':
      return undefined;
    case 'DENIED':
      return {
        code: 'VITTA_DENIED',
        message:
          `Vitta denied ${outcome.merchant}/place-order: ${outcome.deny_code ?? 'DENIED'}` +
          (outcome.requested_amount_inr !== undefined ? ` — cart ${inr(outcome.requested_amount_inr)}` : '') +
          (outcome.allowed_amount_inr !== undefined ? `, limit ${inr(outcome.allowed_amount_inr)}` : '') +
          '. The browser action was not executed and nothing was drawn.',
        details: outcome,
      };
    case 'STEP_UP_REQUIRED':
      return {
        code: 'VITTA_STEP_UP_REQUIRED',
        message: `Vitta requires step-up for ${outcome.merchant}/place-order (merchant blocked checkout or the mandate needs re-signing). Nothing was executed or drawn.`,
        details: outcome,
      };
    case 'AWAITING_MERCHANT':
      return {
        code: 'PURCHASE_ERROR',
        message: `Vitta authorized the spend (${outcome.authorization_id ?? 'no id'}) but ${outcome.merchant} has not confirmed an order. Nothing was drawn and no receipt was signed.`,
        details: outcome,
      };
    case 'FAILED':
      return {
        code: outcome.ledger_unreachable ? 'LEDGER_ERROR' : 'PURCHASE_ERROR',
        message: outcome.reason ?? 'The purchase did not complete.',
        details: outcome,
      };
  }
}

// ---------------------------------------------------------------------------------------------
// The agent
// ---------------------------------------------------------------------------------------------

interface PurchaseInputEnvelope {
  intent: ShoppingIntent;
  proposal: Proposal;
  mode: ExecutionMode;
  mandate_id?: string;
}

function parseInput(raw: unknown): PurchaseInputEnvelope {
  const input = raw as Partial<PurchaseInputEnvelope> | null;
  if (!isShoppingIntent(input?.intent) || !isProposal(input?.proposal)) {
    // No paste-ready example here, on purpose: this agent spends money, and a chat box is not how it is driven.
    throw invalidInput(raw, 'vitta-purchase-agent', 'Purchase input must be {"intent", "proposal", "mode"}, where the proposal comes from the Evaluator.');
  }
  // Mode is explicit on every call. A missing mode must never quietly become LIVE (a real order) or
  // TEST (a skipped one) — same rule as the dashboard's own mode toggle.
  if (input.mode !== 'TEST' && input.mode !== 'LIVE') {
    throw new AgentFault('INVALID_REQUEST', 'Purchase input must state mode: "TEST" or "LIVE" explicitly.');
  }
  if (input.mandate_id !== undefined && typeof input.mandate_id !== 'string') {
    throw new AgentFault('INVALID_REQUEST', 'mandate_id must be a string when given.');
  }
  return { intent: input.intent, proposal: input.proposal, mode: input.mode, mandate_id: input.mandate_id };
}

export function createPurchaseAgent(deps: PurchaseDeps = defaultPurchaseDeps()): AgentHandler {
  return async (request): Promise<AgentResult> => {
    const steps = new StepRecorder();
    let claimed = false;
    let gateStarted = false;
    const requestId = request.correlation.requestId;
    try {
      const { proposal, mode, mandate_id } = parseInput(request.input);
      if (proposal.proposed_action !== 'purchase' || !proposal.selected) {
        throw new AgentFault('PURCHASE_ERROR', 'The proposal is not a purchase — nothing to buy.');
      }
      const selected = proposal.selected;

      // Replay guard — one request id buys at most once.
      const claim = deps.idempotency.claim(requestId);
      if (claim.state === 'done') {
        steps.note('idempotency', 'skipped', `request ${requestId} already ran — returning the recorded result, not buying again`);
        return claim.result;
      }
      if (claim.state === 'in_progress') {
        throw new AgentFault(
          'DUPLICATE_REQUEST',
          `A purchase for request ${requestId} is already in progress or was interrupted (since ${claim.since}). ` +
            'Not retrying — check the receipts, then start a new request.',
        );
      }
      claimed = true;
      steps.note('idempotency', 'ok', `claimed request ${requestId}`);

      // The gate always runs under the most recent mandate. If the caller believes a different one
      // applies, refuse rather than let two ids disagree about what authorized the spend.
      const mandate = deps.currentMandate();
      const wanted = mandate_id ?? request.correlation.mandateId;
      if (wanted && mandate && wanted !== mandate.mandate_id) {
        throw new AgentFault('PURCHASE_ERROR', `Mandate mismatch: caller expected ${wanted} but the gate will run under ${mandate.mandate_id}.`);
      }

      const productRef = await steps.run('resolve-product', () => resolveProductRef(selected), (ref) => `${selected.merchant} ref ${ref}`);

      // The gate prices whatever is in the real cart, so the cart must hold exactly the proposed
      // line. Where the merchant has no clear-cart command, prove it is already empty instead.
      const canClear = CAN_CLEAR_CART[selected.merchant];
      if (!canClear) {
        const cart = await deps.readCartItemCount(selected.merchant);
        if (!cart.ok) {
          throw new AgentFault('PURCHASE_ERROR', `Could not read the ${selected.merchant} cart to confirm it is empty: ${cart.message ?? 'unknown error'}`);
        }
        if ((cart.itemCount ?? 0) > 0) {
          throw new AgentFault(
            'PURCHASE_ERROR',
            `The ${selected.merchant} cart already holds ${cart.itemCount} item(s) and there is no clear-cart command for ${selected.merchant} — ` +
              'refusing to buy on top of it. Empty the cart, then retry.',
          );
        }
        steps.note('cart-empty-check', 'ok', `${selected.merchant} cart confirmed empty by a real read`);
      }

      const input: PurchaseInput = {
        merchant: selected.merchant,
        items: [{ productRef, productName: selected.product_name, quantity: proposal.quantity }],
        clearCartFirst: canClear, // Blinkit: start from a verified-empty cart, buy exactly the proposed line
        mode,
        // no mandateId: see file header — no auto-funding.
      };

      gateStarted = true;
      const result = await deps.runPurchase(input, (event) => {
        if (event.status !== 'running') {
          steps.note(`gate:${event.step}`, event.status === 'done' ? 'ok' : event.status === 'skipped' ? 'skipped' : 'failed', event.detail);
        }
      });

      const runId = deps.runIdFor({ receipt_id: result.receiptId, authorization_id: result.authorizationId });
      const outcome = toOutcome(result, mandate, runId);
      const error = outcomeError(outcome);
      const final: AgentResult = error ? agentFail(NAME, error, steps.steps) : agentOk(NAME, outcome, steps.steps);
      deps.idempotency.complete(requestId, final);
      return final;
    } catch (err) {
      const fault =
        err instanceof AgentFault
          ? { code: err.code, message: err.message, details: err.details }
          : { code: 'PURCHASE_ERROR' as const, message: (err as Error).message };
      const final = agentFail(NAME, fault, steps.steps);
      // A claimed request that died BEFORE reaching the gate is recorded, so a replay sees the same
      // answer instead of a spurious "in progress". One that died after the gate started is left
      // claimed-but-incomplete on purpose: an order may have been placed, so a replay must not retry.
      if (claimed && !gateStarted) {
        try {
          deps.idempotency.complete(requestId, final);
        } catch {
          // best-effort
        }
      }
      return final;
    }
  };
}
