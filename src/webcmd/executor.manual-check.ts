// Manual verification for the ledger.jsonl idempotency guard (hasAlreadyDrawn/recordDraw).
// Pure fs logic, no webcmd/browser dependency — genuinely testable despite the browser bridge
// being down. execute() itself is NOT exercised here; see docs/OUTCOME.md Phase 1d for why.
// Run: npx ts-node src/webcmd/executor.manual-check.ts
import { hasAlreadyDrawn, recordDraw } from './executor';
import { unlinkSync, existsSync } from 'node:fs';

const testLedgerPath = './ledger.manual-check.jsonl';
if (existsSync(testLedgerPath)) unlinkSync(testLedgerPath);

console.log('Before any record — unseen runId:', hasAlreadyDrawn('run_abc123', testLedgerPath));

recordDraw({ runId: 'run_abc123', reserveRef: 'cs_test_xyz', amountInrPaise: 10000, ts: new Date().toISOString() }, testLedgerPath);

console.log('After recording — same runId:', hasAlreadyDrawn('run_abc123', testLedgerPath));
console.log('After recording — different runId:', hasAlreadyDrawn('run_different', testLedgerPath));

unlinkSync(testLedgerPath);
console.log('Cleaned up test ledger file.');
