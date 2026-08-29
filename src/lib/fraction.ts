/**
 * GAMBIT YourMove — exact rational arithmetic.
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 *
 * The state engine (`state_rules.ts`) keeps its decision path float-free by
 * working in integer 0..100 units. The framework fleet (`frameworks/`) cannot:
 * it computes a WEIGHTED AVERAGE of per-framework severities, and a weighted
 * average is a division. Division of integers is where floats — and with them
 * non-determinism — would enter a sealed value.
 *
 * Python's sibling projects (ARGOS, corvus, wolf-and-cronos) solve this with
 * `fractions.Fraction`: every severity, weight and aggregate is an exact
 * numerator/denominator pair, so the same inputs produce the same rational
 * bit-for-bit, and the seal over it is stable across machines and Node
 * versions. TypeScript has no such type, so this is it.
 *
 * INVARIANT: no value that reaches a fleet seal is ever a JS `number` produced
 * by division. `toNumber()` exists for the presentation layer ONLY and is
 * documented as lossy at its call site. If a float can influence the verdict,
 * the determinism claim is void — this is the same rule as the state engine's.
 *
 * Backed by `bigint` so numerators and denominators never overflow as
 * fractions are chained through addition and multiplication.
 */

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * An exact rational, always stored in lowest terms with a non-negative
 * denominator. Immutable: every operation returns a new Fraction.
 */
export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  /**
   * Build a reduced fraction. Sign is carried on the numerator so that two
   * equal rationals always share one canonical (n, d) pair — required for a
   * stable seal.
   */
  static of(numerator: bigint | number, denominator: bigint | number = 1n): Fraction {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) {
      throw new RangeError('[fraction] denominator is zero');
    }
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1n;
    return new Fraction(n / g, d / g);
  }

  static readonly ZERO = Fraction.of(0n);
  static readonly ONE = Fraction.of(1n);

  /**
   * Rebuild a fraction from its canonical "numerator/denominator" string — the
   * inverse of `toString()`. Used to recover an exact sealed score for further
   * exact arithmetic (e.g. composing a verdict) without ever passing through a
   * float. Throws on anything that is not two integers separated by a slash.
   */
  static parse(s: string): Fraction {
    const m = /^(-?\d+)\/(-?\d+)$/.exec(s.trim());
    if (!m) {
      throw new RangeError(`[fraction] not a canonical fraction: ${JSON.stringify(s)}`);
    }
    return Fraction.of(BigInt(m[1]), BigInt(m[2]));
  }

  add(o: Fraction): Fraction {
    return Fraction.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: Fraction): Fraction {
    return Fraction.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o: Fraction): Fraction {
    return Fraction.of(this.n * o.n, this.d * o.d);
  }

  div(o: Fraction): Fraction {
    if (o.n === 0n) {
      throw new RangeError('[fraction] division by zero');
    }
    return Fraction.of(this.n * o.d, this.d * o.n);
  }

  /** Sign of (this - o): -1, 0, or +1. The only comparison primitive. */
  cmp(o: Fraction): -1 | 0 | 1 {
    const lhs = this.n * o.d;
    const rhs = o.n * this.d;
    return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
  }

  gte(o: Fraction): boolean {
    return this.cmp(o) >= 0;
  }

  gt(o: Fraction): boolean {
    return this.cmp(o) > 0;
  }

  lt(o: Fraction): boolean {
    return this.cmp(o) < 0;
  }

  eq(o: Fraction): boolean {
    return this.cmp(o) === 0;
  }

  static min(a: Fraction, b: Fraction): Fraction {
    return a.cmp(b) <= 0 ? a : b;
  }

  static max(a: Fraction, b: Fraction): Fraction {
    return a.cmp(b) >= 0 ? a : b;
  }

  /** Clamp into the closed interval [0, 1]. Severities and scores live here. */
  clamp01(): Fraction {
    if (this.cmp(Fraction.ZERO) < 0) return Fraction.ZERO;
    if (this.cmp(Fraction.ONE) > 0) return Fraction.ONE;
    return this;
  }

  /**
   * Canonical, seal-safe string: "numerator/denominator" in lowest terms.
   * This is what goes into a hashed payload, never `toNumber()`.
   */
  toString(): string {
    return `${this.n}/${this.d}`;
  }

  /**
   * Lossy float for DISPLAY ONLY (percentages, bars). Never feed the result
   * back into a sealed value — that is exactly the leak this module prevents.
   */
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  /** Rounded integer percentage 0..100, for the UI. Presentation only. */
  toPercent(): number {
    // Round half-up on exact integer arithmetic, then narrow to a number.
    const scaled = (this.n * 100n * 2n) / this.d;
    const rounded = (scaled + 1n) / 2n;
    return Number(rounded);
  }
}

/** Sum a list of fractions exactly; empty sum is zero. */
export function sumFractions(xs: readonly Fraction[]): Fraction {
  return xs.reduce((acc, x) => acc.add(x), Fraction.ZERO);
}
