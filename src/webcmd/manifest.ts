// loads + caches `webcmd list -f json` — Phase 1d, see docs/03-WEBCMD-INTEGRATION.md § Step 1
//
// Real `webcmd list -f json` output (v0.4.3, checked 2026-07-29) carries far more fields per
// command than the spec's sketch (command, aliases, description, strategy, browser, columns,
// domain, example, defaultFormat, siteSession) — only site/name/access are consumed here.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

interface ManifestCommand {
  site: string;
  name: string;
  access: 'read' | 'write';
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
