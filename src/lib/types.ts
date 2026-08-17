/**
 * GAMBIT YourMove — shared domain types.
 *
 * NUMERIC REPRESENTATION — read this before changing anything below.
 *
 * `leverage`, `trust` and `patience` are INTEGERS on a 0..100 scale, not
 * floats on 0..1. This is deliberate:
 *
 *   1. The product claim is "state transitions are explainable and
 *      reproducible". Floating-point accumulation (0.1 + 0.2) makes two runs
 *      of the same transcript diverge in the last bits, which breaks
 *      replay-and-compare and breaks any hash seal over the state.
 *   2. Integers are exactly representable, so a sealed transition hash is
 *      stable across machines and Node versions.
 *   3. The approved rule table is written in hundredths (+0.15, -0.20). On a
 *      0..100 integer scale those become +15 and -20 with no conversion loss.
 *
 * Divide by 100 at the presentation layer only.
 */

/** Integer 0..100. Enforced by `clampUnit` in state_rules.ts. */
export type UnitScore = number;

export const STATE_SCHEMA_VERSION = 1 as const;

export interface ScenarioDefinition {
  id: string;
  title: string;
  /** One-line framing shown to the user before the session starts. */
  premise: string;
  /** Seed values for the opponent's model of the negotiation. */
  initialState: Pick<
    NegotiationState,
    'perceivedUserLeverage' | 'trust' | 'patience'
  >;
  /** Opponent persona, injected into the Adversary agent instruction. */
  opponentPersona: string;
}

/**
 * The opponent's internal model of the negotiation.
 *
 * INVARIANT: this object is only ever produced by `applyMove()` in
 * state_rules.ts. No LLM writes to it. The Adversary agent receives it as an
 * already-decided fact and may only phrase a reply consistent with it.
 */
export interface NegotiationState {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  scenarioId: string;
  /** 0 before the user's first move; incremented by each applied move. */
  round: number;
  perceivedUserLeverage: UnitScore;
  trust: UnitScore;
  patience: UnitScore;
  /** Append-only, oldest first. */
  concessionHistory: TransitionRecord[];
  /** Hash of the most recent transition; `null` for a fresh state. */
  headHash: string | null;
}

/**
 * One sealed entry in the append-only transition log.
 *
 * `hash = sha256(canonicalJson({ ...entry without hash }))`, and every entry
 * carries `prevHash`, so the log is a chain: altering, reordering, inserting
 * or dropping an entry breaks verification downstream.
 */
export interface TransitionRecord {
  round: number;
  /** The classified move type that fired. */
  moveType: string;
  /** Which rule matched, by rank, for audit display. */
  ruleRank: number;
  /** Deltas actually applied, after clamping. */
  applied: StateDelta;
  /** Deltas the rule asked for, before clamping. Differs when a floor/ceiling was hit. */
  requested: StateDelta;
  /** State after this transition. */
  after: Pick<
    NegotiationState,
    'perceivedUserLeverage' | 'trust' | 'patience'
  >;
  /** SHA-256 of the previous record, or null for the first. */
  prevHash: string | null;
  /** SHA-256 seal of this record. */
  hash: string;
}

export interface StateDelta {
  leverage: number;
  trust: number;
  patience: number;
}

export type Formality = 'casual' | 'neutral' | 'formal';
export type Directness = 'diplomatic' | 'balanced' | 'blunt';
export type LengthPreference = 'short' | 'medium' | 'long';

/**
 * The user's voice, applied to generated drafts so the output sounds like
 * them rather than like a model. `redLines` are hard exclusions.
 */
export interface VoiceProfile {
  formality: Formality;
  directness: Directness;
  length: LengthPreference;
  /** Phrases, topics or commitments that must never appear in a draft. */
  redLines: string[];
}

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  formality: 'neutral',
  directness: 'balanced',
  length: 'medium',
  redLines: [],
};
