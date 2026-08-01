// Loads the Price Sniper watcher at process boot.
//
// Without this, lib/sniper-watch.ts only evaluates when some route first imports it — so after a
// server restart, a watch already inside its time window would sit unchecked until someone happened
// to open the sniper page. A watch that only runs while you're looking at it isn't a watch.
export async function register(): Promise<void> {
  // Node runtime only — the module spawns child processes and touches the filesystem, neither of
  // which exists on the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./lib/sniper-watch");
}
