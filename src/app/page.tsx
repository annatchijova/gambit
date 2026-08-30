'use client';

import { useState } from 'react';
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
  const [hasAlternative, setHasAlternative] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const [think, setThink] = useState<ThinkStatus>({ phase: 'idle' });
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
        <p className="mt-2 font-mono text-xs text-white/35">AI increases agency. It does not replace it.</p>
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
              The deterministic fleet has already sealed its verdict. Waiting on Gemini’s vote — a live
              model call takes about ten seconds.
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

          {/* THINK — offered after the read, never before. ----------------- */}
          {think.phase === 'idle' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => runThink(status.data)}
                className="rounded-md border border-violet-400/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
              >
                Draft my reply →
              </button>
              <span className="text-xs text-white/35">
                Three postures, in your voice. GAMBIT drafts; it never sends.
              </span>
            </div>
          )}

          {think.phase === 'thinking' && (
            <div className="dot-grid rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-pulse rounded-full brand-gradient" />
                <p className="text-sm text-white/70">
                  Drafting three replies against the sealed read — about ten seconds.
                </p>
              </div>
            </div>
          )}

          {think.phase === 'failed' && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {think.message}
            </p>
          )}

          {think.phase === 'done' && <ThinkPanel think={think.data.think} mode={think.data.mode} />}
        </>
      )}
    </main>
  );
}
