// Real, read-only product search. No mandate/decide()/ledger involvement — same category as this
// project's other reads (ADR-003). Browser automation is never triggered here when a faster source
// can serve the merchant; see lib/product-sources/index.ts for the source order.
//
// The `merchant` param serves one merchant at a time so the client can fire all three in parallel
// and render each card as it lands, rather than blocking the whole grid on the slowest source.
import { searchMerchant, SEARCHABLE_MERCHANTS } from "@/lib/product-sources";
import { isLiveMerchant } from "@/lib/live-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const merchant = searchParams.get("merchant");

  if (!q) return Response.json({ ok: false, message: "Missing query" }, { status: 400 });
  if (q.length > 100) return Response.json({ ok: false, message: "Query too long" }, { status: 400 });

  if (merchant !== null) {
    if (!isLiveMerchant(merchant)) {
      return Response.json({ ok: false, message: "Unknown merchant" }, { status: 400 });
    }
    const result = await searchMerchant(merchant, q);
    return Response.json({ ok: true, query: q, results: [result] });
  }

  const results = await Promise.all(SEARCHABLE_MERCHANTS.map((m) => searchMerchant(m, q)));
  return Response.json({ ok: true, query: q, results });
}
