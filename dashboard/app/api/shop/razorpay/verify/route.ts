// Called by the browser after Checkout succeeds, with the three values Checkout returns.
//
// The signature check rejects forged or mismatched requests early. It is NOT what funds anything:
// the reserve is attached by spawning `gate fund --reserve-ref`, which re-reads the order and its
// payments from Razorpay itself (and captures an `authorized` payment). Even a request that passed
// the signature check for someone else's payment would find nothing paid on THIS mandate's order.
// The mandate id comes from Razorpay's own order notes, never from the request.
import { runGateCli } from "@/lib/gate-cli";
import { describeGateFailure } from "@/lib/gate-failure";
import { ORDER_ID_RE, PAYMENT_ID_RE, getCheckoutOrder, verifyCheckoutSignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = (body ?? {}) as Record<string, unknown>;

  if (typeof orderId !== "string" || !ORDER_ID_RE.test(orderId) || typeof paymentId !== "string" || !PAYMENT_ID_RE.test(paymentId) || typeof signature !== "string") {
    return Response.json({ ok: false, message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" }, { status: 400 });
  }
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return Response.json({ ok: false, message: "Payment signature did not verify." }, { status: 400 });
  }

  let mandateId: string;
  try {
    mandateId = (await getCheckoutOrder(orderId)).mandateId;
  } catch (err) {
    return Response.json({ ok: false, message: (err as Error).message }, { status: 404 });
  }

  const result = await runGateCli(["fund", mandateId, "--reserve-ref", `razorpay-order:${orderId}`]);
  if (!result.ok) {
    return Response.json({ ok: false, message: describeGateFailure(result.stdout, result.stderr, "gate fund failed") }, { status: 422 });
  }
  return Response.json({ ok: true, mandateId, raw: result.stdout.trim() });
}
