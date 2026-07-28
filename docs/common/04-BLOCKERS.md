# 04 — Active Blockers

A fast-scan list of anything currently stopping either agent. This is deliberately separate from `docs/OUTCOME.md`'s per-phase `❌ Blocked` status (which stays the detailed official record, per `CLAUDE.md`'s existing rule) — this file is the thing you check in five seconds at the start of every session to see if the other agent is stuck on something you can unblock, or if you're about to walk into a known wall.

**Rules:**
- Add an entry the moment something blocks you — don't wait until your next scheduled sync to mention it, push a `04-BLOCKERS.md` update immediately per `00-START-HERE.md`.
- Move resolved entries to the "Resolved" table below (don't delete them — a resolved blocker is useful history for `docs/OUTCOME.md`'s "Running list of open questions resolved during the build" section, and sometimes worth its own `02-DECISIONS.md` entry if resolving it involved a real judgment call).
- If a blocker is genuinely a project-level prerequisite issue (missing Dodo account, webcmd not logging in, an API behaving differently than documented in a way that blocks progress), this is also exactly the case `CLAUDE.md` § "If you're blocked" describes — log it here **and** in `docs/OUTCOME.md`'s current phase section, and stop rather than inventing a workaround that violates a hard rule.

## Open

| ID | Raised by | Date | Blocking | Description | Status |
|---|---|---|---|---|---|
| B-001 | Agent B | 2026-07-29 | Phase 1c (Dodo Payments integration) | No real Dodo Payments test-mode account exists yet. `docs/02-DODO-INTEGRATION.md` and `docs/PROMPTS.md` Phase 1c both require a real account, a write API key (`DODO_API_KEY`) and a read-only key (`DODO_API_KEY_READONLY`) in a local, uncommitted `.env` (see `.env.example`), plus a one-time test-mode Product ("Agent Spend Credits") created in the dashboard. Per `CLAUDE.md` § "If you're blocked," this is not being mocked — Phase 1c code will not be written until this exists. Phase 1d (webcmd) is unaffected and proceeding in parallel. | ❌ Open |

## Resolved

| ID | Raised by | Date raised | Date resolved | Description | Resolution |
|---|---|---|---|---|---|
| _(none yet)_ | | | | | |
