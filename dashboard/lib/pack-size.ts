// Carries a merchant's own stated pack size into the product name.
//
// Blinkit reports it as a separate `variant` field ("500 ml", "1 L") and Zepto as `pack_size`
// ("1 pack (1 kg)"), while the name is just "Amul Taaza Toned Milk". Search results were mapped from
// the name alone, so the Deal Evaluator saw no size at all and — correctly, it must never guess
// "probably 1L" — rejected 27 of 30 real milk listings as "pack size not stated on the listing"
// (found live, 2026-09-20). The size WAS on the listing; only the mapping dropped it.
//
// Rules, all in the direction of not inventing anything:
//   • only a size the merchant actually stated (quantity + unit) is used — "1 pack" or "Pack of 2"
//     carry no size and are ignored;
//   • a size the name already states is not repeated;
//   • for "1 pack (500 ml)" the parenthesised size is the size.
//
// Hand-kept mirror of src/agents/pack-size.ts (the dashboard does not import from src/);
// scripts/check-pack-size.js fails if the two ever disagree.
const UNIT_SIZE = /\d+(?:\.\d+)?\s?(?:kg|kgs|g|gm|gms|gram|grams|l|ltr|ltrs|litre|litres|liter|liters|ml)\b/i;
const squash = (text: string): string => text.toLowerCase().replace(/[\s\-,]/g, '');

export function withPackSize(name: string, stated: unknown): string {
  if (typeof stated !== 'string') return name;
  const raw = stated.trim();
  const inner = /\(([^)]+)\)/.exec(raw)?.[1]?.trim() ?? raw;
  if (!UNIT_SIZE.test(inner)) return name;
  if (squash(name).includes(squash(inner))) return name;
  return `${name} ${inner}`;
}
