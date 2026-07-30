// Real, ₹0-cost webcmd add-to-cart — routed through the real `gate` CLI (never webcmd directly)
// so it still passes through decide() and lands a real GateEvent, same as every other write in
// this project. See ADR-015 / CLAUDE.md rule 8.
//
// Originally Blinkit-only, whitelisted against a small set of productIds hand-verified in a past
// session against the static mock catalog. Now also serves real live-search results (see
// dashboard/lib/live-search.ts) — those productIds are just as real (fetched from webcmd this
// request) but can't be pre-enumerated, so the check here is a format/site-support guard, not a
// whitelist: fail closed on garbage input and unsupported merchants, never on a genuinely-fresh
// real id. Zepto/BigBasket both have real `add-to-cart <product>` write commands per the manifest.
import { runGateCli } from "@/lib/gate-cli";

const SITE_BY_MERCHANT = { blinkit: "blinkit", zepto: "zepto", bigbasket: "bigbasket" } as const;
type SupportedMerchant = keyof typeof SITE_BY_MERCHANT;

// webcmd product ids seen so far are short alphanumeric tokens (Blinkit) — this is a sanity/format
// check, not a business-logic whitelist. The real safety boundary is execFile's argv array (no
// shell), same as every other write route in this project — this check just rejects obvious junk
// before it reaches webcmd at all.
const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { productId, quantity, merchant } = (body ?? {}) as {
    productId?: unknown;
    quantity?: unknown;
    merchant?: unknown;
  };

  const site: SupportedMerchant = typeof merchant === "string" && merchant in SITE_BY_MERCHANT
    ? (merchant as SupportedMerchant)
    : "blinkit"; // default preserves the original Blinkit-only call sites unchanged

  if (typeof productId !== "string" || !PRODUCT_ID_PATTERN.test(productId)) {
    // Fail closed: anything that isn't a plausible real product id never reaches webcmd.
    return Response.json({ ok: false, message: "Invalid product id" }, { status: 400 });
  }

  const qty = typeof quantity === "number" && Number.isInteger(quantity) ? quantity : 1;
  if (qty < 1 || qty > 12) {
    return Response.json({ ok: false, message: "quantity must be between 1 and 12" }, { status: 400 });
  }

  // Blinkit's add-to-cart accepts --quantity; zepto/bigbasket's manifest examples show a single
  // positional arg with no quantity flag documented — pass it only where it's known-supported
  // rather than guessing a flag name for the other two.
  const argv =
    site === "blinkit"
      ? ["run", "--", "webcmd", "blinkit", "add-to-cart", productId, "--quantity", String(qty)]
      : ["run", "--", "webcmd", site, "add-to-cart", productId];

  const result = await runGateCli(argv);

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate run failed" },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, raw: result.stdout.trim() });
}
