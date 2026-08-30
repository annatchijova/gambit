import { Fraction } from '../fraction';
import type { FrameworkAnalyzer, FrameworkSignal } from './types';
import { collectEvidence, runCategories, severityFromHits, type Category } from './lexical';

/**
 * Grice — the Cooperative Principle (1975).
 *
 * A cooperative speaker is truthful (QUALITY), gives the right amount of
 * information (QUANTITY), stays relevant (RELATION) and is clear (MANNER). A
 * message that violates these while presenting itself as cooperative is doing
 * something under the surface — evasion, obfuscation, deflection. In a
 * negotiation that is rarely accidental.
 *
 * Lexical and deterministic: it flags
 * the maxim-violation vocabulary, quotes it, and reports how much of it is
 * present. It does not claim to have understood the message — only that these
 * specific evasion signatures are or are not in the text.
 */

const CATEGORIES: readonly Category[] = [
  {
    tag: 'MANNER_obfuscation',
    weight: Fraction.of(1, 4),
    pattern:
      // The backreference arm catches tautologies — "the budget is the budget",
      // "rules are rules". A sentence that defines a term by itself carries no
      // information, which is the Manner violation in its purest form.
      /\b(?:for (?:various|a number of|obvious) reasons|it'?s complicated|one way or another|let'?s just say|as (?:you know|we all know)|suffice (?:it )?to say|needless to say|it is what it is|the (\w+) is the \1|(\w+) are \2)\b/,
  },
  {
    tag: 'QUANTITY_evasion',
    weight: Fraction.of(1, 4),
    pattern:
      /\b(?:not (?:something i can|at liberty|in a position) (?:get into|to (?:say|discuss|share))|i can'?t (?:get into|go into)|we'?ll circle back|details? to follow|i'?ll spare you|that'?s between)\b/,
  },
  {
    tag: 'QUALITY_unfalsifiable',
    weight: Fraction.of(1, 4),
    pattern:
      /\b(?:every(?:one|body) knows|it'?s a (?:known )?fact|without (?:a )?doubt|no question|trust me|believe me|guaranteed|100 ?%|obviously|any reasonable person|anyone (?:can see|would (?:see|agree)))\b/,
  },
  {
    tag: 'RELATION_deflection',
    weight: Fraction.of(1, 4),
    pattern:
      // `let's focus on ...` was removed: it fires on someone honestly ordering
      // an agenda. Deflection is steering AWAY from what was raised, which the
      // arms below name explicitly.
      /\b(?:that'?s not the point|beside the point|the real (?:issue|question) (?:is|here)|putting that aside|that'?s a separate|moving on|getting off track|get(?:ting)? bogged down|not what this is about)\b/,
  },
];

export const analyzeGrice: FrameworkAnalyzer = (norm, raw): FrameworkSignal => {
  const hits = runCategories(CATEGORIES, norm, raw);

  // Convergence: several maxims broken at once is a stronger signal than the
  // sum of their weights suggests — that is a message evading on multiple
  // axes. Mirrors the +bonus rule in the sibling detectors.
  let severity = severityFromHits(hits);
  if (hits.length >= 3) severity = severity.add(Fraction.of(1, 8)).clamp01();

  return {
    framework: 'grice',
    title: 'Grice — Cooperative Principle',
    severity,
    tags: hits.map((h) => h.tag),
    evidence: collectEvidence(hits),
  };
};
