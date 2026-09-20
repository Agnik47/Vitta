// Runs one Vitta agent (or all four) as an A2A server.
//
//   node dist/agents/serve.js planner|discovery|evaluator|purchase|all
//
// PORT overrides the listen port for a single agent (containers use it); HOST defaults to loopback so
// an agent is never network-reachable by accident — a container sets HOST=0.0.0.0 on purpose.
// VITTA_AGENT_TOKEN, when set, makes the server require `Authorization: Bearer <token>`.
import type { Server } from 'node:http';
import { createAgentServer, listen } from './a2a';
import { createDiscoveryAgent } from './discovery';
import { createEvaluatorAgent } from './evaluator';
import { createPlannerAgent } from './planner';
import type { AgentHandler, AgentName } from './protocol';
import { createPurchaseAgent } from './purchase';
import { AGENT_DEFS, DEFAULT_HOST, agentCard, type AgentDef } from './registry';

export function createHandler(short: AgentDef['short']): AgentHandler {
  switch (short) {
    case 'planner':
      return createPlannerAgent();
    case 'discovery':
      return createDiscoveryAgent();
    case 'evaluator':
      return createEvaluatorAgent();
    case 'purchase':
      return createPurchaseAgent();
  }
}

export interface RunningAgent {
  name: AgentName;
  url: string;
  server: Server;
}

export async function startAgent(
  def: AgentDef,
  handler: AgentHandler,
  opts: { port?: number; host?: string; publicUrl?: string; bearerToken?: string } = {},
): Promise<RunningAgent> {
  const host = opts.host ?? DEFAULT_HOST;
  // Bound to 0.0.0.0 (a container) is not an address anyone can call; advertise localhost instead.
  const advertisedHost = host === '0.0.0.0' ? 'localhost' : host;
  // The card must advertise the URL callers will actually use; unknown until the port is bound.
  let card: Record<string, unknown> = agentCard(def, opts.publicUrl ?? `http://${advertisedHost}:${opts.port ?? def.port}`);
  const server = createAgentServer({
    name: def.name,
    get card() {
      return card;
    },
    handle: handler,
    bearerToken: opts.bearerToken,
  });
  const port = await listen(server, opts.port ?? def.port, host);
  const url = opts.publicUrl ?? `http://${advertisedHost}:${port}`;
  card = agentCard(def, url);
  return { name: def.name, url, server };
}

async function main(): Promise<void> {
  const which = process.argv[2];
  const shorts = Object.values(AGENT_DEFS).map((d) => d.short);
  const selected: AgentDef[] =
    which === 'all'
      ? Object.values(AGENT_DEFS)
      : Object.values(AGENT_DEFS).filter((d) => d.short === which);
  if (selected.length === 0) {
    console.error(`Usage: serve <${[...shorts, 'all'].join('|')}>`);
    process.exit(2);
  }

  const host = process.env.HOST ?? DEFAULT_HOST;
  const bearerToken = process.env.VITTA_AGENT_TOKEN || undefined;
  for (const def of selected) {
    const port = selected.length === 1 && process.env.PORT ? Number(process.env.PORT) : def.port;
    const running = await startAgent(def, createHandler(def.short), {
      port,
      host,
      publicUrl: process.env.VITTA_AGENT_PUBLIC_URL && selected.length === 1 ? process.env.VITTA_AGENT_PUBLIC_URL : undefined,
      bearerToken,
    });
    console.log(`${def.name} listening on ${running.url}  (card: ${running.url}/.well-known/agent-card.json)`);
  }
}

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
}
