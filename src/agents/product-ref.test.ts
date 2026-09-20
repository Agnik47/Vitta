import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductRef } from './product-ref';
import { AgentFault } from './protocol';

test('blinkit takes a bare product id and refuses a URL-only candidate', () => {
  assert.equal(resolveProductRef({ merchant: 'blinkit', product_id: '171258' }), '171258');
  assert.throws(() => resolveProductRef({ merchant: 'blinkit', product_url: 'https://blinkit.com/prn/x/prid/1' }), AgentFault);
});

test('zepto takes the product URL and refuses a bare id', () => {
  const url = 'https://www.zeptonow.com/pn/atta/pvid/abc';
  assert.equal(resolveProductRef({ merchant: 'zepto', product_url: url }), url);
  assert.throws(() => resolveProductRef({ merchant: 'zepto', product_id: 'z1' }), AgentFault);
});

test('bigbasket prefers the numeric id out of /pd/<id>/ and falls back to a bare id', () => {
  assert.equal(resolveProductRef({ merchant: 'bigbasket', product_url: 'https://www.bigbasket.com/pd/150502/fresho-eggs/' }), '150502');
  assert.equal(resolveProductRef({ merchant: 'bigbasket', product_id: '150502' }), '150502');
});

test('a URL on another merchant’s domain — or a look-alike — is refused before it reaches the browser', () => {
  const bad = [
    'https://evil.example.com/pn/atta',
    'https://zeptonow.com.attacker.net/pn/atta',
    'https://evil-zeptonow.com/pn/atta',
    'http://www.zeptonow.com/pn/atta', // not https
    'https://www.bigbasket.com/pd/1/x/', // right host, wrong merchant
  ];
  for (const product_url of bad) {
    assert.throws(() => resolveProductRef({ merchant: 'zepto', product_url }), AgentFault, product_url);
  }
});

test('an id containing shell/argument metacharacters is refused', () => {
  for (const product_id of ['1; rm -rf /', '--quantity', '$(id)', 'a b', '']) {
    assert.throws(() => resolveProductRef({ merchant: 'blinkit', product_id }), AgentFault, JSON.stringify(product_id));
  }
});
