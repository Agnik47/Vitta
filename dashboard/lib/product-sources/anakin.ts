// Fast product source backed by Anakin's managed scraping API (anakin.io) — no local browser.
//
// VERIFIED LIVE against a real key (2026-07-31), not assumed from docs:
//   POST https://api.anakin.io/v1/url-scraper/scrape, header `X-API-Key`, body
//   {url, country, useBrowser, actions[], outputSchema} -> {status, generatedJson, durationMs, ...}
//
// Real per-merchant results from that testing, which is why the merchant list is what it is:
//   - zepto      -> 25 products, 25/25 with real images. Works well.
//   - bigbasket  -> 40 products, all with real price+URL; images are lazy-loaded so only a subset
//                   resolve even after scrolling (9-18 of 40 across runs).
//   - blinkit    -> extracts 0 products (its listing needs a delivery location the scraper has no
//                   way to set), and one earlier run was outright Cloudflare-blocked. Blinkit is
//                   therefore NOT served here — it falls through to the webcmd source, which is
//                   already logged in locally and returns full real data including images.
//
// `outputSchema` is used rather than bare `generateJson` so the extracted fields are ones we
// specified, not an undocumented guess — and any record missing a real name or price is dropped
// downstream rather than defaulted, so a card never shows an invented price.
import { parseBigBasketMarkdown } from "@/lib/product-sources/bigbasket-markdown";
import { runtimeEnv } from "@/lib/runtime-env";
import type { LiveMerchant, LiveProduct, MerchantSearchResult, ProductSource } from "@/lib/product-sources/types";

const ANAKIN_SCRAPE_URL = "https://api.anakin.io/v1/url-scraper/scrape";

// Real, human-facing search URLs (confirmed working against the live API, not guessed).
const SEARCH_URL: Partial<Record<LiveMerchant, (q: string) => string>> = {
  zepto: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
  bigbasket: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
};

// One scroll pass: measurably improves how many lazy-loaded images resolve, without the ~10s extra
// that a longer scroll chain cost in testing. These pages render products client-side, so
// useBrowser + a short settle wait are both required — a plain fetch returns an empty shell.
const PAGE_ACTIONS = [
  { type: "wait", milliseconds: 2000 },
  { type: "scroll" },
  { type: "wait", milliseconds: 1000 },
];

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full product title" },
          price: { type: "number", description: "Current selling price in INR, number only" },
          mrp: { type: "number", description: "Original/struck-through price in INR if shown" },
          imageUrl: { type: "string", description: "Absolute URL of the product image" },
          url: { type: "string", description: "Absolute URL of the product detail page" },
          inStock: { type: "boolean" },
        },
        required: ["name", "price"],
      },
    },
  },
};

interface AnakinProductRow {
  name?: unknown;
  price?: unknown;
  mrp?: unknown;
  imageUrl?: unknown;
  url?: unknown;
  inStock?: unknown;
}

interface AnakinScrapeResponse {
  status?: string;
  generatedJson?: { products?: AnakinProductRow[]; data?: { products?: AnakinProductRow[] } };
  error?: string | null;
  durationMs?: number;
  /** The rendered page as markdown — used as a deterministic fallback when the AI extraction is empty. */
  markdown?: string;
  html?: string;
}

/** Zepto (and others) sometimes hand Anakin's browser a JS bot-check page instead of results: a ~2KB
 * shell with a `challenge-container` and no content. Retrying does not help (verified live with a
 * 7s settle wait), so it is reported at once — and the next source gets its turn while the caller's
 * time budget is still intact. */
/** Once Anakin is shown a bot-check for a merchant, further scrapes for it would only spend a credit
 * and 16s to fail the same way. Skip Anakin for that merchant for a while and let the next source
 * (webcmd) serve it at once. */
const BOT_CHECK_COOLDOWN_MS = 10 * 60_000;
const botCheckedUntil = new Map<string, number>();

function isBotChallenge(body: AnakinScrapeResponse): boolean {
  return typeof body.html === "string" && body.html.includes("challenge-container") && !body.markdown?.trim();
}

function apiKey(): string | undefined {
  return runtimeEnv("ANAKIN_API_KEY");
}

/** Merchants this source is confirmed to serve. Overridable by env, but defaults to exactly what
 * real testing showed working — never a merchant that hasn't actually returned real data. */
function confirmedMerchants(): Set<string> {
  const configured = runtimeEnv("ANAKIN_MERCHANTS");
  if (configured) return new Set(configured.split(",").map((s) => s.trim()).filter(Boolean));
  return new Set(["zepto", "bigbasket"]);
}

