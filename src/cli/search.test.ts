// The search CLI's error text ends up in a card or a banner. webcmd reports failures as a JSON
// document; shown raw that is a wall of braces (it was, in the Agent activity error banner).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readableWebcmdError } from './search';

test('a webcmd JSON error becomes "message (CODE)"', () => {
  const raw = JSON.stringify({ ok: false, error: { code: 'COMMAND_EXEC', message: 'blinkit search navigation failed: Session is busy', exitCode: 1 } });
  assert.equal(readableWebcmdError(raw), 'blinkit search navigation failed: Session is busy (COMMAND_EXEC)');
});

test('the code is optional', () => {
  assert.equal(readableWebcmdError(JSON.stringify({ ok: false, error: { message: 'boom' } })), 'boom');
});

test('the long help text is dropped — message and code are all a person needs', () => {
  const raw = JSON.stringify({ ok: false, error: { code: 'EMPTY_RESULT', message: 'zepto search returned no data', help: 'Treat this as adapter breakage. '.repeat(20) } });
  assert.equal(readableWebcmdError(raw), 'zepto search returned no data (EMPTY_RESULT)');
});

test('anything that is not a webcmd error document passes through unchanged', () => {
  assert.equal(readableWebcmdError('plain stderr text'), 'plain stderr text');
  assert.equal(readableWebcmdError('{"unrelated":true}'), '{"unrelated":true}');
  assert.equal(readableWebcmdError(''), '');
});
