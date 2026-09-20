// FundingReceipt: the signed record of money going INTO a reserve. Same tamper-evidence bar as the
// spend Receipt and TransactionAuthorization it sits beside.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair } from '../mandate/sign';
import { buildAndSignFundingReceipt, fundingReceiptId, verifyFundingReceipt } from './funding';

const gateKeys = generateKeyPair();

const fields = {
  mandate_id: 'mnd_abc',
  mandate_hash: 'sha256:deadbeef',
  reserve_ref: 'razorpay-order:order_TeBDQoGhUB4ZSy',
  order_id: 'order_TeBDQoGhUB4ZSy',
  payments: [{ id: 'pay_TeBLFCvkUw6Kyo', amount_inr: 500, method: 'card', paid_at: '2026-09-20T06:58:00.000Z' }],
  amount_inr: 500,
};

test('an unmodified funding receipt verifies, and is always TEST / INR', () => {
  const receipt = buildAndSignFundingReceipt(fields, gateKeys.privateKey);
  assert.equal(verifyFundingReceipt(receipt, gateKeys.publicKey), true);
  assert.equal(receipt.mode, 'TEST');
  assert.equal(receipt.currency, 'INR');
});

test('the id derives from the order, so one paid order can only ever have one receipt', () => {
  assert.equal(fundingReceiptId('order_TeBDQoGhUB4ZSy'), 'fnd_TeBDQoGhUB4ZSy');
  const a = buildAndSignFundingReceipt(fields, gateKeys.privateKey);
  const b = buildAndSignFundingReceipt(fields, gateKeys.privateKey);
  assert.equal(a.funding_receipt_id, b.funding_receipt_id);
});

test('changing any signed field breaks verification', () => {
  const receipt = buildAndSignFundingReceipt(fields, gateKeys.privateKey);
  assert.equal(verifyFundingReceipt({ ...receipt, amount_inr: 5000 }, gateKeys.publicKey), false);
  assert.equal(verifyFundingReceipt({ ...receipt, mandate_id: 'mnd_other' }, gateKeys.publicKey), false);
  assert.equal(verifyFundingReceipt({ ...receipt, payments: [{ ...receipt.payments[0], amount_inr: 5000 }] }, gateKeys.publicKey), false);
});

test('a receipt signed by a different key does not verify', () => {
  const receipt = buildAndSignFundingReceipt(fields, generateKeyPair().privateKey);
  assert.equal(verifyFundingReceipt(receipt, gateKeys.publicKey), false);
});
