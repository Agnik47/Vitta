// Agent 3 — Deal Evaluator. Compares the Discovery Agent's candidates against what the user asked for
// and PROPOSES one. It is pure and deterministic: same candidates in, same proposal out, no I/O.
//
// A proposal is not permission. The Evaluator has no idea what the mandate allows and must not
// try to find out — duplicating spending policy here would create a second, weaker policy engine
// next to the real one. Whether the proposed purchase may proceed is decided later, and only, by
// the gate.
import {
  AgentFault,
  StepRecorder,
  agentFail,
  agentOk,
  isCandidate,
  isShoppingIntent,
  MERCHANT_IDS,
  type AgentHandler,
  type AgentResult,
  type Candidate,
  type Proposal,
  type RejectedCandidate,
  type ShoppingIntent,
} from './protocol';
import { EXAMPLE_CANDIDATES, EXAMPLE_INTENT, invalidInput } from './usage-hint';

const NAME = 'vitta-deal-evaluator' as const;

const SIZE_RE = /(\d+(?:\.\d+)?)\s?(kg|kgs|g|gm|gms|gram|grams|l|ltr|ltrs|litre|litres|liter|liters|ml)\b/gi;
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'or', 'with', 'in', 'pack', 'packs']);

interface Size {
  dim: 'mass' | 'volume';
  /** grams or millilitres */
  amount: number;
}

function toSize(value: string, unit: string): Size {
  const n = Number(value);
  const u = unit.toLowerCase();
  if (u === 'kg' || u === 'kgs') return { dim: 'mass', amount: n * 1000 };
  if (u === 'g' || u === 'gm' || u === 'gms' || u === 'gram' || u === 'grams') return { dim: 'mass', amount: n };
  if (u === 'ml') return { dim: 'volume', amount: n };
  return { dim: 'volume', amount: n * 1000 }; // l / ltr / litre / liter
}

export function extractSizes(text: string): Size[] {
  const sizes: Size[] = [];
  for (const m of text.matchAll(SIZE_RE)) sizes.push(toSize(m[1], m[2]));
  return sizes;
}

function sizeMatches(want: Size, have: Size[]): boolean {
  return have.some((h) => h.dim === want.dim && Math.abs(h.amount - want.amount) < 0.5);
}

/** Common Indian-English spellings of the same product, so "aata" finds "atta". Spelling variants
 *  only — never a substitution of one product for another. */
const SPELLING: Record<string, string> = { aata: 'atta', aatta: 'atta', panir: 'paneer' };

