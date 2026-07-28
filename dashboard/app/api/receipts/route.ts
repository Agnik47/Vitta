// GET-only. Lists receipts, walks the hash chain, returns verify status per receipt.
// See docs/06-DASHBOARD-SPEC.md § /receipts.
import { readReceipts, verifyChainLocal, loadGatePublicKeyPem } from '@/lib/read';

export async function GET() {
  const receipts = readReceipts();
  const verifications = verifyChainLocal(receipts, loadGatePublicKeyPem());
  const byId = new Map(verifications.map((v) => [v.receipt_id, v]));

  const merged = receipts
    .map((r) => ({ receipt: r, verification: byId.get(r.receipt_id) ?? null }))
    .sort((a, b) => b.receipt.signed_at.localeCompare(a.receipt.signed_at)); // most recent first

  return Response.json(merged);
}
