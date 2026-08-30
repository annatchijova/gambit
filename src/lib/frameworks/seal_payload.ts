import { canonicalJson } from '../canonical';
import type { CompositeVerdict } from './composite';
import type { FleetVerdict } from './fleet';

/**
 * GAMBIT YourMove — what a seal actually covers.
 *
 * ============================================================================
 * ONE DEFINITION, THREE READERS
 * ============================================================================
 *
 * A seal is a promise about a specific set of bytes. That set has to be defined
 * exactly once, or the promise rots: previously `runFleet` built the payload to
 * hash it and `verifyFleetSeal` rebuilt it to check, from two separate copies of
 * the same object literal. Two copies of a definition are one edit away from
 * disagreeing, and the failure mode is the worst kind — every seal silently
 * stops verifying, or worse, keeps verifying while covering less than it claims.
 *
 * So the payloads live here, once, and three readers share them:
 *
 *   1. the sealer (fleet.ts / composite.ts), computing the hash server-side;
 *   2. the verifier (same files), checking it;
 *   3. the USER'S BROWSER (components/SealVerifier), recomputing it with Web
 *      Crypto to confirm for itself that the numbers on screen are the numbers
 *      that were sealed — without taking this server's word for any of it.
 *
 * Reader 3 is why this module must stay free of `node:crypto` and of anything
 * that imports it. It builds strings; it does not hash them. Hashing is the
 * caller's job, with whatever primitive their platform provides.
 *
 * WHAT IS DELIBERATELY NOT IN HERE. `confidence`, `scorePercent` and `coverage`
 * are derived for display and are not sealed. The seal covers what the lenses
 * FOUND — levels, exact scores, severities, evidence, which lenses crashed. A
 * reader who wants to check the presentation can recompute it from these.
 */

/**
 * The exact bytes a fleet seal is taken over. Note the score travels as an
 * exact "n/d" rational string, never a float: a float would make the seal
 * depend on the platform's rounding, which is precisely what it must not do.
 */
export function fleetSealInput(v: {
  sealVersion: FleetVerdict['sealVersion'];
  schemaVersion: FleetVerdict['schemaVersion'];
  level: FleetVerdict['level'];
  score: string;
  corroboration: number;
  gatePassed: boolean;
  signals: FleetVerdict['signals'];
  crashedFrameworks: FleetVerdict['crashedFrameworks'];
}): string {
  return canonicalJson({
    version: v.sealVersion,
    schemaVersion: v.schemaVersion,
    level: v.level,
    score: v.score,
    corroboration: v.corroboration,
    gatePassed: v.gatePassed,
    signals: v.signals.map((s) => ({
      framework: s.framework,
      severity: s.severity,
      tags: s.tags,
      evidence: s.evidence,
    })),
    crashed: [...v.crashedFrameworks].sort(),
  });
}

/**
 * The exact bytes a composite seal is taken over. It binds in the core seal
 * rather than the core payload, so a composite cannot be re-pointed at a
 * different deterministic verdict without breaking.
 */
export function compositeSealInput(v: {
  sealVersion: CompositeVerdict['sealVersion'];
  schemaVersion: CompositeVerdict['schemaVersion'];
  coreSeal: string;
  determinismLevel: CompositeVerdict['determinismLevel'];
  level: CompositeVerdict['level'];
  score: string;
  semantic: CompositeVerdict['semantic'];
}): string {
  return canonicalJson({
    version: v.sealVersion,
    schemaVersion: v.schemaVersion,
    coreSeal: v.coreSeal,
    determinismLevel: v.determinismLevel,
    level: v.level,
    score: v.score,
    semantic: v.semantic
      ? {
          available: v.semantic.available,
          grid: v.semantic.grid,
          severity: v.semantic.severity,
          tactic: v.semantic.tactic,
          evidence: v.semantic.evidence,
          model: v.semantic.model,
        }
      : null,
  });
}
