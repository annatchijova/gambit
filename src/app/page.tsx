'use client';

import { useState } from 'react';
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
  const [hasAlternative, setHasAlternative] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  async function runRead(override?: string) {
    const msg = (override ?? message).trim();
    if (msg.length === 0) return;
    if (override !== undefined) setMessage(override);
    setStatus({ phase: 'reading' });
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
      <header>
        <p className="brand-text text-[11px] font-semibold uppercase tracking-[0.24em]">GAMBIT YourMove</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">
          What are they actually doing?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          You are about to reply to a message that will cost you money. GAMBIT reads what the other side
          is actually doing — a fleet of rule-based lenses plus Gemini — shows you the evidence it used,
          tells you how sure it is, and then stops. It does not write your reply, and it does not decide
          anything for you.
        </p>
        <p className="mt-2 font-mono text-xs text-white/35">
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
            className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/90 outline-none transition placeholder:text-white/25 focus:border-white/30"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-white/50">
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
              className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
            >
              {busy ? 'Reading…' : 'Read this message'}
            </button>
          </div>
          <p className="text-right text-xs tabular-nums text-white/25">{message.length} / 4000</p>
        </div>
      </div>

      {status.phase === 'reading' && (
        <div className="dot-grid rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full brand-gradient" />
            <p className="text-sm text-white/70">
              The deterministic fleet has already sealed its verdict. Waiting on Gemini’s vote —
              a live model call takes about ten seconds.
            </p>
          </div>
        </div>
      )}

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
            {status.data.mode === 'mock' ? ' · fixture' : ' · live Gemini'}
          </p>
        </>
      )}
    </main>
  );
}
