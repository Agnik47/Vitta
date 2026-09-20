// Coordinates calls that drive webcmd's browser: one at a time PER SITE, waiting out contention from
// other processes, and un-wedging the session only when a call has genuinely hung.
//
// WHAT WAS MEASURED LIVE (2026-09-20)
// -----------------------------------
//   • webcmd refuses a second command for a site while another command for that SITE is running
//     ("Session is busy: blinkit/cart (pid …) is already driving it"). Commands for DIFFERENT sites
//     do not block each other: a Blinkit and a Zepto search ran in parallel and both took 3s.
//   • Several dashboards and CLIs on one machine share that session, so this process's own queue
//     cannot prevent every collision — a refusal must be waited out, not reported as a failure.
//   • "Session is busy" means the command never started, so trying again is always safe, even for a
//     purchase. Resetting the session is different: it kills whatever is running, so it is reserved
//     for a call that hung (timed out / navigation failed) and only for repeat-safe operations.
//
// The Price Sniper, cart reads, cart writes and searches all come through here. Discovery gives each
// merchant a hard 50s, so a Blinkit search must not queue behind a Zepto one — hence per-site queues.
//
// The queues live on globalThis so every route bundle in the one Next server process shares them.
import { execFile } from "node:child_process";

interface QueueState {
  /** One promise chain per site: tasks for the same site run in order, different sites overlap. */
  tails: Map<string, Promise<void>>;
  /** Bumped whenever a write is queued. A read may only share an in-flight read from the same epoch,
   *  otherwise it could be handed a cart that predates a write that was queued in between. */
  writeEpoch: number;
}

const globalWithQueue = globalThis as typeof globalThis & { __vittaBrowserQueue2?: QueueState };
const state: QueueState = (globalWithQueue.__vittaBrowserQueue2 ??= { tails: new Map(), writeEpoch: 0 });

/** Another command holds the site. The refused command never started. */
const SITE_BUSY = /session is busy|already driving/i;
/** A command that started and then hung or lost its page — the session may be wedged. */
const HUNG = /timed out|navigation (?:failed|was interrupted)|ERR_ABORTED/i;

/** How long to keep waiting for a busy site before assuming its holder is wedged. */
export const BUSY_WAIT_MS = 40_000;
const BUSY_POLL_MS = 2_000;

export function isSiteBusy(failureText: string): boolean {
  return SITE_BUSY.test(failureText);
}

export function looksHung(failureText: string): boolean {
  return !isSiteBusy(failureText) && HUNG.test(failureText);
}

export function markBrowserWrite(): void {
  state.writeEpoch += 1;
}

export function browserWriteEpoch(): number {
  return state.writeEpoch;
}

/** Closes webcmd's shared automation session. Best effort: if webcmd is missing there is nothing to
 *  reset, and the retry will simply report the real error. */
export function resetBrowserSession(): Promise<void> {
  // On Windows an npm-installed CLI is `webcmd.cmd`, which Node will only run through a shell. The
  // command and arguments are fixed here (nothing from a request), so that is safe; elsewhere no
  // shell is involved.
  const windows = process.platform === "win32";
  return new Promise((resolve) => {
    execFile(windows ? "webcmd.cmd" : "webcmd", ["session", "close", "adapter-default"], { timeout: 15_000, shell: windows }, () => resolve());
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface BrowserTaskOptions<T> {
  /** The site this call drives (blinkit, zepto, bigbasket…). Calls for one site queue; others overlap. */
  site: string;
  /** The failure text of a result, or null when it succeeded. */
  failure: (result: T) => string | null;
  /** True only for operations that are safe to run twice (reads, absolute cart writes). Only these are
   *  re-run after a session reset. A purchase is never retried after it may have started. */
  retryable: boolean;
  /** Test seams. */
  reset?: () => Promise<void>;
  busyWaitMs?: number;
  busyPollMs?: number;
}

/**
 * Runs `task` when every earlier task for the same site has finished.
 *  1. A "site busy" refusal (another process is driving it) is waited out and retried — always safe,
 *     since the refused command never started.
 *  2. A call that HUNG triggers one session reset and one more attempt, for repeat-safe tasks only.
 *  3. If the site is still busy after the wait, its holder is presumed wedged: reset once and retry
 *     (repeat-safe tasks) — otherwise the busy failure is returned as it is.
 */
export function runBrowserTask<T>(task: () => Promise<T>, options: BrowserTaskOptions<T>): Promise<T> {
  const reset = options.reset ?? resetBrowserSession;
  const busyWaitMs = options.busyWaitMs ?? BUSY_WAIT_MS;
  const busyPollMs = options.busyPollMs ?? BUSY_POLL_MS;

  const attempt = async (): Promise<T> => {
    let result = await task();

    const deadline = Date.now() + busyWaitMs;
    for (;;) {
      const failure = options.failure(result);
      if (failure !== null && isSiteBusy(failure) && Date.now() < deadline) {
        await sleep(busyPollMs);
        result = await task();
        continue;
      }
      break;
    }

    const failure = options.failure(result);
    if (failure === null || !options.retryable) return result;
    if (isSiteBusy(failure) || looksHung(failure)) {
      await reset();
      return task();
    }
    return result;
  };

  const tail = state.tails.get(options.site) ?? Promise.resolve();
  const run = tail.then(attempt, attempt);
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  state.tails.set(options.site, settled);
  // Drop the entry once this is the last task, so the map cannot grow with one-off site names.
  void settled.then(() => {
    if (state.tails.get(options.site) === settled) state.tails.delete(options.site);
  });
  return run;
}
