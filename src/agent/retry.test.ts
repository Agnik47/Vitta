import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from './retry';

test('withRetry succeeds on first attempt', async () => {
  let calls = 0;
  const res = await withRetry(async () => {
    calls++;
    return 'success';
  }, 'test-op');

  assert.equal(res, 'success');
  assert.equal(calls, 1);
});

test('withRetry retries on failure and succeeds eventually', async () => {
  let calls = 0;
  const res = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error('Transient error');
      return 'recovered';
    },
    'test-op',
    { maxRetries: 3, initialDelayMs: 10, backoffFactor: 1 }
  );

  assert.equal(res, 'recovered');
  assert.equal(calls, 3);
});

test('withRetry throws after exceeding maxRetries', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls++;
          throw new Error('Persistent failure');
        },
        'test-op',
        { maxRetries: 2, initialDelayMs: 10 }
      ),
    /Persistent failure/
  );

  assert.equal(calls, 2);
});
