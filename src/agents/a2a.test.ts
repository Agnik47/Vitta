import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import {
  callAgent,
  childTraceparent,
  createAgentServer,
  extractAgentRequest,
  isTraceparent,
  listen,
  newCorrelation,
  newTraceparent,
  traceIdOf,
} from './a2a';
import { agentFail, agentOk, type AgentHandler, type AgentRequest } from './protocol';
import { createPlannerAgent } from './planner';
import { AGENT_DEFS, agentCard } from './registry';

const NAME = 'vitta-shopping-planner' as const;

async function serve(handle: AgentHandler, bearerToken?: string): Promise<{ url: string; server: Server }> {
  const server = createAgentServer({ name: NAME, card: agentCard(AGENT_DEFS[NAME], 'http://x'), handle, bearerToken });
  const port = await listen(server, 0, '127.0.0.1');
  return { url: `http://127.0.0.1:${port}`, server };
}
const close = (s: Server) => new Promise<void>((r) => s.close(() => r()));

function request(input: unknown): AgentRequest {
  return { vitta: 1, correlation: newCorrelation(), input };
}

test('traceparent: well-formed, child keeps the trace id and changes the span id', () => {
  const root = newTraceparent();
  assert.ok(isTraceparent(root));
  const child = childTraceparent(root);
  assert.ok(isTraceparent(child));
  assert.equal(traceIdOf(child), traceIdOf(root));
  assert.notEqual(child, root);
  assert.equal(isTraceparent('00-00000000000000000000000000000000-0000000000000000-01'), false);
  assert.equal(isTraceparent('garbage'), false);
});

test('serves the agent card unauthenticated at the well-known path (and the legacy one), plus a health check', async () => {
  const { url, server } = await serve(async () => agentOk(NAME, {}, []));
  try {
    for (const p of ['/.well-known/agent-card.json', '/.well-known/agent.json']) {
      const card = (await (await fetch(url + p)).json()) as Record<string, unknown>;
      assert.equal(card.name, NAME);
      assert.ok(Array.isArray(card.skills));
    }
    const health = await fetch(url + '/');
    assert.equal(health.status, 200);
  } finally {
    await close(server);
  }
});

test('message/send round trip: envelope in, AgentResult out, correlation and traceparent preserved', async () => {
  let seen: AgentRequest | undefined;
  const { url, server } = await serve(async (req) => {
    seen = req;
    return agentOk(NAME, { echoed: req.input }, []);
  });
  try {
    const req = request({ hello: 'world' });
    const result = await callAgent({ agent: NAME, url }, req);
    assert.ok(result.ok);
    if (result.ok) assert.deepEqual(result.data, { echoed: { hello: 'world' } });
    assert.equal(seen?.correlation.requestId, req.correlation.requestId);
    assert.equal(seen?.correlation.sessionId, req.correlation.sessionId);
    assert.equal(seen?.correlation.traceparent, req.correlation.traceparent);
  } finally {
    await close(server);
  }
});

test('a structured agent failure crosses the wire intact — code, message and details', async () => {
  const { url, server } = await serve(async () =>
    agentFail(NAME, { code: 'VITTA_DENIED', message: 'nope', details: { deny_code: 'OVER_PER_TXN_CAP', requested_amount_inr: 1299 } }, []),
  );
  try {
    const r = await callAgent({ agent: NAME, url }, request({}));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'VITTA_DENIED');
      assert.deepEqual(r.error.details, { deny_code: 'OVER_PER_TXN_CAP', requested_amount_inr: 1299 });
    }
  } finally {
    await close(server);
  }
});

test('Nasiko dispatch: the request carries metadata.agent_id, the bearer token and the traceparent', async () => {
  let captured: { body: any; headers: Headers } | undefined;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    captured = { body: JSON.parse(String(init.body)), headers: new Headers(init.headers) };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 'x', result: { task: { id: 't', artifacts: [{ artifactId: 'a', parts: [{ text: JSON.stringify(agentOk(NAME, { ok: 1 }, [])) }] }] } } }), { status: 200 });
  }) as unknown as typeof fetch;

  const req = request({});
  const r = await callAgent(
    { agent: NAME, url: 'https://nasiko.example/api/orchestrator/a2a', nasikoAgentId: 'agt_123', headers: { authorization: 'Bearer tok' } },
    req,
    { fetchImpl },
  );
  assert.ok(r.ok);
  assert.equal(captured?.body.method, 'message/send');
  assert.equal(captured?.body.params.metadata.agent_id, 'agt_123');
  assert.equal(captured?.headers.get('authorization'), 'Bearer tok');
  assert.equal(captured?.headers.get('traceparent'), req.correlation.traceparent);
  // Nasiko's orchestrator only deserializes the A2A v1 enum spelling (a real control plane answers 400 to 'user').
  assert.equal(captured?.body.params.message.role, 'ROLE_USER');

  // A direct call to an agent keeps the spelling the AgentCard declares.
  await callAgent({ agent: NAME, url: 'http://agent.example' }, req, { fetchImpl });
  assert.equal(captured?.body.params.message.role, 'user');
});

