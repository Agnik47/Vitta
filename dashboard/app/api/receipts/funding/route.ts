// GET-only. Lists the signed funding receipts — one per Razorpay test order that has funded a
// mandate — newest first, each with its own signature check. Never writes anything.
import { readFundingReceipts, verifyFundingReceiptSignature, loadGatePublicKeyPem } from '@/lib/read';

export async function GET() {
  const pem = loadGatePublicKeyPem();
  const entries = readFundingReceipts()
    .map((receipt) => ({ receipt, signature_valid: verifyFundingReceiptSignature(receipt, pem) }))
    .sort((a, b) => b.receipt.issued_at.localeCompare(a.receipt.issued_at));
  return Response.json(entries);
}
