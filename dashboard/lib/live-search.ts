// Real, live, read-only product search across every merchant webcmd genuinely supports for real.
// Never fabricates data: a merchant that errors, isn't logged in, or returns nothing is reported
// as such, never backfilled with placeholder content. Spawns the root project's compiled
// dist/cli/search.js — a narrow, read-only entry point that never touches mandates/decide()/the
// ledger — via the same safe execFile(argv array, no shell) discipline gate-cli.ts already
// established for the real gate CLI.
import { execFile } from "node:child_process";
import path from "node:path";
import { getDataDir } from "@/lib/read";

export type LiveMerchant = "blinkit" | "zepto" | "bigbasket";

export interface LiveProduct {
  merchant: LiveMerchant;
  productId: string;
  name: string;
  brand?: string;
  priceInr: number;
  mrpInr?: number;
  /** Present only when the real source actually returned one — never a stand-in image. */
  imageUrl?: string;
  available: boolean;
  availabilityLabel: string;
  url?: string;
}

export interface MerchantSearchResult {
  merchant: LiveMerchant;
  ok: boolean;
  products: LiveProduct[];
  /** Set only on a genuine failure — never populated alongside fabricated products. */
  error?: string;
  authRequired?: boolean;
}

function searchCliEntryPoint(): string {
  return path.join(getDataDir(), "dist", "cli", "search.js");
}

export interface RawSearchResponse {
  ok: boolean;
  rows?: unknown;
  message?: string;
  authRequired?: boolean;
  /** Only present for a `cart` read — resolved by the CLI with the gate's own cart-total resolver,
   *  so it is the same figure decide() will be handed at commit time. */
  cartTotalInr?: number;
  cartItemCount?: number;
  cartTotalError?: string;
}

// Real, live-tested finding: individual webcmd search calls varied 22s-38s end to end through
// this exact path across repeated real runs (real browser automation, not an instant lookup, and
// visibly variable — cold navigation vs. a warm session) — 60s gives real headroom rather than
// cutting it close. execFile kills the child and reports `error.killed` on timeout; that case
// must produce an honest "timed out" message, not silently fall through to an empty `{}` parse
// that looks identical to "the merchant genuinely returned nothing."
export function runSearchCli(argv: string[], timeoutMs = 60_000): Promise<RawSearchResponse> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [searchCliEntryPoint(), ...argv],
      { cwd: getDataDir(), timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
          resolve({ ok: false, message: `Timed out after ${Math.round(timeoutMs / 1000)}s waiting on webcmd` });
          return;
        }
        const trimmedStdout = stdout.trim();
        if (!trimmedStdout) {
          // The child process produced NO output at all — it never even reached search.js's own
          // fail() (which always writes a real {ok:false,message} JSON before exiting). This means
          // the spawn itself failed (e.g. dist/cli/search.js missing, ENOENT, permissions) — the
          // only real diagnostic available is `error.message`/stderr. Found live: this path was
          // previously falling through to `JSON.parse(stdout.trim() || "{}")`, which parses "{}"
          // successfully and silently produces an object with no `message` field at all — the exact
          // cause of every card showing a bare "unknown error" with the real reason discarded.
          resolve({
            ok: false,
            message: error?.message?.trim() || stderr.trim() || "search.js produced no output and no error was reported",
          });
          return;
        }
        try {
          resolve(JSON.parse(trimmedStdout) as RawSearchResponse);
        } catch {
          resolve({
            ok: false,
            message: stderr.trim() || error?.message?.trim() || "search.js produced unparseable output",
          });
        }
      }
    );
  });
}

