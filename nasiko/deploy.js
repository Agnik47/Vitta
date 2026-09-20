#!/usr/bin/env node
// Stages a self-contained Nasiko project for each Vitta agent and (unless --dry-run) deploys it.
// Node, so it runs the same on macOS, Linux and Windows — it replaces the bash + python3 + curl + zip
// script (nasiko/deploy.sh is now a one-line wrapper around this file).
//
//   node nasiko/deploy.js [planner|discovery|evaluator|purchase|all] [--dry-run | --upload]
//
//   (default)   `nasiko validate && nasiko deploy` per agent — needs the Rust `nasiko` CLI.
//   --dry-run   stage only.
//   --upload    no CLI needed: zips each staged project and POSTs it to a running control plane's
//               `POST /api/import/upload` (the language-agnostic import; `/api/agents/upload` insists on
//               a Python main.py and would reject these Node agents). Nasiko builds and starts the image.
//               `all` skips `purchase` here — it needs the gate's local state, see nasiko/README.md.
//                 NASIKO_URL          control plane, default http://localhost:8080
//                 NASIKO_TOKEN        bearer token, or:
//                 NASIKO_PASSWORD     log in as NASIKO_USERNAME (default admin) to get one
//                 VITTA_DASHBOARD_URL optional; set as a secret on the discovery agent, which is then
//                                     redeployed (a container only receives secrets when it is deployed,
//                                     and does not read .env — from Docker Desktop the host is
//                                     http://host.docker.internal:<port>)
//               Re-running for an agent Nasiko already holds redeploys it as the next patch version
//               (Nasiko refuses to re-import a version it has seen).
//
// Each agent needs its own project directory (AgentCard.json + Dockerfile + source) because
// `nasiko deploy <dir>` builds a directory. The agents share one codebase, so this assembles one
// directory per agent from the compiled output rather than keeping four copies in git.
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createZip, collectFiles } = require('./zip');

const ROOT = path.resolve(__dirname, '..');
const AGENT_NAMES = {
  planner: 'vitta-shopping-planner',
  discovery: 'vitta-deal-discovery',
  evaluator: 'vitta-deal-evaluator',
  purchase: 'vitta-purchase-agent',
};

function parseArgs(argv) {
  let which = 'all';
  let mode = 'cli';
  for (const arg of argv) {
    if (arg === '--dry-run') mode = 'dry';
    else if (arg === '--upload') mode = 'upload';
    else which = arg;
  }
  return { which, mode };
}

/** Compares two "1.2.3" versions. */
function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
}

/** An import of a version Nasiko already holds is refused (409), and a container only gets new secrets
 *  when it is redeployed — so a re-run, or a secret change, ships as the next patch version. */
function bumpCardVersion(stageDir, floor) {
  const file = path.join(stageDir, 'AgentCard.json');
  const card = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (compareVersions(card.version, floor) <= 0) {
    const [major, minor, patch] = floor.split('.').map(Number);
    card.version = `${major}.${minor}.${patch + 1}`;
    fs.writeFileSync(file, JSON.stringify(card, null, 2));
  }
  return card.version;
}

/** Runs a fixed command. On Windows npm is `npm.cmd`, which Node only runs through a shell — safe here:
 *  every argument is a literal in this file. */
function run(command, args, options = {}) {
  const win = process.platform === 'win32';
  const result = spawnSync(win && command === 'npm' ? 'npm.cmd' : command, args, { stdio: 'inherit', shell: win && command === 'npm', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

class Nasiko {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = '';
  }

  async login(env) {
    if (env.NASIKO_TOKEN) {
      this.token = env.NASIKO_TOKEN;
      return;
    }
    if (!env.NASIKO_PASSWORD) throw new Error('set NASIKO_TOKEN, or NASIKO_PASSWORD (and NASIKO_USERNAME, default admin)');
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: env.NASIKO_USERNAME || 'admin', password: env.NASIKO_PASSWORD }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`login failed (HTTP ${res.status})`);
    this.token = ((await res.json()) || {}).token || '';
  }

  auth() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async findAgent(name) {
    const res = await fetch(`${this.baseUrl}/api/agents`, { headers: this.auth(), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`listing agents failed (HTTP ${res.status})`);
    const body = await res.json();
    const agent = (Array.isArray(body) ? body : body.agents || []).find((a) => a.name === name);
    return agent ? { id: agent.id, version: agent.version || '0.0.0' } : undefined;
  }

  async setSecret(agentId, name, value) {
    const res = await fetch(`${this.baseUrl}/api/agents/${agentId}/secrets`, {
      method: 'POST',
      headers: { ...this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`setting secret ${name} failed (HTTP ${res.status})`);
  }

  /** Zips a staged project and uploads it. The import builds the image before it answers, which can take
   *  minutes on a first build — so this uses node:http with a long socket timeout instead of fetch
   *  (whose response-header timeout is fixed at five minutes). Resolves Nasiko's agent id. */
  uploadAgent(stageDir) {
    const zip = createZip(collectFiles(stageDir));
    fs.writeFileSync(`${stageDir}.zip`, zip);
    const boundary = `----vitta${crypto.randomBytes(12).toString('hex')}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="package"; filename="${path.basename(stageDir)}.zip"\r\nContent-Type: application/zip\r\n\r\n`),
      zip,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const url = new URL(`${this.baseUrl}/api/import/upload`);
    const transport = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const req = transport.request(
        url,
        { method: 'POST', headers: { ...this.auth(), 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`upload failed (HTTP ${res.statusCode}): ${text}`));
            try {
              resolve(String((JSON.parse(text) || {}).agent_id || ''));
            } catch {
              reject(new Error(`upload returned something that is not JSON: ${text.slice(0, 200)}`));
            }
          });
        },
      );
      req.setTimeout(900_000, () => req.destroy(new Error('upload timed out after 15 minutes')));
      req.on('error', reject);
      req.end(body);
    });
  }
}

