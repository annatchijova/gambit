import { z } from 'zod';

/**
 * GAMBIT YourMove — Adversary output contract.
 *
 * The counterparty's turn. `reply` is what they say; `mood` is a cosmetic tell
 * for the UI. Neither is allowed to carry a number: the state
 * (leverage/trust/patience) is decided by the deterministic engine and handed
 * to this agent as a fact. The agent phrases a reply consistent with it and
 * nothing more — swapping the persona changes the words, never the state.
 */
export const adversaryOutputSchema = z.object({
  reply: z
    .string()
    .min(1)
    .max(600)
    .describe(
      'The counterparty\'s reply to the user\'s last message, in character and consistent with the negotiation state you were given. A few sentences at most. Do not state the numeric state or break character to explain yourself.',
    ),
  mood: z
    .string()
    .min(2)
    .max(24)
    .describe(
      'One or two words for the counterparty\'s current disposition, for the interface — e.g. "guarded", "warming up", "impatient", "digging in".',
    ),
});

export type AdversaryOutput = z.infer<typeof adversaryOutputSchema>;