// Confirmed live against real BigBasket search output: `availability` is an empty string for
// ordinary in-stock listings — the field is only ever populated to flag an exception (e.g. an
// out-of-stock reason), never to affirmatively say "in stock." Treating blank as "unavailable"
// would have disabled Add-to-cart on every real, purchasable BigBasket result. A present real
// price + real product URL is itself real evidence the listing is live, so blank defaults to
// available; any populated string that actually says something is still trusted verbatim.
function parseAvailability(raw: unknown): { available: boolean; label: string } {
  if (typeof raw === "boolean") return { available: raw, label: raw ? "In stock" : "Out of stock" };
  if (typeof raw === "string") {
    if (raw.trim() === "") return { available: true, label: "Available" };
    const s = raw.toLowerCase();
    if (/out|unavailable|no\b|^0$|false/.test(s)) return { available: false, label: raw };
    if (/in.?stock|available|yes|^1$|true/.test(s)) return { available: true, label: raw };
    // Unverified non-empty shape — show it honestly rather than guessing a status.
    return { available: false, label: raw };
  }
  return { available: false, label: "Unknown" };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function searchBlinkit(query: string): Promise<MerchantSearchResult> {
  const res = await runSearchCli(["blinkit", "search", query]);
  if (!res.ok) return { merchant: "blinkit", ok: false, products: [], error: res.message, authRequired: res.authRequired };
  const rows = Array.isArray(res.rows) ? (res.rows as Record<string, unknown>[]) : [];
  const products: LiveProduct[] = rows.map((r) => {
    const av = parseAvailability(r.available);
    return {
      merchant: "blinkit",
      productId: String(r.productId ?? ""),
      name: String(r.name ?? "Unnamed product"),
      brand: r.brand ? String(r.brand) : undefined,
      priceInr: num(r.price),
      mrpInr: r.mrp !== undefined && r.mrp !== null ? num(r.mrp) : undefined,
      imageUrl: r.imageUrl ? String(r.imageUrl) : undefined,
      available: av.available,
      availabilityLabel: av.label,
      url: r.url ? String(r.url) : undefined,
    };
  });
  return { merchant: "blinkit", ok: true, products };
}

async function searchZepto(query: string): Promise<MerchantSearchResult> {
  const res = await runSearchCli(["zepto", "search", query]);
  if (!res.ok) return { merchant: "zepto", ok: false, products: [], error: res.message, authRequired: res.authRequired };
  const rows = Array.isArray(res.rows) ? (res.rows as Record<string, unknown>[]) : [];
  const products: LiveProduct[] = rows.map((r) => {
    const av = parseAvailability(r.availability);
    return {
      merchant: "zepto",
      productId: String(r.product_id ?? ""),
      name: String(r.title ?? "Unnamed product"),
      brand: r.brand ? String(r.brand) : undefined,
      priceInr: num(r.price),
      mrpInr: r.mrp !== undefined && r.mrp !== null ? num(r.mrp) : undefined,
      // webcmd's zepto search/product commands carry no image field at all — never fabricated.
      imageUrl: undefined,
      available: av.available,
      availabilityLabel: av.label,
      url: r.url ? String(r.url) : undefined,
    };
  });
  return { merchant: "zepto", ok: true, products };
}

const BIGBASKET_IMAGE_BACKFILL_LIMIT = 6;

async function searchBigBasket(query: string): Promise<MerchantSearchResult> {
  const res = await runSearchCli(["bigbasket", "search", query]);
  if (!res.ok) return { merchant: "bigbasket", ok: false, products: [], error: res.message, authRequired: res.authRequired };
  const rows = Array.isArray(res.rows) ? (res.rows as Record<string, unknown>[]) : [];
  const products: LiveProduct[] = rows.map((r) => {
    const av = parseAvailability(r.availability);
    return {
      merchant: "bigbasket" as const,
      productId: String(r.product_id ?? ""),
      name: String(r.title ?? "Unnamed product"),
      brand: r.brand ? String(r.brand) : undefined,
      priceInr: num(r.price),
      mrpInr: r.mrp !== undefined && r.mrp !== null ? num(r.mrp) : undefined,
      imageUrl: undefined, // bigbasket/search has no image column — backfilled below, per-product
      available: av.available,
      availabilityLabel: av.label,
      url: r.url ? String(r.url) : undefined,
    };
  });

  // bigbasket/product (single-item detail) is the only real image source for this merchant.
  // Bounded + parallel + fail-soft: a slow/failed backfill for one product must never block or
  // drop the others — it just leaves that one card without a real image, honestly.
  const toBackfill = products.slice(0, BIGBASKET_IMAGE_BACKFILL_LIMIT).filter((p) => p.productId);
  await Promise.allSettled(
    toBackfill.map(async (p) => {
      const detail = await runSearchCli(["bigbasket", "product", p.productId], 45_000);
      if (!detail.ok || !Array.isArray(detail.rows) || detail.rows.length === 0) return;
      const row = detail.rows[0] as Record<string, unknown>;
      if (row.image_url) p.imageUrl = String(row.image_url);
    })
  );

  return { merchant: "bigbasket", ok: true, products };
}

const SEARCH_FNS: Record<LiveMerchant, (query: string) => Promise<MerchantSearchResult>> = {
  blinkit: searchBlinkit,
  zepto: searchZepto,
  bigbasket: searchBigBasket,
};

export function isLiveMerchant(value: string): value is LiveMerchant {
  return value in SEARCH_FNS;
}

/** Single-merchant search — lets the dashboard fetch each merchant independently so results
 * render progressively instead of waiting for the slowest one (BigBasket's image backfill). */
export async function searchOneMerchant(merchant: LiveMerchant, query: string): Promise<MerchantSearchResult> {
  return SEARCH_FNS[merchant](query);
}

export async function searchAllMerchants(query: string): Promise<MerchantSearchResult[]> {
  const [blinkit, zepto, bigbasket] = await Promise.all([
    searchBlinkit(query),
    searchZepto(query),
    searchBigBasket(query),
  ]);
  return [blinkit, zepto, bigbasket];
}
