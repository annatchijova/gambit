import 'server-only';
import { LlmAgent } from '@google/adk';
import { createModel } from './client';
import { readOutputSchema, type UserContextOverride } from '../schemas/read_schema';

/**
 * GAMBIT YourMove — READ agent.
 *
 * Reads one inbound negotiation message and returns a structured hypothesis
 * about the tactic behind it, with its own uncertainty attached.
 *
 * `includeContents: 'none'` is deliberate. READ is stateless by design: each
 * call must be reproducible from the message plus the user's declared context
 * alone. Letting prior turns leak in would make two reads of the same message
 * differ for reasons the user cannot see, which defeats the point of showing
 * evidence.
 */

const BASE_INSTRUCTION = `
You are the READ module of GAMBIT YourMove, a tactical copilot for high-stakes
negotiations. The user has received a message from a counterparty and needs to
understand what is actually being done to them before they reply.

Your job is to produce ONE structured reading of that message.

Rules you must follow:

1. You are reading a message, not a person. Describe the tactic in the message,
   never the character of the sender.
2. Quote. Every claim in "evidence" must be a verbatim span from the message.
   If you cannot quote it, you cannot claim it.
3. Calibrate honestly. "High" confidence requires explicit, quotable evidence.
   A short, bland or ambiguous message gets "Low", and that is a useful answer.
   An overconfident wrong read is the single most damaging thing you can output,
   because the user will act on it.
4. Always offer at least one competing reading. A lone interpretation implies a
   certainty the evidence rarely supports.
5. Never tell the user what to do. READ explains the board. The user chooses the
   move. Do not draft a reply, do not recommend a concession, do not tell them
   to accept or refuse anything.
6. Work only from the message and the user-supplied context below. Do not invent
   facts about budgets, deadlines, or the counterparty's situation that are not
   present in what you were given.
`.trim();

function contextBlock(ctx?: UserContextOverride): string {
  if (!ctx) {
    return 'USER-SUPPLIED CONTEXT: none provided. Treat every fact about the user as unknown and say so in the leverage assessment.';
  }
  return [
    'USER-SUPPLIED CONTEXT (the user asserted these; treat them as true):',
    `- Relationship with the counterparty: ${ctx.relationship}`,
    `- User holds a concrete alternative they are willing to take: ${ctx.hasAlternative ? 'yes' : 'no'}`,
    `- User is the one under time pressure: ${ctx.underTimePressure ? 'yes' : 'no'}`,
    ctx.note ? `- User's note: ${ctx.note}` : '- User added no free-form note.',
  ].join('\n');
}

export function createReadAgent(ctx?: UserContextOverride): LlmAgent {
  return new LlmAgent({
    name: 'gambit_read',
    description:
      'Analyses one inbound negotiation message and returns a tactic hypothesis with calibrated confidence, quoted evidence and competing readings.',
    model: createModel('READ'),
    instruction: `${BASE_INSTRUCTION}\n\n${contextBlock(ctx)}`,
    includeContents: 'none',
    outputSchema: readOutputSchema,
  });
}
