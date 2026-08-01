// GET-only. Reads the current mandate.json and the live Prava reserve balance (read-only key).
// Never writes anything, never imports PRAVA_SECRET_KEY from client code.
import { readCurrentMandate } from '@/lib/read';
import { getReserveBalance } from '@/lib/prava';

export async function GET() {
  const mandate = readCurrentMandate();
  if (!mandate) {
    return Response.json({ mandate: null, balance: null });
  }
  const balance = await getReserveBalance(mandate.reserve.ref);
  return Response.json({ mandate, balance });
}
