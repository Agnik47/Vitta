// The Ledger interface — swappable rail. Razorpay test mode today (RazorpayLedger); Prava before it.
// See docs/01-ARCHITECTURE.md § Ledger interface. decide() never imports a ledger directly — it
// receives a Ledger's outputs as plain arguments, which is what makes a different rail non-breaking.

export interface Ledger {
  fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string; checkoutUrl?: string }>;
  balance(reserveRef: string): Promise<number>;
  draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void>;
  release(reserveRef: string): Promise<void>;
  /** Adding money to an existing reserve. RazorpayLedger rejects this — an order's amount is fixed,
   * and a top-up must be a new, human-paid order — so an automatic top-up can never happen. */
  credit(reserveRef: string, amountInrPaise: number, idempotencyKey: string): Promise<void>;
  /** Optional: which mandate a reserve was created for. Lets `gate fund --reserve-ref` refuse to
   * attach a reserve that belongs to a different mandate (or wasn't created by Vitta at all). */
  reserveOwner?(reserveRef: string): Promise<string>;
  /** Optional: complete any payment the human made but the rail hasn't finalized yet (Razorpay:
   * capture `authorized` payments). Idempotent. */
  settle?(reserveRef: string): Promise<{ captured: string[] }>;
}
