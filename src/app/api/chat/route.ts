import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createChatAgent } from '@/lib/adk/chat_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { isMockMode } from '@/lib/mock/read_fixture';
import { callWithPolicy, type CallPolicy } from '@/lib/resilience';
import { fieldErrors, type ApiErrorBody } from '@/lib/schemas/api_input';
import { chatRequestSchema, type ChatMessage } from '@/lib/schemas/chat_schema';
import { record } from '@/lib/telemetry';

/**
 * POST /api/chat
 *
 * One turn of the assistant conversation. The agent can search the web
 * (ADK GOOGLE_SEARCH), so its answers are free text with citations, not
 * structured. The client sends the whole transcript; the server folds all but
 * the last message into the instruction and sends the last as the new message.
 */

/** Web search grounding is slow; give it room, but only one shot (a retry just
 * doubles a long wait). Stays under the Cloud Run request timeout. */
const CHAT_POLICY: CallPolicy = { timeoutMs: 40_000, maxAttempts: 1 };

export interface ChatResponseBody {
  mode: 'live' | 'mock';
  reply: string;
  meta: { elapsedMs: number; attempts: number };
}

const MOCK_REPLY =
  "I'm the GAMBIT assistant (fixture mode — no model or web search is running). " +
  'Paste a contract or a message and I can point out inconsistencies and things worth checking, ' +
  'suggest how you might respond, and look up standard terms — but I am not a lawyer, so anything ' +
  'with legal weight should be confirmed with a qualified professional.';

function transcriptOf(messages: ChatMessage[]): string {
  // Fold everything but the final user turn into a readable transcript, capped
  // to the most recent turns so the prompt stays bounded.
  const prior = messages.slice(0, -1).slice(-16);
  return prior.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest('Request body was not valid JSON.');
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest('The request did not match the expected shape.', fieldErrors(parsed.error));
  }
  const { messages } = parsed.data;
  const last = messages[messages.length - 1];
  if (last.role !== 'user') {
    return badRequest('The last message must be from the user.');
  }

  if (isMockMode()) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    record({ route: 'chat', ms: elapsedMs, ok: true, attempts: 0 });
    return NextResponse.json<ChatResponseBody>({ mode: 'mock', reply: MOCK_REPLY, meta: { elapsedMs, attempts: 0 } });
  }

  let agent: ReturnType<typeof createChatAgent>;
  try {
    agent = createChatAgent(transcriptOf(messages));
  } catch (err) {
    if (err instanceof EnvError) {
      record({ route: 'chat', ms: 0, ok: false, attempts: 0, failure: 'config' });
      return errorResponse(500, { error: { kind: 'config', message: err.message } });
    }
    throw err;
  }

  const userId = 'local-user';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'chat',
    policy: CHAT_POLICY,
    run: (signal) => collectFinalText({ agent, userId, sessionId, message: last.content, signal }),
  });

  if (!outcome.ok) {
    record({ route: 'chat', ms: outcome.elapsedMs, ok: false, attempts: outcome.attempts, failure: outcome.failure.kind });
    return errorResponse(outcome.failure.kind === 'config' ? 500 : 503, {
      error: { kind: outcome.failure.kind, message: outcome.failure.message },
    });
  }

  record({ route: 'chat', ms: outcome.elapsedMs, ok: true, attempts: outcome.attempts });
  return NextResponse.json<ChatResponseBody>({
    mode: 'live',
    reply: outcome.value,
    meta: { elapsedMs: outcome.elapsedMs, attempts: outcome.attempts },
  });
}

function badRequest(message: string, fields?: Record<string, string[]>): NextResponse {
  return errorResponse(400, { error: { kind: 'bad_request', message, fields } });
}

function errorResponse(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status });
}
