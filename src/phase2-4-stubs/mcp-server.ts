// Phase 3 — will expose exactly 3 MCP tools calling the SAME PolicyEngine.decide()
// the CLI uses: mandate.check(command, amount), mandate.request_spend(command, args),
// mandate.get_receipt(runId). request_spend (once ALLOWed) will call Dodo's own MCP/SDK
// and webcmd's CLI — it will not reimplement either. Do not build this before Phase 1
// is proven. See docs/01-ARCHITECTURE.md § Phase 3.

export class MandateAwareMcpServer {
  start(): never {
    throw new Error('Phase 3 not implemented — see docs/01-ARCHITECTURE.md');
  }
}
