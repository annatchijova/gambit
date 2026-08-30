import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdversaryAgent } from '@/lib/adk/adversary_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { isMockMode } from '@/lib/mock/read_fixture';
import { CRITICAL_POLICY, callWithPolicy } from '@/lib/resilience';
import { scenarioById } from '@/lib/scenarios';
import { adversaryOutputSchema } from '@/lib/schemas/adversary_schema';
import { fieldErrors, type ApiErrorBody } from '@/lib/schemas/api_input';
import { trainRequestSchema } from '@/lib/schemas/train_schema';
import { applyMove, initialState, stateHeadConsistent, verifyChain, type Classification } from '@/lib/state_rules';
import { record } from '@/lib/telemetry';
import type { NegotiationState } from '@/lib/types';

/**
 * POST /api/train
 *
 * One turn of a practice negotiation. The deterministic engine reads the user's
 * move, moves and re-seals the state, and only THEN is the Adversary agent asked
 * to reply in persona — consistent with a state it cannot change. The client
 * holds the state between turns; the server re-verifies its seal chain every
 * turn before trusting it.
 */

export interface TrainResponseBody {
  mode: 'live' | 'mock';
  /** The new sealed state. The client sends this back on the next turn. */
  state: NegotiationState;
  /** What the engine made of the user's move. */
  move: {
    moveType: string;
    criterion: string;
    rationale: string;
    applied: { leverage: number; trust: number; patience: number };
  };
  /** The counterparty's reply and disposition. */
  reply: string;
  mood: string;
  /** The transition chain verified intact after this turn. */
  chainValid: boolean;
  meta: { elapsedMs: number; attempts: number };
}

/** Offline persona-neutral reply for mock mode, keyed by the move the engine read. */
const MOCK_REPLIES: Record<string, { reply: string; mood: string }> = {
  CONDITIONAL_TRADE: { reply: 'If you can do that, I can probably make the other piece work. Let me see what I can move.', mood: 'warming up' },
  UNCONDITIONAL_CONCESSION: { reply: 'Appreciated — that helps. Let me hold there for now.', mood: 'satisfied' },
  REJECT_ANCHOR_WITH_ALT: { reply: 'I hear you have options. So do I. Let’s see whose is real.', mood: 'digging in' },
  PRESSURE_TEST: { reply: 'Deadlines don’t move me much. Bring me a reason and we’ll talk.', mood: 'unmoved' },
  COUNTER_ANCHOR_VALIDATED: { reply: 'That’s a fair reference point. I still think it’s high, but it’s not nothing.', mood: 'considering' },
  DEFAULT_AMBIGUOUS: { reply: 'I’m not sure I follow — what exactly are you proposing?', mood: 'guarded' },
};

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }

  const parsed = trainRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest('The request did not match the expected shape.', fieldErrors(parsed.error));
  }
  const { scenarioId, message, state } = parsed.data;

  const scenario = scenarioById(scenarioId);
  if (!scenario) {
    return badRequest(`Unknown scenario "${scenarioId}".`);
  }

  // Establish the prior state: a fresh seed on turn one, or the client's state —
  // but only after its seal chain verifies. A broken chain is rejected, never
  // silently accepted.
  let priorState: NegotiationState;
  if (!state) {
    priorState = initialState(scenarioId, scenario.initialState);
  } else {
    const candidate = state as unknown as NegotiationState;
    if (candidate.scenarioId !== scenarioId) {
      return badRequest('The submitted state belongs to a different scenario.');
    }
    // verifyChain seals the transition HISTORY. It does not, on its own, prove
    // the top-level current scores match that history — a client could ship a
    // valid chain with tampered current numbers. So check both: the chain, and
    // that the live scores equal the last sealed record's `after` (or the
    // scenario seed when there is no history yet).
    if (verifyChain(candidate) !== -1 || !stateHeadConsistent(candidate, scenario.initialState)) {
      return errorResponse(400, {
        error: {
          kind: 'bad_request',
          message: 'The submitted negotiation state failed seal verification and was rejected.',
        },
      });
    }
    priorState = candidate;
  }

  // The deterministic move. This seals the new state before any model is called.
  const { nextState, classification, record: rec } = applyMove(priorState, message);
  const move = moveSummary(classification, rec.applied);

  if (isMockMode()) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record({ route: 'train', ms: elapsedMs, ok: true, attempts: 0 });
    const canned = MOCK_REPLIES[classification.moveType] ?? MOCK_REPLIES.DEFAULT_AMBIGUOUS;
    return NextResponse.json<TrainResponseBody>({
      mode: 'mock',
      state: nextState,
      move,
      reply: canned.reply,
      mood: canned.mood,
      chainValid: verifyChain(nextState) === -1,
      meta: { elapsedMs, attempts: 0 },
    });
  }

  let agent: ReturnType<typeof createAdversaryAgent>;
  try {
    agent = createAdversaryAgent(scenario.opponentPersona, nextState, classification);
  } catch (err) {
    if (err instanceof EnvError) {
      record({ route: 'train', ms: 0, ok: false, attempts: 0, failure: 'config' });
      return errorResponse(500, { error: { kind: 'config', message: err.message } });
    }
    throw err;
  }

  const userId = 'local-user';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'train',
    policy: CRITICAL_POLICY,
    run: (signal) => collectFinalText({ agent, userId, sessionId, message, signal }),
  });

  if (!outcome.ok) {
    record({ route: 'train', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: outcome.failure.kind });
    return errorResponse(outcome.failure.kind === 'config' ? 500 : 503, {
      error: { kind: outcome.failure.kind, message: outcome.failure.message },
    });
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(outcome.value);
  } catch {
    record({ route: 'train', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, { error: { kind: 'invalid_response', message: 'The model returned text that was not valid JSON.' } });
  }

  const validated = adversaryOutputSchema.safeParse(candidate);
  if (!validated.success) {
    record({ route: 'train', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, {
      error: { kind: 'invalid_response', message: 'The counterparty response did not match the expected shape.', fields: fieldErrors(validated.error) },
    });
  }

  record({ route: 'train', ms: outcome.elapsedMs, ok: true, attempts: outcome.attempts });

  return NextResponse.json<TrainResponseBody>({
    mode: 'live',
    state: nextState,
    move,
    reply: validated.data.reply,
    mood: validated.data.mood,
    // The reply came AFTER sealing; the state is unchanged by anything the model
    // said. Re-verify to prove it on the wire.
    chainValid: verifyChain(nextState) === -1,
    meta: { elapsedMs: outcome.elapsedMs, attempts: outcome.attempts },
  });
}

function moveSummary(
  c: Classification,
  applied: { leverage: number; trust: number; patience: number },
): TrainResponseBody['move'] {
  return { moveType: c.moveType, criterion: c.criterion, rationale: c.rationale, applied };
}

function badRequest(message: string, fields?: Record<string, string[]>): NextResponse {
  return errorResponse(400, { error: { kind: 'bad_request', message, fields } });
}

function errorResponse(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}
