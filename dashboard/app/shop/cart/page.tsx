"use client";

// The cart page renders the REAL Blinkit cart and nothing else.
//
// This page used to reconcile two carts: a local sessionStorage model (what this tab clicked) and
// the real merchant cart, complete with a mismatch warning explaining that the two disagreed. That
// whole reconciliation layer is gone, because the divergence it managed no longer exists — every
// quantity shown here comes from a real merchant read (lib/cart-context.tsx -> /api/shop/cart-sync).
// There is no local estimate to disagree with the truth anymore.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, Minus, Plus, RefreshCw, ShieldCheck, ShoppingCart, Trash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/shared/empty-state";
import { MinCartBanner } from "@/components/shop/min-cart-banner";
import { useCart } from "@/lib/cart-context";
import { useExecutionMode, MODE_META } from "@/lib/execution-mode";
import { ExecutionModeToggle } from "@/components/shop/execution-mode-toggle";
import { MERCHANT_LABEL } from "@/lib/shop-catalog";
import { getShopSessionId } from "@/lib/shop-session";
import type { Mandate } from "@/lib/types";

/** The merchant this cart mirrors — see cart-context's SYNCED_MERCHANT for why it's Blinkit only. */
const MERCHANT = "blinkit" as const;

export default function CartPage() {
  const router = useRouter();
  const { lines, totalInr, itemCount, syncing, error, setQuantity, removeItem, clear, refresh } = useCart();
  const { mode } = useExecutionMode();
  const [starting, setStarting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [minCartInr, setMinCartInr] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/config")
      .then((r) => r.json())
      .then((json: { minCartInr?: number }) => {
        if (!cancelled && typeof json.minCartInr === "number") setMinCartInr(json.minCartInr);
      })
      .catch(() => {
        // Non-fatal — Proceed just isn't gated on a minimum until this resolves.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Gating on the real, verified total is now simply gating on `totalInr` — it IS the real cart's
  // number, resolved by the gate's own resolver, i.e. the same figure decide() is handed at commit
  // time. No local estimate, no divergence, nothing to reconcile.
  const meetsMinimum = minCartInr === null || totalInr >= minCartInr;
  const canProceed = lines.length > 0 && meetsMinimum && !syncing;

  async function handleQuantity(productId: string, quantity: number) {
    const result = await setQuantity(productId, MERCHANT, quantity);
    if (!result.ok) toast.error("Could not update the real cart", { description: result.message });
  }

  async function handleRemove(productId: string) {
    const result = await removeItem(productId, MERCHANT);
    if (!result.ok) toast.error("Could not remove from the real cart", { description: result.message });
  }

  async function handleClear() {
    setClearing(true);
    const result = await clear();
    setClearing(false);
    if (!result.ok) {
      toast.error("Could not clear the real cart", { description: result.message });
    } else {
      toast.success("Real Blinkit cart cleared");
    }
  }

  async function handleProceed() {
    setStarting(true);
    try {
      const mandateRes = await fetch("/api/mandate").then((r) => r.json()).catch(() => ({ mandate: null }));
      const mandate = (mandateRes as { mandate: Mandate | null }).mandate;

      // The items sent are exactly the real cart's current lines — the same quantities the human is
      // looking at, because they were read back from the merchant.
      const items = lines.map((l) => ({
        productId: l.productId,
        productName: l.name,
        quantity: l.quantity,
      }));

      const res = await fetch("/api/shop/purchase-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getShopSessionId(),
          merchant: MERCHANT,
          items,
          minCartInr,
          mandateId: mandate?.mandate_id,
          confirm: true,
          mode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not start the purchase", { description: json.message });
        return;
      }
      router.push(`/shop/purchase/${json.jobId}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Cart"
        description={`Your real ${MERCHANT_LABEL[MERCHANT]} cart, read live. Every quantity and total here comes from ${MERCHANT_LABEL[MERCHANT]} itself.`}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-deny/30 bg-deny/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-deny" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {lines.length === 0 && !syncing ? (
        <EmptyState
          icon={ShoppingCart}
          title={`Your real ${MERCHANT_LABEL[MERCHANT]} cart is empty`}
          hint="Search for a product and add it — it goes straight into your real cart."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {lines.map((line) => (
              <div
                key={line.productId}
                className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 transition-colors first:border-t-0 hover:bg-muted/20"
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-medium text-foreground">{line.name}</span>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {MERCHANT_LABEL[MERCHANT]} · ₹{line.priceInr.toLocaleString("en-IN")} each
                    {line.variant ? ` · ${line.variant}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
                  <button
                    onClick={() => handleQuantity(line.productId, line.quantity - 1)}
                    disabled={syncing}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3" strokeWidth={2} />
                  </button>
                  <span className="w-7 text-center font-mono text-sm tabular-nums">{line.quantity}</span>
                  <button
                    onClick={() => handleQuantity(line.productId, Math.min(12, line.quantity + 1))}
                    disabled={syncing || line.quantity >= 12}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3" strokeWidth={2} />
                  </button>
                </div>

                <div className="w-20 shrink-0 text-right font-heading text-[15px] font-bold tabular-nums text-foreground">
                  ₹{line.lineTotalInr.toLocaleString("en-IN")}
                </div>

                <button
                  onClick={() => handleRemove(line.productId)}
                  disabled={syncing}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-deny/10 hover:text-deny disabled:opacity-40"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              {syncing ? (
                <>
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" strokeWidth={2} />
                  <span className="text-muted-foreground">
                    Syncing with the real {MERCHANT_LABEL[MERCHANT]} cart — this is a real browser action and takes a few seconds…
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5 shrink-0 text-allow" strokeWidth={2} />
                  <span className="text-foreground">
                    Verified real {MERCHANT_LABEL[MERCHANT]} cart:{" "}
                    <strong className="font-mono">₹{totalInr.toLocaleString("en-IN")}</strong> · {itemCount} item(s)
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => void refresh()}
              disabled={syncing}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-ink-faint transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} strokeWidth={2} />
              Refresh
            </button>
          </div>

          <MinCartBanner
            merchant={MERCHANT}
            cartTotalInr={totalInr}
            onContinueShopping={() => router.push("/shop")}
            onItemAdded={() => void refresh()}
          />

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <ExecutionModeToggle />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Cart total
                </div>
                <div className="mt-0.5 font-heading text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  ₹{totalInr.toLocaleString("en-IN")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Clear cart — confirmation required, this wipes the real Blinkit cart */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={syncing || clearing || lines.length === 0}
                      className="rounded-lg text-deny border-deny/40 hover:bg-deny/5 hover:text-deny"
                    >
                      {clearing ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Clearing…
                        </>
                      ) : (
                        <>
                          <Trash className="size-4" />
                          Clear cart
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-deny" strokeWidth={2} />
                        Clear the real {MERCHANT_LABEL[MERCHANT]} cart?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes every item from your real {MERCHANT_LABEL[MERCHANT]} cart right now. No money
                        moves — it only empties the cart so you can start fresh. This cannot be undone from here.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClear}
                        className="bg-deny text-white hover:bg-deny/90"
                      >
                        Yes, clear the cart
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" className="rounded-lg px-6" disabled={!canProceed || starting}>
                    {starting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      <>
                        Proceed to purchase
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle
                        className={`size-4 ${mode === "LIVE" ? "text-deny" : "text-step-up"}`}
                        strokeWidth={2}
                      />
                      {mode === "LIVE" ? "This places a real order" : "This draws from your test reserve"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      <span className="mb-2 block">
                        Running in <strong className="text-foreground">{MODE_META[mode].dot} {MODE_META[mode].label}</strong>.
                      </span>
                      This adds your real {MERCHANT_LABEL[MERCHANT]} cart —{" "}
                      <strong className="font-mono text-foreground">₹{totalInr.toLocaleString("en-IN")}</strong> across{" "}
                      {itemCount} item(s), exactly as listed above — verifies it, and runs your mandate&apos;s real
                      policy check.{" "}
                      {mode === "LIVE" ? (
                        <>
                          If it passes, {MERCHANT_LABEL[MERCHANT]}&apos;s real checkout is driven to a{" "}
                          <strong className="text-foreground">real placed order</strong> and your Prava reserve is
                          drawn.
                        </>
                      ) : (
                        <>
                          If it passes, it settles against your real Prava <strong className="text-foreground">test
                          reserve</strong> and signs a receipt marked TEST.{" "}
                          <strong className="text-foreground">No {MERCHANT_LABEL[MERCHANT]} order is placed.</strong>
                        </>
                      )}{" "}
                      It runs to completion with no further confirmation from you. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleProceed}>
                      {mode === "LIVE" ? "Yes, place a real order" : "Yes, run in test mode"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
