# 03 — webcmd Integration

Read `00-PRODUCT-BRIEF.md` and `01-ARCHITECTURE.md` first. This file specifies how to gate real webcmd commands. Verified against a direct read of `github.com/agentrhq/webcmd` (HEAD `741b7c8`, v0.4.3).

## What webcmd is

`@agentrhq/webcmd` is a real, published npm package: a browser-automation CLI with 112 site adapters (Blinkit, Zepto, BigBasket, District, Amazon-in, Practo, Trip, etc.) and roughly 302 commands, each explicitly classified `access: 'read'` or `access: 'write'` in its own source (`src/registry.ts`). This classification is the entire hook Mandate Gate uses. Do not modify webcmd — wrap its invocation only.

## Setup

```bash
npm i -g @agentrhq/webcmd@0.4.3   # pin this version — the repo ships releases fast
webcmd doctor                     # confirms browser bridge + daemon work on this machine
webcmd profile use hack           # dedicated profile so logins persist between runs
```

Log in to each merchant site once, ahead of time, on the `hack` profile. Session expiry / OTP walls are the most common demo killer — do this the day before any rehearsal, not on the day.

## Step 1 — Load the manifest

```ts
// src/webcmd/manifest.ts
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

interface ManifestCommand {
  site: string;
  name: string;
  access: 'read' | 'write';
  args: string[];
  columns: string[];
}

export function loadManifest(cachePath = './manifest.json'): Map<string, 'read' | 'write'> {
  let manifest: ManifestCommand[];
  try {
    manifest = JSON.parse(execSync('webcmd list -f json').toString());
    writeFileSync(cachePath, JSON.stringify(manifest, null, 2));
  } catch {
    // A live-fetch failure must never crash the app. Fall back to cache.
    if (!existsSync(cachePath)) throw new Error('No manifest available, live fetch failed and no cache exists.');
    manifest = JSON.parse(readFileSync(cachePath, 'utf-8'));
  }

  const accessMap = new Map<string, 'read' | 'write'>();
  for (const c of manifest) accessMap.set(`${c.site}/${c.name}`, c.access);
  return accessMap;
}
```

webcmd's own tracked issues (#171–175) report inconsistent `-f json` output on some built-in commands. `list` is documented as the agent's source of truth and should be reliable — validate the shape once against your pinned version, and always cache to disk. During the actual demo, never call `webcmd list -f json` live — read from the cache refreshed that morning.

## Step 2 — Determine access for an incoming command

```ts
const key = `${site}/${command}`; // e.g. "blinkit/place-order"
const access = accessMap.get(key);
if (access === undefined) {
  // Rule 2 in the Policy Engine: UNKNOWN_COMMAND -> DENY, fail closed.
  // Never assume 'read' as a safe default — webcmd's own src/cli.ts:2849 shows
  // agent-generated adapters can default to access:'read' with an open TODO
  // admitting the classification may be wrong. Never trust an unknown command.
}
```

## Step 3 — Reads are free, writes go through `decide()`

```ts
if (access === 'read') {
  // ALLOW immediately. No mandate check, no ledger touch, no signature verification.
  // Still emit a GateEvent (verdict: 'ALLOW', access: 'read') for the event log.
} else {
  const decision = decide(request, mandate, ledger, new Date()); // see 04-POLICY-ENGINE-SPEC.md
}
```

## Step 4 — Extract the real amount

Never guess a cart total from prior state. Run the read command that returns the authoritative total, then feed that number into `decide()`:

```ts
// Reads are free (Step 3), so this costs nothing.
const cartResult = execSync('webcmd blinkit cart -f json').toString();
const { total } = JSON.parse(cartResult); // authoritative total_inr
```

## Step 5 — Execute an ALLOW

```ts
// src/webcmd/executor.ts
import { spawn } from 'node:child_process';

export function execute(site: string, command: string, args: string[]): Promise<{ runId: string; columns: any; tracePath: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('webcmd', [site, command, ...args, '--trace', 'retain-on-failure', '-f', 'json']);
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`webcmd exited ${code}`));
      const result = JSON.parse(stdout);
      resolve({ runId: result.runId, columns: result.columns, tracePath: result.tracePath });
    });
  });
}
```

**Bind the ledger draw to `runId`.** If the same `runId` reappears (a retry, a re-submit), do not call `Ledger.draw()` a second time — check `ledger.jsonl` for that `runId` first. This is the exactly-once story, and it builds on webcmd's own lease semantics (`src/session-lease.ts` already refuses to release a lease on an unknown outcome).

## Command reference used in the demo

| Command | Access | Purpose |
|---|---|---|
| `blinkit search "<query>"` | read | free, no gate check |
| `blinkit add-to-cart` | write | gated, but ₹0 committed until checkout |
| `blinkit cart` | read | authoritative total — always call before place-order |
| `blinkit place-order --confirm` | write | the gated action — this is what gets ALLOW/DENY |
| `district locations` | read | second live-session sanity check |
| `district checkout` | write | stops at the "payment handoff page" per webcmd's own source |

## Error handling required

- **`AuthRequiredError`** (webcmd's typed error for expired sessions/OTP walls): treat as write access and deny by default. Do not try to distinguish "auth expired" from "malicious" — fail closed either way.
- **Malformed manifest JSON:** fall back to cache, never crash.
- **`webcmd` process hangs:** do not restart mid-demo. The reserve stays blocked, nothing was drawn — this is correct, narratable behavior.

## Do not

- Modify webcmd's source. Use it exactly as published, via its CLI and JSON output contracts.
- Implement browser automation directly — all browser control goes through webcmd's adapters.
- Patch around the known `access:'read'` default-classification hole in generated adapters (`src/cli.ts:2849`) — defend against it at the policy layer instead, by failing closed on anything not explicitly found in the manifest.
