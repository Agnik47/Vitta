// Duplicated from src/mandate/sign.ts's canonicalJSON() and src/receipt/chain.ts's sha256Hex()/
// CHAIN_HEAD_HASH. Must match byte-for-byte or the dashboard's chain-verify will disagree with
// `gate verify`'s real result on identical files — see docs/06-DASHBOARD-SPEC.md's duplication note.
import crypto from 'node:crypto';

export function canonicalJSON(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj));
}

function sortKeysDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeysDeep((obj as Record<string, unknown>)[k]);
        return acc;
      }, {} as Record<string, unknown>);
  }
  return obj;
}

export function sha256Hex(obj: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJSON(obj)).digest('hex')}`;
}

export const CHAIN_HEAD_HASH = `sha256:${'0'.repeat(64)}`;
