/**
 * GAMBIT YourMove — timeout, retry and honest degradation.
 *
 * ============================================================================
 * DAY-1 SPIKE FINDING (see docs/day-01-spike.md) — this is why the file
 * is shaped the way it is.
 * ============================================================================
 *
 * The open question from the plan was: "does @google/adk give native control
 * over timeout and retry, or do we wrap it ourselves?" Inspecting the shipped
 * type definitions of @google/adk@1.6.0 resolved it as a SPLIT answer:
 *
 *   TIMEOUT  → native. `Runner.runAsync()` accepts an `abortSignal`, so a
 *              deadline is enforced by the SDK itself. We create the
 *              AbortController; we do NOT race a dangling promise, which
 *              would leave the underlying request running and still billed.
 *
 *   RETRY    → NOT native. There is no retry, backoff or attempt option
 *              anywhere in RunnerConfig, RunConfig or GeminiParams. The
 *              retry policy below is ours, implemented on top.
 *
 * Recording the split matters: the plan previously assumed ADK provided both.
 * Half of that assumption was wrong, and it was wrong in the direction that
 * would have shipped with no retry at all.
 *
 * ============================================================================
 * DEGRADATION POLICY
 * ============================================================================
 *
 * Every call returns an `Outcome<T>` discriminated union. There is no
 * "return null and hope the caller checks", and no catch-all that lets a
 * failed model call flow onward as if it had succeeded. When the model does
 * not answer in time, the user is told the model did not answer in time. The
 * one thing this system must never do is show a confident tactical read that
 * was actually a fallback.
 */

export const TIMEOUTS = {
  /**
   * Critical path — the user is on screen, blocked, waiting.
   * READ, THINK, TRAIN/Adversary.
   */
  CRITICAL_MS: 3_500,
  /**
   * Non-blocking path — result renders after the critical response.
   * TRAIN/Coach, SCORE narration.
   */
  BACKGROUND_MS: 5_000,
} as const;

export const RETRY = {
  /** Total attempts, including the first. 2 = one retry. */
  MAX_ATTEMPTS: 2,
  /** Base delay before the retry. */
  BASE_DELAY_MS: 250,
  /** Multiplier per additional attempt (exponential). */
  FACTOR: 2,
  /**
   * Full jitter in [0, JITTER_MS). Spreads retries so a transient upstream
   * hiccup does not turn into a synchronised second wave.
   */
  JITTER_MS: 200,
} as const;

export type FailureKind =
  /** Deadline hit before a response arrived. */
  | 'timeout'
  /** Upstream answered with an error (quota, auth, 5xx, blocked host). */
  | 'upstream'
  /** Upstream answered, but the payload did not satisfy the schema. */
  | 'invalid_response'
  /** Local misconfiguration — missing key, wrong project. Never retried. */
  | 'config';

export interface Failure {
  kind: FailureKind;
  /** Upstream status or SDK error code, when one was reported. */
  code?: string;
  /** Safe to show a user. Never contains the API key or raw payloads. */
  message: string;
  retryable: boolean;
}

export type Outcome<T> =
  | { ok: true; value: T; attempts: number; elapsedMs: number }
  | { ok: false; failure: Failure; attempts: number; elapsedMs: number };

/**
 * A failure raised by an inner call that already knows its own shape.
 * `callWithPolicy` unwraps this instead of guessing from a message string.
 */
export class GambitCallError extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    super(failure.message);
    this.name = 'GambitCallError';
    this.failure = failure;
  }
}

export interface CallPolicy {
  /** Deadline per attempt, in milliseconds. */
  timeoutMs: number;
  /** Total attempts including the first. */
  maxAttempts: number;
}

export const CRITICAL_POLICY: CallPolicy = {
  timeoutMs: TIMEOUTS.CRITICAL_MS,
  maxAttempts: RETRY.MAX_ATTEMPTS,
};

export const BACKGROUND_POLICY: CallPolicy = {
  timeoutMs: TIMEOUTS.BACKGROUND_MS,
  maxAttempts: RETRY.MAX_ATTEMPTS,
};

function backoffDelayMs(attemptIndex: number, rand: () => number): number {
  const base = RETRY.BASE_DELAY_MS * RETRY.FACTOR ** (attemptIndex - 1);
  return base + Math.floor(rand() * RETRY.JITTER_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalise anything thrown into a `Failure`.
 *
 * Deliberately conservative: an unrecognised error is reported as an upstream
 * failure that IS retryable exactly once, rather than being swallowed.
 */
export function toFailure(err: unknown): Failure {
  if (err instanceof GambitCallError) return err.failure;

  if (err instanceof Error && err.name === 'AbortError') {
    return {
      kind: 'timeout',
      message: 'The model did not respond before the deadline.',
      retryable: true,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  const status = /\b(4\d{2}|5\d{2})\b/.exec(message)?.[1];

  // 4xx other than 408/429 means the request itself is wrong. Retrying an
  // invalid API key just burns the user's deadline twice.
  const retryable = !status || status === '408' || status === '429' || status.startsWith('5');

  return {
    kind: status && !retryable ? 'config' : 'upstream',
    code: status,
    message:
      status === '401' || status === '403'
        ? 'The Gemini credentials were rejected. Check GEMINI_API_KEY or the Vertex AI project settings.'
        : `Upstream call failed${status ? ` (${status})` : ''}.`,
    retryable,
  };
}

export interface CallWithPolicyArgs<T> {
  /** Short stable identifier used in telemetry, e.g. 'read'. */
  name: string;
  policy: CallPolicy;
  /**
   * The work. MUST honour `signal` — ADK's `runAsync` does, via its own
   * `abortSignal` parameter. A function that ignores the signal will still be
   * reported as timed out, but the underlying request will keep running.
   */
  run: (signal: AbortSignal) => Promise<T>;
  /** Injectable for deterministic tests. Defaults to Math.random. */
  rand?: () => number;
  /** Injectable for deterministic tests. Defaults to Date.now. */
  now?: () => number;
  /** Injectable for deterministic tests. Defaults to real setTimeout. */
  delay?: (ms: number) => Promise<void>;
}

/**
 * Run one upstream call under a deadline, with at most one retry.
 *
 * Never throws. Returns an `Outcome`, so the caller is forced by the type
 * system to handle the failure branch before touching a value.
 */
export async function callWithPolicy<T>({
  policy,
  run,
  rand = Math.random,
  now = Date.now,
  delay = sleep,
}: CallWithPolicyArgs<T>): Promise<Outcome<T>> {
  const startedAt = now();
  let lastFailure: Failure = {
    kind: 'upstream',
    message: 'Call was never attempted.',
    retryable: false,
  };

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException('deadline', 'AbortError')),
      policy.timeoutMs,
    );

    try {
      const value = await run(controller.signal);
      clearTimeout(timer);
      return { ok: true, value, attempts: attempt, elapsedMs: now() - startedAt };
    } catch (err) {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted
        ? {
            kind: 'timeout',
            message: `The model did not respond within ${policy.timeoutMs} ms.`,
            retryable: true,
          }
        : toFailure(err);

      if (!lastFailure.retryable || attempt === policy.maxAttempts) {
        return {
          ok: false,
          failure: lastFailure,
          attempts: attempt,
          elapsedMs: now() - startedAt,
        };
      }
      await delay(backoffDelayMs(attempt, rand));
    }
  }

  return {
    ok: false,
    failure: lastFailure,
    attempts: policy.maxAttempts,
    elapsedMs: now() - startedAt,
  };
}

/** Exported for tests that assert the backoff schedule. */
export const __testing = { backoffDelayMs };
