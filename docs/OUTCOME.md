# OUTCOME — Build Log

> This file is the running record of what actually happened, as it happened, against the plan in `PROMPTS.md`. Fill in the matching section immediately after each phase prompt finishes running — not at the end of the day, not from memory later. If something in the code ends up different from what `00`–`05` specified, write it here and update the relevant spec file too, so the two never drift apart.

Rules for using this file:

1. **Every entry gets a timestamp and a status.** Status is one of: ✅ Done as spec'd · ⚠️ Done with deviation (explain) · ❌ Blocked (explain what's needed) · ⏭ Skipped (explain why).
2. **Deviations are not failures — undocumented deviations are.** If Dodo's real API returned a different field name than the doc assumed, that's expected and fine; just write it down and fix the doc.
3. **Copy real terminal output in, don't paraphrase it.** "It worked" is not a log entry. The actual pasted output is.
4. Keep entries in chronological order, oldest first.

---

## Phase 0 — Project scaffolding

**Status:** ✅ Done as spec'd (with two recorded deviations, see below)
**Timestamp:** 2026-07-28, Agent A

- [x] Repo structure created matching `01-ARCHITECTURE.md`
- [x] `tsc --noEmit` passes
- [x] `.env.example` + `.gitignore` in place
- [x] `dodopayments` SDK installed

**What actually happened / deviations:**

Ran `npm init -y`, then `npm install --save-dev typescript ts-node @types/node` and `npm install dodopayments`. Created the full `src/` tree from `01-ARCHITECTURE.md` § Repo layout: every Phase 1 file (`src/mandate/*`, `src/policy/*`, `src/ledger/*`, `src/receipt/*`, `src/webcmd/*`, `src/cli/*`) got a one-line comment header only, per the Phase 0 prompt's literal instruction ("Do not implement any real logic yet"). The four Phase 2-4 stub files got their real stub content from `01-ARCHITECTURE.md` § What is a stub (typed classes, each throwing `Not implemented — see docs/01-ARCHITECTURE.md`).

**Deviation 1 — `src/events/GateEvent.ts` got real content, not a comment stub.** The literal Phase 0 instruction says every file gets a one-line comment, which would include this one. I deviated because `01-ARCHITECTURE.md` explicitly calls `GateEvent` "the one contract everything else is built around... populate every field in Phase 1... never restructure it later," gives its complete type definition already, has zero implementation dependencies (pure types, no logic), and — most concretely — the parallel-development docs already written in `docs/common/03-INTERFACES.md` and `05-PHASE-OWNERSHIP.md` tell Agent B to expect this file created for real in Phase 0. Leaving it as a comment would have made those already-published docs wrong on Agent B's very first pull. Writing an interface/type-only file has zero runtime logic, so this doesn't violate "scaffolding only."

**Deviation 2 — fixed a real spec inconsistency in `01-ARCHITECTURE.md`.** While writing `GateEvent.ts`, found that `05-DEMO-SCRIPT.md` Beat 8 requires a DENY with code `ALREADY_EXECUTED` (the idempotency-replay check), but the `DenyCode` union in `01-ARCHITECTURE.md` didn't include that value. Added `'ALREADY_EXECUTED'` to the union in `01-ARCHITECTURE.md` and to `GateEvent.ts` to match, per `CLAUDE.md` rule 6 (fix the doc when reality — here, cross-spec consistency — shows it was wrong).

**Deviation 3 — corrected `docs/common/03-INTERFACES.md`'s ownership note for the `Ledger` interface.** It previously said "Agent A defines (Phase 0) / Agent B implements (Phase 1c)." Re-checking `docs/PROMPTS.md` Phase 1c's actual instructions shows `src/ledger/Ledger.ts` (the interface itself, not just `DodoCreditLedger`) is explicitly a Phase 1c deliverable owned by Agent B — Phase 0 doesn't touch it. Fixed the registry row and left `Ledger.ts` as a one-line comment stub, consistent with every other Phase 1 file.

