# Agent B — Task List

This is the durable, git-tracked checklist for Agent B's own deliverables. Unlike a chat-only todo list, this survives a session restart or a machine switch — check here first, every session, to know exactly what's done and what's next. Check off items as they're completed; don't wait for a whole phase to finish before checking off its sub-items.

Scope discipline: everything below is work **assigned to Agent B**. Agent A's phases (0, 1a, 1b, 1e, 1f, 1g) are not this agent's job to implement, wait for, or absorb — if something here is blocked on Agent A's output, it's marked as such and left blocked, not worked around. See `docs/common/05-PHASE-OWNERSHIP.md` for the full ownership split.

---

## Phase 1c — Dodo Payments integration (test mode)

Spec: `docs/02-DODO-INTEGRATION.md`. Prompt: `docs/PROMPTS.md` § Phase 1c.

- [ ] Confirm a real Dodo test-mode account exists with `DODO_API_KEY` / `DODO_API_KEY_READONLY`, and a local uncommitted `.env` is populated — **do not proceed past this without real keys** (`CLAUDE.md` rule 7: never mock this)
- [ ] `src/ledger/Ledger.ts` — interface (created in Phase 0 scaffolding, frozen — do not redefine)
- [ ] `src/ledger/DodoCreditLedger.ts implements Ledger`
  - [ ] `fund()` — real Checkout Session, tagged `metadata.mandate_id`
  - [ ] `balance()` — real Credit Entitlement Balance retrieval (verify actual SDK method/field names against a real response before finalizing — the doc's version is a sketch)
  - [ ] `draw()` — deduct credit tagged with `runId`; confirm whether the SDK/API takes a request-side `idempotency_key`; if not, the disk-based fallback (`ledger.jsonl` runId check) lives in `src/webcmd/executor.ts`, not in `DodoCreditLedger` itself
  - [ ] `release()` — test-mode no-op is acceptable for Phase 1
- [ ] Integration script (not a unit test — real network): create session → fund ₹800 → read balance → draw ₹100 with a fake runId → read balance again → print every raw API response
- [ ] Run it for real, paste actual output into `docs/OUTCOME.md` (Phase 1c section)
- [ ] Update `docs/common/03-INTERFACES.md` if the real response shape forces any change to the sketched fields

## Phase 1d — webcmd integration

Spec: `docs/03-WEBCMD-INTEGRATION.md`. Prompt: `docs/PROMPTS.md` § Phase 1d.

- [ ] Confirm `webcmd doctor` succeeds on this machine; install `@agentrhq/webcmd@0.4.3` globally if missing — do not proceed past a failing doctor check
- [ ] `src/webcmd/manifest.ts` — `loadManifest()`: live-fetch with disk-cache fallback; a live-fetch failure must never crash the app
- [ ] `src/webcmd/executor.ts` — `execute()`: spawns webcmd for ALLOW decisions, captures `runId`/`columns`/`tracePath`, implements the idempotency fallback check against `ledger.jsonl` (see Phase 1c above)
- [ ] Manual test script:
  - [ ] Prints count of write-access commands found (should be a real number near ~192, not hardcoded)
  - [ ] Looks up `blinkit/place-order`, confirms `access === 'write'`
  - [ ] Looks up a nonsense command name, confirms `undefined` returned (fail-closed case)
- [ ] Run against the real webcmd install, paste actual output into `docs/OUTCOME.md` (Phase 1d section)

## Phase 1h — Dashboard (Next.js, read-only)

Spec: `docs/06-DASHBOARD-SPEC.md`. Prompt: `docs/PROMPTS.md` § Phase 1h. Depends on Agent A's 1b + 1e for the data routes (Sync Point 4) — the app shell does not.

- [ ] App shell: `create-next-app` scaffold at `dashboard/` (own `package.json`, App Router, Tailwind) — can start as soon as 1c/1d are done, does not need frozen schemas
- [ ] Record the exact Next.js version installed into `docs/OUTCOME.md`
- [ ] `GET /api/mandate`, `GET /api/events`, `GET /api/receipts` — GET-only, read-only, no exceptions
- [ ] Pages: `/` (mandate summary + live Dodo balance), `/events` (live feed, 1.5-2s polling, no WebSockets/SSE), `/receipts` (verify status)
- [ ] Verify no route imports `DODO_API_KEY` (write key) — only `DODO_API_KEY_READONLY`
- [ ] `npm run build && npm run start` (not `next dev`), confirm all three pages show real data from the actual CLI-produced `mandates/`, `receipts/`, `events.jsonl`
- [ ] Kill the dashboard process mid-run, confirm the CLI demo sequence is completely unaffected
- [ ] Go through `docs/06-DASHBOARD-SPEC.md` § Acceptance checklist explicitly, log results into `docs/OUTCOME.md`

## Shared / filler work (pick up when blocked on the above)

- [ ] Phase 2-4 stub verification (`docs/PROMPTS.md` § Phase 2-4) — either agent, whoever is idle
- [ ] Phase 5 rehearsal — joint, live session with Agent A, not solo

---

## Current blockers against this list

See `docs/common/04-BLOCKERS.md` for the live, shared version of this. As of this file's creation:
- Phase 1c needs a real Dodo test-mode account + `.env` — not yet present on this machine.
- Phase 1d needs `@agentrhq/webcmd@0.4.3` installed and `webcmd doctor` passing — not yet installed on this machine.

Neither blocker excuses picking up Agent A's phases instead — see the scope note at the top of this file.
