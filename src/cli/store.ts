// File I/O for mandates/ and receipts/. The CLI is the only layer that touches disk directly —
// src/mandate, src/policy, src/receipt all stay pure per docs/AGENTS.md's "pure logic before
// infrastructure" philosophy; this file is where that I/O actually happens.
//
// loadAllMandates() silently skips a file that fails isMandate() (informational use only, by
// gate scan's governed-count) but loadAllReceipts() throws loudly on any parse failure — per
// docs/agent-a/ERROR-HANDLING.md, a silently-dropped receipt could make chain verification pass
// when it shouldn't, which is a materially worse failure mode than a scan count being off by one.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { isMandate } from '../mandate/schema';
import type { Mandate } from '../mandate/schema';
import type { Receipt } from '../receipt/schema';
import type { GateEvent } from '../events/GateEvent';

const MANDATES_DIR = './mandates';
const RECEIPTS_DIR = './receipts';
const EVENTS_PATH = './events.jsonl';

/** Appends one GateEvent as a JSON line — the dashboard's /events page (dashboard/lib/read.ts)
 * polls this same file. Every `gate run` decision (read or write, allow or deny) must call this,
 * not just print via formatGateEventLine() — the terminal line and the persisted line are two
 * separate, both-required outputs of the same event. */
export function appendEvent(event: GateEvent, filePath = EVENTS_PATH): void {
  appendFileSync(filePath, JSON.stringify(event) + '\n');
}

export function saveMandate(mandate: Mandate, dir = MANDATES_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${mandate.mandate_id}.json`), JSON.stringify(mandate, null, 2));
}

export function loadMandate(mandateId: string, dir = MANDATES_DIR): Mandate {
  const filePath = path.join(dir, `${mandateId}.json`);
  if (!existsSync(filePath)) {
    throw new Error(`No mandate found with id "${mandateId}" (looked for ${filePath})`);
  }
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (!isMandate(parsed)) {
    throw new Error(`${filePath} does not contain a structurally valid mandate`);
  }
  return parsed;
}

export function loadAllMandates(dir = MANDATES_DIR): Mandate[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f): unknown => JSON.parse(readFileSync(path.join(dir, f), 'utf-8')))
    .filter(isMandate);
}

export function saveReceipt(receipt: Receipt, dir = RECEIPTS_DIR): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${receipt.receipt_id}.json`), JSON.stringify(receipt, null, 2));
}

export function loadReceipt(receiptId: string, dir = RECEIPTS_DIR): Receipt {
  const filePath = path.join(dir, `${receiptId}.json`);
  if (!existsSync(filePath)) {
    throw new Error(`No receipt found with id "${receiptId}" (looked for ${filePath})`);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as Receipt;
}

export function loadAllReceipts(dir = RECEIPTS_DIR): Receipt[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(dir, f);
      try {
        return JSON.parse(readFileSync(filePath, 'utf-8')) as Receipt;
      } catch (err) {
        throw new Error(`Failed to parse receipt file ${filePath}: ${(err as Error).message}`);
      }
    });
}
