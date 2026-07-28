// Spawns webcmd for ALLOW decisions, binds runId — Phase 1d, see docs/03-WEBCMD-INTEGRATION.md
//
// execute() itself is UNVERIFIED against a real live command as of 2026-07-29 — the browser
// connectivity bridge is failing on this machine (`webcmd doctor` reports a Connectivity FAIL,
// no Cloak runtime profile could be created). See docs/common/04-BLOCKERS.md B-002. The code below
// matches docs/03-WEBCMD-INTEGRATION.md § Step 5 exactly; hasAlreadyDrawn()/recordDraw() ARE
// verified for real (pure fs logic, no webcmd/browser dependency) — see manual-check script.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface ExecuteResult {
  runId: string;
  columns: unknown;
  tracePath: string;
}

export function execute(site: string, command: string, args: string[]): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('webcmd', [site, command, ...args, '--trace', 'retain-on-failure', '-f', 'json']);
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`webcmd exited ${code}`));
      const result = JSON.parse(stdout);
      resolve({ runId: result.runId, columns: result.columns, tracePath: result.tracePath });
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
