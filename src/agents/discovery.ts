// Agent 2 — Deal Discovery. Finds candidate products and prices across the supported merchants.
//
// It does not scrape anything itself. Vitta already has one web-access path, and this agent reuses
// it rather than growing a second:
//   • dashboard mode  — GET <dashboard>/api/shop/search, which tries Anakin's managed scraper first
//                       (Zepto, BigBasket) and falls back to webcmd (dashboard/lib/product-sources).
//   • webcmd mode     — the read-only `search` CLI (src/cli/search.ts), hard-restricted to
//                       manifest `access: 'read'` commands, so it CANNOT reach a write or a spend.
// Either way this agent is read-only by construction: it has no way to place an order.
import { runSearch, type CliResult } from '../agent/gate-spawn';
import { withPackSize } from './pack-size';
import {
  AgentFault,
  MERCHANT_IDS,
  StepRecorder,
  agentFail,
  agentOk,
  isShoppingIntent,
  type AgentHandler,
  type AgentResult,
  type Candidate,
  type DiscoveryResult,
  type MerchantId,
  type MerchantSearchError,
  type ShoppingIntent,
} from './protocol';

const NAME = 'vitta-deal-discovery' as const;
const MAX_CANDIDATES_PER_MERCHANT = 15;

export interface ProviderResult {
  ok: boolean;
  /** The real source that answered ('anakin', 'webcmd'). Never invented. */
  source: string;
  candidates: Candidate[];
  error?: string;
}

export type SearchProvider = (merchant: MerchantId, query: string) => Promise<ProviderResult>;
export type ProductProvider = (merchant: MerchantId, productId: string) => Promise<ProviderResult>;

export interface DiscoveryDeps {
  search: SearchProvider;
  product: ProductProvider;
}

// ---------------------------------------------------------------------------------------------
// Normalizers — pure, so every real payload shape is testable without a browser or a network.
// ---------------------------------------------------------------------------------------------

/** Mirrors dashboard/lib/live-search.ts parseAvailability: an EMPTY availability string is the
 *  normal in-stock case for BigBasket (the field only ever flags exceptions), so blank = available. */
export function parseAvailability(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return true;
    const s = raw.toLowerCase();
    if (/out|unavailable|no\b|^0$|false/.test(s)) return false;
    if (/in.?stock|available|yes|^1$|true/.test(s)) return true;
    return false; // an unrecognised non-empty label is not evidence of stock
  }
  return false;
}

