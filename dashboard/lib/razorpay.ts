// Server-only Razorpay TEST-mode access for the dashboard: the live reserve balance, the details the
// browser needs to open Checkout, and the two signature checks. RAZORPAY_KEY_SECRET is read here and
// NEVER returned to client code — only the public key id ever leaves the server.
//
// Deliberately a hand-mirror of src/ledger/RazorpayLedger.ts and src/ledger/razorpay-signature.ts
// (this app does not import src/ — see lib/types.ts's header). The balance rules below must stay
// identical to the ledger's, because the number shown here has to be the number the gate reads:
//   paid  = captured payments net of refunds, capped by the order's own amount_paid
//   spent = the LARGER of the local debit log and the order's server-side vitta_spent_paise note
//   balance = paid − spent, and 0 once the reserve has been released
//
// No route here can make money spendable. A reserve becomes spendable only through `gate fund
// --reserve-ref`, which re-reads Razorpay itself — so a forged request that got past a signature
// check would still find nothing paid.
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getRuntimeDataDir } from "@/lib/read";
import { runtimeEnv } from "@/lib/runtime-env";

export interface ReserveBalance {
  balanceInr: number;
  available: true;
}
export interface ReserveBalanceUnavailable {
  available: false;
  reason: string;
}

export const ORDER_ID_RE = /^order_[A-Za-z0-9]{6,40}$/;
export const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{6,40}$/;
const RESERVE_REF_PREFIX = "razorpay-order:";

type Notes = Record<string, string | number | boolean>;

interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: "created" | "attempted" | "paid";
  notes: Notes | unknown[];
}

interface RazorpayPayment {
  id: string;
  amount: number;
  status: string;
  amount_refunded?: number;
}

export interface RazorpayConfig {
  configured: boolean;
  /** Public key id — safe to send to the browser. Only ever a rzp_test_ id. */
  keyId?: string;
  /** Why it is not usable, when it is not. */
  reason?: string;
  webhookConfigured: boolean;
}

function baseUrl(): string {
  return (runtimeEnv("RAZORPAY_API_BASE_URL") ?? "https://api.razorpay.com").replace(/\/+$/, "");
}

// RAZORPAY_TEST_API / RAZORPAY_TEST_SECRET are accepted as aliases for the key pair.
function keySecret(): string | undefined {
  return runtimeEnv("RAZORPAY_KEY_SECRET") ?? runtimeEnv("RAZORPAY_TEST_SECRET");
}

export function razorpayConfig(): RazorpayConfig {
  const keyId = runtimeEnv("RAZORPAY_KEY_ID") ?? runtimeEnv("RAZORPAY_TEST_API");
  const secret = keySecret();
  const webhookConfigured = Boolean(runtimeEnv("RAZORPAY_WEBHOOK_SECRET"));
  if (!keyId || !secret) {
    return { configured: false, webhookConfigured, reason: "Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to test-mode keys)." };
  }
  // Test mode only, same hard rule as the ledger: a live key is treated as not configured.
  if (!keyId.startsWith("rzp_test_")) {
    return { configured: false, webhookConfigured, reason: "RAZORPAY_KEY_ID is not a test-mode key (rzp_test_…). Vitta only runs against Razorpay test mode." };
  }
  return { configured: true, keyId, webhookConfigured };
}

