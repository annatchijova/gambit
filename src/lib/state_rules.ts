import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical';
import {
  STATE_SCHEMA_VERSION,
  type NegotiationState,
  type StateDelta,
  type TransitionRecord,
  type UnitScore,
} from './types';

/**
 * GAMBIT YourMove — deterministic state engine.
 *
 * ============================================================================
 * READ THIS FIRST: MOST OF THIS FILE IS NOT ON A SHIPPED PATH
 * ============================================================================
 *
 * `normaliseMessage`, `sha256` and `canonicalJson` are used by the framework
 * fleet and therefore run on every request. Everything else here — `RULES`,
 * `classifyUserMove`, `applyMove`, `verifyChain`, `initialState` — is called
 * only by the tests, `npm run calibrate:rules` and the doc generator. Nothing
 * in `src/app/` touches them.
 *
 * That is deliberate, not rot. This is the engine TRAIN will run on, built
 * early because it needs no network, no key and no SDK, and finished while
 * those were still unavailable. It is stated here because the alternative is a
 * reader finding the largest file in the codebase and having no way to tell
 * whether it is load-bearing or abandoned.
 *
 * ============================================================================
 * WHAT THIS FILE IS, AND WHAT IT IS NOT
 * ============================================================================
 *
 * This is the only place in the codebase where the opponent's model of the
 * negotiation (`leverage` / `trust` / `patience`) is allowed to change.
 *
 * The claim this file supports is DETERMINISM, not ACCURACY:
 *
 *   - DETERMINISM (guaranteed, and tested): the same message and the same
 *     prior state always produce the same classification and the same next
 *     state, on any machine, in any run. No model call, no randomness, no
 *     clock, no float arithmetic. This is what makes the transition log
 *     replayable and hash-sealable.
 *
 *   - ACCURACY (NOT guaranteed, and deliberately not claimed): whether
 *     `classifyUserMove` assigns the label a human negotiation coach would
 *     assign is an open empirical question. The classifier is a lexical
 *     heuristic over surface patterns. It has not been measured against a
 *     labelled corpus. Do not describe it as "accurate" anywhere — in the
 *     README, in the write-up, or on camera. Describe it as deterministic and
 *     auditable, which it is.
 *
 * The distinction matters: an LLM asked to update leverage inline is neither
 * deterministic nor auditable. This engine is both, at the cost of being
 * blunt. That trade is the architectural point.
 *
 * ============================================================================
 * PRECEDENCE
 * ============================================================================
 *
 * Real messages match more than one pattern. "I'll drop my rate to 80 if you
 * cover the licence, otherwise I'll take the other offer" is simultaneously a
 * concession, a trade, an alternative and a threat.
 *
 * Precedence is therefore DATA, not a side effect of the order of if-
 * statements: `RULES` below is a sorted array, `rank` is explicit on every
 * rule, and `classifyUserMove` walks it in order. Reordering the array
 * changes behaviour visibly and is caught by the precedence tests.
 *
 * The ordering principle is COST OF COMMITMENT, most-committing first:
 *
 *   rank 1  CONDITIONAL_TRADE        concession + an explicit condition
 *   rank 2  UNCONDITIONAL_CONCESSION concession with no condition attached
 *   rank 3  REJECT_ANCHOR_WITH_ALT   refusal backed by a named alternative
 *   rank 4  PRESSURE_TEST            deadline / walk-away pressure
 *   rank 5  COUNTER_ANCHOR_VALIDATED a number justified by outside criteria
 *   rank 6  DEFAULT_AMBIGUOUS        everything else — zero impact
 *
 * Why this order:
 *   1 before 2 — DEFENSIVE, NOT LOAD-BEARING. It would be natural to claim
 *     that without this ordering every conditional trade would be misread as
 *     an unconditional giveaway. That claim is false in this implementation,
 *     and the tests prove it: UNCONDITIONAL_CONCESSION carries an explicit
 *     `!CONDITION` guard, so the two concession predicates are DISJOINT and
 *     neither can shadow the other regardless of order. The ordering is kept
 *     because mutual exclusivity is an invariant someone could delete during
 *     a refactor, and it is asserted by a test for that reason. Ordering is
 *     the second line of defence; the guard is the first.
 *   2 before 3 — giving something away is a completed, irreversible act;
 *     refusing is not. The completed act dominates.
 *   3 before 4 — a named alternative (a real BATNA) is a structural position;
 *     a deadline is a posture that costs the speaker nothing to assert.
 *   5 last of the substantive rules — most negotiation messages contain a
 *     number, so this is the loosest pattern and must not pre-empt the others.
 *   6 always matches, so classification is total: there is no unhandled input
 *     and no branch where a fallback gets improvised inside a prompt.
 */