function positive(n: unknown): number | undefined {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

function httpUrl(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^https?:\/\//.test(raw) ? raw : undefined;
}

/** One row of `webcmd <site> search|product -f json`. Blinkit and the other two name fields differently. */
export function normalizeWebcmdRow(merchant: MerchantId, row: Record<string, unknown>): Candidate | undefined {
  const isBlinkit = merchant === 'blinkit';
  // The merchant states the pack size in its own field (Blinkit `variant`, Zepto `pack_size`), not in
  // the name — carry it in, or the Evaluator cannot confirm a size the person asked for.
  const name = withPackSize(String((isBlinkit ? row.name : row.title) ?? '').trim(), isBlinkit ? row.variant : row.pack_size);
  const price = positive(row.price);
  // A row without a real name or price is dropped, never defaulted — an invented price on a
  // candidate would flow straight into a purchase proposal.
  if (!name || price === undefined) return undefined;
  const id = String((isBlinkit ? row.productId : row.product_id) ?? '').trim();
  return {
    merchant,
    product_name: name,
    price_inr: price,
    availability: parseAvailability(isBlinkit ? row.available : row.availability),
    product_url: httpUrl(row.url),
    product_id: id || undefined,
    source: 'webcmd',
  };
}

export interface DashboardProduct {
  merchant: MerchantId;
  productId?: string;
  name?: string;
  priceInr?: number;
  available?: boolean;
  url?: string;
}

export function normalizeDashboardProduct(p: DashboardProduct, source: string): Candidate | undefined {
  const name = (p.name ?? '').trim();
  const price = positive(p.priceInr);
  if (!name || price === undefined || !(MERCHANT_IDS as readonly string[]).includes(p.merchant)) return undefined;
  return {
    merchant: p.merchant,
    product_name: name,
    price_inr: price,
    availability: p.available === true,
    product_url: httpUrl(p.url),
    product_id: p.productId ? p.productId : undefined,
    source,
  };
}

// ---------------------------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------------------------

type RunSearch = (argv: string[]) => Promise<CliResult>;

function parseSearchStdout(stdout: string): { ok: boolean; rows?: unknown; message?: string } {
  try {
    return JSON.parse(stdout.trim() || '{}') as { ok: boolean; rows?: unknown; message?: string };
  } catch {
    return { ok: false, message: 'search CLI produced unparseable output' };
  }
}

export function webcmdProviders(run: RunSearch = runSearch): DiscoveryDeps {
  async function fetchRows(merchant: MerchantId, command: 'search' | 'product', arg: string): Promise<ProviderResult> {
    const result = await run([merchant, command, arg]);
    const parsed = parseSearchStdout(result.stdout);
    if (!parsed.ok || !Array.isArray(parsed.rows)) {
      return {
        ok: false,
        source: 'webcmd',
        candidates: [],
        error: parsed.message || result.stderr.trim() || (result.timedOut ? 'webcmd timed out' : 'webcmd returned no rows'),
      };
    }
    const candidates = (parsed.rows as Array<Record<string, unknown>>)
      .map((row) => normalizeWebcmdRow(merchant, row))
      .filter((c): c is Candidate => c !== undefined);
    return { ok: true, source: 'webcmd', candidates };
  }
  return {
    search: (merchant, query) => fetchRows(merchant, 'search', query),
    product: (merchant, productId) => fetchRows(merchant, 'product', productId),
  };
}

interface DashboardSearchResponse {
  ok?: boolean;
  message?: string;
  results?: Array<{ merchant: MerchantId; ok: boolean; products?: DashboardProduct[]; error?: string; source?: string }>;
}

/** Search through the running dashboard — the one place Anakin is wired in. Product-detail lookups
 *  (the Price Sniper's pinned watch) still go through webcmd's read-only `product` command, since
 *  the dashboard exposes no by-id lookup and Anakin's pages carry no stable product id. */
export function dashboardProviders(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  run: RunSearch = runSearch,
  searchTimeoutMs: number = DEFAULT_SEARCH_TIMEOUT_MS,
): DiscoveryDeps {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    search: async (merchant, query) => {
      try {
        const url = `${base}/api/shop/search?q=${encodeURIComponent(query)}&merchant=${merchant}`;
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(searchTimeoutMs) });
        const body = (await res.json()) as DashboardSearchResponse;
        const entry = body.results?.[0];
        if (!res.ok || !body.ok || !entry) {
          return { ok: false, source: 'dashboard', candidates: [], error: body.message ?? `dashboard search HTTP ${res.status}` };
        }
        const source = entry.source ?? 'dashboard';
        if (!entry.ok) return { ok: false, source, candidates: [], error: entry.error ?? 'merchant search failed' };
        const candidates = (entry.products ?? [])
          .map((p) => normalizeDashboardProduct(p, source))
          .filter((c): c is Candidate => c !== undefined);
        return { ok: true, source, candidates };
      } catch (err) {
        const e = err as Error;
        const message =
          e.name === 'TimeoutError' || e.name === 'AbortError'
            ? `no answer from the dashboard within ${Math.round(searchTimeoutMs / 1000)}s`
            : e.message;
        return { ok: false, source: 'dashboard', candidates: [], error: message };
      }
    },
    product: webcmdProviders(run).product,
  };
}

/** How long one merchant's search may take. Merchants are searched in parallel and one slow merchant
 *  must cost only itself, not the hop: Nasiko cuts every agent call off at 60s (its shared HTTP client's
 *  timeout — verified), and an Anakin scrape takes ~20s a try with up to three tries. 50s leaves room
 *  for the rest of the hop. Set VITTA_DISCOVERY_TIMEOUT_MS to change it (e.g. when not behind Nasiko). */
export const DEFAULT_SEARCH_TIMEOUT_MS = 50_000;

