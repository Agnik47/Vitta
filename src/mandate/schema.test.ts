import assert from 'node:assert/strict';
import test from 'node:test';
import { isMandate } from './schema';

const mandate = {
  mandate_id: 'mnd_test', issuer: 'did:key:test', subject: 'agent:test', sig: 'signature',
  scope: { categories: ['groceries'], merchants: ['blinkit'], cap_inr: 100, per_txn_inr: 100, max_txns: 1, expires_at: '2030-01-01T00:00:00.000Z' },
  reserve: { type: 'prava_mandate_sandbox', blocked_inr: 100, ref: 'mdt_test' },
};
test('accepts the Prava reserve type', () => assert.equal(isMandate(mandate), true));
test('rejects the retired Prava reserve type', () => assert.equal(isMandate({ ...mandate, reserve: { ...mandate.reserve, type: 'prava_sandbox' } }), false));
