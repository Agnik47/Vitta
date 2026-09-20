// Structural guarantees about the agent layer, checked from the source itself — so they hold even if
// someone later adds a fifth agent and forgets the rule. The runtime guarantees (a DENY stops the
// browser action, nothing is drawn, replays don't double-charge) are in e2e.test.ts against the real gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Always inspect the TypeScript SOURCE. `node --test` also runs the compiled copy of this file from
// dist/, where __dirname has no .ts files — so the location is derived from the repo root instead.
const SRC_ROOT = path.resolve(__dirname, '..', '..', 'src');
const AGENTS_DIR = path.join(SRC_ROOT, 'agents');

function sources(dir: string, includeSandbox = false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'sandbox' && !includeSandbox) continue;
      out.push(...sources(full, includeSandbox));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function code(file: string): string {
  // strip comments so prose that MENTIONS decide() or the ledger doesn't trip the checks
  return readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const files = sources(AGENTS_DIR);

test('there are agent source files to check', () => {
  assert.ok(files.length >= 10);
});

test('no agent imports the policy engine, the webcmd executor, or any ledger — the gate CLI is the only path to those', () => {
  const forbidden = [/policy\/decide/, /webcmd\/executor/, /ledger\//, /RazorpayLedger/, /mandate\/sign/, /receipt\/chain/];
  for (const f of files) {
    const src = code(f);
    for (const pattern of forbidden) {
      assert.doesNotMatch(src, pattern, `${path.relative(AGENTS_DIR, f)} must not reference ${pattern}`);
    }
  }
});

test('no agent spawns processes or shells out itself; merchant access is only via gate-spawn', () => {
  for (const f of files) {
    const src = code(f);
    assert.doesNotMatch(src, /child_process/, `${path.relative(AGENTS_DIR, f)} must not import child_process`);
    assert.doesNotMatch(src, /\b(execSync|spawnSync|execFileSync)\b/, path.relative(AGENTS_DIR, f));
    assert.doesNotMatch(src, /\b(?:spawn|exec|execFile)\s*\(\s*['"`]webcmd/, `${path.relative(AGENTS_DIR, f)} must not invoke webcmd directly`);
  }
});

test('only the Purchase Agent is wired to the write path, and it reaches it through PurchaseAgent (which only spawns the gate)', () => {
  for (const f of files) {
    const name = path.basename(f);
    const src = code(f);
    if (name === 'purchase.ts') {
      assert.match(src, /new PurchaseAgent\(/);
      assert.doesNotMatch(src, /\brunGate\b/, 'purchase.ts must not spawn the gate itself — PurchaseAgent owns that');
    } else {
      assert.doesNotMatch(src, /\brunGate\b/, `${name} must not be able to spawn the gate (a write path)`);
      assert.doesNotMatch(src, /new PurchaseAgent\(/, `${name} must not construct a PurchaseAgent`);
    }
  }
});

test('the read-only agents (planner, discovery, evaluator) import nothing that can place an order', () => {
  for (const name of ['planner.ts', 'evaluator.ts']) {
    const src = code(path.join(AGENTS_DIR, name));
    assert.doesNotMatch(src, /gate-spawn|PurchaseAgent|cli\/store/, `${name} should be pure`);
  }
  const discovery = code(path.join(AGENTS_DIR, 'discovery.ts'));
  assert.match(discovery, /runSearch/);
  assert.doesNotMatch(discovery, /runGate|PurchaseAgent/);
});

test('agents never read payment-rail credentials', () => {
  for (const f of files) {
    assert.doesNotMatch(code(f), /RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|RAZORPAY_KEY_ID|PRAVA_SECRET_KEY|DODO_API_KEY/, path.relative(AGENTS_DIR, f));
  }
});

test('the Purchase Agent never passes a mandate id to PurchaseAgent, which would enable auto-funding', () => {
  const src = code(path.join(AGENTS_DIR, 'purchase.ts'));
  assert.doesNotMatch(src, /mandateId\s*:/, 'a mandateId in the PurchaseInput turns on `gate fund --auto`');
});

test('the decision function stays free of I/O and model calls (the property the whole design rests on)', () => {
  const decide = code(path.join(SRC_ROOT, 'policy', 'decide.ts'));
  assert.doesNotMatch(decide, /\bfetch\b|child_process|node:fs|anthropic|openai|groq/i);
  assert.doesNotMatch(decide, /\basync\b|\bawait\b|Promise/, 'decide() must stay synchronous');
});

test('nothing under src/policy or src/mandate imports from src/agents (dependencies point one way)', () => {
  for (const dir of ['policy', 'mandate', 'receipt', 'ledger']) {
    for (const f of sources(path.join(SRC_ROOT, dir))) {
      assert.doesNotMatch(code(f), /from ['"]\.\.\/agents/, `${dir}/${path.basename(f)} must not depend on the agent layer`);
    }
  }
});
