import { describe, expect, it } from 'vitest';
import { buildReadSummary } from '../src/lib/read_verdict';
import { thinkOutputSchema, thinkRequestSchema } from '../src/lib/schemas/think_schema';
import { THINK_FIXTURE } from '../src/lib/mock/think_fixture';

/**
 * THINK is generative, so most of it is only meaningful against a live model.
 * These tests pin the deterministic parts around it: the read summary the drafts
 * are grounded on, the request contract, and the output contract the fixture and
 * the model must both satisfy.
 */

const HEAVY =
  "Act now — this is your last chance and the offer won't last. With all due " +
  "respect, but you should know better. Trust me, I've been doing this for years.";

describe('buildReadSummary', () => {
  it('describes the deterministic read and is stable across runs', () => {
    const a = buildReadSummary(HEAVY);
    const b = buildReadSummary(HEAVY);
    expect(a).toBe(b);
    expect(a).toMatch(/rule engine reads this message as (CLEAN|MIXED|PERSUASIVE|MANIPULATIVE)/);
  });

  it('folds in the READ tactic hint when provided', () => {
    const s = buildReadSummary(HEAVY, { tactic: 'Manufactured urgency', level: 'PERSUASIVE' });
    expect(s).toContain('Manufactured urgency');
  });
});

describe('THINK contracts', () => {
  it('the fixture satisfies the output schema', () => {
    expect(() => thinkOutputSchema.parse(THINK_FIXTURE)).not.toThrow();
  });

  it('offers exactly one of each stance, none ranked', () => {
    const stances = THINK_FIXTURE.options.map((o) => o.stance).sort();
    expect(stances).toEqual(['direct', 'soft', 'tactical']);
    expect(THINK_FIXTURE.options).toHaveLength(3);
  });

  it('accepts a minimal request and the optional read hints', () => {
    expect(thinkRequestSchema.safeParse({ message: 'hi' }).success).toBe(true);
    expect(
      thinkRequestSchema.safeParse({ message: 'hi', readTactic: 'Anchoring', readLevel: 'MIXED' }).success,
    ).toBe(true);
    expect(thinkRequestSchema.safeParse({ message: '' }).success).toBe(false);
  });
});
