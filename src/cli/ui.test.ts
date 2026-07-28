import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGateEventLine, formatAgentLine, formatStatusStrip, renderTwoPane } from './ui';
import type { GateEvent } from '../events/GateEvent';

function baseEvent(overrides: Partial<GateEvent> = {}): GateEvent {
  return {
    event_id: 'evt_1',
    ts: '2026-07-29T12:00:00.000Z',
    mandate_id: 'mnd_1',
    mandate_hash: 'sha256:abc',
    command: 'blinkit/place-order',
    access: 'write',
    verdict: 'ALLOW',
    ...overrides,
  };
}

test('ALLOW events render in green', () => {
  const line = formatGateEventLine(baseEvent({ verdict: 'ALLOW' }));
  assert.match(line, /\x1b\[32m/);
  assert.match(line, /ALLOW/);
});

test('DENY events render in red and include the deny code', () => {
  const line = formatGateEventLine(baseEvent({ verdict: 'DENY', code: 'OVER_TOTAL_CAP', amount_inr: 1412 }));
  assert.match(line, /\x1b\[31m/);
  assert.match(line, /DENY/);
  assert.match(line, /OVER_TOTAL_CAP/);
  assert.match(line, /₹1,412/);
});

test('STEP_UP events render in yellow', () => {
  const line = formatGateEventLine(baseEvent({ verdict: 'STEP_UP' }));
  assert.match(line, /\x1b\[33m/);
});

test('formatAgentLine is plain, no color codes', () => {
  const line = formatAgentLine('blinkit search "atta"');
  assert.doesNotMatch(line, /\x1b\[/);
  assert.match(line, /blinkit search "atta"/);
});

test('formatStatusStrip shows "unfunded" before a reserve exists', () => {
  assert.match(formatStatusStrip(null, 'test mode'), /unfunded/);
});

test('formatStatusStrip shows the real reserve amount once funded', () => {
  assert.match(formatStatusStrip(800, 'test mode'), /₹800/);
});

test('renderTwoPane produces a header, one row per event, and the status strip', () => {
  const output = renderTwoPane(
    ['› blinkit search "atta"', '› blinkit add-to-cart --sku atta-5kg'],
    [formatGateEventLine(baseEvent({ verdict: 'ALLOW', access: 'read' })), formatGateEventLine(baseEvent({ verdict: 'ALLOW' }))],
    formatStatusStrip(800, 'test mode'),
  );
  assert.match(output, /AGENT/);
  assert.match(output, /GATE/);
  assert.match(output, /blinkit search "atta"/);
  assert.match(output, /RESERVE/);
});
