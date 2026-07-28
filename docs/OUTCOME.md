# OUTCOME — Build Log

> This file is the running record of what actually happened, as it happened, against the plan in `PROMPTS.md`. Fill in the matching section immediately after each phase prompt finishes running — not at the end of the day, not from memory later. If something in the code ends up different from what `00`–`05` specified, write it here and update the relevant spec file too, so the two never drift apart.

Rules for using this file:

1. **Every entry gets a timestamp and a status.** Status is one of: ✅ Done as spec'd · ⚠️ Done with deviation (explain) · ❌ Blocked (explain what's needed) · ⏭ Skipped (explain why).
2. **Deviations are not failures — undocumented deviations are.** If Dodo's real API returned a different field name than the doc assumed, that's expected and fine; just write it down and fix the doc.
3. **Copy real terminal output in, don't paraphrase it.** "It worked" is not a log entry. The actual pasted output is.
4. Keep entries in chronological order, oldest first.

---

## Phase 0 — Project scaffolding

**Status:** ⏳ Not started
**Timestamp:**

- [ ] Repo structure created matching `01-ARCHITECTURE.md`
- [ ] `tsc --noEmit` passes
- [ ] `.env.example` + `.gitignore` in place
- [ ] `dodopayments` SDK installed

**What actually happened / deviations:**


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
