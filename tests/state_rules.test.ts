import { describe, expect, it } from 'vitest';
import {
  MOVE_TYPES,
  RULES,
  applyMove,
  canonicalJson,
  classifyUserMove,
  clampUnit,
  initialState,
  normaliseMessage,
  verifyChain,
} from '../src/lib/state_rules';

/**
 * These tests defend the two claims the architecture actually makes:
 * the engine is TOTAL (every input classifies) and DETERMINISTIC (same input,
 * same output, always, with a stable seal).
 *
 * They do NOT claim the classifier is accurate. Accuracy is an empirical
 * question for the Day-2 calibration log, not something a unit test can assert.
 */

const SEED = { perceivedUserLeverage: 50, trust: 50, patience: 50 };

describe('rule table integrity', () => {
  it('assigns a unique rank to every rule', () => {
    const ranks = RULES.map((r) => r.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('is stored in ascending rank order — precedence is data, not code order', () => {
    const ranks = RULES.map((r) => r.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('covers every declared move type exactly once', () => {
    expect(RULES.map((r) => r.type).sort()).toEqual([...MOVE_TYPES].sort());
  });

  it('ends with a catch-all so classification is total', () => {
    const last = RULES[RULES.length - 1];
    expect(last.type).toBe('DEFAULT_AMBIGUOUS');
    expect(last.matches(normaliseMessage(''))).toBe(true);
    expect(last.delta).toEqual({ leverage: 0, trust: 0, patience: 0 });
  });
});

describe('classification', () => {
  const cases: Array<[string, string]> = [
    [
      "I can go down to 4,500 if you cover the licence fee.",
      'CONDITIONAL_TRADE',
    ],
    ["Fine, I'll accept 4,200.", 'UNCONDITIONAL_CONCESSION'],
    [
      "That doesn't work for me — I already have another offer on the table.",
      'REJECT_ANCHOR_WITH_ALT',
    ],
    [
      'I need an answer by Friday or I will have to move on.',
      'PRESSURE_TEST',
    ],
    [
      'My number is 6,800, based on the market rate for this role.',
      'COUNTER_ANCHOR_VALIDATED',
    ],
    ['Thanks for getting back to me, let me think about it.', 'DEFAULT_AMBIGUOUS'],
  ];

  it.each(cases)('classifies %j as %s', (message, expected) => {
    expect(classifyUserMove(message).moveType).toBe(expected);
  });

  it('never returns undefined, for any input', () => {
    const weird = ['', '   ', '???', '💥', 'a'.repeat(4000), '\n\n\t'];
    for (const w of weird) {
      expect(MOVE_TYPES).toContain(classifyUserMove(w).moveType);
    }
  });

  it('is deterministic across repeated calls', () => {
    const msg = "I can come down to 900 if you sign for twelve months.";
    const first = classifyUserMove(msg);
    for (let i = 0; i < 50; i++) {
      expect(classifyUserMove(msg)).toEqual(first);
    }
  });
});

describe('precedence — the orderings that actually matter', () => {
  it('reads a conditional concession as a trade, not a giveaway', () => {
    const c = classifyUserMove("I'll accept 4,000 if you pay within seven days.");
    expect(c.moveType).toBe('CONDITIONAL_TRADE');
  });

  it('keeps the two concession rules mutually exclusive, so neither can shadow the other', () => {
    // This is the real invariant behind ranks 1 and 2. Ordering alone would be
    // a weaker guarantee: it survives a reorder but not a deleted guard. If
    // someone removes the `!CONDITION` clause from UNCONDITIONAL_CONCESSION
    // during a refactor, this test fails immediately instead of the engine
    // quietly charging a trader 20 leverage points for a giveaway they did
    // not make.
    const conditional = normaliseMessage(
      "I'll accept 4,000 if you pay within seven days.",
    );
    const unconditional = normaliseMessage("Fine, I'll accept 4,000.");
    const trade = RULES.find((r) => r.type === 'CONDITIONAL_TRADE')!;
    const giveaway = RULES.find((r) => r.type === 'UNCONDITIONAL_CONCESSION')!;

    expect(trade.matches(conditional)).toBe(true);
    expect(giveaway.matches(conditional)).toBe(false);

    expect(giveaway.matches(unconditional)).toBe(true);
    expect(trade.matches(unconditional)).toBe(false);
  });

  it('prefers a named alternative over a deadline threat', () => {
    const c = classifyUserMove(
      "I can't do that number — I have another offer, and I need to decide by Friday.",
    );
    expect(c.moveType).toBe('REJECT_ANCHOR_WITH_ALT');
    expect(c.alsoMatched).toContain('PRESSURE_TEST');
  });

  it('reports every rule that also matched, for the audit panel', () => {
    const c = classifyUserMove(
      "I'll come down to 5,000 if you extend the term — otherwise I'll take the other offer.",
    );
    expect(c.alsoMatched.length).toBeGreaterThan(0);
    expect(c.alsoMatched).not.toContain(c.moveType);
  });
});

describe('clamping', () => {
  it('holds the closed interval [0, 100]', () => {
    expect(clampUnit(-40)).toBe(0);
    expect(clampUnit(140)).toBe(100);
    expect(clampUnit(37)).toBe(37);
  });

  it('rejects non-finite input instead of producing NaN state', () => {
    expect(() => clampUnit(Number.NaN)).toThrow(RangeError);
    expect(() => clampUnit(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('records requested and applied separately when a floor is hit', () => {
    const low = { ...initialState('salary', { ...SEED, perceivedUserLeverage: 10 }) };
    const { record } = applyMove(low, "Fine, I'll accept 4,200.");
    expect(record.requested.leverage).toBe(-20);
    expect(record.applied.leverage).toBe(-10); // clamped at the floor
    expect(record.after.perceivedUserLeverage).toBe(0);
  });
});

describe('state transition', () => {
  it('does not mutate the input state', () => {
    const s = initialState('rent', SEED);
    const snapshot = structuredClone(s);
    applyMove(s, "I'll accept 900.");
    expect(s).toEqual(snapshot);
  });

  it('keeps every score an integer — no float drift', () => {
    let s = initialState('rent', SEED);
    const moves = [
      "I can do 900 if you fix the boiler.",
      'I need an answer by Friday.',
      "That doesn't work — I have another flat lined up.",
      'Let me think about it.',
    ];
    for (const m of moves) s = applyMove(s, m).nextState;
    for (const v of [s.perceivedUserLeverage, s.trust, s.patience]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('produces an identical state and identical seals when replayed', () => {
    const moves = [
      "I can go to 5,000 if you cover onboarding.",
      'My number is 6,800, based on the market rate.',
      "Fine, I'll take 6,000.",
    ];
    const replay = () => {
      let s = initialState('salary', SEED);
      for (const m of moves) s = applyMove(s, m).nextState;
      return s;
    };
    expect(canonicalJson(replay())).toBe(canonicalJson(replay()));
    expect(replay().headHash).toBe(replay().headHash);
  });
});

describe('transition chain', () => {
  const build = () => {
    let s = initialState('salary', SEED);
    for (const m of [
      "I can do 5,000 if you cover the training.",
      'I need this settled by Friday.',
      "Fine, I'll accept.",
    ]) {
      s = applyMove(s, m).nextState;
    }
    return s;
  };

  it('verifies an untouched chain', () => {
    expect(verifyChain(build())).toBe(-1);
  });

  it('detects an edited record', () => {
    const s = build();
    s.concessionHistory[1].after.trust = 99;
    expect(verifyChain(s)).toBe(1);
  });

  it('detects a dropped record', () => {
    const s = build();
    s.concessionHistory.splice(1, 1);
    expect(verifyChain(s)).toBe(1);
  });

  it('detects reordering', () => {
    const s = build();
    [s.concessionHistory[0], s.concessionHistory[1]] = [
      s.concessionHistory[1],
      s.concessionHistory[0],
    ];
    expect(verifyChain(s)).toBe(0);
  });
});

describe('canonicalJson', () => {
  it('is insensitive to key insertion order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('preserves array order, which is meaningful', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('drops undefined members so an absent key and an undefined key agree', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});
