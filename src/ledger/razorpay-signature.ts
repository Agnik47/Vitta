// Razorpay signature checks — pure functions over node:crypto, no I/O.
//
// Two different signatures, two different secrets (docs: razorpay.com/docs/payments/server-integration
// /nodejs/payment-gateway/build-integration and razorpay.com/docs/webhooks/validate-test):
//   • Checkout signature — what the browser hands back after a payment:
//       hex(HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET))
//   • Webhook signature — the X-Razorpay-Signature header:
//       hex(HMAC-SHA256(raw request body, WEBHOOK_SECRET))   (the dashboard's webhook secret, NOT the API secret)
//
// Both comparisons are constant-time. Neither result is ever what makes a reserve spendable — the
// ledger reads the real paid amount from Razorpay's API — so a forged or replayed request that
// passes (or fails) these checks cannot by itself move a balance. They exist to reject noise early
// and to keep unauthenticated callers away from the code that spawns the gate.
import { createHmac, timingSafeEqual } from 'node:crypto';

function hmacHex(message: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

function safeEqualHex(expected: string, given: string): boolean {
  // Length is checked first: timingSafeEqual throws on unequal lengths, and a wrong-length value is
  // simply not a match. Only hex digests are accepted, so no case-folding tricks.
  if (!/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given.toLowerCase(), 'hex'));
}

export function paymentSignature(orderId: string, paymentId: string, keySecret: string): string {
  return hmacHex(`${orderId}|${paymentId}`, keySecret);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  if (!orderId || !paymentId || !keySecret || typeof signature !== 'string') return false;
  return safeEqualHex(paymentSignature(orderId, paymentId, keySecret), signature);
}

/** `rawBody` must be the exact bytes/string Razorpay sent — never a parsed-and-reserialized copy. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string, webhookSecret: string): boolean {
  if (!webhookSecret || typeof signature !== 'string') return false;
  return safeEqualHex(hmacHex(rawBody, webhookSecret), signature);
}
