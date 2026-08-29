import { Fraction } from '../fraction';
import type { FrameworkAnalyzer, FrameworkSignal } from './types';
import { collectEvidence, verbatim, type CategoryHit } from './lexical';

/**
 * Aristotle — the three rhetorical appeals, and their imbalance.
 *
 * Persuasion rides on ethos (credibility), pathos (emotion) and logos
 * (reasoning). None is manipulation on its own. The signature the fleet looks
 * for is IMBALANCE: heavy emotional pressure with the reasoning stripped out —
 * pathos loud, logos silent. A message that makes you feel the deal is urgent
 * without giving you a reason it is urgent is doing rhetoric to you, not
 * argument with you.
 *
 * Ported from ARGOS's Aristotle detector and corvus/wolf-and-cronos L3. Unlike
 * the additive lenses, this one is a BALANCE computation: logos present is a
 * mitigator that lowers the severity, because a reasoned message is exactly
 * what an honest counterparty sends. Exact rationals throughout.
 */

const PATHOS = [
  {
    tag: 'PATHOS_fear',
    pattern:
      /\b(?:you'?ll (?:regret|lose|miss out)|don'?t (?:blow|throw away) this|last thing you want|you can'?t afford (?:to|not)|risky|dangerous|scared|worried|nightmare|disaster)\b/,
  },
  {
    tag: 'PATHOS_guilt',
    pattern:
      /\b(?:after (?:all|everything)|i thought (?:we|you)|how could you|you'?re (?:really )?going to|i'?m disappointed|let(?:'| u)s down|i trusted you)\b/,
  },
  {
    tag: 'PATHOS_pressure',
    pattern:
      /\b(?:you have to|you need to|there'?s no (?:other )?(?:way|choice)|no other option|forced to|either (?:you|we)|it'?s now or never)\b/,
  },
] as const;

/** Reasoning present: connectives, evidence markers, explicit justification. */
const LOGOS =
  /\b(?:because|therefore|the (?:data|numbers|figures) (?:show|indicate|say)|based on|for example|specifically|the reason (?:is|being)|which means|as a result|evidence)\b/;

/** Credibility claim advanced without backing — borrowed, not demonstrated. */
const ETHOS =
  /\b(?:trust me|believe me|as (?:an? )?(?:expert|professional)|i'?ve been (?:doing this|in this business)|take my word|i (?:know|understand) (?:this (?:market|business)|how this works))\b/;

export const analyzeAristotle: FrameworkAnalyzer = (norm, raw): FrameworkSignal => {
  const pathosHits: CategoryHit[] = [];
  for (const p of PATHOS) {
    if (p.pattern.test(norm)) {
      pathosHits.push({ tag: p.tag, weight: Fraction.of(1, 3), evidence: verbatim(raw, p.pattern) });
    }
  }
  const logosPresent = LOGOS.test(norm);
  const ethosPresent = ETHOS.test(norm);

  // Emotional load: up to 1 as more pathos registers fire.
  let severity = pathosHits.reduce((acc, h) => acc.add(h.weight), Fraction.ZERO).clamp01();

  // Reasoning present tempers the read — an argued message is what honesty
  // looks like. Unsourced credibility with no reasoning behind it pushes back up.
  if (logosPresent) severity = severity.sub(Fraction.of(1, 3));
  if (ethosPresent && !logosPresent) severity = severity.add(Fraction.of(1, 6));
  severity = severity.clamp01();

  const tags = pathosHits.map((h) => h.tag);
  if (logosPresent) tags.push('LOGOS_present');
  if (ethosPresent) tags.push('ETHOS_unsourced');

  const evidence = collectEvidence(pathosHits);
  if (ethosPresent && evidence.length < 4) {
    const span = verbatim(raw, ETHOS);
    if (span && !evidence.includes(span)) evidence.push(span);
  }

  return {
    framework: 'aristotle',
    title: 'Aristotle — Rhetorical imbalance (pathos vs logos)',
    severity,
    tags,
    evidence,
  };
};
