import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioById } from '../src/lib/scenarios';
import { trainRequestSchema } from '../src/lib/schemas/train_schema';
import { applyMove, classifyUserMove, initialState, stateHeadConsistent, verifyChain } from '../src/lib/state_rules';

/**
 * TRAIN's replies are generative, but its spine is deterministic: the state
 * moves by the engine and the seal chain must survive a whole session. These
 * tests defend that spine and the request contract; the persona is the model's.
 */

describe('scenarios', () => {
  it('are well-formed with in-range seed states and a persona', () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
    for (const s of SCENARIOS) {
      expect(s.id).toMatch(/^[a-z-]+$/);
      expect(s.opponentPersona.length).toBeGreaterThan(40);
      for (const v of Object.values(s.initialState)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it('looks up by id', () => {
    expect(scenarioById('salary')?.title).toBe('Salary offer');
    expect(scenarioById('nope')).toBeUndefined();
  });
});

describe('a multi-turn session keeps its seal chain intact', () => {
  it('applies several moves and verifies the chain each turn', () => {
    const scenario = SCENARIOS[0];
    let state = initialState(scenario.id, scenario.initialState);
    const moves = [
      'I can do 4,500 if you cover the certification.',
      "That doesn't work — I already have another written offer at that level.",
      'I need to hear by Friday or I move on.',
      'Fine, I accept 4,200.',
    ];
    for (const m of moves) {
      const { nextState } = applyMove(state, m);
      expect(verifyChain(nextState)).toBe(-1); // intact after every turn
      expect(nextState.round).toBe(state.round + 1);
      state = nextState;
    }
    expect(state.concessionHistory).toHaveLength(moves.length);
  });

  it('catches tampering with the sealed history via verifyChain', () => {
    const scenario = SCENARIOS[0];
    const { nextState } = applyMove(initialState(scenario.id, scenario.initialState), 'I accept 4,200.');
    // Edit a sealed record's outcome — its hash no longer recomputes.
    const tampered = {
      ...nextState,
      concessionHistory: nextState.concessionHistory.map((r, i) =>
        i === 0 ? { ...r, after: { ...r.after, perceivedUserLeverage: 100 } } : r,
      ),
    };
    expect(verifyChain(tampered)).not.toBe(-1);
  });

  it('catches tampering with the live scores via stateHeadConsistent', () => {
    const scenario = SCENARIOS[0];
    const { nextState } = applyMove(initialState(scenario.id, scenario.initialState), 'I accept 4,200.');
    // The history is untouched (chain still verifies) but the current number is
    // edited — the gap verifyChain alone would miss.
    const tampered = { ...nextState, perceivedUserLeverage: 100 };
    expect(verifyChain(tampered)).toBe(-1); // history intact...
    expect(stateHeadConsistent(tampered, scenario.initialState)).toBe(false); // ...but caught here
    expect(stateHeadConsistent(nextState, scenario.initialState)).toBe(true);
  });
});

describe('the classifier reacts to natural phrasing, not only textbook lines', () => {
  // Regression guard for the widened CONCESSION / ALTERNATIVE lexicons: these
  // real-sounding moves used to fall through to DEFAULT_AMBIGUOUS and leave the
  // practice state unmoved.
  const cases: Array<[string, string]> = [
    ['I have another written offer at 95k, so I can only take this if we get the base to 92.', 'CONDITIONAL_TRADE'],
    ['If you can meet me at 92 I will sign today and start in two weeks.', 'CONDITIONAL_TRADE'],
    ["That does not work for me — I already have another offer on the table.", 'REJECT_ANCHOR_WITH_ALT'],
  ];
  it.each(cases)('classifies %j as %s (not DEFAULT_AMBIGUOUS)', (message, expected) => {
    const c = classifyUserMove(message);
    expect(c.moveType).toBe(expected);
    expect(c.moveType).not.toBe('DEFAULT_AMBIGUOUS');
  });
});

describe('train request contract', () => {
  it('accepts a first turn (no state) and rejects an empty message', () => {
    expect(trainRequestSchema.safeParse({ scenarioId: 'salary', message: 'hello' }).success).toBe(true);
    expect(trainRequestSchema.safeParse({ scenarioId: 'salary', message: '' }).success).toBe(false);
    expect(trainRequestSchema.safeParse({ message: 'hi' }).success).toBe(false);
  });
});