function stage(short) {
  const name = AGENT_NAMES[short];
  const dir = path.join(ROOT, 'nasiko', '.build', name);
  console.log(`==> staging ${name} -> ${path.relative(ROOT, dir)}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'nasiko', 'agents', name, 'AgentCard.json'), path.join(dir, 'AgentCard.json'));
  const dockerfile = fs.readFileSync(path.join(ROOT, 'nasiko', 'Dockerfile'), 'utf-8').replace(/^ARG AGENT=.*/m, `ARG AGENT=${short}`);
  fs.writeFileSync(path.join(dir, 'Dockerfile'), dockerfile);
  for (const file of ['package.json', 'manifest.json']) fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  fs.cpSync(path.join(ROOT, 'dist'), path.join(dir, 'dist'), { recursive: true, filter: (src) => !src.endsWith('.test.js') });
  return { name, dir };
}

async function main() {
  const { which, mode } = parseArgs(process.argv.slice(2));
  const targets = which === 'all' ? (mode === 'upload' ? ['planner', 'discovery', 'evaluator'] : ['planner', 'discovery', 'evaluator', 'purchase']) : [which];
  for (const short of targets) {
    if (!AGENT_NAMES[short]) throw new Error(`unknown agent: ${short} (planner|discovery|evaluator|purchase|all)`);
  }

  const nasiko = new Nasiko(process.env.NASIKO_URL || 'http://localhost:8080');
  console.log('==> compiling');
  run('npm', ['run', '--silent', 'build'], { cwd: ROOT });
  run('npm', ['run', '--silent', 'nasiko:cards'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

  if (mode === 'upload') {
    console.log(`==> logging in to ${nasiko.baseUrl}`);
    await nasiko.login(process.env);
    if (!nasiko.token) throw new Error('could not get a Nasiko token');
  }

  const summary = [];
  for (const short of targets) {
    const { name, dir } = stage(short);
    const upperShort = short.toUpperCase();

    if (mode === 'dry') {
      console.log(`    (dry run) would run: nasiko validate && nasiko deploy ${path.relative(ROOT, dir)}  (or --upload)`);
    } else if (mode === 'upload') {
      const wantSecret = short === 'discovery' && Boolean(process.env.VITTA_DASHBOARD_URL);
      const existing = await nasiko.findAgent(name);
      if (existing) {
        const version = bumpCardVersion(dir, existing.version);
        console.log(`    ${name} already in Nasiko as ${existing.id} (v${existing.version}) — redeploying as v${version}`);
        if (wantSecret) await nasiko.setSecret(existing.id, 'VITTA_DASHBOARD_URL', process.env.VITTA_DASHBOARD_URL);
      }
      console.log(`==> uploading ${name} (Nasiko builds the image; first build takes a while)`);
      const id = await nasiko.uploadAgent(dir);
      if (!id) throw new Error('upload returned no agent id');
      if (!existing && wantSecret) {
        // The agent id only exists after the first import, and secrets are read at deploy time.
        console.log('    setting VITTA_DASHBOARD_URL and redeploying so the container receives it');
        await nasiko.setSecret(id, 'VITTA_DASHBOARD_URL', process.env.VITTA_DASHBOARD_URL);
        bumpCardVersion(dir, JSON.parse(fs.readFileSync(path.join(dir, 'AgentCard.json'), 'utf-8')).version);
        await nasiko.uploadAgent(dir);
      }
      console.log(`    Nasiko agent id: ${id}`);
      summary.push(`NASIKO_AGENT_ID_${upperShort}=${id}`);
    } else {
      const probe = spawnSync('nasiko', ['--version'], { stdio: 'ignore' });
      if (probe.error) throw new Error('the nasiko CLI is not installed — see nasiko/README.md (or use --upload)');
      run('nasiko', ['validate'], { cwd: dir });
      run('nasiko', ['deploy', '.'], { cwd: dir });
      console.log(`    Nasiko's id for ${name} is in ${path.relative(ROOT, dir)}${path.sep}.nasiko${path.sep}agent.json — put it in .env as NASIKO_AGENT_ID_${upperShort}`);
    }
  }

  if (mode === 'upload') {
    console.log('');
    console.log('==> add to .env (NASIKO_TOKEN is the login token; it expires, so re-run to refresh):');
    console.log(`NASIKO_URL=${nasiko.baseUrl}`);
    for (const line of summary) console.log(line);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { compareVersions, bumpCardVersion, parseArgs };
