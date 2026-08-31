import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createThinkAgent } from '@/lib/adk/think_agent';
import { collectFinalText, ensureSession } from '@/lib/adk/client';
import { EnvError } from '@/lib/env';
import { isMockMode } from '@/lib/mock/read_fixture';
import { THINK_FIXTURE } from '@/lib/mock/think_fixture';
import { buildReadSummary } from '@/lib/read_verdict';
import { CRITICAL_POLICY, callWithPolicy } from '@/lib/resilience';
import { thinkOutputSchema, type ThinkOutput } from '@/lib/schemas/think_schema';
import { record } from '@/lib/telemetry';
import { loadInbox } from '@/lib/watch/inbox';
import { runTriage, verifyTriageChain, type Disposition, type TriageEntry } from '@/lib/watch/sentinel';

/**
 * GET /api/watch
 *
 * One autonomous pass over the WATCH inbox. This is the endpoint Cloud Scheduler
 * hits on a cron: it needs no request body, so a plain scheduled GET drives the
 * whole loop. The autonomous decision path (triage + the tamper-evident chain)
 * is deterministic and needs no key or network, so a scheduled pass always
 * completes even if the model is unreachable.
 *
 * `?draft=1` additionally pre-stages replies for the escalated messages by
 * calling the THINK agent — the only place a model is used here, and only for
 * messages the deterministic core already decided to escalate. Drafting is
 * best-effort: a failure is reported per message, never faked, and never changes
 * a disposition. Kept off by default so a scheduled heartbeat stays fast and
 * cannot be starved by the model.
 *
 * RUNTIME — Node runtime (node:crypto + the ADK SDK). Next 16 defaults to
 * 'nodejs'; no runtime export, per the same note in /api/read.
 */

/** Cap on how many escalated messages get a pre-staged draft in one pass. */
const MAX_DRAFTS = 4;

/** A best-effort draft attached beside a decision — never inside its seal. */
export type DraftResult =
  | { ok: true; think: ThinkOutput }
  | { ok: false; reason: string };

/** A triage entry with an optional pre-staged draft (escalated messages only). */
export interface WatchEntry extends TriageEntry {
  draft: DraftResult | null;
}

export interface WatchResponseBody {
  mode: 'live' | 'mock';
  meta: {
    /** Recorded OUTSIDE any sealed payload — chain-of-custody metadata only. */
    completedAt: string;
    inboxSize: number;
    drafted: number;
    draftFailures: number;
    elapsedMs: number;
  };
  counts: Record<Disposition, number>;
  /** Head of the tamper-evident chain, and whether it verifies. */
  chain: { head: string | null; verifiedThroughIndex: number; intact: boolean };
  entries: WatchEntry[];
}

export async function GET(request: Request): Promise<NextResponse> {
  const startedAt = performance.now();
  const withDrafts = new URL(request.url).searchParams.get('draft') === '1';

  // --- Autonomous decision path: deterministic, no key, cannot fail. -------
  const inbox = loadInbox();
  const triage = runTriage(inbox);
  const entries: WatchEntry[] = triage.entries.map((e) => ({ ...e, draft: null }));

  // The chain is verified here so the response can state its own integrity; the
  // browser can re-verify independently from the same fields.
  const brokenAt = verifyTriageChain(triage.entries);

  // --- Best-effort drafting for escalated messages only. -------------------
  let drafted = 0;
  let draftFailures = 0;
  if (withDrafts) {
    const escalated = entries.filter((e) => e.disposition === 'ESCALATED').slice(0, MAX_DRAFTS);
    for (const entry of escalated) {
      const result = await preDraft(entry);
      entry.draft = result;
      if (result.ok) drafted += 1;
      else draftFailures += 1;
    }
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  record({ route: 'watch', ms: elapsedMs, ok: true, attempts: 0 });

  return NextResponse.json<WatchResponseBody>({
    mode: isMockMode() ? 'mock' : 'live',
    meta: {
      completedAt: new Date().toISOString(),
      inboxSize: inbox.length,
      drafted,
      draftFailures,
      elapsedMs,
    },
    counts: triage.counts,
    chain: {
      head: triage.head,
      verifiedThroughIndex: brokenAt === -1 ? triage.entries.length : brokenAt,
      intact: brokenAt === -1,
    },
    entries,
  });
}

/**
 * Pre-stage the three drafts for one escalated message.
 *
 * Reuses the exact THINK path a human triggers by hand: the drafts are grounded
 * in the deterministic read recomputed server-side, and the model is fenced to
 * drafting only. Returns a discriminated result so a model failure degrades this
 * one message honestly instead of throwing the whole pass.
 */
async function preDraft(entry: WatchEntry): Promise<DraftResult> {
  if (isMockMode()) {
    return { ok: true, think: THINK_FIXTURE };
  }

  const summary = buildReadSummary(entry.message, {
    tactic: entry.activeFrameworks.join(', '),
    level: entry.level,
  });

  let agent: ReturnType<typeof createThinkAgent>;
  try {
    agent = createThinkAgent(summary);
  } catch (err) {
    if (err instanceof EnvError) {
      return { ok: false, reason: `Drafting is not configured: ${err.message}` };
    }
    throw err;
  }

  const userId = 'sentinel';
  const sessionId = randomUUID();
  await ensureSession(userId, sessionId);

  const outcome = await callWithPolicy({
    name: 'watch-think',
    policy: CRITICAL_POLICY,
    run: (signal) => collectFinalText({ agent, userId, sessionId, message: entry.message, signal }),
  });

  if (!outcome.ok) {
    return { ok: false, reason: `Model did not return drafts (${outcome.failure.kind}). Escalation stands.` };
  }

  try {
    const think = thinkOutputSchema.parse(JSON.parse(outcome.value));
    return { ok: true, think };
  } catch {
    return { ok: false, reason: 'Model returned drafts that did not match the THINK schema. Escalation stands.' };
  }
}
