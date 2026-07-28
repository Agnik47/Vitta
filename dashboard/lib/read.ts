// Reads the same flat files src/cli writes — never writes to any of them. See
// docs/06-DASHBOARD-SPEC.md. All reads are defensive: a missing/partial file is a normal race
// with the CLI process, not an error — see docs/agent-b/ERROR-HANDLING.md § Dashboard.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Mandate, GateEvent, Receipt } from './types';
import { sha256Hex, CHAIN_HEAD_HASH } from './hash';

export function getDataDir(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.MANDATE_GATE_DATA_DIR ?? '../');
}

/**
 * `mandates/` can hold more than one mandate over a demo's lifetime — `gate mandate resign`
 * creates a brand-new mandate_id rather than mutating the original (docs/05-DEMO-SCRIPT.md
 * Beat 3-4: mnd_01J8FQ -> mnd_01J8FR). mandate_id is a ULID (lexicographically sortable by
 * creation time), so "current" = the greatest mandate_id by string sort. This convention isn't
 * specified anywhere else — noted here since it's a real design call, not a spec-given rule.
 */
export function readCurrentMandate(): Mandate | null {
  const dir = path.join(getDataDir(), 'mandates');
  if (!existsSync(dir)) return null;

  let latest: Mandate | null = null;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(readFileSync(path.join(dir, file), 'utf-8')) as Mandate;
      if (!latest || parsed.mandate_id > latest.mandate_id) latest = parsed;
    } catch {
      // Mid-write or malformed file — skip it, don't crash the route.
    }
  }
  return latest;
}

/** Reads events.jsonl, optionally returning only events after `sinceId` (by file position, not
 * by value comparison — event_id is a UUID, not orderable). If `sinceId` isn't found (first poll,
 * or the log was rotated), returns everything rather than risk silently dropping events. */
export function readEventsSince(sinceId: string | null): GateEvent[] {
  const filePath = path.join(getDataDir(), 'events.jsonl');
  if (!existsSync(filePath)) return [];

  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const events: GateEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as GateEvent);
    } catch {
      // Last line mid-append, or a corrupt line — skip it, don't crash the route.
    }
  }

  if (!sinceId) return events;
  const idx = events.findIndex((e) => e.event_id === sinceId);
  return idx === -1 ? events : events.slice(idx + 1);
}

export function readReceipts(): Receipt[] {
  const dir = path.join(getDataDir(), 'receipts');
  if (!existsSync(dir)) return [];

  const receipts: Receipt[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      receipts.push(JSON.parse(readFileSync(path.join(dir, file), 'utf-8')) as Receipt);
    } catch {
      // Mid-write or malformed file — skip it, don't crash the route.
    }
  }
  return receipts;
}

export interface ChainVerification {
  receipt_id: string;
  /** null = not yet checkable — the gate's public key has no defined persistence location yet
   * (Phase 1f gap, see docs/agent-b/WORKSPACE.md § Notes for Agent A). Chain-link validity below
   * needs no key at all, so it's real either way. */
  signature_valid: boolean | null;
  chain_link_valid: boolean;
}

/** Re-implementation of src/receipt/chain.ts's verifyChain() hash-link check — see
 * docs/06-DASHBOARD-SPEC.md's duplication note. Must flip to invalid on a real tamper-test file
 * edit (05-DEMO-SCRIPT.md Beat 7), which it does: any field change alters sha256Hex(receipt),
 * breaking the NEXT receipt's prev_receipt_hash match. */
export function verifyChainLocal(receipts: Receipt[]): ChainVerification[] {
  const sorted = [...receipts].sort((a, b) => a.signed_at.localeCompare(b.signed_at));
  return sorted.map((receipt, i) => {
    const expectedPrevHash = i === 0 ? CHAIN_HEAD_HASH : sha256Hex(sorted[i - 1]);
    return {
      receipt_id: receipt.receipt_id,
      signature_valid: null,
      chain_link_valid: receipt.prev_receipt_hash === expectedPrevHash,
    };
  });
}
