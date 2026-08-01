// Price Sniper: watches ONE real Blinkit product's live price during a time window and fires the
// real purchase pipeline the first time the price lands at or below a target.
//
// The watch does not implement any purchasing of its own. When it fires it calls the same
// startPurchaseJob() the cart's "Proceed to purchase" button calls, so the mandate gate, cart
// verification, Dodo draw and receipt signing are all the real, single, audited path — the sniper
// only decides WHEN to pull the trigger, never what the trigger does.
//
// Store shape (Map + JSON file, load-at-init) deliberately mirrors lib/purchase-job.ts.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getBlinkitProductDetail } from "./live-search";
import { getPurchaseJob, startPurchaseJob } from "./purchase-job";
import { isWatchTerminal, type ExecutionMode, type SniperWatch } from "./sniper-shared";

export { MIN_INTERVAL_MS, DEFAULT_INTERVAL_MS, MAX_WINDOW_MS } from "./sniper-shared";
export type { SniperWatch, SniperWatchStatus, SniperCheck } from "./sniper-shared";

const TICK_MS = 15_000;
const MAX_WATCHES = 100;
const MAX_CHECKS_PER_WATCH = 200;
const STORAGE_FILE = path.join(process.cwd(), "sniper_watches_store.json");

// The store and the ticker both live on globalThis, and they have to travel together.
//
// Under `next dev` this module is re-evaluated on every hot reload. Guarding only the timer would
// keep the FIRST instance's timer alive while route handlers wrote into a LATER instance's Map —
// the ticker would then be watching a Map nobody adds to, and a newly created watch would simply
// never be checked. Guarding only the Map would leak a timer per reload, and each leaked timer
// could independently decide to fire, which in LIVE mode means one price drop placing several real
// orders. Sharing both is what makes "exactly one ticker, over the one real store" true.
//
// Known limitation: globalThis is per-process, so clustering would give each worker its own ticker
// — the same single-instance assumption lib/purchase-job.ts already makes.
interface SniperGlobal {
  watches?: Map<string, SniperWatch>;
  /** In-flight guard, deliberately NOT persisted: a check that was running when the process died
   *  is not running any more, so this must never be restored from disk. */
  checking?: Set<string>;
  ticker?: ReturnType<typeof setInterval>;
  initialized?: boolean;
}

const g = globalThis as unknown as { __vittaSniper?: SniperGlobal };
g.__vittaSniper ??= {};
const store = g.__vittaSniper;

store.watches ??= new Map<string, SniperWatch>();
store.checking ??= new Set<string>();

const watches = store.watches;
const checking = store.checking;

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return;
    const list: SniperWatch[] = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    for (const w of list) watches.set(w.id, w);
  } catch {
    // Corrupt store — start fresh rather than crash the server on boot.
  }
}

function persist(): void {
  try {
    const list = Array.from(watches.values()).slice(-MAX_WATCHES);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // Disk write failed — keep serving from memory rather than losing the watch entirely.
  }
}

function recordCheck(watch: SniperWatch, priceInr: number | null, note: string): void {
  watch.checks.push({ ts: new Date().toISOString(), priceInr, note });
  if (watch.checks.length > MAX_CHECKS_PER_WATCH) {
    watch.checks = watch.checks.slice(-MAX_CHECKS_PER_WATCH);
  }
  watch.lastCheckedAt = new Date().toISOString();
  if (priceInr !== null) watch.lastSeenPriceInr = priceInr;
}

/**
 * Reconciles watches that claim to have fired but have no real job behind them — the only way the
 * store can lie after an interrupted process. Such a watch must never go back to WATCHING: it might
 * genuinely have fired, and resuming it could buy the same thing twice. FAILED says honestly that
 * we don't know, which is the true state.
 */
function reconcileOnStartup(): void {
  let changed = false;
  for (const watch of watches.values()) {
    if (watch.status !== "FIRED") continue;
    if (watch.firedJobId && getPurchaseJob(watch.firedJobId)) continue;
    watch.status = "FAILED";
    watch.failureReason =
      "Recorded as fired but no purchase job was found for it — the server was interrupted mid-fire. " +
      "Check your real Blinkit orders and receipts before creating another watch for this product.";
    changed = true;
  }
  if (changed) persist();
}

// Guarded on the same shared object: re-reading the file on every hot reload would resurrect a
// watch that was cancelled since the process started, because the store in memory is the live one.
if (!store.initialized) {
  store.initialized = true;
  loadFromDisk();
  reconcileOnStartup();
}

// --------------------------------------------------------------------------------------------
// The ticker
// --------------------------------------------------------------------------------------------

