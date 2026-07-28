// Manual verification script for loadManifest() against the real webcmd install.
// Not a unit test (not named *.test.ts, so `npm test` never picks it up) — run directly:
//   npx ts-node src/webcmd/manifest.manual-check.ts
// Per docs/PROMPTS.md Phase 1d: paste real output into docs/OUTCOME.md, not a hardcoded number.
import { loadManifest } from './manifest';

const accessMap = loadManifest();

const writeCount = [...accessMap.values()].filter((a) => a === 'write').length;
console.log(`Total commands loaded: ${accessMap.size}`);
console.log(`Write-access commands: ${writeCount}`);

const blinkitPlaceOrder = accessMap.get('blinkit/place-order');
console.log(`blinkit/place-order access: ${blinkitPlaceOrder}`);

const nonsense = accessMap.get('totally-not-a-real-site/not-a-real-command');
console.log(`nonsense command lookup: ${nonsense === undefined ? 'undefined (fail-closed, correct)' : nonsense}`);
