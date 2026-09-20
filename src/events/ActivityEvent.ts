// ActivityEvent — an entry in the decision log that is NOT a gate verdict.
//
// events.jsonl has always held the gate's own decisions (GateEvent: ALLOW / DENY / STEP_UP for a
// webcmd command). But the things a person needs on record are wider than that: a mandate was created,
// a Razorpay test payment arrived, a purchase completed or failed, a run of the agents ended, and any
// of them can FAIL before the gate is ever asked. Those left no trace. They are written to the same
// log so there is one place to look, distinguished by `kind: 'ACTIVITY'`.
//
// GateEvent is left exactly as it was — readers that only understand verdicts (the Home page's
// stats, the timeline) filter these out with isActivityEvent(), and a line without `kind` is a
// GateEvent, as it always was. An ActivityEvent never carries a verdict: it does not say whether a
// spend was allowed (only the gate does), only what happened.

export type ActivityAction =
  | 'mandate.create'
  | 'mandate.resign'
  | 'payment.order_created' // a Razorpay test order was created as a mandate's reserve
  | 'payment.received' // a paid order was verified and attached: the reserve is funded
  | 'payment.fund' // a fund request that failed before it could be classified further
  | 'purchase.completed' // the gate allowed a purchase, drew the reserve and signed a receipt
  | 'purchase.failed' // a purchase did not complete (refused by the gate, or failed before it)
  | 'cart.emptied' // the cart was emptied after a completed purchase
  | 'gate.run' // a `gate run` that failed before it could reach a decision
  | 'agents.run'; // one run of the four shopping agents ended

export type ActivityOutcome = 'SUCCESS' | 'FAILURE' | 'INFO';

export interface ActivityEvent {
  event_id: string;
  ts: string; // ISO 8601
  kind: 'ACTIVITY';
  action: ActivityAction;
  outcome: ActivityOutcome;
  /** One plain sentence a person can read in a table row. */
  summary: string;
  mandate_id?: string;
  amount_inr?: number;
  run_id?: string;
  reserve_ref?: string;
  receipt_id?: string;
  /** The reason, when outcome is FAILURE. */
  error?: string;
  /** A few small facts (no secrets, no card data): merchant, mode, payment ids, … */
  details?: Record<string, string | number | boolean>;
}

export function isActivityEvent(entry: unknown): entry is ActivityEvent {
  return typeof entry === 'object' && entry !== null && (entry as { kind?: unknown }).kind === 'ACTIVITY';
}
