import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createThinkAgent } from '@/lib/adk/think_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { isMockMode } from '@/lib/mock/read_fixture';
import { THINK_FIXTURE } from '@/lib/mock/think_fixture';
import { buildReadSummary } from '@/lib/read_verdict';
import { CRITICAL_POLICY, callWithPolicy } from '@/lib/resilience';
import { fieldErrors, type ApiErrorBody } from '@/lib/schemas/api_input';
import { thinkOutputSchema, thinkRequestSchema, type ThinkOutput } from '@/lib/schemas/think_schema';
import { record } from '@/lib/telemetry';

/**
 * POST /api/think
 *
 * Drafts three replies for one message, grounded in the deterministic read the
 * server recomputes (never the client's copy). Same runtime and failure policy
 * as /api/read: Node runtime, one retry under a deadline, and a model failure is
 * reported honestly rather than papered over. THINK never sends anything.
 */

export interface ThinkResponseBody {
  mode: 'live' | 'mock';
  think: ThinkOutput;
  meta: { elapsedMs: number; attempts: number };
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }

  const parsed = thinkRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest('The request did not match the expected shape.', fieldErrors(parsed.error));
  }
  const { message, context, readTactic, readLevel } = parsed.data;

  if (isMockMode()) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record({ route: 'think', ms: elapsedMs, ok: true, attempts: 0 });
    return NextResponse.json<ThinkResponseBody>({
      mode: 'mock',
      think: THINK_FIXTURE,
      meta: { elapsedMs, attempts: 0 },
    });
  }

  // Ground the drafts in the read, recomputed here from the deterministic fleet.
  const readSummary = buildReadSummary(message, { tactic: readTactic, level: readLevel });

  let agent: ReturnType<typeof createThinkAgent>;
  try {
    agent = createThinkAgent(readSummary, context);
  } catch (err) {
    if (err instanceof EnvError) {
      record({ route: 'think', ms: 0, ok: false, attempts: 0, failure: 'config' });
      return errorResponse(500, { error: { kind: 'config', message: err.message } });
    }
    throw err;
  }

  const userId = 'local-user';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'think',
    policy: CRITICAL_POLICY,
    run: (signal) => collectFinalText({ agent, userId, sessionId, message, signal }),
  });

  if (!outcome.ok) {
    record({
      route: 'think',
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
    record({ route: 'think', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, {
      error: { kind: 'invalid_response', message: 'The model returned text that was not valid JSON.' },
    });
  }

  const validated = thinkOutputSchema.safeParse(candidate);
  if (!validated.success) {
    record({ route: 'think', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, {
      error: {
        kind: 'invalid_response',
        message: 'The model response did not match the THINK schema.',
        fields: fieldErrors(validated.error),
      },
    });
  }

  record({ route: 'think', ms: outcome.elapsedMs, ok: true, attempts: outcome.attempts });

  return NextResponse.json<ThinkResponseBody>({
    mode: 'live',
    think: validated.data,
    meta: { elapsedMs: outcome.elapsedMs, attempts: outcome.attempts },
  });
}

function badRequest(message: string, fields?: Record<string, string[]>): NextResponse {
  return errorResponse(400, { error: { kind: 'bad_request', message, fields } });
}

function errorResponse(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}
