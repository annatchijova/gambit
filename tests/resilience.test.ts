import { describe, expect, it, vi } from 'vitest';
import {
  CRITICAL_POLICY,
  GambitCallError,
  RETRY,
  TIMEOUTS,
  callWithPolicy,
  toFailure,
} from '../src/lib/resilience';

/** Deterministic substitutes so the schedule is asserted, not observed. */
const fixedRand = () => 0.5;
const noDelay = vi.fn(async () => {});

describe('policy constants match the architecture doc', () => {
  it('uses 20 s on the critical path and 5.0 s in the background', () => {
    // CRITICAL_MS was raised from an untested 3.5 s aspiration to 20 s after a
    // live structured READ via Vertex measured ~10-14 s (see docs/journal.md).
    expect(TIMEOUTS.CRITICAL_MS).toBe(20_000);
    expect(TIMEOUTS.BACKGROUND_MS).toBe(5_000);
  });

  it('allows exactly one retry', () => {
    expect(RETRY.MAX_ATTEMPTS).toBe(2);
  });
});

describe('callWithPolicy', () => {
  it('returns the value on a first-attempt success', async () => {
    const out = await callWithPolicy({
      name: 't',
      policy: CRITICAL_POLICY,
      run: async () => 'ok',
      rand: fixedRand,
      delay: noDelay,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value).toBe('ok');
      expect(out.attempts).toBe(1);
    }
  });

  it('retries a retryable failure exactly once, then reports it', async () => {
    const run = vi.fn(async () => {
      throw new GambitCallError({ kind: 'upstream', message: '503', retryable: true });
    });
    const out = await callWithPolicy({
      name: 't',
      policy: CRITICAL_POLICY,
      run,
      rand: fixedRand,
      delay: noDelay,
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.attempts).toBe(2);
  });

  it('does not retry a non-retryable failure — a bad key must not burn the deadline twice', async () => {
    const run = vi.fn(async () => {
      throw new GambitCallError({
        kind: 'config',
        code: '403',
        message: 'bad key',
        retryable: false,
      });
    });
    const out = await callWithPolicy({
      name: 't',
      policy: CRITICAL_POLICY,
      run,
      rand: fixedRand,
      delay: noDelay,
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.kind).toBe('config');
  });

  it('aborts a run that exceeds the deadline and reports a timeout', async () => {
    const out = await callWithPolicy({
      name: 't',
      policy: { timeoutMs: 20, maxAttempts: 1 },
      run: (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
      rand: fixedRand,
      delay: noDelay,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.failure.kind).toBe('timeout');
  });

  it('passes an AbortSignal the caller can observe', async () => {
    let seen: AbortSignal | null = null;
    await callWithPolicy({
      name: 't',
      policy: CRITICAL_POLICY,
      run: async (signal) => {
        seen = signal;
        return 1;
      },
      rand: fixedRand,
      delay: noDelay,
    });
    expect(seen).toBeInstanceOf(AbortSignal);
  });

  it('never throws — the failure branch is always a value', async () => {
    const out = await callWithPolicy({
      name: 't',
      policy: { timeoutMs: 50, maxAttempts: 1 },
      run: async () => {
        throw new Error('boom');
      },
      rand: fixedRand,
      delay: noDelay,
    });
    expect(out.ok).toBe(false);
  });
});

describe('toFailure', () => {
  it('treats 5xx and 429 as retryable', () => {
    expect(toFailure(new Error('upstream 503')).retryable).toBe(true);
    expect(toFailure(new Error('quota 429')).retryable).toBe(true);
  });

  it('treats 401/403 as configuration errors that must not be retried', () => {
    const f = toFailure(new Error('request failed 403'));
    expect(f.kind).toBe('config');
    expect(f.retryable).toBe(false);
  });

  it('defaults an unrecognised error to retryable rather than swallowing it', () => {
    expect(toFailure(new Error('socket hang up')).retryable).toBe(true);
  });
});
