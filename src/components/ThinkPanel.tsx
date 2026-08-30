'use client';

import { useState } from 'react';
import type { Stance, ThinkOutput } from '@/lib/schemas/think_schema';

/**
 * GAMBIT YourMove — THINK panel.
 *
 * Three drafts, side by side, none marked "recommended". Each is copyable so the
 * user can take it into their own inbox and edit. The one non-negotiable message
 * is the banner: nothing leaves this screen.
 *
 * The three postures read on a cool-to-warm ramp borrowed from the lens palette —
 * soft (grice teal) to direct (cialdini coral) — so the temperature of the reply
 * is legible before a word is read.
 */

const STANCE_META: Record<Stance, { label: string; hue: string }> = {
  soft: { label: 'Soft', hue: 'var(--lens-grice-lit)' },
  tactical: { label: 'Tactical', hue: 'var(--lens-aristotle-lit)' },
  direct: { label: 'Direct', hue: 'var(--lens-cialdini-lit)' },
};

export function ThinkPanel({ think, mode }: { think: ThinkOutput; mode: 'live' | 'mock' }) {
  return (
    <section className="ruled rounded-sm border border-ink-line bg-ink-raised p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">Three ways to reply</h2>
        <span
          className="rounded-sm border px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wide"
          style={{
            color: 'var(--lens-aristotle-lit)',
            borderColor: 'color-mix(in srgb, var(--lens-aristotle-lit) 40%, transparent)',
            background: 'color-mix(in srgb, var(--lens-aristotle-lit) 8%, transparent)',
          }}
        >
          drafts only · nothing is sent{mode === 'mock' ? ' · fixture' : ''}
        </span>
      </div>

      <p className="mt-3 rounded-sm border border-ink-line bg-ink px-3 py-2 text-sm text-text-dim">
        <span className="label">Hold on to</span>
        <br />
        {think.principle}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {think.options.map((opt) => (
          <OptionCard key={opt.stance} option={opt} />
        ))}
      </div>

      <p className="mt-4 text-xs text-text-faint">
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
    <div
      className="flex flex-col rounded-sm border bg-ink"
      style={{ borderColor: 'color-mix(in srgb, ' + meta.hue + ' 32%, transparent)' }}
    >
      <div className="flex items-center justify-between border-b border-ink-line px-3 py-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: meta.hue }}>
          {meta.label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10px] text-text-faint transition hover:text-text"
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        {option.assumptions.length > 0 && (
          <div
            className="rounded-sm border-l-2 px-2.5 py-2"
            style={{
              borderColor: 'var(--lens-aristotle-lit)',
              background: 'color-mix(in srgb, var(--lens-aristotle-lit) 8%, transparent)',
            }}
          >
            <p className="label !text-[color:var(--lens-aristotle-lit)]">Confirm before sending</p>
            <ul className="mt-1 space-y-0.5">
              {option.assumptions.map((a, i) => (
                <li key={i} className="text-[13px] text-text-dim">
                  • {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="select-all whitespace-pre-wrap rounded-sm border border-ink-line bg-ink-raised p-2.5 text-sm leading-relaxed text-text">
          {option.draft}
        </p>
        <div>
          <p className="label">Gives away</p>
          <p className="mt-0.5 text-[13px] text-text-dim">{option.concedes}</p>
        </div>
        <div>
          <p className="label">Holds</p>
          <p className="mt-0.5 text-[13px] text-text-dim">{option.holds}</p>
        </div>
      </div>
    </div>
  );
}
