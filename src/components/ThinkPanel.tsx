'use client';

import { useState } from 'react';
import type { Stance, ThinkOutput } from '@/lib/schemas/think_schema';

/**
 * GAMBIT YourMove — THINK panel.
 *
 * Three drafts, side by side, none marked "recommended". Each is copyable so the
 * user can take it into their own inbox and edit — because GAMBIT does not send.
 * The one non-negotiable message here is the banner: nothing leaves this screen.
 */

const STANCE_META: Record<Stance, { label: string; accent: string; ring: string }> = {
  soft: { label: 'Soft', accent: 'text-emerald-300', ring: 'border-emerald-500/30' },
  tactical: { label: 'Tactical', accent: 'text-violet-300', ring: 'border-violet-400/30' },
  direct: { label: 'Direct', accent: 'text-amber-300', ring: 'border-amber-500/30' },
};

export function ThinkPanel({ think, mode }: { think: ThinkOutput; mode: 'live' | 'mock' }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
          Three ways to reply
        </h2>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-300">
          drafts only · nothing is sent
          {mode === 'mock' ? ' · fixture' : ''}
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/70">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Hold on to</span>
        <br />
        {think.principle}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {think.options.map((opt) => (
          <OptionCard key={opt.stance} option={opt} />
        ))}
      </div>

      <p className="mt-4 text-xs text-white/35">
        You choose and edit. GAMBIT drafts the board; it does not make the move.
      </p>
    </section>
  );
}

function OptionCard({ option }: { option: ThinkOutput['options'][number] }) {
  const meta = STANCE_META[option.stance];
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(option.draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be denied; the text is selectable in the box regardless.
    }
  }

  return (
    <div className={`flex flex-col rounded-lg border bg-black/20 ${meta.ring}`}>
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <span className={`font-mono text-xs font-bold uppercase tracking-wide ${meta.accent}`}>
          {meta.label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10px] text-white/40 transition hover:text-white/80"
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="whitespace-pre-wrap rounded border border-white/10 bg-black/30 p-2.5 text-sm leading-relaxed text-white/85 select-all">
          {option.draft}
        </p>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">Why</p>
          <p className="mt-0.5 text-[13px] text-white/55">{option.rationale}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">Watch out</p>
          <p className="mt-0.5 text-[13px] text-white/50">{option.watchOut}</p>
        </div>
      </div>
    </div>
  );
}
