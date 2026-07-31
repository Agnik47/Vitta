// Narrow, read-only product-search entry point — deliberately NOT part of gate.ts's dispatch.
// Search has no mandate, no money, no decide() involvement (same category as any other
// `access: 'read'` webcmd command — ADR-003 already established reads bypass the mandate/signature
// layer entirely). Callers (dashboard/lib/live-search.ts) spawn this compiled file directly, the
// same safe no-shell pattern gate-cli.ts already uses for the real gate CLI.
//
// Deliberately does NOT reuse webcmd/executor.ts's execute(): that function forces `--trace on`
// (real, ~1-2MB-per-call disk cost — justified for money-moving actions that need audit evidence,
// pointless for a plain search) and swallows stderr on failure, which would hide the one thing a
// search caller actually needs to distinguish: "not logged in" vs. "no results" vs. "webcmd error."
// Reuses resolveWebcmdCommand() (the hard-won Windows-safe spawn resolution, ADR-007) directly.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveWebcmdCommand } from '../webcmd/executor';
import { resolveCartTotalInr, type CartLineRow } from '../webcmd/cart-total';

interface ManifestCommand {
  site: string;
  name: string;
  access: 'read' | 'write';
}

function isReadCommand(site: string, command: string): boolean {
  // Cache-only, deliberately never a live `webcmd list` refetch — docs/03-WEBCMD-INTEGRATION.md
  // is explicit that a live manifest refetch mid-demo is unsafe/slow; a search request is exactly
  // the kind of frequent call that must never trigger one.
  const manifestPath = path.resolve(__dirname, '..', '..', 'manifest.json');
  if (!existsSync(manifestPath)) return false;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ManifestCommand[];
  return manifest.some((c) => c.site === site && c.name === command && c.access === 'read');
}

function fail(message: string): never {
  process.stdout.write(JSON.stringify({ ok: false, message }));
  process.exit(1);
}

async function main(): Promise<void> {
  const [site, command, ...args] = process.argv.slice(2);
  if (!site || !command) fail('usage: search.js <site> <command> [arg]');

  // Hard restriction enforced here, not just by the caller's convention — this file must never be
  // able to reach a write/spend command regardless of what a future caller passes.
  if (!isReadCommand(site, command)) fail(`${site}/${command} is not a known read-access command`);

  const { command: cmd, prefixArgs } = resolveWebcmdCommand();
  const proc = spawn(cmd, [...prefixArgs, site, command, ...args, '-f', 'json']);
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => (stdout += d));
  proc.stderr.on('data', (d) => (stderr += d));
  proc.on('close', (code) => {
    if (code !== 0) {
      const reason = stderr.trim() || `webcmd exited ${code}`;
      const authRequired = /auth|login|not.?logged.?in/i.test(reason);
      process.stdout.write(JSON.stringify({ ok: false, message: reason, authRequired }));
      process.exit(1);
    }
    try {
      const rows = JSON.parse(stdout);

      // For a cart read, also resolve the total the same way gate.ts prices a commit. The number is
      // computed HERE, with the gate's own resolver, so the purchase UI can show the user exactly
      // the figure decide() will be handed — a second, subtly different sum computed in the
      // dashboard would be worse than showing none at all. (The dashboard mirrors src/ types by
      // hand rather than importing them — see docs/06-DASHBOARD-SPEC.md — so the shared logic has
      // to live on this side of the boundary.)
      if (command === 'cart' && Array.isArray(rows)) {
        let cartTotalInr: number | undefined;
        let cartItemCount = 0;
        let cartTotalError: string | undefined;
        try {
          const resolution = resolveCartTotalInr(undefined, rows as CartLineRow[]);
          cartTotalInr = resolution.amountInr;
          cartItemCount = resolution.itemCount;
        } catch (err) {
          // An empty or ₹0 cart throws by design. That's a fact to report, not a total to invent.
          cartTotalError = (err as Error).message;
        }
        process.stdout.write(JSON.stringify({ ok: true, rows, cartTotalInr, cartItemCount, cartTotalError }));
        return;
      }

      process.stdout.write(JSON.stringify({ ok: true, rows }));
    } catch {
      process.stdout.write(JSON.stringify({ ok: false, message: 'Could not parse webcmd output' }));
      process.exit(1);
    }
  });
  proc.on('error', (err) => fail(err.message));
}

main();
