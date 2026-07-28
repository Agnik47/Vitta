// Two-pane terminal layout for `gate run`: agent pane left, gate decision log right, a status
// strip along the bottom showing RESERVE and SETTLEMENT state. Plain ANSI, no TUI framework, per
// docs/AGENTS.md § Styling rules ("fall back to manual ANSI escape codes only in src/cli/ui.ts").
//
// Pure rendering functions — take data, return formatted strings — so they're unit-testable
// without a live webcmd session or an attached terminal. `gate run` (still blocked on Phase 1c,
// see docs/OUTCOME.md Phase 1f) is this module's real caller; not wired yet.
import type { GateEvent } from '../events/GateEvent';
import { formatInr } from '../mandate/currency';

const ANSI = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function verdictColor(verdict: GateEvent['verdict']): string {
  if (verdict === 'ALLOW') return ANSI.green;
  if (verdict === 'DENY') return ANSI.red;
  return ANSI.yellow; // STEP_UP
}

/** One line for the gate-decision-log pane (right side). Color-coded per docs/AGENTS.md's
 * verdict convention — ALLOW green, DENY red, STEP_UP yellow, matching the dashboard's badges. */
export function formatGateEventLine(event: GateEvent): string {
  const color = verdictColor(event.verdict);
  const suffix = event.verdict === 'DENY' && event.code ? ` · ${event.code}` : '';
  const amount = event.amount_inr !== undefined ? ` · ₹${formatInr(event.amount_inr)}` : '';
  return `${color}${ANSI.bold}${event.verdict}${ANSI.reset}${color}  ${event.command}${suffix}${amount}${ANSI.reset}`;
}

/** One line for the agent pane (left side) — plain, no color, matches "AGENT" column in
 * docs/05-DEMO-SCRIPT.md's beats. docs/AGENTS.md's color convention only names the GATE
 * (verdict) side; nothing calls for styling the agent pane. */
export function formatAgentLine(command: string): string {
  return `› ${command}`;
}

/** The bottom status strip showing RESERVE and SETTLEMENT state. reserveInr is null before a
 * mandate has been funded; settlement is a short label ("test mode", "captured", etc.). */
export function formatStatusStrip(reserveInr: number | null, settlement: string): string {
  const reserve = reserveInr === null ? 'unfunded' : `₹${formatInr(reserveInr)}`;
  return `${ANSI.dim}RESERVE ${ANSI.reset}${reserve}  ${ANSI.dim}SETTLEMENT ${ANSI.reset}${settlement}`;
}

/**
 * Lays out the agent pane and gate-decision pane side by side, using terminal width if attached
 * (falls back to 100 columns when not — e.g. output piped to a file, or under `node --test`).
 * Each pane wraps independently; rows pad to align. This is the one place in the codebase that
 * reads process.stdout.columns, kept isolated here so the rest of ui.ts stays pure/testable.
 */
export function renderTwoPane(agentLines: string[], gateLines: string[], statusStrip: string): string {
  const totalWidth = process.stdout.columns && process.stdout.columns > 20 ? process.stdout.columns : 100;
  const gap = 2;
  const leftWidth = Math.floor((totalWidth - gap) / 2);
  const rightWidth = totalWidth - gap - leftWidth;

  const rowCount = Math.max(agentLines.length, gateLines.length);
  const rows: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const left = padVisible(agentLines[i] ?? '', leftWidth);
    const right = padVisible(gateLines[i] ?? '', rightWidth);
    rows.push(`${left}${' '.repeat(gap)}${right}`);
  }

  const header = `${ANSI.bold}${padVisible('AGENT', leftWidth)}${' '.repeat(gap)}${padVisible('GATE', rightWidth)}${ANSI.reset}`;
  const separator = '-'.repeat(totalWidth);
  return [header, ...rows, separator, statusStrip].join('\n');
}

/** Pads a string to a visible-character width, ignoring ANSI escape sequences so color codes
 * don't throw off column alignment. */
function padVisible(text: string, width: number): string {
  const visibleLength = text.replace(/\x1b\[[0-9;]*m/g, '').length;
  const padding = Math.max(0, width - visibleLength);
  return text + ' '.repeat(padding);
}
