// `shop run` flag parsing: --review is what turns a run into a human-in-the-loop hand-off, so it must
// never lose the request text or be mistaken for a value-taking flag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './shop';

test('--review is a boolean: it does not swallow the request that follows it', () => {
  const { positionals, flags } = parseArgs(['--review', 'find cheapest biscuit', '--mode', 'test']);
  assert.equal(flags.review, true);
  assert.deepEqual(positionals, ['find cheapest biscuit']);
  assert.equal(flags.mode, 'test');
});

test('--review works anywhere, including before the dashboard\'s `--` request separator', () => {
  const { positionals, flags } = parseArgs(['--mode', 'test', '--run-id', 'req_1', '--review', '--', 'find cheapest --review biscuit']);
  assert.equal(flags.review, true);
  assert.deepEqual(positionals, ['find cheapest --review biscuit'], 'text after -- is the request, verbatim, never a flag');
});

test('without --review the flag is absent (autonomous is the unchanged default)', () => {
  assert.equal(parseArgs(['--mode', 'test', 'buy atta']).flags.review, undefined);
});

test('value flags still take their value', () => {
  assert.equal(parseArgs(['--mandate', 'mnd_1', 'x']).flags.mandate, 'mnd_1');
});
