import { describe, expect, it } from 'vitest';
import { buildReadVerdict, semanticVoteFromRead } from '../src/lib/read_verdict';
import { verifyFleetSeal, verifyCompositeSeal } from '../src/lib/frameworks';
import type { ReadOutput } from '../src/lib/schemas/read_schema';

/**
 * The route glue: the model's numeric vote becomes a semantic signal and is
 * composed with the sealed deterministic core. These tests pin the two
 * properties the route depends on — the vote is carried through faithfully, and
 * the deterministic core is never affected by whether the model answered.
 */

const MODEL = 'gemini-3.5-flash';

const READ: ReadOutput = {
  likelyTactic: 'Manufactured urgency',
  confidence: 'Medium',
  manipulationSeverity: 14,
  evidence: ['Act now', "won't last"],
  subtext: 'The deadline is being used to prevent comparison.',
  alternatives: [{ tactic: 'Real constraint', why: 'A genuine window can read identically.' }],
  leverageAssessment: {
    userPosition: 'Not visible from this message alone.',
    opponentPosition: 'Asserted as constrained, not demonstrated.',
    primaryRisk: 'Treating their deadline as your deadline.',
  },
};

const MESSAGE =
  "Act now — this is your last chance and the offer won't last. With all due " +
  "respect, you should know better.";

describe('semanticVoteFromRead', () => {
  it('carries the model vote through faithfully', () => {
    const v = semanticVoteFromRead(READ, MODEL);
    expect(v.available).toBe(true);
    expect(v.grid).toBe(14);
    expect(v.severity.toString()).toBe('7/10'); // 14/20 reduced
    expect(v.tactic).toBe('Manufactured urgency');
    expect(v.evidence).toEqual(['Act now', "won't last"]);
    expect(v.model).toBe(MODEL);
  });
});

describe('buildReadVerdict', () => {
  it('folds the model vote into a best-effort composite that verifies', () => {
    const v = buildReadVerdict(MESSAGE, READ, MODEL);
    expect(v.determinismLevel).toBe('best_effort_with_semantic');
    expect(v.requiresRebuild).toBe(true);
    expect(v.semantic?.grid).toBe(14);
    expect(verifyCompositeSeal(v, verifyFleetSeal)).toBe(true);
  });

  it('degrades to the sealed deterministic core when the model did not answer', () => {
    const v = buildReadVerdict(MESSAGE, null, MODEL);
    expect(v.determinismLevel).toBe('deterministic_core');
    expect(v.requiresRebuild).toBe(false);
    // The core verdict is identical whether or not the model was present.
    const withModel = buildReadVerdict(MESSAGE, READ, MODEL);
    expect(v.core).toEqual(withModel.core);
    expect(verifyFleetSeal(v.core)).toBe(true);
  });

  it('is deterministic given the same message and read', () => {
    expect(buildReadVerdict(MESSAGE, READ, MODEL)).toEqual(buildReadVerdict(MESSAGE, READ, MODEL));
  });

  it('is JSON-serialisable — no bigint/Fraction leaks into the wire type', () => {
    // NextResponse.json calls JSON.stringify, which THROWS on a BigInt. The
    // verdict must be fully flattened (exact values as "n/d" strings) before it
    // crosses the response boundary. This guards both the available and the
    // degraded shapes.
    expect(() => JSON.stringify(buildReadVerdict(MESSAGE, READ, MODEL))).not.toThrow();
    expect(() => JSON.stringify(buildReadVerdict(MESSAGE, null, MODEL))).not.toThrow();
    const wire = JSON.parse(JSON.stringify(buildReadVerdict(MESSAGE, READ, MODEL)));
    expect(wire.semantic.severity).toBe('7/10');
    expect(wire.core.score).toMatch(/^-?\d+\/\d+$/);
  });
});