/** VITTA_DASHBOARD_URL set → Anakin-first search via the dashboard; otherwise straight webcmd. */
export function defaultDiscoveryDeps(env: NodeJS.ProcessEnv = process.env): DiscoveryDeps {
  const configured = Number(env.VITTA_DISCOVERY_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SEARCH_TIMEOUT_MS;
  return env.VITTA_DASHBOARD_URL ? dashboardProviders(env.VITTA_DASHBOARD_URL, fetch, runSearch, timeoutMs) : webcmdProviders();
}

// ---------------------------------------------------------------------------------------------
// The agent
// ---------------------------------------------------------------------------------------------

export async function discover(
  intent: ShoppingIntent,
  deps: DiscoveryDeps,
  steps: StepRecorder,
): Promise<DiscoveryResult> {
  const candidates: Candidate[] = [];
  const merchantErrors: MerchantSearchError[] = [];
  let merchantsAnswered = 0;

  const targets: MerchantId[] = intent.pinned
    ? [intent.pinned.merchant]
    : intent.preferred_merchants.length > 0
      ? intent.preferred_merchants
      : [...MERCHANT_IDS];

  await Promise.all(
    targets.map(async (merchant) => {
      const startedAt = new Date();
      let result: ProviderResult;
      try {
        result = intent.pinned
          ? await deps.product(merchant, intent.pinned.product_id)
          : await deps.search(merchant, intent.product_query);
      } catch (err) {
        result = { ok: false, source: 'unknown', candidates: [], error: (err as Error).message };
      }
      const durationMs = Date.now() - startedAt.getTime();
      const label = intent.pinned ? `product:${merchant}` : `search:${merchant}`;
      if (result.ok) {
        merchantsAnswered += 1;
        candidates.push(...result.candidates.slice(0, MAX_CANDIDATES_PER_MERCHANT));
        steps.steps.push({
          name: label,
          status: 'ok',
          detail: `${result.candidates.length} product(s) via ${result.source}`,
          startedAt: startedAt.toISOString(),
          durationMs,
        });
      } else {
        merchantErrors.push({ merchant, error: result.error ?? 'unknown error', source: result.source });
        steps.steps.push({
          name: label,
          status: 'failed',
          detail: `${result.source}: ${result.error ?? 'unknown error'}`,
          startedAt: startedAt.toISOString(),
          durationMs,
        });
      }
    }),
  );

  if (merchantsAnswered === 0) {
    const anakin = merchantErrors.some((e) => /anakin/i.test(e.error) || e.source === 'anakin');
    throw new AgentFault(
      anakin ? 'ANAKIN_ERROR' : 'DISCOVERY_ERROR',
      `No merchant could be searched: ${merchantErrors.map((e) => `${e.merchant}: ${e.error}`).join('; ')}`,
      { merchant_errors: merchantErrors },
    );
  }
  if (candidates.length === 0) {
    throw new AgentFault('NO_PRODUCTS_FOUND', `No products found for "${intent.product_query}".`, { merchant_errors: merchantErrors });
  }
  // Stable order regardless of which merchant answered first.
  candidates.sort((a, b) => a.merchant.localeCompare(b.merchant));
  return { candidates, merchant_errors: merchantErrors };
}

export function createDiscoveryAgent(deps: DiscoveryDeps = defaultDiscoveryDeps()): AgentHandler {
  return async (request): Promise<AgentResult> => {
    const steps = new StepRecorder();
    try {
      const input = request.input as { intent?: unknown } | null;
      if (!isShoppingIntent(input?.intent)) {
        throw new AgentFault('INVALID_REQUEST', 'Discovery input must be {"intent": <ShoppingIntent>}.');
      }
      const result = await discover(input.intent, deps, steps);
      return agentOk(NAME, result, steps.steps);
    } catch (err) {
      if (err instanceof AgentFault) return agentFail(NAME, { code: err.code, message: err.message, details: err.details }, steps.steps);
      return agentFail(NAME, { code: 'DISCOVERY_ERROR', message: (err as Error).message }, steps.steps);
    }
  };
}
