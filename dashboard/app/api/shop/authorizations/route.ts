// GET-only. Lists TransactionAuthorization records with real signature verification — the "✓
// Transaction Authorized" half of the two-stage tracking model. See lib/read.ts's
// readAuthorizations()/verifyAuthorizationSignature() and src/receipt/authorization.ts for the
// full reasoning. Never chain-linked (unlike receipts), so there's no chain_link_valid field here.
import { readAuthorizations, verifyAuthorizationSignature, loadGatePublicKeyPem } from '@/lib/read';

export async function GET() {
  const authorizations = readAuthorizations();
  const gatePublicKeyPem = loadGatePublicKeyPem();

  const merged = authorizations
    .map((authorization) => ({
      authorization,
      signature_valid: verifyAuthorizationSignature(authorization, gatePublicKeyPem),
    }))
    .sort((a, b) => b.authorization.authorized_at.localeCompare(a.authorization.authorized_at));

  return Response.json(merged);
}
