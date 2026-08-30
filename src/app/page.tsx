'use client';

import { useState } from 'react';
import { AnnotatedMessage } from '@/components/AnnotatedMessage';
import { AskPanel } from '@/components/AskPanel';
import { ReadCard } from '@/components/ReadCard';
import { FleetPanel } from '@/components/FleetPanel';
import { ThinkPanel } from '@/components/ThinkPanel';
import { PipelineDiagram } from '@/components/PipelineDiagram';
import { Examples } from '@/components/Examples';
import type { ReadOutput } from '@/lib/schemas/read_schema';
import type { ThinkOutput } from '@/lib/schemas/think_schema';
import type { CompositeVerdict } from '@/lib/frameworks';

/**
 * READ + THINK screen — the landing and the tool in one place.
 *
 * A first-time visitor gets the pitch, a diagram, and one-click examples. After
 * a read, THINK becomes available: three drafts, on demand, that GAMBIT will
 * never send. The order mirrors the product — understand the board first, then
 * consider a move.
 */

interface RequestBody {
  message: string;
  context: { relationship: 'unknown'; hasAlternative: boolean; underTimePressure: boolean; note: string };
}

interface ReadResponse {
  mode: 'live' | 'mock';
  read: ReadOutput;
  verdict: CompositeVerdict;
  meta: { elapsedMs: number; attempts: number };
}

interface ThinkResponse {
  mode: 'live' | 'mock';
  think: ThinkOutput;
  meta: { elapsedMs: number; attempts: number };
}

type Status =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'done'; data: ReadResponse }
  | { phase: 'failed'; message: string };

type ThinkStatus =
  | { phase: 'idle' }
  | { phase: 'thinking' }
  | { phase: 'done'; data: ThinkResponse }
  | { phase: 'failed'; message: string };

