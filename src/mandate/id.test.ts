import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from './id';

test('includes the given prefix', () => {
  assert.match(generateId('mnd'), /^mnd_/);
});

test('two calls produce different ids', () => {
  assert.notEqual(generateId('rcp'), generateId('rcp'));
});
