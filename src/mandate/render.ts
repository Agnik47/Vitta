// renderConsent(mandate) -> human sentence. See docs/04-POLICY-ENGINE-SPEC.md § renderConsent().
//
// Deviates from that section's plain `.join(', ')` code sketch in two ways, both because
// docs/05-DEMO-SCRIPT.md Beat 2's exact expected output — "Blinkit, Zepto or BigBasket" — needs
// them, and docs/AGENTS.md § UI rules treats the demo script's terminal output as exact, not
// illustrative. See docs/OUTCOME.md Phase 1a for the full note:
//   1. A grammatical "a, b or c" join, not a flat comma-separated list.
//   2. A brand-name lookup for merchants whose display name isn't a simple capitalization of
//      their webcmd site key (bigbasket -> BigBasket, not Bigbasket).
import type { Mandate } from './schema';

const BRAND_NAMES: Record<string, string> = {
  blinkit: 'Blinkit',
  zepto: 'Zepto',
  bigbasket: 'BigBasket',
  district: 'District',
};

export function renderConsent(m: Mandate): string {
  const merchants = joinWithOr(m.scope.merchants.map(brandName));
  const time = new Date(m.scope.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${m.subject} may spend up to ₹${m.scope.cap_inr} at ${merchants}, in one transaction, before ${time} today.`;
}

function brandName(site: string): string {
  return BRAND_NAMES[site] ?? capitalize(site);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinWithOr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}
