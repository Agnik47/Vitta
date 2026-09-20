// What a person sees when they chat with a structured-input agent (Evaluator, Discovery, Purchase) from
// Nasiko's UI. Only the Planner takes free text; the others are called by the orchestrator with JSON.
// Rather than a bare INVALID_REQUEST, a plain-text message gets an error that says so and — where it
// is safe — carries a message to paste back. The rejection itself is unchanged: still INVALID_REQUEST,
// nothing runs.
import { newCorrelation } from './a2a';
import { AgentFault, type Candidate, type ShoppingIntent } from './protocol';

/** A request that `extractAgentRequest` built from a chat message: `{ request: "<text>" }` and nothing else. */
function isPlainText(input: unknown): boolean {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === 'request' && typeof (input as { request: unknown }).request === 'string';
}

export const EXAMPLE_INTENT: ShoppingIntent = {
  raw_request: 'Pick the cheapest paneer under 100',
  product_query: 'paneer',
  category: 'dairy',
  quantity: 1,
  max_price_inr: 100,
  purchase_required: false,
  preferred_merchants: [],
  source: 'user',
};

export const EXAMPLE_CANDIDATES: Candidate[] = [
  { merchant: 'blinkit', product_name: 'Milky Mist Paneer 200 g', price_inr: 91, availability: true, source: 'example' },
  { merchant: 'zepto', product_name: 'Amul Fresh Paneer 200 g', price_inr: 95, availability: true, source: 'example' },
];

/** A ready-to-paste message: the Vitta envelope with a fresh correlation, so the pasted request is a new one. */
function envelope(input: unknown): unknown {
  return { vitta: 1, correlation: newCorrelation({ caller: 'usage-hint' }), input };
}

/**
 * The fault an agent throws for input it cannot use. For anything but a plain chat message it is just
 * `INVALID_REQUEST` with `message`. For a chat message it also explains that this agent is not
 * conversational, and (when `example` is given) attaches the exact JSON to send instead.
 */
export function invalidInput(input: unknown, agent: string, message: string, example?: unknown): AgentFault {
  if (!isPlainText(input)) return new AgentFault('INVALID_REQUEST', message);
  const hint =
    `${agent} does not take free text — it is called by the orchestrator with structured JSON. ${message} ` +
    'For a plain-English request, use vitta-shopping-planner (or run the whole chain with `node dist/cli/shop.js run "<request>"`).';
  return new AgentFault('INVALID_REQUEST', hint, example === undefined ? undefined : { paste_this_message: envelope(example) });
}
