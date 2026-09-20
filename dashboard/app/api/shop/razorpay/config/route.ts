// Whether Razorpay test mode is usable, and the PUBLIC key id Checkout needs. Never returns the secret.
import { razorpayConfig } from "@/lib/razorpay";

export async function GET() {
  const cfg = razorpayConfig();
  return Response.json({ ok: true, configured: cfg.configured, keyId: cfg.keyId, reason: cfg.reason, webhookConfigured: cfg.webhookConfigured });
}
