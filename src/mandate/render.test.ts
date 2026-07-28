// Regression coverage for the two real bugs found while smoke-testing renderConsent() during
// Phase 1a — see docs/OUTCOME.md Phase 1a and the note at the top of render.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderConsent } from './render';
import type { Mandate } from './schema';

function baseMandate(overrides: Partial<Mandate['scope']> = {}): Mandate {
  return {
    mandate_id: 'mnd_test',
    issuer: 'did:key:z6Mktest',
    subject: 'agent:grocery-runner',
    scope: {
      categories: ['groceries'],
      merchants: ['blinkit', 'zepto', 'bigbasket'],
      cap_inr: 800,
      per_txn_inr: 800,
      max_txns: 1,
      expires_at: '2026-07-28T18:00:00.000Z',
      ...overrides,
    },
    reserve: { type: 'dodo_credit_test', blocked_inr: 800, ref: 'cks_test' },
    sig: 'placeholder',
  };
}

test('renders a Beat-2-shaped sentence with a grammatical "a, b or c" merchant list', () => {
  const sentence = renderConsent(baseMandate());
  assert.match(sentence, /Blinkit, Zepto or BigBasket/);
});

test('bigbasket renders as BigBasket, not Bigbasket — brand name, not a generic capitalize()', () => {
  const sentence = renderConsent(baseMandate({ merchants: ['bigbasket'] }));
  assert.match(sentence, /BigBasket/);
  assert.doesNotMatch(sentence, /Bigbasket\b/);
});

test('a two-merchant mandate joins with "or" and no comma', () => {
  const sentence = renderConsent(baseMandate({ merchants: ['blinkit', 'zepto'] }));
  assert.match(sentence, /Blinkit or Zepto/);
});

test('an unlisted merchant falls back to a plain capitalized name', () => {
  const sentence = renderConsent(baseMandate({ merchants: ['someneworchid'] }));
  assert.match(sentence, /Someneworchid/);
});

test('formats a 6pm expiry as "6:00 PM" — no leading zero, uppercase — not "06:00 pm"', () => {
  // Constructed in local time (matching how src/cli/gate.ts's parseExpiryTime() builds
  // expires_at), so this is self-consistent regardless of which timezone the test runs in.
  const localSixPm = new Date();
  localSixPm.setHours(18, 0, 0, 0);
  const sentence = renderConsent(baseMandate({ expires_at: localSixPm.toISOString() }));
  assert.match(sentence, /before 6:00 PM today/);
  assert.doesNotMatch(sentence, /06:00 pm/);
});

test('formats a morning expiry without a leading zero either (e.g. "9:05 AM", not "09:05 am")', () => {
  const localMorning = new Date();
  localMorning.setHours(9, 5, 0, 0);
  const sentence = renderConsent(baseMandate({ expires_at: localMorning.toISOString() }));
  assert.match(sentence, /before 9:05 AM today/);
});
