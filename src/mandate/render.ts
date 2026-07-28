// renderConsent(mandate) -> human sentence. See docs/04-POLICY-ENGINE-SPEC.md § renderConsent().
//
// Deviates from that section's plain `.join(', ')` code sketch in three ways, all because
// docs/05-DEMO-SCRIPT.md Beat 2's exact expected output needs them, and docs/AGENTS.md § UI rules
// treats the demo script's terminal output as exact, not illustrative. See docs/OUTCOME.md Phase
// 1a and 1f for the full notes:
//   1. A grammatical "a, b or c" join, not a flat comma-separated list.
//   2. A brand-name lookup for merchants whose display name isn't a simple capitalization of
//      their webcmd site key (bigbasket -> BigBasket, not Bigbasket).
//   3. (Found in Phase 1f, running this for real) the spec's own toLocaleTimeString() options
//      produce "06:00 pm" on this Node/ICU version (77.1) — a leading zero and lowercase am/pm —
//      not Beat 2's "6:00 PM". Switched hour: '2-digit' to 'numeric' (drops the leading zero) and
//      uppercase the am/pm marker explicitly; en-IN's default AM/PM casing isn't something the
//      Intl options alone can control.
import type { Mandate } from './schema';
import { formatInr } from './currency';

const BRAND_NAMES: Record<string, string> = {
  blinkit: 'Blinkit',
  zepto: 'Zepto',
  bigbasket: 'BigBasket',
  district: 'District',
};

export function renderConsent(m: Mandate): string {
  const merchants = joinWithOr(m.scope.merchants.map(brandName));
  const time = formatTime(new Date(m.scope.expires_at));
  return `${m.subject} may spend up to ₹${formatInr(m.scope.cap_inr)} at ${merchants}, in one transaction, before ${time} today.`;
}

function formatTime(date: Date): string {
  const raw = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return raw.replace(/\b(am|pm)\b/i, (marker) => marker.toUpperCase());
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
