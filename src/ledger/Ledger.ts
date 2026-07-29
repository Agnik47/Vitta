// The Ledger interface — swappable, Dodo-backed for Phase 1. See docs/01-ARCHITECTURE.md § Ledger
// interface. decide() never imports DodoCreditLedger directly — it receives a Ledger's outputs as
// plain arguments, which is what makes a future different-rail implementation non-breaking.

export interface Ledger {
  fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }>;
  balance(reserveRef: string): Promise<number>;
  draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void>;
  release(reserveRef: string): Promise<void>;
}
