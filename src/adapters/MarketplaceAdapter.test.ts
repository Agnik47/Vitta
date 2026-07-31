import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BlinkitAdapter,
  ZeptoAdapter,
  BigBasketAdapter,
  MarketplaceAdapterRegistry,
} from './MarketplaceAdapter';

test('MarketplaceAdapterRegistry registers all 3 supported merchants', () => {
  const registry = MarketplaceAdapterRegistry.getInstance();
  const blinkit = registry.get('blinkit');
  const zepto = registry.get('zepto');
  const bigbasket = registry.get('bigbasket');

  assert.equal(blinkit.name, 'blinkit');
  assert.equal(zepto.name, 'zepto');
  assert.equal(bigbasket.name, 'bigbasket');
});

test('MarketplaceAdapter instances report correct minimum cart values', () => {
  const blinkit = new BlinkitAdapter();
  const zepto = new ZeptoAdapter();
  const bigbasket = new BigBasketAdapter();

  assert.equal(blinkit.minCartInr, 150);
  assert.equal(zepto.minCartInr, 100);
  assert.equal(bigbasket.minCartInr, 200);
});

test('MarketplaceAdapter throws error for unknown merchant', () => {
  const registry = MarketplaceAdapterRegistry.getInstance();
  assert.throws(() => registry.get('unknown' as any), /No marketplace adapter registered/);
});
