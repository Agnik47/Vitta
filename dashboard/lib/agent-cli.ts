// Spawns the real `agent buy` CLI (src/cli/agent.ts -> dist/cli/agent.js) and streams its NDJSON
// progress lines as they arrive, instead of buffering the whole run like gate-cli.ts's
// execFile-based runGateCli(). A real purchase run is minutes long — the dashboard's job store
// needs each step the moment it happens, not only the final result.
//
// Same security posture as gate-cli.ts: spawn with an argument array, no shell (ADR-007). This is
// the only place the dashboard invokes the purchase agent — everything else (mandate creation,
// funding, single add-to-cart, single execute) still goes through gate-cli.ts directly, since those
// are one real gate command each and don't need step-by-step streaming.
import { spawn } from "node:child_process";
import path from "node:path";
import { getDataDir } from "@/lib/read";
import { loadRootEnvOverrides } from "@/lib/gate-cli";

function agentCliEntryPoint(): string {
  return path.join(getDataDir(), "dist", "cli", "agent.js");
}

export interface AgentBuyItem {
  product: string;
  productName: string;
  quantity: number;
}

/** Which settlement path a run takes. Mirrors src/receipt/execution-mode.ts by hand, following this
 *  app's existing convention of not importing src/ types directly (see lib/types.ts's header). */
export type ExecutionMode = "TEST" | "LIVE";

export interface AgentBuyInput {
  merchant: "blinkit" | "zepto" | "bigbasket";
  /** Every line to add before this job's one real checkout — a job is always scoped to a single
   *  merchant (a real checkout can't span two marketplaces), matching the Unified Cart's own
   *  per-merchant Proceed-to-Purchase constraint. */
  items: AgentBuyItem[];
  clearCart: boolean;
  minCartInr?: number;
  maxCartInr?: number;
  mandateId?: string;
  /** TEST settles against the real Prava test reserve without driving the merchant's checkout; LIVE
   *  walks the real checkout to a placed order. Every step before the commit is identical. */
  mode?: ExecutionMode;
}

/** One decoded NDJSON line from the agent CLI — either a step event or the terminal result. Kept as
 *  `unknown`-ish records rather than importing src/agent/PurchaseAgent.ts's types directly: the
 *  dashboard deliberately mirrors src/ shapes by hand instead of importing them (see
 *  docs/06-DASHBOARD-SPEC.md § Why a second app instead of extending the CLI, and lib/types.ts's own
 *  header — this file follows that same existing boundary). */
export type AgentLine = { type: "step" | "result"; [key: string]: unknown };

/**
 * Runs `node dist/cli/agent.js buy <argv...>`, calling `onLine` for each real-time NDJSON line as
 * it arrives (steps first, exactly one final `type:"result"` line last), then resolves once the
 * process exits. Malformed lines are ignored rather than thrown — a partial write mid-stream is a
 * transport artifact, not a run failure, and the terminal result line is what actually matters.
 */
export function runAgentBuy(input: AgentBuyInput, onLine: (line: AgentLine) => void, timeoutMs = 600_000): Promise<{ ok: boolean; exitCode: number }> {
  const argv = [
    "buy",
    "--merchant",
    input.merchant,
    "--items",
    JSON.stringify(
      input.items.map((item) => ({ productRef: item.product, productName: item.productName, quantity: item.quantity }))
    ),
  ];
  if (input.clearCart) argv.push("--clear-cart");
  if (input.minCartInr !== undefined) argv.push("--min-cart", String(input.minCartInr));
  if (input.maxCartInr !== undefined) argv.push("--max-cart", String(input.maxCartInr));
  if (input.mandateId) argv.push("--mandate", input.mandateId);
  // Always sent explicitly. The CLI's own default is LIVE (so pre-existing scripts are unaffected),
  // but a dashboard click must never fall through to placing a real order because a mode was
  // omitted somewhere in the chain — the caller states it every time.
  argv.push("--mode", (input.mode ?? "TEST").toLowerCase());

  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [agentCliEntryPoint(), ...argv], {
      cwd: getDataDir(),
      env: { ...process.env, ...loadRootEnvOverrides() },
    });

    let buffer = "";
    const timer = setTimeout(() => proc.kill(), timeoutMs);

    function consume(chunk: Buffer) {
      buffer += chunk.toString("utf-8");
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as AgentLine;
          if (parsed && (parsed.type === "step" || parsed.type === "result")) onLine(parsed);
        } catch {
          // Ignore an unparseable line rather than crash the whole run over one transport glitch.
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    proc.stdout.on("data", consume);
    proc.stderr.on("data", () => {
      // Real stderr (Node warnings, etc.) is not part of the NDJSON contract — the agent's own
      // failure reporting always goes through a `type:"result"` line with ok:false.
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code ?? 1 });
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: 1 });
    });
  });
}
