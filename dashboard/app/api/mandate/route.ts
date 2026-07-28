// GET-only. Reads the current mandate.json and the live Dodo reserve balance (read-only key).
// Never writes anything, never imports DODO_API_KEY (write key) — see docs/06-DASHBOARD-SPEC.md.
import { readCurrentMandate } from '@/lib/read';
import { getReserveBalance } from '@/lib/dodo';

export async function GET() {
  const mandate = readCurrentMandate();
  if (!mandate) {
    return Response.json({ mandate: null, balance: null });
  }
  const balance = await getReserveBalance(mandate.reserve.ref);
  return Response.json({ mandate, balance });
}
