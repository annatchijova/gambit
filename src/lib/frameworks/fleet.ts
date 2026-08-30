import { Fraction, sumFractions } from '../fraction';
import { sha256 } from '../state_rules';
import { normaliseMessage } from '../state_rules';
import type { FrameworkAnalyzer, FrameworkName, FrameworkSignal } from './types';
import { analyzeGrice } from './grice';
import { analyzeCialdini } from './cialdini';
import { analyzeAristotle } from './aristotle';
import { analyzeBerne } from './berne';
import { assessScope, type Coverage } from './scope';
import { fleetSealInput } from './seal_payload';

/**
 * GAMBIT YourMove — the framework fleet.
 *
 * ============================================================================
 * WHAT THIS IS
 * ============================================================================
 *
 * A deterministic fleet of theoretical lenses reads one inbound message and the
 * fleet SEALS a verdict about it — before any language model is called. This is
 * the same architecture as the state engine (state_rules.ts) and the same
 * architecture as the sibling projects it is ported from (ARGOS, corvus,
 * wolf-and-cronos): the machinery that decides is deterministic and auditable;
 * the model only narrates what was decided and cannot change it.
 *
 * The three properties this file is built to guarantee, all tested:
 *
 *   1. DETERMINISM. Same message → same verdict, same seal, on any machine.
 *      No float touches the score (fraction.ts), no clock, no randomness, no
 *      model call. That is what makes the seal meaningful.
 *
 *   2. CORROBORATION. A single lens firing is noise. A non-CLEAN verdict
 *      requires at least CORROBORATION_THRESHOLD lenses to agree, independently.
 *      This is the gate ported verbatim in spirit from wolf-and-cronos: below
 *      threshold, the verdict is forced CLEAN no matter how loud one lens is.
 *
 *   3. HONEST DEGRADATION. A lens that throws is recorded as crashed and simply
 *      does not vote. One broken analyser degrades coverage; it never fabricates
 *      a verdict and never takes the fleet down with it.
 *
 * ACCURACY is NOT claimed here, exactly as in state_rules.ts. The lenses are
 * lexical heuristics. They are deterministic and auditable, not measured against
 * a labelled corpus. Describe them as such everywhere.
 */

export const FLEET_SCHEMA_VERSION = 1 as const;
export const FLEET_SEAL_VERSION = 'gambit-fleet-v1' as const;

/** A lens is "active" (votes) once its severity clears this floor. */
const FIRE_FLOOR = Fraction.of(1, 10);

/** A lens is "significant" (earns a convergence bonus) at this severity. */
const SIGNIFICANT = Fraction.of(1, 5);

/**
 * Minimum number of active lenses for a non-CLEAN verdict. Below this the
 * fleet returns CLEAN regardless of any single severity — the corroboration
 * gate. Two independent frameworks agreeing is the smallest defensible signal.
 */
export const CORROBORATION_THRESHOLD = 2;

/**
 * Aggregate weights. Only the weights of ACTIVE lenses are summed into the
 * denominator (silence = no signal, so a quiet lens does not dilute a loud
 * consensus). Chosen to sum to 1 across the full fleet for legibility; the
 * aggregate is a weighted average over whichever subset actually fired.
 */
const WEIGHTS: Record<FrameworkName, Fraction> = {
  cialdini: Fraction.of(3, 10),
  aristotle: Fraction.of(1, 4),
  grice: Fraction.of(1, 4),
  berne: Fraction.of(1, 5),
};

/** Verdict-level thresholds over the aggregate score. */
const T_MANIPULATIVE = Fraction.of(3, 4);
const T_PERSUASIVE = Fraction.of(1, 2);
const T_MIXED = Fraction.of(1, 4);

export type FleetLevel = 'CLEAN' | 'MIXED' | 'PERSUASIVE' | 'MANIPULATIVE';
export type FleetConfidence = 'High' | 'Medium' | 'Low';

export interface FleetVerdict {
  schemaVersion: typeof FLEET_SCHEMA_VERSION;
  sealVersion: typeof FLEET_SEAL_VERSION;
  level: FleetLevel;
  /** Exact aggregate score in [0, 1], as "numerator/denominator". */
  score: string;
  /** Rounded percentage for display only. Never fed back into a sealed value. */
  scorePercent: number;
  confidence: FleetConfidence;
  /** Lenses that voted, in fleet order. */
  activeFrameworks: FrameworkName[];
  /** Lenses that stayed below the fire floor. */
  silentFrameworks: FrameworkName[];
  /** Lenses that threw and did not vote (honest degradation). */
  crashedFrameworks: FrameworkName[];
  /** Number of active lenses; the corroboration count. */
  corroboration: number;
  gatePassed: boolean;
  /** Every lens's full reading, for the audit panel. Severities as strings. */
  signals: SealedSignal[];
  /**
   * Whether the English lenses could read this message at all.
   *
   * DERIVED AND NOT SEALED, for the same reason `confidence` and
   * `scorePercent` are not: the seal covers what the lenses FOUND, and this
   * says whether they could look. It is a deterministic function of the raw
   * message (see scope.ts), so it is reproducible without being part of the
   * sealed payload — and a verdict's integrity does not depend on it.
   */
  coverage: Coverage;
  /** Why, in words the interface can show the user verbatim. */
  scopeReason: string;
  /** SHA-256 over the canonical verdict payload, computed before any LLM call. */
  seal: string;
}

/** A framework signal with its rational severity flattened for sealing/JSON. */
export interface SealedSignal {
  framework: FrameworkName;
  title: string;
  severity: string;
  severityPercent: number;
  tags: string[];
  evidence: string[];
}

