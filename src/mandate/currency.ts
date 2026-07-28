// formatInr(): Indian Rupee amount formatting (lakh/crore digit grouping), used everywhere an INR
// amount is displayed. docs/05-DEMO-SCRIPT.md's example amounts (₹1,412, ₹1,500) are grouped this
// way — found while running `gate mandate resign` for real in Phase 1f and noticing "₹1500"
// instead of the demo's "₹1,500". Built on Intl.NumberFormat('en-IN'), correct out of the box,
// zero new dependency. See docs/OUTCOME.md Phase 1f.
const formatter = new Intl.NumberFormat('en-IN');

export function formatInr(amountInr: number): string {
  return formatter.format(amountInr);
}
