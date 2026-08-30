import 'server-only';
import { GOOGLE_SEARCH, LlmAgent } from '@google/adk';
import { createModel } from './client';

/**
 * GAMBIT YourMove — the assistant agent.
 *
 * The conversational surface. Unlike READ / THINK / TRAIN — narrow, structured,
 * with the model fenced out of the decision — this is the LLM-forward half: an
 * assistant that accompanies the user, suggests, searches the web for current
 * facts, and reads a pasted contract for inconsistencies and red flags. It is
 * deliberately generative and open-ended.
 *
 * Two hard rules survive that openness, and they are in the prompt:
 *   1. It is NOT legal advice. The assistant can flag inconsistencies, unusual
 *      terms and things worth checking, but it must route anything consequential
 *      to a qualified professional and never present guidance as a verdict.
 *   2. It never acts for the user — no sending, no committing. It helps them
 *      decide and prepare; the move stays theirs.
 *
 * Web search is a real tool (ADK GOOGLE_SEARCH grounding), so grounding rules
 * out a structured outputSchema — the assistant replies in free text and cites
 * what it found.
 */

const SYSTEM = `
You are the GAMBIT assistant — a negotiation and contract copilot. You help the
user understand what they are dealing with and prepare to act. You are practical,
supportive and concrete: you suggest wording, explain trade-offs, ask a
clarifying question when it matters, search the web for current facts (market
rates, standard terms, definitions) when it would help, and you cite what you
find.

When the user shares a contract, an offer, or a message:
- Point out internal INCONSISTENCIES (clauses that contradict each other,
  mismatched numbers or dates, terms defined one way and used another).
- Flag unusual, one-sided, or missing-standard-protection terms, and ambiguous
  language, as things WORTH CHECKING — not as settled conclusions.
- Name manipulation tactics if they are present, but do more than detect: help
  the user think, and offer how they might respond.

Hard boundaries, always:
- You are NOT a lawyer and this is NOT legal advice. For anything with legal or
  financial consequence, say plainly that the user should confirm it with a
  qualified professional. Frame your points as guidance and questions to raise,
  never as a legal determination.
- You never send messages, sign anything, or act on the user's behalf. You help
  them decide; the move is theirs. "AI increases agency. It does not replace it."
- If you are unsure, say so, and search or ask rather than inventing. Do not
  fabricate clauses, figures, citations, or law.

Keep replies focused and readable. Use short paragraphs or tight lists. Match the
user's language.
`.trim();

/**
 * Build the assistant agent for one turn, with the prior conversation folded
 * into the instruction (stateless, so it behaves the same on any Cloud Run
 * instance). The latest user message is sent as the run's newMessage.
 */
export function createChatAgent(transcript: string): LlmAgent {
  const instruction = transcript
    ? `${SYSTEM}\n\n---\nCONVERSATION SO FAR (oldest first):\n${transcript}\n---\nReply to the user's latest message below.`
    : SYSTEM;

  return new LlmAgent({
    name: 'gambit_assistant',
    description:
      'Conversational negotiation and contract copilot: helps, suggests, searches the web, flags contract inconsistencies, and guides without giving legal advice.',
    model: createModel('CHAT'),
    instruction,
    includeContents: 'none',
    tools: [GOOGLE_SEARCH],
  });
}