export const MOVE_TYPES = [
  'CONDITIONAL_TRADE',
  'UNCONDITIONAL_CONCESSION',
  'REJECT_ANCHOR_WITH_ALT',
  'PRESSURE_TEST',
  'COUNTER_ANCHOR_VALIDATED',
  'DEFAULT_AMBIGUOUS',
] as const;

export type MoveType = (typeof MOVE_TYPES)[number];

export interface StateRule {
  type: MoveType;
  /** Lower runs first. Unique across rules; asserted by a test. */
  rank: number;
  /** Human-readable trigger, mirrored into docs/state_rules.md. */
  criterion: string;
  /** Why this rule sits where it sits. Shown in the audit panel. */
  rationale: string;
  /** Deltas in integer 0..100 units. */
  delta: StateDelta;
  /** Pure predicate over the normalised message. No I/O, no randomness. */
  matches: (m: NormalisedMessage) => boolean;
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export interface NormalisedMessage {
  /** Lower-cased, whitespace-collapsed, quotes and dashes ASCII-folded. */
  text: string;
  /** True when the message contains a bare or formatted quantity. */
  hasNumber: boolean;
}

const QUANTITY = /(?:[$€£]\s?\d|(?<![a-z0-9])\d[\d.,]*\s?(?:%|k\b|usd|eur|ars|per\s|\/\s?(?:hr|hour|month|mo|year|yr)))|(?<![a-z0-9])\d[\d.,]{2,}(?![a-z0-9])/;

/**
 * Fold a raw user message into the shape the predicates expect.
 *
 * Pure and total: any string in, a NormalisedMessage out. Non-string input is
 * rejected earlier, at the API boundary, not silently coerced here.
 */
export function normaliseMessage(raw: string): NormalisedMessage {
  const text = raw
    .normalize('NFKC')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return { text, hasNumber: QUANTITY.test(text) };
}

// ---------------------------------------------------------------------------
// Lexical building blocks
//
// Kept as named constants rather than inlined so that the rule table below
// reads as a specification and every pattern has one definition to audit.
// ---------------------------------------------------------------------------

/** Language that gives ground: a number moves toward the opponent. */
const CONCESSION =
  /\b(?:i(?:'| a)?m ok(?:ay)? with|i can (?:go|do|come) (?:down|to)|i(?:'ll| will) (?:accept|take|drop|lower|reduce|come down)|i accept|we accept|happy to accept|i can accept|fine,? (?:i(?:'ll| will)|let'?s)|let'?s (?:say|do)|meet you at|i(?:'ll| will) meet you)\b/;

/** An explicit exchange: the concession is priced. */
const CONDITION =
  /\b(?:if you|if we|provided (?:that|you)|as long as|on condition|in exchange|in return|so long as|only if|assuming you|contingent on)\b/;

/** Refusal of the opponent's number or framing. */
const REJECTION =
  /\b(?:that (?:doesn'?t|does not) work|that'?s (?:not|too)|i (?:can'?t|cannot|won'?t|will not)|(?:i'?m|we'?re) not (?:able|willing|going) to|no,|unfortunately|below (?:my|our)|under (?:my|our)|(?:doesn'?t|does not) (?:meet|match|reflect))\b/;

/** A concrete outside option the speaker actually holds. */
const ALTERNATIVE =
  /\b(?:another (?:offer|client|tenant|buyer|vendor|opportunity|role)|other (?:offers|options|clients|candidates)|competing offer|elsewhere|somewhere else|a second option|option b|i(?:'ve| have) (?:got|had) (?:an|another)|i already have)\b/;

/** Deadline or walk-away pressure. */
const PRESSURE =
  /\b(?:walk away|walk from|deadline|by (?:friday|monday|tuesday|wednesday|thursday|the end of|end of)|final (?:offer|answer|number)|last (?:offer|call)|otherwise i|or i(?:'ll| will) have to|we'?re done|take it or leave it|expires?)\b/;

/** An outside standard used to justify a number. */
const OBJECTIVE_CRITERION =
  /\b(?:market (?:rate|price|value)|going rate|benchmark|comparable|comps?\b|industry (?:standard|average)|based on|according to|the data|glassdoor|levels\.fyi|index|inflation|cpi|per square|cost of)\b/;

// ---------------------------------------------------------------------------
// The rule table
//
// This array IS the specification. docs/state_rules.md is generated from it
// (npm run docs:rules) so the two can never drift apart.
// ---------------------------------------------------------------------------

export const RULES: readonly StateRule[] = Object.freeze([
  {
    type: 'CONDITIONAL_TRADE',
    rank: 1,
    criterion:
      'Gives ground on one point only if the counterparty moves on another ("I can do X if you cover Y").',
    rationale:
      'Runs first because the concession vocabulary is a superset of the unconditional case; if UNCONDITIONAL_CONCESSION ran first every trade would be misread as a giveaway.',
    delta: { leverage: +5, trust: +10, patience: 0 },
    matches: (m) => CONCESSION.test(m.text) && CONDITION.test(m.text),
  },
  {
    type: 'UNCONDITIONAL_CONCESSION',
    rank: 2,
    criterion:
      'Gives ground on price or timing without asking for anything back.',
    rationale:
      'A completed, irreversible transfer of value. Dominates refusals and postures, which cost the speaker nothing.',
    delta: { leverage: -20, trust: -10, patience: 0 },
    matches: (m) => CONCESSION.test(m.text) && !CONDITION.test(m.text),
  },
  {
    type: 'REJECT_ANCHOR_WITH_ALT',
    rank: 3,
    criterion:
      'Refuses the anchor and names a concrete outside option (a real BATNA).',
    rationale:
      'A held alternative is a structural position, so it outranks a deadline, which is only a posture.',
    delta: { leverage: +15, trust: 0, patience: -5 },
    matches: (m) => REJECTION.test(m.text) && ALTERNATIVE.test(m.text),
  },
  {
    type: 'PRESSURE_TEST',
    rank: 4,
    criterion:
      'Applies a deadline or tests the walk-away boundary without naming an alternative.',
    rationale:
      'Costs the speaker nothing to assert, so it buys less leverage than a real alternative and burns the opponent’s patience instead.',
    delta: { leverage: +10, trust: 0, patience: -15 },
    matches: (m) => PRESSURE.test(m.text),
  },
  {
    type: 'COUNTER_ANCHOR_VALIDATED',
    rank: 5,
    criterion:
      'States a number and justifies it with an external standard (market data, comparables, costs).',
    rationale:
      'Loosest substantive pattern — most negotiation messages contain a number — so it must not pre-empt the rules above.',
    delta: { leverage: +10, trust: +5, patience: 0 },
    matches: (m) => m.hasNumber && OBJECTIVE_CRITERION.test(m.text),
  },
  {
    type: 'DEFAULT_AMBIGUOUS',
    rank: 6,
    criterion:
      'Mixed, generic, or clarifying message that triggers no rule above.',
    rationale:
      'Total coverage by construction. Neutral impact is the honest response to an unrecognised move: the engine says "no signal" instead of inventing one.',
    delta: { leverage: 0, trust: 0, patience: 0 },
    matches: () => true,
  },
] satisfies StateRule[]);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface Classification {
  moveType: MoveType;
  rank: number;
  criterion: string;
  rationale: string;
  delta: StateDelta;
  /** Every rule that would have matched, in rank order. For the audit panel. */
  alsoMatched: MoveType[];
}

/**
 * Classify a user's negotiation move.
 *
 * Pure, total and deterministic. Walks `RULES` in rank order and returns the
 * first match; `DEFAULT_AMBIGUOUS` matches unconditionally, so this never
 * returns undefined and never throws on a well-typed string.
 */
export function classifyUserMove(raw: string): Classification {
  const m = normaliseMessage(raw);
  const matched = RULES.filter((r) => r.matches(m));
  // RULES is rank-ordered and DEFAULT_AMBIGUOUS matches everything, so
  // `matched` is guaranteed non-empty.
  const winner = matched[0];
  return {
    moveType: winner.type,
    rank: winner.rank,
    criterion: winner.criterion,
    rationale: winner.rationale,
    delta: winner.delta,
    alsoMatched: matched.slice(1).map((r) => r.type),
  };
}

// ---------------------------------------------------------------------------
// State transition
// ---------------------------------------------------------------------------

export const UNIT_MIN = 0;
export const UNIT_MAX = 100;

/** Clamp to the closed integer interval [0, 100]. */
export function clampUnit(v: number): UnitScore {
  if (!Number.isFinite(v)) {
    throw new RangeError(`[state_rules] non-finite unit score: ${v}`);
  }
  const i = Math.trunc(v);
  return i < UNIT_MIN ? UNIT_MIN : i > UNIT_MAX ? UNIT_MAX : i;
}

/**
 * Deterministic JSON serialisation: object keys sorted, no whitespace.
 *
 * `JSON.stringify` preserves insertion order, so two structurally identical
 * records built by different code paths would otherwise hash differently.
 */
// Imported above and re-exported so existing server-side callers keep one
// import site. The implementation moved to ./canonical because the browser
// needs it too, and this module is server-only (node:crypto).
export { canonicalJson };

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface ApplyMoveResult {
  nextState: NegotiationState;
  classification: Classification;
  record: TransitionRecord;
}

/**
 * Apply one user move to the negotiation state.
 *
 * Pure: does not mutate `state`. Deterministic: integer arithmetic only, no
 * clock, no randomness, no model call. The returned `record` is sealed with a
 * SHA-256 over its canonical form and carries the previous record's hash, so
 * the transition log is a verifiable chain.
 */
export function applyMove(
  state: NegotiationState,
  rawMessage: string,
): ApplyMoveResult {
  const classification = classifyUserMove(rawMessage);
  const requested = classification.delta;

  const after = {
    perceivedUserLeverage: clampUnit(
      state.perceivedUserLeverage + requested.leverage,
    ),
    trust: clampUnit(state.trust + requested.trust),
    patience: clampUnit(state.patience + requested.patience),
  };

  // What actually landed, after floors and ceilings. Reporting `requested`
  // and `applied` separately keeps a clamped transition visible instead of
  // letting the log imply a change that never happened.
  const applied: StateDelta = {
    leverage: after.perceivedUserLeverage - state.perceivedUserLeverage,
    trust: after.trust - state.trust,
    patience: after.patience - state.patience,
  };

  const round = state.round + 1;
  const unsealed = {
    round,
    moveType: classification.moveType,
    ruleRank: classification.rank,
    applied,
    requested,
    after,
    prevHash: state.headHash,
  };
  const hash = sha256(canonicalJson(unsealed));
  const record: TransitionRecord = { ...unsealed, hash };

  const nextState: NegotiationState = {
    ...state,
    round,
    perceivedUserLeverage: after.perceivedUserLeverage,
    trust: after.trust,
    patience: after.patience,
    concessionHistory: [...state.concessionHistory, record],
    headHash: hash,
  };

  return { nextState, classification, record };
}

/**
 * Verify the transition chain of a state.
 *
 * Recomputes every seal and checks that each record points at its
 * predecessor. Returns the index of the first broken link, or -1 when the
 * chain is intact. Used by the audit panel and by the demo's tamper check.
 */
export function verifyChain(state: NegotiationState): number {
  let prev: string | null = null;
  for (let i = 0; i < state.concessionHistory.length; i++) {
    const r = state.concessionHistory[i];
    if (r.prevHash !== prev) return i;
    const { hash, ...unsealed } = r;
    if (sha256(canonicalJson(unsealed)) !== hash) return i;
    prev = hash;
  }
  if (state.headHash !== prev) return state.concessionHistory.length;
  return -1;
}

/**
 * Check that a state's LIVE top-level scores match its sealed history.
 *
 * `verifyChain` seals the transition records, but not the current
 * `perceivedUserLeverage` / `trust` / `patience` / `round` fields — those are
 * supposed to equal the last record's `after` (or the scenario seed before any
 * move). Nothing in the chain forces that, so a caller trusting a
 * client-supplied state must check it here too, or accept a valid chain wearing
 * tampered current numbers. Returns true when consistent.
 */
export function stateHeadConsistent(
  state: NegotiationState,
  seed: Pick<NegotiationState, 'perceivedUserLeverage' | 'trust' | 'patience'>,
): boolean {
  const head = state.concessionHistory.at(-1);
  const after = head ? head.after : seed;
  const round = head ? head.round : 0;
  return (
    state.round === round &&
    state.perceivedUserLeverage === after.perceivedUserLeverage &&
    state.trust === after.trust &&
    state.patience === after.patience
  );
}

/** A fresh, sealed-empty state for a scenario. */
export function initialState(
  scenarioId: string,
  seed: Pick<
    NegotiationState,
    'perceivedUserLeverage' | 'trust' | 'patience'
  >,
): NegotiationState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    scenarioId,
    round: 0,
    perceivedUserLeverage: clampUnit(seed.perceivedUserLeverage),
    trust: clampUnit(seed.trust),
    patience: clampUnit(seed.patience),
    concessionHistory: [],
    headHash: null,
  };
}
