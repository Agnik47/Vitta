// Browser-side Razorpay Checkout (Checkout.js) for a Vitta test order. Three steps, none of which
// trusts the browser: fetch the order details from our server (which reads them from Razorpay), let
// the customer pay in Razorpay's own modal, then post what Checkout returns to /verify — which only
// checks the signature and asks the gate to attach the reserve from Razorpay's real records.
//
// Test mode: use card 4100 2800 0000 1007 (Visa) or 5555 5555 5555 4444 (Mastercard), any future
// expiry, any CVV; on the sample bank page any OTP of 4–10 digits succeeds, fewer than 4 fails
// (docs: razorpay.com/docs/payments/payments/test-card-details).

export const TEST_CARD_HELP = {
  visa: "4100 2800 0000 1007",
  mastercard: "5555 5555 5555 4444",
  note: "Any future expiry and any CVV. On the bank page, an OTP of 4–10 digits succeeds; fewer than 4 digits fails.",
};

interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Checkout runs in the browser"));
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Razorpay Checkout (checkout.razorpay.com is unreachable or blocked)."));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export interface CheckoutDetails {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  mandateId: string;
}

export async function fetchCheckoutDetails(orderId: string): Promise<CheckoutDetails> {
  const res = await fetch(`/api/shop/razorpay/checkout?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
  const body = (await res.json()) as { ok: boolean; message?: string } & Partial<CheckoutDetails>;
  if (!body.ok || !body.keyId || !body.orderId || body.amountPaise === undefined || !body.currency || !body.mandateId) {
    throw new Error(body.message ?? "Could not load the order for checkout");
  }
  return { keyId: body.keyId, orderId: body.orderId, amountPaise: body.amountPaise, currency: body.currency, mandateId: body.mandateId };
}

export type CheckoutOutcome =
  | { status: "paid"; response: CheckoutSuccess }
  | { status: "dismissed" }
  | { status: "failed"; message: string };

/** Opens the Razorpay modal for `details` and resolves when the customer pays, closes it, or fails. */
export async function openCheckout(details: CheckoutDetails): Promise<CheckoutOutcome> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay Checkout did not initialise");

  return new Promise<CheckoutOutcome>((resolve) => {
    const instance = new Razorpay({
      key: details.keyId,
      order_id: details.orderId,
      amount: details.amountPaise,
      currency: details.currency,
      name: "Vitta",
      description: `Fund mandate ${details.mandateId} (Razorpay test mode)`,
      theme: { color: "#7a2e23" },
      handler: (response: CheckoutSuccess) => resolve({ status: "paid", response }),
      modal: { ondismiss: () => resolve({ status: "dismissed" }) },
    });
    instance.on("payment.failed", (r) => resolve({ status: "failed", message: r.error?.description ?? "The payment failed" }));
    instance.open();
  });
}

/** Sends Checkout's result to the server, which verifies the signature and has the gate attach the reserve. */
export async function verifyPayment(response: CheckoutSuccess): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("/api/shop/razorpay/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  });
  return (await res.json()) as { ok: boolean; message?: string };
}
