import { Fraction } from '../fraction';
import type { FleetLevel } from './fleet';

/**
 * GAMBIT YourMove — the semantic lens vote.
 *
 * ============================================================================
 * THE LLM AS A PARTICIPATING ANALYST — AND WHAT THAT COSTS
 * ============================================================================
 *
 * The deterministic fleet (fleet.ts) catches manipulation it has lexical
 * patterns for. It is blind to paraphrase, to implication, to a tactic phrased
 * in words no rule anticipated. A language model is not — so here the model
 * earns a seat at the table as one more analyst, exactly as ARGOS gives Gemini
 * a weighted vote alongside its eleven philosophers.
 *
 * But a model vote is NOT reproducible. Two runs of the same message can return
 * different severities, so any score that includes it cannot be sealed and
 * replayed bit-for-bit. That is not a bug to hide; it is a property to declare.
 * This module and composite.ts keep the two worlds separate and honest:
 *
 *   - The deterministic core stays sealed and reproducible on its own.
 *   - The semantic vote is folded into a COMPOSITE verdict that is explicitly
 *     flagged `best_effort` / `requiresRebuild`, so no reader mistakes a
 *     model-influenced number for a replayable one.
 *
 * This file holds only the pure, model-free half: the vote's shape, the
 * quantisation that turns the model's coarse severity into an exact rational,
 * and the honest "unavailable" vote used when the model does not answer. The
 * actual Gemini call lives in a separate server-only module so this stays
 * testable without a key or a network.
 */

/**
 * The grid the model's severity is snapped to. The model is asked for an
 * integer 0..GRID; we store it as Fraction(grid, GRID). A coarse grid is
 * deliberate: it signals that this number is an estimate, not a measurement,
 * and it keeps the composite seal stable for a GIVEN model output. Matches
 * ARGOS's round(score * 20) / 20.
 */
export const SEMANTIC_GRID = 20;

/**
 * How much the semantic vote weighs in the composite blend, as an exact
 * rational. 2/5 mirrors ARGOS's heavy-but-not-dominant Gemini weight: enough
 * for the model to move the verdict and to raise an alert the lexical lenses
 * missed, never enough to silently override a strong deterministic consensus.
 */
export const SEMANTIC_WEIGHT = Fraction.of(2, 5);

export interface SemanticSignal {
  /**
   * False when the model did not answer (no key, timeout, upstream error, bad
   * payload). An unavailable vote does not degrade the core — the composite
   * simply falls back to the deterministic verdict and says so.
   */
  available: boolean;
  /**
   * Exact severity in [0, 1], snapped to the grid, as "numerator/denominator".
   * A string, not a Fraction, so the whole signal is JSON-serialisable and can
   * cross the wire — the same flattening FleetVerdict does for its severities.
   * Parse it back with Fraction.parse for exact arithmetic. Zero when unavailable.
   */
  severity: string;
  /** Rounded percentage for display. Presentation only. */
  severityPercent: number;
  /** The integer the model returned on the 0..GRID grid, for display/seal. */
  grid: number;
  /** The tactic the model names, in its own words. Empty when unavailable. */
  tactic: string;
  /** Verbatim spans the model quoted from the message. */
  evidence: string[];
  /** Model id that produced this vote, for provenance in the seal. */
  model: string;
}

/**
 * Snap a model-supplied integer severity on the 0..SEMANTIC_GRID grid to an
 * exact rational in [0, 1]. Out-of-range input is clamped, not rejected: a
 * model that answers 23/20 is reporting "as high as it goes", and the honest
 * reading is 1, not an error that discards the whole vote.
 */
export function severityFromGrid(grid: number): Fraction {
  const g = Math.round(grid);
  const clamped = g < 0 ? 0 : g > SEMANTIC_GRID ? SEMANTIC_GRID : g;
  return Fraction.of(clamped, SEMANTIC_GRID);
}

/** Build an available semantic vote from a parsed model response. */
export function semanticVote(args: {
  grid: number;
  tactic: string;
  evidence: string[];
  model: string;
}): SemanticSignal {
  const grid = Math.max(0, Math.min(SEMANTIC_GRID, Math.round(args.grid)));
  const severity = severityFromGrid(grid);
  return {
    available: true,
    severity: severity.toString(),
    severityPercent: severity.toPercent(),
    grid,
    tactic: args.tactic,
    evidence: args.evidence,
    model: args.model,
  };
}

/**
 * The honest "the model did not vote" signal. Severity zero, available false.
 * Composing with this yields exactly the deterministic core verdict — an absent
 * optional component degrades the feature, never the core.
 */
export function unavailableSemantic(model: string): SemanticSignal {
  return {
    available: false,
    severity: Fraction.ZERO.toString(),
    severityPercent: 0,
    grid: 0,
    tactic: '',
    evidence: [],
    model,
  };
}

/** Re-export so composite consumers have one import site for the level type. */
export type { FleetLevel };
