// recordActivity is best-effort by design: it must never break the action it describes.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordActivity } from './activity-log';
import { isActivityEvent } from '../events/ActivityEvent';

let dir: string;
let previous: string;
beforeEach(() => {
  previous = process.cwd();
  dir = mkdtempSync(path.join(os.tmpdir(), 'vitta-activity-'));
  process.chdir(dir);
});
afterEach(() => {
  process.chdir(previous);
  rmSync(dir, { recursive: true, force: true });
});

const lines = (): unknown[] => readFileSync(path.join(dir, 'events.jsonl'), 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('an entry gets an id and a timestamp, and is recognised as activity', () => {
  recordActivity({ action: 'mandate.create', outcome: 'SUCCESS', summary: 'x', mandate_id: 'mnd_1' });
  const [e] = lines();
  assert.ok(isActivityEvent(e));
  assert.match(e.event_id, /^evt_/);
  assert.ok(!Number.isNaN(new Date(e.ts).getTime()));
});

test('an error is flattened to one line and capped, so a stack trace never floods the log', () => {
  recordActivity({ action: 'gate.run', outcome: 'FAILURE', summary: 'x', error: `line one\n  at somewhere\n${'y'.repeat(2000)}` });
  const [e] = lines();
  assert.ok(isActivityEvent(e));
  assert.ok(e.error && e.error.length <= 400 && !e.error.includes('\n'));
});

test('recording never throws, even when the log cannot be written', () => {
  process.chdir(previous);
  rmSync(dir, { recursive: true, force: true }); // the cwd is gone: appending to ./events.jsonl fails
  assert.doesNotThrow(() => recordActivity({ action: 'mandate.create', outcome: 'SUCCESS', summary: 'x' }));
  dir = mkdtempSync(path.join(os.tmpdir(), 'vitta-activity-'));
  process.chdir(dir);
});
