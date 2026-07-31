// The Ledger interface — swappable, Dodo-backed for Phase 1. See docs/01-ARCHITECTURE.md § Ledger
// interface. decide() never imports DodoCreditLedger directly — it receives a Ledger's outputs as
// plain arguments, which is what makes a future different-rail implementation non-breaking.

export interface Ledger {
  fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }>;
  balance(reserveRef: string): Promise<number>;
  draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void>;
  release(reserveRef: string): Promise<void>;
  /** Grants test-mode credit directly onto an ALREADY-RESOLVABLE reserve (one that has been through
   *  fund() and has a real customer behind it) — no checkout session, no payment entry. Exists so
   *  the automatic purchase pipeline can top up a reserve that's short by a small amount without
   *  stopping to ask a human to fund again, while the human-gated fund() flow remains the only way
   *  a reserve gets its FIRST money. See src/ledger/DodoCreditLedger.ts for why this is safe (same
   *  createLedgerEntry() call draw() already makes, just entry_type:'credit') and what's unverified
   *  about it (no DODO_API_KEY write key was available to test this live — see docs/OUTCOME.md). */
  credit(reserveRef: string, amountInrPaise: number, idempotencyKey: string): Promise<void>;
}
