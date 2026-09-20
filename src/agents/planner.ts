// Agent 1 — Shopping Planner. Turns "find me the cheapest 2kg atta under ₹300 and buy it" into a
// structured ShoppingIntent. It plans; it never searches, never buys, never touches money.
//
// Deliberately deterministic (no LLM). The Planner sits upstream of the spending gate, so a model
// isn't needed to keep the system safe — and a rule-based parser is testable offline, free, and
// cannot be talked into anything. `parseIntent` is the seam: a model-backed parser can replace it
// without touching the protocol, and the gate would still be the only thing deciding about money.
import {
  AgentFault,
  StepRecorder,
  agentFail,
  agentOk,
  type AgentHandler,
  type AgentResult,
  type MerchantId,
  type ShoppingIntent,
} from './protocol';

const NAME = 'vitta-shopping-planner' as const;

const MERCHANT_ALIASES: Array<[RegExp, MerchantId]> = [
  [/\bblink\s?it\b/i, 'blinkit'],
  [/\bzepto\b/i, 'zepto'],
  [/\bbig\s?basket\b/i, 'bigbasket'],
];

const PRICE_CEILING =
  /\b(?:under|below|less than|within|upto|up to|at most|not more than|max(?:imum)?(?: of)?|budget(?: of)?)\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)/i;
const BARE_RUPEE = /(?:₹|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d+)?)/i;

