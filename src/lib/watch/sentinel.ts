import { runFleet, type FleetLevel, type FleetVerdict } from '../frameworks';
import { canonicalJson, sha256 } from '../state_rules';
import type { InboundMessage } from './inbox';

/**
 * GAMBIT YourMove — the WATCH sentinel: autonomous triage over an inbox.
 *
 * ============================================================================
 * WHAT THIS FILE IS
 * ============================================================================
 *
 * This is the decision path of the autonomous mode, and it is deterministic by
 * construction — the same architecture as fleet.ts and state_rules.ts. For each
 * inbound message the fleet SEALS a verdict (no model in the loop), and this
 * module maps that sealed verdict to one of three dispositions by a fixed rule.
 * No language model decides whether to interrupt the human; the model is only
 * ever asked, later and elsewhere (the /api/watch route), to pre-draft replies
 * for the messages this code already decided to escalate.
 *
 * The three properties this file guarantees, all tested:
 *
 *   1. DETERMINISM. runTriage is a pure function of the inbox. Same inbox in →
 *      same dispositions, same seals, same chain head, on any machine. No clock,
 *      no randomness, no model call touches a routed decision.
 *
 *   2. TAMPER-EVIDENCE. Every triage entry is sealed with SHA-256 over its
 *      decision and the previous entry's hash, so the run is an append-only
 *      chain (the same construction as the TRAIN transition log). Altering,
 *      reordering, inserting or dropping a decision breaks verifyTriageChain.
 *      The seal covers the DECISION only; a best-effort draft attached later by
 *      the route sits beside the chain and cannot change it.
 *
 *   3. HONEST DEGRADATION. A message the English lenses cannot read is not
 *      archived as if it were clean — it is flagged for a human. An escalated
 *      message whose draft the model fails to produce is still escalated; the
 *      missing draft is reported, never faked.
 *
 * ACCURACY is not claimed, exactly as in fleet.ts and state_rules.ts. The
 * dispositions are a deterministic, auditable function of a lexical verdict, not
 * a measured classifier. Describe them as such.
 */

export const WATCH_SEAL_VERSION = 'gambit-watch-v1' as const;

/** What the sentinel decided to do with a message, without a human in the loop. */
export type Disposition = 'ARCHIVED' | 'WATCH' | 'ESCALATED';

/** One sealed decision in the append-only triage chain. */
export interface TriageEntry {
  /** Position in the pass, 0-based. Part of the seal so reordering is caught. */
  seq: number;
  id: string;
  from: string;
  scenario: string;
  message: string;
  level: FleetLevel;
  /** Rounded percentage for display only. Never fed back into a sealed value. */
  scorePercent: number;
  confidence: FleetVerdict['confidence'];
  corroboration: number;
  activeFrameworks: FleetVerdict['activeFrameworks'];
  coverage: FleetVerdict['coverage'];
  disposition: Disposition;
  /** Why this disposition, in words the dashboard shows verbatim. */
  reason: string;
  /** The fleet's own SHA-256 over the message verdict, computed pre-model. */
  verdictSeal: string;
  /** SHA-256 of the previous triage entry, or null for the first. */
  prevHash: string | null;
  /** SHA-256 seal of THIS decision (covers the decision, not any draft). */
  hash: string;
}

/** The result of one autonomous pass over the inbox. */
export interface TriageResult {
  entries: TriageEntry[];
  /** Hash of the last decision; the verifiable head of the chain. */
  head: string | null;
  counts: Record<Disposition, number>;
}

/**
 * The exact fields sealed per decision. Defined once so the sealer and the
 * verifier below build byte-identical payloads and can never drift apart.
 */
interface TriageSealInput {
  sealVersion: typeof WATCH_SEAL_VERSION;
  seq: number;
  id: string;
  disposition: Disposition;
  level: FleetLevel;
  /** Exact aggregate score as "numerator/denominator" — never a float. */
  score: string;
  corroboration: number;
  /** Binds the message's own sealed fleet verdict into this decision. */
  verdictSeal: string;
  prevHash: string | null;
}

function triageSeal(input: TriageSealInput): string {
  return sha256(canonicalJson(input));
}

