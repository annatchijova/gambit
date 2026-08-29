import { z } from 'zod';

/**
 * GAMBIT YourMove — READ output contract.
 *
 * One schema, two jobs:
 *   1. handed to the ADK agent as `outputSchema`, so the model is constrained
 *      at generation time (ADK accepts a Zod v4 object directly);
 *   2. used to re-validate the parsed response before anything reaches the UI.
 *
 * Both, not either. Constrained decoding reduces malformed output; it does not
 * eliminate it, and a response that fails this parse is reported as
 * `invalid_response`, never repaired into something plausible.
 *
 * NAMING — the codebase uses camelCase throughout, including on the wire.
 * The original planning document sketched these fields in snake_case; that was
 * changed here deliberately so there is exactly one convention to remember. If
 * you prefer snake_case, change it in this file only, before Day 2.
 *
 * THE UNCERTAINTY LAYER IS THE PRODUCT.
 * `confidence` is not decoration. A tactical read delivered with false
 * certainty is worse than no read at all, because the user acts on it. The
 * field descriptions below are part of the prompt the model actually sees, so
 * they are written as instructions, not as documentation.
 */

export const CONFIDENCE_LEVELS = ['High', 'Medium', 'Low'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const alternativeReadSchema = z.object({
  tactic: z
    .string()
    .min(3)
    .max(80)
    .describe('A different tactic that would also explain this message.'),
  why: z
    .string()
    .min(10)
    .max(300)
    .describe('What in the message supports this competing reading.'),
});

export const leverageAssessmentSchema = z.object({
  userPosition: z
    .string()
    .min(10)
    .max(400)
    .describe(
      "What the user actually holds in this exchange, based only on what is visible in the message and the supplied context. If the message gives no evidence about the user's position, say so.",
    ),
  opponentPosition: z
    .string()
    .min(10)
    .max(400)
    .describe(
      'What the counterparty appears to hold, and how much of that is asserted rather than demonstrated.',
    ),
  primaryRisk: z
    .string()
    .min(10)
    .max(300)
    .describe(
      'The single most costly mistake the user could make in their next reply.',
    ),
});

export const readOutputSchema = z.object({
  likelyTactic: z
    .string()
    .min(3)
    .max(80)
    .describe(
      'The most plausible negotiation tactic behind this message, named in two to five words (e.g. "Anchoring low", "Manufactured urgency", "Good cop / bad cop").',
    ),
  confidence: z
    .enum(CONFIDENCE_LEVELS)
    .describe(
      'High only when the message contains explicit, quotable evidence for the tactic. Medium when the reading is supported but the message is short or mixed. Low when you are inferring from tone or from very little text. Prefer Low over High when unsure — a wrong High is more damaging to the user than an honest Low.',
    ),
  manipulationSeverity: z
    .number()
    .int()
    .min(0)
    .max(20)
    .describe(
      'Your independent numeric vote, an integer 0-20, on how manipulative this message is AS A NEGOTIATION TACTIC. 0 is a plain, cooperative, information-only message; 20 is a message built almost entirely from pressure tactics (manufactured urgency, guilt, borrowed authority, ultimatum, ulterior framing). Rate what the message DOES, not how you feel about the sender. This vote is cast alongside a deterministic rule engine that votes separately; the two are shown side by side, so an honest estimate is worth more than a confident one. When in doubt, rate lower.',
    ),
  evidence: z
    .array(
      z
        .string()
        .min(3)
        .max(300)
        .describe('A short verbatim span from the message.'),
    )
    .min(1)
    .max(4)
    .describe(
      'Verbatim spans from the message that support the reading. Quote, do not paraphrase. If nothing can be quoted, the confidence is Low.',
    ),
  subtext: z
    .string()
    .min(10)
    .max(400)
    .describe(
      'What the counterparty is communicating without stating it outright.',
    ),
  alternatives: z
    .array(alternativeReadSchema)
    .min(1)
    .max(3)
    .describe(
      'Competing readings of the same message. Always at least one: a single reading presented alone reads as certainty the evidence does not support.',
    ),
  leverageAssessment: leverageAssessmentSchema,
});

export type ReadOutput = z.infer<typeof readOutputSchema>;
export type AlternativeRead = z.infer<typeof alternativeReadSchema>;
export type LeverageAssessment = z.infer<typeof leverageAssessmentSchema>;

/**
 * Context the user can supply to override the model's assumptions.
 *
 * This is the "AI increases agency" surface: the user corrects the machine's
 * framing, the machine does not quietly correct the user.
 */
export const userContextOverrideSchema = z.object({
  relationship: z
    .enum(['first-contact', 'ongoing', 'long-standing', 'unknown'])
    .default('unknown'),
  /** True when the user has a concrete alternative they are willing to take. */
  hasAlternative: z.boolean().default(false),
  /** True when the user is the one under time pressure. */
  underTimePressure: z.boolean().default(false),
  /** Free-form correction, e.g. "they already know my budget". */
  note: z.string().max(500).default(''),
});

export type UserContextOverride = z.infer<typeof userContextOverrideSchema>;
