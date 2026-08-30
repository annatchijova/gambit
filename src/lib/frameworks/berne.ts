import { Fraction } from '../fraction';
import type { FrameworkAnalyzer, FrameworkSignal } from './types';
import { collectEvidence, runCategories, severityFromHits, type Category } from './lexical';

/**
 * Berne — Transactional Analysis (1964).
 *
 * Every message is sent from an ego state — Parent, Adult, Child — and aimed at
 * one in the reader. The manipulative move is the ULTERIOR transaction: the
 * surface says one thing (polite, reasonable, Adult-to-Adult) while the real
 * message underneath is a Parent scolding a Child or a Child playing victim to
 * extract a concession. "With all due respect, but..." is the classic tell:
 * the courtesy is there precisely to license what follows it.
 *
 * Ported from corvus/wolf-and-cronos L4. The lens flags critical-Parent
 * condescension, ulterior "polite pressure" frames, and adaptive-Child guilt
 * plays — the three that show up when someone wants leverage without asking
 * for it in the open.
 */

const CATEGORIES: readonly Category[] = [
  {
    tag: 'PARENT_critical',
    weight: Fraction.of(3, 10),
    pattern:
      // Two arms were narrowed. A bare `frankly` and a bare `let me be clear`
      // fire on candour and on plain scope-setting; the Parent move is those
      // registers aimed AT the other person, so both now require that aim.
      /\b(?:you (?:should|ought to) know better|you should have known|surely you (?:understand|know|appreciate|realise|realize)|i shouldn'?t have to (?:explain|tell you)|let me be (?:very )?clear[,.:]?\s+(?:you|this is|i am|i'?m|we are|we'?re)|frankly,?\s+(?:you|i expected|i'?m surprised)|to be (?:honest|blunt) with you|be reasonable|grow up|come on now)\b/,
  },
  {
    tag: 'ULTERIOR_polite_pressure',
    weight: Fraction.of(3, 10),
    pattern:
      /\b(?:with (?:all due )?respect,? but|no (?:pressure|offense),? but|don'?t take this the wrong way,? but|i'?m just saying|i hate to (?:do|say) this,? but|nothing personal,? but|not to be (?:rude|difficult),? but|i don'?t mean to be (?:rude|difficult|harsh),? but)\b/,
  },
  {
    tag: 'CHILD_guilt_victim',
    weight: Fraction.of(3, 10),
    pattern:
      /\b(?:i guess (?:i'?ll|i will|i)\s*(?:just)?|if that'?s how you want it|i thought we were (?:friends|partners|better than)|after all (?:(?:i|we)(?:'?ve| have)|this)|you'?re putting me in a (?:tough|bad) (?:spot|position)|i don'?t know what (?:i'?ll|we'?ll) do)\b/,
  },
];

export const analyzeBerne: FrameworkAnalyzer = (norm, raw): FrameworkSignal => {
  const hits = runCategories(CATEGORIES, norm, raw);

  // An ulterior frame co-occurring with a Parent or Child play is the fully
  // formed manipulation, not a slip of tone — amplify when both are present.
  const tagsFired = new Set(hits.map((h) => h.tag));
  let severity = severityFromHits(hits);
  if (tagsFired.has('ULTERIOR_polite_pressure') && tagsFired.size >= 2) {
    severity = severity.add(Fraction.of(1, 5)).clamp01();
  }

  return {
    framework: 'berne',
    title: 'Berne — Transactional Analysis (ulterior)',
    severity,
    tags: hits.map((h) => h.tag),
    evidence: collectEvidence(hits),
  };
};
