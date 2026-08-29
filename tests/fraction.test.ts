import { describe, expect, it } from 'vitest';
import { Fraction, sumFractions } from '../src/lib/fraction';

/**
 * These tests defend the property the fleet's determinism rests on: exact
 * rational arithmetic with a canonical representation. If two equal rationals
 * could serialise to different strings, the fleet seal would be unstable.
 */

describe('Fraction — construction and reduction', () => {
  it('reduces to lowest terms', () => {
    expect(Fraction.of(2, 4).toString()).toBe('1/2');
    expect(Fraction.of(50, 100).toString()).toBe('1/2');
    expect(Fraction.of(9, 3).toString()).toBe('3/1');
  });

  it('carries sign on the numerator and canonicalises it', () => {
    expect(Fraction.of(1, -2).toString()).toBe('-1/2');
    expect(Fraction.of(-1, -2).toString()).toBe('1/2');
  });

  it('gives one canonical string to equal rationals — the seal invariant', () => {
    const a = Fraction.of(1, 3).add(Fraction.of(1, 6)); // 1/2
    const b = Fraction.of(2, 4);
    expect(a.toString()).toBe(b.toString());
    expect(a.eq(b)).toBe(true);
  });

  it('rejects a zero denominator', () => {
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
  });
});

describe('Fraction — arithmetic is exact', () => {
  it('adds without the 0.1 + 0.2 float error', () => {
    const r = Fraction.of(1, 10).add(Fraction.of(2, 10));
    expect(r.toString()).toBe('3/10');
    // The whole reason this type exists: 0.1 + 0.2 !== 0.3 in floats.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('multiplies, divides and subtracts exactly', () => {
    expect(Fraction.of(2, 3).mul(Fraction.of(3, 4)).toString()).toBe('1/2');
    expect(Fraction.of(1, 2).div(Fraction.of(1, 4)).toString()).toBe('2/1');
    expect(Fraction.of(3, 4).sub(Fraction.of(1, 4)).toString()).toBe('1/2');
  });

  it('divides by zero loudly rather than yielding Infinity', () => {
    expect(() => Fraction.of(1, 2).div(Fraction.ZERO)).toThrow(RangeError);
  });

  it('sums a list exactly, empty sum is zero', () => {
    expect(sumFractions([]).toString()).toBe('0/1');
    expect(
      sumFractions([Fraction.of(1, 6), Fraction.of(1, 6), Fraction.of(1, 6)]).toString(),
    ).toBe('1/2');
  });
});

describe('Fraction — comparison and clamping', () => {
  it('orders correctly across denominators', () => {
    expect(Fraction.of(2, 3).gt(Fraction.of(3, 5))).toBe(true);
    expect(Fraction.of(3, 4).gte(Fraction.of(3, 4))).toBe(true);
    expect(Fraction.min(Fraction.of(1, 3), Fraction.of(1, 4)).toString()).toBe('1/4');
    expect(Fraction.max(Fraction.of(1, 3), Fraction.of(1, 4)).toString()).toBe('1/3');
  });

  it('clamps into [0, 1]', () => {
    expect(Fraction.of(3, 2).clamp01().toString()).toBe('1/1');
    expect(Fraction.of(-1, 2).clamp01().toString()).toBe('0/1');
    expect(Fraction.of(1, 2).clamp01().toString()).toBe('1/2');
  });
});

describe('Fraction — display helpers are lossy by design', () => {
  it('rounds to an integer percentage', () => {
    expect(Fraction.of(1, 2).toPercent()).toBe(50);
    expect(Fraction.of(3, 4).toPercent()).toBe(75);
    expect(Fraction.of(1, 3).toPercent()).toBe(33);
    expect(Fraction.of(2, 3).toPercent()).toBe(67);
    expect(Fraction.of(0, 1).toPercent()).toBe(0);
    expect(Fraction.of(1, 1).toPercent()).toBe(100);
  });
});
