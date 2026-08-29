import { describe, expect, it } from 'vitest';
import {
  runFleet,
  verifyFleetSeal,
  composeVerdict,
  verifyCompositeSeal,
  semanticVote,
  unavailableSemantic,
  severityFromGrid,
  SEMANTIC_GRID,
} from '../src/lib/frameworks';

/**
 * The composite layer is where the language model becomes a voting analyst. Its
 * whole reason to exist is to do that WITHOUT lying about determinism, so these
 * tests defend exactly that boundary:
 *
 *   - an absent/unavailable model vote degrades to the sealed core, unchanged;
 *   - a present model vote is flagged best_effort / requiresRebuild;
 *   - the model can raise an alert the lexical lenses missed;
 *   - core-vs-model divergence is surfaced, not averaged away;
 *   - the composite is deterministic GIVEN its inputs, and its seal verifies.
 */

const HEAVY =
  "Act now — this is your last chance and the offer won't last. With all due " +
  "respect, but you should know better; you'll regret it if you miss out. " +
  "Trust me, I've been doing this for years.";

const CLEAN =
  'The market rate for this role is 95k based on the latest comparable data. ' +
  'Here are the figures for your review.';

const MODEL = 'gemini-3.5-flash';

describe('severityFromGrid', () => {
  it('snaps to the grid and clamps out-of-range votes', () => {
    expect(severityFromGrid(10).toString()).toBe('1/2');
    expect(severityFromGrid(0).toString()).toBe('0/1');
    expect(severityFromGrid(SEMANTIC_GRID).toString()).toBe('1/1');
    expect(severityFromGrid(999).toString()).toBe('1/1'); // clamped, not rejected
    expect(severityFromGrid(-5).toString()).toBe('0/1');
  });
});

describe('composite — honest degradation when the model is silent', () => {
  it('mirrors the sealed core when the vote is unavailable', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, unavailableSemantic(MODEL));
    expect(c.determinismLevel).toBe('deterministic_core');
    expect(c.requiresRebuild).toBe(false);
    expect(c.level).toBe(core.level);
    expect(c.score).toBe(core.score);
    expect(c.divergence).toBeNull();
  });

  it('treats a null vote the same way — the core is never degraded', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, null);
    expect(c.determinismLevel).toBe('deterministic_core');
    expect(c.score).toBe(core.score);
  });
});

describe('composite — the model as a voting analyst', () => {
  it('flags best_effort and requiresRebuild once the model votes', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, semanticVote({ grid: 16, tactic: 'Manufactured urgency', evidence: ['Act now'], model: MODEL }));
    expect(c.determinismLevel).toBe('best_effort_with_semantic');
    expect(c.requiresRebuild).toBe(true);
    expect(c.semantic?.available).toBe(true);
  });

  it('lets the model raise an alert the lexical lenses missed', () => {
    // A paraphrased threat the rules do not catch: core is CLEAN...
    const core = runFleet(CLEAN);
    expect(core.level).toBe('CLEAN');
    // ...but the model reads it as strongly manipulative.
    const c = composeVerdict(core, semanticVote({ grid: 20, tactic: 'Veiled threat', evidence: [], model: MODEL }));
    expect(c.level).not.toBe('CLEAN');
    expect(c.divergence?.agree).toBe(false);
    expect(c.confidence).toBe('Low'); // a clean/not-clean split is low confidence, and shown
  });

  it('reports High confidence when core and model independently agree', () => {
    const core = runFleet(HEAVY);
    const semanticLevelMatchesCore = severityFromGrid(15); // PERSUASIVE-ish
    expect(semanticLevelMatchesCore.toString()).toBe('3/4');
    // Pick a grid whose level matches the core's level for this message.
    const c = composeVerdict(core, semanticVote({ grid: 14, tactic: 'Pressure stack', evidence: ['last chance'], model: MODEL }));
    if (c.divergence?.agree) expect(c.confidence).toBe('High');
    else expect(['Low', 'Medium']).toContain(c.confidence);
  });
});

describe('composite — determinism and seal', () => {
  it('is deterministic given identical inputs', () => {
    const core = runFleet(HEAVY);
    const vote = semanticVote({ grid: 12, tactic: 'Urgency', evidence: ['Act now'], model: MODEL });
    expect(composeVerdict(core, vote)).toEqual(composeVerdict(core, vote));
  });

  it('keeps the composite score an exact rational string', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, semanticVote({ grid: 13, tactic: 'x', evidence: [], model: MODEL }));
    expect(c.score).toMatch(/^-?\d+\/\d+$/);
  });

  it('verifies its own seal, including the embedded core seal', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, semanticVote({ grid: 16, tactic: 'x', evidence: ['Act now'], model: MODEL }));
    expect(verifyCompositeSeal(c, verifyFleetSeal)).toBe(true);
  });

  it('detects tampering with the composite score', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, semanticVote({ grid: 16, tactic: 'x', evidence: [], model: MODEL }));
    expect(verifyCompositeSeal({ ...c, score: '1/1' }, verifyFleetSeal)).toBe(false);
  });

  it('detects tampering with the model vote after sealing', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, semanticVote({ grid: 16, tactic: 'x', evidence: [], model: MODEL }));
    const tampered = { ...c, semantic: c.semantic ? { ...c.semantic, grid: 1 } : null };
    expect(verifyCompositeSeal(tampered, verifyFleetSeal)).toBe(false);
  });

  it('fails verification if the deterministic core was tampered with', () => {
    const core = runFleet(HEAVY);
    const c = composeVerdict(core, unavailableSemantic(MODEL));
    const tamperedCore = { ...c, core: { ...c.core, score: '1/1' } };
    expect(verifyCompositeSeal(tamperedCore, verifyFleetSeal)).toBe(false);
  });
});
