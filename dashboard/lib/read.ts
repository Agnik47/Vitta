// Reads the same flat files src/cli writes — never writes to any of them. See
// docs/06-DASHBOARD-SPEC.md. All reads are defensive: a missing/partial file is a normal race
// with the CLI process, not an error — see docs/agent-b/ERROR-HANDLING.md § Dashboard.
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Mandate, GateEvent, Receipt, TransactionAuthorization } from './types';
import { sha256Hex, CHAIN_HEAD_HASH, verifySignature } from './hash';

export function getDataDir(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.MANDATE_GATE_DATA_DIR ?? '../');
}

/**
 * Where mandates/receipts/authorizations/events.jsonl/keys actually get READ and WRITTEN at
 * runtime. On a normal machine (or any host with a persistent filesystem) this is the same as
 * getDataDir() — the repo root. On Vercel it must NOT be: Vercel's deployment filesystem is
 * read-only outside /tmp, but getDataDir() still needs to point at the deployed (read-only)
 * bundle so dist/cli/gate.js and .env can be found there. Splitting the two means the CLI
 * subprocess's cwd (and thus its own relative ./mandates, ./receipts, ./keys writes, per
 * src/cli/store.ts) lands somewhere writable, while entry-point/.env lookups are unaffected.
 *
 * Caveat: /tmp only persists for the lifetime of one warm serverless instance — fine for a single
 * continuous test session, not a substitute for real persistent storage across cold starts.
 */
export function getRuntimeDataDir(): string {
  if (!process.env.VERCEL) return getDataDir();
  const dir = '/tmp/vitta-data';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Locates a compiled CLI entry point (dist/cli/gate.js, agent.js, search.js). Prefers
 * dashboard/dist/... — vercel.json's buildCommand copies the root CLI build there specifically so
 * Next's outputFileTracingIncludes (which Turbopack refuses to point at a `../` path) can bundle
 * it into the deployed function. Falls back to the repo-root dist/ (getDataDir()) for local dev,
 * where nothing copies dist/ into dashboard/.
 */
export function resolveCliEntryPoint(...segments: string[]): string {
  const local = path.join(/* turbopackIgnore: true */ process.cwd(), 'dist', ...segments);
  if (existsSync(local)) return local;
  return path.join(getDataDir(), 'dist', ...segments);
}

/**
 * `mandates/` can hold more than one mandate over a demo's lifetime — `gate mandate resign`
 * creates a brand-new mandate_id rather than mutating the original (docs/05-DEMO-SCRIPT.md
 * Beat 3-4: mnd_01J8FQ -> mnd_01J8FR). mandate_id is a ULID (lexicographically sortable by
 * creation time), so "current" = the greatest mandate_id by string sort. This convention isn't
 * specified anywhere else — noted here since it's a real design call, not a spec-given rule.
 */
export function readCurrentMandate(): Mandate | null {
  const dir = path.join(getRuntimeDataDir(), 'mandates');
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
  const filePath = path.join(getRuntimeDataDir(), 'events.jsonl');
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
  const dir = path.join(getRuntimeDataDir(), 'receipts');
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

export function readAuthorizations(): TransactionAuthorization[] {
  const dir = path.join(getRuntimeDataDir(), 'authorizations');
  if (!existsSync(dir)) return [];

  const authorizations: TransactionAuthorization[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      authorizations.push(JSON.parse(readFileSync(path.join(dir, file), 'utf-8')) as TransactionAuthorization);
    } catch {
      // Mid-write or malformed file — skip it, don't crash the route.
    }
  }
  return authorizations;
}

/** A TransactionAuthorization is signed but never chain-linked (see authorization.ts's own header
 *  for why) — so this only needs to check its own signature, not a chain link. Same null-when-no-
 *  key-yet behavior as verifyChainLocal(). */
export function verifyAuthorizationSignature(
  authorization: TransactionAuthorization,
  gatePublicKeyPem: string | null,
): boolean | null {
  if (!gatePublicKeyPem) return null;
  const { sig, ...unsigned } = authorization;
  return verifySignature(unsigned, sig, gatePublicKeyPem);
}

export interface ChainVerification {
  receipt_id: string;
  /** null = gate public key not found yet (keys/gate.public.pem doesn't exist until the CLI has
   * signed at least one receipt on this machine — src/cli/keys.ts, gitignored, per-machine).
   * Chain-link validity below needs no key at all, so it's real regardless. */
  signature_valid: boolean | null;
  chain_link_valid: boolean;
}

/** Reads keys/gate.public.pem via the same MANDATE_GATE_DATA_DIR the CLI writes to — per
 * src/cli/keys.ts's design note, no new configuration surface. Returns null if it doesn't exist
 * yet (no receipt has ever been signed on this machine) rather than throwing. */
export function loadGatePublicKeyPem(): string | null {
  const keyPath = path.join(getRuntimeDataDir(), 'keys', 'gate.public.pem');
  if (!existsSync(keyPath)) return null;
  try {
    return readFileSync(keyPath, 'utf-8');
  } catch {
    return null;
  }
}

/** Re-implementation of src/receipt/chain.ts's verifyChain() — see docs/06-DASHBOARD-SPEC.md's
 * duplication note. Chain-link check must flip to invalid on a real tamper-test file edit
 * (05-DEMO-SCRIPT.md Beat 7), which it does: any field change alters sha256Hex(receipt), breaking
 * the NEXT receipt's prev_receipt_hash match. Signature check needs `gatePublicKeyPem`; pass null
 * (e.g. from loadGatePublicKeyPem() before the key exists) to get `signature_valid: null` instead
 * of a false negative. */
export function verifyChainLocal(receipts: Receipt[], gatePublicKeyPem: string | null): ChainVerification[] {
  const sorted = [...receipts].sort((a, b) => a.signed_at.localeCompare(b.signed_at));
  return sorted.map((receipt, i) => {
    const expectedPrevHash = i === 0 ? CHAIN_HEAD_HASH : sha256Hex(sorted[i - 1]);
    const { sig, ...unsigned } = receipt;
    return {
      receipt_id: receipt.receipt_id,
      signature_valid: gatePublicKeyPem ? verifySignature(unsigned, sig, gatePublicKeyPem) : null,
      chain_link_valid: receipt.prev_receipt_hash === expectedPrevHash,
    };
  });
}