export default function Home() {
  const [message, setMessage] = useState('');
  // The message the CURRENT result was computed from. Distinct from `message`
  // on purpose: the reader can start editing the box without the marks under
  // the previous verdict silently shifting to text it never saw.
  const [readMessage, setReadMessage] = useState('');
  const [hasAlternative, setHasAlternative] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const [think, setThink] = useState<ThinkStatus>({ phase: 'idle' });
  const [brief, setBrief] = useState<string>('');
  const [lastReq, setLastReq] = useState<RequestBody | null>(null);

  async function runRead(override?: string) {
    const msg = (override ?? message).trim();
    if (msg.length === 0) return;
    if (override !== undefined) setMessage(override);
    const body: RequestBody = {
      message: msg,
      context: { relationship: 'unknown', hasAlternative, underTimePressure: false, note: '' },
    };
    setLastReq(body);
    setThink({ phase: 'idle' });
    setStatus({ phase: 'reading' });
    setReadMessage(msg);
    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const parsed = await res.json();
      if (!res.ok) {
        setStatus({ phase: 'failed', message: parsed?.error?.message ?? 'The request failed.' });
        return;
      }
      setStatus({ phase: 'done', data: parsed as ReadResponse });
    } catch {
      setStatus({ phase: 'failed', message: 'Could not reach the server.' });
    }
  }

  async function runThink(read: ReadResponse) {
    if (!lastReq) return;
    setThink({ phase: 'thinking' });
    try {
      const res = await fetch('/api/think', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...lastReq,
          brief,
          readTactic: read.read.likelyTactic,
          readLevel: read.verdict.level,
        }),
      });
      const parsed = await res.json();
      if (!res.ok) {
        setThink({ phase: 'failed', message: parsed?.error?.message ?? 'The request failed.' });
        return;
      }
      setThink({ phase: 'done', data: parsed as ThinkResponse });
    } catch {
      setThink({ phase: 'failed', message: 'Could not reach the server.' });
    }
  }

  const busy = status.phase === 'reading';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header className="max-w-2xl">
        <p className="label">Read one message</p>
        <h1 className="mt-3 font-[family-name:var(--font-read)] text-[2.6rem] font-normal leading-[1.1] tracking-[-0.02em] text-text sm:text-5xl">
          Which words are
          <br />
          doing the work?
        </h1>
        <p className="mt-5 text-[13px] leading-relaxed text-text-dim">
          Paste a message you are about to reply to. Four rule-based lenses and Gemini read it and
          underline the exact spans that made them say so. GAMBIT can then draft reply options in
          your voice — but it never sends, and you decide.
        </p>
        <p className="mt-3 border-l-2 border-ink-line pl-3 text-xs text-text-faint">
          AI increases agency. It does not replace it.
        </p>
      </header>

      {status.phase === 'idle' && <PipelineDiagram />}

      <div className="flex flex-col gap-4">
        <Examples onPick={runRead} disabled={busy} />

        <div className="flex flex-col gap-3">
          <label htmlFor="message" className="sr-only">
            Message from the counterparty
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="…or paste their message here."
            className="w-full resize-y rounded-sm border border-ink-line bg-ink-raised p-4 font-[family-name:var(--font-read)] text-[15px] leading-relaxed text-text outline-none transition placeholder:text-text-faint focus:border-[color:var(--lens-aristotle-lit)]"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-text-dim">
              <input
                type="checkbox"
                checked={hasAlternative}
                onChange={(e) => setHasAlternative(e.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              I have a concrete alternative I would take
            </label>

            <button
              type="button"
              onClick={() => runRead()}
              disabled={busy || message.trim().length === 0}
              className="rounded-sm bg-paper px-5 py-2 text-sm font-semibold text-paper-ink transition hover:bg-white disabled:cursor-not-allowed disabled:bg-ink-line disabled:text-text-faint"
            >
              {busy ? 'Reading…' : 'Read this message'}
            </button>
          </div>
          <p className="label text-right tabular-nums">{message.length} / 4000</p>
        </div>
      </div>

      {status.phase === 'reading' && (
        <div className="ruled rounded-sm border border-ink-line bg-ink-raised p-5">
          <p className="label">Sealed · waiting on the model</p>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            The rules have already read this message and sealed their verdict. Gemini is being asked
            for its vote — about ten seconds on a live call.
          </p>
        </div>
      )}

      {status.phase === 'failed' && (
        <div className="rounded-sm border-l-2 border-[color:var(--v-manipulative)] bg-[color:var(--v-manipulative)]/10 p-4">
          <p className="label !text-[color:var(--v-manipulative)]">The read did not complete</p>
          <p className="mt-1.5 text-sm text-text">{status.message}</p>
        </div>
      )}

      {status.phase === 'done' && (
        <>
          {/* The evidence first. Everything below is a reading OF this. */}
          <AnnotatedMessage message={readMessage} verdict={status.data.verdict} />
          <FleetPanel verdict={status.data.verdict} />
          <ReadCard read={status.data.read} mode={status.data.mode} />
          {/* Questions come last: the evidence and the verdict are settled
              above before anything conversational is offered. */}
          <AskPanel
            message={readMessage}
            verdict={status.data.verdict}
            read={status.data.read}
          />
          <p className="label">
            {status.data.meta.elapsedMs} ms · {status.data.meta.attempts} attempt
            {status.data.meta.attempts === 1 ? '' : 's'}
            {status.data.mode === 'mock' ? ' · fixture' : ' · live gemini'}
          </p>

          {/* THINK — offered after the read, never before. ----------------- */}
          {think.phase === 'idle' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="brief" className="label">
                  Brief <span className="text-text-faint">(optional)</span>
                </label>
                <textarea
                  id="brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={2}
                  maxLength={600}
                  placeholder="Optional: anything this reply must include or avoid (a number, a line you won't cross)…"
                  className="w-full resize-y rounded-sm border border-ink-line bg-ink p-3 text-[13px] leading-relaxed text-text outline-none transition placeholder:text-text-faint focus:border-[color:var(--lens-aristotle-lit)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => runThink(status.data)}
                  className="rounded-sm border border-ink-line px-5 py-2 text-sm font-medium text-text-dim transition hover:border-text-faint hover:text-text"
                >
                  Draft my reply →
                </button>
                <span className="text-xs text-text-faint">
                  Three postures, in your voice. GAMBIT drafts; it never sends.
                </span>
              </div>
            </div>
          )}

          {think.phase === 'thinking' && (
            <div className="ruled rounded-sm border border-ink-line bg-ink-raised p-5">
              <p className="label">Drafting</p>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                Writing three replies against the sealed read — about ten seconds on a live call.
              </p>
            </div>
          )}

          {think.phase === 'failed' && (
            <div className="rounded-sm border-l-2 border-[color:var(--v-manipulative)] bg-[color:var(--v-manipulative)]/10 p-4">
              <p className="label !text-[color:var(--v-manipulative)]">Drafting did not complete</p>
              <p className="mt-1.5 text-sm text-text">{think.message}</p>
            </div>
          )}

          {think.phase === 'done' && <ThinkPanel think={think.data.think} mode={think.data.mode} />}
        </>
      )}
    </main>
  );
}
