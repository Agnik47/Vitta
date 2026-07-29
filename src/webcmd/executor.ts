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
}

let resolvedWebcmdCommand: { command: string; prefixArgs: string[] } | null = null;

function resolveWebcmdCommand(): { command: string; prefixArgs: string[] } {
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
// nothing to extract. Similarly, `--trace retain-on-failure` writes an artifact somewhere on
// failure, but its path isn't emitted either. Rather than depend on unexposed internals, `execute()`
// generates its own real, unique runId before invoking webcmd — this is arguably more robust anyway,
// since our own idempotency guard (`hasAlreadyDrawn`/`recordDraw` below) then depends on a value we
// control end to end, not one we'd have to trust a third-party CLI to expose consistently.
// `tracePath` is returned as `''` (not fabricated) until webcmd's actual trace-artifact location is
// found — `src/cli/gate.ts` already treats `trace_digest` as an open placeholder for the same reason.
export function execute(site: string, command: string, args: string[]): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const runId = crypto.randomUUID();
    const { command: cmd, prefixArgs } = resolveWebcmdCommand();
    const proc = spawn(cmd, [...prefixArgs, site, command, ...args, '--trace', 'retain-on-failure', '-f', 'json']);
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`webcmd exited ${code}`));
      const columns = JSON.parse(stdout);
      resolve({ runId, columns, tracePath: '' });
    });
  });
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
