import type { ReadOutput } from '../schemas/read_schema';

/**
 * GAMBIT YourMove — deterministic READ fixture.
 *
 * PURPOSE, STATED NARROWLY: this exists so Day 1 ends with something
 * clickable before any credentials are wired, and so the demo has a rehearsed
 * path that does not depend on the venue wifi.
 *
 * IT IS NEVER A SILENT FALLBACK. Mock mode is entered only when
 * `GAMBIT_MOCK=true` is set explicitly. It is never entered because a key was
 * missing or a call timed out — those surface as errors. Every response
 * carries `mode: 'mock' | 'live'`, and the UI renders a visible badge when the
 * value is 'mock'. A judge watching the demo can always tell which one they
 * are looking at.
 */

export const READ_FIXTURE: ReadOutput = {
  likelyTactic: 'Manufactured urgency',
  confidence: 'Medium',
  manipulationSeverity: 13,
  evidence: [
    'I need an answer by end of day tomorrow',
    'this is really the best we can do',
  ],
  subtext:
    'The deadline is being used to stop you from comparing this against anything else. Notice that no reason for the deadline is given.',
  alternatives: [
    {
      tactic: 'Genuine internal constraint',
      why: 'A real approval window can produce identical wording. Nothing here distinguishes an invented deadline from a reported one.',
    },
    {
      tactic: 'Final-offer anchoring',
      why: '"the best we can do" frames the number as fixed, which may matter more than the deadline itself.',
    },
  ],
  leverageAssessment: {
    userPosition:
      'Not visible from this message alone. Nothing in the text reveals whether you have an alternative or how much time you actually have.',
    opponentPosition:
      'Asserted as constrained, not demonstrated. The message claims a limit without evidence of one.',
    primaryRisk:
      'Answering inside their timeframe and treating their deadline as your deadline.',
  },
};

export function isMockMode(): boolean {
  return (process.env.GAMBIT_MOCK ?? '').toLowerCase() === 'true';
}
