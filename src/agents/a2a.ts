// Minimal A2A (agent-to-agent) transport — the contract Nasiko documents for a deployable agent:
//   GET  /.well-known/agent-card.json   unauthenticated metadata
//   POST /                              JSON-RPC 2.0, method `message/send` (or v1 `SendMessage`)
//   GET  /                              health check, HTTP 200
// (docs.nasiko.com/adlc/a2a-agents). Plain node:http, zero dependencies — the agents are small and
// a framework would only add attack surface to a process that sits next to a spending gate.
//
// The client side dispatches either straight to an agent's URL or through Nasiko's orchestrator
// endpoint (`POST /api/orchestrator/a2a` with `metadata.agent_id`, docs.nasiko.com/platform/orchestrator),
// so Nasiko sees, routes and traces every hop. Either way the request carries a W3C `traceparent`,
// which Nasiko's flow guard and observability key on.
import crypto from 'node:crypto';
import http from 'node:http';
import {
  agentFail,
  isAgentResult,
  type AgentHandler,
  type AgentName,
  type AgentRequest,
  type AgentResult,
  type Correlation,
} from './protocol';

// ---------------------------------------------------------------------------------------------
// W3C trace context
// ---------------------------------------------------------------------------------------------

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function newTraceparent(): string {
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

export function isTraceparent(value: unknown): value is string {
  return typeof value === 'string' && TRACEPARENT_RE.test(value) && !/^00-0{32}-/.test(value) && !/-0{16}-/.test(value);
}

export function traceIdOf(traceparent: string): string {
  const m = TRACEPARENT_RE.exec(traceparent);
  if (!m) throw new Error(`Not a W3C traceparent: ${traceparent}`);
  return m[1];
}

/** Same trace, fresh span — one per hop, so a trace shows each agent as its own span. */
export function childTraceparent(parent: string): string {
  const m = TRACEPARENT_RE.exec(parent);
  if (!m) throw new Error(`Not a W3C traceparent: ${parent}`);
  return `00-${m[1]}-${randomHex(8)}-${m[3]}`;
}

export function newCorrelation(partial: Partial<Correlation> = {}): Correlation {
  return {
    sessionId: partial.sessionId ?? `ses_${randomHex(8)}`,
    requestId: partial.requestId ?? `req_${randomHex(8)}`,
    traceparent: partial.traceparent && isTraceparent(partial.traceparent) ? partial.traceparent : newTraceparent(),
    mandateId: partial.mandateId,
    caller: partial.caller,
  };
}

// ---------------------------------------------------------------------------------------------
// Envelope <-> A2A message
// ---------------------------------------------------------------------------------------------

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function isCorrelation(value: unknown): value is Correlation {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.sessionId === 'string' &&
    REQUEST_ID_RE.test(c.sessionId) &&
    typeof c.requestId === 'string' &&
    REQUEST_ID_RE.test(c.requestId) &&
    isTraceparent(c.traceparent)
  );
}

interface MessagePart {
  text?: unknown;
  data?: unknown;
}

/** Pulls an AgentRequest out of an A2A message. A plain-text message (someone chatting with the
 *  agent from Nasiko's UI) becomes `{ request: text }` with fresh correlation, so an agent is also
 *  usable by hand; only the Planner accepts that shape, the others reject it as INVALID_REQUEST. */
export function extractAgentRequest(message: unknown, headerTraceparent?: string): AgentRequest | { error: string } {
  if (typeof message !== 'object' || message === null) return { error: 'params.message is required' };
  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts) || parts.length === 0) return { error: 'params.message.parts must be a non-empty array' };

  for (const raw of parts as MessagePart[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    let candidate: unknown;
    if (typeof raw.text === 'string') {
      try {
        candidate = JSON.parse(raw.text);
      } catch {
        candidate = undefined;
      }
      if (candidate === undefined || typeof candidate !== 'object' || candidate === null) {
        // Not JSON: treat as a free-text request.
        return {
          vitta: 1,
          correlation: newCorrelation({ traceparent: headerTraceparent, caller: 'a2a-text' }),
          input: { request: raw.text },
        };
      }
    } else if (typeof raw.data === 'object' && raw.data !== null) {
      candidate = raw.data;
    } else {
      continue;
    }
    const env = candidate as Partial<AgentRequest>;
    if (env.vitta !== 1) {
      return { error: 'message is JSON but not a Vitta envelope ({"vitta":1,"correlation":{...},"input":{...}})' };
    }
    if (!isCorrelation(env.correlation)) return { error: 'envelope.correlation is missing or malformed' };
    return { vitta: 1, correlation: env.correlation, input: env.input };
  }
  return { error: 'no text or data part found in message' };
}

/** Nasiko's orchestrator deserializes A2A v1 enum roles and answers 400 ("unknown variant `user`") to the
 *  lowercase v0.3 spelling — verified against a real control plane. Our own agents ignore the role, so
 *  the direct path keeps the spelling the AgentCard's protocolVersion (0.3.0) declares. */
