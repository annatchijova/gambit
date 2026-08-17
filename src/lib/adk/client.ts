import 'server-only';
import {
  Gemini,
  InMemorySessionService,
  Runner,
  isFinalResponse,
  type Event,
  type LlmAgent,
} from '@google/adk';
import { getServerEnv } from '../env';
import { MODELS, assertModelFloor, type ModelRole } from '../models';
import { GambitCallError, type Failure } from '../resilience';

/**
 * GAMBIT YourMove — ADK runtime seam.
 *
 * ============================================================================
 * DAY-1 SPIKE FINDING — THE IMPORTANT ONE
 * ============================================================================
 *
 * `Runner.runAsync()` does NOT throw when the model call fails.
 *
 * Verified empirically against @google/adk@1.6.0: a run with an invalid key
 * completed normally and yielded a single event carrying
 * `errorCode: '403'` and an `errorMessage`, with no `content`. The async
 * generator then finished cleanly. Session state was still committed.
 *
 * The consequence is severe and easy to miss: the obvious implementation —
 * wrap `for await (...)` in try/catch, collect text, return it — treats a
 * hard upstream failure as a successful run that produced an empty string.
 * That is exactly the silent-degradation failure this project claims not to
 * have. It would have shipped, and it would have surfaced on stage as an
 * empty tactical read rather than as an error.
 *
 * `collectFinalText` below therefore inspects every event for `errorCode`
 * and converts it into a thrown `GambitCallError`, which `callWithPolicy`
 * turns into a typed failure. An empty run with no error event is also
 * treated as a failure, not as an empty success.
 *
 * SESSION STORE
 * `InMemorySessionService` is per-instance and lost on restart. Correct for
 * a single-instance demo; it is the first thing to swap (for
 * `DatabaseSessionService`) if this ever runs multi-instance on Cloud Run.
 * Stated here so nobody later mistakes it for a durability guarantee.
 */

export const APP_NAME = 'gambit-yourmove';

let sessionServiceSingleton: InMemorySessionService | null = null;

export function getSessionService(): InMemorySessionService {
  sessionServiceSingleton ??= new InMemorySessionService();
  return sessionServiceSingleton;
}

/**
 * Build a Gemini model handle for a given module.
 *
 * Credentials come from `getServerEnv()` rather than from ambient env lookup
 * inside the SDK, so a misconfiguration fails with our named error at a known
 * point instead of surfacing as an opaque 401 three layers down.
 */
export function createModel(role: ModelRole): Gemini {
  assertModelFloor();
  const env = getServerEnv();
  const model = MODELS[role];

  return env.backend === 'vertex-ai'
    ? new Gemini({ model, vertexai: true, project: env.project, location: env.location })
    : new Gemini({ model, apiKey: env.apiKey });
}

function failureFromEvent(event: Event): Failure {
  const code = event.errorCode;
  const retryable =
    !code || code === '408' || code === '429' || /^5\d{2}$/.test(code);

  return {
    kind: code === '401' || code === '403' ? 'config' : 'upstream',
    code,
    message:
      code === '401' || code === '403'
        ? 'The Gemini credentials were rejected. Check GEMINI_API_KEY, or the Vertex AI project and location.'
        : `The model returned an error${code ? ` (${code})` : ''}.`,
    retryable,
  };
}

export interface RunAgentArgs {
  agent: LlmAgent;
  userId: string;
  sessionId: string;
  message: string;
  /**
   * Pre-computed state, handed to the agent as an established fact.
   *
   * This is the integration point for the deterministic engine: state_rules.ts
   * decides the numbers, they are written here, and the agent is only ever
   * asked to phrase a reply consistent with them. The agent has no tool and no
   * instruction that lets it write these values back.
   */
  stateDelta?: Record<string, unknown>;
  /** Deadline signal from `callWithPolicy`. ADK honours it natively. */
  signal: AbortSignal;
}

/**
 * Run an agent to completion and return its final text.
 *
 * @throws {GambitCallError} on an ADK error event, on an aborted run, or on a
 *   run that produced no final content. Never returns a placeholder.
 */
export async function collectFinalText({
  agent,
  userId,
  sessionId,
  message,
  stateDelta,
  signal,
}: RunAgentArgs): Promise<string> {
  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService: getSessionService(),
  });

  let finalText: string | null = null;

  for await (const event of runner.runAsync({
    userId,
    sessionId,
    newMessage: { role: 'user', parts: [{ text: message }] },
    stateDelta,
    abortSignal: signal,
  })) {
    if (event.errorCode || event.errorMessage) {
      throw new GambitCallError(failureFromEvent(event));
    }
    if (event.partial) continue;
    if (isFinalResponse(event) && event.content?.parts) {
      const text = event.content.parts
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      if (text) finalText = text;
    }
  }

  if (signal.aborted) {
    throw new GambitCallError({
      kind: 'timeout',
      message: 'The model did not respond before the deadline.',
      retryable: true,
    });
  }

  if (finalText === null) {
    // An empty run is a failure, not an empty success. Returning '' here
    // would let the UI render a blank, confident-looking card.
    throw new GambitCallError({
      kind: 'invalid_response',
      message: 'The model completed without producing any content.',
      retryable: true,
    });
  }

  return finalText;
}

/** Ensure a session exists, creating it with the given seed state if not. */
export async function ensureSession(
  userId: string,
  sessionId: string,
  state: Record<string, unknown> = {},
): Promise<void> {
  const service = getSessionService();
  const existing = await service.getSession({
    appName: APP_NAME,
    userId,
    sessionId,
  });
  if (!existing) {
    await service.createSession({ appName: APP_NAME, userId, sessionId, state });
  }
}
