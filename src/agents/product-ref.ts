// Turns a Candidate into the exact argument each merchant's `add-to-cart` wants. A hand-mirror of
// dashboard/lib/product-ref.ts — the dashboard and src/ deliberately don't import each other (see
// dashboard/lib/types.ts's header), so the merchant-host allowlist is duplicated here rather than
// shared. The three merchants genuinely disagree:
//   blinkit    positional productId (no URL form)
//   zepto      the product URL from search results
//   bigbasket  a product id, or a URL (id preferred — it is the form verified live)
//
// Security: a URL is only accepted after parsing with the URL constructor and checking it is https on
// a hostname belonging to THAT merchant. Never a regex over the raw string, and never a URL whose
// host doesn't match the merchant it is claimed for — otherwise a crafted product URL from an
// upstream agent could point the real, logged-in browser session at an arbitrary site.
import { AgentFault, type Candidate, type MerchantId } from './protocol';

const MERCHANT_HOSTS: Record<MerchantId, string[]> = {
  blinkit: ['blinkit.com'],
  zepto: ['zeptonow.com', 'zepto.co.in'],
  bigbasket: ['bigbasket.com'],
};

// Must START with a letter or digit: the id becomes a positional argument to webcmd, and one that
// begins with `-` (e.g. "--quantity") would be parsed as a flag rather than an id.
const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

function merchantUrl(raw: string, merchant: MerchantId): URL | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  const host = url.hostname.toLowerCase();
  return MERCHANT_HOSTS[merchant].some((base) => host === base || host.endsWith(`.${base}`)) ? url : undefined;
}

export function resolveProductRef(candidate: Pick<Candidate, 'merchant' | 'product_id' | 'product_url'>): string {
  const { merchant } = candidate;
  const id = candidate.product_id?.trim();
  const rawUrl = candidate.product_url?.trim();
  const url = rawUrl ? merchantUrl(rawUrl, merchant) : undefined;
  if (rawUrl && !url) {
    throw new AgentFault('PURCHASE_ERROR', `The product URL is not an https ${merchant} URL — refusing to hand it to the browser.`);
  }

  switch (merchant) {
    case 'blinkit':
      if (id && PRODUCT_ID_PATTERN.test(id)) return id;
      throw new AgentFault('PURCHASE_ERROR', 'Blinkit needs a product id; none usable on this candidate.');
    case 'zepto':
      if (url) return url.toString();
      throw new AgentFault('PURCHASE_ERROR', 'Zepto needs the product URL from the search result; none on this candidate.');
    case 'bigbasket': {
      if (url) {
        const fromUrl = /\/pd\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1];
        return fromUrl ?? url.toString();
      }
      if (id && PRODUCT_ID_PATTERN.test(id)) return id;
      throw new AgentFault('PURCHASE_ERROR', 'BigBasket needs a product id or URL; none usable on this candidate.');
    }
  }
}