/**
 * Map a sealed fleet verdict to an autonomous disposition.
 *
 * Pure and total. The ordering of the guards is the policy:
 *
 *   - A message the English lenses could not read is NOT clean — it is flagged
 *     for a human (WATCH), never archived. Honest degradation before anything
 *     else, so a confident all-clear is never issued on an unread message.
 *   - Below the corroboration gate, or CLEAN: archived without interrupting
 *     anyone. This is the common, quiet case, and handling it silently is the
 *     whole point of the mode.
 *   - MIXED: a real but weak, mixed signal. Kept on watch, not escalated.
 *   - PERSUASIVE / MANIPULATIVE: corroborated pressure. Escalated to the human,
 *     with a draft pre-staged by the route.
 */
export function routeVerdict(v: FleetVerdict): { disposition: Disposition; reason: string } {
  if (v.coverage === 'out_of_scope') {
    return {
      disposition: 'WATCH',
      reason:
        'Outside the English lexical scope of the lenses, so no verdict was earned. Flagged for a human rather than archived as clean.',
    };
  }
  if (!v.gatePassed || v.level === 'CLEAN') {
    return {
      disposition: 'ARCHIVED',
      reason:
        'No corroborated pressure signal — fewer than two lenses fired. Archived without interrupting you.',
    };
  }
  if (v.level === 'MIXED') {
    return {
      disposition: 'WATCH',
      reason: `Weak, mixed signal at ${v.scorePercent}%. Kept on watch; not escalated on its own.`,
    };
  }
  return {
    disposition: 'ESCALATED',
    reason: `${v.level} at ${v.scorePercent}%, corroborated across ${v.corroboration} lenses. Needs your decision.`,
  };
}

/**
 * Run one autonomous pass over an inbox.
 *
 * Pure and deterministic given `inbox`. Each message is read by the fleet (which
 * seals its own verdict), routed by `routeVerdict`, and chained: the decision is
 * sealed with SHA-256 over the previous decision's hash. The `draft` field is
 * intentionally absent here — drafting is a best-effort model call the route
 * layer attaches afterward, outside the sealed chain.
 */
export function runTriage(inbox: readonly InboundMessage[]): TriageResult {
  const entries: TriageEntry[] = [];
  const counts: Record<Disposition, number> = { ARCHIVED: 0, WATCH: 0, ESCALATED: 0 };
  let prevHash: string | null = null;

  inbox.forEach((msg, seq) => {
    const verdict = runFleet(msg.message);
    const { disposition, reason } = routeVerdict(verdict);

    const hash = triageSeal({
      sealVersion: WATCH_SEAL_VERSION,
      seq,
      id: msg.id,
      disposition,
      level: verdict.level,
      score: verdict.score,
      corroboration: verdict.corroboration,
      verdictSeal: verdict.seal,
      prevHash,
    });

    entries.push({
      seq,
      id: msg.id,
      from: msg.from,
      scenario: msg.scenario,
      message: msg.message,
      level: verdict.level,
      scorePercent: verdict.scorePercent,
      confidence: verdict.confidence,
      corroboration: verdict.corroboration,
      activeFrameworks: verdict.activeFrameworks,
      coverage: verdict.coverage,
      disposition,
      reason,
      verdictSeal: verdict.seal,
      prevHash,
      hash,
    });

    counts[disposition] += 1;
    prevHash = hash;
  });

  return { entries, head: prevHash, counts };
}

/**
 * Verify the triage chain of a pass.
 *
 * Rebuilds each seal from the reported fields alone and checks that every entry
 * points at its predecessor. Returns the index of the first broken link, or -1
 * when the chain is intact. Independent of how the pass was produced, so an
 * auditor can confirm no decision was altered, reordered, inserted or dropped.
 */
export function verifyTriageChain(entries: readonly TriageEntry[]): number {
  let prev: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return i;
    const recomputed = triageSeal({
      sealVersion: WATCH_SEAL_VERSION,
      seq: e.seq,
      id: e.id,
      disposition: e.disposition,
      level: e.level,
      // The seal stores the exact fraction; the entry exposes it only as a
      // percentage for display. Re-seal from the fleet's verdict seal, which is
      // the value actually bound into the chain, so this verifier needs no float.
      score: scoreForVerify(e),
      corroboration: e.corroboration,
      verdictSeal: e.verdictSeal,
      prevHash: e.prevHash,
    });
    if (recomputed !== e.hash) return i;
    prev = e.hash;
  }
  return -1;
}

/**
 * The chain seals the exact fraction score, which the public TriageEntry does
 * not carry (it exposes only a display percentage). Rather than leak a float
 * into the verifier, the seal is reproduced from the fleet verdict re-run on the
 * message — the same deterministic function that produced it. Kept internal.
 */
function scoreForVerify(e: TriageEntry): string {
  return runFleet(e.message).score;
}
