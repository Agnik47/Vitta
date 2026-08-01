// Spawns the real `gate` CLI as a subprocess — the ONLY way any dashboard write route is allowed
// to create a mandate, fund a reserve, or execute a spend. See CLAUDE.md rule 8 (superseded
// 2026-07-30, ADR-015): a write route must never reimplement decide()/execution logic itself, so
// this file exists to be the single choke point every new write route goes through.
//
// Security: execFile with an argument array, no shell — the exact pattern src/webcmd/executor.ts's
// execute() already established (ADR-007) after finding that `{ shell: true }` on this kind of
// process-spawning path is a real command-injection hole. Every argument here can originate from a
// browser request, so this is not optional hardening — it's the actual security boundary.
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "@/lib/read";

export interface GateCliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

// The real `gate` CLI colors its DENY/ALLOW/STEP_UP output for a terminal (src/cli/ui.ts) — raw
// \x1b[..m escape codes. Found live, 2026-08-01: a DENY reached the browser as literal garbled
// escape-code text in a toast ("Could not add to real cart" showing "\x1b[31m\x1b[1mDENY..."),
// because nothing between the spawned CLI and the JSON response ever stripped them. Every route
// reads stdout/stderr through this one function, so stripping here fixes it everywhere at once.
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

// Known decide()/gate.ts deny/failure shapes, mapped to plain language a shopper (not a CLI
// operator) can act on. Purely a display translation — the real verdict/code always comes from
// the one real decide() call inside gate.ts; nothing here re-decides anything (CLAUDE.md rule 8 /
// ADR-015 still holds — this only rewrites how an existing denial is described).
export function friendlyGateFailureMessage(raw: string): string {
  if (/No mandates found/i.test(raw)) {
    return "No spending mandate exists yet — create one before adding items to the cart.";
  }
  if (/·\s*EXPIRED\b/.test(raw)) {
    return "Your spending mandate has expired — create a new mandate before adding items to the cart.";
  }
  if (/·\s*BAD_SIGNATURE\b/.test(raw)) {
    return "Your mandate's signature failed verification — create a new mandate before continuing.";
  }
  if (/·\s*MERCHANT_NOT_ALLOWED\b/.test(raw)) {
    return "This merchant isn't included in your current mandate's scope.";
  }
  if (/·\s*TXN_LIMIT_REACHED\b/.test(raw)) {
    return "This mandate has reached its maximum number of transactions — create a new mandate to continue.";
  }
  return raw;
}

function gateCliEntryPoint(): string {
  return path.join(getDataDir(), "dist", "cli", "gate.js");
}

/**
 * The spawned `gate` CLI needs the same DODO_* vars the CLI reads when a human runs it directly
 * from a shell that's sourced `.env` — but the dashboard's own Next.js process may never have
 * loaded that file (no dashboard/.env.local exists on every machine this runs on). Rather than
 * assume the parent process's env already has these, read the root .env explicitly and merge it
 * in for just this child process. Simple KEY=value parsing only — matches this repo's actual
 * .env format (see CLAUDE.md's own `.env.example`), no quoting/multiline support needed.
 */
// Exported so lib/agent-cli.ts can spawn dist/cli/agent.js with the same real env resolution,
// rather than re-deriving this DODO_*-loading logic a second time.
export function loadRootEnvOverrides(): Record<string, string> {
  const envPath = path.join(getDataDir(), ".env");
  if (!existsSync(envPath)) return {};
  const overrides: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) overrides[key] = value;
  }
  return overrides;
}

/**
 * Runs `node dist/cli/gate.js <argv...>` with the repo root as cwd (so the CLI's own relative
 * paths for mandates/receipts/keys resolve exactly as they do when a human runs `gate` directly).
 * Never rejects on a non-zero exit — a DENY/STEP_UP is a normal, expected result, not a fault of
 * this function, so callers inspect `ok`/`exitCode` rather than catching.
 */
export function runGateCli(argv: string[], timeoutMs = 60_000): Promise<GateCliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath, // the same node binary running this server — never a shell-resolved "node"
      [gateCliEntryPoint(), ...argv],
      {
        cwd: getDataDir(),
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, ...loadRootEnvOverrides() },
      },
      (error, stdout, stderr) => {
        // A timeout is NOT the same as a DENY, and must never be reported as one — the browser
        // action may well still be in flight. Say so explicitly rather than letting the caller read
        // an empty stdout as "nothing happened". (Same lesson as the search CLI's 20s timeout,
        // which silently looked identical to "the merchant returned nothing".)
        if (error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
          resolve({
            ok: false,
            stdout: stripAnsi(stdout),
            stderr: `gate CLI timed out after ${Math.round(timeoutMs / 1000)}s — the browser action may still be in progress; check events.jsonl before retrying`,
            exitCode: 124,
          });
          return;
        }
        const exitCode = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({ ok: exitCode === 0, stdout: stripAnsi(stdout), stderr: stripAnsi(stderr), exitCode });
      }
    );
  });
}
