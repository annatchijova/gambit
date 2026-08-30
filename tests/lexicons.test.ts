import { describe, expect, it } from 'vitest';
import { runFleet, type FleetVerdict, type FrameworkName } from '../src/lib/frameworks';

/**
 * Lexical COVERAGE tests — how the lenses behave on phrasing people actually use.
 *
 * fleet.test.ts defends the fleet's structural guarantees (determinism,
 * corroboration, sealing). This file defends something different and more
 * fragile: that the patterns fire on real messages rather than only on the
 * textbook phrasing they were authored against.
 *
 * The Day 3 journal entry recorded the failure this file exists to prevent: a
 * blatantly manipulative live message came back CLEAN because the patterns
 * required contractions ("i've") and adjacency ("everyone else has") that the
 * message did not have. Widening a lexicon is easy; widening it without
 * inventing signal is the hard part, so every widening here is paired with a
 * BENIGN TWIN — an honest message that shares the surface words and must stay
 * quiet. A lens that convicts the twin is worse than a lens that missed.
 *
 * These are coverage assertions, not accuracy claims. Whether these labels
 * match a negotiation coach's remains unmeasured; see the README.
 */

function tagsOf(v: FleetVerdict, framework: FrameworkName): string[] {
  const signal = v.signals.find((s) => s.framework === framework);
  if (!signal) throw new Error(`no signal for ${framework}`);
  return signal.tags;
}

/**
 * The message from the Day 3 journal entry, reconstructed from what it
 * recorded: a midnight deadline, a manufactured debt, and a conformity push.
 * The fleet returned CLEAN 0% on it with only Aristotle firing.
 */
const DAY3_REAL =
  'Hi — just following up. This price is only good until midnight tonight, and ' +
  'after everything I have done for you on this project I think that is more ' +
  'than fair. Everyone else on the team has already agreed to these terms. ' +
  'Let me know.';

describe('the Day 3 regression — real phrasing, not textbook phrasing', () => {
  it('no longer returns CLEAN on the message that exposed the gap', () => {
    const v = runFleet(DAY3_REAL);
    expect(v.level).not.toBe('CLEAN');
    expect(v.gatePassed).toBe(true);
  });

  it('fires Cialdini on all three levers the message pulls', () => {
    const tags = tagsOf(runFleet(DAY3_REAL), 'cialdini');
    expect(tags).toContain('URGENCY');
    expect(tags).toContain('RECIPROCITY');
    expect(tags).toContain('SOCIAL_PROOF');
  });

  it('can quote every lever it claims — no unquoted convictions', () => {
    const v = runFleet(DAY3_REAL);
    for (const signal of v.signals) {
      if (signal.tags.length === 0) continue;
      expect(signal.evidence.length).toBeGreaterThan(0);
      for (const span of signal.evidence) {
        expect(DAY3_REAL).toContain(span);
      }
    }
  });
});

describe('contractions are optional, not required', () => {
  it('reads a manufactured debt written out in full', () => {
    const tags = tagsOf(
      runFleet('After everything I have done for you, the number should be 4,000.'),
      'cialdini',
    );
    expect(tags).toContain('RECIPROCITY');
  });

  it('reads the same debt contracted', () => {
    const tags = tagsOf(
      runFleet("After everything I've done for you, the number should be 4,000."),
      'cialdini',
    );
    expect(tags).toContain('RECIPROCITY');
  });

  it('BENIGN TWIN — plain "I have done" is not a debt claim', () => {
    const tags = tagsOf(
      runFleet('I have done the revisions you asked for and pushed them this morning.'),
      'cialdini',
    );
    expect(tags).not.toContain('RECIPROCITY');
  });
});

describe('conformity survives words between the subject and the verb', () => {
  it('reads social proof across an intervening phrase', () => {
    const tags = tagsOf(
      runFleet('Everyone else on the team has already agreed to these terms.'),
      'cialdini',
    );
    expect(tags).toContain('SOCIAL_PROOF');
  });

  it('BENIGN TWIN — a factual status update about the team is not social proof', () => {
    const tags = tagsOf(
      runFleet('Everyone on the team has reviewed the draft and left their comments.'),
      'cialdini',
    );
    expect(tags).not.toContain('SOCIAL_PROOF');
  });
});

