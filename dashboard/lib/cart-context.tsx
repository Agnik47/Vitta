"use client";

// Cart state for the /shop flow — a MIRROR of the merchant's real cart, never an independent copy.
//
// WHAT CHANGED AND WHY (2026-08-01)
// ----------------------------------
// This used to hold its own quantities in sessionStorage and merely fire a real add-to-cart
// alongside them. The two drifted apart immediately and permanently: Blinkit's add-to-cart is
// ADDITIVE (so every click/retry multiplied the real quantity while the local copy incremented once)
// and Blinkit had no remove/clear command at all (so the real cart could only grow, and previous
// sessions' items were invisible and unremovable). Observed live: dashboard ₹165 vs real cart ₹330;
// a human-approved ₹160/4-item purchase was really ₹354/10 items.
//
// Now: every mutation goes to /api/shop/cart-sync, which reads the real cart, computes the delta,
// writes an ABSOLUTE quantity, re-reads, verifies, and returns the real cart. This provider stores
// whatever that returns, and nothing else. There is no local quantity arithmetic anywhere in this
// file — if a number is shown to the user, the merchant said it.
//
// The one thing kept locally is a presentation cache of product images, because Blinkit's `cart`
// command doesn't return an image URL (not in its columns schema). An image never affects a total,
// a quantity, or a decision.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ShopMerchant } from "@/lib/shop-catalog";

/** A real snapshot taken at add-time from a live search result. Presentation only — see header. */
export interface LiveSnapshot {
  name: string;
  priceInr: number;
  imageUrl?: string;
  url?: string;
}

/** One line of the REAL merchant cart. Every field here came from the merchant. */
export interface CartLine {
  productId: string;
  merchant: ShopMerchant;
  quantity: number;
  name: string;
  variant: string;
  priceInr: number;
  lineTotalInr: number;
  /** Merged in from the local image cache — cosmetic only. */
  imageUrl?: string;
}

type MutationResult = { ok: boolean; message?: string };

