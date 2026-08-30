import { z } from 'zod';
import { STATE_SCHEMA_VERSION } from '../types';

/**
 * GAMBIT YourMove — TRAIN request contract.
 *
 * The client holds the negotiation state between turns and sends it back each
 * turn. That is safe here for one reason and one reason only: every state
 * carries a SHA-256 transition chain, and the server re-verifies it before
 * touching it (state_rules.verifyChain). A corrupted or reordered history is
 * rejected. This is a practice tool, so a user crafting a favourable state only
 * cheats themselves — the point of the chain here is to DEMONSTRATE the
 * tamper-evidence the whole architecture rests on, live, every turn.
 */

/**
 * A structural guard for an incoming state. Deliberately loose on
 * concessionHistory — verifyChain is the real integrity check; this only stops
 * a malformed object from reaching applyMove and crashing it.
 */
export const negotiationStateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  scenarioId: z.string().max(64),
  round: z.number().int().min(0).max(1000),
  perceivedUserLeverage: z.number().int().min(0).max(100),
  trust: z.number().int().min(0).max(100),
  patience: z.number().int().min(0).max(100),
  concessionHistory: z.array(z.unknown()).max(1000),
  headHash: z.string().nullable(),
});

export const trainRequestSchema = z.object({
  scenarioId: z.string().min(1).max(64),
  message: z
    .string()
    .trim()
    .min(1, 'Type your move before sending.')
    .max(4000, 'That is longer than 4000 characters.'),
  /** Null on the first turn; the prior sealed state on every turn after. */
  state: negotiationStateSchema.nullable().optional(),
});

export type TrainRequest = z.infer<typeof trainRequestSchema>;