function buildMessage(request: AgentRequest, viaNasiko: boolean): { messageId: string; role: 'user' | 'ROLE_USER'; parts: Array<{ text: string }> } {
  return {
    messageId: `msg_${randomHex(8)}`,
    role: viaNasiko ? 'ROLE_USER' : 'user',
    parts: [{ text: JSON.stringify(request) }],
  };
}

// ---------------------------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------------------------

export interface AgentServerOptions {
  name: AgentName;
  card: Record<string, unknown>;
  handle: AgentHandler;
  /** Optional shared secret. When set, POSTs need `Authorization: Bearer <token>`. Nasiko's own
   *  platform auth is the normal path; this exists for a bare, network-reachable process. */
  bearerToken?: string;
}

const MAX_BODY_BYTES = 1_000_000;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function rpcError(id: unknown, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** Task shape from Nasiko's documented `message/send` response. */
function toTask(result: AgentResult, correlation: Correlation): unknown {
  return {
    id: `task_${randomHex(8)}`,
    contextId: correlation.sessionId,
    status: {
      state: result.ok ? 'completed' : 'failed',
      ...(result.ok ? {} : { message: { role: 'agent', parts: [{ text: `${result.error.code}: ${result.error.message}` }] } }),
    },
    artifacts: [{ artifactId: `art_${randomHex(6)}`, name: 'result', parts: [{ text: JSON.stringify(result) }] }],
  };
}

export function createAgentServer(opts: AgentServerOptions): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET' && (url.pathname === '/.well-known/agent-card.json' || url.pathname === '/.well-known/agent.json')) {
        json(res, 200, opts.card);
        return;
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        json(res, 200, { status: 'ok', agent: opts.name });
        return;
      }
      if (req.method !== 'POST' || (url.pathname !== '/' && url.pathname !== '/a2a')) {
        json(res, 404, { error: 'not found' });
        return;
      }

      if (opts.bearerToken) {
        const header = req.headers.authorization ?? '';
        const given = header.startsWith('Bearer ') ? header.slice(7) : '';
        const a = Buffer.from(given);
        const b = Buffer.from(opts.bearerToken);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          json(res, 401, rpcError(null, -32001, 'unauthorized'));
          return;
        }
      }

      let rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: { message?: unknown } };
      try {
        rpc = JSON.parse(await readBody(req));
      } catch {
        json(res, 400, rpcError(null, -32700, 'parse error'));
        return;
      }
      if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
        json(res, 400, rpcError(rpc?.id, -32600, 'invalid JSON-RPC request'));
        return;
      }
      // `message/send` is the A2A 0.3 name; Nasiko's dispatcher speaks the v1 names — it tries
      // `SendStreamingMessage` first and, when an agent answers with a JSON-RPC error, retries as
      // `SendMessage` (verified against a real control plane). So streaming stays unsupported on purpose:
      // the error is what sends Nasiko to the method we do serve.
      if (rpc.method !== 'message/send' && rpc.method !== 'SendMessage') {
        json(res, 200, rpcError(rpc.id, -32601, `method not supported: ${rpc.method} (only message/send, SendMessage)`));
        return;
      }

      const headerTp = req.headers.traceparent;
      const extracted = extractAgentRequest(rpc.params?.message, typeof headerTp === 'string' ? headerTp : undefined);
      if ('error' in extracted) {
        const failure = agentFail(opts.name, { code: 'INVALID_REQUEST', message: extracted.error }, []);
        json(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result: { task: toTask(failure, newCorrelation()) } });
        return;
      }

      let result: AgentResult;
      try {
        result = await opts.handle(extracted);
      } catch (err) {
        // A handler is meant to return a structured failure; an escape is a bug, still reported
        // as one rather than crashing the server.
        result = agentFail(opts.name, { code: 'INVALID_REQUEST', message: `unhandled agent error: ${(err as Error).message}` }, []);
      }
      json(res, 200, { jsonrpc: '2.0', id: rpc.id ?? null, result: { task: toTask(result, extracted.correlation) } });
    } catch (err) {
      json(res, 500, rpcError(null, -32603, (err as Error).message));
    }
  });
}

export function listen(server: http.Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : port);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------

export interface AgentEndpoint {
  agent: AgentName;
  /** Where to POST. For Nasiko dispatch this is `<control-plane>/api/orchestrator/a2a`. */
  url: string;
  /** Nasiko's id for the agent — sent as `metadata.agent_id` so the orchestrator proxies straight to it. */
  nasikoAgentId?: string;
  headers?: Record<string, string>;
}

export interface CallOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Everything the orchestrator needs to reach an agent; implemented over HTTP and in-process. */
export interface AgentCaller {
  call(agent: AgentName, request: AgentRequest): Promise<AgentResult>;
}

