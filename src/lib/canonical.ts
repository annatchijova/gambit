/**
 * GAMBIT YourMove — canonical serialisation.
 *
 * Lives in its own module, apart from state_rules.ts, for one reason: that file
 * imports `node:crypto`, so anything importing it is server-only. The canonical
 * form itself is pure — no I/O, no clock, no platform dependency — and the
 * browser needs it to recompute a seal for itself (see components/SealVerifier).
 *
 * A seal is only meaningful if the bytes being hashed are reproducible, which
 * is what "canonical" buys: object keys sorted, undefined dropped, no
 * incidental whitespace. Two runs, two machines, two languages — same string.
 */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(',')}}`;
}
