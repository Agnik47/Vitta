import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileIdempotencyStore, memoryIdempotencyStore } from './idempotency';
import { agentOk } from './protocol';

const done = agentOk('vitta-purchase-agent', { status: 'PURCHASED' }, []);

for (const [name, make] of [
  ['memory', () => memoryIdempotencyStore()],
  ['file', () => fileIdempotencyStore(path.join(mkdtempSync(path.join(os.tmpdir(), 'vitta-idem-')), 'p'))],
] as const) {
  test(`${name}: first claim wins; a second is "in progress" until completed`, () => {
    const store = make();
    assert.equal(store.claim('req_1').state, 'claimed');
    assert.equal(store.claim('req_1').state, 'in_progress');
  });

  test(`${name}: once completed, a replay returns the recorded result`, () => {
    const store = make();
    store.claim('req_2');
    store.complete('req_2', done);
    const again = store.claim('req_2');
    assert.equal(again.state, 'done');
    if (again.state === 'done') assert.deepEqual(again.result, done);
  });

  test(`${name}: different requests are independent`, () => {
    const store = make();
    assert.equal(store.claim('req_a').state, 'claimed');
    assert.equal(store.claim('req_b').state, 'claimed');
  });
}

test('file store: unsafe request ids (path traversal) are refused', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vitta-idem-'));
  try {
    const store = fileIdempotencyStore(dir);
    for (const id of ['../escape', 'a/b', '', 'x'.repeat(200), 'a b']) {
      assert.throws(() => store.claim(id), /unsafe request id/, id);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('file store: an interrupted claim survives a new store instance (fail closed, no silent retry)', () => {
  const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'vitta-idem-')), 'p');
  fileIdempotencyStore(dir).claim('req_x');
  assert.equal(fileIdempotencyStore(dir).claim('req_x').state, 'in_progress');
});
