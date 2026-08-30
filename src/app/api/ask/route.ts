import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAskAgent } from '@/lib/adk/ask_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { runFleet } from '@/lib/frameworks';
import { buildAskPrompt } from '@/lib/ask_prompt';
import { isMockMode } from '@/lib/mock/read_fixture';
import { CRITICAL_POLICY, callWithPolicy } from '@/lib/resilience';
import { askOutputSchema, askRequestSchema, type AskOutput } from '@/lib/schemas/ask_schema';
import { fieldErrors, type ApiErrorBody } from '@/lib/schemas/api_input';
import { record } from '@/lib/telemetry';

/**
 * POST /api/ask
 *
 * A question about a verdict that has already been sealed.
 *
 * THE VERDICT IS NOT ACCEPTED FROM THE CLIENT. The request carries the message;
 * this handler re-runs the deterministic fleet over it and grounds the answer in
 * the verdict it computes for itself. That is cheap (no model, no network, no
 * key), it is exactly reproducible, and it means a tampered client cannot supply
 * the facts the model reasons from. Verifying a client-supplied seal would also
 * work and would be more code for a weaker guarantee.
 *
 * Nothing here can change a sealed number. The model's answer is prose beside a
 * verdict the interface renders from its own sealed copy, which the reader can
 * re-hash in their browser after any amount of conversation.
 */

export interface AskResponseBody {
  mode: 'live' | 'mock';
  answer: AskOutput;
  /** The seal the answer was grounded in, so the client can prove it matches. */
  groundedInSeal: string;
  meta: { elapsedMs: number; attempts: number };
}

/**
 * Fixture answer. Opt-in only, tagged, never a fallback — same contract as the
 * READ fixture, so a demo without a key can still show the shape of ASK.
 */
const MOCK_ANSWER: AskOutput = {
  answer:
    'Cialdini fired because three separate influence levers appear in one short message — a closing window, a debt being called in, and a claim that everyone else has agreed. Grice stayed silent because nothing in the message evades a question or obscures a fact; it is pressuring, not evasive. That difference is why the verdict is PERSUASIVE rather than higher: the lenses that fired agree on pressure, and the ones that watch for deception found nothing to quote.',
  outOfRemit: false,
};

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, {
      error: { kind: 'bad_request', message: 'Request body was not valid JSON.' },
    });
  }

  const parsed = askRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, {
      error: {
        kind: 'bad_request',
        message: 'The request did not match the expected shape.',
        fields: fieldErrors(parsed.error),
      },
    });
  }
  const { message, question, history, read } = parsed.data;

  // The fact base, computed here rather than trusted. Deterministic: this is
  // bit-for-bit the verdict the reader is looking at.
  const core = runFleet(message);

  if (isMockMode()) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record({ route: 'ask', ms: elapsedMs, ok: true, attempts: 0 });
    return NextResponse.json<AskResponseBody>({
      mode: 'mock',
      answer: MOCK_ANSWER,
      groundedInSeal: core.seal,
      meta: { elapsedMs, attempts: 0 },
    });
  }

  let agent: ReturnType<typeof createAskAgent>;
  try {
    agent = createAskAgent();
  } catch (err) {
    if (err instanceof EnvError) {
      record({ route: 'ask', ms: 0, ok: false, attempts: 0, failure: 'config' });
      return errorResponse(500, { error: { kind: 'config', message: err.message } });
    }
    throw err;
  }

  const userId = 'local-user';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'ask',
    policy: CRITICAL_POLICY,
    run: (signal) =>
      collectFinalText({
        agent,
        userId,
        sessionId,
        message: buildAskPrompt({ message, question, history, core, read: read ?? null }),
        signal,
      }),
  });

  if (!outcome.ok) {
    record({
      route: 'ask',
      ms: outcome.elapsedMs,
      ok: false,
      attempts: outcome.attempts,
      failure: outcome.failure.kind,
    });
    return errorResponse(outcome.failure.kind === 'config' ? 500 : 503, {
      error: { kind: outcome.failure.kind, message: outcome.failure.message },
    });
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(outcome.value);
  } catch {
    record({
      route: 'ask',
      ms: outcome.elapsedMs,
      ok: false,
      attempts: outcome.attempts,
      failure: 'invalid_response',
    });
    return errorResponse(502, {
      error: {
        kind: 'invalid_response',
        message: 'The model returned text that was not valid JSON.',
      },
    });
  }

  const validated = askOutputSchema.safeParse(candidate);
  if (!validated.success) {
    record({
      route: 'ask',
      ms: outcome.elapsedMs,
      ok: false,
      attempts: outcome.attempts,
      failure: 'invalid_response',
    });
    return errorResponse(502, {
      error: {
        kind: 'invalid_response',
        message: 'The model response did not match the ASK schema.',
        fields: fieldErrors(validated.error),
      },
    });
  }

  record({ route: 'ask', ms: outcome.elapsedMs, ok: true, attempts: outcome.attempts });

  return NextResponse.json<AskResponseBody>({
    mode: 'live',
    answer: validated.data,
    groundedInSeal: core.seal,
    meta: { elapsedMs: outcome.elapsedMs, attempts: outcome.attempts },
  });
}

function errorResponse(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}
