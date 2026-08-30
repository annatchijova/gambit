import { z } from 'zod';
import { userContextOverrideSchema } from './read_schema';

/**
 * GAMBIT YourMove — THINK request.
 *
 * The message and context are re-validated server-side (never trust the client
 * copy). `readTactic` / `readLevel` are OPTIONAL hints carried over from the
 * READ the user just saw: they only shape the drafts' tone, they are not sealed
 * and nothing consequential rests on them, so passing them from the client is
 * safe. The server still recomputes the deterministic read itself.
 */
export const thinkRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: userContextOverrideSchema.optional(),
  readTactic: z.string().max(120).optional(),
  readLevel: z.string().max(40).optional(),
});

export type ThinkRequest = z.infer<typeof thinkRequestSchema>;

/**
 * GAMBIT YourMove — THINK output contract.
 *
 * READ names what the other side is doing. THINK proposes what the user could
 * SAY back — three drafts across a deliberate range of postures, never one
 * "recommended" reply. The product line holds here: GAMBIT drafts, the user
 * decides and edits, and nothing is sent. A single suggested reply would quietly
 * make the move for them; three genuinely different ones hand the choice back.
 *
 * As with READ, the field descriptions ARE the prompt the model sees, so they
 * are written as instructions, not documentation.
 */

export const STANCES = ['soft', 'tactical', 'direct'] as const;
export type Stance = (typeof STANCES)[number];

export const thinkOptionSchema = z.object({
  stance: z
    .enum(STANCES)
    .describe(
      'The posture of this draft. "soft" preserves the relationship and buys time; "tactical" trades or tests without committing; "direct" states the boundary plainly. Provide exactly one of each.',
    ),
  draft: z
    .string()
    .min(10)
    .max(700)
    .describe(
      "A reply the user could actually send, written in their voice — not a description of a reply. Do not invent facts (budgets, deadlines, alternatives) the user did not give you. Do not concede more than the counterparty's own message already put on the table. A few sentences at most.",
    ),
  rationale: z
    .string()
    .min(10)
    .max(300)
    .describe('Why this posture makes sense against the tactic the read identified. One or two sentences.'),
  watchOut: z
    .string()
    .min(10)
    .max(220)
    .describe('The cost or risk of taking this posture — what it gives up or exposes. Every option has one.'),
});

export const thinkOutputSchema = z.object({
  principle: z
    .string()
    .min(10)
    .max(240)
    .describe(
      'The one thing worth protecting in any reply, given what the counterparty is doing. Not advice on which option to pick — a constraint that holds across all three.',
    ),
  options: z
    .array(thinkOptionSchema)
    .length(3)
    .describe('Exactly three drafts: one soft, one tactical, one direct. Never rank them or mark one as best.'),
});

export type ThinkOutput = z.infer<typeof thinkOutputSchema>;
export type ThinkOption = z.infer<typeof thinkOptionSchema>;
