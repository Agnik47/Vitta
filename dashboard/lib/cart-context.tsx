"use client";

// Client-side cart state for the /shop flow (ADR-015). Persisted to localStorage so it survives
// navigation between /shop -> /shop/cart -> /shop/checkout. Adding a real (Blinkit) item also
// triggers a real webcmd add-to-cart via /api/shop/cart-add — see CartProvider's addItem.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { findProduct, type ShopMerchant } from "@/lib/shop-catalog";

/** A real snapshot taken at add-time from a live search result — not a catalog entry, since live
 * results (name/price/image) can't be pre-enumerated the way the static mock catalog is. */
export interface LiveSnapshot {
  name: string;
  priceInr: number;
  imageUrl?: string;
  url?: string;
}

export interface CartLine {
  productId: string;
  merchant: ShopMerchant;
  quantity: number;
  /** Present only for items added from live search — see LiveSnapshot. */
  live?: LiveSnapshot;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (
    productId: string,
    merchant: ShopMerchant,
    live?: LiveSnapshot
  ) => Promise<{ ok: boolean; message?: string }>;
  removeItem: (productId: string, merchant: ShopMerchant) => void;
  setQuantity: (productId: string, merchant: ShopMerchant, quantity: number) => void;
  clear: () => void;
  totalInr: number;
  hasRealItems: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "vitta-shop-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Deferred to an effect (not a lazy useState initializer) so SSR and first client render
    // match — localStorage doesn't exist during SSR. Same pattern as theme-provider.tsx.
    let restored: CartLine[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch {
      // Corrupt/unavailable storage — start with an empty cart rather than crash.
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restored) setLines(restored);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const addItem = useCallback(async (productId: string, merchant: ShopMerchant, live?: LiveSnapshot) => {
    // Live search results (blinkit/zepto/bigbasket) are always real by construction — they were
    // just fetched from webcmd this request, not a static illustrative catalog entry — so they
    // always go through the real add-to-cart route, same "gated, but nothing committed until
    // checkout" pattern the CLI itself follows.
    if (live) {
      try {
        const res = await fetch("/api/shop/cart-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, merchant, quantity: 1 }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          return { ok: false, message: json.message ?? "Real add-to-cart failed" };
        }
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }

      setLines((prev) => {
        const existing = prev.find((l) => l.productId === productId && l.merchant === merchant);
        if (existing) {
          return prev.map((l) =>
            l.productId === productId && l.merchant === merchant ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
        return [...prev, { productId, merchant, quantity: 1, live }];
      });

      return { ok: true };
    }

    const product = findProduct(productId);
    const offer = product?.offers.find((o) => o.merchant === merchant);

    // Real Blinkit items from the static mock catalog: actually call webcmd add-to-cart for real
    // (₹0 cost until checkout). Non-Blinkit or non-real offers just update local UI state — clearly
    // a concept-only add.
    if (offer?.real && offer.productId) {
      try {
        const res = await fetch("/api/shop/cart-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: offer.productId }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          return { ok: false, message: json.message ?? "Real add-to-cart failed" };
        }
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    }

    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId && l.merchant === merchant);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId && l.merchant === merchant ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { productId, merchant, quantity: 1 }];
    });

    return { ok: true };
  }, []);

  const removeItem = useCallback((productId: string, merchant: ShopMerchant) => {
    setLines((prev) => prev.filter((l) => !(l.productId === productId && l.merchant === merchant)));
  }, []);

  const setQuantity = useCallback((productId: string, merchant: ShopMerchant, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId && l.merchant === merchant ? { ...l, quantity } : l))
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalInr = lines.reduce((sum, line) => {
    if (line.live) return sum + line.live.priceInr * line.quantity;
    const product = findProduct(line.productId);
    const offer = product?.offers.find((o) => o.merchant === line.merchant);
    if (!offer) return sum;
    return sum + (offer.priceInr + offer.deliveryFeeInr) * line.quantity;
  }, 0);

  const hasRealItems = lines.some((line) => {
    if (line.live) return true; // every live-search merchant is real by construction
    const product = findProduct(line.productId);
    return product?.offers.find((o) => o.merchant === line.merchant)?.real;
  });

  return (
    <CartContext.Provider value={{ lines, addItem, removeItem, setQuantity, clear, totalInr, hasRealItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
