'use client';

import { useState } from 'react';
import type { Confidence, ReadOutput } from '@/lib/schemas/read_schema';

/**
 * READ result card.
 *
 * Day-1 scope: correct information architecture, restrained styling. The
 * visual pass belongs to Day 3 — but the hierarchy is already the one the
 * product argues for: the hypothesis and its confidence are inseparable, and
 * the competing readings are one click away, not buried.
 */

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  High: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Low: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const CONFIDENCE_HINT: Record<Confidence, string> = {
  High: 'Explicit, quotable evidence for this reading.',
  Medium: 'Supported, but the message is short or mixed.',
  Low: 'Inferred from tone or from very little text. Treat as a question, not an answer.',
};

export function ReadCard({ read, mode }: { read: ReadOutput; mode: 'live' | 'mock' }) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <section className="rounded-sm border border-ink-line bg-white/[0.03] p-6">
      {mode === 'mock' && (
        <p className="mb-4 rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs uppercase tracking-widest text-sky-300">
          Fixture response — GAMBIT_MOCK is enabled. No model was called.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-medium tracking-tight text-white">
          {read.likelyTactic}
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${CONFIDENCE_STYLE[read.confidence]}`}
          title={CONFIDENCE_HINT[read.confidence]}
        >
          {read.confidence} confidence
        </span>
      </div>

      <p className="mt-1 text-xs text-text-faint">{CONFIDENCE_HINT[read.confidence]}</p>

      <Block label="Evidence">
        <ul className="space-y-2">
          {read.evidence.map((quote, i) => (
            <li
              key={i}
              className="border-l-2 border-white/20 pl-3 text-sm italic text-text-dim"
            >
              “{quote}”
            </li>
          ))}
        </ul>
      </Block>

      <Block label="Subtext">
        <p className="text-sm leading-relaxed text-text">{read.subtext}</p>
      </Block>

      <Block label="Leverage">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field term="Your position" desc={read.leverageAssessment.userPosition} />
          <Field term="Their position" desc={read.leverageAssessment.opponentPosition} />
          <Field term="Primary risk" desc={read.leverageAssessment.primaryRisk} accent />
        </dl>
      </Block>

      <button
        type="button"
        onClick={() => setShowAlternatives((v) => !v)}
        className="mt-6 text-sm text-text-dim underline underline-offset-4 transition hover:text-text"
        aria-expanded={showAlternatives}
      >
        {showAlternatives ? 'Hide competing readings' : `Why this and not something else? (${read.alternatives.length})`}
      </button>

      {showAlternatives && (
        <ul className="mt-3 space-y-3">
          {read.alternatives.map((alt, i) => (
            <li key={i} className="rounded border border-ink-line bg-ink p-3">
              <p className="text-sm font-medium text-text">{alt.tactic}</p>
              <p className="mt-1 text-sm text-text-dim">{alt.why}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Field({ term, desc, accent }: { term: string; desc: string; accent?: boolean }) {
  return (
    <div>
      <dt className={`text-xs ${accent ? 'text-rose-300/80' : 'text-text-faint'}`}>{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-white/75">{desc}</dd>
    </div>
  );
}
