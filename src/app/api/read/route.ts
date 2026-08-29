import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createReadAgent } from '@/lib/adk/read_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { isMockMode, READ_FIXTURE } from '@/lib/mock/read_fixture';
import { CRITICAL_POLICY, callWithPolicy } from '@/lib/resilience';
import { fieldErrors, readRequestSchema, type ApiErrorBody } from '@/lib/schemas/api_input';
import { readOutputSchema, type ReadOutput } from '@/lib/schemas/read_schema';
import { MODELS } from '@/lib/models';
import { buildReadVerdict } from '@/lib/read_verdict';
import type { CompositeVerdict } from '@/lib/frameworks';
import { record } from '@/lib/telemetry';

/**
 * POST /api/read
 *
 * RUNTIME — this handler requires the Node runtime (the ADK SDK and
 * node:crypto both need it). No `export const runtime` is declared, because in
 * Next 16 'nodejs' is the default and the Edge runtime is deprecated; the docs
 * explicitly say to remove the export. Do not add `export const dynamic`
 * either: it was removed as a segment-config option in Next 16, and POST
 * handlers are never cached in the first place.
 */

export interface ReadResponseBody {
  mode: 'live' | 'mock';
  read: ReadOutput;
  /**
   * The composite verdict: the deterministic fleet's sealed, reproducible read
   * blended with the model's vote (flagged best-effort). The deterministic core
   * inside it always verifies; see src/lib/frameworks/composite.ts.
   */
  verdict: CompositeVerdict;
  meta: { elapsedMs: number; attempts: number };
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();

  // --- Boundary: parse the request before anything else touches it. --------
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }

  const parsed = readRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest('The request did not match the expected shape.', fieldErrors(parsed.error));
  }
  const { message, context } = parsed.data;

  // --- Explicit, opt-in mock mode. Never reached by accident. -------------
  if (isMockMode()) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record({ route: 'read', ms: elapsedMs, ok: true, attempts: 0 });
    // The deterministic fleet is offline, so even the fixture path runs the
    // real core on the real message and composes the fixture's vote into it.
    return NextResponse.json<ReadResponseBody>({
      mode: 'mock',
      read: READ_FIXTURE,
      verdict: buildReadVerdict(message, READ_FIXTURE, MODELS.READ),
      meta: { elapsedMs, attempts: 0 },
    });
  }

  // --- Live path -----------------------------------------------------------
  let agent: ReturnType<typeof createReadAgent>;
  try {
    agent = createReadAgent(context);
  } catch (err) {
    if (err instanceof EnvError) {
      record({ route: 'read', ms: 0, ok: false, attempts: 0, failure: 'config' });
      return errorResponse(500, { error: { kind: 'config', message: err.message } });
    }
    throw err;
  }

  const userId = 'local-user';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'read',
    policy: CRITICAL_POLICY,
    run: (signal) =>
      collectFinalText({ agent, userId, sessionId, message, signal }),
  });

  if (!outcome.ok) {
    record({
      route: 'read',
      ms: outcome.elapsedMs,
      ok: false,
      attempts: outcome.attempts,
      failure: outcome.failure.kind,
    });
    return errorResponse(outcome.failure.kind === 'config' ? 500 : 503, {
      error: { kind: outcome.failure.kind, message: outcome.failure.message },
    });
  }

  // --- Re-validate the model's output before it reaches the UI. -----------
  // Constrained decoding reduces malformed output; it does not remove the
  // possibility. A response that fails here is reported as invalid, never
  // patched into something that looks answerable.
  let candidate: unknown;
  try {
    candidate = JSON.parse(outcome.value);
  } catch {
    record({ route: 'read', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, {
      error: { kind: 'invalid_response', message: 'The model returned text that was not valid JSON.' },
    });
  }

  const validated = readOutputSchema.safeParse(candidate);
  if (!validated.success) {
    record({ route: 'read', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: 'invalid_response' });
    return errorResponse(502, {
      error: {
        kind: 'invalid_response',
        message: 'The model response did not match the READ schema.',
        fields: fieldErrors(validated.error),
      },
    });
  }

  record({ route: 'read', ms: outcome.elapsedMs, ok: true, attempts: outcome.attempts });

  return NextResponse.json<ReadResponseBody>({
    mode: 'live',
    read: validated.data,
    // The model's vote is now folded into the sealed deterministic core. The
    // fleet ran on the same message with no model in the loop, so the core seal
    // is independent of anything the model returned.
    verdict: buildReadVerdict(message, validated.data, MODELS.READ),
    meta: { elapsedMs: outcome.elapsedMs, attempts: outcome.attempts },
  });
}

function badRequest(message: string, fields?: Record<string, string[]>): NextResponse {
  return errorResponse(400, { error: { kind: 'bad_request', message, fields } });
}

function errorResponse(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}