**TypeScript toolchain finding (real, not from the spec's guesses):** `npm install typescript` resolved to `typescript@7.0.2` (the new native/Go-ported compiler). Two real incompatibilities surfaced against it:
1. `moduleResolution: "node"` is rejected outright — TS 7 removed the legacy `node10` resolution mode. Fixed by using `"module": "node16"` / `"moduleResolution": "node16"` in `tsconfig.json`.
2. `ts-node` (10.9.2, latest) crashes on `require('ts-node/register')` against TS 7 — its `configuration.js` reads `ts.sys.fileExists` and `ts.sys` is `undefined` on the new compiler, meaning `ts-node` hasn't been updated for TS 7's API surface yet.

Resolution: pinned `typescript` to `5.9.3` (latest stable 5.x), which `ts-node` supports cleanly. `tsc --noEmit` and `node --require ts-node/register --test` (via `npm run typecheck` / `npm test`) both pass against 5.9.3. Recommend re-testing against TS 7 later once `ts-node` catches up, but not worth blocking Phase 1 on it now — this is exactly the kind of "verify against the real thing, not the doc's assumption" case `CLAUDE.md` rule 6 anticipates, just against a tool's actual behavior instead of an external API.

**Second real finding — `node --test` directory-argument bug (or at least, surprising behavior) on Node 22.18.0 / Windows.** The Phase 0 prompt's own suggested pattern (`node:test` + `node --test`) needed one adjustment: passing an explicit directory (`node --test ./src` or `node --test src`) fails with `Cannot find module '...\src'` — Node tries to run the directory as if it were the main entry script rather than using it as a recursive test-discovery root. This reproduces with or without `--require ts-node/register`, so it isn't a `ts-node` issue. Fix: omit the path argument entirely — `node --test` with no path already recursively discovers `**/*.test.ts` under the current working directory (and correctly skips `node_modules`). Final `package.json` test script: `"test": "node --require ts-node/register --test"`.

**Installed versions (for reference):** `typescript@5.9.3`, `ts-node@10.9.2` (latest), `dodopayments@2.43.0`, Node `v22.18.0`, npm `11.6.2`.

**Verification run:**
```
$ npx tsc --noEmit
(no output, exit 0)

$ npm test
> node --require ts-node/register --test
TAP version 13
# Subtest: src\policy\decide.test.ts
ok 1 - src\policy\decide.test.ts
# tests 1
# pass 1
# fail 0
```


---

## Phase 1a — Mandate schema, canonical JSON, Ed25519 signing

**Status:** ✅ Done as spec'd (with two recorded deviations in `render.ts`, see below)
**Timestamp:** 2026-07-29, Agent A

- [x] Sign/verify round-trip test passes
- [x] Tamper-detection test passes
- [x] canonicalJSON key-order independence test passes

**What actually happened / deviations:**

Implemented `src/mandate/schema.ts` (the `Mandate` interface plus a hand-written `isMandate()` structural type guard — no validation library, per `CLAUDE.md` § Package choices), `src/mandate/sign.ts` (`canonicalJSON()`, `generateKeyPair()`, `sign()`, `verify()` — copied faithfully from `04-POLICY-ENGINE-SPEC.md`'s code, no changes needed), and `src/mandate/render.ts` (`renderConsent()`).

**Deviation — `renderConsent()` doesn't match `04-POLICY-ENGINE-SPEC.md`'s code sketch verbatim, and that's deliberate.** The spec's sketch does `m.scope.merchants.map(capitalize).join(', ')`. Smoke-testing it against the mandate from `05-DEMO-SCRIPT.md` Beat 2 surfaced two real problems:
1. Beat 2's exact required output is `"...at Blinkit, Zepto or BigBasket, in one transaction..."` — a grammatical list with a trailing "or", not a flat comma join. The spec's own sketch would have produced `"Blinkit, Zepto, Bigbasket"`.
2. A generic `capitalize()` cannot turn `bigbasket` (webcmd's lowercase site key) into `BigBasket` (the brand's actual capitalization) — it has no way to know where the internal capital belongs.

Per `docs/AGENTS.md` § UI rules ("`docs/05-DEMO-SCRIPT.md` is the equivalent of an attached design file... treat every code block in it as exact"), Beat 2's wording wins over the plainer code sketch in `04-POLICY-ENGINE-SPEC.md`. Implemented a `joinWithOr()` grammatical-list helper and a small `BRAND_NAMES` lookup table (`blinkit`, `zepto`, `bigbasket`, `district` — the merchants named across `03-WEBCMD-INTEGRATION.md` and `05-DEMO-SCRIPT.md`) with a `capitalize()` fallback for anything not in the table. Added `src/mandate/render.test.ts` (not required by `docs/PROMPTS.md` Phase 1a's prompt, which only asks for `sign.test.ts` — added anyway since I'd just found two real bugs in code the acceptance test checks byte-for-byte) covering both fixes plus the fallback path.

**Test run (`src/mandate/sign.test.ts`, 5 tests, all required by `docs/PROMPTS.md` Phase 1a plus one extra keypair-isolation check):**
```
ok 1 - signing an object and verifying it unmodified passes
ok 2 - mutating any single field after signing causes verification to fail
ok 3 - canonicalJSON() produces identical output regardless of top-level key order
ok 4 - canonicalJSON() is deterministic through nested objects and arrays of objects
ok 5 - a signature from one keypair does not verify against a different keypair
```

**Test run (`src/mandate/render.test.ts`, 4 tests, added for the deviation above):**
```
ok 1 - renders a Beat-2-shaped sentence with a grammatical "a, b or c" merchant list
ok 2 - bigbasket renders as BigBasket, not Bigbasket — brand name, not a generic capitalize()
ok 3 - a two-merchant mandate joins with "or" and no comma
ok 4 - an unlisted merchant falls back to a plain capitalized name
```

Full suite: `npm test` → 10/10 passing (9 real + the still-empty `decide.test.ts` stub, which will gain real tests in Phase 1b). `npx tsc --noEmit` → exit 0.


---

## Phase 1b — Policy Engine (`decide()`)

**Status:** ✅ Done as spec'd (with one significant, well-evidenced rule-order correction — see below)
**Timestamp:** 2026-07-29, Agent A

- [x] All rule-table unit tests pass (0 through 8)
- [x] Rule-order test (BAD_SIGNATURE beats EXPIRED) passes
- [x] `decide()` confirmed to have zero I/O — takes only plain data (`SpendRequest`, `Mandate`, `publicKey`, `ledgerBalanceInr`, `txnCountSoFar`, `now`), no filesystem/network/console calls anywhere in the function

**What actually happened / deviations:**

**Significant deviation — reordered Rule 0-3, and updated `04-POLICY-ENGINE-SPEC.md` to match.** Before writing tests, cross-checked the spec's decide() sketch against `03-WEBCMD-INTEGRATION.md` § Step 3, which says read commands get "no mandate check, no ledger touch, no signature verification." The spec's own decide() had signature (Rule 0) and expiry (Rule 1) checks running *before* the read short-circuit (Rule 3) — meaning a read against an expired or badly-signed mandate would be denied, directly contradicting `03-WEBCMD-INTEGRATION.md`, and also directly contradicting the literal wording of `docs/PROMPTS.md` Phase 1b's own required test: "read access always allows, **regardless of mandate state**." Two independent spec sources and the acceptance test itself all pointed the same direction, so this reads as a genuine bug in the original sketch, not an intentional design choice.

Fixed by moving the read-access check to Rule 0 (fires before anything else). Signature, expiry, and unknown-command checks kept their relative order among each other, just shifted down one slot each (now Rules 1, 2, 3). Rules 4-8 (merchant/amount/per-txn/total-cap/txn-limit) are unchanged in content and position. Updated `docs/04-POLICY-ENGINE-SPEC.md`'s code block and added a "Rule order note" explaining the correction, per `CLAUDE.md` rule 3's requirement to update the spec file whenever rule order changes. Confirmed this doesn't affect `05-DEMO-SCRIPT.md`'s scripted `OVER_TOTAL_CAP` scenario — that's a write request, unreachable until Rule 4 regardless of how 0-3 are ordered.

Deliberately did **not** reorder "unknown command" (Rule 3) relative to signature/expiry, even though the same "check cheap things first" logic might suggest it — nothing in either spec or the required tests provides evidence for that change, so extending the fix beyond what the read-access case actually demonstrated would have been guessing, not correcting a proven bug.

**Second deviation — `SpendRequest.access` widened to include `undefined`.** The spec typed it `'read' | 'write'` only, which makes Rule 3's `req.access === undefined` check unreachable dead code under TypeScript — the type itself guarantees it can never be true. `03-WEBCMD-INTEGRATION.md`'s manifest lookup (`Map<string, 'read'|'write'>`) naturally returns `undefined` for an unrecognized command, so the type just needed to say what the real caller's data actually looks like. This is a fail-closed correctness issue, not a style nit: without it, an unrecognized command could never actually hit the `UNKNOWN_COMMAND` deny path through the type system as originally sketched.

Did not implement `rules.ts` — `docs/PROMPTS.md` Phase 1b's prompt only asks for `decide.ts` and `decide.test.ts`; `rules.ts` is described in `01-ARCHITECTURE.md`'s repo layout as "the ordered rule table as data + functions" but nothing currently needs that decomposition, and inventing content for it now would be exactly the kind of unrequested abstraction `CLAUDE.md`/`AGENTS.md` warn against. Left as its Phase 0 comment stub.

**Test run (`src/policy/decide.test.ts`, 11 tests — the 9 required by `docs/PROMPTS.md` Phase 1b plus 2 extra: an `AMOUNT_UNPARSEABLE` case, and a dedicated regression test proving read beats a bad signature):**
```
ok - read access always allows, regardless of mandate state
ok - read access allows even against a badly signed mandate — proves Rule 0 (read) fires before Rule 1 (signature)
ok - unknown command (access undefined) denies with UNKNOWN_COMMAND
ok - expired mandate denies with EXPIRED even if amount is fine
ok - bad signature denies with BAD_SIGNATURE before any other rule can fire (beats EXPIRED)
ok - amount over per_txn_inr denies with OVER_PER_TXN_CAP and correct overBy
ok - amount over remaining ledgerBalanceInr denies with OVER_TOTAL_CAP and correct overBy
ok - merchant not in mandate.scope.merchants denies with MERCHANT_NOT_ALLOWED
ok - txnCountSoFar >= max_txns denies with TXN_LIMIT_REACHED
ok - amount unparseable (undefined) denies with AMOUNT_UNPARSEABLE
ok - a request satisfying every rule allows
```

Full suite: `npm test` → 20/20 passing (9 mandate/sign + 11 decide). `npx tsc --noEmit` → exit 0.


---

## Phase 1c — Dodo Payments integration

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Dodo test-mode account created, API keys obtained
- [ ] `fund()` creates a real Checkout Session — paste session ID/response below
- [ ] `balance()` — **record the ACTUAL field name Dodo's API returns** (doc's guess may be wrong)
- [ ] `draw()` — **record whether request-side idempotency_key is actually supported** (open question in the spec)
- [ ] Integration script run against real API — output pasted below

**What actually happened / deviations:**

**Real API response shapes observed (paste raw JSON):**


---

## Phase 1d — webcmd integration

**Status:** ⚠️ Done with deviation — `manifest.ts` fully done and verified for real; `executor.ts`'s `execute()` implemented per spec but UNVERIFIED against a live command (browser connectivity blocker, see `docs/common/04-BLOCKERS.md` B-002)
**Timestamp:** 2026-07-29, Agent B

- [x] `webcmd doctor` passes on the build machine — **actually: FAILS.** Daemon OK, Runtime (Cloak) connected, Connectivity FAIL ("Browser exec command timed out after 8s"). See real output below.
- [x] `loadManifest()` returns real data, write-command count recorded: **228 write / 577 read / 805 total** (spec's doc guessed "~192" write and "~302" total — both real numbers are notably higher)
- [x] Fail-closed behavior confirmed for an unknown command (`accessMap.get()` on a nonsense site/command returns `undefined`)
- [x] Live-fetch-fails-fall-back-to-cache path tested at least once (ran the manual-check script with `PATH` stripped of webcmd's location — confirmed `execSync` throws, caught, falls back to the 805-entry disk cache, identical results)

**What actually happened / deviations:**

Installed `@agentrhq/webcmd@0.4.3` globally (`npm i -g @agentrhq/webcmd@0.4.3`) — clean install, no errors. Ran `webcmd doctor`, which reported a genuine failure (pasted below) — per `docs/PROMPTS.md` Phase 1d's explicit "do not proceed past a failing doctor check," stopped before attempting to implement/verify anything that requires live browser execution. Diagnosed further to scope the actual blast radius before flagging it: `webcmd list -f json` (the manifest fetch `loadManifest()` depends on) works perfectly and needs no live browser session — it returned real, large data (805 commands total). Confirmed `blinkit/place-order` really is classified `access: 'write'`. Confirmed no Chrome/browser process was running on the machine at all (`tasklist | grep chrome` empty) and that `webcmd profile list` reports zero active Cloak runtime profiles, meaning no browser-backed command has ever succeeded here — consistent with the Connectivity check's failure, not a fluke.

Given this scoping, implemented `src/webcmd/manifest.ts` for real (matches `docs/03-WEBCMD-INTEGRATION.md` § Step 1 exactly, with the `ManifestCommand` interface trimmed to the three fields actually consumed — the real payload carries 14 fields, not the 5 in the spec's sketch). Wrote `src/webcmd/manifest.manual-check.ts` (not a `*.test.ts`, so it's excluded from `npm test`'s auto-discovery — run directly via `ts-node`) and ran it for real; output below.

Also implemented `src/webcmd/executor.ts`'s `execute()` matching `docs/03-WEBCMD-INTEGRATION.md` § Step 5 exactly, plus `hasAlreadyDrawn()`/`recordDraw()` — the idempotency guard against `ledger.jsonl` that `docs/PROMPTS.md` Phase 1c's prompt requires to live in this file, not in `DodoCreditLedger`. The `ledger.jsonl` entry shape (`{ runId, reserveRef, amountInrPaise, ts }`) wasn't specified anywhere in the docs, so this is a real design decision — see `docs/common/02-DECISIONS.md` ADR-004. `hasAlreadyDrawn()`/`recordDraw()` are pure filesystem logic with zero webcmd/browser dependency, so they ARE genuinely tested for real (round-trip script, output below) despite the connectivity blocker. `execute()` itself could not be exercised against a real webcmd subprocess — any real invocation would hit the same timeout the doctor check hit — so it is implemented but not verified, and Phase 1d is marked ⚠️ rather than ✅ for exactly that reason. Per `CLAUDE.md` rule 7, this is not being papered over with a fake/mocked subprocess to manufacture a passing test.

**Real `webcmd doctor` output:**
```
webcmd v0.4.3 doctor (node v24.14.0)

[OK] Daemon: running on port 9777 (v0.4.3)
[OK] Runtime: cloak connected (v0.4.5)
[FAIL] Connectivity: failed (Browser exec command timed out after 8s; it may still complete in the browser.)

Issues:
  • Browser connectivity test failed: Browser exec command timed out after 8s; it may still complete in the browser.
```

**Real `webcmd list -f json` shape observed** (fields present on every entry; only `site`/`name`/`access` are consumed by `loadManifest()`):
```
command, site, name, aliases, description, access, strategy, browser, args, columns, domain, example, defaultFormat, siteSession
```

**`manifest.manual-check.ts` real output:**
```
Total commands loaded: 805
Write-access commands: 228
blinkit/place-order access: write
nonsense command lookup: undefined (fail-closed, correct)
```

**Fallback-to-cache test** (ran the same script with `PATH` restricted to just Node's own install dir, excluding webcmd's global-bin location):
```
'webcmd' is not recognized as an internal or external command,
operable program or batch file.
Total commands loaded: 805
Write-access commands: 228
blinkit/place-order access: write
nonsense command lookup: undefined (fail-closed, correct)
```
(The "not recognized" line is `execSync`'s own stderr passthrough on failure — `loadManifest()` caught the thrown error and fell back to `manifest.json`, same 805 entries, no crash.)

**`executor.manual-check.ts` real output** (ledger idempotency guard only — `execute()` not exercised, see above):
```
Before any record — unseen runId: false
After recording — same runId: true
After recording — different runId: false
Cleaned up test ledger file.
```

`npx tsc --noEmit` → exit 0 after every step above. `npm test` → 10/10 passing throughout (unaffected — no unit tests added this phase, `*.manual-check.ts` files are deliberately excluded from `node --test`'s discovery).


---

## Phase 1e — Receipts and verify chain

**Status:** ✅ Done as spec'd — no deviations this phase
**Timestamp:** 2026-07-29, Agent A

- [x] Two-receipt chain verifies cleanly
- [x] Tampering with receipt N breaks verification of receipt N+1's chain link

**What actually happened / deviations:**

Implemented `src/receipt/schema.ts` (`Receipt` interface, matches `04-POLICY-ENGINE-SPEC.md` exactly) and `src/receipt/chain.ts` (`buildAndSignReceipt()`, `verifyReceipt()` — both copied faithfully from the spec's code, no changes needed — plus `sha256Hex()` and `verifyChain()`, which the spec describes in prose but doesn't show code for).

No spec bugs found this phase, unlike 1a/1b — the Receipt schema and chain logic were internally consistent and matched cleanly against `docs/05-DEMO-SCRIPT.md` Beats 6-7's expected output shape (`sha256:` prefix on hashes, `sha256:0000...` for the chain head).

**Design notes on the two functions the spec described but didn't show code for:**
- `sha256Hex(obj)`: `sha256:` + hex digest of `sha256(canonicalJSON(obj))`. Exported generically (not `hashReceipt`-specific) because `Receipt.mandate_hash` needs the exact same "sha256 of canonicalJSON(x)" computation — Phase 1f's CLI can reuse this directly instead of duplicating it when it builds real receipts.
- `verifyChain(receipts, gatePublicKey)`: sorts by `signed_at`, then for each receipt checks both its own signature (`verifyReceipt()`) and whether `prev_receipt_hash` matches `sha256Hex()` of the immediately preceding receipt (or `CHAIN_HEAD_HASH` for the first). Takes an already-parsed `Receipt[]`, not file paths — reading `receipts/*.json` off disk is a CLI-layer (Phase 1f) concern, `chain.ts` itself stays pure per the same "logic before I/O" pattern as `decide()`.

**Test run (`src/receipt/chain.test.ts`, 4 tests — the 2 required by `docs/PROMPTS.md` Phase 1e plus 2 extra: a round-trip check and a chain-head-only case):**
```
ok - buildAndSignReceipt() + verifyReceipt() round-trip: an unmodified receipt verifies
ok - a single-receipt chain (chain head only) verifies cleanly
ok - a valid two-receipt chain verifies cleanly end to end
ok - editing any field in the first receipt breaks the SECOND receipt's chain link, not just the first receipt's own signature
```
The last test explicitly asserts three things at once, matching the prompt's emphasis: the tampered first receipt's own signature fails, the untouched second receipt's own signature still passes, and the second receipt's chain link fails anyway — proving the chain link is a distinct check from either receipt's own signature.

Full suite: `npm test` → 24/24 passing. `npx tsc --noEmit` → exit 0.


---

## Phase 1f — CLI and two-pane UI

**Status:** ⚠️ Done with deviations — partial by necessity, not choice. `gate scan`, `gate mandate create/resign`, `gate receipt show`, `gate verify` are real and verified end to end. `gate run`/`gate fund` are NOT implemented — both need `src/ledger/Ledger.ts` to exist as real code, which is Phase 1c (Agent B), blocked on B-001. They exist as dispatcher cases that fail with an honest, specific message rather than being silently absent or mocked.
**Timestamp:** 2026-07-29, Agent A

- [x] Every implemented subcommand runs without crashing (`scan`, `mandate create`, `mandate resign`, `receipt show`, `verify`) — real output pasted below
- [x] Two-pane UI (`src/cli/ui.ts`) implemented as pure, unit-tested rendering functions — legibility not yet confirmed in an attached terminal, since `gate run` (its real caller) isn't wired yet
- [ ] `gate run`/`gate fund` — blocked on Phase 1c, see below

**What actually happened / deviations:**

This phase needed more new foundational infrastructure than any prior one, because Phases 1a-1e only ever took `KeyObject`s as function arguments — nothing before this needed to persist a keypair across separate CLI process invocations. Built, in order:

**New foundational pieces (not explicitly named in any spec file, but required to make the CLI real):**
- `src/mandate/id.ts` — `generateId(prefix)`. The spec says "ULID recommended" for `mandate_id`/`receipt_id`/`event_id`, but nothing downstream parses an ID's timestamp back out or validates ULID format, so a spec-correct Crockford-base32 ULID would be complexity with no payoff. Implemented a simpler real scheme instead: timestamp (base36) + crypto-random suffix — genuinely unique, not byte-for-byte ULID format.
- `src/mandate/did.ts` — `publicKeyToDidKey()`. A **real** `did:key` (W3C did-method-key) encoder: extracts the raw 32-byte Ed25519 public key via `KeyObject.export({format:'jwk'})`, prepends the real multicodec prefix for ed25519-pub (`[0xed, 0x01]`), hand-writes a base58btc encoder (no library — `node:crypto` + a ~15-line big-integer division loop). Verified against 5 real generated keys before writing any test: every one produced the well-known `did:key:z6Mk` prefix, matching `docs/05-DEMO-SCRIPT.md`'s example exactly. Not cryptographically load-bearing anywhere (`decide()` verifies against a `publicKey` argument, never by parsing `mandate.issuer`) but doing it correctly costs little and means the field is a real, independently-decodable identifier rather than a cosmetic string.
- `src/mandate/currency.ts` — `formatInr()`. Found while running `gate mandate resign` for real: raw interpolation produced `₹1500`, not the demo script's `₹1,500`. `Intl.NumberFormat('en-IN')` handles Indian lakh/crore digit grouping correctly out of the box (verified: `1500`→`"1,500"`, `100000`→`"1,00,000"`) — zero new dependency. Applied everywhere an INR amount is displayed: `renderConsent()`, `gate mandate resign`, `gate receipt show`, and `src/cli/ui.ts`'s event/status-strip formatters.
- `src/cli/keys.ts` — `getOrCreateKeyPair('issuer' | 'gate')`. **This is the answer to a real gap Agent B found** while building the dashboard's `/receipts` route (see `docs/agent-b/WORKSPACE.md` § Notes for Agent A): the gate's own Ed25519 keypair had no defined disk location. Design: `keys/{issuer,gate}.{private,public}.pem`, gitignored entirely (never committed — consistent with `mandates/`/`receipts/` being per-machine state, and private keys should never touch git history regardless). Auto-generates on first use; on subsequent calls, loads and reuses the same keypair (verified: a signature made after the second `getOrCreateKeyPair()` call verifies against a key loaded fresh from disk, proving it's the same key, not a new one). Refuses to silently regenerate if exactly one of the two PEM files exists (inconsistent/corrupt state) — throws instead, per `docs/agent-a/ERROR-HANDLING.md`'s policy of never silently orphaning something already signed with an existing key. **For Agent B:** the dashboard can read `keys/gate.public.pem` via the same `MANDATE_GATE_DATA_DIR` env var it already uses for `mandates/`/`receipts/`/`events.jsonl` — no new configuration surface.
- `src/cli/store.ts` — file I/O for `mandates/`/`receipts/`, split out of `gate.ts` to keep the dispatcher focused. `loadAllReceipts()` throws loudly on any malformed file (used by `gate verify`'s chain walk — a silently-dropped receipt could make verification pass when it shouldn't); `loadAllMandates()` silently skips a file that fails `isMandate()` (informational use only, by `gate scan`'s governed-count).

**Real bugs found this phase, all by actually running the CLI, not by inspection:**
1. **`renderConsent()`'s time formatting was wrong** (a Phase 1a bug, only surfaced now): the spec's `toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})` produces `"06:00 pm"` on this Node/ICU version (77.1) — leading zero, lowercase am/pm — not Beat 2's `"6:00 PM"`. Fixed: `hour:'numeric'` (drops the leading zero) plus an explicit uppercase pass on the am/pm marker (en-IN's default casing isn't controllable via `Intl` options alone). Verified against both an evening and a morning time.
2. **The currency formatting gap** described above (`₹1500` vs `₹1,500`).
3. **A real cross-machine `.gitignore` mistake from Phase 0**: `manifest.json` was gitignored, but Agent A's machine has no `webcmd` install (by design — that's Agent B's territory) and no way to generate one. Un-ignored it — it's a relatively stable cache of external reference data, not per-run demo state like `mandates/`/`receipts/`/`ledger.jsonl`, which stay gitignored. **Agent B: please commit your real `manifest.json`** (805 commands, 228 write, per your own B-002 entry) so `gate scan` can be verified against real data on this side too — right now it's only been tested against a small hand-built local fixture (never committed, deleted after use), which proves the counting logic is correct but isn't "real" in the sense this project otherwise insists on.
4. **`SpendRequest.access` and `gate mandate resign`'s per-txn-cap gap were caught earlier (Phase 1b), not this phase** — noting only to avoid duplicate-sounding entries; not re-litigating here.

**Design decisions made to fill genuine spec gaps (not guessed at silently):**
- `gate mandate create` has no `--categories` or `--max-txns` flag anywhere in `docs/05-DEMO-SCRIPT.md` Beat 2 or `docs/PROMPTS.md`'s subcommand list, but `Mandate.scope` requires both. Defaulted `categories` to `["groceries"]` (the product brief's whole scenario) and `max_txns` to `1` (matching Beat 5's implied "txn 1/1"), both with optional flag overrides.
- `gate mandate resign --cap 1500` (Beat 5) with no `--per-txn` flag: defaulted `per_txn_inr` to the new cap value. Without this, the retry in Beat 5 would still fail Rule 6 (per-txn cap), since the original mandate's `per_txn_inr` was 800.
- `gate mandate create`'s reserve line: prints an honest "not yet funded" message rather than Beat 2's "reserve ₹800 blocked" — funding is `gate fund`, a separate command per `docs/01-ARCHITECTURE.md`'s own data flow, and it's blocked on Phase 1c regardless.
- **Left as an explicitly open question, not guessed at**: whether `gate mandate resign` should itself top up the Dodo reserve (Beat 5's `gate run` retry shows `reserve ₹1,500 → drawn ₹1,412`, implying the reserve grew, but resign's own output line shows no reserve change, and the mechanism depends entirely on `Ledger`, which doesn't exist as code yet). Logged in `docs/agent-a/TASKS.md` as a Phase 1g item to resolve once Phase 1c is real, not resolved by guessing here.
- `gate verify`'s failure message doesn't name the specific tampered field (Beat 7's illustrative `"tampered at field cart.total_inr"` would require diffing against a stored original, which nothing in this system keeps) — reports the failure honestly without inventing a field name.

**Real CLI runs (all commands below, actually executed, not illustrative):**

```
$ gate mandate create --subject "agent:grocery-runner" --cap 800 --per-txn 800 --merchants blinkit,zepto,bigbasket --expires "18:00"
✓ MANDATE mnd_ms52bt99fcfb7e41d819 signed

  "agent:grocery-runner may spend up to ₹800 at Blinkit, Zepto or BigBasket, in one transaction, before 6:00 PM today."

  ed25519 · issuer did:key:z6MksTKc3mEANyANjcbMwpYD9zqtBuLnwKArT1X2XxgZ9vni
  reserve: not yet funded — run `gate fund mnd_ms52bt99fcfb7e41d819 --amount <n>` once available (blocked on Phase 1c, see docs/common/04-BLOCKERS.md B-001)

$ gate mandate resign mnd_ms52bt99fcfb7e41d819 --cap 1500
✓ MANDATE mnd_ms52bvlh67abe339bae9 signed — ₹1,500

$ gate receipt show rcp_ms52cnbt186a601beacb
✓ RECEIPT rcp_ms52cnbt186a601beacb signed

  mandate  sha256:4f2a9b1c...        cart     blinkit · 7 items · ₹1,412
  payment  dodo_test · captured
  run      blinkit/place-order · run_4821_1754000000
  evidence trace sha256:8c1d2e3f...
  prev     sha256:0000...        (chain head)

$ gate verify rcp_ms52cnbt186a601beacb
✓ signature valid · chain intact

$ sed -i 's/1412/9999/' receipts/rcp_ms52cnbt186a601beacb.json
$ gate verify rcp_ms52cnbt186a601beacb
✗ signature invalid — receipt tampered

$ gate verify rcp_ms52cnc17bb8bf66975c   # the second, untouched receipt
✗ chain link invalid — a prior receipt in this chain doesn't match its recorded hash

$ gate scan   # against a small local fixture manifest — see deviation 3 above
✓ webcmd manifest loaded — 3 sites, 8 commands
  4 marked access:'write'
  0 currently governed    # (with no mandates present)
  3 currently governed    # (with the two mandates above present, matching their merchants)

$ gate run -- webcmd blinkit place-order --confirm
✗ gate run is not available yet.
  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001
  (no real Dodo test-mode account yet). src/webcmd/executor.ts is implemented but
  unverified against a live command — see B-002. See docs/common/04-BLOCKERS.md.

$ gate fund mnd_x --amount 800
✗ gate fund is not available yet.
  It needs src/ledger/Ledger.ts to exist as real code — Phase 1c is blocked on B-001
  (no real Dodo test-mode account yet). See docs/common/04-BLOCKERS.md.
```

All receipt/mandate fixtures used above were generated with the actual production signing code (`buildAndSignReceipt()`, `sign()`), never hand-typed fake JSON — then deleted after testing, along with the temporary fixture manifest.json, so no fake data lingers in the repo's gitignored runtime folders (mirroring Agent B's own fixture-cleanup practice for the dashboard).

Full suite: `npm test` → 45/45 passing (24 from Phases 1a/1b/1e + 21 new: `id` (2), `did` (3), `currency` (3), `keys` (4), `ui` (7), `render`'s 2 new time-format tests). `npx tsc --noEmit` → exit 0.

---

## Phase 1g — End-to-end run (the real acceptance test)

**Status:** ⏳ Not started
**Timestamp:**

**Full pasted terminal output of the complete Beat 1–8 run:**

```
(paste here)
```

**Elapsed time of the run:**

**Acceptance checklist from `05-DEMO-SCRIPT.md`, checked against this real run:**

- [ ] Beats 1–6 ran against real webcmd + real Dodo, end to end
- [ ] Beat 4's DENY confirmed to NOT spawn a webcmd subprocess
- [ ] `gate verify` reflected real signature checks, not hardcoded output
- [ ] Full run completed within 4 minutes
- [ ] Fallback recording exists, dated

**Gaps found and how they were fixed:**


---

## Phase 1h — Dashboard (Next.js, read-only)

**Status:** ⚠️ Done with deviations (see below) — core acceptance checklist passes for real; one item can't be tested until Phase 1f (CLI) exists
**Timestamp:** 2026-07-29, Agent B

- [x] Next.js version actually installed: **16.2.12** (App Router, Turbopack), React 19.2.4, Tailwind CSS v4
- [x] `/`, `/events`, `/receipts` all show real data, not mocked — verified in an actual Chrome tab (screenshots taken), against real fixture data generated with the production signing code (`src/mandate/sign.ts`, `src/receipt/chain.ts`), not hand-typed JSON
- [x] Confirmed no API route writes anywhere (code-reviewed) — all three routes (`app/api/mandate|events|receipts/route.ts`) export only `GET`, no filesystem writes, no `Ledger` calls, no webcmd invocation anywhere in `dashboard/`
- [x] Confirmed only `DODO_API_KEY_READONLY` is used in this app, never the write key — grepped `dashboard/` for `DODO_API_KEY` (without `_READONLY`), zero matches
- [x] `npm run build && npm run start` tested — real production build + start, verified via curl and an actual browser tab, not `next dev`
- [ ] Dashboard process killed mid-rehearsal, CLI demo path confirmed unaffected — **cannot test yet**, Phase 1f (`gate` CLI) doesn't exist. Revisit once Agent A ships it; nothing about this app's design should make it fail (it's fully read-only, own process, own port), but "should" isn't "confirmed."

**What actually happened / deviations:**

Scaffolded with `npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm`, then `npm install dodopayments` inside `dashboard/` (its own dependency tree, separate lockfile, per `docs/06-DASHBOARD-SPEC.md`). This Next.js version ships its own `AGENTS.md` warning that it has breaking changes from older Next.js conventions — read its bundled `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and the actual generated `app/page.tsx`/`app/layout.tsx` before writing any route/page code, rather than assuming prior-knowledge conventions still applied. They mostly did (Route Handlers, `params` as a `Promise`, App Router file conventions) — no exotic API surface was actually needed for this app's scope.

Implemented exactly the structure in `docs/06-DASHBOARD-SPEC.md`: `lib/types.ts`, `lib/hash.ts` (`canonicalJSON()`/`sha256Hex()`/`CHAIN_HEAD_HASH`, byte-for-byte duplicates of `src/mandate/sign.ts` and `src/receipt/chain.ts` — verified by testing the tamper-test scenario, see below), `lib/read.ts` (mandate/events/receipts file reading + local chain verification), `lib/dodo.ts` (balance lookup), three API routes, three pages, four components (`StatusBadge`, `EventRow`, `ReceiptCard`, `ReserveBalanceCard`).

**Deviation 1 — real SDK types diverge substantially from `docs/02-DODO-INTEGRATION.md`'s balance-read sketch.** Discovered by reading the installed `dodopayments` package's actual `.d.ts` files directly (no live account needed for this, though B-001 still blocks an actual call): there is no `creditEntitlementBalances.retrieve(reserveRef)` method. Balances are keyed by `(customer_id, credit_entitlement_id)` via `client.creditEntitlements.balances.retrieve()`; resolving a checkout-session-style `reserveRef` to a customer requires a second hop (`checkoutSessions.retrieve(id).payment_id` → `payments.retrieve(payment_id).customer.customer_id`). `lib/dodo.ts` implements this real chain, handles either convention defensively (a `cus_...` id used directly, or a session id resolved through the chain), and is clearly marked unverified-live pending B-001 — same posture as Phase 1d's `execute()`. Full writeup with the exact real interfaces in this file's "Running list of open questions resolved" table above. Added `DODO_CREDIT_ENTITLEMENT_ID` to `.env.example` (root) and `dashboard/.env.local.example` — needed by this real chain, not in the original spec's env var list.

**Deviation 2 — RESOLVED 2026-07-29, same day, once Agent A's Phase 1f shipped `src/cli/keys.ts`.** `signature_valid` is now a real boolean, not always `null`. `dashboard/lib/hash.ts` gained `verifySignature()` (duplicate of `src/mandate/sign.ts`'s `verify()`, per the same duplication note as `canonicalJSON()`/`sha256Hex()`), `dashboard/lib/read.ts` gained `loadGatePublicKeyPem()` (reads `keys/gate.public.pem` via `MANDATE_GATE_DATA_DIR`, returns `null` gracefully if it doesn't exist yet rather than throwing — no receipt has ever been signed on a fresh machine until the CLI runs once), and `verifyChainLocal()` now takes the key and computes real signature checks alongside chain-link checks.

**Verified for real, not just "it compiles":** bootstrapped a real local `keys/gate.{private,public}.pem` via the actual `getOrCreateKeyPair('gate')` from `src/cli/keys.ts` (not a mock — the same function `gate run` will call), signed two real fixture receipts with it, and confirmed via the dashboard's `/api/receipts` route: both receipts showed `signature_valid: true, chain_link_valid: true`. Then repeated the tamper test from before, this time watching all four signals at once: editing `rcp_fixture001`'s `total_inr` flipped **its own** `signature_valid` to `false` (real crypto catching the tamper directly) while its `chain_link_valid` stayed `true` (correctly unaffected — that check is about the *previous* receipt), and flipped `rcp_fixture002`'s `chain_link_valid` to `false` while its `signature_valid` stayed `true` (untouched receipt, still correctly signed, but now provably linked to a corrupted predecessor). All four values reverted correctly after undoing the edit. Deleted the bootstrapped `keys/` and fixture data afterward, same cleanup discipline as before.

**Deviation 3 — "current mandate" resolution is an undocumented design call.** `mandates/` can hold more than one file (`gate mandate resign` creates a new `mandate_id` rather than mutating the original, per `05-DEMO-SCRIPT.md` Beat 3-4). `readCurrentMandate()` picks the greatest `mandate_id` by string sort (ULIDs sort lexicographically by creation time) — not specified anywhere else, documented as a comment in `lib/read.ts`.

**Real verification, not just "it compiles":** Generated real, cryptographically valid fixtures (a signed mandate, two hash-chained signed receipts, four `GateEvent`s) using the actual production `sign()`/`buildAndSignReceipt()` functions from `src/mandate/sign.ts`/`src/receipt/chain.ts` — not hand-typed JSON, not a dashboard-side mock — via a one-off script (`_gen-fixtures.ts`, deleted after use, not committed). Ran `npm run build && npm run start` for real. Confirmed via `curl` and an actual Chrome tab (`mcp__claude-in-chrome`):
- `/` showed the real mandate fields, correct expiry countdown, and the balance card correctly displaying "Unavailable — Dodo not yet configured (missing DODO_API_KEY_READONLY or DODO_CREDIT_ENTITLEMENT_ID)" (both env vars were deliberately left unset to test this real degradation path, not a happy-path-only test)
- `/events` showed all 4 events, reverse-chronological, color-coded verdict badges, and confirmed via network-request inspection that polling correctly uses `?since=<last_event_id>` and appends only new rows rather than re-fetching the whole list
- `/receipts` showed both receipts with `chain_link_valid: true`. **Then performed the actual tamper test**: edited `total_inr` in `receipts/rcp_fixture001.json` on disk while the dashboard was running, waited for the next poll cycle (no manual refresh) — the SECOND receipt's badge flipped live from "chain valid" to "chain INVALID" in the browser, while the tampered receipt's own badge stayed "chain valid" (only its own field changed, its own link to `CHAIN_HEAD_HASH` is unaffected) — this is the exact distinction `05-DEMO-SCRIPT.md` Beat 7 and this file's Phase 1e entry require. Reverted the edit afterward.
- Zero console errors in the browser tab throughout.

Fixed a Turbopack build warning ("whole project traced unintentionally") by setting `turbopack.root` in `next.config.ts` to the dashboard's own directory (it's a genuinely separate app, not a workspace member of the outer repo) and adding a `turbopackIgnore` comment on the one dynamic `process.cwd()` path resolution in `lib/read.ts` — cosmetic, not a functional bug, but worth doing cleanly since it flagged real over-tracing.

`npm audit` in `dashboard/` reports 12 high-severity advisories, all pre-existing in `create-next-app`'s own scaffold dependency tree (eslint/postcss/sharp transitive deps), not introduced by adding `dodopayments`. Fixing them requires downgrading Next.js itself (`npm audit fix --force` → Next 9.x) — not worth it for a locally-run demo dashboard; noting instead of silently ignoring.

Deleted the fixture data and generator script after verification (`_gen-fixtures.ts`, the fixture `mandates/`/`receipts/`/`events.jsonl` files) so no fake data is sitting in the repo's runtime-data folders — those paths are gitignored anyway, but leaving fabricated data around risked confusing a future real demo run or Agent A's own Phase 1f testing.


---

## Phase 2-4 — Stub verification

**Status:** ⏳ Not started
**Timestamp:**

- [ ] All four stub files compile
- [ ] No Phase-1 runtime path imports any stub
- [ ] Any stub not meeting the definition — what was fixed:

**What actually happened / deviations:**


---

## Phase 5 — Rehearsal results

**Status:** ⏳ Not started
**Timestamp:**

| Run # | Network | Duration | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Fallback video recorded:** Y/N, path:
**Browser-less fallback path rehearsed:** Y/N
**`gate verify` tested on an older receipt:** Y/N, result:
**Bugs found during rehearsal:**


---

## Running list of open questions resolved during the build

(Move items here from the "Open questions" sections of `02-DODO-INTEGRATION.md` and `01-ARCHITECTURE.md` once answered for real, with the real answer.)

| Question | Where it was open | Real answer found | Date |
|---|---|---|---|
| Does Dodo's checkout/payment API accept a request-side idempotency key? | `02-DODO-INTEGRATION.md` | **Partially, from real SDK types (not yet a live call — B-001 still blocks that).** `checkoutSessions.create()`'s params (`CheckoutSessionCreateParams`) have no `idempotency_key` field at all — no evidence funding itself is natively idempotent. But the actual spend-deduction operation is a different, real SDK method than the doc guessed (`client.creditEntitlements.balances.createLedgerEntry(customerID, { credit_entitlement_id, entry_type: 'debit', amount, idempotency_key })` — not `creditEntitlements.deduct()`, which doesn't exist), and its params (`BalanceCreateLedgerEntryParams`) DO include a real `idempotency_key?: string \| null` field. So the piece that actually matters for `draw()` (the deduct call) has native idempotency support; the `ledger.jsonl` guard built in Phase 1d (`hasAlreadyDrawn`/`recordDraw`, see ADR-004) stays as defense-in-depth per the spec's "belt and suspenders" instruction, not because native support is absent. | 2026-07-29, Agent B |
| Exact field name for Credit Entitlement Balance | `02-DODO-INTEGRATION.md` | **From real SDK types (not a live response yet):** the doc's guess of `balance` was correct, but the *shape around it* is not what the sketch assumed. There is no `creditEntitlementBalances.retrieve(reserveRef)` method at all. The real hierarchy is `client.creditEntitlements.balances.retrieve(customerID, { credit_entitlement_id })` → `CustomerCreditBalance { id, balance: string, credit_entitlement_id, customer_id, overage, ... }` — keyed by **customer**, not by checkout-session id. `balance` is a `string` (decimal), not a `number`. This means `Ledger.fund()`'s `reserveRef` can't simply be the checkout session's `session_id` (also note: the field is `session_id`, not `.id` as the doc's sketch used) if `balance()`/`draw()` need a customer id — resolving a session to its customer requires `checkoutSessions.retrieve(session_id).payment_id` → `payments.retrieve(payment_id).customer.customer_id`. Recorded here now so whoever picks up Phase 1c (still blocked on B-001) doesn't re-derive this from scratch; the dashboard's `/api/mandate` route (Phase 1h) implements this resolution chain for real, marked unverified-live pending B-001, same as Phase 1d's `execute()`. | 2026-07-29, Agent B |
| Is the $1,000 promotional credit visible/real in the dashboard? | vault `_TASKS & STATUS` Q8 | | |

---

## Final pre-hackathon status (fill in night of 31 Jul)

**What shipped, exactly:**

**What was cut, and why:**

**Known risks going into Saturday:**

**Confidence level for the live demo (1–5):**

---

This log exists so spec-vs-reality drift is visible, not lost. Update it every time a phase in `PROMPTS.md` finishes running.
