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

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Sign/verify round-trip test passes
- [ ] Tamper-detection test passes
- [ ] canonicalJSON key-order independence test passes

**What actually happened / deviations:**


---

## Phase 1b — Policy Engine (`decide()`)

**Status:** ⏳ Not started
**Timestamp:**

- [ ] All rule-table unit tests pass (0 through 8)
- [ ] Rule-order test (BAD_SIGNATURE beats EXPIRED) passes
- [ ] `decide()` confirmed to have zero I/O

**What actually happened / deviations:**


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

**Status:** ⏳ Not started
**Timestamp:**

- [ ] `webcmd doctor` passes on the build machine
- [ ] `loadManifest()` returns real data, write-command count recorded: ___
- [ ] Fail-closed behavior confirmed for an unknown command
- [ ] Live-fetch-fails-fall-back-to-cache path tested at least once

**What actually happened / deviations:**


---

## Phase 1e — Receipts and verify chain

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Two-receipt chain verifies cleanly
- [ ] Tampering with receipt N breaks verification of receipt N+1's chain link

**What actually happened / deviations:**


---

## Phase 1f — CLI and two-pane UI

**Status:** ⏳ Not started
**Timestamp:**

- [ ] All `gate` subcommands run without crashing
- [ ] Two-pane UI legible / correctly formatted

**What actually happened / deviations:**


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

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Next.js version actually installed: ___
- [ ] `/`, `/events`, `/receipts` all show real data, not mocked
- [ ] Confirmed no API route writes anywhere (code-reviewed, not assumed)
- [ ] Confirmed only `DODO_API_KEY_READONLY` is used in this app, never the write key
- [ ] `npm run build && npm run start` tested on the actual demo machine
- [ ] Dashboard process killed mid-rehearsal — CLI demo path confirmed unaffected

**What actually happened / deviations:**


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
| Does Dodo's checkout/payment API accept a request-side idempotency key? | `02-DODO-INTEGRATION.md` | | |
| Exact field name for Credit Entitlement Balance | `02-DODO-INTEGRATION.md` | | |
| Is the $1,000 promotional credit visible/real in the dashboard? | vault `_TASKS & STATUS` Q8 | | |

---

## Final pre-hackathon status (fill in night of 31 Jul)

**What shipped, exactly:**

**What was cut, and why:**

**Known risks going into Saturday:**

**Confidence level for the live demo (1–5):**

---

This log exists so spec-vs-reality drift is visible, not lost. Update it every time a phase in `PROMPTS.md` finishes running.
