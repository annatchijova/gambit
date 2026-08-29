/**
 * GAMBIT YourMove — site-level constants.
 *
 * One place for the external links and the stack line, so the nav, the footer
 * and the architecture page cannot drift out of agreement.
 */

export const REPO_URL = 'https://github.com/annatchijova/gambit';
export const LIVE_URL = 'https://gambit-yourmove-1028999311218.us-central1.run.app';

export const STACK = ['Gemini 3.5', 'Vertex AI', 'Next.js 16', 'Google ADK', 'TypeScript'] as const;

/** The sibling detection tools this architecture is ported from. */
export const LINEAGE = [
  { name: 'ARGOS', note: '11 philosophical frameworks' },
  { name: 'corvus', note: 'adaptive baselines, zero-float scoring' },
  { name: 'wolf-and-cronos', note: 'corroboration gate, tamper-evident chain' },
] as const;