function stem(word: string): string {
  const spelled = SPELLING[word] ?? word;
  return spelled.length > 3 && spelled.endsWith('s') ? spelled.slice(0, -1) : spelled;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(SIZE_RE, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}

/** Fraction of the query's words that appear in the product name (0..1). */
export function relevance(query: string, productName: string): number {
  const want = tokens(query);
  if (want.length === 0) return 0;
  const have = new Set(tokens(productName));
  return want.filter((t) => have.has(t)).length / want.length;
}

const MIN_RELEVANCE = 0.5;

function inr(n: number): string {
  return `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

interface Scored {
  candidate: Candidate;
  total: number;
  score: number;
}

export function evaluate(intent: ShoppingIntent, candidates: Candidate[]): Proposal {
  const rejected: RejectedCandidate[] = [];
  const eligible: Scored[] = [];
  const wantSizes = intent.pinned ? [] : extractSizes(intent.product_query);

  for (const candidate of candidates) {
    const reject = (reason: string) => rejected.push({ candidate, reason });

    if (intent.pinned) {
      if (candidate.merchant !== intent.pinned.merchant || candidate.product_id !== intent.pinned.product_id) {
        reject('not the product this watch is pinned to');
        continue;
      }
    } else if (intent.preferred_merchants.length > 0 && !intent.preferred_merchants.includes(candidate.merchant)) {
      reject(`${candidate.merchant} was not one of the requested merchants`);
      continue;
    }

    if (!candidate.availability) {
      reject('out of stock');
      continue;
    }
    if (!(candidate.price_inr > 0)) {
      reject('no usable price');
      continue;
    }

    let score = 1;
    if (!intent.pinned) {
      score = relevance(intent.product_query, candidate.product_name);
      if (score < MIN_RELEVANCE) {
        reject(`does not look like "${intent.product_query}"`);
        continue;
      }
      // If the user named a size, a candidate must state the same size. A candidate that states no
      // size is rejected too: guessing "probably 2kg" is how the wrong item gets bought.
      const have = extractSizes(candidate.product_name);
      const unmatched = wantSizes.find((w) => !sizeMatches(w, have));
      if (unmatched) {
        reject(have.length === 0 ? 'pack size not stated on the listing' : 'different pack size than requested');
        continue;
      }
    }

    const total = candidate.price_inr * intent.quantity;
    if (intent.max_price_inr !== undefined && total > intent.max_price_inr) {
      reject(`${inr(total)} is above the ${inr(intent.max_price_inr)} ceiling`);
      continue;
    }
    eligible.push({ candidate, total, score });
  }

  if (eligible.length === 0) {
    const why = summarizeRejections(rejected);
    return {
      proposed_action: 'none',
      quantity: intent.quantity,
      reason: `No eligible product among ${candidates.length} candidate(s)${why ? ` — ${why}` : ''}.`,
      considered: candidates.length,
      rejected,
    };
  }

  // Cheapest total first; ties go to the closer match, then merchant order, then name — fixed, so
  // the same input always yields the same proposal.
  eligible.sort(
    (a, b) =>
      a.total - b.total ||
      b.score - a.score ||
      MERCHANT_IDS.indexOf(a.candidate.merchant) - MERCHANT_IDS.indexOf(b.candidate.merchant) ||
      a.candidate.product_name.localeCompare(b.candidate.product_name),
  );
  const best = eligible[0];
  const runnerUp = eligible[1];
  const reason =
    `Lowest eligible price of ${eligible.length} eligible candidate(s): ${inr(best.total)} at ${best.candidate.merchant}` +
    (runnerUp ? ` (next best ${inr(runnerUp.total)} at ${runnerUp.candidate.merchant})` : '');

  if (!intent.purchase_required) {
    return {
      proposed_action: 'none',
      selected: best.candidate,
      quantity: intent.quantity,
      expected_total_inr: best.total,
      reason: `${reason}. This was a search-only request, so nothing will be bought.`,
      considered: candidates.length,
      rejected,
    };
  }
  return {
    proposed_action: 'purchase',
    selected: best.candidate,
    quantity: intent.quantity,
    expected_total_inr: best.total,
    reason,
    considered: candidates.length,
    rejected,
  };
}

function summarizeRejections(rejected: RejectedCandidate[]): string {
  const counts = new Map<string, number>();
  for (const r of rejected) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, n]) => `${n}× ${reason}`)
    .join(', ');
}

export function createEvaluatorAgent(): AgentHandler {
  return async (request): Promise<AgentResult> => {
    const steps = new StepRecorder();
    try {
      const input = request.input as { intent?: unknown; candidates?: unknown } | null;
      if (!isShoppingIntent(input?.intent) || !Array.isArray(input?.candidates) || !input.candidates.every(isCandidate)) {
        throw invalidInput(
          request.input,
          'vitta-deal-evaluator',
          'Evaluator input must be {"intent": <ShoppingIntent>, "candidates": [<Candidate>...]}.',
          { intent: EXAMPLE_INTENT, candidates: EXAMPLE_CANDIDATES },
        );
      }
      const { intent, candidates } = input as { intent: ShoppingIntent; candidates: Candidate[] };
      const proposal = await steps.run(
        'compare-candidates',
        () => evaluate(intent, candidates),
        (p) =>
          p.selected
            ? `${p.selected.product_name} @ ${p.selected.merchant} ${inr(p.expected_total_inr ?? p.selected.price_inr)} — ${p.proposed_action}`
            : p.reason,
      );
      return agentOk(NAME, proposal, steps.steps);
    } catch (err) {
      if (err instanceof AgentFault) return agentFail(NAME, { code: err.code, message: err.message, details: err.details }, steps.steps);
      return agentFail(NAME, { code: 'EVALUATION_ERROR', message: (err as Error).message }, steps.steps);
    }
  };
}
