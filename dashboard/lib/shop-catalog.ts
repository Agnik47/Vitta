// Mock shopping catalog for the /shop flow (ADR-015). Search/compare data is illustrative for
// Zepto/BigBasket/District — no live scraping/integration exists for those merchants, and building
// one is an explicit non-goal (docs/common/09-HACKATHON-WOW-PLAN.md § Explicit non-goals). Blinkit
// entries marked `real: true` carry a `productId` that was verified against the live webcmd/Blinkit
// catalog this session (real search, real add-to-cart) — only those can actually execute for real
// through /api/shop/execute. Everything else is clearly labeled "Concept" wherever it's rendered.

export type ShopMerchant = "blinkit" | "zepto" | "bigbasket" | "district";

export interface MerchantOffer {
  merchant: ShopMerchant;
  priceInr: number;
  deliveryFeeInr: number;
  etaMinutes: number;
  inStock: boolean;
  /** Only ever true for Blinkit — the one merchant with a real, tested webcmd integration. */
  real: boolean;
  /** Real webcmd product id — present only when `real` is true. */
  productId?: string;
}

export interface ShopProduct {
  id: string;
  name: string;
  brand: string;
  variant: string;
  category: string;
  offers: MerchantOffer[];
}

export const CATALOG: ShopProduct[] = [
  {
    id: "atta-aashirvaad-superior-5kg",
    name: "Aashirvaad Superior MP Chakki Atta",
    brand: "Aashirvaad",
    variant: "5 kg",
    category: "Atta & Flours",
    offers: [
      { merchant: "blinkit", priceInr: 310, deliveryFeeInr: 0, etaMinutes: 12, inStock: true, real: true, productId: "344107" },
      { merchant: "zepto", priceInr: 325, deliveryFeeInr: 15, etaMinutes: 10, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 299, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 305, deliveryFeeInr: 0, etaMinutes: 45, inStock: true, real: false },
    ],
  },
  {
    id: "atta-aashirvaad-multigrain-5kg",
    name: "Aashirvaad High Fibre Atta with Multigrains",
    brand: "Aashirvaad",
    variant: "5 kg",
    category: "Atta & Flours",
    offers: [
      { merchant: "blinkit", priceInr: 350, deliveryFeeInr: 0, etaMinutes: 12, inStock: true, real: false },
      { merchant: "zepto", priceInr: 362, deliveryFeeInr: 15, etaMinutes: 11, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 340, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 355, deliveryFeeInr: 0, etaMinutes: 40, inStock: true, real: false },
    ],
  },
  {
    id: "biscuit-nutrichoice-5grain",
    name: "Britannia NutriChoice 5 Grain Digestive Biscuit",
    brand: "Britannia",
    variant: "250 g",
    category: "Biscuits & Cookies",
    offers: [
      { merchant: "blinkit", priceInr: 59, deliveryFeeInr: 0, etaMinutes: 10, inStock: true, real: true, productId: "18371" },
      { merchant: "zepto", priceInr: 62, deliveryFeeInr: 15, etaMinutes: 9, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 55, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 58, deliveryFeeInr: 0, etaMinutes: 35, inStock: true, real: false },
    ],
  },
  {
    id: "biscuit-dark-fantasy-bourbon",
    name: "Sunfeast Dark Fantasy Bourbon Biscuits",
    brand: "Sunfeast",
    variant: "150 g",
    category: "Biscuits & Cookies",
    offers: [
      { merchant: "blinkit", priceInr: 15, deliveryFeeInr: 0, etaMinutes: 10, inStock: true, real: true, productId: "206572" },
      { merchant: "zepto", priceInr: 18, deliveryFeeInr: 15, etaMinutes: 9, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 15, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 16, deliveryFeeInr: 0, etaMinutes: 35, inStock: true, real: false },
    ],
  },
  {
    id: "cookies-hide-and-seek-choco",
    name: "Hide & Seek Choco Chip Cookies",
    brand: "Parle",
    variant: "120 g",
    category: "Biscuits & Cookies",
    offers: [
      { merchant: "blinkit", priceInr: 30, deliveryFeeInr: 0, etaMinutes: 10, inStock: true, real: true, productId: "11102" },
      { merchant: "zepto", priceInr: 32, deliveryFeeInr: 15, etaMinutes: 9, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 28, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 29, deliveryFeeInr: 0, etaMinutes: 35, inStock: true, real: false },
    ],
  },
  {
    id: "cookies-right-shift-jaggery",
    name: "Right Shift Jaggery Atta Cookies",
    brand: "Right Shift",
    variant: "200 g",
    category: "Biscuits & Cookies",
    offers: [
      { merchant: "blinkit", priceInr: 90, deliveryFeeInr: 0, etaMinutes: 12, inStock: true, real: true, productId: "709802" },
      { merchant: "zepto", priceInr: 95, deliveryFeeInr: 15, etaMinutes: 10, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 85, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 88, deliveryFeeInr: 0, etaMinutes: 40, inStock: true, real: false },
    ],
  },
  {
    id: "biscuit-nutrichoice-highfibre",
    name: "Britannia NutriChoice Digestive High-Fibre Biscuit",
    brand: "Britannia",
    variant: "100 g",
    category: "Biscuits & Cookies",
    offers: [
      { merchant: "blinkit", priceInr: 25, deliveryFeeInr: 0, etaMinutes: 10, inStock: true, real: true, productId: "122263" },
      { merchant: "zepto", priceInr: 27, deliveryFeeInr: 15, etaMinutes: 9, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 23, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 24, deliveryFeeInr: 0, etaMinutes: 35, inStock: true, real: false },
    ],
  },
  {
    id: "atta-aashirvaad-sharbati-5kg",
    name: "Aashirvaad Select 100% MP Sharbati Atta",
    brand: "Aashirvaad",
    variant: "5 kg",
    category: "Atta & Flours",
    offers: [
      { merchant: "blinkit", priceInr: 350, deliveryFeeInr: 0, etaMinutes: 14, inStock: true, real: false },
      { merchant: "zepto", priceInr: 365, deliveryFeeInr: 15, etaMinutes: 11, inStock: true, real: false },
      { merchant: "bigbasket", priceInr: 339, deliveryFeeInr: 25, etaMinutes: 90, inStock: true, real: false },
      { merchant: "district", priceInr: 348, deliveryFeeInr: 0, etaMinutes: 42, inStock: true, real: false },
    ],
  },
];

export const MERCHANT_LABEL: Record<ShopMerchant, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  bigbasket: "BigBasket",
  district: "District",
};

export function searchCatalog(query: string): ShopProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG;
  return CATALOG.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );
}

export function findProduct(id: string): ShopProduct | undefined {
  return CATALOG.find((p) => p.id === id);
}

export function cheapestOffer(product: ShopProduct): MerchantOffer {
  return [...product.offers].sort(
    (a, b) => a.priceInr + a.deliveryFeeInr - (b.priceInr + b.deliveryFeeInr)
  )[0];
}
