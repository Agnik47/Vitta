// The reason webcmd gives for a failure has to reach the person. Found live: the gate could only say
// "webcmd exited 2", so a failed add-to-cart showed an ALLOW line and nothing about why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWebcmdFailure } from './executor';

test('a webcmd JSON error becomes "message (CODE)"', () => {
  const stdout = JSON.stringify({ ok: false, error: { code: 'ARGUMENT', message: 'productId must be a Blinkit product id, for example 19512', exitCode: 2 } });
  assert.equal(describeWebcmdFailure(stdout, ''), 'productId must be a Blinkit product id, for example 19512 (ARGUMENT)');
});

test('the code is optional', () => {
  assert.equal(describeWebcmdFailure(JSON.stringify({ error: { message: 'boom' } }), ''), 'boom');
});

test('the JSON document is understood on stderr too (exit 66 puts it there), with the help text cut to its first sentence', () => {
  // the shape webcmd really produced for a product that does not exist
  const stderr = JSON.stringify({ ok: false, error: { code: 'EMPTY_RESULT', message: 'blinkit set-cart-quantity returned no data', help: 'No cart payload for product 88888888 Treat this as adapter breakage. Run `webcmd adapter path blinkit/set-cart-quantity`, patch only that file.', exitCode: 66 } });
  assert.equal(describeWebcmdFailure('', stderr), 'blinkit set-cart-quantity returned no data — No cart payload for product 88888888 (EMPTY_RESULT)');
  const noisy = JSON.stringify({ error: { code: 'X', message: 'no data', help: 'Treat this as adapter breakage. '.repeat(30) } });
  assert.equal(describeWebcmdFailure(noisy, ''), 'no data (X)', 'repair advice alone is not part of the reason');
});

test('plain-text failures fall back to stderr, flattened to one line', () => {
  assert.equal(describeWebcmdFailure('', 'fake webcmd: unknown product "x" on blinkit\n  at somewhere'), 'fake webcmd: unknown product "x" on blinkit at somewhere');
});

test('stdout that is not a webcmd error document is used only when stderr is empty', () => {
  assert.equal(describeWebcmdFailure('some output', 'the real error'), 'the real error');
  assert.equal(describeWebcmdFailure('some output', ''), 'some output');
  assert.equal(describeWebcmdFailure('', ''), '');
});

test('a reason is capped, so a runaway message never floods a toast or the log', () => {
  assert.ok(describeWebcmdFailure('', 'x'.repeat(5000)).length <= 300);
});
