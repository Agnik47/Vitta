"use client";

// Creates a real, Ed25519-signed mandate by calling /api/shop/mandate, which spawns the real
// `gate mandate create` CLI. Nothing about signing or policy is reimplemented here — this is a form
// over the same command the terminal runs.
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Settings2 } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateMandateForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("agent:shop-runner");
  const [cap, setCap] = useState("2000");
  const [perTxn, setPerTxn] = useState("1000");
  const [expires, setExpires] = useState("23:59");
  const [maxTxns, setMaxTxns] = useState("10");
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await fetch("/api/shop/mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          capInr: Number(cap),
          perTxnInr: Number(perTxn),
          // Scoped to all three merchants the purchase flow can actually reach — a Zepto or
          // BigBasket pick would otherwise DENY with MERCHANT_NOT_ALLOWED.
          merchants: ["blinkit", "zepto", "bigbasket"],
          expires,
          maxTxns: Number(maxTxns),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not create mandate", { description: json.message });
        return;
      }
      toast.success(`Mandate ${json.mandateId} signed`);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">No active mandate</div>
        <Button variant="ghost" size="sm" onClick={() => setShowManual(!showManual)} className="h-8 text-xs text-ink-faint">
          <Settings2 className="mr-1.5 size-3.5" />
          {showManual ? "Hide manual config" : "Manual config"}
        </Button>
      </div>
      
      {!showManual ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-step-up/30 bg-step-up/5 py-8 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-step-up/20">
            <Sparkles className="size-6 text-step-up" />
          </div>
          <h3 className="mb-2 text-sm font-medium text-foreground">Agent-Driven Mandate</h3>
          <p className="mb-4 max-w-md text-xs text-ink-faint">
            Let the agent automatically configure and sign a standard mandate optimized for today's purchases (up to 10 transactions).
          </p>
          <div className="mb-6 flex items-center justify-center gap-3">
            <span className="text-sm font-medium text-foreground">Cap (₹)</span>
            <Input 
              type="number" 
              value={cap} 
              onChange={(e) => setCap(e.target.value)} 
              className="w-24 text-center" 
            />
          </div>
          <Button onClick={handleCreate} disabled={busy} className="bg-step-up text-step-up-foreground hover:bg-step-up/90">
            {busy ? "Agent is configuring..." : `Auto-create Mandate`}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Cap (₹)</label>
              <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Per-txn (₹)</label>
              <Input type="number" value={perTxn} onChange={(e) => setPerTxn(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Expires (24h)</label>
              <Input value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1.5" placeholder="23:59" />
            </div>
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Max transactions</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxTxns}
                onChange={(e) => setMaxTxns(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <Button className="mt-5" onClick={handleCreate} disabled={busy}>
            {busy ? "Signing…" : "Create real mandate"}
          </Button>
        </>
      )}
      
      <p className="mt-4 text-xs text-ink-faint">
        Real Ed25519-signed mandate, scoped to Blinkit, Zepto and BigBasket — same as running{" "}
        <code className="font-mono text-foreground">gate mandate create</code>.
      </p>
    </Panel>
  );
}
