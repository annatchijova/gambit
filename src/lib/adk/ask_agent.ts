import 'server-only';
import { LlmAgent } from '@google/adk';
import { createModel } from './client';
import { ASK_INSTRUCTION } from '../ask_prompt';
import { askOutputSchema } from '../schemas/ask_schema';

/**
 * GAMBIT YourMove — ASK agent.
 *
 * Answers a question about a verdict the deterministic fleet already sealed.
 *
 * `includeContents: 'none'` for the same reason READ uses it, and with the same
 * consequence: the agent sees only what this request hands it. The transcript
 * is serialised into that request instead (see ask_prompt.ts), which keeps the
 * conversation working when Cloud Run puts the next turn on another instance —
 * an ADK session would be per-instance and would lose the thread silently.
 *
 * The agent is given the sealed numbers as fact and no tool that could write
 * them back. It cannot alter what the interface renders; at worst it explains
 * the verdict badly.
 */
export function createAskAgent(): LlmAgent {
  return new LlmAgent({
    name: 'gambit_ask',
    description:
      'Explains an already-sealed verdict about one negotiation message. Cannot change the verdict, draft a reply, or decide anything.',
    model: createModel('ASK'),
    instruction: ASK_INSTRUCTION,
    includeContents: 'none',
    outputSchema: askOutputSchema,
  });
}
