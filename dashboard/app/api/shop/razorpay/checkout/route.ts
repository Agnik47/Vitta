// The details the browser needs to open Razorpay Checkout for one Vitta order. The order is fetched
// from Razorpay (never trusted from the client), must have been created by Vitta, and must still be
// unpaid — Checkout for an already-paid order would only confuse.
import { getCheckoutOrder, razorpayConfig } from "@/lib/razorpay";

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
  const cfg = razorpayConfig();
  if (!cfg.configured || !cfg.keyId) {
    return Response.json({ ok: false, message: cfg.reason ?? "Razorpay is not configured" }, { status: 503 });
  }
  try {
    const order = await getCheckoutOrder(orderId);
    if (order.status === "paid") {
      return Response.json({ ok: false, message: "This order has already been paid.", alreadyPaid: true }, { status: 409 });
    }
    return Response.json({
      ok: true,
      keyId: cfg.keyId,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      mandateId: order.mandateId,
    });
  } catch (err) {
    return Response.json({ ok: false, message: (err as Error).message }, { status: 404 });
  }
}
