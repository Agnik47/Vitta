// Who the four agents are: names, ports, skills, and the AgentCard each one publishes. Also how the
// orchestrator finds them — straight to each agent's URL, or through Nasiko's control plane.
//
// The AgentCard follows the shape Nasiko documents (docs.nasiko.com/adlc/a2a-agents: name,
// description, version, supportedInterfaces, capabilities, default modes, skills). `nasiko validate`
// is the authority on the exact schema; nasiko/README.md says to run it before the first deploy.
import type { AgentEndpoint } from './a2a';
import type { NasikoRouting } from './runs-store';
import { AGENT_NAMES, AGENT_VERSION, type AgentName } from './protocol';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export interface AgentDef {
  name: AgentName;
  /** The CLI/env shorthand: `serve planner`, VITTA_AGENT_PLANNER_URL. */
  short: 'planner' | 'discovery' | 'evaluator' | 'purchase';
  description: string;
  port: number;
  skills: AgentSkill[];
}

export const AGENT_DEFS: Record<AgentName, AgentDef> = {
  'vitta-shopping-planner': {
    name: 'vitta-shopping-planner',
    short: 'planner',
    port: 9101,
    description:
      'Turns a natural-language shopping request into a structured shopping intent (product, quantity, price ceiling, merchants, whether to buy). Plans only — never searches or buys.',
    skills: [
      {
        id: 'plan-shopping-intent',
        name: 'Plan shopping intent',
        description: 'Parse a request like "find the cheapest 2kg atta under ₹300 and buy it" into a ShoppingIntent.',
        tags: ['planning', 'shopping', 'intent-parsing'],
        examples: ['Find me the cheapest 2kg atta under ₹300 and buy it'],
      },
    ],
  },
  'vitta-deal-discovery': {
    name: 'vitta-deal-discovery',
    short: 'discovery',
    port: 9102,
    description:
      'Discovers candidate products and live prices across Blinkit, Zepto and BigBasket using Anakin web access (with a read-only webcmd fallback). Read-only: it cannot place an order.',
    skills: [
      {
        id: 'discover-deals',
        name: 'Discover deals',
        description: 'Search the supported merchants for a product and return normalized candidates.',
        tags: ['product-search', 'merchant-search', 'price-discovery', 'anakin'],
        examples: ['Search Blinkit, Zepto and BigBasket for atta 2kg'],
      },
    ],
  },
  'vitta-deal-evaluator': {
    name: 'vitta-deal-evaluator',
    short: 'evaluator',
    port: 9103,
    description:
      'Compares discovered candidates against the user’s constraints and proposes the best purchase. A proposal is not authorization — Vitta’s gate decides whether it may be spent.',
    skills: [
      {
        id: 'evaluate-deals',
        name: 'Evaluate deals',
        description: 'Select the cheapest eligible candidate (size, stock, merchant and price ceiling respected) and explain why.',
        tags: ['evaluation', 'comparison', 'deterministic'],
        examples: ['Pick the cheapest eligible 2kg atta under ₹300'],
      },
    ],
  },
  'vitta-purchase-agent': {
    name: 'vitta-purchase-agent',
    short: 'purchase',
    port: 9104,
    description:
      'Attempts the proposed purchase. Every merchant write goes through the Vitta gate, which reads the real cart and deterministically ALLOWs or DENYs; a denial stops the browser action and is returned verbatim.',
    skills: [
      {
        id: 'purchase-through-gate',
        name: 'Purchase through the Vitta gate',
        description: 'Build the cart and place the order, subject to the signed mandate. Idempotent per request id.',
        tags: ['purchase', 'checkout', 'vitta-gate', 'mandate'],
        examples: ['Buy the proposed Zepto item under the current mandate'],
      },
    ],
  },
};

export function agentCard(def: AgentDef, baseUrl: string): Record<string, unknown> {
  return {
    name: def.name,
    description: def.description,
    version: AGENT_VERSION,
    protocolVersion: '0.3.0',
    url: baseUrl,
    preferredTransport: 'JSONRPC',
    supportedInterfaces: [{ url: baseUrl, protocolBinding: 'JSONRPC' }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json'],
    skills: def.skills,
    provider: { organization: 'Vitta', url: 'https://github.com/Agnik47/Vitta' },
  };
}

export const DEFAULT_HOST = '127.0.0.1';

export function defaultUrl(def: AgentDef, host = DEFAULT_HOST): string {
  return `http://${host}:${def.port}`;
}

/** Where the orchestrator sends each hop.
 *   NASIKO_URL set  → every hop goes through Nasiko's orchestrator (`/api/orchestrator/a2a`) with the
 *                     agent's Nasiko id in `metadata.agent_id`; NASIKO_TOKEN is the bearer token and
 *                     NASIKO_AGENT_ID_<PLANNER|DISCOVERY|EVALUATOR|PURCHASE> the ids
 *                     (`nasiko deploy` writes each into .nasiko/agent.json).
 *   VITTA_AGENT_<NAME>_URL set for an agent → that agent is called directly even when NASIKO_URL is
 *                     set (mixed mode — e.g. a Purchase Agent that must run beside the gate).
 *   otherwise       → straight to VITTA_AGENT_<NAME>_URL (default 127.0.0.1:<port>). */
export function resolveEndpoints(env: NodeJS.ProcessEnv = process.env): {
  endpoints: Record<AgentName, AgentEndpoint>;
  nasiko: NasikoRouting;
} {
  const endpoints = {} as Record<AgentName, AgentEndpoint>;
  const nasikoUrl = env.NASIKO_URL?.replace(/\/+$/, '');
  const direct: AgentName[] = [];

  for (const name of AGENT_NAMES) {
    const def = AGENT_DEFS[name];
    const key = def.short.toUpperCase();
    const directUrl = env[`VITTA_AGENT_${key}_URL`];
    if (nasikoUrl && !directUrl) {
      const id = env[`NASIKO_AGENT_ID_${key}`];
      if (!id) {
        throw new Error(
          `NASIKO_URL is set but NASIKO_AGENT_ID_${key} is not. Deploy the agent (\`nasiko deploy\`) and copy the id from its .nasiko/agent.json — ` +
            'or unset NASIKO_URL to call the agents directly.',
        );
      }
      endpoints[name] = {
        agent: name,
        url: `${nasikoUrl}/api/orchestrator/a2a`,
        nasikoAgentId: id,
        headers: env.NASIKO_TOKEN ? { authorization: `Bearer ${env.NASIKO_TOKEN}` } : undefined,
      };
    } else {
      endpoints[name] = {
        agent: name,
        url: directUrl ?? defaultUrl(def),
        // The same shared secret a server started with VITTA_AGENT_TOKEN requires.
        headers: env.VITTA_AGENT_TOKEN ? { authorization: `Bearer ${env.VITTA_AGENT_TOKEN}` } : undefined,
      };
      if (nasikoUrl) direct.push(name);
    }
  }
  return {
    endpoints,
    nasiko: nasikoUrl ? { routed: true, url: nasikoUrl, ...(direct.length ? { direct } : {}) } : { routed: false },
  };
}
