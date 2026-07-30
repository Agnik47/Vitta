// Spawns webcmd for ALLOW decisions, binds runId — Phase 1d, see docs/03-WEBCMD-INTEGRATION.md
//
// execute() is now real-tested against a live browser command — B-002 (the Chromium binary
// webcmd's Cloak runtime needs was never downloaded on this machine) is resolved, see
// docs/common/04-BLOCKERS.md Resolved table and docs/OUTCOME.md Phase 1d addendum.
//
// Real security bug found and fixed while first verifying this against a live command.
// `spawn('webcmd', args)` throws `ENOENT` on Windows: globally-installed npm binaries are `.cmd`
// batch-file wrappers there, and `spawn()` (unlike `exec`/`execSync`) never goes through a shell,
// so it can't resolve or run one. The tempting fix, `{ shell: true }`, trades that error for a
// real command-injection hole instead (Node's own DEP0190 warning: with `shell: true`, the args
// array is shell-concatenated, not escaped — since `args` here ultimately traces back to
// agent-directed input, that's not acceptable in a project whose entire point is gating an agent's
// actions). Node also actively refuses `spawn('webcmd.cmd', args, { shell: false })` with `EINVAL`
// — this is deliberate, a fix for a real batch-file argument-injection CVE class, not a bug to work
// around. The actually-safe fix: resolve webcmd's real underlying entry point (a plain `.js` file,
// not a shell-interpreted wrapper) and run it through `node` directly — an executable, not a shell,
// so there is no injection surface regardless of what any argument contains. This matches
// `docs/03-WEBCMD-INTEGRATION.md`'s original code sketch, which had the same latent Windows bug,
// invisible until a real live command could finally be attempted (B-002).
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export interface ExecuteResult {
  runId: string;
  columns: unknown;
  tracePath: string;
  traceDigest: string;
}

let resolvedWebcmdCommand: { command: string; prefixArgs: string[] } | null = null;

// Exported so other real, read-only entry points (e.g. src/cli/search.ts) can reuse this exact
// safe-spawn resolution instead of re-deriving the same Windows ENOENT/shell-injection fix.
export function resolveWebcmdCommand(): { command: string; prefixArgs: string[] } {
  if (resolvedWebcmdCommand) return resolvedWebcmdCommand;
  if (process.platform !== 'win32') {
    // POSIX global installs are real executables (shebang scripts) — spawn() can run them directly,
    // safely, with no shell.
    resolvedWebcmdCommand = { command: 'webcmd', prefixArgs: [] };
    return resolvedWebcmdCommand;
  }
  // shell: true is safe here specifically because both the command and its arguments are fixed,
  // hardcoded constants — nothing here is influenced by site/command/args (or anything else
  // agent-controlled), so there's no untrusted content for a shell to misinterpret.
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf-8', shell: true }).trim();
  const entry = path.join(globalRoot, '@agentrhq', 'webcmd', 'dist', 'src', 'main.js');
  if (!existsSync(entry)) {
    throw new Error(`Resolved webcmd entry point does not exist: ${entry}. Is @agentrhq/webcmd installed globally?`);
  }
  resolvedWebcmdCommand = { command: process.execPath, prefixArgs: [entry] };
  return resolvedWebcmdCommand;
}

// Real output shape found while first testing this against a live command (both a read command,
// duckduckgo/search, and a write-classified one, github/login): `webcmd <site> <command> -f json`
// prints a bare JSON array of result rows matching that command's own `columns` schema — there is
// no `{runId, columns, tracePath}` wrapper object at all, contradicting
// docs/03-WEBCMD-INTEGRATION.md's sketch. Grepping the installed package's own source
// (`dist/src/execution.js`, `cli.js`) turned up an internal `runId` used for the daemon's own
// session-lease/idempotency bookkeeping, but it is never surfaced to the CLI's stdout — there is
// nothing to extract. Rather than depend on unexposed internals, `execute()` generates its own
// real, unique runId before invoking webcmd — this is arguably more robust anyway, since our own
// idempotency guard (`hasAlreadyDrawn`/`recordDraw` below) then depends on a value we control end
// to end, not one we'd have to trust a third-party CLI to expose consistently.
//
// tracePath/traceDigest — resolved for real, docs/common/02-DECISIONS.md ADR-009. Uses `--trace on`
// (not `retain-on-failure`): webcmd's own source (dist/src/execution.js) only calls
// exportObservationSession() on failure when the mode is `retain-on-failure` — a successful command
// (the only kind that ever reaches Receipt-building in gate.ts) never gets a trace artifact under
// that mode, confirmed empirically (a real successful run produced no `~/.webcmd/profiles/` dir at
// all). With `--trace on`, webcmd prints `Webcmd trace artifact: <dir>` to **stderr** on success —
// confirmed by direct testing, not guessed. That directory contains `trace.jsonl` (the full redacted
// event timeline, per dist/src/observation/artifact.js) — its sha256 is what's returned as
// `traceDigest`, matching docs/05-DEMO-SCRIPT.md's "the trace digest from webcmd's real --trace
// artifact (sha256 of the file)". If webcmd's stderr format ever changes and the trace line can't be
// found, this degrades to empty strings rather than throwing — evidence/audit data, not something
// that should ever block a decision that already resolved to ALLOW.
const TRACE_ARTIFACT_LINE = /Webcmd trace artifact:\s*(.+)/;

export function execute(site: string, command: string, args: string[]): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const runId = crypto.randomUUID();
    const { command: cmd, prefixArgs } = resolveWebcmdCommand();
    const proc = spawn(cmd, [...prefixArgs, site, command, ...args, '--trace', 'on', '-f', 'json']);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`webcmd exited ${code}`));
      const columns = JSON.parse(stdout);
      const { tracePath, traceDigest } = resolveTraceArtifact(stderr);
      resolve({ runId, columns, tracePath, traceDigest });
    });
  });
}

function resolveTraceArtifact(stderr: string): { tracePath: string; traceDigest: string } {
  const match = stderr.match(TRACE_ARTIFACT_LINE);
  if (!match) return { tracePath: '', traceDigest: '' };
  const tracePath = match[1].trim();
  try {
    const traceFile = readFileSync(path.join(tracePath, 'trace.jsonl'));
    const traceDigest = `sha256:${crypto.createHash('sha256').update(traceFile).digest('hex')}`;
    return { tracePath, traceDigest };
  } catch {
    return { tracePath, traceDigest: '' };
  }
}

export interface LedgerEntry {
  runId: string;
  reserveRef: string;
  amountInrPaise: number;
  ts: string;
}

// Belt-and-suspenders idempotency guard for Ledger.draw() (docs/02-DODO-INTEGRATION.md's open
// question on request-side idempotency_key support). The caller (Phase 1f's CLI wiring) must call
// this BEFORE Ledger.draw() — see docs/common/02-DECISIONS.md ADR-004 for the ledger.jsonl entry
// shape and why this check lives here instead of inside DodoCreditLedger.
export function hasAlreadyDrawn(runId: string, ledgerPath = './ledger.jsonl'): boolean {
  if (!existsSync(ledgerPath)) return false;
  const lines = readFileSync(ledgerPath, 'utf-8').split('\n').filter(Boolean);
  return lines.some((line) => {
    try {
      return (JSON.parse(line) as LedgerEntry).runId === runId;
    } catch {
      return false; // malformed/partial line (e.g. concurrent write) — ignore, don't crash
    }
  });
}

export function recordDraw(entry: LedgerEntry, ledgerPath = './ledger.jsonl'): void {
  appendFileSync(ledgerPath, JSON.stringify(entry) + '\n');
}
