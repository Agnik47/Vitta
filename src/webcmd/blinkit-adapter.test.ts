// The shipped Blinkit adapter must accept every product id Blinkit really sells. The packaged validator
// demanded 3+ digits and refused Blinkit's own listing "Aashirvaad Select 100% MP Sharbati Atta" (prid/7):
// adding it failed every time. This runs the exact validator source that ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(path.join(dir, 'webcmd-adapters'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('repo root not found');
    dir = parent;
  }
  return dir;
}

class ArgumentError extends Error {}

function loadValidator(): (raw: unknown) => string {
  const source = readFileSync(path.join(repoRoot(), 'webcmd-adapters', 'blinkit', 'set-cart-quantity.js'), 'utf-8');
  const fn = /function requireProductId\(raw\) \{[\s\S]*?\n\}/.exec(source);
  assert.ok(fn, 'the adapter defines its own requireProductId');
  return new Function('ArgumentError', `${fn[0]}\nreturn requireProductId;`)(ArgumentError) as (raw: unknown) => string;
}

test('short ids are real: "7" (Blinkit\'s own listing) and other 1-2 digit ids are accepted', () => {
  const requireProductId = loadValidator();
  assert.equal(requireProductId('7'), '7');
  assert.equal(requireProductId('42'), '42');
  assert.equal(requireProductId(' 19512 '), '19512');
  assert.equal(requireProductId(108301), '108301');
});

test('the URL and path forms still work', () => {
  const requireProductId = loadValidator();
  assert.equal(requireProductId('https://blinkit.com/prn/x/prid/7'), '7');
  assert.equal(requireProductId('prid/333764'), '333764');
  assert.equal(requireProductId('https://blinkit.com/prn/whatever/prid/561270?utm=1'), '561270');
});

test('anything that is not a positive whole number is refused', () => {
  const requireProductId = loadValidator();
  for (const bad of ['', 'abc', '0', '-5', '1.5', 'prid/', '7; rm -rf', '7/../x', undefined, null]) {
    assert.throws(() => requireProductId(bad), ArgumentError, JSON.stringify(bad));
  }
});
