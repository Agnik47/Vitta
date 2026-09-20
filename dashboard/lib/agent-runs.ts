// Server-side: reads the run records the shop CLI writes (agent-runs/<run_id>.json) and starts new
// runs by spawning it — the same pattern lib/agent-cli.ts uses for the purchase agent. The dashboard
// never runs an agent or the gate in its own process; a run is `node dist/cli/shop.js`, and the
// gate underneath is still the one audited `gate` CLI (ADR-015).
//
// Every argument here can originate from a browser request. spawn() with an argv array, no shell
// (ADR-007), and the request text goes after a bare `--` so it can never be parsed as a flag.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { getRuntimeDataDir, resolveCliEntryPoint } from "@/lib/read";
import { loadRootEnvOverrides } from "@/lib/gate-cli";
import { runtimeEnv } from "@/lib/runtime-env";
import type { AgentRun } from "@/lib/agent-run-types";

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function agentRunsDir(): string {
  return path.join(getRuntimeDataDir(), "agent-runs");
}

export function listAgentRuns(limit = 50): AgentRun[] {
  const dir = agentRunsDir();
  if (!existsSync(dir)) return [];
  const runs: AgentRun[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      runs.push(JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as AgentRun);
    } catch {
      // Mid-write or malformed file — skip it, don't crash the route.
    }
  }
  return runs.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, limit);
}

export function getAgentRun(runId: string): AgentRun | undefined {
  if (!RUN_ID_RE.test(runId)) return undefined;
  const file = path.join(agentRunsDir(), `${runId}.json`);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as AgentRun;
  } catch {
    return undefined;
  }
}

export interface StartAgentRunInput {
  /** Natural-language request → goes through the Planner. */
  request?: string;
  /** A ready-made ShoppingIntent (the Price Sniper) → the Planner is skipped. */
  intent?: Record<string, unknown>;
  /** Explicit, always. TEST settles against the sandbox reserve without driving checkout; LIVE places a real order. */
  mode: "TEST" | "LIVE";
  mandateId?: string;
  sessionId?: string;
  /** The dashboard's own origin — lets the Deal Discovery agent search through /api/shop/search (Anakin first). */
  dashboardOrigin?: string;
}

/** Records a run that never got as far as the CLI writing its own record (dist missing, spawn error…),
 *  so the page shows the failure instead of waiting forever on a run that will never appear. */
function writeSpawnFailure(runId: string, input: StartAgentRunInput, message: string): void {
  const dir = agentRunsDir();
  mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  const record: AgentRun = {
    run_id: runId,
    request_id: runId,
    session_id: input.sessionId ?? "none",
    trace_id: "none",
    source: input.intent ? "price-sniper" : "user",
    mode: input.mode,
    request_text: input.request,
    status: "FAILED",
    stages: [],
    error: { code: "ORCHESTRATOR_ERROR", message },
    nasiko: { routed: false },
    started_at: now,
    completed_at: now,
  };
  const file = path.join(dir, `${runId}.json`);
  writeFileSync(`${file}.tmp`, JSON.stringify(record, null, 2));
  renameSync(`${file}.tmp`, file);
}

/** Starts a run in the background and returns its id immediately; the record fills in as it goes. */
export function startAgentRun(input: StartAgentRunInput): { runId: string } {
  const runId = `req_${randomBytes(8).toString("hex")}`;
  const argv = [
    "run",
    "--mode",
    input.mode.toLowerCase(),
    "--run-id",
    runId,
  ];
  if (input.mandateId) argv.push("--mandate", input.mandateId);
  if (input.sessionId) argv.push("--session", input.sessionId);
  // Agents run in-process unless the deployment says they are separate A2A servers / behind Nasiko.
  const transport = runtimeEnv("VITTA_AGENT_TRANSPORT");
  if (transport !== "a2a" && !runtimeEnv("NASIKO_URL")) argv.push("--in-process");
  if (input.intent) argv.push("--intent-json", JSON.stringify(input.intent));
  else if (input.request) argv.push("--", input.request);
  else throw new Error("startAgentRun needs a request or an intent");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...loadRootEnvOverrides(),
    VITTA_AGENT_RUNS_DIR: agentRunsDir(),
  };
  for (const name of [
    "NASIKO_URL",
    "NASIKO_TOKEN",
    "NASIKO_AGENT_ID_PLANNER",
    "NASIKO_AGENT_ID_DISCOVERY",
    "NASIKO_AGENT_ID_EVALUATOR",
    "NASIKO_AGENT_ID_PURCHASE",
    "VITTA_AGENT_PLANNER_URL",
    "VITTA_AGENT_DISCOVERY_URL",
    "VITTA_AGENT_EVALUATOR_URL",
    "VITTA_AGENT_PURCHASE_URL",
    "VITTA_AGENT_TOKEN",
  ]) {
    const value = runtimeEnv(name);
    if (value) env[name] = value;
  }
  if (input.dashboardOrigin) env.VITTA_DASHBOARD_URL = input.dashboardOrigin;

  const child = spawn(process.execPath, [resolveCliEntryPoint("cli", "shop.js"), ...argv], {
    cwd: getRuntimeDataDir(),
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d: Buffer) => {
    stderr += d.toString("utf-8");
  });
  child.on("close", (code) => {
    // A run that failed inside the pipeline still wrote its own record. Only a run that died
    // before writing anything needs one made for it.
    if (code !== 0 && !getAgentRun(runId)) {
      writeSpawnFailure(runId, input, stderr.trim().slice(0, 500) || `shop CLI exited with code ${code}`);
    }
  });
  child.on("error", (err) => writeSpawnFailure(runId, input, err.message));
  return { runId };
}
