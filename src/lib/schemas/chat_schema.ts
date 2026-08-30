import { z } from 'zod';

/**
 * GAMBIT YourMove — assistant chat contract.
 *
 * The client holds the transcript and sends it whole each turn, so the server
 * stays stateless and any Cloud Run instance can answer. The last message must
 * be the user's; the server folds the rest into the agent's instruction.
 */

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
