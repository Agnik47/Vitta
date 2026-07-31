"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCart } from "@/lib/cart-context";
import { usePolledFetch } from "@/hooks/use-polling";
import type { Mandate } from "@/lib/types";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;
type MandateApiResponse = { mandate: Mandate | null; balance: Balance };

interface ExecuteResult {
  ok: boolean;
  verdict?: "ALLOW" | "DENY" | "STEP_UP";
  receiptId?: string;
  raw: string;
  stderr?: string;
}

function CreateMandateForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("agent:shop-runner");
  const [cap, setCap] = useState("500");
  const [perTxn, setPerTxn] = useState("500");
  const [expires, setExpires] = useState("23:59");
  const [busy, setBusy] = useState(false);

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
          merchants: ["blinkit"],
          expires,
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
      <div className="mb-4 text-sm font-medium text-foreground">No active mandate — create one</div>
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
      <div className="mt-4 max-w-[160px]">
        <label className="text-[11px] tracking-wide text-ink-faint uppercase">Expires (24h)</label>
        <Input value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1.5" placeholder="23:59" />
      </div>
      <Button className="mt-5" onClick={handleCreate} disabled={busy}>
        {busy ? "Signing…" : "Create real mandate"}
      </Button>
      <p className="mt-3 text-xs text-ink-faint">
        Real Ed25519-signed mandate, scoped to Blinkit — same as running{" "}
        <code className="font-mono text-foreground">gate mandate create</code>.
      </p>
    </Panel>
  );
}

function FundMandateForm({ mandateId, onFunded }: { mandateId: string; onFunded: () => void }) {
  const [reserveRef, setReserveRef] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFund() {
    setBusy(true);
    try {
      const res = await fetch("/api/shop/mandate/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId, reserveRef }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not fund mandate", { description: json.message });
        return;
      }
      toast.success("Mandate funded from real Dodo reserve");
      onFunded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-3 text-sm font-medium text-foreground">Mandate not funded — attach an existing reserve</div>
      <p className="mb-4 text-xs text-muted-foreground">
        This route can only attach an already-paid Dodo reserve (real balance read live) — it
        can&apos;t complete a new checkout from a web request, same constraint as the CLI itself.
      </p>
      <div className="flex max-w-md items-end gap-3">
        <div className="flex-1">
          <label className="text-[11px] tracking-wide text-ink-faint uppercase">Reserve reference</label>
          <Input
            value={reserveRef}
            onChange={(e) => setReserveRef(e.target.value)}
            placeholder="cks_..."
            className="mt-1.5 font-mono text-sm"
          />
        </div>
        <Button onClick={handleFund} disabled={busy || !reserveRef}>
          {busy ? "Funding…" : "Attach reserve"}
        </Button>
      </div>
    </Panel>
  );
}

function ExecutePanel({ mandate, balance }: { mandate: Mandate; balance: Balance }) {
  const { totalInr, hasRealItems, clear } = useCart();
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  async function handleExecute() {
    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch("/api/shop/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: "blinkit", command: "place-order", confirm: true }),
      });
      const json: ExecuteResult = await res.json();
      setResult(json);
      if (json.verdict === "ALLOW") {
        toast.success("Real purchase executed", { description: json.receiptId ? `Receipt ${json.receiptId}` : undefined });
        clear();
      } else if (json.verdict) {
        toast.error(`${json.verdict} — no purchase made`);
      }
    } finally {
      setExecuting(false);
    }
  }

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">Ready to execute</div>
        <span className="inline-flex items-center gap-1.5 border border-allow/40 bg-allow/10 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-allow uppercase">
          <CheckCircle2 className="size-3" strokeWidth={2.25} />
          Mandate funded
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border border-border">
        <div className="px-4 py-3">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Cap</div>
          <div className="mt-0.5 font-mono text-sm font-medium">₹{mandate.scope.cap_inr.toLocaleString("en-IN")}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Reserve balance</div>
          <div className="mt-0.5 font-mono text-sm font-medium">
            {balance?.available ? `₹${balance.balanceInr.toLocaleString("en-IN")}` : "—"}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">UI cart total</div>
          <div className="mt-0.5 font-mono text-sm font-medium">₹{totalInr.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {!hasRealItems && (
        <div className="mt-4 flex items-start gap-2.5 border border-step-up/30 bg-step-up/5 px-4 py-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-step-up" strokeWidth={1.75} />
          <p className="text-xs text-muted-foreground">
            No real Blinkit items in your cart — <code className="font-mono text-foreground">gate run</code> will
            check your real, live Blinkit cart (which may be empty or hold items added directly via webcmd
            elsewhere), not this illustrative total.
          </p>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2.5 border border-border bg-surface-sunken px-4 py-3">
        <Zap className="mt-0.5 size-4 shrink-0 text-seal" strokeWidth={1.75} />
        <p className="text-xs text-muted-foreground">
          Executing runs a real <code className="font-mono text-foreground">gate run -- webcmd blinkit
          place-order --confirm</code> against your actual, live Blinkit cart. If allowed, this draws real
          money from your Dodo test-mode reserve and signs a real receipt.
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="lg" className="mt-5" disabled={executing}>
            {executing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Executing…
              </>
            ) : (
              "Confirm & execute real purchase"
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-deny" strokeWidth={2} />
              This moves real money
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will run a real purchase against your live Blinkit cart, gated by your mandate&apos;s
              real policy check. If allowed, it draws from your real Dodo reserve and cannot be undone
              from here. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute}>Yes, execute for real</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <div
          className={`mt-5 border px-4 py-3 ${
            result.verdict === "ALLOW" ? "border-allow/30 bg-allow/5" : "border-deny/30 bg-deny/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.verdict === "ALLOW" ? (
              <CheckCircle2 className="size-4 text-allow" strokeWidth={2.25} />
            ) : (
              <XCircle className="size-4 text-deny" strokeWidth={2.25} />
            )}
            <span className="text-sm font-medium text-foreground">{result.verdict ?? "Error"}</span>
            {result.receiptId && (
              <Link href="/receipts" className="text-xs text-seal underline underline-offset-2">
                View receipt {result.receiptId}
              </Link>
            )}
          </div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {result.raw}
            {result.stderr ? `\n${result.stderr}` : ""}
          </pre>
        </div>
      )}
    </Panel>
  );
}

export default function CheckoutPage() {
  const { data } = usePolledFetch<MandateApiResponse>("/api/mandate", 3000);
  const [refreshTick, setRefreshTick] = useState(0);

  // Date.now() deferred to an effect, not called during render — same SSR-safe pattern as
  // mandate/expiry-ring.tsx. Starts non-expired so the funded/execute panel isn't skipped on the
  // very first paint pending this effect.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  const mandate = data?.mandate ?? null;
  const balance = data?.balance ?? null;
  const expired = mandate && now !== null ? new Date(mandate.scope.expires_at).getTime() <= now : false;
  const funded = mandate ? mandate.scope.cap_inr > 0 && balance?.available && balance.balanceInr > 0 : false;

  return (
    <div key={refreshTick}>
      <PageHeader title="Checkout" description="Select or fund a mandate, then confirm the real execution." />

      {!mandate || expired ? (
        <CreateMandateForm onCreated={() => setRefreshTick((t) => t + 1)} />
      ) : !funded ? (
        <FundMandateForm mandateId={mandate.mandate_id} onFunded={() => setRefreshTick((t) => t + 1)} />
      ) : (
        <ExecutePanel mandate={mandate} balance={balance} />
      )}
    </div>
  );
}
