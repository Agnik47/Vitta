"use client";

// Price Sniper: every watch this server holds, live.
//
// A watch that has fired links straight to its purchase job rather than re-rendering progress here —
// /shop/purchase/[jobId] already tells that story properly, and a second, subtly different version
// of it would be worse than none.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Crosshair, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ExecutionModeBadge } from "@/components/shop/execution-mode-toggle";
import { WATCH_STATUS_LABEL, isWatchTerminal, type SniperWatch, type SniperWatchStatus } from "@/lib/sniper-shared";

const POLL_MS = 5000;

const STATUS_TONE: Record<SniperWatchStatus, string> = {
  SCHEDULED: "border-border bg-surface-sunken text-muted-foreground",
  WATCHING: "border-seal/40 bg-seal/10 text-seal",
  FIRED: "border-allow/40 bg-allow/10 text-allow",
  EXPIRED: "border-border bg-surface-sunken text-muted-foreground",
  CANCELLED: "border-border bg-surface-sunken text-muted-foreground",
  FAILED: "border-deny/40 bg-deny/10 text-deny",
};

function timeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

function WatchCard({ watch, onChanged }: { watch: SniperWatch; onChanged: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const lastCheck = watch.checks[watch.checks.length - 1];

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/shop/sniper/${watch.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not cancel the watch", { description: json.message });
        return;
      }
      toast.success("Watch cancelled");
      onChanged();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{watch.productName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Buy at or below{" "}
            <strong className="font-mono text-foreground">₹{watch.targetPriceInr.toLocaleString("en-IN")}</strong>
            {watch.quantity > 1 && ` · ×${watch.quantity}`} · {timeRange(watch.windowStartIso, watch.windowEndIso)} ·
            every {Math.round(watch.intervalMs / 60_000)} min
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExecutionModeBadge mode={watch.mode} />
          <span className={`border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[watch.status]}`}>
            {WATCH_STATUS_LABEL[watch.status]}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-border border border-border">
        <div className="px-3 py-2">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Last seen</div>
          <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
            {watch.lastSeenPriceInr !== undefined ? `₹${watch.lastSeenPriceInr.toLocaleString("en-IN")}` : "—"}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Checks</div>
          <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{watch.checks.length}</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Target</div>
          <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
            ₹{watch.targetPriceInr.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {lastCheck && (
        <p className="mt-2 truncate text-xs text-muted-foreground" title={lastCheck.note}>
          {lastCheck.note}
        </p>
      )}
      {watch.failureReason && <p className="mt-2 text-xs text-deny">{watch.failureReason}</p>}

      <div className="mt-3 flex items-center gap-2">
        {watch.firedJobId && (
          <Link
            href={`/shop/purchase/${watch.firedJobId}`}
            className="flex items-center gap-1 border border-border px-2.5 py-1.5 text-xs text-seal transition-colors hover:bg-accent"
          >
            View the purchase
            <ExternalLink className="size-3" strokeWidth={1.75} />
          </Link>
        )}
        {!isWatchTerminal(watch.status) && (
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SniperPage() {
  const [watches, setWatches] = useState<SniperWatch[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/sniper");
      const json = await res.json();
      if (json.ok) setWatches(json.watches as SniperWatch[]);
    } catch {
      // Transient — the next poll will pick it up rather than blanking the list.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const active = watches?.filter((w) => !isWatchTerminal(w.status)) ?? [];
  const past = watches?.filter((w) => isWatchTerminal(w.status)) ?? [];

  return (
    <div>
      <PageHeader
        title="Price sniper"
        description="Watch one real Blinkit product during a time window. The first time it hits your target price, the full purchase pipeline runs on its own — mandate check included."
      />

      <div className="mb-5 flex items-start gap-2.5 border border-border bg-card px-4 py-2.5">
        <Crosshair className="mt-0.5 size-3.5 shrink-0 text-seal" strokeWidth={2} />
        <p className="text-xs text-muted-foreground">
          Start a watch from any Blinkit result on{" "}
          <Link href="/shop" className="text-seal underline underline-offset-2">
            Search &amp; compare
          </Link>
          . Each check reads the real live price by driving a browser, which is why the interval floor is one minute.
        </p>
      </div>

      {watches === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} /> Loading watches…
        </div>
      ) : watches.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title="No price watches yet"
          hint="Search for a Blinkit product and choose Watch price to set a target and a time window."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {active.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[10px] tracking-widest text-ink-faint uppercase">Active</h2>
              {active.map((w) => (
                <WatchCard key={w.id} watch={w} onChanged={load} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[10px] tracking-widest text-ink-faint uppercase">Finished</h2>
              {past.map((w) => (
                <WatchCard key={w.id} watch={w} onChanged={load} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