async function rzp<T>(pathname: string): Promise<T> {
  const cfg = razorpayConfig();
  if (!cfg.configured) throw new Error(cfg.reason);
  const auth = Buffer.from(`${cfg.keyId}:${keySecret()}`).toString("base64");
  const res = await fetch(`${baseUrl()}${pathname}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Razorpay returned a non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error((body as { error?: { description?: string } }).error?.description ?? `Razorpay API returned HTTP ${res.status}`);
  }
  return body as T;
}

const asNotes = (notes: RazorpayOrder["notes"]): Notes => (Array.isArray(notes) ? {} : (notes as Notes));
const toPaise = (v: unknown): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

export function orderIdFromReserveRef(reserveRef: string): string | null {
  if (!reserveRef.startsWith(RESERVE_REF_PREFIX)) return null;
  const id = reserveRef.slice(RESERVE_REF_PREFIX.length);
  return ORDER_ID_RE.test(id) ? id : null;
}

function ledgerLogPath(): string {
  const override = runtimeEnv("RAZORPAY_LEDGER_PATH");
  return override ? path.resolve(getRuntimeDataDir(), override) : path.join(getRuntimeDataDir(), "razorpay-ledger.jsonl");
}

function localSpentPaise(reserveRef: string): number {
  const file = ledgerLogPath();
  if (!existsSync(file)) return 0;
  const entries: Array<{ kind: string; reserveRef: string; amountPaise?: number; reference: string }> = [];
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // torn trailing line — ignore, exactly as the ledger does
    }
  }
  const voided = new Set(entries.filter((e) => e.kind === "void" && e.reserveRef === reserveRef).map((e) => e.reference));
  return entries
    .filter((e) => e.kind === "debit" && e.reserveRef === reserveRef && !voided.has(e.reference))
    .reduce((sum, e) => sum + toPaise(e.amountPaise), 0);
}

export async function getReserveBalance(reserveRef: string): Promise<ReserveBalance | ReserveBalanceUnavailable> {
  const cfg = razorpayConfig();
  if (!cfg.configured) return { available: false, reason: cfg.reason ?? "Razorpay is not configured" };
  if (!reserveRef) return { available: false, reason: "This mandate has no reserve yet — fund it." };
  const orderId = orderIdFromReserveRef(reserveRef);
  if (!orderId) {
    return { available: false, reason: "This mandate's reserve is from an older payment rail (or malformed) — fund it again with Razorpay." };
  }
  try {
    const order = await rzp<RazorpayOrder>(`/v1/orders/${orderId}`);
    const notes = asNotes(order.notes);
    if (typeof notes.vitta_mandate_id !== "string") return { available: false, reason: `Razorpay order ${orderId} was not created by Vitta.` };
    if (notes.vitta_released === "1") return { available: true, balanceInr: 0 };
    const payments = await rzp<{ items?: RazorpayPayment[] }>(`/v1/orders/${orderId}/payments`);
    const captured = (payments.items ?? [])
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + Math.max(0, toPaise(p.amount) - toPaise(p.amount_refunded)), 0);
    const paid = Math.min(captured, toPaise(order.amount_paid));
    const spent = Math.max(localSpentPaise(reserveRef), toPaise(notes.vitta_spent_paise));
    return { available: true, balanceInr: Math.max(0, paid - spent) / 100 };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : "Unknown error reading the Razorpay balance" };
  }
}

export interface CheckoutOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  mandateId: string;
  status: RazorpayOrder["status"];
}

/** What the browser needs to open Checkout for a Vitta order — after checking it is one. */
export async function getCheckoutOrder(orderId: string): Promise<CheckoutOrder> {
  if (!ORDER_ID_RE.test(orderId)) throw new Error("Invalid order id");
  const order = await rzp<RazorpayOrder>(`/v1/orders/${orderId}`);
  const mandateId = asNotes(order.notes).vitta_mandate_id;
  if (typeof mandateId !== "string" || !mandateId) throw new Error("That order was not created by Vitta.");
  return { orderId: order.id, amountPaise: order.amount, currency: order.currency, mandateId, status: order.status };
}

// ---- signatures (mirror of src/ledger/razorpay-signature.ts) ---------------------------------

function safeEqualHex(expected: string, given: string): boolean {
  if (typeof given !== "string" || !/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given.toLowerCase(), "hex"));
}

/** hex(HMAC-SHA256(order_id|payment_id, key_secret)) — what Checkout hands back as razorpay_signature. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = keySecret();
  if (!secret || !orderId || !paymentId) return false;
  return safeEqualHex(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

/** hex(HMAC-SHA256(RAW body, webhook secret)) — the X-Razorpay-Signature header. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = runtimeEnv("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  return safeEqualHex(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}
