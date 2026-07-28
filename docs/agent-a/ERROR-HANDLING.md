# Agent A — Error Handling Reference

Consolidates every failure mode already specified across `docs/00-PRODUCT-BRIEF.md`, `docs/04-POLICY-ENGINE-SPEC.md`, and `docs/05-DEMO-SCRIPT.md` into one reference scoped to what Agent A actually builds (`src/mandate/`, `src/policy/`, `src/receipt/`, `src/cli/`) — so a future session isn't re-deriving fail-closed behavior for this track under time pressure. Mirrors the structure of `docs/agent-b/ERROR-HANDLING.md` for the I/O-rail side.

## The one governing rule

**Fail closed, always** (`CLAUDE.md` rule 3, `00-PRODUCT-BRIEF.md`). Every failure mode below resolves to a DENY, a thrown error, or an honest "not available" — never a silent ALLOW, never a guessed/default value standing in for real data.

## `decide()` — failure modes are the rule table itself

Every one of `decide()`'s 9 rules (`src/policy/decide.ts`) is a fail-closed check by construction — the function has no other exit path than the rules themselves, and every rule that fails returns a specific `DenyCode`, never a generic error. See `docs/04-POLICY-ENGINE-SPEC.md`'s "Rule order note" and `docs/common/02-DECISIONS.md` ADR-003 for the one place this needed correcting (read-access must bypass signature/expiry, not the other way around).

`decide()` itself has zero I/O and zero try/catch — it can't throw from network/filesystem issues because it never touches either. Its only possible runtime failure is a caller passing malformed input (e.g. `mandate.scope` missing) that causes a `TypeError` accessing a property — this is a caller bug, not something `decide()` should defensively guard against per `AGENTS.md`'s "don't validate what can't happen" philosophy; the caller is responsible for passing a `Mandate` that's already passed `isMandate()`.

## Mandate signing/verification (`src/mandate/sign.ts`)

- **Bad signature:** `verify()` returns `false`, never throws. `decide()`'s Rule 1 (was Rule 0) turns this into `BAD_SIGNATURE`.
- **Malformed/missing key material:** `crypto.sign()`/`crypto.verify()` throw on a genuinely invalid `KeyObject` (e.g. wrong key type) — this is a CLI-layer bug (passed the wrong key), not something to catch and paper over. Let it throw; a stack trace during development is more useful than a silently-wrong signature.
- **`isMandate()` returns `false`:** the caller (CLI) should refuse to proceed with a mandate that fails structural validation — don't pass a partially-valid mandate into `decide()` hoping individual rules catch the gap; check `isMandate()` first at the boundary where untrusted JSON (a mandate file read from disk) enters the system.

## Receipts and chain verification (`src/receipt/chain.ts`)

- **Tampered receipt file:** `verifyReceipt()` returns `false` for the tampered receipt itself; `verifyChain()` also flags `chain_link_valid: false` on the *next* receipt in the chain, even if that next receipt's own signature is untouched — this is the load-bearing behavior Beat 7's tamper test depends on. Both must be checked independently; a receipt passing its own signature check does NOT mean its chain link is intact.
- **Missing/malformed receipt JSON on disk:** this is a Phase 1f CLI-layer concern (reading `receipts/*.json`), not `chain.ts` itself — `chain.ts` takes an already-parsed `Receipt[]`. The CLI should skip or error clearly on a receipt file that doesn't parse as JSON, never silently drop it from the chain (a silently-dropped receipt would make chain-verification pass when it shouldn't).
- **Chain head:** the first receipt (by `signed_at`) must have `prev_receipt_hash === CHAIN_HEAD_HASH` exactly (`sha256:` + 64 zeros) — anything else fails `chain_link_valid` for that receipt, even if its own signature is fine. There is no "trust the first one unconditionally" exception.

## CLI (`src/cli/gate.ts`) — this phase's new failure surface

- **Missing/corrupt key files (`keys/*.pem`):** `getOrCreateKeyPair()` auto-generates on first use if the files don't exist. If a key file exists but is corrupt (fails `crypto.createPrivateKey()`/`createPublicKey()`), this should throw a clear, actionable error — do not silently regenerate a new keypair over a corrupt one, since that would silently orphan every mandate/receipt already signed with the old key (any existing `gate verify` would start failing with no explanation). Treat this the same severity as a blocked phase — stop and report, per `CLAUDE.md` § "If you're blocked," don't invent a recovery path.
- **Unknown/malformed CLI arguments:** print a clear usage error and exit non-zero. Never guess at a missing required flag's value (e.g. don't default `--cap` to some placeholder number) — an incomplete `gate mandate create` invocation should fail loudly, not produce a mandate with a made-up cap.
- **`gate run`/`gate fund` before Phase 1c exists:** these subcommands exist in the dispatcher (so the CLI's surface is complete and discoverable) but must fail with an honest, specific message pointing at `docs/common/04-BLOCKERS.md` B-001 — never a mocked/fake `Ledger` standing in so the command "succeeds," per `CLAUDE.md` rule 7.
- **`webcmd` subprocess failures (once `gate run` is real):** per `docs/03-WEBCMD-INTEGRATION.md`, an `AuthRequiredError` or any non-zero exit from `webcmd` is treated as a write-access failure and denies by default — this project never tries to distinguish "session expired" from "something adversarial," it fails closed either way. Same for a hung `webcmd` process: do not restart mid-demo, the reserve stays blocked and nothing was drawn, which is correct, narratable behavior per `docs/03-WEBCMD-INTEGRATION.md` § Error handling required.

## What NOT to do, anywhere in this track

- Never let an unhandled promise rejection or raw stack trace reach the terminal during a `gate` command a judge might see — every error path resolves to a deliberate, formatted message (`docs/AGENTS.md` § UI rules).
- Never add a fallback that turns an uncertain case into ALLOW. If a future change to any file in `src/mandate/`, `src/policy/`, or `src/receipt/` makes an ambiguous case resolve to ALLOW instead of DENY, that change is wrong regardless of what else it accomplishes (`CLAUDE.md` rule 3, `AGENTS.md` § Development philosophy point 6).
