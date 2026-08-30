'use client';

import { useState } from 'react';
import { AnnotatedMessage } from '@/components/AnnotatedMessage';
import { ReadCard } from '@/components/ReadCard';
import { FleetPanel } from '@/components/FleetPanel';
import { PipelineDiagram } from '@/components/PipelineDiagram';
import { Examples } from '@/components/Examples';
import type { ReadOutput } from '@/lib/schemas/read_schema';
import type { CompositeVerdict } from '@/lib/frameworks';

/**
 * READ screen — now a proper landing.
 *
 * A first-time visitor gets the pitch, a diagram of what the app does, and
 * one-click examples, so the blank textarea is never the first thing they have
 * to interpret. The tool itself sits directly below, and the result replaces
 * the diagram once they run a read.
 */

interface ReadResponse {
  mode: 'live' | 'mock';
  read: ReadOutput;
  verdict: CompositeVerdict;
  meta: { elapsedMs: number; attempts: number };
}

type Status =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'done'; data: ReadResponse }
  | { phase: 'failed'; message: string };

export default function Home() {
  const [message, setMessage] = useState('');
  // The message the CURRENT result was computed from. Distinct from `message`
  // on purpose: the reader can start editing the box without the marks under
  // the previous verdict silently shifting to text it never saw.
  const [readMessage, setReadMessage] = useState('');
  const [hasAlternative, setHasAlternative] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  async function runRead(override?: string) {
    const msg = (override ?? message).trim();
    if (msg.length === 0) return;
    if (override !== undefined) setMessage(override);
    setStatus({ phase: 'reading' });
    setReadMessage(msg);
    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          context: { relationship: 'unknown', hasAlternative, underTimePressure: false, note: '' },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus({ phase: 'failed', message: body?.error?.message ?? 'The request failed.' });
        return;
      }
      setStatus({ phase: 'done', data: body as ReadResponse });
    } catch {
      setStatus({ phase: 'failed', message: 'Could not reach the server.' });
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
          underline the exact spans that made them say so — then stop. GAMBIT does not write your
          reply and does not decide anything for you.
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
          <p className="label">
            {status.data.meta.elapsedMs} ms · {status.data.meta.attempts} attempt
            {status.data.meta.attempts === 1 ? '' : 's'}
            {status.data.mode === 'mock' ? ' · fixture' : ' · live gemini'}
          </p>
        </>
      )}
    </main>
  );
}
