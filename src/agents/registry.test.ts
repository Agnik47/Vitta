import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AGENT_NAMES } from './protocol';
import { AGENT_DEFS, agentCard, defaultUrl, resolveEndpoints } from './registry';

test('there are exactly four agents, each with a unique port and at least one skill', () => {
  assert.equal(AGENT_NAMES.length, 4);
  assert.equal(new Set(AGENT_NAMES.map((n) => AGENT_DEFS[n].port)).size, 4);
  for (const n of AGENT_NAMES) assert.ok(AGENT_DEFS[n].skills.length >= 1);
});

test('every agent card has the fields Nasiko documents as required', () => {
  for (const n of AGENT_NAMES) {
    const card = agentCard(AGENT_DEFS[n], 'http://localhost:8000') as Record<string, any>;
    assert.equal(card.name, n);
    assert.ok(card.description && card.version);
    assert.deepEqual(card.supportedInterfaces, [{ url: 'http://localhost:8000', protocolBinding: 'JSONRPC' }]);
    assert.equal(card.capabilities.streaming, false);
    assert.ok(card.defaultInputModes.length && card.defaultOutputModes.length);
    assert.ok(card.skills.every((s: any) => s.id && s.name && s.description && Array.isArray(s.tags)));
  }
});

test('the committed nasiko/<agent>/AgentCard.json files match the registry (regenerate with `npm run nasiko:cards`)', () => {
  for (const n of AGENT_NAMES) {
    const file = path.resolve(__dirname, '..', '..', 'nasiko', 'agents', n, 'AgentCard.json');
    const committed = JSON.parse(readFileSync(file, 'utf-8'));
    assert.deepEqual(committed, agentCard(AGENT_DEFS[n], 'http://localhost:8000'), `${n}/AgentCard.json is stale`);
  }
});

test('direct mode: defaults to loopback ports, overridable per agent', () => {
  const { endpoints, nasiko } = resolveEndpoints({ VITTA_AGENT_PURCHASE_URL: 'http://purchase.internal:9' });
  assert.equal(nasiko.routed, false);
  assert.equal(endpoints['vitta-shopping-planner'].url, defaultUrl(AGENT_DEFS['vitta-shopping-planner']));
  assert.equal(endpoints['vitta-purchase-agent'].url, 'http://purchase.internal:9');
  assert.equal(endpoints['vitta-deal-discovery'].nasikoAgentId, undefined);
});

test('Nasiko mode: every hop goes to the orchestrator endpoint with that agent’s id and the bearer token', () => {
  const { endpoints, nasiko } = resolveEndpoints({
    NASIKO_URL: 'https://nasiko.example.com/',
    NASIKO_TOKEN: 'tok',
    NASIKO_AGENT_ID_PLANNER: 'p1',
    NASIKO_AGENT_ID_DISCOVERY: 'd1',
    NASIKO_AGENT_ID_EVALUATOR: 'e1',
    NASIKO_AGENT_ID_PURCHASE: 'u1',
  });
  assert.deepEqual(nasiko, { routed: true, url: 'https://nasiko.example.com' });
  for (const n of AGENT_NAMES) assert.equal(endpoints[n].url, 'https://nasiko.example.com/api/orchestrator/a2a');
  assert.equal(endpoints['vitta-deal-evaluator'].nasikoAgentId, 'e1');
  assert.equal(endpoints['vitta-purchase-agent'].headers?.authorization, 'Bearer tok');
});

test('Nasiko mode with a missing agent id fails loudly instead of routing blind', () => {
  assert.throws(() => resolveEndpoints({ NASIKO_URL: 'https://n.example', NASIKO_AGENT_ID_PLANNER: 'p1' }), /NASIKO_AGENT_ID_DISCOVERY/);
});

test('mixed mode: an explicit VITTA_AGENT_<NAME>_URL keeps that one agent direct while the rest go through Nasiko', () => {
  const { endpoints, nasiko } = resolveEndpoints({
    NASIKO_URL: 'https://nasiko.example.com',
    NASIKO_AGENT_ID_PLANNER: 'p1',
    NASIKO_AGENT_ID_DISCOVERY: 'd1',
    NASIKO_AGENT_ID_EVALUATOR: 'e1',
    VITTA_AGENT_PURCHASE_URL: 'http://127.0.0.1:9104', // no NASIKO_AGENT_ID_PURCHASE needed
  });
  assert.deepEqual(nasiko, { routed: true, url: 'https://nasiko.example.com', direct: ['vitta-purchase-agent'] });
  assert.equal(endpoints['vitta-deal-evaluator'].url, 'https://nasiko.example.com/api/orchestrator/a2a');
  assert.equal(endpoints['vitta-purchase-agent'].url, 'http://127.0.0.1:9104');
  assert.equal(endpoints['vitta-purchase-agent'].nasikoAgentId, undefined);
});

test('direct mode sends VITTA_AGENT_TOKEN as the bearer token a token-protected agent requires', () => {
  const { endpoints } = resolveEndpoints({ VITTA_AGENT_TOKEN: 's3cret' });
  for (const n of AGENT_NAMES) assert.equal(endpoints[n].headers?.authorization, 'Bearer s3cret');
  assert.equal(resolveEndpoints({}).endpoints['vitta-deal-evaluator'].headers, undefined);
});
