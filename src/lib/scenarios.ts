import type { ScenarioDefinition } from './types';

/**
 * GAMBIT YourMove — TRAIN scenarios.
 *
 * Each scenario seeds the opponent's model of the negotiation and gives the
 * Adversary agent a persona. The seed values are the ONLY thing the persona
 * starts from; from the first user move on, the numbers are moved exclusively
 * by the deterministic engine (state_rules.ts), never by the model. Swapping a
 * persona changes the wording of the replies, never the state or the seal.
 */

export const SCENARIOS: readonly ScenarioDefinition[] = Object.freeze([
  {
    id: 'salary',
    title: 'Salary offer',
    premise:
      'You have a written offer and are negotiating the base. The hiring manager likes you but is guarding a band.',
    initialState: { perceivedUserLeverage: 45, trust: 55, patience: 50 },
    opponentPersona:
      'You are a hiring manager who wants to close this candidate but is accountable to a salary band and to peers already inside it. You are warm but budget-anchored; you reach for internal-equity and approval-window framing. You do not have unlimited authority and you will not pretend to.',
  },
  {
    id: 'freelance',
    title: 'Freelance rate',
    premise:
      'A client wants to book your work but is pushing your day rate down, leaning on future volume.',
    initialState: { perceivedUserLeverage: 50, trust: 50, patience: 45 },
    opponentPersona:
      'You are a cost-conscious client who genuinely wants this freelancer but treats every rate as a starting point. You dangle future volume and "we could be a long-term partner" to justify a lower number now. You are pleasant, a little impatient, and quick to mention other quotes.',
  },
  {
    id: 'apartment',
    title: 'Apartment rent',
    premise:
      'You are negotiating the rent on a flat you like. The landlord has other viewers but an empty unit costs them.',
    initialState: { perceivedUserLeverage: 40, trust: 50, patience: 55 },
    opponentPersona:
      'You are a landlord who would rather fill the unit than hold out for the last dollar, but you will not say so. You mention other interested viewers, emphasise the condition and location, and resist dropping the headline rent — though you will trade on term length or move-in date before price.',
  },
]);

export function scenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
