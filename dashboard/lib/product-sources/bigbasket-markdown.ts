// Reads real BigBasket listings out of the page markdown that Anakin's scraper returns alongside its
// AI-extracted JSON.
//
// Why this exists (found live, 2026-09-20): for `bigbasket.com/ps/?q=atta` the page renders fully —
// 49 product links, 83 ₹ prices — yet Anakin's `outputSchema` extraction came back with
// `products: []`. The data was on the page; only the extractor missed it. This parses the page
// itself, deterministically, and is used ONLY when the extractor returns nothing.
//
// Nothing here invents a value: a card without a real name and a real price is skipped, exactly as
// the extractor path does. Each listing looks like this in the markdown:
//
//   [![Aashirvaad Atta Whole Wheat 5 kg](https://…/126903_12.jpg?tr=w-154,q-80)](https://www.bigbasket.com/pd/126903/…)
//   11% OFF
//   ### [Aashirvaad\ **Atta - Whole Wheat**](https://www.bigbasket.com/pd/126903/…)   4.1 76392 Ratings   5 kg
//   ₹273.59₹306.00
//   Add
//
// The image alt text is the full product title INCLUDING the pack size, which is why it is preferred
// as the name: the Deal Evaluator rejects a listing whose pack size it cannot read.
//
// Self-contained on purpose (no "@/…" imports) so scripts/check-bigbasket-parser.js can load it.

export interface BigBasketListing {
  name: string;
  priceInr: number;
  mrpInr?: number;
  imageUrl?: string;
  url: string;
  available: boolean;
}

const HEADING_RE = /###\s*\[([^\]]+)\]\((https?:\/\/[^)\s]*\/pd\/[^)\s]+)\)([^\n]*)/g;
const IMAGE_LINK_RE = /\[!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\]\((https?:\/\/[^)\s]*\/pd\/[^)\s]+)\)/g;
const PRICE_LINE_RE = /^\s*₹\s?([\d,]+(?:\.\d+)?)(?:\s*₹\s?([\d,]+(?:\.\d+)?))?\s*$/m;
const UNAVAILABLE_RE = /notify me|out of stock|currently unavailable|sold out/i;

/** The listing URL without BigBasket's tracking query string. */
function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw.split("?")[0];
  }
}

function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function cleanTitle(raw: string): string {
  return raw.replace(/\\/g, " ").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

/** "   4.176392 Ratings        5 kg" → "5 kg". Empty when the card shows no pack size. */
function packSize(afterHeading: string): string {
  return afterHeading
    .replace(/[\d.]+\s*Ratings?/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBigBasketMarkdown(markdown: string): BigBasketListing[] {
  if (!markdown) return [];

  // pd-url → { alt, image }, from the image link that sits above each card's heading
  const images = new Map<string, { alt: string; image: string }>();
  for (const m of markdown.matchAll(IMAGE_LINK_RE)) images.set(canonicalUrl(m[3]), { alt: cleanTitle(m[1]), image: m[2] });

  const headings = [...markdown.matchAll(HEADING_RE)];
  const listings: BigBasketListing[] = [];
  const seen = new Set<string>();

  headings.forEach((h, i) => {
    const url = canonicalUrl(h[2]);
    if (seen.has(url)) return;

    // This card's block: from its heading to the next card's heading.
    const start = h.index ?? 0;
    const end = headings[i + 1]?.index ?? markdown.length;
    const block = markdown.slice(start, end);
    // The next card's image link sits at the end of this block; it is not this card's data.
    const own = block.split(/\n\s*\[!\[/)[0];

    const priceMatch = PRICE_LINE_RE.exec(own.slice(h[0].length));
    const price = toNumber(priceMatch?.[1]);
    const image = images.get(url);
    const size = packSize(h[3]);
    const heading = cleanTitle(h[1]);
    const name = image?.alt || (size && !heading.toLowerCase().includes(size.toLowerCase()) ? `${heading} ${size}` : heading);
    if (!name || price === undefined) return; // never defaulted to 0 / "Unknown"

    const mrp = toNumber(priceMatch?.[2]);
    seen.add(url);
    listings.push({
      name,
      priceInr: price,
      mrpInr: mrp !== undefined && mrp > price ? mrp : undefined,
      imageUrl: image?.image,
      url,
      available: !UNAVAILABLE_RE.test(own),
    });
  });

  return listings;
}
