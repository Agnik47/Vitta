import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveJobState, type AgentLine } from './purchase-job-state';

test('deriveJobState transitions through lifecycle states', () => {
  assert.equal(deriveJobState([]), 'PENDING');

  const addEvent: AgentLine[] = [{ type: 'step', step: 'add-to-cart', status: 'running', detail: 'Adding' }];
  assert.equal(deriveJobState(addEvent), 'ADDING_TO_CART');

  const verifyEvent: AgentLine[] = [{ type: 'step', step: 'verify-cart', status: 'running', detail: 'Verifying' }];
  assert.equal(deriveJobState(verifyEvent), 'VERIFYING_CART');

  const gateEvent: AgentLine[] = [{ type: 'step', step: 'order-value-check', status: 'running', detail: 'Checking gate' }];
  assert.equal(deriveJobState(gateEvent), 'WAITING_GATE');

  // 'commit' running/failed is now only ever the genuine-DENY path (no more 'commit'/'done' — a
  // real ALLOW produces an 'authorize' step instead).
  const commitRunningEvent: AgentLine[] = [{ type: 'step', step: 'commit', status: 'running', detail: 'Deciding' }];
  assert.equal(deriveJobState(commitRunningEvent), 'WAITING_GATE');

  const commitFailedEvent: AgentLine[] = [{ type: 'step', step: 'commit', status: 'failed', detail: 'Denied' }];
  assert.equal(deriveJobState(commitFailedEvent), 'FAILED');

  const authorizeEvent: AgentLine[] = [{ type: 'step', step: 'authorize', status: 'done', detail: 'Authorized' }];
  assert.equal(deriveJobState(authorizeEvent), 'TRANSACTION_AUTHORIZED');

  const waitingConfirmEvent: AgentLine[] = [
    { type: 'step', step: 'merchant-confirm', status: 'failed', detail: 'Not confirmed yet' },
  ];
  assert.equal(deriveJobState(waitingConfirmEvent), 'WAITING_FOR_MERCHANT_CONFIRMATION');

  const confirmedEvent: AgentLine[] = [{ type: 'step', step: 'merchant-confirm', status: 'done', detail: 'Confirmed' }];
  assert.equal(deriveJobState(confirmedEvent), 'MERCHANT_CONFIRMED');

  const drawEvent: AgentLine[] = [{ type: 'step', step: 'draw', status: 'done', detail: 'Drawn' }];
  assert.equal(deriveJobState(drawEvent), 'DRAW_COMPLETED');

  const successResult: AgentLine[] = [{ type: 'result', ok: true, receiptId: 'rcpt_123' }];
  assert.equal(deriveJobState(successResult), 'RECEIPT_READY');

  const awaitingResult: AgentLine[] = [{ type: 'result', ok: false, awaitingMerchantConfirmation: true }];
  assert.equal(deriveJobState(awaitingResult), 'WAITING_FOR_MERCHANT_CONFIRMATION');

  const handoffResult: AgentLine[] = [{ type: 'result', ok: true }]; // proof:'none' merchant, no receiptId
  assert.equal(deriveJobState(handoffResult), 'MERCHANT_CONFIRMED');

  const failResult: AgentLine[] = [{ type: 'result', ok: false, failureReason: 'Denied' }];
  assert.equal(deriveJobState(failResult), 'FAILED');
});
