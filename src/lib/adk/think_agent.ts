import 'server-only';
import { LlmAgent } from '@google/adk';
import { createModel } from './client';
import { thinkOutputSchema } from '../schemas/think_schema';
import type { UserContextOverride } from '../schemas/read_schema';

/**
 * GAMBIT YourMove — THINK agent.
 *
 * Drafts three replies to a message, across a deliberate range of postures. It
 * is generative by design — this is where the model does real work — but it is
 * still fenced: it receives the READ verdict as an ESTABLISHED fact it may not
 * relitigate, it drafts only (it cannot and must not send), and it is told in
 * the strongest terms not to invent facts the user never supplied.
 *
 * `includeContents: 'none'` for the same reason as READ: each call must be
 * reproducible from the message, the read summary and the user's context alone.
 */

const BASE_INSTRUCTION = `
You are the THINK module of GAMBIT YourMove, a tactical copilot for high-stakes
negotiations. READ has already established what the counterparty is doing. Your
job is to draft THREE replies the user could send back — one soft, one tactical,
one direct — so the user can choose and edit. You are not choosing for them.

Rules you must follow:

1. Draft, do not decide. Produce three genuinely different postures. Never rank
   them, never mark one as recommended, never collapse them into one answer.
2. Write replies, not descriptions of replies. Each "draft" is text the user
   could paste and send, in their own voice.
3. Invent nothing. Do not add budgets, deadlines, alternatives, or facts about
   the user's situation that were not given to you. If a draft nonetheless states
   such a fact, you MUST list it in that draft's "assumptions" so the user can
   confirm it before sending — never slip an unverified claim into their mouth.
   An empty "assumptions" list is the goal.
4. Name the cost. Every draft states, in "concedes", exactly what it gives away,
   and in "holds", the line it does not cross. A reply that hides its own
   concession is doing to the user what this app exists to catch — so it is not
   offered. Do not over-concede: never give away more than the counterparty's own
   message already put on the table.
5. You never send anything. There is no send button behind you. The user copies,
   edits, and sends themselves. Do not imply you have acted.
6. Take the READ as established. Do not re-argue what the message is doing; write
   replies that are appropriate to it.
`.trim();

function contextBlock(readSummary: string, ctx?: UserContextOverride): string {
  const lines = [
    'THE READ (already established by READ — treat as fixed, do not relitigate):',
    readSummary,
    '',
    'USER-SUPPLIED CONTEXT (the user asserted these; treat them as true):',
  ];
  if (!ctx) {
    lines.push('- none provided. Do not assume an alternative, a deadline, or a relationship you were not told about.');
  } else {
    lines.push(`- Relationship with the counterparty: ${ctx.relationship}`);
    lines.push(`- User holds a concrete alternative they are willing to take: ${ctx.hasAlternative ? 'yes' : 'no'}`);
    lines.push(`- User is the one under time pressure: ${ctx.underTimePressure ? 'yes' : 'no'}`);
    lines.push(
      ctx.note
        ? `- User's note — treat any constraint here as a HARD red line the drafts must respect: ${ctx.note}`
        : '- User added no free-form note.',
    );
  }
  return lines.join('\n');
}

function briefBlock(brief: string): string {
  const trimmed = brief.trim();
  if (!trimmed) {
    return 'The user gave no brief.';
  }
  return [
    "USER'S BRIEF — what the user wants this reply to contain or avoid. Treat every",
    'constraint here as a HARD requirement the drafts must honor (still without',
    'inventing facts the user did not give):',
    trimmed,
  ].join('\n');
}

export function createThinkAgent(readSummary: string, ctx?: UserContextOverride, brief: string = ''): LlmAgent {
  return new LlmAgent({
    name: 'gambit_think',
    description:
      'Drafts three replies (soft, tactical, direct) to a counterparty message, grounded in the READ verdict and the user’s voice. Drafts only — it never sends.',
    model: createModel('THINK'),
    instruction: `${BASE_INSTRUCTION}\n\n${contextBlock(readSummary, ctx)}\n\n${briefBlock(brief)}`,
    includeContents: 'none',
    outputSchema: thinkOutputSchema,
  });
}
