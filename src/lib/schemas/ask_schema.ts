import { z } from 'zod';
import { readOutputSchema } from './read_schema';

/**
 * GAMBIT YourMove — ASK: questions about a verdict that has already been sealed.
 *
 * ============================================================================
 * WHAT THIS CONVERSATION IS ALLOWED TO BE
 * ============================================================================
 *
 * READ is deliberately stateless — `includeContents: 'none'`, a fresh session
 * per request — so that two reads of the same message cannot differ for reasons
 * the user cannot see. Nothing here weakens that. ASK is a separate surface
 * whose subject is a verdict the deterministic fleet has ALREADY produced and
 * sealed: the reader asks why Cialdini fired and Grice did not, or what a split
 * between the rules and the model means, and the model explains.
 *
 * The model can therefore be wrong about the explanation and still cannot make
 * the numbers wrong, because it is not in the path that produced them. That is
 * the same architecture as everywhere else in this codebase, applied to prose.
 *
 * TWO THINGS THE SHAPE BELOW ENFORCES.
 *
 * 1. NO CLIENT-SUPPLIED NUMBERS. The request carries the MESSAGE, not the
 *    verdict. The server re-runs the fleet over that message — deterministic,
 *    no model, no network — and grounds the conversation in the verdict it
 *    computes for itself. A tampered client cannot argue with a fact base it
 *    does not get to supply. This is strictly stronger than accepting a verdict
 *    and verifying its seal, and it is simpler.
 *
 * 2. THE HISTORY IS BOUNDED. The transcript travels with each request, because
 *    the ADK session store is per-instance and this app runs multiple instances
 *    on Cloud Run — a server-side session would silently lose the thread when a
 *    request landed elsewhere. Bounded because an unbounded transcript grows the
 *    prompt, the latency and the bill together.
 */

/** Turns kept. Older ones are dropped rather than the request being refused. */
export const MAX_HISTORY_TURNS = 8;
export const MAX_QUESTION_CHARS = 500;

export const askTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(4_000),
});

export type AskTurn = z.infer<typeof askTurnSchema>;

export const askRequestSchema = z.object({
  /**
   * The message the verdict was computed over. The server re-derives the
   * verdict from this rather than being told what it was.
   */
  message: z.string().trim().min(1).max(4_000),
  question: z
    .string()
    .trim()
    .min(1, 'Type a question about this reading.')
    .max(
      MAX_QUESTION_CHARS,
      `Questions are capped at ${MAX_QUESTION_CHARS} characters. Ask one thing at a time.`,
    ),
  /** Prior turns, oldest first. Trimmed server-side to MAX_HISTORY_TURNS. */
  history: z.array(askTurnSchema).max(40).default([]),
  /**
   * The model's own earlier reading, when there was one. Optional: the
   * deterministic verdict is always available, the model's narrative is not.
   */
  read: readOutputSchema.nullish(),
});

export type AskRequest = z.infer<typeof askRequestSchema>;

/**
 * The answer. Structured rather than free text for the same reason READ is:
 * a response that fails validation is reported as invalid, never patched into
 * something that looks answerable.
 */
export const askOutputSchema = z.object({
  answer: z
    .string()
    .min(1)
    .max(1_400)
    .describe(
      'A direct answer to the question, grounded in the sealed verdict and the message. Plain prose, no markdown headings.',
    ),
  /**
   * Set when the question asked for something ASK does not do — writing the
   * reply, deciding whether to accept, predicting what the counterparty will
   * do next. The interface renders this differently, so a refusal reads as a
   * boundary rather than as a failure.
   */
  outOfRemit: z
    .boolean()
    .default(false)
    .describe('True when the question asked ASK to decide or to draft, which it does not do.'),
});

export type AskOutput = z.infer<typeof askOutputSchema>;
