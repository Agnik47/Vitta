# 00 — Start Here (Parallel Development)

You are one of **two** Claude Code instances building Mandate Gate simultaneously, on two different machines, synchronized through Git at `github.com/Agnik47/Vitta`. Read this file before you touch anything else.

## The one rule everything else here serves

**Neither of you should ever need this conversation's chat history to continue.** Everything required to understand current state, pick up the next task, or hand off to the other agent must exist in the repo — in `docs/common/`, your `docs/agent-*/WORKSPACE.md`, `docs/OUTCOME.md`, or the code itself. If you find yourself about to explain something important only in a chat reply instead of writing it down, write it down instead. A session that ends without updating the repo did not really finish.

The numbered specs at `docs/00-07`, `docs/PROMPTS.md`, `docs/OUTCOME.md`, and `docs/AGENTS.md` are unchanged and remain the single source of truth for *what* to build. This folder — plus `docs/agent-a/` and `docs/agent-b/` — is about *who* is building *which part*, right now, why decisions were made, and how the two of you stay in sync while doing it.

## Which agent are you?

Check `docs/agent-a/WORKSPACE.md` and `docs/agent-b/WORKSPACE.md` — one of them will already carry your identity from a prior session. If it's genuinely the first session for either agent and it's ambiguous, ask the user before writing anything. Don't guess and start writing to both.

## Reading order, every session

`docs/common/` splits into two tiers on purpose: **state docs**, which change constantly and must be read fresh every session, and **process docs**, which describe how the workflow works and rarely change once you've internalized them. Don't re-read a process doc end-to-end every session — skim it only when a state doc tells you something in it changed.

**Tier 1 — state docs, read in full, in this order, every session:**

1. `git pull --rebase origin main` first — before reading anything, so what you read next is current.
2. **`01-PROJECT-STATUS.md`** — current project health: what's completed, what's actively being built (by whom), what's still pending, plus live integration/merge readiness.
3. **`02-DECISIONS.md`** — architectural decisions made since your last session. Skim entries older than your last visit; read new ones in full — one of them may change how you approach your current task.
4. **`03-INTERFACES.md`** — shared contracts and whether anything you depend on changed underneath you. If it did, re-verify your in-progress code still compiles/passes before continuing.
5. **`04-BLOCKERS.md`** — anything actively stopping either agent right now.

**Tier 2 — process docs, read in full once (your first session), then only on demand when a state doc flags a change:**

6. `05-PHASE-OWNERSHIP.md` — who owns what, and why.
7. `06-SYNC-WORKFLOW.md` — the git mechanics.
8. `07-INTEGRATION.md` — how the two tracks combine and get verified.

**Handoff log — skim entries newer than your last session, every time:**

9. `08-CHANGELOG.md` — the append-only record of what happened and what it means for you.

**Then, and only then:**

10. Read **your own** `docs/agent-a/WORKSPACE.md` or `docs/agent-b/WORKSPACE.md` to resume exactly where you left off. Skim the *other* agent's workspace file too, for awareness — never write to it.
11. **First session only**, or if step 2-5 flagged a spec change: follow CLAUDE.md's existing required reading order (`docs/00` through `docs/07`, then `docs/PROMPTS.md`). Returning sessions skip straight to step 12.
12. Do the work.

## Before pushing, always

- Run the tests / acceptance check for whatever you just built.
- Update `docs/OUTCOME.md`'s matching section — this is `CLAUDE.md`'s existing rule, still in force, unchanged.
- Update **your own** `docs/agent-a/WORKSPACE.md` / `docs/agent-b/WORKSPACE.md`, including its "Known issues" list if you're leaving any behind.
- Update your section of `docs/common/01-PROJECT-STATUS.md`, including the Integration & Merge Readiness table if a sync point's status changed.
- If you made a real design/engineering judgment call (not just following the spec verbatim) — especially one with alternatives you considered, or one that affects the other agent's work — write it up in `docs/common/02-DECISIONS.md`. If in doubt, write it up; a decision log with one too many entries is cheap, a missing one costs the other agent a re-derivation.
- Append an entry to `docs/common/08-CHANGELOG.md` (see that file for the required fields — it doubles as the handoff note for whatever you just finished).
- If you hit or resolved a blocker, update `docs/common/04-BLOCKERS.md`.
- If a shared contract changed, confirm `docs/common/03-INTERFACES.md`'s registry reflects the new status.
- `git add` the specific files you changed — never `git add -A`, in case a pull landed the other agent's in-flight work mid-session.
- `git pull --rebase origin main` again — the other agent may have pushed while you worked.
- Resolve any conflicts (see `06-SYNC-WORKFLOW.md` § Conflict resolution — most are mechanical).
- `git push`.

## Don't sync only at the end of a phase

Sync at natural checkpoints *within* a session, not just when a whole phase is done. A phase can take hours; the other agent shouldn't be flying blind that whole time. If you've made real progress and are about to context-switch or hit something you need to think through, push what you have — with the workspace, status, and changelog updated — rather than sitting on it.