async function runCheck(watch: SniperWatch): Promise<void> {
  try {
    const result = await getBlinkitProductDetail(watch.productId);

    // Re-read from the store: this check took 20-40s, during which the watch may have been
    // cancelled. Acting on the stale object would fire a watch the user already called off.
    const current = watches.get(watch.id);
    if (!current || current.status !== "WATCHING") return;

    if (!result.ok) {
      recordCheck(current, null, result.authRequired ? `Not logged in to Blinkit — ${result.error}` : result.error);
      persist();
      return;
    }

    const { product } = result;
    if (!product.available) {
      recordCheck(current, product.priceInr, `₹${product.priceInr} but out of stock — not buying`);
      persist();
      return;
    }

    if (product.priceInr > current.targetPriceInr) {
      recordCheck(current, product.priceInr, `₹${product.priceInr} — above target ₹${current.targetPriceInr}`);
      persist();
      return;
    }

    // The window is re-checked here, not just in tick(): this check may have started inside the
    // window and finished outside it, and a purchase must never be placed past the window the
    // human authorized.
    if (Date.now() > new Date(current.windowEndIso).getTime()) {
      current.status = "EXPIRED";
      recordCheck(current, product.priceInr, `₹${product.priceInr} hit target, but the window closed mid-check — not buying`);
      persist();
      return;
    }

    fire(current, product.priceInr);
  } finally {
    checking.delete(watch.id);
  }
}

/** Starts the real purchase. Status and job id are written together so the store can never claim
 *  a fire that has no job behind it. */
function fire(watch: SniperWatch, priceInr: number): void {
  recordCheck(watch, priceInr, `₹${priceInr} at or below target ₹${watch.targetPriceInr} — firing purchase`);
  try {
    const job = startPurchaseJob(watch.sessionId, {
      merchant: "blinkit",
      items: [{ product: watch.productId, productName: watch.productName, quantity: watch.quantity }],
      mandateId: watch.mandateId,
      mode: watch.mode,
    });
    watch.status = "FIRED";
    watch.firedJobId = job.id;
  } catch (err) {
    watch.status = "FAILED";
    watch.failureReason = `Could not start the purchase: ${(err as Error).message}`;
  }
  persist();
}

function tick(): void {
  const now = Date.now();
  const due: SniperWatch[] = [];
  let changed = false;

  // One synchronous pass: every eligible watch is flagged before any check starts, so a slow check
  // can't leave a later watch unflagged and eligible again on the next tick.
  for (const watch of watches.values()) {
    if (isWatchTerminal(watch.status)) continue;

    const start = new Date(watch.windowStartIso).getTime();
    const end = new Date(watch.windowEndIso).getTime();

    if (now > end) {
      watch.status = "EXPIRED";
      changed = true;
      continue;
    }
    if (now < start) continue;

    if (watch.status === "SCHEDULED") {
      watch.status = "WATCHING";
      changed = true;
    }
    if (checking.has(watch.id)) continue;

    const last = watch.lastCheckedAt ? new Date(watch.lastCheckedAt).getTime() : 0;
    if (now - last < watch.intervalMs) continue;

    checking.add(watch.id);
    due.push(watch);
  }

  if (changed) persist();
  // Dispatched, never awaited in the loop: a real check takes 20-40s, so awaiting them in sequence
  // would stretch every watch's true interval by the number of watches ahead of it.
  for (const watch of due) void runCheck(watch);
}

// Exactly one ticker per process, over the shared store declared above. See that comment for why
// the timer and the Map must be guarded together rather than separately.
if (!store.ticker) {
  store.ticker = setInterval(tick, TICK_MS);
  // Never hold the process open just to poll prices.
  store.ticker.unref?.();
}

// --------------------------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------------------------

export interface CreateWatchInput {
  productId: string;
  productName: string;
  targetPriceInr: number;
  quantity: number;
  windowStartIso: string;
  windowEndIso: string;
  intervalMs: number;
  mode: ExecutionMode;
  mandateId?: string;
}

/**
 * Each watch gets its own session id rather than the browser's. startPurchaseJob() only clears a
 * merchant's cart the first time it sees a session, so reusing the human's session would let a
 * sniper buy whatever they happened to leave in the cart alongside the watched product. A fresh id
 * guarantees the fired job clears first and buys exactly one thing: the product being watched.
 */
function mintWatchSessionId(): string {
  return randomUUID();
}

export function createWatch(input: CreateWatchInput): SniperWatch {
  if (watches.size >= MAX_WATCHES) {
    const oldest = watches.keys().next();
    if (!oldest.done) watches.delete(oldest.value);
  }

  const now = Date.now();
  const watch: SniperWatch = {
    id: randomUUID(),
    sessionId: mintWatchSessionId(),
    merchant: "blinkit",
    productId: input.productId,
    productName: input.productName,
    targetPriceInr: input.targetPriceInr,
    quantity: input.quantity,
    windowStartIso: input.windowStartIso,
    windowEndIso: input.windowEndIso,
    intervalMs: input.intervalMs,
    mode: input.mode,
    mandateId: input.mandateId,
    status: now >= new Date(input.windowStartIso).getTime() ? "WATCHING" : "SCHEDULED",
    createdAt: new Date().toISOString(),
    checks: [],
  };

  watches.set(watch.id, watch);
  persist();
  return watch;
}

export function getWatch(watchId: string): SniperWatch | undefined {
  return watches.get(watchId);
}

export function listWatches(): SniperWatch[] {
  return Array.from(watches.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cancelWatch(watchId: string): SniperWatch | undefined {
  const watch = watches.get(watchId);
  if (!watch) return undefined;
  // A fired watch has a real purchase behind it; cancelling here would only hide it, not stop it.
  if (isWatchTerminal(watch.status)) return watch;
  watch.status = "CANCELLED";
  persist();
  return watch;
}
