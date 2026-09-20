// FundingReceipt — signed proof that a Razorpay TEST payment funded a mandate's reserve.
//
// A spend Receipt (receipt/schema.ts) attests to money that LEFT the reserve and is hash-chained in
// the order those spends happened. This is the other half of the story: the money that went IN.
// It is deliberately a separate artifact, not a link in the spend chain — the chain means "every
// allowed spend, in order", and a top-up is not a spend (the same reasoning authorization.ts gives
// for keeping TransactionAuthorization out of it). It is signed with the gate's key like both of
// them, so it is just as tamper-evident.
//
// Written by `gate fund --reserve-ref`, only after the gate has read the REAL captured payments from
// Razorpay. Everything in `payments` is what Razorpay reported, never what a browser claimed. One
// receipt exists per order: its id derives from the order id, so re-attaching the same paid order
// never mints a second receipt for the same money.
import type { KeyObject } from 'node:crypto';
import { sign, verify } from '../mandate/sign';

export interface FundingPayment {
  /** Razorpay's payment id, e.g. pay_… */
  id: string;
  amount_inr: number;
  /** card, upi, netbanking … as Razorpay reports it. No card number or other instrument data. */
  method: string;
  /** When Razorpay recorded the payment (ISO 8601). */
  paid_at: string;
}

export interface FundingReceipt {
  /** fnd_<order id without the order_ prefix> — one per order. */
  funding_receipt_id: string;
  mandate_id: string;
  /** sha256 of the mandate as re-signed with this reserve — the same construction Receipt uses. */
  mandate_hash: string;
  reserve_ref: string;
  order_id: string;
  /** The captured payments that make up the reserve, from Razorpay. */
  payments: FundingPayment[];
  /** What Razorpay reports as captured for this order, in INR. */
  amount_inr: number;
  currency: 'INR';
  /** Always TEST: this build only ever talks to Razorpay test mode. */
  mode: 'TEST';
  issued_at: string; // ISO 8601
  sig: string; // Ed25519, gate key
}

export function fundingReceiptId(orderId: string): string {
  return `fnd_${orderId.replace(/^order_/, '')}`;
}

export function buildAndSignFundingReceipt(
  fields: Omit<FundingReceipt, 'sig' | 'issued_at' | 'funding_receipt_id' | 'currency' | 'mode'>,
  gatePrivateKey: KeyObject,
): FundingReceipt {
  const unsigned = {
    funding_receipt_id: fundingReceiptId(fields.order_id),
    ...fields,
    currency: 'INR' as const,
    mode: 'TEST' as const,
    issued_at: new Date().toISOString(),
  };
  return { ...unsigned, sig: sign(unsigned, gatePrivateKey) };
}

export function verifyFundingReceipt(receipt: FundingReceipt, gatePublicKey: KeyObject): boolean {
  const { sig, ...rest } = receipt;
  return verify(rest, sig, gatePublicKey);
}
