// Request-level purchase idempotency for the Purchase Agent.
//
// Why it exists: an orchestrator (Nasiko's included — a failed workflow step is retried, up to three
// times by default) may deliver the same request more than once. `gate run` mints a fresh run id per
// invocation, so replaying a purchase is not something the gate can recognise by itself. This store
// is the agent-layer guard: one shopping request id buys at most once, and a replay returns what
// happened the first time instead of running again.
//
// Fails closed on ambiguity: if a claim exists but never completed (the process died mid-purchase)
// the request is NOT retried — nobody can tell whether the order went through, so a human checks the
// receipts first.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AgentResult } from './protocol';

export type ClaimResult =
  | { state: 'claimed' }
  | { state: 'in_progress'; since: string }
  | { state: 'done'; result: AgentResult };

export interface IdempotencyStore {
  claim(requestId: string): ClaimResult;
  complete(requestId: string, result: AgentResult): void;
}

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

interface Entry {
  status: 'in_progress' | 'done';
  at: string;
  result?: AgentResult;
}

export function agentRunsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.VITTA_AGENT_RUNS_DIR ?? './agent-runs';
}

export function fileIdempotencyStore(dir = path.join(agentRunsDir(), 'purchases')): IdempotencyStore {
  function fileFor(requestId: string): string {
    if (!ID_RE.test(requestId)) throw new Error(`Refusing unsafe request id "${requestId}"`);
    return path.join(dir, `${requestId}.json`);
  }
  function read(file: string): Entry {
    return JSON.parse(readFileSync(file, 'utf-8')) as Entry;
  }
  return {
    claim(requestId) {
      const file = fileFor(requestId);
      mkdirSync(dir, { recursive: true });
      try {
        // 'wx' = create-exclusive: two racing deliveries cannot both win the claim.
        writeFileSync(file, JSON.stringify({ status: 'in_progress', at: new Date().toISOString() } satisfies Entry), { flag: 'wx' });
        return { state: 'claimed' };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      }
      const entry = existsSync(file) ? read(file) : { status: 'in_progress' as const, at: new Date().toISOString() };
      if (entry.status === 'done' && entry.result) return { state: 'done', result: entry.result };
      return { state: 'in_progress', since: entry.at };
    },
    complete(requestId, result) {
      const file = fileFor(requestId);
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ status: 'done', at: new Date().toISOString(), result } satisfies Entry));
      renameSync(tmp, file);
    },
  };
}

/** In-memory variant for tests. */
export function memoryIdempotencyStore(): IdempotencyStore {
  const entries = new Map<string, Entry>();
  return {
    claim(requestId) {
      const existing = entries.get(requestId);
      if (!existing) {
        entries.set(requestId, { status: 'in_progress', at: new Date().toISOString() });
        return { state: 'claimed' };
      }
      if (existing.status === 'done' && existing.result) return { state: 'done', result: existing.result };
      return { state: 'in_progress', since: existing.at };
    },
    complete(requestId, result) {
      entries.set(requestId, { status: 'done', at: new Date().toISOString(), result });
    },
  };
}
