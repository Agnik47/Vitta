// A per-browser-tab session id, minted once into sessionStorage (not localStorage — the whole point
// is that it does NOT survive a browser restart, matching cart-context.tsx's own move to
// sessionStorage). Used to scope which merchants' real carts have already been cleared this
// session, so a purchase never silently pays for items from a previous session — but multiple
// purchases WITHIN one session accumulate normally (only the first one per merchant clears first).
const KEY = "vitta-shop-session";
const SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/;

export function getShopSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing && SESSION_ID_PATTERN.test(existing)) return existing;
  } catch {
    // Storage unavailable — fall through to minting an ephemeral one that just won't persist
    // across a reload. Still safe: it only affects clear-cart-once bookkeeping, never correctness.
  }
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // Ignore — see above.
  }
  return id;
}

export function isValidShopSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}
