// Types and constants shared between the Price Sniper's server store and its client UI.
//
// Split out from lib/sniper-watch.ts because that module imports node:fs and spawns child
// processes — importing it from a "use client" component would drag all of that into the browser
// bundle. This file is plain data and safe on both sides.

export type ExecutionMode = "TEST" | "LIVE";

export type SniperWatchStatus =
  | "SCHEDULED"
  | "WATCHING"
  | "FIRED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED";

export interface SniperCheck {
  ts: string;
  /** Null when the check couldn't read a real price — the reason is in `note`. */
  priceInr: number | null;
  note: string;
}

export interface SniperWatch {
  id: string;
  /** Freshly minted per watch, never the browser's shop session — see mintWatchSessionId(). */
  sessionId: string;
  merchant: "blinkit";
  productId: string;
  productName: string;
  targetPriceInr: number;
  quantity: number;
  /** Absolute instants, resolved in the user's own timezone by the client before being sent. */
  windowStartIso: string;
  windowEndIso: string;
  intervalMs: number;
  mode: ExecutionMode;
  mandateId?: string;
  status: SniperWatchStatus;
  createdAt: string;
  lastCheckedAt?: string;
  lastSeenPriceInr?: number;
  checks: SniperCheck[];
  firedJobId?: string;
  failureReason?: string;
}

/** Each real check drives a browser for 20-40s, so anything below this would just queue checks
 *  behind each other while claiming a responsiveness it cannot deliver. */
export const MIN_INTERVAL_MS = 60_000;
export const DEFAULT_INTERVAL_MS = 120_000;
export const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

export const MIN_INTERVAL_MINUTES = MIN_INTERVAL_MS / 60_000;
export const DEFAULT_INTERVAL_MINUTES = DEFAULT_INTERVAL_MS / 60_000;

export const WATCH_STATUS_LABEL: Record<SniperWatchStatus, string> = {
  SCHEDULED: "Scheduled",
  WATCHING: "Watching",
  FIRED: "Fired",
  EXPIRED: "Window closed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

export function isWatchTerminal(status: SniperWatchStatus): boolean {
  return status === "FIRED" || status === "EXPIRED" || status === "CANCELLED" || status === "FAILED";
}
