import { describe, expect, it } from 'vitest';
import { runFleet, verifyFleetSeal, CORROBORATION_THRESHOLD } from '../src/lib/frameworks';

/**
 * These tests defend the three guarantees the fleet actually makes — the same
 * three the state engine makes, because it is the same architecture:
 *
 *   DETERMINISM   — same message, same verdict, same seal, always.
 *   CORROBORATION — one lens firing is noise; a non-CLEAN verdict needs >= 2.
 *   HONEST DEGRADATION / SEAL — the verdict is sealed before any model runs and
 *                   an independent verifier can prove it was not altered.
 *
 * They do NOT claim the lenses are accurate. Accuracy is an empirical question
 * for a labelled corpus, not something a unit test can assert.
 */

// Fires Cialdini (urgency + scarcity + authority), Aristotle (pathos, no
// logos), Berne (ulterior + critical parent) and Grice (unfalsifiable) at once.
const HEAVY =
  "Act now — this is your last chance and the offer won't last. With all due " +
  "respect, but you should know better; you'll regret it if you miss out. " +
  "Trust me, I've been doing this for years.";

// A message that pulls exactly one lever: scarcity, nothing else.
const SINGLE_LEVER = 'Only a few spots left.';

// A reasoned, quotable message with no manipulation signature.
const CLEAN =
  'The market rate for this role is 95k based on the latest comparable data. ' +
  'Here are the figures for your review.';

describe('corroboration gate', () => {
  it('forces CLEAN when fewer than the threshold of lenses fire', () => {
    const v = runFleet(SINGLE_LEVER);
    expect(v.corroboration).toBeLessThan(CORROBORATION_THRESHOLD);
    expect(v.gatePassed).toBe(false);
    expect(v.level).toBe('CLEAN');
    // The score is not even consulted below the gate: it stays at zero.
    expect(v.score).toBe('0/1');
  });

  it('returns CLEAN with the whole fleet quiet on a reasoned message', () => {
    const v = runFleet(CLEAN);
    expect(v.gatePassed).toBe(false);
    expect(v.level).toBe('CLEAN');
    expect(v.confidence).toBe('High');
    expect(v.crashedFrameworks).toEqual([]);
  });

  it('convicts only when several independent lenses agree', () => {
    const v = runFleet(HEAVY);
    expect(v.gatePassed).toBe(true);
    expect(v.corroboration).toBeGreaterThanOrEqual(3);
    expect(['PERSUASIVE', 'MANIPULATIVE']).toContain(v.level);
    expect(v.confidence).toBe('High');
  });
});

describe('determinism', () => {
  it('produces an identical verdict and seal across runs', () => {
    const a = runFleet(HEAVY);
    const b = runFleet(HEAVY);
    expect(a).toEqual(b);
    expect(a.seal).toBe(b.seal);
  });

  it('keeps the score as an exact rational string, never a float', () => {
    const v = runFleet(HEAVY);
    expect(typeof v.score).toBe('string');
    expect(v.score).toMatch(/^-?\d+\/\d+$/);
    expect(Number.isInteger(v.scorePercent)).toBe(true);
    for (const s of v.signals) {
      expect(s.severity).toMatch(/^-?\d+\/\d+$/);
    }
  });
});

describe('seal integrity', () => {
  it('verifies its own seal', () => {
    const v = runFleet(HEAVY);
    expect(verifyFleetSeal(v)).toBe(true);
  });

  it('detects tampering with the sealed score', () => {
    const v = runFleet(HEAVY);
    const tampered = { ...v, score: '1/1', scorePercent: 100 };
    expect(verifyFleetSeal(tampered)).toBe(false);
  });

  it('detects tampering with a lens severity', () => {
    const v = runFleet(HEAVY);
    const signals = v.signals.map((s, i) =>
      i === 0 ? { ...s, severity: '1/1' } : s,
    );
    expect(verifyFleetSeal({ ...v, signals })).toBe(false);
  });
});

describe('evidence discipline', () => {
  it('quotes verbatim — every evidence span is present in the message', () => {
    const v = runFleet(HEAVY);
    const haystack = HEAVY.toLowerCase();
    const quoted = v.signals.flatMap((s) => s.evidence);
    expect(quoted.length).toBeGreaterThan(0);
    for (const span of quoted) {
      expect(haystack).toContain(span.toLowerCase());
    }
  });

  it('records silent and active lenses without overlap', () => {
    const v = runFleet(HEAVY);
    const overlap = v.activeFrameworks.filter((f) => v.silentFrameworks.includes(f));
    expect(overlap).toEqual([]);
    // Every lens that voted lands in exactly one of active/silent; crashed
    // lenses are tracked separately and do not appear in signals.
    expect(v.activeFrameworks.length + v.silentFrameworks.length).toBe(v.signals.length);
  });
});
