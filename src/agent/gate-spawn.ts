// Spawns the real `gate` and `search` CLIs — the ONLY way PurchaseAgent is allowed to touch a
// mandate, the ledger, or webcmd. Mirrors dashboard/lib/gate-cli.ts's own reasoning exactly (that
// file's header explains why: a single audited decision path, ADR-015), just for a Node CLI context
// instead of a Next.js route. PurchaseAgent never imports src/policy/decide.ts, src/webcmd/executor.ts,
// or DodoCreditLedger directly — every money-moving or browser-driving step goes through here.
import { execFile } from 'node:child_process';
import path from 'node:path';

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

import fs from 'node:fs';

/** Reads the project-root `.env` file (key=value lines, # comments, blank lines) and returns a
 *  plain object of those vars. No external dependency — mirrors the format `.env.example` documents.
 *  Called once per process (cached) and merged into the child-process environment so that
 *  DodoCreditLedger can reach the real Dodo test-mode API without requiring the calling shell to
 *  have sourced `.env` first. Errors are swallowed — if `.env` is missing the child process simply
 *  inherits whatever the parent already has, and DodoCreditLedger's own requireEnv() will surface
 *  the real missing-var error with a clear message. */
let _dotEnvCache: Record<string, string> | undefined;
function loadDotEnv(): Record<string, string> {
  if (_dotEnvCache) return _dotEnvCache;
  _dotEnvCache = {};
  try {
    const envPath = path.join(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      _dotEnvCache[key] = value;
    }
  } catch {
    // .env missing or unreadable — child inherits process.env as-is
  }
  return _dotEnvCache;
}

function entryPoint(cliName: 'gate' | 'search'): string {
  const distPath = path.join(process.cwd(), 'dist', 'cli', `${cliName}.js`);
  if (fs.existsSync(distPath)) return distPath;
  return path.join(__dirname, '..', 'cli', `${cliName}.js`);
}

function runCli(cliName: 'gate' | 'search', argv: string[], timeoutMs: number): Promise<CliResult> {
  // Merge .env vars into the child environment. process.env takes precedence (an explicit shell
  // export beats the file), then .env fills in what's missing — same semantics as `dotenv`.
  const dotEnvVars = loadDotEnv();
  const childEnv = { ...dotEnvVars, ...process.env };

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [entryPoint(cliName), ...argv],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: childEnv },
      (error, stdout, stderr) => {
        const timedOut = Boolean(error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed);
        const exitCode = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ ok: exitCode === 0 && !timedOut, stdout, stderr, exitCode, timedOut });
      },
    );
  });
}

/** Real write/gated commands — `gate run -- webcmd <site> <command> [...args]`, `gate fund`, etc.
 *  Real browser round-trips measured 20-90s in this build; default budget reflects that. */
export function runGate(argv: string[], timeoutMs = 240_000): Promise<CliResult> {
  return runCli('gate', argv, timeoutMs);
}

/** Real read-only commands via search.js — the narrow entry point that's hard-restricted to
 *  manifest access:'read' commands (src/cli/search.ts), so it can never reach a write/spend path. */
export function runSearch(argv: string[], timeoutMs = 90_000): Promise<CliResult> {
  return runCli('search', argv, timeoutMs);
}
