import { Fraction } from '../fraction';
import { canonicalJson, sha256 } from '../state_rules';
import {
  levelFor,
  type FleetConfidence,
  type FleetLevel,
  type FleetVerdict,
} from './fleet';
import { SEMANTIC_WEIGHT, type SemanticSignal } from './semantic';

/**
 * GAMBIT YourMove — composite verdict (deterministic core + semantic vote).
 *
 * This is where the language model becomes a first-class analyst without
 * corrupting the thing that makes the read trustworthy. The deterministic core
 * verdict arrives already sealed and reproducible. Here it is BLENDED with the
 * model's semantic vote into a composite, and the result is stamped with an
 * honest determinism level so the two can never be confused:
 *
 *   - determinismLevel 'deterministic_core'      — no usable model vote; the
 *     composite IS the core verdict, replayable bit-for-bit.
 *   - determinismLevel 'best_effort_with_semantic' — the score reflects a model
 *     vote; requiresRebuild is true; it is NOT claimed to be replayable.
 *
 * The composite also carries a DIVERGENCE read: where the deterministic core
 * and the independent model agree, confidence is high; where they split, that
 * split is surfaced rather than averaged into a false middle. A rule engine and
 * a language model disagreeing about a message is a signal to the user, not
 * noise to smooth over.
 *
 * Pure and deterministic GIVEN its inputs: the same (core, semantic) pair
 * always produces the same composite and the same composite seal. The
 * non-determinism lives entirely upstream, in obtaining the semantic vote.
 */

export const COMPOSITE_SCHEMA_VERSION = 1 as const;
export const COMPOSITE_SEAL_VERSION = 'gambit-composite-v1' as const;

export type DeterminismLevel = 'deterministic_core' | 'best_effort_with_semantic';

export interface Divergence {
  /** True when core and semantic land on the same verdict level. */
  agree: boolean;
  coreLevel: FleetLevel;
  semanticLevel: FleetLevel;
  /** Human-readable one-liner for the audit panel. */
  note: string;
}

export interface CompositeVerdict {
  schemaVersion: typeof COMPOSITE_SCHEMA_VERSION;
  sealVersion: typeof COMPOSITE_SEAL_VERSION;
  /** The sealed, reproducible deterministic verdict. Always present. */
  core: FleetVerdict;
  /** The model's vote, or null when it did not participate. */
  semantic: SemanticSignal | null;
  determinismLevel: DeterminismLevel;
  /**
   * True when `score`/`level` reflect the model vote and are therefore NOT
   * replayable. Downstream validity checks must honour this flag rather than
   * treating the composite score like the sealed core score.
   */
  requiresRebuild: boolean;
  level: FleetLevel;
  /** Composite score in [0, 1] as "numerator/denominator". */
  score: string;
  scorePercent: number;
  confidence: FleetConfidence;
  /** Core-vs-model divergence, or null when the model did not vote. */
  divergence: Divergence | null;
  /** SHA-256 over the composite payload (binds in the core seal). */
  seal: string;
}

function divergenceNote(agree: boolean, core: FleetLevel, semantic: FleetLevel): string {
  if (agree) {
    return `The rule engine and the model independently agree: ${core}.`;
  }
  const quiet = core === 'CLEAN' || semantic === 'CLEAN';
  return quiet
    ? `Split read: the rule engine says ${core}, the model says ${semantic}. One sees a signal the other does not — treat this message with extra care.`
    : `The rule engine reads ${core}, the model reads ${semantic}. Both see manipulation; they weigh it differently.`;
}

function sealOf(
  core: FleetVerdict,
  semantic: SemanticSignal | null,
  determinismLevel: DeterminismLevel,
  level: FleetLevel,
  score: string,
): string {
  const payload = {
    version: COMPOSITE_SEAL_VERSION,
    schemaVersion: COMPOSITE_SCHEMA_VERSION,
    coreSeal: core.seal,
    determinismLevel,
    level,
    score,
    semantic: semantic
      ? {
          available: semantic.available,
          grid: semantic.grid,
          severity: semantic.severity,
          tactic: semantic.tactic,
          evidence: semantic.evidence,
          model: semantic.model,
        }
      : null,
  };
  return sha256(canonicalJson(payload));
}

/**
 * Fold a semantic vote into the deterministic core verdict.
 *
 * When `semantic` is null or unavailable, the composite is the core verdict,
 * flagged deterministic and replayable. When the model voted, the score is a
 * convex blend — core weighted (1 - SEMANTIC_WEIGHT), model weighted
 * SEMANTIC_WEIGHT — which lets the model both move a verdict and, on its own,
 * raise one the lexical lenses missed, while never silently overriding a strong
 * deterministic consensus. The composite is then flagged best_effort.
 */
export function composeVerdict(
  core: FleetVerdict,
  semantic: SemanticSignal | null,
): CompositeVerdict {
  // --- No usable model vote: composite == core, fully deterministic. --------
  if (!semantic || !semantic.available) {
    return {
      schemaVersion: COMPOSITE_SCHEMA_VERSION,
      sealVersion: COMPOSITE_SEAL_VERSION,
      core,
      semantic: semantic ?? null,
      determinismLevel: 'deterministic_core',
      requiresRebuild: false,
      level: core.level,
      score: core.score,
      scorePercent: core.scorePercent,
      confidence: core.confidence,
      divergence: null,
      seal: sealOf(core, semantic ?? null, 'deterministic_core', core.level, core.score),
    };
  }

  // --- Model voted: blend, classify, and flag best_effort. ------------------
  const coreScore = Fraction.parse(core.score);
  const semanticScore = Fraction.parse(semantic.severity);
  const blended = coreScore
    .mul(Fraction.ONE.sub(SEMANTIC_WEIGHT))
    .add(semanticScore.mul(SEMANTIC_WEIGHT))
    .clamp01();

  const level = levelFor(blended);
  const coreLevel = core.level;
  const semanticLevel = levelFor(semanticScore);
  const agree = coreLevel === semanticLevel;

  // Confidence follows agreement, not magnitude: two independent methods
  // concurring is the strongest thing we can say; a clean/not-clean split is
  // the weakest and must be shown, not buried.
  let confidence: FleetConfidence;
  if (agree) confidence = 'High';
  else if (coreLevel === 'CLEAN' || semanticLevel === 'CLEAN') confidence = 'Low';
  else confidence = 'Medium';

  const score = blended.toString();

  return {
    schemaVersion: COMPOSITE_SCHEMA_VERSION,
    sealVersion: COMPOSITE_SEAL_VERSION,
    core,
    semantic,
    determinismLevel: 'best_effort_with_semantic',
    requiresRebuild: true,
    level,
    score,
    scorePercent: blended.toPercent(),
    confidence,
    divergence: {
      agree,
      coreLevel,
      semanticLevel,
      note: divergenceNote(agree, coreLevel, semanticLevel),
    },
    seal: sealOf(core, semantic, 'best_effort_with_semantic', level, score),
  };
}

/**
 * Recompute a composite seal from its reported fields and check it matches.
 * Independent of how the composite was produced. Also re-verifies the embedded
 * core seal, so a caller confirms both the deterministic spine and the composite
 * in one call.
 */
export function verifyCompositeSeal(
  v: CompositeVerdict,
  verifyCore: (core: FleetVerdict) => boolean,
): boolean {
  if (!verifyCore(v.core)) return false;
  return sealOf(v.core, v.semantic, v.determinismLevel, v.level, v.score) === v.seal;
}