interface CartContextValue {
  lines: CartLine[];
  /** The merchant's own resolved total — the same figure decide() is handed at commit time. */
  totalInr: number;
  itemCount: number;
  /** True while a real merchant round-trip is in flight (each is a real browser action, ~15-40s). */
  syncing: boolean;
  /** Set when the last real cart read/write failed — the UI must surface this rather than showing
   *  a stale number as if it were current. */
  error: string | null;
  /** Adds one of this product on top of whatever the merchant really holds. */
  addItem: (productId: string, merchant: ShopMerchant, live?: LiveSnapshot) => Promise<MutationResult>;
  /** Sets this product to an exact quantity (0 removes it). */
  setQuantity: (productId: string, merchant: ShopMerchant, quantity: number) => Promise<MutationResult>;
  removeItem: (productId: string, merchant: ShopMerchant) => Promise<MutationResult>;
  clear: () => Promise<MutationResult>;
  /** Re-reads the real cart. Cheap to call — it is the same read every mutation ends with. */
  refresh: () => Promise<void>;
  hasRealItems: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

// Only the cosmetic image cache is persisted. Quantities deliberately are NOT — persisting them is
// what allowed a stale local cart to outlive the real one and be mistaken for it.
const IMAGE_CACHE_KEY = "vitta-shop-image-cache";

/** The merchant whose real cart this dashboard mirrors. Blinkit is the one merchant with the
 *  absolute cart-quantity + clear-cart adapters this synchronization requires (see
 *  webcmd-adapters/blinkit/). The others remain search-and-compare until they have the same. */
const SYNCED_MERCHANT: ShopMerchant = "blinkit";

interface RealCartResponse {
  ok: boolean;
  message?: string;
  lines?: Array<{
    productId: string;
    name: string;
    variant: string;
    priceInr: number;
    quantity: number;
    lineTotalInr: number;
  }>;
  totalInr?: number;
  itemCount?: number;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [totalInr, setTotalInr] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref, not state: it's a lookup table consulted while rendering merchant data, and
  // making it state would re-trigger the effects that write to it.
  const imageCache = useRef<Record<string, LiveSnapshot>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(IMAGE_CACHE_KEY);
      if (raw) imageCache.current = JSON.parse(raw);
    } catch {
      // Corrupt/unavailable storage — images just won't render. Never fatal.
    }
  }, []);

  function rememberImage(productId: string, live?: LiveSnapshot) {
    if (!live || !productId) return;
    imageCache.current[productId] = live;
    try {
      sessionStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache.current));
    } catch {
      // Ignore — cosmetic only.
    }
  }

  /** Replaces all local state with the real cart from a cart-sync response. This is the ONLY place
   *  `lines`/`totalInr`/`itemCount` are ever written, which is what guarantees the mirror property:
   *  there is no code path that can set a quantity the merchant didn't report. */
  const applyRealCart = useCallback((data: RealCartResponse) => {
    const realLines = (data.lines ?? []).map((l) => ({
      productId: l.productId,
      merchant: SYNCED_MERCHANT,
      quantity: l.quantity,
      name: l.name,
      variant: l.variant,
      priceInr: l.priceInr,
      lineTotalInr: l.lineTotalInr,
      imageUrl: imageCache.current[l.productId]?.imageUrl,
    }));
    setLines(realLines);
    setTotalInr(data.totalInr ?? 0);
    setItemCount(data.itemCount ?? realLines.reduce((sum, l) => sum + l.quantity, 0));
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/shop/cart-sync?merchant=${SYNCED_MERCHANT}`);
      const json = (await res.json()) as RealCartResponse;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not read the real cart");
        return;
      }
      setError(null);
      applyRealCart(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [applyRealCart]);

  // Load the real cart once on mount, so the dashboard opens showing what the merchant actually
  // holds — including anything left over from a previous session, which the old local model simply
  // could not see.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** The one write path. Reads/writes/verifies happen server-side; this just stores the verified
   *  result and reports whether it worked. */
  const mutate = useCallback(
    async (body: Record<string, unknown>): Promise<MutationResult> => {
      setSyncing(true);
      try {
        const res = await fetch("/api/shop/cart-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as RealCartResponse & { cart?: RealCartResponse };
        if (!res.ok || !json.ok) {
          // A failed write still tells us something true about the cart when it could be read —
          // show that rather than leaving a stale number on screen.
          if (json.cart) applyRealCart(json.cart);
          const message = json.message ?? "Cart update failed";
          setError(message);
          return { ok: false, message };
        }
        setError(null);
        applyRealCart(json);
        return { ok: true };
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        return { ok: false, message };
      } finally {
        setSyncing(false);
      }
    },
    [applyRealCart]
  );

  const addItem = useCallback(
    async (productId: string, merchant: ShopMerchant, live?: LiveSnapshot): Promise<MutationResult> => {
      if (merchant !== SYNCED_MERCHANT) {
        return {
          ok: false,
          message: `Only ${SYNCED_MERCHANT} carts are synchronized right now — ${merchant} is search-and-compare only.`,
        };
      }
      rememberImage(productId, live);
      // "Add one" means "one more than the merchant currently holds". The desired absolute quantity
      // is computed from the REAL cart we last mirrored, and the server re-reads before writing
      // anyway — so a stale local view can't cause an over-add the way blind additive adds did.
      const current = lines.find((l) => l.productId === productId)?.quantity ?? 0;
      return mutate({ merchant, productId, url: live?.url, quantity: current + 1 });
    },
    [lines, mutate]
  );

  const setQuantity = useCallback(
    async (productId: string, merchant: ShopMerchant, quantity: number): Promise<MutationResult> => {
      if (merchant !== SYNCED_MERCHANT) {
        return { ok: false, message: `Only ${SYNCED_MERCHANT} carts are synchronized right now.` };
      }
      return mutate({ merchant, productId, quantity });
    },
    [mutate]
  );

  const removeItem = useCallback(
    async (productId: string, merchant: ShopMerchant): Promise<MutationResult> => {
      if (merchant !== SYNCED_MERCHANT) {
        return { ok: false, message: `Only ${SYNCED_MERCHANT} carts are synchronized right now.` };
      }
      return mutate({ merchant, productId, quantity: 0 });
    },
    [mutate]
  );

  const clear = useCallback(async (): Promise<MutationResult> => {
    return mutate({ merchant: SYNCED_MERCHANT, clear: true });
  }, [mutate]);

  // Every line in this cart came from a real merchant read, so any line at all is a real item.
  const hasRealItems = lines.length > 0;

  return (
    <CartContext.Provider
      value={{
        lines,
        totalInr,
        itemCount,
        syncing,
        error,
        addItem,
        setQuantity,
        removeItem,
        clear,
        refresh,
        hasRealItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