function transportFailure(agent: AgentName, code: 'AGENT_UNREACHABLE' | 'AGENT_TIMEOUT', message: string): AgentResult {
  return agentFail(agent, { code, message }, []);
}

export async function callAgent(endpoint: AgentEndpoint, request: AgentRequest, opts: CallOptions = {}): Promise<AgentResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 300_000; // a real purchase drives a browser for minutes
  const body = {
    jsonrpc: '2.0',
    id: `rpc_${randomHex(6)}`,
    method: 'message/send',
    params: {
      message: buildMessage(request, endpoint.nasikoAgentId !== undefined),
      ...(endpoint.nasikoAgentId ? { metadata: { agent_id: endpoint.nasikoAgentId } } : {}),
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        traceparent: request.correlation.traceparent,
        ...(endpoint.headers ?? {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return transportFailure(endpoint.agent, 'AGENT_TIMEOUT', `${endpoint.agent} did not answer within ${Math.round(timeoutMs / 1000)}s`);
    }
    return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} unreachable at ${endpoint.url}: ${e.message}`);
  }

  if (!response.ok) {
    return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} answered HTTP ${response.status} at ${endpoint.url}`);
  }

  let text: unknown;
  if ((response.headers.get('content-type') ?? '').includes('text/event-stream')) {
    // Nasiko's orchestrator always answers as an event stream, even for a plain send.
    let events: string;
    try {
      events = await response.text();
    } catch (err) {
      return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} stream broke: ${(err as Error).message}`);
    }
    const streamed = readEventStream(events);
    if (streamed.failure) {
      return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} task failed: ${streamed.failure}`);
    }
    text = streamed.text;
  } else {
    let payload: {
      result?: { task?: TaskLike } & TaskLike;
      error?: { message?: string };
    };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} returned a non-JSON response`);
    }
    if (payload.error) {
      return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} JSON-RPC error: ${payload.error.message ?? 'unknown'}`);
    }
    // Nasiko documents `result.task`; the A2A spec's own shape returns the task as `result`. Accept both.
    const task = payload.result?.task ?? payload.result;
    text = task?.artifacts?.[0]?.parts?.[0]?.text;
  }
  if (typeof text !== 'string') {
    return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} returned a task with no result artifact`);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (isAgentResult(parsed)) return parsed;
  } catch {
    // fall through
  }
  return transportFailure(endpoint.agent, 'AGENT_UNREACHABLE', `${endpoint.agent} returned an artifact that is not a Vitta AgentResult`);
}

interface TaskLike {
  artifacts?: Array<{ parts?: Array<{ text?: unknown }> }>;
}

/** Reads an A2A event stream (the shape Nasiko's orchestrator returns): `artifactUpdate` events carry
 *  the agent's reply in chunks, a terminal `statusUpdate` says how the task ended. Events may arrive
 *  bare or wrapped in `{result: …}`; the task states are the v1 enum names (`TASK_STATE_FAILED`). */
export function readEventStream(body: string): { text?: string; failure?: string } {
  const chunks = new Map<string, string>();
  let failure: string | undefined;
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue;
    let event: any;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    event = event?.result ?? event;
    const artifact = event?.artifactUpdate?.artifact;
    if (artifact && Array.isArray(artifact.parts)) {
      const id = String(artifact.artifactId ?? '');
      const piece = artifact.parts.map((p: { text?: unknown }) => (typeof p?.text === 'string' ? p.text : '')).join('');
      chunks.set(id, event.artifactUpdate.append === true ? (chunks.get(id) ?? '') + piece : piece);
    }
    const status = event?.statusUpdate?.status;
    if (status && /FAILED|REJECTED|CANCELED|CANCELLED/i.test(String(status.state ?? ''))) {
      const said = (status.message?.parts ?? []).map((p: { text?: unknown }) => (typeof p?.text === 'string' ? p.text : '')).join('');
      failure = said || String(status.state);
    }
  }
  const first = [...chunks.values()].find((t) => t.length > 0);
  return failure !== undefined && first === undefined ? { failure } : { text: first };
}

/** Dispatches over HTTP, one endpoint per agent. */
export function createHttpCaller(endpoints: Record<AgentName, AgentEndpoint>, opts: CallOptions = {}): AgentCaller {
  return {
    call: (agent, request) => callAgent(endpoints[agent], request, opts),
  };
}

/** Same interface, no network — for tests and single-process runs. Still exercises the envelope. */
export function createInProcessCaller(handlers: Record<AgentName, AgentHandler>): AgentCaller {
  return {
    call: async (agent, request) => {
      try {
        return await handlers[agent](request);
      } catch (err) {
        return agentFail(agent, { code: 'INVALID_REQUEST', message: `unhandled agent error: ${(err as Error).message}` }, []);
      }
    },
  };
}
