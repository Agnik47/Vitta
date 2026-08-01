// The Ledger interface — swappable, Prava-backed for Phase 1. See docs/01-ARCHITECTURE.md § Ledger
// interface. decide() never imports PravaLedger directly — it receives a Ledger's outputs as
// plain arguments, which is what makes a future different-rail implementation non-breaking.

export interface Ledger {
  fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }>;
  balance(reserveRef: string): Promise<number>;
  draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void>;
  release(reserveRef: string): Promise<void>;
  /** Prava has no documented balance-grant/top-up API. PravaLedger rejects this call so an
   * automatic top-up can never be mistaken for a human passkey approval. */
  credit(reserveRef: string, amountInrPaise: number, idempotencyKey: string): Promise<void>;
}
