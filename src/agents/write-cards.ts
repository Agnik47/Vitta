// Regenerates nasiko/agents/<agent>/AgentCard.json from the registry — the registry is the single
// source of truth, and registry.test.ts fails if a committed card drifts from it.
//   npm run nasiko:cards
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { AGENT_NAMES } from './protocol';
import { AGENT_DEFS, agentCard } from './registry';

// Nasiko's local runtime reaches an agent at localhost:8000 (docs.nasiko.com/quickstart); the
// container serves on PORT, which nasiko/Dockerfile sets to 8000.
const CARD_URL = 'http://localhost:8000';

const root = path.resolve(__dirname, '..', '..', 'nasiko', 'agents');
for (const name of AGENT_NAMES) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'AgentCard.json'), JSON.stringify(agentCard(AGENT_DEFS[name], CARD_URL), null, 2) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), path.join(dir, 'AgentCard.json'))}`);
}