const BUY_WORDS = /\b(buy(?:ing)?|order(?:ing)?|purchas(?:e|ing)|get me|grab(?:bing)?|check ?out|place an order)\b/i;
const NEGATED_BUY = /\b(?:don'?t|do not|without|no need to|not|never)\s+(?:actually\s+)?(?:buy(?:ing)?|order(?:ing)?|purchas(?:e|ing))\b/i;

/**
 * Conversational scaffolding that precedes the product, peeled off from the front one layer at a time
 * until nothing more comes off — so any stack of them reduces to the product: "help me in buying 1L
 * milk", "can you please help me find the cheapest atta", "I want to buy some paneer".
 * (A single pass used to strip one verb and leave the rest of the sentence as the product name — the
 * Evaluator then rejected every real candidate as "does not look like 'Help me in buying 1L milk'".)
 */
const LEAD_INS: RegExp[] = [
  /^\s*(?:hey|hi|hello|ok(?:ay)?|so|well)\b[,!.\s]*/i,
  /^\s*(?:please|pls|kindly)\b[,\s]*/i,
  /^\s*(?:can|could|would|will)\s+you\s+(?:please\s+)?/i,
  /^\s*help(?:\s+me)?(?:\s+(?:to|in|with|out\s+with|out))?(?:\s+|$)/i,
  /^\s*(?:i\s+(?:really\s+)?(?:want|need|wish|would\s+like|am\s+looking|am\s+trying|am\s+planning|will|'ll|'d\s+like)|i'd\s+like|i'm\s+(?:looking|trying|planning)|let'?s)(?:\s+(?:you\s+)?to)?(?:\s+|$)/i,
  /^\s*looking\s+(?:for|to)\s+/i,
  /^\s*(?:buy(?:ing)?|order(?:ing)?|purchas(?:e|ing)|get(?:ting)?|find(?:ing)?|search(?:ing)?(?:\s+for)?|show|look(?:ing)?\s+for|compare|comparing|pick(?:ing)?(?:\s+up)?|grab(?:bing)?|add|put)\b\s*(?:me\s+|for\s+me\s+|us\s+)?/i,
  /^\s*(?:the\s+)?(?:cheapest|lowest[- ]priced|lowest|best|a|an|some)\s+/i,
];

/** Peels the lead-ins (and any trailing filler) until the query stops changing. */
function peel(text: string): string {
  let query = text.trim();
  for (let pass = 0; pass < 8; pass++) {
    const before = query;
    for (const lead of LEAD_INS) query = query.replace(lead, '');
    query = query.replace(TRAILING_FILLER, '').trim();
    if (query === before) break;
  }
  return query;
}

/** Filler after the product: "…milk please", "…milk to my cart", "…milk for me". */
const TRAILING_FILLER = /\s+(?:(?:in|to|into)\s+(?:my\s+)?(?:cart|basket)|for\s+me|please|pls|thanks|thank\s+you|now|today|asap)$/i;
const QUANTITY = /\b(?:qty|quantity)\s*[:=]?\s*(\d+)\b|\bx\s?(\d+)\b|\b(\d+)\s?x\b|\b(\d+)\s+(?:packs?|units?|pieces?|pcs|bottles?|packets?|cartons?)\b/i;

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** Pure. Throws AgentFault('PLANNER_ERROR') when there is nothing to plan. */
export function parseIntent(request: string): ShoppingIntent {
  const raw = request.trim();
  if (raw === '') throw new AgentFault('PLANNER_ERROR', 'The shopping request is empty.');
  if (raw.length > 2000) throw new AgentFault('PLANNER_ERROR', 'The shopping request is too long (max 2000 characters).');

  let rest = raw;

  // Price ceiling.
  let maxPrice: number | undefined;
  const ceiling = PRICE_CEILING.exec(rest) ?? BARE_RUPEE.exec(rest);
  if (ceiling) {
    const n = toNumber(ceiling[1]);
    if (Number.isFinite(n) && n > 0) maxPrice = n;
    rest = rest.replace(ceiling[0], ' ');
  }

  // Merchants named in the request narrow the search to those merchants.
  const preferred: MerchantId[] = [];
  for (const [pattern, id] of MERCHANT_ALIASES) {
    if (pattern.test(rest)) preferred.push(id);
  }
  if (preferred.length > 0) {
    const name = '(?:blink\\s?it|zepto|big\\s?basket)';
    // "from blinkit or zepto", "only on bigbasket" — drop the whole clause, then any bare name.
    rest = rest
      .replace(new RegExp(`\\b(?:only\\s+)?(?:from|at|on|via)\\s+${name}(?:\\s*(?:,|/|\\bor\\b|\\band\\b)\\s*${name})*`, 'gi'), ' ')
      .replace(new RegExp(`\\b${name}\\b`, 'gi'), ' ');
  }

  // Quantity — "x3", "3 packs", "qty 3". A size like "2kg" is NOT a quantity.
  let quantity = 1;
  const q = QUANTITY.exec(rest);
  if (q) {
    const n = Number(q[1] ?? q[2] ?? q[3] ?? q[4]);
    if (Number.isInteger(n) && n >= 1 && n <= 50) quantity = n;
    rest = rest.replace(q[0], ' ');
  }

  const purchaseRequired = BUY_WORDS.test(raw) && !NEGATED_BUY.test(raw);

  // Strip the conversational scaffolding down to the product.
  // Lead-ins go first: the mid-sentence rules below would otherwise eat words out of them ("looking
  // FOR the best rice" → "looking rice").
  let query = peel(rest)
    .replace(/\b(?:and|then)\s+(?:buy|order|purchase|checkout)(?:\s+(?:it|that|them))?\b/gi, ' ')
    .replace(/\b(?:at|for)\s+the\s+(?:cheapest|lowest|best)(?:\s+available)?\s+price\b/gi, ' ')
    .replace(/\b(?:at|for)\s+(?:the\s+)?(?:cheapest|lowest|best)\b/gi, ' ')
    .replace(/\b(?:the\s+)?(?:cheapest|lowest|best)\b/gi, ' ')
    .replace(/\bavailable\b/gi, ' ')
    .replace(/[.,;:!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  query = peel(query);
  query = query.replace(/^(?:the|a|an|of)\s+/i, '').replace(/\s+(?:and|or|at|from|on|for|to|in)$/i, '').trim();
  // What is left may be only a pronoun ("buy it under ₹100") — that names no product.
  if (/^(?:it|that|this|them|these|those|one|something|anything|stuff|me|us|help)$/i.test(query)) query = '';

  if (query === '') {
    throw new AgentFault('PLANNER_ERROR', `Could not find a product in "${raw}".`, { raw_request: raw });
  }

  return {
    raw_request: raw,
    product_query: query,
    category: 'groceries',
    quantity,
    ...(maxPrice !== undefined ? { max_price_inr: maxPrice } : {}),
    purchase_required: purchaseRequired,
    preferred_merchants: preferred,
    source: 'user',
  };
}

export function createPlannerAgent(): AgentHandler {
  return async (request): Promise<AgentResult> => {
    const steps = new StepRecorder();
    try {
      const input = request.input as { request?: unknown } | null;
      if (typeof input?.request !== 'string') {
        throw new AgentFault('INVALID_REQUEST', 'Planner input must be {"request": "<natural-language shopping request>"}.');
      }
      const text = input.request;
      const intent = await steps.run(
        'parse-shopping-request',
        () => parseIntent(text),
        (i) =>
          `"${i.product_query}" ×${i.quantity}` +
          (i.max_price_inr !== undefined ? ` ≤ ₹${i.max_price_inr}` : '') +
          (i.preferred_merchants.length ? ` @ ${i.preferred_merchants.join('/')}` : '') +
          (i.purchase_required ? ' · purchase' : ' · search only'),
      );
      return agentOk(NAME, intent, steps.steps);
    } catch (err) {
      if (err instanceof AgentFault) return agentFail(NAME, { code: err.code, message: err.message, details: err.details }, steps.steps);
      return agentFail(NAME, { code: 'PLANNER_ERROR', message: (err as Error).message }, steps.steps);
    }
  };
}
