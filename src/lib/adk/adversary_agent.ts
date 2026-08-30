import 'server-only';
import { LlmAgent } from '@google/adk';
import { createModel } from './client';
import { adversaryOutputSchema } from '../schemas/adversary_schema';
import type { NegotiationState } from '../types';
import type { Classification } from '../state_rules';

/**
 * GAMBIT YourMove — Adversary agent (TRAIN).
 *
 * The counterparty in a practice session. This is the architecture's clearest
 * demonstration: the agent is handed the negotiation state as an ALREADY-DECIDED
 * fact and told, in the instruction, that it cannot change it. The deterministic
 * engine (state_rules.ts) computed and sealed that state from the user's move
 * before this agent was ever called. The agent's only job is to sound like the
 * persona while staying consistent with the numbers.
 *
 * The test the whole project rests on: swap this agent for a different model and
 * only the wording changes — never the state, never the seal, never the outcome.
 */

/** Turn integer 0..100 state into the qualitative cues the persona reacts to. */
function band(v: number, low: string, mid: string, high: string): string {
  return v <= 33 ? low : v >= 67 ? high : mid;
}

function stateGuidance(state: NegotiationState, classification: Classification): string {
  const leverage = band(
    state.perceivedUserLeverage,
    'You believe you hold the stronger hand; the user has shown little real leverage. You can afford to hold firm.',
    'Leverage feels roughly even. Neither of you can dictate terms outright.',
    'You believe the user holds real leverage — a credible alternative or a strong case. You cannot afford to be dismissive.',
  );
  const trust = band(
    state.trust,
    'Trust is low: be guarded, hedge, do not give ground on good faith alone.',
    'Trust is ordinary: cooperative but not naive.',
    'Trust is high: you are willing to be more open and to take the user at their word.',
  );
  const patience = band(
    state.patience,
    'Your patience is nearly gone: be terse, press to close or walk, do not re-open settled points.',
    'You have normal patience for back-and-forth.',
    'You are in no hurry: you can let the conversation breathe.',
  );
  return [
    `NEGOTIATION STATE (decided by the engine from the user's move — treat as FIXED, never state the numbers):`,
    `- Perceived user leverage ${state.perceivedUserLeverage}/100. ${leverage}`,
    `- Trust ${state.trust}/100. ${trust}`,
    `- Patience ${state.patience}/100. ${patience}`,
    `- The engine read the user's last move as: ${classification.moveType} (${classification.criterion}).`,
    `- This is round ${state.round}.`,
  ].join('\n');
}

export function createAdversaryAgent(
  persona: string,
  state: NegotiationState,
  classification: Classification,
): LlmAgent {
  const instruction = `
You are the counterparty in a negotiation the user is practising against.

YOUR PERSONA:
${persona}

${stateGuidance(state, classification)}

Rules:
1. Stay in character. Reply as this counterparty would, given the state above.
2. The state is fixed. You did not set it and you cannot move it — it was
   computed from the user's move before you were called. Never announce the
   numbers, never break character to explain the mechanics.
3. React to the state, do not recite it. If leverage shifted toward the user,
   sound it — do not say "your leverage increased".
4. Do not concede more than the state warrants, and do not collapse instantly.
   A real counterparty makes the user work.
5. Keep it to a few sentences. This is a live exchange, not a memo.
`.trim();

  return new LlmAgent({
    name: 'gambit_adversary',
    description:
      'Plays the counterparty in a TRAIN session, replying in persona and consistent with the sealed negotiation state — which it cannot change.',
    model: createModel('ADVERSARY'),
    instruction,
    includeContents: 'none',
    outputSchema: adversaryOutputSchema,
  });
}