function toNumber(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[₹,\s]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function httpUrl(raw: unknown): string | undefined {
  return typeof raw === "string" && /^https?:\/\//.test(raw) ? raw : undefined;
}

export const anakinSource: ProductSource = {
  name: "anakin",
  isAvailable: () => apiKey() !== undefined,
  supports: (merchant) =>
    confirmedMerchants().has(merchant) && SEARCH_URL[merchant] !== undefined && (botCheckedUntil.get(merchant) ?? 0) <= Date.now(),

  async search(merchant: LiveMerchant, query: string): Promise<MerchantSearchResult> {
    const buildUrl = SEARCH_URL[merchant];
    const key = apiKey();
    if (!buildUrl || !key) {
      return { merchant, ok: false, products: [], error: "Anakin not configured for this merchant" };
    }

    // These are client-rendered SPAs and their render genuinely is flaky through a scraper — the
    // same query returned 21-26 products on one attempt and 0 on the next, minutes apart. Real
    // measurement 2026-07-31 against Zepto specifically: a 2-attempt budget (the original setting
    // here) still landed empty on 3 of 5 real queries end to end through this exact route
    // (chips/milk/eggs empty, atta/Maggi real) — beyond what "one retry covers most misses" assumed.
    // A 3rd attempt is still bounded (never hammers indefinitely) and directly targets that gap.
    const maxAttempts = 3;
    // The retries are worth having, but not without a ceiling: for a page that renders empty, three
    // attempts of 10-16s plus the webcmd fallback ran past a minute (measured live, "biscuit" on
    // BigBasket) — and the Deal Discovery agent gives each merchant a hard 50s. A total budget keeps
    // the whole merchant search inside that.
    const startedAt = Date.now();
    const budgetMs = Number(runtimeEnv("VITTA_ANAKIN_BUDGET_MS")) || 40_000;
    const MIN_ATTEMPT_MS = 10_000;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remainingMs = budgetMs - (Date.now() - startedAt);
      // Another attempt takes ~10-16s; if there is not room for one after this, this is the last.
      const isLastAttempt = attempt === maxAttempts - 1 || remainingMs < 2 * MIN_ATTEMPT_MS + 4_000;
      try {
        const res = await fetch(ANAKIN_SCRAPE_URL, {
          method: "POST",
          headers: { "X-API-Key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: buildUrl(query),
            country: "in",
            useBrowser: true,
            actions: PAGE_ACTIONS,
            outputSchema: OUTPUT_SCHEMA,
          }),
          cache: "no-store", // never let a framework-level cache serve a stale price
          // docs: the inline endpoint blocks up to ~90s — but never longer than the budget has left
          signal: AbortSignal.timeout(Math.max(MIN_ATTEMPT_MS, Math.min(90_000, remainingMs))),
        });

        if (!res.ok) {
          if (!isLastAttempt) continue;
          return { merchant, ok: false, products: [], error: `Anakin HTTP ${res.status}` };
        }

        const body = (await res.json()) as AnakinScrapeResponse;
        if (body.error) {
          if (!isLastAttempt) continue;
          return { merchant, ok: false, products: [], error: body.error };
        }

        if (isBotChallenge(body)) {
          botCheckedUntil.set(merchant, Date.now() + BOT_CHECK_COOLDOWN_MS);
          return {
            merchant,
            ok: false,
            products: [],
            error: `${merchant} showed Anakin's browser a bot-check page instead of results, so nothing could be read`,
          };
        }

        const rows = body.generatedJson?.products ?? body.generatedJson?.data?.products ?? [];

        const products: LiveProduct[] = [];
        for (const row of rows) {
          const price = toNumber(row.price);
          const name = typeof row.name === "string" ? row.name.trim() : "";
          // A row without a real name or a real price is dropped outright — never defaulted to 0
          // or "Unknown", which would put an invented figure on an authoritative-looking card.
          if (!name || price === undefined) continue;
          const inStock = row.inStock !== false;
          products.push({
            merchant,
            productId: "", // these pages expose no stable id; the product URL is the real identifier
            name,
            priceInr: price,
            mrpInr: toNumber(row.mrp),
            imageUrl: httpUrl(row.imageUrl),
            available: inStock,
            availabilityLabel: inStock ? "Available" : "Out of stock",
            url: httpUrl(row.url),
          });
        }

        // The AI extraction can come back empty for a page that plainly has products (seen live on
        // BigBasket). Read the page itself before deciding it has none.
        if (products.length === 0 && merchant === "bigbasket" && body.markdown) {
          for (const item of parseBigBasketMarkdown(body.markdown)) {
            products.push({
              merchant,
              productId: "", // same as above: the product URL is the identifier
              name: item.name,
              priceInr: item.priceInr,
              mrpInr: item.mrpInr,
              imageUrl: item.imageUrl,
              available: item.available,
              availabilityLabel: item.available ? "Available" : "Out of stock",
              url: item.url,
            });
          }
        }

        if (products.length > 0) return { merchant, ok: true, products };
        if (!isLastAttempt) continue; // empty render — try again before believing it

        // Zero parseable products after every retry is reported as a failure, not as "no results" —
        // they're different facts, and conflating them would hide a broken extraction behind an
        // empty grid.
        return { merchant, ok: false, products: [], error: "No products extracted from the page" };
      } catch (err) {
        if (!isLastAttempt) continue;
        return { merchant, ok: false, products: [], error: (err as Error).message };
      }
    }

    return { merchant, ok: false, products: [], error: "No products extracted from the page" };
  },
};