// The stream below has the shape a real Nasiko control plane returned (captured 2026-09-20): status
// updates, a trace_meta data part, the reply as one artifactUpdate, usage_meta, then TASK_STATE_COMPLETED.
function nasikoStream(artifactText: string, finalState = 'TASK_STATE_COMPLETED', failMessage?: string): string {
  const ev = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  const ids = { taskId: 't1', contextId: 'c1' };
  return [
    ev({ statusUpdate: { ...ids, status: { state: 'TASK_STATE_WORKING' } } }),
    ev({ statusUpdate: { ...ids, status: { state: 'TASK_STATE_WORKING', message: { role: 'ROLE_AGENT', parts: [{ data: { type: 'trace_meta', trace_id: 'abc' } }] } } } }),
    ...(artifactText ? [ev({ artifactUpdate: { ...ids, artifact: { artifactId: 'a1', parts: [{ text: artifactText }] }, append: false, lastChunk: true } })] : []),
    ev({ statusUpdate: { ...ids, status: { state: finalState, ...(failMessage ? { message: { role: 'ROLE_AGENT', parts: [{ text: failMessage }] } } : {}) } } }),
  ].join('');
}
const sse = (body: string) => (async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })) as unknown as typeof fetch;

test('Nasiko replies as an event stream: the AgentResult is read from the artifactUpdate', async () => {
  const fetchImpl = sse(nasikoStream(JSON.stringify(agentOk(NAME, { hop: 'via-nasiko' }, []))));
  const r = await callAgent({ agent: NAME, url: 'http://nasiko/api/orchestrator/a2a', nasikoAgentId: 'agt_1' }, request({}), { fetchImpl });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data, { hop: 'via-nasiko' });
});

test('event stream: a chunked artifact (append) is reassembled before it is parsed', async () => {
  const whole = JSON.stringify(agentOk(NAME, { n: 1 }, []));
  const ev = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
  const body =
    ev({ artifactUpdate: { artifact: { artifactId: 'a', parts: [{ text: whole.slice(0, 20) }] }, append: false } }) +
    ev({ artifactUpdate: { artifact: { artifactId: 'a', parts: [{ text: whole.slice(20) }] }, append: true, lastChunk: true } }) +
    ev({ statusUpdate: { status: { state: 'TASK_STATE_COMPLETED' } } });
  const r = await callAgent({ agent: NAME, url: 'http://x', nasikoAgentId: 'agt_1' }, request({}), { fetchImpl: sse(body) });
  assert.ok(r.ok);
});

test('event stream: Nasiko’s "No response" placeholder and a failed task are transport failures, not results', async () => {
  const placeholder = await callAgent({ agent: NAME, url: 'http://x', nasikoAgentId: 'agt_1' }, request({}), { fetchImpl: sse(nasikoStream('No response')) });
  assert.equal(placeholder.ok, false);
  if (!placeholder.ok) assert.equal(placeholder.error.code, 'AGENT_UNREACHABLE');

  const failed = await callAgent({ agent: NAME, url: 'http://x', nasikoAgentId: 'agt_1' }, request({}), { fetchImpl: sse(nasikoStream('', 'TASK_STATE_FAILED', 'agent HTTP 502')) });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error.message, /agent HTTP 502/);
});

test('the agent server serves Nasiko’s v1 `SendMessage` and declines `SendStreamingMessage` (so Nasiko retries as SendMessage)', async () => {
  const { url, server } = await serve(async () => agentOk(NAME, { ok: 1 }, []));
  try {
    const post = async (method: string) =>
      (await (await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { message: { messageId: 'm', role: 'ROLE_USER', parts: [{ text: 'find atta' }] } } }),
      })).json()) as { error?: { code: number }; result?: { task: { status: { state: string } } } };

    const streaming = await post('SendStreamingMessage');
    assert.equal(streaming.error?.code, -32601);
    const send = await post('SendMessage');
    assert.equal(send.result?.task.status.state, 'completed');
  } finally {
    await close(server);
  }
});

test('the client also accepts the A2A spec’s bare-task result shape', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: 'x', result: { id: 't', artifacts: [{ parts: [{ text: JSON.stringify(agentOk(NAME, 7, [])) }] }] } }), { status: 200 })) as unknown as typeof fetch;
  const r = await callAgent({ agent: NAME, url: 'http://x' }, request({}), { fetchImpl });
  assert.ok(r.ok);
});

