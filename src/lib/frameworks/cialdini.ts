import { Fraction } from '../fraction';
import type { FrameworkAnalyzer, FrameworkSignal } from './types';
import { collectEvidence, runCategories, severityFromHits, type Category } from './lexical';

/**
 * Cialdini & Carnegie — influence tactics.
 *
 * The best-documented levers of compliance: scarcity, urgency, borrowed
 * authority, social proof, engineered reciprocity, flattery, and the
 * consistency trap ("you already agreed"). Each is legitimate in isolation and
 * manipulative in concentration — which is exactly why the fleet does not
 * convict on one lever alone, but counts how many are being pulled at once.
 *
 * Ported from ARGOS's Carnegie detector and corvus/wolf-and-cronos L2. In a
 * negotiation these are the tactics that manufacture pressure the underlying
 * position does not justify: the message feels urgent without being urgent.
 */

const CATEGORIES: readonly Category[] = [
  {
    tag: 'SCARCITY',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:only (?:a few|\d+) (?:left|remaining|spots?)|last (?:one|chance|call)|limited (?:time|availability|spots?)|won'?t last|while (?:supplies|it) last|few (?:left|remaining)|going fast)\b/,
  },
  {
    tag: 'URGENCY',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:act (?:now|fast|today)|right (?:now|away)|immediately|time[- ]sensitive|by (?:end of (?:day|business)|cob|eod)|before (?:it'?s too late|midnight)|urgent(?:ly)?|can'?t wait)\b/,
  },
  {
    tag: 'AUTHORITY',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:as (?:an? )?(?:expert|professional)|in my (?:professional|expert) (?:opinion|experience)|policy (?:requires|dictates|states)|standard practice|the (?:market|data) dictates|industry (?:mandates|requires)|i'?ve been doing this (?:for )?\d*\s*years?)\b/,
  },
  {
    tag: 'SOCIAL_PROOF',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:everyone (?:else )?(?:is|has|does)|all (?:our|my) (?:other )?(?:clients|customers|partners)|most people|others have already|nobody else (?:has a problem|complains|objects)|(?:9 out of 10|99%))\b/,
  },
  {
    tag: 'RECIPROCITY',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:after everything (?:i'?ve|we'?ve) done|i did you a favou?r|given (?:what|everything) (?:i|we) (?:offered|gave)|we'?ve been (?:more than |nothing but )?(?:fair|generous)|the least you could do)\b/,
  },
  {
    tag: 'LIKING_flattery',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:(?:smart|savvy|reasonable) (?:person|people|guy|woman|man) like you|i know you'?ll understand|we both know|you'?re (?:clearly|obviously) (?:smart|sharp|reasonable)|i respect (?:you|that)|between (?:you and me|friends))\b/,
  },
  {
    tag: 'COMMITMENT_trap',
    weight: Fraction.of(1, 5),
    pattern:
      /\b(?:you already (?:agreed|said|committed)|as (?:we|you) (?:discussed|agreed|said)|you (?:said|told me) you would|we had (?:a deal|an agreement)|you gave me your word|don'?t go back on)\b/,
  },
];

export const analyzeCialdini: FrameworkAnalyzer = (norm, raw): FrameworkSignal => {
  const hits = runCategories(CATEGORIES, norm, raw);

  // Convergence bonus, staged like ARGOS's Carnegie amplifier: three levers is
  // a pressure campaign, four is a vice. One lever on its own stays modest.
  let severity = severityFromHits(hits);
  if (hits.length >= 4) severity = severity.add(Fraction.of(1, 4)).clamp01();
  else if (hits.length >= 3) severity = severity.add(Fraction.of(1, 8)).clamp01();

  return {
    framework: 'cialdini',
    title: 'Cialdini & Carnegie — Influence tactics',
    severity,
    tags: hits.map((h) => h.tag),
    evidence: collectEvidence(hits),
  };
};
