// Reads env vars that must be available to SERVER-SIDE code at runtime.
//
// Why this exists: `next start` does not reliably load `.env.local` into `process.env` for the
// running server in this setup (verified — the startup log shows no "Environments" line, and
// `process.env.ANAKIN_API_KEY` came back undefined inside a route while the same key worked fine
// from a plain script). `lib/gate-cli.ts` already hit this exact problem with the PRAVA_* vars and
// solved it by parsing the env file directly; this is the same fix, shared.
//
// Precedence: a real `process.env` value always wins (so a deploy that sets vars properly is
// unaffected); the file is only a fallback.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "@/lib/read";

let cached: Record<string, string> | null = null;

function loadEnvFiles(): Record<string, string> {
  if (cached) return cached;
  const merged: Record<string, string> = {};
  // Root `.env` first, then `dashboard/.env.local` — the more specific file wins on conflict.
  const candidates = [path.join(getDataDir(), ".env"), path.join(process.cwd(), ".env.local")];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key) merged[key] = value;
    }
  }
  cached = merged;
  return merged;
}

export function runtimeEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const fromFile = loadEnvFiles()[name]?.trim();
  return fromFile || undefined;
}