test('transport failures become AGENT_UNREACHABLE / AGENT_TIMEOUT results, not exceptions', async () => {
  const refused = await callAgent({ agent: NAME, url: 'http://127.0.0.1:1' }, request({}), { timeoutMs: 2000 });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.error.code, 'AGENT_UNREACHABLE');

  const slow = (async (_u: string, init: RequestInit) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    })) as unknown as typeof fetch;
  const timedOut = await callAgent({ agent: NAME, url: 'http://x' }, request({}), { fetchImpl: slow, timeoutMs: 30 });
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.equal(timedOut.error.code, 'AGENT_TIMEOUT');

  const garbage = (async () => new Response('not json', { status: 200 })) as unknown as typeof fetch;
  const bad = await callAgent({ agent: NAME, url: 'http://x' }, request({}), { fetchImpl: garbage });
  assert.equal(bad.ok, false);
});

test('a plain-text message (chatting with the Planner from Nasiko’s UI) is accepted and planned', async () => {
  const { url, server } = await serve(createPlannerAgent());
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', traceparent: newTraceparent() },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { messageId: 'm', role: 'user', parts: [{ text: 'buy 2kg atta under 300' }] } } }),
    });
    const body = (await res.json()) as { result: { task: { status: { state: string }; artifacts: Array<{ parts: Array<{ text: string }> }> } } };
    assert.equal(body.result.task.status.state, 'completed');
    const result = JSON.parse(body.result.task.artifacts[0].parts[0].text) as { ok: boolean; data: { max_price_inr: number } };
    assert.equal(result.data.max_price_inr, 300);
  } finally {
    await close(server);
  }
});

test('malformed traffic is rejected cleanly: bad JSON, wrong method, non-envelope JSON, bad correlation', async () => {
  const { url, server } = await serve(async () => agentOk(NAME, {}, []));
  try {
    const post = (body: string) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

    assert.equal((await post('{not json')).status, 400);

    const wrongMethod = (await (await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tasks/get' }))).json()) as { error: { code: number } };
    assert.equal(wrongMethod.error.code, -32601);

    const asTask = async (message: unknown) => {
      const body = (await (await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message } }))).json()) as { result: { task: { status: { state: string }; artifacts: Array<{ parts: Array<{ text: string }> }> } } };
      return JSON.parse(body.result.task.artifacts[0].parts[0].text) as { ok: boolean; error?: { code: string } };
    };
    const notEnvelope = await asTask({ parts: [{ text: JSON.stringify({ some: 'json' }) }] });
    assert.equal(notEnvelope.error?.code, 'INVALID_REQUEST');
    const badCorrelation = await asTask({ parts: [{ text: JSON.stringify({ vitta: 1, correlation: { sessionId: '../x', requestId: 'r', traceparent: 'nope' }, input: {} }) }] });
    assert.equal(badCorrelation.error?.code, 'INVALID_REQUEST');
    const noParts = await asTask({ parts: [] });
    assert.equal(noParts.error?.code, 'INVALID_REQUEST');

    assert.equal((await fetch(url + '/nope')).status, 404);
  } finally {
    await close(server);
  }
});

test('a handler that throws is contained: the server keeps serving', async () => {
  const { url, server } = await serve(async () => {
    throw new Error('bug');
  });
  try {
    const r = await callAgent({ agent: NAME, url }, request({}));
    assert.equal(r.ok, false);
    const health = await fetch(url + '/health');
    assert.equal(health.status, 200);
  } finally {
    await close(server);
  }
});

test('bearer token: required when configured, wrong/missing → 401, right → served', async () => {
  const { url, server } = await serve(async () => agentOk(NAME, {}, []), 's3cret');
  try {
    const noAuth = await callAgent({ agent: NAME, url }, request({}));
    assert.equal(noAuth.ok, false);
    const wrong = await callAgent({ agent: NAME, url, headers: { authorization: 'Bearer nope' } }, request({}));
    assert.equal(wrong.ok, false);
    const right = await callAgent({ agent: NAME, url, headers: { authorization: 'Bearer s3cret' } }, request({}));
    assert.ok(right.ok);
    // The card and health stay unauthenticated, as the A2A contract requires.
    assert.equal((await fetch(url + '/.well-known/agent-card.json')).status, 200);
  } finally {
    await close(server);
  }
});

test('extractAgentRequest reads a `data` part as well as a `text` part', () => {
  const env = { vitta: 1, correlation: newCorrelation(), input: { a: 1 } };
  const viaData = extractAgentRequest({ parts: [{ data: env }] });
  assert.ok(!('error' in viaData));
  const viaText = extractAgentRequest({ parts: [{ text: JSON.stringify(env) }] });
  assert.ok(!('error' in viaText));
});

test('the request body size is capped', async () => {
  const { url, server } = await serve(async () => agentOk(NAME, {}, []));
  try {
    const res = await fetch(url, { method: 'POST', body: 'x'.repeat(2_000_000) }).catch(() => undefined);
    // Either the connection is cut or the server answers with an error — never a served result.
    if (res) assert.notEqual(res.status, 200);
  } finally {
    await close(server);
  }
});
