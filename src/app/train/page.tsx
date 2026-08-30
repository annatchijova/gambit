'use client';

import { useState } from 'react';
import { SCENARIOS } from '@/lib/scenarios';
import type { NegotiationState } from '@/lib/types';

/**
 * /train — practice against an adaptive counterparty.
 *
 * The showcase for the architecture: as the user negotiates, the state bars move
 * under the DETERMINISTIC engine, sealed and chained, and the counterparty
 * replies in persona — consistent with a state it never touched. The chain is
 * re-verified every turn, on screen. Swap the model and only the words change.
 */

interface Move {
  moveType: string;
  criterion: string;
  rationale: string;
  applied: { leverage: number; trust: number; patience: number };
}

interface TrainResponse {
  mode: 'live' | 'mock';
  state: NegotiationState;
  move: Move;
  reply: string;
  mood: string;
  chainValid: boolean;
  meta: { elapsedMs: number; attempts: number };
}

interface Turn {
  user: string;
  reply: string;
  mood: string;
  move: Move;
}

export default function Train() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [state, setState] = useState<NegotiationState | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'live' | 'mock' | null>(null);
  const [chainValid, setChainValid] = useState(true);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? null;

  function reset(id: string | null) {
    setScenarioId(id);
    setState(null);
    setTurns([]);
    setInput('');
    setError(null);
    setMode(null);
    setChainValid(true);
  }

  async function send() {
    const msg = input.trim();
    if (!msg || !scenarioId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/train', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenarioId, message: msg, state }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'The turn failed.');
        return;
      }
      const data = body as TrainResponse;
      setState(data.state);
      setMode(data.mode);
      setChainValid(data.chainValid);
      setTurns((t) => [...t, { user: msg, reply: data.reply, mood: data.mood, move: data.move }]);
      setInput('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header>
        <p className="brand-text text-[11px] font-semibold uppercase tracking-[0.24em]">Train</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Practice the exchange.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Negotiate against a counterparty that adapts. Every move you make is read by the deterministic
          engine, which moves and re-seals the state — the bars below. The counterparty replies in
          character, consistent with a state it cannot change. The seal chain is re-verified every turn.
        </p>
      </header>

      {!scenario ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => reset(s.id)}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-violet-400/40 hover:bg-violet-500/[0.05]"
            >
              <p className="text-sm font-semibold text-white/90">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{s.premise}</p>
              <span className="mt-3 inline-block font-mono text-[10px] text-violet-300">start →</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/90">{scenario.title}</p>
              <p className="mt-0.5 max-w-xl text-xs text-white/45">{scenario.premise}</p>
            </div>
            <button
              type="button"
              onClick={() => reset(null)}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white/80"
            >
              change scenario
            </button>
          </div>

          <StateBars state={state} lastMove={turns.at(-1)?.move ?? null} chainValid={chainValid} mode={mode} round={turns.length} />

          {turns.length > 0 && (
            <div className="flex flex-col gap-3">
              {turns.map((t, i) => (
                <TurnBlock key={i} turn={t} />
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={turns.length === 0 ? 'Open the negotiation — make your first move.' : 'Your reply…'}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/90 outline-none transition placeholder:text-white/25 focus:border-white/30"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">
                The counterparty adapts, but the numbers are the engine’s — not the model’s.
              </span>
              <button
                type="button"
                onClick={send}
                disabled={sending || input.trim().length === 0}
                className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
              >
                {sending ? 'Waiting…' : 'Send move'}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function StateBars({
  state,
  lastMove,
  chainValid,
  mode,
  round,
}: {
  state: NegotiationState | null;
  lastMove: Move | null;
  chainValid: boolean;
  mode: 'live' | 'mock' | null;
  round: number;
}) {
  const bars: Array<{ label: string; value: number; delta: number; color: string }> = [
    {
      label: 'Your leverage',
      value: state?.perceivedUserLeverage ?? 50,
      delta: lastMove?.applied.leverage ?? 0,
      color: 'brand-gradient',
    },
    { label: 'Trust', value: state?.trust ?? 50, delta: lastMove?.applied.trust ?? 0, color: 'bg-emerald-400/70' },
    { label: 'Patience', value: state?.patience ?? 50, delta: lastMove?.applied.patience ?? 0, color: 'bg-amber-400/70' },
  ];

  return (
    <div className="dot-grid rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
          Counterparty’s model of you {round > 0 ? `· round ${round}` : '· seeded'}
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${
            chainValid ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          {chainValid ? 'chain verified' : 'chain broken'}
          {mode === 'mock' ? ' · fixture' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-white/60">{b.label}</span>
              <span className="font-mono tabular-nums text-white/45">
                {b.value}
                {b.delta !== 0 && (
                  <span className={b.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {' '}
                    {b.delta > 0 ? '+' : ''}
                    {b.delta}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full border border-white/10 bg-black/40">
              <div className={`h-full rounded-full transition-[width] duration-500 ${b.color}`} style={{ width: `${b.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      {state?.headHash && (
        <p className="mt-3 break-all font-mono text-[10px] text-white/30">head {state.headHash.slice(0, 24)}…</p>
      )}
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  return (
    <div className="space-y-2">
      <div className="ml-auto max-w-[80%] rounded-lg rounded-br-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85">
        {turn.user}
      </div>
      <div className="flex items-start gap-2">
        <div className="max-w-[80%] rounded-lg rounded-bl-sm border border-violet-400/25 bg-violet-500/[0.06] px-3 py-2 text-sm text-white/85">
          {turn.reply}
          <span className="mt-1 block font-mono text-[10px] text-violet-300/70">{turn.mood}</span>
        </div>
      </div>
      <p className="font-mono text-[10px] text-white/25">
        engine read: {turn.move.moveType} · leverage {fmt(turn.move.applied.leverage)} · trust{' '}
        {fmt(turn.move.applied.trust)} · patience {fmt(turn.move.applied.patience)}
      </p>
    </div>
  );
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
