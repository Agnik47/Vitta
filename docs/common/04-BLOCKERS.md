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
| B-002 | Agent B | 2026-07-29 | `execute()` in `src/webcmd/executor.ts`, and eventually Phase 1f/1g (any real webcmd write-command run) | `webcmd doctor` on this build machine reports Daemon OK, Runtime ("Cloak") connected, but **Connectivity: FAIL** ("Browser exec command timed out after 8s"). No Chrome/browser process was running when first checked; after installing/retrying, `webcmd profile list` reports "No Cloak runtime profiles are active — run a browser-backed command... to create one," confirming no browser-backed command has ever succeeded on this machine. `webcmd list -f json` (manifest fetch, no live browser needed) works fine and returned real data (805 commands, 228 write-access) — only the actual command-execution path is affected. `src/webcmd/manifest.ts` is unaffected and fully implemented/tested; `execute()` in `src/webcmd/executor.ts` is implemented per spec but **cannot be verified against a real live command** until this is resolved. Per `docs/PROMPTS.md` Phase 1d's explicit instruction ("do not proceed past a failing doctor check"), no further Phase 1d/1f/1g work depending on live execution should proceed until this is fixed — likely needs the user to open/configure a real Chrome session for webcmd's Cloak bridge, or a webcmd-specific setup step not covered in `docs/03-WEBCMD-INTEGRATION.md`. | ❌ Open |

## Resolved

| ID | Raised by | Date raised | Date resolved | Description | Resolution |
|---|---|---|---|---|---|
| _(none yet)_ | | | | | |
