"use client";

// Funds a mandate through Razorpay TEST mode.
//
//   1. "Create test order & pay" → /api/shop/mandate/fund runs `gate fund --amount`, which creates a
//      Razorpay Order (the reserve) and signs its reference into the mandate.
//   2. Razorpay Checkout opens for that order. Pay it with a test card — no real money moves.
//   3. Checkout's result goes to /api/shop/razorpay/verify: it checks the signature, then has the gate
//      attach the reserve (`gate fund --reserve-ref`), which reads the REAL captured balance from
//      Razorpay. That read — not anything the browser said — is what makes the balance appear.
//
// If the payment happens elsewhere (the hosted pay page, or a webhook that hasn't fired yet), the
// "confirm funding" button runs step 3's attach on its own.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEST_CARD_HELP, fetchCheckoutDetails, openCheckout, verifyPayment } from "@/lib/razorpay-checkout";

type FundResponse = {
  ok: boolean;
  message?: string;
  reserveRef?: string;
  orderId?: string;
  checkoutUrl?: string;
};

type Config = { configured: boolean; reason?: string; webhookConfigured?: boolean };

export function FundMandateForm({ mandateId, onFunded }: { mandateId: string; onFunded: () => void }) {
  const [amountInr, setAmountInr] = useState("500");
  const [config, setConfig] = useState<Config | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [reserveRef, setReserveRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/razorpay/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: Config) => !cancelled && setConfig(c))
      .catch(() => !cancelled && setConfig({ configured: false, reason: "Could not read the Razorpay configuration." }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function attach(ref: string): Promise<boolean> {
    const res = await fetch("/api/shop/mandate/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandateId, reserveRef: ref }),
    });
    const json = (await res.json()) as FundResponse;
    if (!res.ok || !json.ok) {
      toast.error("Could not confirm funding", {
        description: json.message ?? "Make sure the Razorpay test payment completed before confirming.",
      });
      return false;
    }
    toast.success("Mandate funded — balance verified with Razorpay");
    onFunded();
    return true;
  }

  async function handleFundAndPay() {
    setBusy(true);
    try {
      const res = await fetch("/api/shop/mandate/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId, amountInr: Number(amountInr) }),
      });
      const json = (await res.json()) as FundResponse;
      if (!res.ok || !json.ok || !json.orderId) {
        toast.error("Could not create the Razorpay order", { description: json.message });
        return;
      }
      setCheckoutUrl(json.checkoutUrl ?? "");
      setReserveRef(json.reserveRef ?? "");

      const outcome = await openCheckout(await fetchCheckoutDetails(json.orderId));
      if (outcome.status === "dismissed") {
        toast.message("Checkout closed — the order is still open. Reopen it from the link below.");
        return;
      }
      if (outcome.status === "failed") {
        toast.error("Payment failed", { description: outcome.message });
        return;
      }
      const verified = await verifyPayment(outcome.response);
      if (!verified.ok) {
        toast.error("Payment could not be verified", { description: verified.message });
        return;
      }
      toast.success("Mandate funded — balance verified with Razorpay");
      onFunded();
    } catch (err) {
      toast.error("Funding failed", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach() {
    if (!reserveRef) return;
    setAttaching(true);
    try {
      await attach(reserveRef);
    } finally {
      setAttaching(false);
    }
  }

  const unavailable = config !== null && !config.configured;

  return (
    <Panel>
      <div className="mb-3 text-sm font-medium text-foreground">Mandate not funded yet</div>
      <p className="mb-4 text-xs text-muted-foreground">
        Funding creates a Razorpay <strong>test-mode</strong> order and opens Checkout. Pay it with a test card — the reserve is whatever
        Razorpay reports as actually captured.
      </p>

      {unavailable && (
        <div className="mb-4 rounded-xl border border-deny/30 bg-deny/5 px-4 py-3 text-xs text-deny">{config?.reason}</div>
      )}

      <div className="flex max-w-md items-end gap-3">
        <div className="flex-1">
          <label className="text-[11px] tracking-wide text-ink-faint uppercase">Funding amount (₹)</label>
          <Input
            type="number"
            min={1}
            value={amountInr}
            onChange={(e) => setAmountInr(e.target.value)}
            placeholder="500"
            className="mt-1.5 font-mono text-sm"
          />
        </div>
        <Button onClick={handleFundAndPay} disabled={busy || !amountInr || unavailable}>
          {busy ? "Working…" : "Create test order & pay"}
        </Button>
      </div>

      <p className="mt-3 max-w-md text-[11px] leading-relaxed text-ink-faint">
        Test card <code className="font-mono">{TEST_CARD_HELP.visa}</code> · {TEST_CARD_HELP.note}
      </p>

      {(checkoutUrl || reserveRef) && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-sunken px-4 py-3 text-sm">
          {checkoutUrl && (
            <div>
              <div className="text-[11px] tracking-wide text-ink-faint uppercase">Hosted pay page</div>
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-seal underline underline-offset-2">
                {checkoutUrl}
              </a>
            </div>
          )}
          {reserveRef && (
            <div>
              <div className="text-[11px] tracking-wide text-ink-faint uppercase">Reserve reference</div>
              <code className="mt-1 block font-mono text-xs text-foreground">{reserveRef}</code>
            </div>
          )}
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Paid somewhere else (the hosted page, or a payment your webhook hasn&apos;t delivered yet)? Confirm here — this reads the real
              balance from Razorpay and is what makes it show up on this page.
              {config && !config.webhookConfigured ? " No webhook secret is configured, so nothing will confirm this for you automatically." : ""}
            </p>
            <Button onClick={handleAttach} disabled={attaching || !reserveRef} size="sm">
              {attaching ? "Verifying with Razorpay…" : "I've paid — confirm funding"}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
