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
        <p className="label">Train</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-text">Practice the exchange.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim">
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
              className="rounded-sm border border-ink-line bg-ink-raised p-4 text-left transition hover:border-text-faint"
            >
              <p className="text-sm font-semibold text-text">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-dim">{s.premise}</p>
              <span className="mt-3 inline-block font-mono text-[10px] text-text-faint">start →</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">{scenario.title}</p>
              <p className="mt-0.5 max-w-xl text-xs text-text-dim">{scenario.premise}</p>
            </div>
            <button
              type="button"
              onClick={() => reset(null)}
              className="rounded-sm border border-ink-line px-3 py-1.5 text-xs text-text-dim transition hover:text-text"
            >
              change scenario
            </button>
          </div>

          <StateBars
            state={state}
            lastMove={turns.at(-1)?.move ?? null}
            chainValid={chainValid}
            mode={mode}
            round={turns.length}
          />

          {turns.length > 0 && (
            <div className="flex flex-col gap-3">
              {turns.map((t, i) => (
                <TurnBlock key={i} turn={t} />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-sm border-l-2 border-[color:var(--v-manipulative)] bg-[color:var(--v-manipulative)]/10 p-4">
              <p className="text-sm text-text">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={turns.length === 0 ? 'Open the negotiation — make your first move.' : 'Your reply…'}
              className="w-full resize-y rounded-sm border border-ink-line bg-ink p-4 text-sm leading-relaxed text-text outline-none transition placeholder:text-text-faint focus:border-[color:var(--lens-aristotle-lit)]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">
                The counterparty adapts, but the numbers are the engine’s — not the model’s.
              </span>
              <button
                type="button"
                onClick={send}
                disabled={sending || input.trim().length === 0}
                className="rounded-sm bg-paper px-5 py-2 text-sm font-semibold text-paper-ink transition hover:bg-white disabled:cursor-not-allowed disabled:bg-ink-line disabled:text-text-faint"
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
  const bars: Array<{ label: string; value: number; delta: number; hue: string }> = [
    { label: 'Your leverage', value: state?.perceivedUserLeverage ?? 50, delta: lastMove?.applied.leverage ?? 0, hue: 'var(--lens-berne-lit)' },
    { label: 'Trust', value: state?.trust ?? 50, delta: lastMove?.applied.trust ?? 0, hue: 'var(--v-clean)' },
    { label: 'Patience', value: state?.patience ?? 50, delta: lastMove?.applied.patience ?? 0, hue: 'var(--v-mixed)' },
  ];

  return (
    <div className="ruled rounded-sm border border-ink-line bg-ink-raised p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="label">
          Counterparty’s model of you {round > 0 ? `· round ${round}` : '· seeded'}
        </p>
        <span
          className="rounded-sm border px-2.5 py-0.5 font-mono text-[10px]"
          style={{
            color: chainValid ? 'var(--v-clean)' : 'var(--v-manipulative)',
            borderColor: `color-mix(in srgb, ${chainValid ? 'var(--v-clean)' : 'var(--v-manipulative)'} 40%, transparent)`,
            background: `color-mix(in srgb, ${chainValid ? 'var(--v-clean)' : 'var(--v-manipulative)'} 9%, transparent)`,
          }}
        >
          {chainValid ? 'chain verified' : 'chain broken'}
          {mode === 'mock' ? ' · fixture' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-text-dim">{b.label}</span>
              <span className="font-mono tabular-nums text-text-dim">
                {b.value}
                {b.delta !== 0 && (
                  <span style={{ color: b.delta > 0 ? 'var(--v-clean)' : 'var(--v-manipulative)' }}>
                    {' '}
                    {b.delta > 0 ? '+' : ''}
                    {b.delta}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-ink-line bg-ink">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${b.value}%`, background: b.hue }}
              />
            </div>
          </div>
        ))}
      </div>
      {state?.headHash && (
        <p className="mt-3 break-all font-mono text-[10px] text-text-faint">head {state.headHash.slice(0, 24)}…</p>
      )}
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  return (
    <div className="space-y-2">
      <div className="ml-auto max-w-[80%] rounded-sm border border-ink-line bg-ink-raised px-3 py-2 text-sm text-text">
        {turn.user}
      </div>
      <div className="flex items-start gap-2">
        <div
          className="max-w-[80%] rounded-sm border border-ink-line bg-ink-raised px-3 py-2 text-sm text-text"
          style={{ borderLeft: '2px dashed color-mix(in srgb, var(--lens-gemini-lit) 55%, transparent)' }}
        >
          {turn.reply}
          <span className="mt-1 block font-mono text-[10px] text-text-faint">{turn.mood}</span>
        </div>
      </div>
      <p className="font-mono text-[10px] text-text-faint">
        engine read: {turn.move.moveType} · leverage {fmt(turn.move.applied.leverage)} · trust{' '}
        {fmt(turn.move.applied.trust)} · patience {fmt(turn.move.applied.patience)}
      </p>
    </div>
  );
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
