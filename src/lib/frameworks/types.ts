import type { Fraction } from '../fraction';

/**
 * GAMBIT YourMove — framework fleet contracts.
 *
 * Each member of the fleet is one theoretical lens on the same inbound
 * message: it looks for the manipulation signature its framework describes and
 * reports what it found, how strongly, and the verbatim spans that made it say
 * so. Nothing here calls a model. The lenses are deterministic lexical
 * analysers, ported from the sibling projects (ARGOS's 11 philosophers,
 * corvus / wolf-and-cronos's six layers), so their combined verdict can be
 * sealed and replayed. The language model narrates that verdict downstream; it
 * never produces it.
 */

export const FRAMEWORK_NAMES = [
  'grice',
  'cialdini',
  'aristotle',
  'berne',
] as const;

export type FrameworkName = (typeof FRAMEWORK_NAMES)[number];

/**
 * One lens's reading of one message.
 *
 * `severity` is an exact rational in [0, 1] (never a float — see fraction.ts).
 * `tags` name the specific patterns that fired, for the audit panel.
 * `evidence` holds VERBATIM spans from the original message; a lens that
 * cannot quote its trigger reports empty evidence and, by construction, a
 * severity that will not clear the fire floor.
 */
export interface FrameworkSignal {
  framework: FrameworkName;
  /** Human title for the audit panel, e.g. "Grice — Cooperative Principle". */
  title: string;
  severity: Fraction;
  tags: string[];
  evidence: string[];
}

/**
 * A pure lens. Given the normalised message (lower-cased, folded) and the
 * original raw message (for verbatim quoting), returns exactly one signal.
 * No I/O, no clock, no randomness — the same message always yields the same
 * signal, which is what lets the fleet verdict be hash-sealed.
 */
export type FrameworkAnalyzer = (norm: string, raw: string) => FrameworkSignal;
