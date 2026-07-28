# Agent B — Error Handling Reference

Agent A's modules (`mandate`, `policy`, `receipt`) run offline and deterministically — per `docs/01-ARCHITECTURE.md` rule 3, they never touch the network or a live browser. Agent B's modules are the opposite: `src/ledger` calls a real payment API over the network, `src/webcmd` drives a real browser session, and `dashboard/` reads real files that another process is concurrently writing. Every real failure mode this project will hit at demo time lives in this agent's code. This doc collects the specific failure cases already called out in the specs, plus the fail-closed principle they all serve, so a session doesn't have to re-derive them from three different spec files under time pressure.

The governing rule, restated from `CLAUDE.md` and `docs/01-ARCHITECTURE.md`: **when uncertain, DENY, never ALLOW.** Every case below is an application of that one rule to a specific I/O failure.

## Dodo ledger (`src/ledger/DodoCreditLedger.ts`) — `docs/02-DODO-INTEGRATION.md`

| Failure | Required behavior |
|---|---|
| `fund()` — Checkout Session create fails (network, 4xx/5xx) | Propagate the error up; do not fabricate a `reserveRef`. No mandate should ever be marked funded without a real session id. |
| `balance()` call fails or times out | Do not assume balance is sufficient. `decide()` should see this as "cannot confirm funds" and the caller must treat that as DENY territory, not a silent pass. |
| `draw()` fails after webcmd already executed a write | This is the exactly-once problem, not a simple retry case — see the idempotency section below. Do not silently swallow the error; it must surface as a distinct event, since the action already happened in the real world but the ledger doesn't reflect it. |
| Same `runId` submitted to `draw()` twice (retry, re-submit) | Must not deduct twice. Per the spec's fallback (see below), check `ledger.jsonl` for the `runId` before calling `draw()` at all — this check lives in `src/webcmd/executor.ts`, not inside `DodoCreditLedger`, so the ledger class stays honest about what Dodo's API itself guarantees vs. what our own code guarantees. |
| Idempotency key support unconfirmed (open question in the spec) | Verify against the real API before finalizing `draw()`. If unsupported, the `ledger.jsonl` check above is not optional — it's the only guard that exists. |
| `release()` fails (test mode) | Acceptable to no-op / log-only in Phase 1 — no real money is at stake. Do not build retry logic here; not worth the time per `docs/00-PRODUCT-BRIEF.md`'s scope. |
| Rate limiting | Not a real concern at demo scale (40 req/s burst, 240/min sustained per the spec) — no throttling/backoff logic needed, don't build it preemptively. |

**Never touch live mode as an error-recovery path.** No failure condition, however inconvenient, is ever a reason to fall back to `https://dodopayments.com` (live) instead of `https://test.dodopayments.com`. This is an absolute per `CLAUDE.md` rule 1.

## webcmd (`src/webcmd/manifest.ts`, `src/webcmd/executor.ts`) — `docs/03-WEBCMD-INTEGRATION.md`

| Failure | Required behavior |
|---|---|
| `webcmd list -f json` (live manifest fetch) fails | Must never crash the app. Fall back to the on-disk `manifest.json` cache. Only throw if *neither* the live fetch nor a cache exists — there is genuinely no way to classify commands at that point, and refusing to run is the fail-closed choice. |
| Manifest JSON is malformed | Same as above — fall back to cache, never crash. |
| A command isn't found in the manifest at all (`access === undefined`) | `UNKNOWN_COMMAND` → DENY. Never default to `'read'` as a safe guess — the spec explicitly flags that webcmd's own generated adapters sometimes default new commands to `access:'read'` with an open TODO admitting it may be wrong (`src/cli.ts:2849` in webcmd's source). Defend at the policy layer: unclassified means deny, full stop. |
| `AuthRequiredError` (expired session / OTP wall) | Treat as write access, deny by default. Do not attempt to distinguish "session expired" from "something adversarial happening" — both fail closed identically. |
| The `webcmd` subprocess hangs mid-execution | Do not restart it mid-demo. Leave the reserve blocked (nothing was drawn, since `draw()` only happens after a successful `execute()` return) — this is correct, narratable behavior, not a bug to paper over. |
| `execute()` returns a non-zero exit code | Reject the promise; the caller must treat this as "the write did not happen" and must not call `Ledger.draw()`. |
| Same `runId` reappears (retry/re-submit from upstream) | Check `ledger.jsonl` for that `runId` *before* calling `draw()` — this is the exactly-once guard called out in both the Dodo and webcmd specs; implement it once, in `executor.ts`, per the architecture doc's explicit placement decision. |
| Cart total read (`webcmd <site> cart -f json`) fails or is missing `total` | Never guess or reuse a stale total. If the authoritative read fails, there is no valid amount to hand `decide()` — this should resolve to `AMOUNT_UNPARSEABLE` → DENY, not a fallback estimate. |

**Do not modify webcmd's source to work around any of the above.** Every failure mode here is handled by wrapping webcmd's CLI/JSON contract more defensively, never by patching `node_modules` or forking the package.

## Dashboard (`dashboard/app/api/*`) — `docs/06-DASHBOARD-SPEC.md`

The dashboard reads files (`mandates/*.json`, `receipts/*.json`, `events.jsonl`) that the CLI, running as a separate process, may be writing to concurrently. It also calls Dodo's read-only balance endpoint live.

| Failure | Required behavior |
|---|---|
| `events.jsonl` is being appended to mid-read (partial last line) | Treat a trailing incomplete JSON line as "not yet written," skip it, don't crash the route. Poll again next interval. |
| A mandate/receipt JSON file doesn't exist yet, or is momentarily absent (mid-write) | Return an empty/pending state to the frontend, not a 500 — this is a normal race with the CLI, not an error condition. |
| `DODO_API_KEY_READONLY` call fails (network, API down) | Show a stale-balance or "unavailable" indicator in the UI; never fabricate a balance number, and never fall back to the write key to "just make it work." |
| Any accidental write-capable code path | This isn't a runtime error case, it's a build-time constraint: no route may import `DODO_API_KEY`, `Ledger.fund()/draw()/release()`, or invoke webcmd, ever. If a bug fix seems to require this, stop — it means the route is scoped wrong, not that an exception is warranted. |

The dashboard's hard constraint (`CLAUDE.md` rule 8) means "error handling" here also includes a category unique to this app: **the correct response to almost every write temptation is refusal, not a workaround.** If live balance polling is flaky, the answer is a loading/stale state — never a cached write-capable client "just for this one read."

## What this doc does not cover

`decide()`'s own fail-closed rule table (bad signature, expired mandate, over-cap, etc.) is Agent A's territory and lives in `docs/04-POLICY-ENGINE-SPEC.md` — this file only covers the I/O-layer failures upstream and downstream of that pure function, which is what Agent B actually builds. Don't duplicate the rule table here; link to it if a future error case turns out to be a policy question instead of an I/O one.
