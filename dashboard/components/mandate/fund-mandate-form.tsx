"use client";

// Creates a Prava checkout session for the mandate via /api/shop/mandate/fund.
// The browser cannot complete the passkey approval on behalf of the user, so the
// form returns the checkout URL and the session reference for manual approval.
//
// Creating the session does NOT itself write anything to mandate.json — gate.ts's `fund` command
// only persists a reserve when called with --reserve-ref (see src/cli/gate.ts cmdFund). So once the
// user has finished the Prava checkout in the other tab, this form has to make that second call
// itself (POSTing reserveRef instead of amountInr) or the mandate page will poll forever and never
// show a balance, even though the checkout genuinely succeeded on Prava's side.
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FundResponse = {
  ok: boolean;
  message?: string;
  reserveRef?: string;
  checkoutUrl?: string;
};

export function FundMandateForm({ mandateId, onFunded }: { mandateId: string; onFunded: () => void }) {
  const [amountInr, setAmountInr] = useState("500");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [reserveRef, setReserveRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);

  async function handleFund() {
    setBusy(true);
    try {
      const res = await fetch("/api/shop/mandate/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId, amountInr: Number(amountInr) }),
      });
      const json = (await res.json()) as FundResponse;
      if (!res.ok || !json.ok) {
        toast.error("Could not create Prava checkout", { description: json.message });
        return;
      }

      setCheckoutUrl(json.checkoutUrl ?? "");
      setReserveRef(json.reserveRef ?? "");
      toast.success("Prava checkout created — complete it, then confirm below");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach() {
    if (!reserveRef) return;
    setAttaching(true);
    try {
      const res = await fetch("/api/shop/mandate/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId, reserveRef }),
      });
      const json = (await res.json()) as FundResponse;
      if (!res.ok || !json.ok) {
        toast.error("Could not confirm funding", {
          description: json.message ?? "Make sure you finished the Prava checkout (card + passkey) before confirming.",
        });
        return;
      }
      toast.success("Mandate funded — balance verified with Prava");
      onFunded();
    } finally {
      setAttaching(false);
    }
  }

  return (
    <Panel>
      <div className="mb-3 text-sm font-medium text-foreground">Mandate not funded yet</div>
      <p className="mb-4 text-xs text-muted-foreground">
        Create a Prava checkout session, complete the passkey approval in the browser, then refresh this page to
        see the active mandate balance.
      </p>
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
        <Button onClick={handleFund} disabled={busy || !amountInr}>
          {busy ? "Creating checkout…" : "Create Prava checkout"}
        </Button>
      </div>

      {(checkoutUrl || reserveRef) && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-sunken px-4 py-3 text-sm">
          {checkoutUrl && (
            <div>
              <div className="text-[11px] tracking-wide text-ink-faint uppercase">Checkout URL</div>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-seal underline underline-offset-2"
              >
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
              Once you&apos;ve entered your card and approved the passkey in the checkout tab, confirm here — this
              reads the real balance from Prava and is what actually makes it show up on this page.
            </p>
            <Button onClick={handleAttach} disabled={attaching || !reserveRef} size="sm">
              {attaching ? "Verifying with Prava…" : "I've completed the checkout — confirm funding"}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
