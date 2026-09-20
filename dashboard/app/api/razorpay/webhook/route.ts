// Razorpay webhook receiver (order.paid / payment.captured / payment.authorized).
//
//   • Authenticated by X-Razorpay-Signature = HMAC-SHA256(RAW body, RAZORPAY_WEBHOOK_SECRET). With no
//     secret configured the route refuses everything (503) — it never accepts unauthenticated events.
//   • Idempotent on the x-razorpay-event-id header: Razorpay retries, and events can arrive out of order.
//   • The payload is only a hint about WHICH order to look at. Funding is done by `gate fund
//     --reserve-ref`, which re-reads Razorpay's API — so a delivered event cannot claim money that
//     isn't there.
// Local testing needs a public tunnel; Razorpay blocks ngrok-style hosts (docs recommend zrok).
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGateCli } from "@/lib/gate-cli";
import { describeGateFailure } from "@/lib/gate-failure";
import { getRuntimeDataDir } from "@/lib/read";
import { ORDER_ID_RE, getCheckoutOrder, verifyWebhookSignature } from "@/lib/razorpay";
import { runtimeEnv } from "@/lib/runtime-env";

const HANDLED_EVENTS = new Set(["order.paid", "payment.captured", "payment.authorized"]);
const MAX_REMEMBERED = 500;

function seenFile(): string {
  return path.join(getRuntimeDataDir(), "razorpay-webhook-events.json");
}
function loadSeen(): string[] {
  try {
    return existsSync(seenFile()) ? (JSON.parse(readFileSync(seenFile(), "utf-8")) as string[]) : [];
  } catch {
    return [];
  }
}
function remember(eventId: string): void {
  const next = [...loadSeen().filter((id) => id !== eventId), eventId].slice(-MAX_REMEMBERED);
  writeFileSync(`${seenFile()}.tmp`, JSON.stringify(next));
  renameSync(`${seenFile()}.tmp`, seenFile());
}

interface WebhookPayload {
  event?: string;
  payload?: {
    order?: { entity?: { id?: string } };
    payment?: { entity?: { order_id?: string } };
  };
}

export async function POST(req: Request) {
  if (!runtimeEnv("RAZORPAY_WEBHOOK_SECRET")) {
    return Response.json({ ok: false, message: "Webhook not configured (RAZORPAY_WEBHOOK_SECRET)." }, { status: 503 });
  }
  const raw = await req.text(); // the exact bytes — never a re-serialized copy
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return Response.json({ ok: false, message: "Bad signature" }, { status: 401 });
  }

  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId) return Response.json({ ok: false, message: "Missing x-razorpay-event-id" }, { status: 400 });
  if (loadSeen().includes(eventId)) return Response.json({ ok: true, duplicate: true });

  let event: WebhookPayload;
  try {
    event = JSON.parse(raw) as WebhookPayload;
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  if (!event.event || !HANDLED_EVENTS.has(event.event)) {
    remember(eventId);
    return Response.json({ ok: true, handled: false, reason: `event ${event.event ?? "?"} is not one Vitta acts on` });
  }

  const orderId = event.payload?.order?.entity?.id ?? event.payload?.payment?.entity?.order_id;
  if (!orderId || !ORDER_ID_RE.test(orderId)) {
    remember(eventId);
    return Response.json({ ok: true, handled: false, reason: "no order id in the event" });
  }

  let mandateId: string;
  try {
    mandateId = (await getCheckoutOrder(orderId)).mandateId;
  } catch (err) {
    // Not a Vitta order (or Razorpay unreachable). A non-Vitta order is permanent; an outage is worth a retry.
    const msg = (err as Error).message;
    if (/not created by Vitta/.test(msg)) {
      remember(eventId);
      return Response.json({ ok: true, handled: false, reason: msg });
    }
    return Response.json({ ok: false, message: msg }, { status: 502 });
  }

  const result = await runGateCli(["fund", mandateId, "--reserve-ref", `razorpay-order:${orderId}`]);
  if (result.exitCode === 124) {
    // gate timed out — transient; let Razorpay retry.
    return Response.json({ ok: false, message: result.stderr }, { status: 500 });
  }
  remember(eventId);
  if (!result.ok) {
    // e.g. payment.authorized arrived before capture and there is still ₹0 paid: a permanent no-op for
    // THIS event (a later captured/paid event completes the funding), so acknowledge rather than retry.
    return Response.json({ ok: true, handled: false, reason: describeGateFailure(result.stdout, result.stderr, "").slice(0, 300) });
  }
  return Response.json({ ok: true, handled: true, mandateId, orderId });
}
