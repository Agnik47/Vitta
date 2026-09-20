// GET-only. Reads the current mandate.json and the live Razorpay reserve balance (captured − spent).
// Never writes anything; RAZORPAY_KEY_SECRET stays server-side.
import { readCurrentMandate } from '@/lib/read';
import { getReserveBalance } from '@/lib/razorpay';

export async function GET() {
  const mandate = readCurrentMandate();
  if (!mandate) {
    return Response.json({ mandate: null, balance: null });
  }
  const balance = await getReserveBalance(mandate.reserve.ref);
  return Response.json({ mandate, balance });
}
