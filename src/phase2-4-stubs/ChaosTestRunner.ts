// Phase 4 — will SIGKILL the webcmd subprocess mid-flight, replay the same runId twice,
// and fire concurrent decide() calls — asserting the ledger's cap is never exceeded.
// Depends on confirming Dodo's request-side idempotency-key support first — see the
// open question in docs/02-DODO-INTEGRATION.md. See docs/01-ARCHITECTURE.md § Phase 4.

export class ChaosTestRunner {
  run(): never {
    throw new Error('Phase 4 not implemented — see docs/01-ARCHITECTURE.md');
  }
}
