"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, Settings2, CreditCard, ArrowLeft } from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PravaSDK } from "@prava-sdk/core";

export function CreateMandateForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("agent:shop-runner");
  const [cap, setCap] = useState("2000");
  const [perTxn, setPerTxn] = useState("1000");
  const [expires, setExpires] = useState("23:59");
  const [maxTxns, setMaxTxns] = useState("10");
  const [showManual, setShowManual] = useState(false);

  // Prava State
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<PravaSDK | null>(null);
  const [stage, setStage] = useState<"config" | "payment" | "creating">("config");
  const [iframeReady, setIframeReady] = useState(false);
  
  async function handleStartPayment() {
    setStage("payment");
    setIframeReady(false);

    try {
      // 1. Create a session on the backend WITH THE CAP AMOUNT
      const res = await fetch("/api/prava/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cap }), // Passing the dynamic amount!
      });
      const session = await res.json();
      
      if (!res.ok) {
        const msg = typeof session.error === 'string' ? session.error : session.message || JSON.stringify(session);
        throw new Error(msg);
      }

      // 2. Initialize SDK
      const sdk = new PravaSDK({ publishableKey: session.publishable_key || "pk_test_xxx" });
      sdkRef.current = sdk;

      // 3. Mount iframe instantly
      setTimeout(() => {
        if (!containerRef.current) return;
        sdk.collectPAN({
          sessionToken: session.session_token,
          iframeUrl: session.iframe_url,
          container: containerRef.current,
          onReady: () => setIframeReady(true),
          onSuccess: (data: any) => {
            sdk.destroy();
            handleCreateMandate(data.enrollmentId || session.session_id, session.user_id);
          },
          onError: (err: any) => {
            let msg = "Unknown error";
            try { msg = err?.message ? String(err.message) : (typeof err === 'string' ? err : JSON.stringify(err)); } catch (e) {}
            toast.error("Payment failed", { description: msg });
            setStage("config");
          },
        });
      }, 100);

    } catch (err: any) {
      let msg = "Unknown error";
      try { msg = err?.message ? String(err.message) : (typeof err === 'string' ? err : JSON.stringify(err)); } catch (e) {}
      toast.error("Failed to start payment setup", { description: msg });
      setStage("config");
    }
  }

  async function handleCreateMandate(pravaSessionId: string, pravaUserId: string) {
    setStage("creating");
    try {
      const res = await fetch("/api/shop/mandate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          capInr: Number(cap),
          perTxnInr: Number(perTxn),
          merchants: ["blinkit", "zepto", "bigbasket"],
          expires,
          maxTxns: Number(maxTxns),
          pravaSessionId, // Sending the authorized session
          pravaUserId,    // Sending the user ID for PravaLedger
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not create mandate", { description: json.message || "Server error" });
        setStage("config");
        return;
      }
      toast.success(`Mandate ${json.mandateId} signed & funded!`);
      setStage("config");
      onCreated();
    } catch (err: any) {
      let msg = "Unknown error";
      try { msg = err?.message ? String(err.message) : (typeof err === 'string' ? err : JSON.stringify(err)); } catch (e) {}
      toast.error("Failed to create mandate", { description: msg });
      setStage("config");
    }
  }

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">No active mandate</div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowManual(!showManual)} 
          className="h-8 text-xs text-ink-faint"
          disabled={stage !== "config"}
        >
          <Settings2 className="mr-1.5 size-3.5" />
          {showManual ? "Hide manual config" : "Manual config"}
        </Button>
      </div>

      {stage === "payment" ? (
        <div className="flex flex-col gap-4 border border-border bg-card p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-6 -ml-2" onClick={() => {
              sdkRef.current?.destroy();
              setStage("config");
            }}>
              <ArrowLeft className="size-4" />
            </Button>
            <CreditCard className="size-5 text-seal" />
            <span className="text-sm font-medium">Authorize Spending Limit: ₹{cap}</span>
          </div>
          <p className="text-xs text-muted-foreground ml-8">
            Please authorize this mandate via Prava Payments.
          </p>
          <div className="ml-8">
            <div 
              ref={containerRef} 
              className={`w-full transition-all duration-300 ${iframeReady ? 'min-h-[120px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}
            />
            {!iframeReady && <div className="text-sm text-muted-foreground animate-pulse">Loading secure payment form...</div>}
          </div>
        </div>
      ) : stage === "creating" ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-step-up/20 animate-pulse">
            <Sparkles className="size-6 text-step-up" />
          </div>
          <h3 className="mb-2 text-sm font-medium">Finalizing Mandate...</h3>
          <p className="text-xs text-muted-foreground">Securing funds and signing the Ed25519 mandate.</p>
        </div>
      ) : (
        <>
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
                <span className="text-sm font-medium text-foreground">Spending Cap (₹)</span>
                <Input 
                  type="number" 
                  value={cap} 
                  onChange={(e) => setCap(e.target.value)} 
                  className="w-24 text-center bg-white dark:bg-black" 
                />
              </div>
              <Button onClick={handleStartPayment} className="bg-step-up text-step-up-foreground hover:bg-step-up/90 w-full max-w-[250px]">
                Authorize & Create
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border p-5 rounded-lg">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <div>
                  <label className="text-[11px] tracking-wide text-ink-faint uppercase">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <label className="text-[11px] tracking-wide text-ink-faint uppercase">Cap (₹)</label>
                  <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} className="mt-1.5 font-bold" />
                </div>
                <div>
                  <label className="text-[11px] tracking-wide text-ink-faint uppercase">Per-txn (₹)</label>
                  <Input type="number" value={perTxn} onChange={(e) => setPerTxn(e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div className="grid max-w-sm grid-cols-2 gap-4 mb-6">
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
              <Button className="w-full" onClick={handleStartPayment}>
                Authorize ₹{cap} & Sign
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
