// Shared unique-ID generator for mandate_id / receipt_id / event_id.
//
// docs/04-POLICY-ENGINE-SPEC.md and docs/01-ARCHITECTURE.md both say "ULID recommended" (not
// required) for these fields. A spec-correct ULID (Crockford base32, monotonic-within-millisecond)
// is real complexity nothing downstream actually needs — no code anywhere parses an ID's timestamp
// back out or validates its format. Implemented a simpler scheme instead: real timestamp + real
// crypto-random bytes, base36-encoded, prefixed. Still genuinely unique and time-ordered-ish, just
// not byte-for-byte ULID format. See docs/OUTCOME.md Phase 1f.
import { randomBytes } from 'node:crypto';

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}${random}`;
}