/** The fleet, in a fixed order. Order is part of determinism. */
const FLEET: ReadonlyArray<{ name: FrameworkName; analyze: FrameworkAnalyzer }> = [
  { name: 'grice', analyze: analyzeGrice },
  { name: 'cialdini', analyze: analyzeCialdini },
  { name: 'aristotle', analyze: analyzeAristotle },
  { name: 'berne', analyze: analyzeBerne },
];

function toSealed(sig: FrameworkSignal): SealedSignal {
  return {
    framework: sig.framework,
    title: sig.title,
    severity: sig.severity.toString(),
    severityPercent: sig.severity.toPercent(),
    tags: sig.tags,
    evidence: sig.evidence,
  };
}

/**
 * Map an aggregate score to a verdict level. Exported so the composite layer
 * (which folds in the semantic LLM vote) classifies on the same thresholds the
 * deterministic core uses — one scale, one place to change it.
 */
export function levelFor(score: Fraction): FleetLevel {
  if (score.gte(T_MANIPULATIVE)) return 'MANIPULATIVE';
  if (score.gte(T_PERSUASIVE)) return 'PERSUASIVE';
  if (score.gte(T_MIXED)) return 'MIXED';
  return 'CLEAN';
}

/**
 * Run the fleet over one message and seal the verdict.
 *
 * Pure and deterministic given `raw`. Each lens is isolated: a throw is caught,
 * the lens is marked crashed, and the fleet proceeds. The returned verdict is
 * hash-sealed here, so a caller can hand a language model a read-only summary
 * and prove afterwards that the prose did not alter the numbers.
 */
export function runFleet(raw: string): FleetVerdict {
  const norm = normaliseMessage(raw).text;

  const signals: FrameworkSignal[] = [];
  const crashedFrameworks: FrameworkName[] = [];

  for (const member of FLEET) {
    try {
      signals.push(member.analyze(norm, raw));
    } catch {
      // Honest degradation: a broken lens does not vote and does not crash the
      // fleet. It is reported, so the coverage gap is visible, never silent.
      crashedFrameworks.push(member.name);
    }
  }

  const active = signals.filter((s) => s.severity.gte(FIRE_FLOOR));
  const silentFrameworks = signals
    .filter((s) => s.severity.lt(FIRE_FLOOR))
    .map((s) => s.framework);
  const activeFrameworks = active.map((s) => s.framework);

  const gatePassed = active.length >= CORROBORATION_THRESHOLD;

  // Weighted average over ACTIVE lenses only. Below the gate the score is not
  // consulted at all — the verdict is CLEAN by corroboration, not by arithmetic.
  let score = Fraction.ZERO;
  if (gatePassed) {
    const weightedSum = sumFractions(active.map((s) => s.severity.mul(WEIGHTS[s.framework])));
    const totalWeight = sumFractions(active.map((s) => WEIGHTS[s.framework]));
    score = weightedSum.div(totalWeight);

    // Convergence bonus: independent lenses landing above the significance line
    // corroborate each other. Ported from ARGOS/corvus.
    const significant = active.filter((s) => s.severity.gte(SIGNIFICANT)).length;
    if (significant >= 3) score = score.add(Fraction.of(1, 8));
    else if (significant >= 2) score = score.add(Fraction.of(1, 16));
    score = score.clamp01();
  }

  const level: FleetLevel = gatePassed ? levelFor(score) : 'CLEAN';

  // Confidence tracks corroboration breadth, not score magnitude: a verdict
  // three lenses agree on is more trustworthy than one two lenses scraped past
  // the gate on. A clean read with the whole fleet quiet is itself High.
  let confidence: FleetConfidence;
  if (!gatePassed) confidence = crashedFrameworks.length > 0 ? 'Medium' : 'High';
  else if (active.length >= 3) confidence = 'High';
  else confidence = 'Low';

  // Scope guard. A silent fleet is only good news if the lenses could read the
  // message in the first place; on a message they cannot, a High-confidence
  // CLEAN is a confident all-clear on something never actually read. Downgrade
  // it and carry the reason, so the interface can say "no verdict" instead of
  // "clean". See scope.ts.
  const scope = assessScope(raw, active.length);
  if (scope.coverage === 'out_of_scope') confidence = 'Low';

  const sealed = signals.map(toSealed);

  // Everything the verdict rests on, canonicalised and hashed. The payload is
  // defined once, in seal_payload.ts, and shared with the verifier below and
  // with the browser-side verifier — so the three can never drift apart.
  const seal = sha256(
    fleetSealInput({
      sealVersion: FLEET_SEAL_VERSION,
      schemaVersion: FLEET_SCHEMA_VERSION,
      level,
      score: score.toString(),
      corroboration: active.length,
      gatePassed,
      signals: sealed,
      crashedFrameworks,
    }),
  );

  return {
    schemaVersion: FLEET_SCHEMA_VERSION,
    sealVersion: FLEET_SEAL_VERSION,
    level,
    score: score.toString(),
    scorePercent: score.toPercent(),
    confidence,
    activeFrameworks,
    silentFrameworks,
    crashedFrameworks,
    corroboration: active.length,
    gatePassed,
    signals: sealed,
    coverage: scope.coverage,
    scopeReason: scope.reason,
    seal,
  };
}

/**
 * Recompute the seal of a verdict and check it matches. The verifier is
 * independent of how the verdict was produced: it rebuilds the canonical
 * payload from the reported fields alone. A caller (or an auditor) uses this to
 * confirm the numbers were not touched after sealing — for instance, after the
 * narrator LLM has run.
 */
export function verifyFleetSeal(v: FleetVerdict): boolean {
  return sha256(fleetSealInput(v)) === v.seal;
}
