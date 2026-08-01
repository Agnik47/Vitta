"use client";

// Creates a Price Sniper watch on one real Blinkit product.
//
// This dialog is where an unattended purchase gets authorized, so it states plainly what it will do
// rather than relying on the user remembering which mode the toggle was left in. A LIVE watch
// additionally requires ticking an acknowledgement — everywhere else in this app a real order needs
// a human present at the moment of spend, and a watch is the one thing that doesn't.
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MODE_META, useExecutionMode, type ExecutionMode } from "@/lib/execution-mode";
import { MIN_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES } from "@/lib/sniper-shared";

export interface WatchTarget {
  productId: string;
  productName: string;
  currentPriceInr?: number;
}

/** "HH:MM" resolved against `baseMs`, in the browser's own timezone — so the window means what the
 *  user's own clock says. Resolving bare HH:MM on the server instead would silently shift it by
 *  hours whenever the server's clock runs in a different zone from the person who set it. */
function resolveLocalTime(hhmm: string, baseMs: number): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseMs);
  d.setHours(h, m, 0, 0);
  return d;
}

function defaultStart(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function defaultEnd(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CreateWatchDialog({
  target,
  open,
  onOpenChange,
  onCreated,
}: {
  target: WatchTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const { mode: contextMode } = useExecutionMode();
  const [mode, setMode] = useState<ExecutionMode>(contextMode);
  const [targetPrice, setTargetPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [intervalMinutes, setIntervalMinutes] = useState(String(DEFAULT_INTERVAL_MINUTES));
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  // Read in an effect, never during render: Date.now() during render is impure and would differ
  // between the server-rendered and client-rendered pass. Re-read each time the dialog opens so a
  // long-idle tab doesn't resolve the window against a stale clock.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setNowMs(Date.now());
  }, [open]);

  const targetInr = Number(targetPrice);
  const intervalNum = Number(intervalMinutes);
  const qtyNum = Number(quantity);

  const { windowStart, windowEnd } = useMemo(() => {
    const base = nowMs ?? 0;
    const start = resolveLocalTime(startTime, base);
    let end = resolveLocalTime(endTime, base);
    // An end at or before the start means the next occurrence of that time — e.g. 23:00 to 01:00
    // crosses midnight.
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    // A window whose end has already passed means both times were earlier today, so the user meant
    // tomorrow. Same lesson as a mandate expiry that is born already expired: roll it rather than
    // hand back something that can never fire.
    if (nowMs !== null && end.getTime() <= nowMs) {
      const day = 24 * 60 * 60 * 1000;
      return { windowStart: new Date(start.getTime() + day), windowEnd: new Date(end.getTime() + day) };
    }
    return { windowStart: start, windowEnd: end };
  }, [startTime, endTime, nowMs]);

  // Only ever true before the clock has been read; the roll above guarantees a future window after.
  const windowClosed = nowMs === null;
  const validTarget = Number.isFinite(targetInr) && targetInr > 0;
  const validInterval = Number.isFinite(intervalNum) && intervalNum >= MIN_INTERVAL_MINUTES;
  const validQty = Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= 12;
  const canSubmit =
    !!target && validTarget && validInterval && validQty && !windowClosed && (mode === "TEST" || acknowledged) && !busy;

  function reset() {
    setTargetPrice("");
    setQuantity("1");
    setStartTime(defaultStart());
    setEndTime(defaultEnd());
    setIntervalMinutes(String(DEFAULT_INTERVAL_MINUTES));
    setAcknowledged(false);
    setMode(contextMode);
  }

  async function handleCreate() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shop/sniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: target.productId,
          productName: target.productName,
          targetPriceInr: targetInr,
          quantity: qtyNum,
          windowStartIso: windowStart.toISOString(),
          windowEndIso: windowEnd.toISOString(),
          intervalMs: Math.round(intervalNum * 60_000),
          mode,
          confirm: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not create the watch", { description: json.message });
        return;
      }
      toast.success("Price watch armed", {
        description: `Watching ${target.productName} for ₹${targetInr.toLocaleString("en-IN")} or less.`,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Crosshair className="size-4 text-seal" strokeWidth={2} />
            Watch this price
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              {target ? (
                <>
                  <span className="font-medium text-foreground">{target.productName}</span>
                  {target.currentPriceInr !== undefined && (
                    <> — currently ₹{target.currentPriceInr.toLocaleString("en-IN")}</>
                  )}
                </>
              ) : (
                "Select a product first."
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Buy at or below ₹</label>
              <Input
                type="number"
                min={1}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="399"
                className="mt-1.5 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Quantity</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1.5 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">From</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Until</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Check every (min)</label>
              <Input
                type="number"
                min={MIN_INTERVAL_MINUTES}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
                className="mt-1.5 rounded-lg"
              />
            </div>
          </div>

          {!validInterval && (
            <p className="text-xs text-deny">
              Each check drives a real browser and takes 20–40 seconds, so {MIN_INTERVAL_MINUTES} minute is the floor.
            </p>
          )}
          <p className="text-xs text-ink-faint">
            Window: {windowStart.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} –{" "}
            {windowEnd.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
          </p>

          <div>
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mode when it fires</div>
            <div className="mt-1.5 inline-flex rounded-full border border-border bg-background p-1">
              {(["TEST", "LIVE"] as ExecutionMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setAcknowledged(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    mode === m
                      ? m === "LIVE"
                        ? "bg-deny/15 text-deny shadow-sm"
                        : "bg-allow/15 text-allow shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span aria-hidden>{MODE_META[m].dot}</span>
                  {MODE_META[m].label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{MODE_META[mode].blurb}</p>
          </div>

          {mode === "LIVE" && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-deny/30 bg-deny/5 px-4 py-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 accent-[var(--deny)]"
              />
              <span className="text-xs text-muted-foreground">
                <TriangleAlert className="mr-1 inline size-3.5 text-deny" strokeWidth={2} />I understand this watch can
                place a <strong className="text-foreground">real Blinkit order</strong> on its own, without asking me
                again, if the price hits ₹{validTarget ? targetInr.toLocaleString("en-IN") : "…"} inside the window. My
                mandate&apos;s caps are the limit.
              </span>
            </label>
          )}

          <p className="text-xs text-ink-faint">
            It clears the cart and buys only this product. Your mandate&apos;s policy check still runs — if it denies,
            nothing is bought.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Arming…
              </>
            ) : (
              "Start watching"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
