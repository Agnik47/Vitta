// Persistent Purchase Job state machine & job store (ADR-015 Architecture Improvement #2).
// Tracks explicit lifecycle states so purchases survive page refreshes or backend process restarts:
// PENDING → SEARCH_COMPLETE → WAITING_FOR_SELECTION → ADDING_TO_CART → VERIFYING_CART → WAITING_GATE → PAYING → ORDER_PLACED → RECEIPT_READY (or FAILED)

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runAgentBuy, type AgentBuyInput, type AgentLine } from "./agent-cli";

import { deriveJobState, type PurchaseJobState } from "./purchase-job-state";
export type { PurchaseJobState };

export interface PurchaseJob {
  id: string;
  sessionId: string;
  status: "running" | "done" | "failed";
  state: PurchaseJobState;
  input: AgentBuyInput;
  events: AgentLine[];
  result?: AgentLine;
  startedAt: string;
  finishedAt?: string;
}

const STORAGE_FILE = path.join(process.cwd(), "purchase_jobs_store.json");
const jobs = new Map<string, PurchaseJob>();
const clearedMerchants = new Map<string, Set<string>>();
const MAX_JOBS = 200;

function loadJobsFromDisk(): void {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      const list: PurchaseJob[] = JSON.parse(raw);
      for (const j of list) {
        jobs.set(j.id, j);
      }
    }
  } catch {
    // Fail silently on corrupt disk store and start fresh
  }
}

function persistJobsToDisk(): void {
  try {
    const list = Array.from(jobs.values()).slice(-MAX_JOBS);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // Disk write error - keep in memory
  }
}

// Initial load
loadJobsFromDisk();

function evictOldestIfFull(): void {
  if (jobs.size < MAX_JOBS) return;
  const oldest = jobs.keys().next();
  if (!oldest.done) jobs.delete(oldest.value);
}

export function hasBeenCleared(sessionId: string, merchant: string): boolean {
  return clearedMerchants.get(sessionId)?.has(merchant) ?? false;
}

function markCleared(sessionId: string, merchant: string): void {
  const set = clearedMerchants.get(sessionId) ?? new Set<string>();
  set.add(merchant);
  clearedMerchants.set(sessionId, set);
}



export function startPurchaseJob(sessionId: string, input: Omit<AgentBuyInput, "clearCart">): PurchaseJob {
  evictOldestIfFull();
  const clearCart = !hasBeenCleared(sessionId, input.merchant);
  const fullInput: AgentBuyInput = { ...input, clearCart };

  const job: PurchaseJob = {
    id: randomUUID(),
    sessionId,
    status: "running",
    state: "ADDING_TO_CART",
    input: fullInput,
    events: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  persistJobsToDisk();

  runAgentBuy(fullInput, (line: AgentLine) => {
    job.events.push(line);
    if (line.type === "result") job.result = line;
    job.state = deriveJobState(job.events, job.state);
    persistJobsToDisk();
  })
    .then(() => {
      // job.state is already correct at this point — deriveJobState() saw the final result event
      // inside the onLine callback above, including the awaitingMerchantConfirmation case. Only
      // job.status needs deciding here: "failed" means the run genuinely didn't complete (a policy
      // DENY, or an unhandled error); "done" covers every other real terminal state, including
      // WAITING_FOR_MERCHANT_CONFIRMATION and the proof:'none' hand-off case — the automated pipeline
      // did everything it honestly could and stopped at a real, non-error state, so "failed" would
      // misrepresent it (this replaces the old binary receiptId-or-ORDER_PLACED-or-FAILED override,
      // which is exactly what previously produced a blunt "Purchase failed" for an authorized-but-
      // not-yet-merchant-confirmed run).
      job.status = job.state === "FAILED" ? "failed" : "done";
      job.finishedAt = new Date().toISOString();
      // Unchanged from before: markCleared fires on ok:true (a real receipt, or the proof:'none'
      // hand-off case) — an awaiting-merchant-confirmation run is ok:false, so this correctly does
      // NOT mark cleared, same as a genuine failure (the un-purchased items are still validly
      // sitting in the real cart; nothing here should wipe them for no reason).
      if (job.result?.ok === true && clearCart) markCleared(sessionId, input.merchant);
      persistJobsToDisk();
    })
    .catch((err: Error) => {
      job.status = "failed";
      job.state = "FAILED";
      job.finishedAt = new Date().toISOString();
      job.events.push({ type: "result", ok: false, failureReason: err.message });
      job.result = job.events[job.events.length - 1];
      persistJobsToDisk();
    });

  return job;
}

export function getPurchaseJob(jobId: string): PurchaseJob | undefined {
  return jobs.get(jobId);
}
