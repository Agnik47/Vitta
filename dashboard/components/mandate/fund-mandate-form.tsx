"use client";

// Attaches an already-paid Dodo reserve to a mandate via /api/shop/mandate/fund, which spawns the
// real `gate fund` CLI. It can only ever ATTACH — completing a new Dodo checkout would mean entering
// payment details, which is not something this app does on a person's behalf, from a browser or a
// terminal. The real balance is read back from Dodo, never asserted here.
import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FundMandateForm({ mandateId, onFunded }: { mandateId: string; onFunded: () => void }) {
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
        This route can only attach an already-paid Dodo reserve (real balance read live) — it can&apos;t complete a new
        checkout from a web request, same constraint as the CLI itself.
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
