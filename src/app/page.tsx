'use client';

import { useState } from 'react';
import { ReadCard } from '@/components/ReadCard';
import { FleetPanel } from '@/components/FleetPanel';
import type { ReadOutput } from '@/lib/schemas/read_schema';
import type { CompositeVerdict } from '@/lib/frameworks';

/**
 * READ screen — one screen, one idea.
 *
 * Day-1 scope. THINK, TRAIN and SCORE get their own screens in later phases;
 * they are deliberately absent rather than stubbed, so nothing on screen
 * promises a capability that does not exist yet.
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
  const [hasAlternative, setHasAlternative] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  async function runRead() {
    setStatus({ phase: 'reading' });
    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          context: {
            relationship: 'unknown',
            hasAlternative,
            underTimePressure: false,
            note: '',
          },
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
      <header>
        <p className="brand-text text-[11px] font-semibold uppercase tracking-[0.24em]">
          GAMBIT YourMove
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">
          What are they actually doing?
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">
          Paste the message you received. GAMBIT names the tactic, shows the
          evidence it used, and tells you how sure it is. It will not write your
          reply for you.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <label htmlFor="message" className="sr-only">
          Message from the counterparty
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={4000}
          placeholder="Paste their message here…"
          className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/90 outline-none transition placeholder:text-white/25 focus:border-white/30"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-white/50">
            <input
              type="checkbox"
              checked={hasAlternative}
              onChange={(e) => setHasAlternative(e.target.checked)}
              className="h-4 w-4 accent-white/70"
            />
            I have a concrete alternative I would take
          </label>

          <button
            type="button"
            onClick={runRead}
            disabled={busy || message.trim().length === 0}
            className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
          >
            {busy ? 'Reading…' : 'Read this message'}
          </button>
        </div>
        <p className="text-right text-xs tabular-nums text-white/25">
          {message.length} / 4000
        </p>
      </div>

      {status.phase === 'failed' && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {status.message}
        </p>
      )}

      {status.phase === 'done' && (
        <>
          <FleetPanel verdict={status.data.verdict} />
          <ReadCard read={status.data.read} mode={status.data.mode} />
          <p className="text-xs tabular-nums text-white/25">
            {status.data.meta.elapsedMs} ms · {status.data.meta.attempts} attempt
            {status.data.meta.attempts === 1 ? '' : 's'}
          </p>
        </>
      )}
    </main>
  );
}
