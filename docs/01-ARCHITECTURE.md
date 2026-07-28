# 01 — Architecture

Read `00-PRODUCT-BRIEF.md` first. This file is the repo layout and interfaces to implement — not a diagram to interpret, the actual shape of the code to write.

## Repo layout

Single Node.js/TypeScript project, at the project root (sibling to `docs/`):

```
Mandate Gate /
├── CLAUDE.md
├── docs/                      # spec only, never imported by code
├── src/
│   ├── mandate/
│   │   ├── schema.ts          # Mandate type + validator
│   │   ├── sign.ts            # canonicalJSON() + Ed25519 sign/verify
│   │   └── render.ts          # renderConsent(mandate) -> human sentence
│   ├── policy/
│   │   ├── decide.ts          # the core decide() function — PHASE 1, pure, zero I/O
│   │   ├── rules.ts           # the ordered rule table as data + functions
│   │   └── decide.test.ts     # unit tests — build BEFORE wiring webcmd
│   ├── ledger/
│   │   ├── Ledger.ts          # the Ledger interface
│   │   └── DodoCreditLedger.ts # Phase 1 implementation, real Dodo test-mode API
│   ├── receipt/
│   │   ├── schema.ts          # Receipt type
│   │   └── chain.ts           # sign + hash-link receipts, gate verify logic
│   ├── webcmd/
│   │   ├── manifest.ts        # loads + caches `webcmd list -f json`
│   │   └── executor.ts        # spawns webcmd for ALLOW decisions, binds runId
│   ├── events/
│   │   └── GateEvent.ts       # the single event contract, see below
│   ├── cli/
│   │   ├── gate.ts            # `gate` CLI entrypoint (check/run/verify subcommands)
│   │   └── ui.ts              # two-pane terminal UI
│   └── phase2-4-stubs/
│       ├── ReceiptChain.ts        # Phase 2 skeleton
│       ├── DisputePackExporter.ts # Phase 2 skeleton
│       ├── mcp-server.ts          # Phase 3 skeleton
│       └── ChaosTestRunner.ts     # Phase 4 skeleton
├── mandates/                  # signed mandate JSON files, created at runtime
├── receipts/                  # signed receipt JSON files, created at runtime
├── manifest.json              # cached `webcmd list -f json` output
├── events.jsonl                # flat GateEvent log, append-only
├── ledger.jsonl                # append-only ledger entries, local mirror only
├── .env                        # DODO_API_KEY, DODO_API_KEY_READONLY — never commit
├── package.json
├── tsconfig.json
└── dashboard/                  # separate Next.js app — read-only view, own package.json
                                 # full spec in docs/06-DASHBOARD-SPEC.md, not detailed here
```

The dashboard is a genuinely separate application, not a folder inside `src/` — it has its own `package.json` and build process because Next.js's dependency tree shouldn't mix into the CLI's. It reads the same `mandates/`, `receipts/`, and `events.jsonl` files this backend writes; it never writes to any of them. See `06-DASHBOARD-SPEC.md` for its internal structure.

## Rules for this codebase

1. **No LLM in the decision path.** `src/policy/decide.ts` takes only plain data in, returns plain data out. No network calls inside it — the manifest and ledger balance are fetched by the caller, before `decide()` runs.
2. **Fail closed.** Every unknown/unparseable/expired/invalid input resolves to DENY. Rule order in `04-POLICY-ENGINE-SPEC.md` is load-bearing — do not reorder without updating that file.
3. **The browser is the only unreliable thing.** `src/mandate`, `src/policy`, `src/receipt`, `src/ledger` all run offline and deterministically. Only `src/webcmd/executor.ts` touches a live browser session, and only after `decide()` already returned ALLOW.
4. **Label test mode everywhere it appears.** Every place Dodo Payments appears in output (terminal UI, receipts) must say "test mode" explicitly. Never print anything implying real settlement.

## `GateEvent` — the one contract everything else is built around

Every policy decision — read or write, allow or deny — emits exactly one `GateEvent`. Define this once, populate every field from day one, never restructure it later.

```ts
// src/events/GateEvent.ts

export type DenyCode =
  | 'BAD_SIGNATURE'
  | 'EXPIRED'
  | 'UNKNOWN_COMMAND'
  | 'MERCHANT_NOT_ALLOWED'
  | 'AMOUNT_UNPARSEABLE'
  | 'OVER_PER_TXN_CAP'
  | 'OVER_TOTAL_CAP'
  | 'TXN_LIMIT_REACHED'
  | 'CART_DRIFT'
  | 'INSUFFICIENT_RESERVE';

export interface GateEvent {
  event_id: string;          // ULID or crypto.randomUUID()
  ts: string;                // ISO 8601
  mandate_id: string;
  mandate_hash: string;      // sha256 hex of canonicalJSON(mandate)
  command: string;           // e.g. "blinkit/place-order"
  access: 'read' | 'write';
  verdict: 'ALLOW' | 'DENY' | 'STEP_UP';
  code?: DenyCode;           // only set when verdict === 'DENY'
  amount_inr?: number;
  run_id?: string;           // webcmd's runId, once bound
  reserve_ref?: string;      // Dodo checkout-session / credit-entitlement reference
  trace_digest?: string;     // sha256 of webcmd's --trace artifact, only on ALLOW
}
```

