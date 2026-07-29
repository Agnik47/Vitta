"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MerchantToggle } from "@/components/concept/merchant-toggle";
import { MandatePreviewPanel, type RulePreview } from "@/components/concept/mandate-preview-panel";
import { Panel } from "@/components/shared/panel";

const MERCHANTS = ["blinkit", "zepto", "bigbasket", "district"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] tracking-wide text-ink-faint uppercase">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function RuleBuilderForm() {
  const [product, setProduct] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [merchants, setMerchants] = useState<string[]>(["blinkit"]);
  const [expiry, setExpiry] = useState("");
  const [purchaseLimit, setPurchaseLimit] = useState("1");
  const [autoBuy, setAutoBuy] = useState(false);
  const [preview, setPreview] = useState<RulePreview | null>(null);

  const maxBudgetInr = Number(maxBudget);
  const canSubmit = product.trim().length > 0 && maxBudgetInr > 0 && merchants.length > 0;

  function toggleMerchant(m: string) {
    setMerchants((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // No expiry entered → default to end of today, matching this product's
    // own same-day mandate convention (see mandate/expiry-ring.tsx). Computed
    // only on submit (a client event), so there's no SSR/hydration concern.
    const expiresAtLabel = expiry
      ? new Date(expiry).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
      : (() => {
          const eod = new Date();
          eod.setHours(18, 0, 0, 0);
          return eod.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
        })();

    setPreview({
      product: product.trim(),
      targetPriceInr: Number(targetPrice) || maxBudgetInr,
      maxBudgetInr,
      merchants,
      expiresAtLabel,
      purchaseLimit: Number(purchaseLimit) || 1,
      autoBuy,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Product">
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Chocolate Peanut Butter 1kg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Target price (₹)">
              <Input
                type="number"
                min={0}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="450"
              />
            </Field>
            <Field label="Maximum budget (₹)">
              <Input
                type="number"
                min={0}
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="500"
              />
            </Field>
          </div>

          <Field label="Allowed merchants">
            <div className="flex flex-wrap gap-1.5">
              {MERCHANTS.map((m) => (
                <MerchantToggle key={m} merchant={m} selected={merchants.includes(m)} onToggle={() => toggleMerchant(m)} />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Expires">
              <Input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
            <Field label="Purchase limit">
              <Input
                type="number"
                min={1}
                value={purchaseLimit}
                onChange={(e) => setPurchaseLimit(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Fulfilment">
            <div className="inline-flex rounded-sm border border-border p-0.5">
              <button
                type="button"
                onClick={() => setAutoBuy(false)}
                className={`rounded-[2px] px-3 py-1 text-xs font-medium transition-colors ${
                  !autoBuy ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Manual review
              </button>
              <button
                type="button"
                onClick={() => setAutoBuy(true)}
                className={`rounded-[2px] px-3 py-1 text-xs font-medium transition-colors ${
                  autoBuy ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Auto-buy
              </button>
            </div>
          </Field>

          <Button type="submit" disabled={!canSubmit} className="self-start">
            Preview mandate
          </Button>
        </form>
      </Panel>

      <div>
        {preview ? (
          <MandatePreviewPanel preview={preview} />
        ) : (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">Fill in the rule and preview it</p>
            <p className="text-xs text-ink-faint">Shows what the resulting mandate would look like — nothing is created.</p>
          </div>
        )}
      </div>
    </div>
  );
}
