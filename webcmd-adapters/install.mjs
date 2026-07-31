// Installs this repo's webcmd adapter overrides into ~/.webcmd/clis/, which webcmd loads AFTER
// its packaged adapters (dist/src/main.js discovers BUILTIN_CLIS then USER_CLIS, and
// registerCommand is last-write-wins) — so a file here shadows the packaged command without
// modifying the installed package or breaking its tests.
//
//   node webcmd-adapters/install.mjs          install / update
//   webcmd adapter reset blinkit              undo (restores packaged behaviour)
//
// utils.js is copied verbatim from the installed package because place-order.js imports it
// relatively; it is unmodified, and re-running this script re-syncs it after a webcmd upgrade.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const userClis = path.join(os.homedir(), '.webcmd', 'clis');

function packagedBlinkitDir() {
  // shell:true is safe — fixed command, fixed args, nothing interpolated.
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf-8', shell: true }).trim();
  return path.join(globalRoot, '@agentrhq', 'webcmd', 'clis', 'blinkit');
}

const targetDir = path.join(userClis, 'blinkit');
fs.mkdirSync(targetDir, { recursive: true });

// The override itself.
const override = path.join(here, 'blinkit', 'place-order.js');
fs.copyFileSync(override, path.join(targetDir, 'place-order.js'));
console.log(`installed  ${path.join(targetDir, 'place-order.js')}`);

// Its sibling dependency, taken from whatever webcmd version is installed right now.
const packaged = packagedBlinkitDir();
const utils = path.join(packaged, 'utils.js');
if (!fs.existsSync(utils)) {
  console.error(`\nCould not find ${utils} — is @agentrhq/webcmd installed globally?`);
  process.exit(1);
}
fs.copyFileSync(utils, path.join(targetDir, 'utils.js'));
console.log(`synced     ${path.join(targetDir, 'utils.js')} (verbatim from the installed package)`);

console.log('\nVerify with:  node webcmd-adapters/blinkit/place-order.verify.mjs');
console.log('Dry-run live: webcmd blinkit place-order --advance-only -f json');
