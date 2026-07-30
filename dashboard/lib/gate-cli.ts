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
function loadRootEnvOverrides(): Record<string, string> {
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
export function runGateCli(argv: string[]): Promise<GateCliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath, // the same node binary running this server — never a shell-resolved "node"
      [gateCliEntryPoint(), ...argv],
      {
        cwd: getDataDir(),
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, ...loadRootEnvOverrides() },
      },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({ ok: exitCode === 0, stdout, stderr, exitCode });
      }
    );
  });
}
