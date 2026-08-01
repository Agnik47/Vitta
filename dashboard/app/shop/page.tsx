"use client";

/**
 * Search & Compare + AI Assistant — one screen, one pipeline.
 *
 * Left panel:  unchanged Search & Compare flow (LiveSearchResults, MinCartBanner, etc.)
 * Right panel: AI chat that orchestrates the existing flow via callbacks + useCart().
 *              Zero duplication — every real action goes through the same hooks/routes
 *              the manual UI already uses.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Bot, Check, CheckCircle2, Loader2,
  Plus, Search, Send, ShoppingCart, Zap,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ExecutionModeToggle } from "@/components/shop/execution-mode-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveSearchResults, type BudgetRange } from "@/components/shop/live-search-results";
import { MERCHANT_LABEL } from "@/lib/shop-catalog";
import { useCart } from "@/lib/cart-context";
import { getShopSessionId } from "@/lib/shop-session";
import type { LiveMerchant, LiveProduct } from "@/lib/live-search";
import type { Mandate } from "@/lib/types";

const ALL_MERCHANTS: LiveMerchant[] = ["blinkit", "zepto", "bigbasket"];
const BLINKIT: LiveMerchant = "blinkit";

interface ActiveSearch { query: string; budget: BudgetRange; watch: boolean; merchants: LiveMerchant[]; }
function parseBudget(raw: string): number | undefined {
  const n = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}


// ─── Shared types ─────────────────────────────────────────────────────────────

interface SearchIntent { query: string; merchants: LiveMerchant[]; quantity: number | null; }
interface SseEvent { type: string; content?: string; data?: Record<string, unknown>; }

type MsgKind =
  | { kind: "text"; role: "user" | "assistant"; content: string; timestamp: Date }
  | { kind: "searching"; query: string; merchants: LiveMerchant[] }
  | { kind: "cart_update"; productName: string; totalInr: number; shortfall: number; minInr: number }
  | { kind: "suggestions"; products: LiveProduct[]; merchant: LiveMerchant }
  | { kind: "minimum_met"; totalInr: number }
  | { kind: "proceed_prompt" }
  | { kind: "progress"; steps: ProgressStep[] };

interface ProgressStep { label: string; status: "pending" | "active" | "done" | "error"; }

// ─── Small animated sub-components used only inside the chat panel ────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

function SearchingBubble({ query, merchants }: { query: string; merchants: LiveMerchant[] }) {
  const label = merchants.length === ALL_MERCHANTS.length
    ? "all marketplaces"
    : merchants.map((m) => MERCHANT_LABEL[m]).join(", ");
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
      <span>Searching {label} for <strong>&ldquo;{query}&rdquo;</strong>…</span>
    </div>
  );
}


function CartUpdateBubble({ productName, totalInr, shortfall, minInr }: {
  productName: string; totalInr: number; shortfall: number; minInr: number;
}) {
  const met = shortfall <= 0;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1.5 text-allow font-medium">
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>{productName} added to your {MERCHANT_LABEL[BLINKIT]} cart.</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Cart total: <strong className="font-mono text-foreground">₹{totalInr.toLocaleString("en-IN")}</strong>
      </p>
      {met ? (
        <p className="text-xs text-allow font-medium">✓ Minimum order value satisfied!</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {MERCHANT_LABEL[BLINKIT]} minimum is ₹{minInr}. You need{" "}
          <strong className="text-step-up">₹{shortfall}</strong> more to proceed.
        </p>
      )}
    </div>
  );
}

function SuggestionsBubble({ products, merchant, onAdd }: {
  products: LiveProduct[]; merchant: LiveMerchant;
  onAdd: (p: LiveProduct) => Promise<void>;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function handleAdd(p: LiveProduct) {
    const key = p.productId || p.name;
    setAdding(key);
    await onAdd(p);
    setAdding(null);
    setAdded((prev) => new Set(prev).add(key));
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-xs font-medium text-foreground">
        A few items that can help reach the minimum:
      </p>
      {products.map((p) => {
        const key = p.productId || p.name;
        const isAdded = added.has(key);
        const isAdding = adding === key;
        return (
          <div key={key} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">₹{p.priceInr}</p>
            </div>
            <button
              disabled={isAdding || isAdded}
              onClick={() => void handleAdd(p)}
              className={`shrink-0 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isAdded
                  ? "bg-allow/10 text-allow border border-allow/30"
                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              }`}
            >
              {isAdding ? <Loader2 className="size-3 animate-spin" /> :
               isAdded ? <><Check className="size-3" /> Added</> :
               <><Plus className="size-3" /> Add</>}
            </button>
          </div>
        );
      })}
    </div>
  );
}


function MinMetBubble({ totalInr }: { totalInr: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-allow/30 bg-allow/10 px-3.5 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-1.5 font-semibold text-allow">
        <CheckCircle2 className="size-4 shrink-0" />
        Minimum order satisfied!
      </div>
      <p className="text-xs text-muted-foreground">
        Cart total: <strong className="font-mono text-foreground">₹{totalInr.toLocaleString("en-IN")}</strong>
      </p>
    </div>
  );
}

function ProceedPrompt({ onProceed, loading }: { onProceed: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted px-3.5 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="text-sm text-foreground font-medium">Ready to checkout?</p>
      <Button size="sm" onClick={onProceed} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
        Proceed to Purchase
      </Button>
    </div>
  );
}

function ProgressBubble({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted px-3.5 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {s.status === "done" && <CheckCircle2 className="size-3.5 shrink-0 text-allow" />}
          {s.status === "active" && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />}
          {s.status === "pending" && <span className="size-3.5 shrink-0 rounded-full border border-border" />}
          {s.status === "error" && <span className="size-3.5 shrink-0 text-deny">✗</span>}
          <span className={s.status === "done" ? "text-allow" : s.status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}


// ─── Main AI chat panel ───────────────────────────────────────────────────────

function AIChatPanel({ onSearchIntent }: { onSearchIntent: (i: SearchIntent) => void }) {
  const router = useRouter();
  const { addItem, totalInr, lines, syncing } = useCart();
  const [msgs, setMsgs] = useState<MsgKind[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [minCartInr, setMinCartInr] = useState(150);
  const [proceedLoading, setProceedLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LiveProduct[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load min cart value once
  useEffect(() => {
    fetch("/api/shop/config").then((r) => r.json())
      .then((j: { minCartInr?: number }) => { if (j.minCartInr) setMinCartInr(j.minCartInr); })
      .catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Load suggestions for min-order top-up
  useEffect(() => {
    const shortfall = minCartInr - totalInr;
    if (shortfall <= 0 || suggestions !== null) return;
    let cancelled = false;
    const queries = ["milk", "bread", "eggs", "biscuits"];
    (async () => {
      for (const q of queries) {
        try {
          const res = await fetch(`/api/shop/search?q=${encodeURIComponent(q)}&merchant=blinkit`);
          const json: { ok: boolean; results?: Array<{ ok: boolean; products: LiveProduct[] }> } = await res.json();
          const items = (json.ok ? json.results?.[0]?.products ?? [] : [])
            .filter((p) => p.available && p.priceInr > 0)
            .sort((a, b) => a.priceInr - b.priceInr)
            .slice(0, 3);
          if (items.length > 0 && !cancelled) { setSuggestions(items); return; }
        } catch { /* try next query */ }
      }
      if (!cancelled) setSuggestions([]);
    })();
    return () => { cancelled = true; };
  }, [totalInr, minCartInr, suggestions]);

  // Reset suggestions when cart moves back into range
  useEffect(() => {
    if (totalInr >= minCartInr) setSuggestions(null);
  }, [totalInr, minCartInr]);

  function pushMsg(m: MsgKind) { setMsgs((p) => [...p, m]); }

  // Add a suggestion product via the existing cart addItem — then narrate the result
  const handleAddSuggestion = useCallback(async (p: LiveProduct) => {
    const result = await addItem(p.productId, BLINKIT, {
      name: p.name, priceInr: p.priceInr, imageUrl: p.imageUrl, url: p.url,
    });
    if (!result.ok) {
      toast.error("Could not add to cart", { description: result.message });
      return;
    }
    // Re-read updated totals from context (syncing will have resolved by now)
    const newTotal = totalInr; // will re-render from context
    const shortfall = Math.max(0, minCartInr - newTotal);
    if (shortfall <= 0) {
      pushMsg({ kind: "minimum_met", totalInr: newTotal });
      pushMsg({ kind: "proceed_prompt" });
    } else {
      pushMsg({ kind: "text", role: "assistant", content: `Done. Cart total ₹${newTotal.toLocaleString("en-IN")}. You need ₹${shortfall} more.`, timestamp: new Date() });
    }
  }, [addItem, totalInr, minCartInr]);


  // Purchase flow — reuses the existing /api/shop/purchase-run route
  async function handleProceed() {
    setProceedLoading(true);
    const STEPS: ProgressStep[] = [
      { label: "Verifying cart", status: "active" },
      { label: "Mandate check", status: "pending" },
      { label: "Payment processing", status: "pending" },
      { label: "Placing order", status: "pending" },
      { label: "Generating receipt", status: "pending" },
    ];
    pushMsg({ kind: "progress", steps: [...STEPS] });

    // Animate steps while purchase job runs
    const animate = (idx: number) => {
      setMsgs((prev) => {
        const last = prev[prev.length - 1];
        if (last?.kind !== "progress") return prev;
        const steps = last.steps.map((s, i) => ({
          ...s,
          status: i < idx ? "done" : i === idx ? "active" : "pending",
        })) as ProgressStep[];
        return [...prev.slice(0, -1), { kind: "progress", steps }];
      });
    };

    try {
      const mandateRes = await fetch("/api/mandate").then((r) => r.json()).catch(() => ({ mandate: null }));
      const mandate = (mandateRes as { mandate: Mandate | null }).mandate;
      animate(1);

      const items = lines
        .filter((l) => l.merchant === BLINKIT)
        .map((l) => ({ productId: l.productId, productName: l.name, quantity: l.quantity }));

      const res = await fetch("/api/shop/purchase-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getShopSessionId(),
          merchant: BLINKIT,
          items,
          minCartInr,
          mandateId: mandate?.mandate_id,
          confirm: true,
        }),
      });
      const json: { ok: boolean; jobId?: string; message?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not start purchase", { description: json.message });
        setProceedLoading(false);
        return;
      }
      animate(2);
      // Mark all done then navigate to the real job page
      setTimeout(() => {
        setMsgs((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind !== "progress") return prev;
          return [...prev.slice(0, -1), { kind: "progress", steps: last.steps.map((s) => ({ ...s, status: "done" as const })) }];
        });
        router.push(`/shop/purchase/${json.jobId}`);
      }, 800);
    } catch (err) {
      toast.error("Purchase failed", { description: (err as Error).message });
      setProceedLoading(false);
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    pushMsg({ kind: "text", role: "user", content: text, timestamp: new Date() });
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      if (!res.ok) throw new Error("API failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const dec = new TextDecoder();
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as SseEvent;
            if (ev.type === "search_intent" && ev.data) {
              const intent: SearchIntent = {
                query: String(ev.data.query ?? ""),
                merchants: (ev.data.merchants as LiveMerchant[]) ?? ALL_MERCHANTS,
                quantity: typeof ev.data.quantity === "number" ? ev.data.quantity : null,
              };
              pushMsg({ kind: "searching", query: intent.query, merchants: intent.merchants });
              onSearchIntent(intent);
              setSuggestions(null); // reset suggestions for new search
            } else if (ev.type === "response" && ev.content) {
              reply = ev.content;
            } else if (ev.type === "error" && ev.content) {
              reply = `❌ ${ev.content}`;
            }
          } catch { /* malformed chunk */ }
        }
      }
      if (reply) pushMsg({ kind: "text", role: "assistant", content: reply, timestamp: new Date() });
    } catch {
      pushMsg({ kind: "text", role: "assistant", content: "❌ Something went wrong. Please try again.", timestamp: new Date() });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, onSearchIntent]);


  // When the cart changes after a product add, narrate it in the chat
  const prevTotal = useRef(totalInr);
  const prevCount = useRef(lines.length);
  useEffect(() => {
    if (syncing) return;
    const countChanged = lines.length !== prevCount.current;
    const totalChanged = totalInr !== prevTotal.current;
    if (!countChanged && !totalChanged) return;
    // Only narrate if there are actual items (not just a cart clear)
    if (lines.length > 0 && totalChanged) {
      const newest = lines[lines.length - 1];
      const shortfall = Math.max(0, minCartInr - totalInr);
      pushMsg({ kind: "cart_update", productName: newest.name, totalInr, shortfall, minInr: minCartInr });
      if (shortfall <= 0) {
        pushMsg({ kind: "minimum_met", totalInr });
        pushMsg({ kind: "proceed_prompt" });
      } else if (suggestions !== null && suggestions.length > 0) {
        pushMsg({ kind: "suggestions", products: suggestions, merchant: BLINKIT });
      }
    }
    prevTotal.current = totalInr;
    prevCount.current = lines.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalInr, lines.length, syncing]);

  const STARTERS = [
    "Buy paneer from Blinkit",
    "Get me Amul butter",
    "I need 2 packets of Maggi",
    "Find milk on Zepto",
  ];

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 border-b border-border px-4 py-3 shrink-0 bg-surface-sunken">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <Bot className="size-4 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">AI Shopping Assistant</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Just ask — I&apos;ll shop for you</p>
          </div>
        </div>
        {/* Live cart badge */}
        {lines.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-all">
            <ShoppingCart className="size-3" />
            ₹{totalInr.toLocaleString("en-IN")}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.length === 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-muted-foreground mb-1">Try asking:</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => setInput(s)}
                className="w-full text-left rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                💡 {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => {
          if (m.kind === "text") return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed animate-in fade-in duration-200 ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`text-[10px] mt-1.5 ${m.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
          if (m.kind === "searching") return <SearchingBubble key={i} query={m.query} merchants={m.merchants} />;
          if (m.kind === "cart_update") return <CartUpdateBubble key={i} productName={m.productName} totalInr={m.totalInr} shortfall={m.shortfall} minInr={m.minInr} />;
          if (m.kind === "suggestions") return <SuggestionsBubble key={i} products={m.products} merchant={m.merchant} onAdd={handleAddSuggestion} />;
          if (m.kind === "minimum_met") return <MinMetBubble key={i} totalInr={m.totalInr} />;
          if (m.kind === "proceed_prompt") return <ProceedPrompt key={i} onProceed={() => void handleProceed()} loading={proceedLoading} />;
          if (m.kind === "progress") return <ProgressBubble key={i} steps={m.steps} />;
          return null;
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted border border-border rounded-xl px-3.5 py-2.5">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-3 shrink-0">
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            placeholder="Buy paneer from Blinkit…" disabled={isLoading} className="flex-1 text-sm" />
          <Button size="sm" onClick={() => void handleSend()} disabled={isLoading || !input.trim()} className="shrink-0 px-3">
            <Send className="size-3.5" strokeWidth={2} />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


export default function ShopPage() {
  const [queryInput, setQueryInput] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [watchInput, setWatchInput] = useState(false);
  const [merchantsInput, setMerchantsInput] = useState<LiveMerchant[]>(ALL_MERCHANTS);
  const [active, setActive] = useState<ActiveSearch | null>(null);

  const minInr = parseBudget(minInput);
  const maxInr = parseBudget(maxInput);
  const rangeInverted = minInr !== undefined && maxInr !== undefined && minInr > maxInr;
  const noMerchantsSelected = merchantsInput.length === 0;

  function toggleMerchant(merchant: LiveMerchant) {
    setMerchantsInput((prev) =>
      prev.includes(merchant) ? prev.filter((m) => m !== merchant) : [...prev, merchant]
    );
  }

  function handleSearch() {
    const q = queryInput.trim();
    if (!q || rangeInverted || noMerchantsSelected) return;
    setActive({ query: q, budget: { minInr, maxInr }, watch: watchInput, merchants: merchantsInput });
  }

  const handleSearchIntent = useCallback((intent: SearchIntent) => {
    setQueryInput(intent.query);
    const m = intent.merchants.length ? intent.merchants : ALL_MERCHANTS;
    setMerchantsInput(m);
    setActive({ 
      query: intent.query, 
      budget: { minInr, maxInr }, 
      watch: watchInput, 
      merchants: m
    });
  }, [minInr, maxInr, watchInput]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col md:flex-row md:overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <PageHeader
          title="Search & compare"
          description="Search a product for real, live results across every marketplace this project has a real integration with."
        />

        <div className="mb-5 flex items-center gap-2.5 border border-border bg-card px-4 py-2.5">
          <Zap className="size-3.5 shrink-0 text-allow" strokeWidth={2} />
          <p className="text-xs text-muted-foreground">
            Every card is a real listing fetched live from that marketplace — no mock data, and prices
            are never merged or estimated across merchants. A merchant that returns nothing or errors
            says so honestly rather than showing a placeholder.
          </p>
        </div>

        <div className="mb-5 border border-border bg-card px-4 py-3">
          <ExecutionModeToggle />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="mb-6 flex flex-col gap-3"
        >
          <div className="flex max-w-lg items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search atta, biscuits, cookies…"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={!queryInput.trim() || rangeInverted || noMerchantsSelected}>
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Min ₹</label>
              <Input
                type="number"
                min={1}
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="any"
                className="mt-1.5"
              />
            </div>
            <div className="w-32">
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Max ₹</label>
              <Input
                type="number"
                min={1}
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="any"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-wide text-ink-faint uppercase">Marketplaces</label>
              <div className="mt-1.5 flex items-center gap-3">
                {ALL_MERCHANTS.map((merchant) => (
                  <label key={merchant} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={merchantsInput.includes(merchant)}
                      onChange={() => toggleMerchant(merchant)}
                      className="size-3.5 accent-[var(--seal)]"
                    />
                    {MERCHANT_LABEL[merchant]}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={watchInput}
                onChange={(e) => setWatchInput(e.target.checked)}
                className="size-3.5 accent-[var(--seal)]"
              />
              Keep watching for a match
            </label>
          </div>

          {rangeInverted && (
            <p className="text-xs text-deny">Min ₹ is above Max ₹ — nothing could ever match that range.</p>
          )}
          {noMerchantsSelected && (
            <p className="text-xs text-deny">Select at least one marketplace to search.</p>
          )}

          <p className="max-w-2xl text-xs text-ink-faint">
            The budget range filters real results only — it never invents a match. &ldquo;Keep watching&rdquo;
            re-checks these marketplaces on an interval while this page stays open and surfaces anything that
            comes into range; it never buys on its own, since every purchase in this project needs your
            explicit confirmation first.
          </p>
        </form>

        {active ? (
          <LiveSearchResults
            key={`${active.query}|${active.budget.minInr ?? ""}|${active.budget.maxInr ?? ""}|${active.merchants.join(",")}`}
            query={active.query}
            budget={active.budget}
            watch={active.watch}
            merchants={active.merchants}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-6 py-20 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shop_empty_state.jpg"
              alt="Search empty state"
              className="w-48 h-48 rounded-xl object-cover shadow-sm opacity-90 grayscale-[0.2]"
            />
            <div className="max-w-[280px]">
              <h3 className="font-heading text-lg font-semibold text-foreground">
                What are you looking for?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Search for any grocery item to compare live prices across Zepto, Blinkit, and BigBasket.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="w-full shrink-0 border-t border-border bg-background md:w-[380px] lg:w-[420px] md:border-t-0 md:border-l p-4">
        <AIChatPanel onSearchIntent={handleSearchIntent} />
      </div>
    </div>
  );
}
