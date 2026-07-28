// Phase 2 — will read events.jsonl. On each ALLOW GateEvent, build+sign a Receipt,
// link prev_receipt_hash. Not implemented in Phase 1. See docs/01-ARCHITECTURE.md § Phase 2.

export class ReceiptChain {
  constructor() {
    throw new Error('Phase 2 not implemented — see docs/01-ARCHITECTURE.md');
  }
}
