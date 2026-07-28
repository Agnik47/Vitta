# 06 — Git Sync Workflow

The mechanics of staying synchronized through Git. `07-INTEGRATION.md` covers *when* these apply to specific phases; this file covers *how* to do it safely, generically, every time.

## Branch strategy: trunk-based, directly on `main`

No long-lived per-agent feature branches, no PRs. See `02-DECISIONS.md` ADR-001 for the full reasoning and rejected alternatives. Short version: the phase split already keeps the two of you on disjoint directories almost the entire build, so the usual reason for feature branches — isolating conflicting work — mostly doesn't apply, and a PR step would add latency without a real second reviewer behind it. Commit small, commit often, push often.

If a specific piece of work is genuinely risky and you want isolation (e.g. an experiment you might throw away), use a short-lived local branch and merge it back into `main` yourself before it's relevant to the other agent — don't push it, don't make the other agent aware it exists until it's either merged or discarded.

## What "merge" means here

There is no merge commit and no PR-merge button in this workflow — "merging" your work into the shared history is the act of `git pull --rebase origin main` followed by `git push`. Your rebased commits land on top of `main` in a straight line. Treat the moment right before that push as the actual merge event: it's the last point where you can verify your change is safe to combine with whatever the other agent has already pushed. That's why the testing gate below happens immediately before push, not after.

## Testing before merge — the gate

**Never push a commit that fails its own phase's tests**, even as a "work in progress" marker. If you need to signal "I'm mid-task, don't build on this yet," use `01-PROJECT-STATUS.md`'s status column (`🔨 In progress`) or the phase table, not a broken commit on `main` — a red `main` blocks the other agent from trusting anything they pull.

Concretely, before every push:
1. Run the specific test/acceptance criteria for whatever you just changed (unit tests for pure logic, the manual integration script for anything hitting a real API, per `docs/PROMPTS.md`'s own per-phase instructions).
2. If you touched anything in `03-INTERFACES.md`'s registry, also re-run the tests for every phase downstream of that contract (see `07-INTEGRATION.md` § Regression avoidance) — not just the phase you're currently working on.
3. If a phase was previously marked `✅ Done, tests passing` in `01-PROJECT-STATUS.md` and your change touches its code, re-verify it's still true before pushing, not after.

## When to pull

- Start of every session.
- Immediately before pushing — always assume the other agent pushed since your last pull.
- Any time `01-PROJECT-STATUS.md` or `08-CHANGELOG.md` (read at session start) suggests the other agent finished something you depend on.
- Use `git pull --rebase origin main`, not a plain `git pull`. This keeps history linear, which matters for the append-only logs (`08-CHANGELOG.md`, `02-DECISIONS.md`, `docs/OUTCOME.md`) — a merge commit in the middle of an append-only file's history makes `git log` for that file harder to read for no benefit.

## When to push

- After every meaningful unit of work — a passing test suite for a sub-step, not just a fully finished phase. A phase can span hours; don't make the other agent wait that long to see progress.
- Always after updating any shared doc (`docs/common/*`, `docs/OUTCOME.md`) — stale shared docs are the exact failure mode this structure exists to prevent.
- Before stepping away from the session for any real length of time.

## Commit hygiene

- `git add` specific files, never `git add -A` or `git add .`. A stray pull mid-session can land files you didn't touch; blind-adding risks committing the other agent's in-flight work under your name, or committing your own half-finished doc edits alongside a real code commit.
- One logical change per commit where practical (e.g. "Phase 1a: mandate schema + sign/verify" as one commit, not one commit per file) — but don't over-split either; this isn't a library with a public commit-message audience, it's two agents narrating progress to each other.
- Commit messages should say what phase/task this is, not just what changed: `"Phase 1c: DodoCreditLedger.fund()/balance() against real test-mode API"` is more useful to the other agent than `"add ledger functions"`.

## Files that are genuinely shared and need care

- **Root `package.json` / `package-lock.json`** — per `docs/01-ARCHITECTURE.md`, this should stabilize after Phase 0 (only `dodopayments` + TS tooling are needed; webcmd is a global install, not a dependency). If you do need to add something here after Phase 0, pull immediately before, push immediately after, and flag it in `08-CHANGELOG.md` — don't let it sit uncommitted while you keep working.
- **`dashboard/package.json`** — entirely inside Agent B's territory (`dashboard/`), never touched by Agent A. No coordination needed.
- **`src/events/GateEvent.ts`** — see `03-INTERFACES.md`. Frozen after Phase 0; treat any edit as a change-protocol event, not a routine commit.
- **Append-only shared logs** (`08-CHANGELOG.md`, `02-DECISIONS.md`, `docs/OUTCOME.md`) — see Conflict resolution below. Safe for concurrent editing by design, as long as both agents only ever append at the very end and sync often.
- **`01-PROJECT-STATUS.md` and `04-BLOCKERS.md`** — structured with a clearly separated section per agent specifically so you never edit the same lines the other agent edits. Only write inside your own section.

## Conflict resolution

Real content conflicts should be rare given the folder split, but here's how to handle the shapes that can happen:

**Append-only file conflict** (`08-CHANGELOG.md`, `02-DECISIONS.md`, `docs/OUTCOME.md`): both of you appended near the same time. Git shows this as a conflict at the tail of the file. Resolution is mechanical: keep both blocks, order them by timestamp (or, for `02-DECISIONS.md`, renumber whichever ADR landed second so numbers stay sequential), delete the conflict markers. Never drop either entry. This is the expected cost of frequent small syncs — it's cheap precisely because the divergence is always small.

**Structured shared-doc conflict** (`01-PROJECT-STATUS.md`, `04-BLOCKERS.md`): if this happens, it means someone edited outside their own section — that's the bug to fix going forward, not just this instance. Resolve by keeping each agent's own section as that agent's version, merge manually if a line is genuinely ambiguous, and mention it in your next `08-CHANGELOG.md` entry so the pattern gets noticed if it recurs.

**Real code conflict** (two agents edited the same source file): this should only happen if someone worked outside their owned folders (see `05-PHASE-OWNERSHIP.md`) without flagging it first, or during a Sync Point where both of you touch `src/cli/` wiring around the same time. If it happens, stop, don't force-resolve blindly — read both versions, understand what each was trying to do, and if it's not obvious, that's what `04-BLOCKERS.md` is for: flag it and coordinate live with the user rather than guessing.

## What NOT to do

- Don't `git push --force`. Ever, on this shared branch. If a rebase produces something that seems to require a force-push, stop and re-check — you likely resolved a rebase conflict wrong, not hit a case that genuinely needs it.
- Don't work for a long stretch without pulling. The whole point of this structure is that staleness is caught in minutes, not at the end of a multi-hour session.
- Don't edit a file inside the other agent's owned directories (per `05-PHASE-OWNERSHIP.md`) without flagging it in `08-CHANGELOG.md` first and getting a synced pull. If you found a bug in their code, write it up instead of silently fixing it in their territory — they need to know it happened.