describe('a closing window is urgency however it is phrased', () => {
  it('reads an expiry framed as "only good until"', () => {
    const tags = tagsOf(runFleet('This price is only good until midnight tonight.'), 'cialdini');
    expect(tags).toContain('URGENCY');
  });

  it('reads an expiry framed as "expires"', () => {
    const tags = tagsOf(runFleet('The discount expires at 5pm today.'), 'cialdini');
    expect(tags).toContain('URGENCY');
  });

  it('BENIGN TWIN — a far-off administrative date carries no pressure', () => {
    const tags = tagsOf(
      runFleet('This quote is valid until December 31, so take your time reviewing it.'),
      'cialdini',
    );
    expect(tags).not.toContain('URGENCY');
  });
});

describe('honest messages the lenses must not convict', () => {
  // Found by probing, not by theory: every one of these fired a lens before
  // the tightening pass. They survived only because the corroboration gate
  // needs two — which is luck, not design. Two such markers in one honest
  // message would have produced a verdict against a person who did nothing.
  const HONEST: [string, string][] = [
    ['focusing a conversation', "Let's focus on the numbers first, then we can talk about the timeline."],
    ['being candid', 'Frankly I think we can close this today — here is my best number.'],
    ['being clear', "Let me be clear about the scope so we do not waste each other's time."],
    ['stating a real requirement', 'You need to sign the NDA before I can send the figures, that is company policy.'],
    ['naming a real risk', "There is a risky dependency on the vendor's timeline, so I priced in a buffer."],
  ];

  it.each(HONEST)('stays silent on: %s', (_label, message) => {
    const v = runFleet(message);
    const fired = v.signals.filter((s) => s.severityPercent >= 10).map((s) => s.framework);
    expect(fired).toEqual([]);
  });
});

describe('coverage — Grice, Berne and Aristotle on real phrasing', () => {
  it('reads a tautology as a non-answer', () => {
    const tags = tagsOf(
      runFleet('Look, it is what it is. At the end of the day the budget is the budget.'),
      'grice',
    );
    expect(tags).toContain('MANNER_obfuscation');
  });

  it('reads an appeal no one can check', () => {
    const tags = tagsOf(
      runFleet("Any reasonable person would see this is fair. Everybody knows it's the market rate."),
      'grice',
    );
    expect(tags).toContain('QUALITY_unfalsifiable');
  });

  it('reads a question being steered away from', () => {
    const tags = tagsOf(
      runFleet("I think we're getting off track. Let's not get bogged down in the details."),
      'grice',
    );
    expect(tags).toContain('RELATION_deflection');
  });

  it('reads scolding dressed as candour', () => {
    const tags = tagsOf(
      runFleet('You should have known this was coming. Surely you understand how this works.'),
      'berne',
    );
    expect(tags).toContain('PARENT_critical');
  });

  it('reads martyrdom without requiring the contraction', () => {
    const tags = tagsOf(
      runFleet('After all I have done for this project, I guess I will just take the loss myself.'),
      'berne',
    );
    expect(tags).toContain('CHILD_guilt_victim');
  });

  it('reads a manufactured absence of choice', () => {
    const tags = tagsOf(
      runFleet('You must decide today. Your only option at this point is to accept.'),
      'aristotle',
    );
    expect(tags).toContain('PATHOS_pressure');
  });

  it('reads catastrophe used as an argument', () => {
    const tags = tagsOf(
      runFleet('If you walk away now you will be left with nothing and the whole thing collapses.'),
      'aristotle',
    );
    expect(tags).toContain('PATHOS_fear');
  });
});

describe('the honest message stays quiet', () => {
  // The widening in this file must not cost the fleet its clean control. If
  // this breaks, the lexicons have started inventing signal.
  it('leaves a reasoned, evidenced message entirely alone', () => {
    const v = runFleet(
      'The market rate for this role is 95k based on the latest comparable data. ' +
        'Here are the figures for your review — happy to talk through any of it.',
    );
    expect(v.level).toBe('CLEAN');
    expect(v.corroboration).toBe(0);
  });
});