**Populate every field in Phase 1**, including fields only Phase 2+ will read (`trace_digest`, `reserve_ref`). Do not leave placeholders — retrofitting this schema after receipts are signed against the old shape is exactly the rework this design exists to prevent.

Phase 1's use of `GateEvent` is minimal on purpose: print it in the two-pane UI, append it as one line to `events.jsonl`. No hash-chaining beyond the Receipt object's own chain, no MCP exposure. Stop there.

The dashboard (`06-DASHBOARD-SPEC.md`) is a second, independent reader of this same `events.jsonl` file — it does not change what Phase 1 emits, it only polls and displays it. This is the same additive-subscriber pattern the Phase 2–4 stubs use, applied to something that's actually built now instead of deferred.

## `Ledger` interface — swappable, Dodo-backed for Phase 1

```ts
// src/ledger/Ledger.ts

export interface Ledger {
  fund(mandateId: string, amountInrPaise: number): Promise<{ reserveRef: string }>;
  balance(reserveRef: string): Promise<number>;
  draw(reserveRef: string, amountInrPaise: number, runId: string): Promise<void>;
  release(reserveRef: string): Promise<void>;
}
```

`DodoCreditLedger implements Ledger` is the Phase 1 concrete implementation — see `02-DODO-INTEGRATION.md` for exact API calls. `PolicyEngine.decide()` never imports `DodoCreditLedger` directly — it receives a `Ledger` as a parameter. This is what makes a future different-rail implementation a non-breaking addition.

## What counts as a "stub" for Phase 2–4

A stub is a file that:

1. Exists at the path shown above.
2. Exports a correctly-typed class/function matching the interface described in this doc.
3. Has every method either throw `new Error('Phase N not implemented — see docs/01-ARCHITECTURE.md')` or contain a one-line comment describing future behavior, doing nothing at runtime.
4. Compiles under `tsc --noEmit`.
5. Is never imported by anything in Phase 1's runtime path (`gate run`, `gate check`, the demo script).

This proves the modular-architecture claim without spending build-hours on features not demoed Saturday.

### Phase 2 — Receipt Ledger + Dispute Pack

```ts
// src/phase2-4-stubs/ReceiptChain.ts
export class ReceiptChain {
  // Will read events.jsonl. On each ALLOW GateEvent, build+sign a Receipt,
  // link prev_receipt_hash. Not implemented in Phase 1.
}

// src/phase2-4-stubs/DisputePackExporter.ts
export class DisputePackExporter {
  // Will subscribe to Dodo's dispute.* webhooks and bundle
  // {mandate, GateEvent, receipt, trace, dispute payload} into one file.
  // Not implemented in Phase 1.
}
```

### Phase 3 — Mandate-aware MCP Server

```ts
// src/phase2-4-stubs/mcp-server.ts
// Will expose exactly 3 MCP tools calling the SAME PolicyEngine.decide()
// the CLI uses:
//   mandate.check(command, amount)
//   mandate.request_spend(command, args)
//   mandate.get_receipt(runId)
// request_spend (once ALLOWed) will call Dodo's own MCP/SDK and webcmd's CLI —
// it will not reimplement either. Do not build this before Phase 1 is proven.
```

### Phase 4 — Exactly-Once Payment Guard

```ts
// src/phase2-4-stubs/ChaosTestRunner.ts
// Will SIGKILL the webcmd subprocess mid-flight, replay the same runId twice,
// and fire concurrent decide() calls — asserting the ledger's cap is never
// exceeded. Depends on confirming Dodo's request-side idempotency-key support
// first — see the open question in docs/02-DODO-INTEGRATION.md.
```

## Data flow, Phase 1, end to end

```
1. gate mandate create --cap 800 --merchants blinkit,zepto,bigbasket --expires "18:00"
   -> schema.ts builds the object -> sign.ts canonicalizes + Ed25519-signs it
   -> written to ./mandates/mnd_xxx.json

2. gate fund mnd_xxx --amount 800
   -> DodoCreditLedger.fund() creates a real Dodo Checkout Session (test mode)
   -> reserveRef stored alongside the mandate

3. Agent runs a read command, e.g. `webcmd blinkit cart`
   -> manifest.ts confirms access:'read' -> decide() rule 3 short-circuits -> ALLOW
   -> GateEvent emitted, printed, appended to events.jsonl

4. Agent runs a write command, e.g. `webcmd blinkit place-order --confirm`
   -> manifest.ts confirms access:'write'
   -> decide(request, mandate, ledger, now) evaluates the full rule table
   -> DENY: GateEvent emitted with code, nothing executes, ledger untouched
   -> ALLOW: executor.ts spawns webcmd, captures runId,
      DodoCreditLedger.draw(reserveRef, amount, runId) called,
      receipt built + signed + hash-linked, GateEvent emitted with run_id + reserve_ref
```

## Package choices — do not deviate without reason

- **Language:** TypeScript, Node ≥20
- **Signing:** `node:crypto` Ed25519 — zero dependencies, see `04-POLICY-ENGINE-SPEC.md`
- **Dodo SDK:** official `dodopayments` npm package
- **webcmd:** `@agentrhq/webcmd@0.4.3` — pinned, do not float this version
- **Validation:** hand-written type guards. Do not add `zod` or similar unless it demonstrably saves time
- **No database.** JSON files plus Dodo's hosted credit ledger are the entire persistence layer
