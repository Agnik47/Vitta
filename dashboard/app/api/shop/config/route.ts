// Shop-flow configuration the client needs. Currently just the minimum-cart-value threshold used
// by the purchase flow's free-delivery check.
//
// Deliberately ONE configurable number rather than per-merchant hardcoded thresholds: quick-commerce
// platforms change these constantly and vary them by city and time of day, so a table of literals
// baked into this repo would be confidently wrong rather than usefully right. The real merchant
// cart is still the authority on what's actually charged — this threshold only drives the "you need
// ₹N more for free delivery" prompt.
import { runtimeEnv } from "@/lib/runtime-env";

const DEFAULT_MIN_CART_INR = 150;

export async function GET() {
  const raw = runtimeEnv("SHOP_MIN_CART_INR");
  const parsed = raw !== undefined ? Number(raw) : NaN;
  const minCartInr = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_CART_INR;
  return Response.json({ ok: true, minCartInr, configured: Number.isFinite(parsed) && parsed > 0 });
}
