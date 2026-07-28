import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInr } from './currency';

test('amounts under 1000 have no separator', () => {
  assert.equal(formatInr(800), '800');
});

test('amounts in the thousands get a single comma, matching docs/05-DEMO-SCRIPT.md exactly', () => {
  assert.equal(formatInr(1412), '1,412');
  assert.equal(formatInr(1500), '1,500');
});

test('lakhs use Indian digit grouping (2-digit groups after the first 3), not Western thousands grouping', () => {
  assert.equal(formatInr(100000), '1,00,000');
});
