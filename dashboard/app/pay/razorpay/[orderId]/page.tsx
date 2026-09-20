"use client";

// The hosted pay page a `gate fund` checkout link points at: opens Razorpay Checkout (TEST mode) for
// one Vitta order, then has the server verify the payment and attach the reserve to its mandate.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { OrderAlreadyPaidError, TEST_CARD_HELP, fetchCheckoutDetails, openCheckout, verifyPayment, type CheckoutDetails } from "@/lib/razorpay-checkout";

type Phase = "loading" | "ready" | "paying" | "verifying" | "done" | "already-paid" | "error";

export default function RazorpayPayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [details, setDetails] = useState<CheckoutDetails | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCheckoutDetails(orderId)
      .then((d) => {
        if (cancelled) return;
        setDetails(d);
        setPhase("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (err instanceof OrderAlreadyPaidError) {
          setPhase("already-paid");
          return;
        }
        setMessage(err.message);
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function pay() {
    if (!details) return;
    setPhase("paying");
    setMessage("");
    try {
      const outcome = await openCheckout(details);
      if (outcome.status === "dismissed") {
        setPhase("ready");
        return;
      }
      if (outcome.status === "failed") {
        setMessage(outcome.message);
        setPhase("ready");
        return;
      }
      setPhase("verifying");
      const result = await verifyPayment(outcome.response);
      if (!result.ok) {
        setMessage(result.message ?? "Payment could not be verified");
        setPhase("error");
        return;
      }
      setPhase("done");
    } catch (err) {
      setMessage((err as Error).message);
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Fund reserve" description="Pay a Razorpay test-mode order to fund a Vitta mandate. No real money moves." />
      <Panel>
        {phase === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading order…
          </div>
        )}

        {(phase === "ready" || phase === "paying" || phase === "verifying") && details && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] tracking-wide text-ink-faint uppercase">Amount</dt>
                <dd className="font-mono text-foreground">₹{(details.amountPaise / 100).toLocaleString("en-IN")}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-ink-faint uppercase">Mandate</dt>
                <dd className="break-all font-mono text-xs text-foreground">{details.mandateId}</dd>
              </div>
            </dl>
            <Button onClick={pay} disabled={phase !== "ready"}>
              {phase === "paying" ? "Waiting for Razorpay…" : phase === "verifying" ? "Verifying payment…" : `Pay ₹${(details.amountPaise / 100).toLocaleString("en-IN")} (test)`}
            </Button>
            {message && <p className="text-[13px] text-deny">{message}</p>}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Test card <code className="font-mono">{TEST_CARD_HELP.visa}</code> or <code className="font-mono">{TEST_CARD_HELP.mastercard}</code>. {TEST_CARD_HELP.note}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-allow">
              <CheckCircle2 className="size-5" /> Paid — the reserve is attached to the mandate.
            </div>
            <Link href="/mandate" className="text-sm text-seal underline underline-offset-2">
              Back to the mandate
            </Link>
          </div>
        )}

        {phase === "already-paid" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-allow">
              <CheckCircle2 className="size-5" /> This order is already paid — there is nothing more to pay.
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Razorpay has the payment. The mandate&apos;s reserve is whatever Razorpay reports as captured; open the mandate to see it. If the
              balance is missing, attach the order with the &ldquo;confirm funding&rdquo; button or
              {" "}<code className="font-mono">gate fund &lt;mandate&gt; --reserve-ref razorpay-order:{orderId}</code>.
            </p>
            <Link href="/mandate" className="text-sm text-seal underline underline-offset-2">
              Go to the mandate
            </Link>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-deny">{message}</p>
            <p className="text-xs text-muted-foreground">
              If the payment went through, the mandate page&apos;s &ldquo;confirm funding&rdquo; button (or `gate fund &lt;mandate&gt; --reserve-ref razorpay-order:{orderId}`) attaches it.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
