/**
 * GAMBIT YourMove — latency telemetry.
 *
 * The plan's p50 ≤ 1.8 s / p95 ≤ 2.5 s figures are a HYPOTHESIS, not a
 * promise. Nothing in this file enforces them; it exists so that on Day 5 and
 * again on Day 13 there is a real number to compare against, and so that a
 * missed target is a measurement rather than an excuse.
 *
 * Scope, stated plainly: an in-process ring buffer. It is per-instance, it is
 * lost on restart, and on Cloud Run with more than one instance each instance
 * reports only its own traffic. That is sufficient for a single-developer
 * benchmark run and is NOT a production observability story. Do not present
 * it as one.
 */

const RING_CAPACITY = 512;

export interface Sample {
  /** Route identifier, e.g. 'read'. */
  route: string;
  /** Wall-clock duration of the whole handler, in milliseconds. */
  ms: number;
  ok: boolean;
  attempts: number;
  /** Failure kind when !ok. */
  failure?: string;
}

const rings = new Map<string, Sample[]>();

export function record(sample: Sample): void {
  const ring = rings.get(sample.route) ?? [];
  ring.push(sample);
  if (ring.length > RING_CAPACITY) ring.shift();
  rings.set(sample.route, ring);
}

/**
 * Nearest-rank percentile on the sorted sample set.
 *
 * Nearest-rank rather than interpolated: with a few dozen samples,
 * interpolation invents a latency that was never observed, and the whole
 * point of this file is to report observations.
 */
export function percentile(sortedMs: number[], p: number): number | null {
  if (sortedMs.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedMs.length);
  return sortedMs[Math.min(Math.max(rank, 1), sortedMs.length) - 1];
}

export interface RouteStats {
  route: string;
  count: number;
  okCount: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
  failures: Record<string, number>;
}

export function stats(route: string): RouteStats {
  const ring = rings.get(route) ?? [];
  const okSamples = ring.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const failures: Record<string, number> = {};
  for (const s of ring) {
    if (!s.ok) failures[s.failure ?? 'unknown'] = (failures[s.failure ?? 'unknown'] ?? 0) + 1;
  }
  return {
    route,
    count: ring.length,
    okCount: okSamples.length,
    p50: percentile(okSamples, 50),
    p95: percentile(okSamples, 95),
    max: okSamples.length ? okSamples[okSamples.length - 1] : null,
    failures,
  };
}

export function allStats(): RouteStats[] {
  return [...rings.keys()].sort().map(stats);
}

export function reset(): void {
  rings.clear();
}

/**
 * Time a handler and record the sample.
 *
 * Records failures too — a route that is fast only because it errors out
 * early would otherwise look like a win.
 */
export async function timed<T>(
  route: string,
  fn: () => Promise<{ result: T; ok: boolean; attempts: number; failure?: string }>,
): Promise<T> {
  const t0 = performance.now();
  try {
    const { result, ok, attempts, failure } = await fn();
    record({ route, ms: Math.round(performance.now() - t0), ok, attempts, failure });
    return result;
  } catch (err) {
    record({ route, ms: Math.round(performance.now() - t0), ok: false, attempts: 1, failure: 'unhandled' });
    throw err;
  }
}
