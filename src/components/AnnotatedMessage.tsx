'use client';

import { useMemo, useState } from 'react';
import type { CompositeVerdict, FrameworkName } from '@/lib/frameworks';
import { FRAMEWORK_META, LENS_COLOR, SEMANTIC_META } from './verdict_ui';

/**
 * GAMBIT YourMove — the message, marked up.
 *
 * ============================================================================
 * WHY THE MESSAGE IS THE CENTREPIECE
 * ============================================================================
 *
 * The one rule this whole product obeys is that a claim it cannot quote is a
 * claim it does not make. Displaying those quotes as a list in a side panel
 * throws that away: the reader has to match fragments back to the message
 * themselves, and the connection between "urgency" and the actual words that
 * caused it is broken exactly where it matters.
 *
 * So the findings are drawn ON the message. Each lens underlines the span it
 * fired on, in its own colour. Hovering a lens in the margin isolates its
 * marks. The reader sees which words did the work, not a percentage.
 *
 * Two honesty rules are enforced here rather than assumed:
 *
 *   1. A span is only drawn if it is found VERBATIM in the message. Evidence
 *      that cannot be located is not approximated, not fuzzy-matched, and not
 *      silently dropped either — it is reported in the margin as unquotable.
 *      That case is meaningful: the deterministic lenses lift their spans from
 *      the raw text and always match, while Gemini is asked to quote and can
 *      fail to. When it does, the reader should know.
 *
 *   2. Overlapping spans resolve in fleet order, first claim wins. Deterministic
 *      and stable — the same verdict always draws the same marks.
 */

interface Span {
  start: number;
  end: number;
  lens: FrameworkName | 'gemini';
}

interface Unquotable {
  lens: FrameworkName | 'gemini';
  text: string;
}

/**
 * Why a lens ended up with no marks. Three different facts, and collapsing them
 * would misreport two of them:
 *   'none'      — it found nothing to say.
 *   'overlap'   — it quoted the message correctly, but another lens had already
 *                 marked that ground, so the span is drawn in the other's colour.
 *   'unquoted'  — it claimed something it could not point to in the message.
 */
type Absence = 'none' | 'overlap' | 'unquoted';

/** Ordered so overlap resolution is stable and matches the fleet's own order. */
const LENS_ORDER: ReadonlyArray<FrameworkName> = ['grice', 'cialdini', 'aristotle', 'berne'];

function locate(message: string, verdict: CompositeVerdict) {
  const spans: Span[] = [];
  const unquotable: Unquotable[] = [];
  const overlapped = new Set<FrameworkName | 'gemini'>();

  const claim = (lens: FrameworkName | 'gemini', text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const start = message.indexOf(trimmed);
    if (start === -1) {
      unquotable.push({ lens, text: trimmed });
      return;
    }
    const end = start + trimmed.length;
    // First claim wins: a later lens does not redraw ground already marked. The
    // quote was still valid, so record that rather than reporting it unquotable.
    if (spans.some((s) => start < s.end && end > s.start)) {
      overlapped.add(lens);
      return;
    }
    spans.push({ start, end, lens });
  };

  for (const lens of LENS_ORDER) {
    const signal = verdict.core.signals.find((s) => s.framework === lens);
    signal?.evidence.forEach((e) => claim(lens, e));
  }
  if (verdict.semantic?.available) {
    verdict.semantic.evidence.forEach((e) => claim('gemini', e));
  }

  spans.sort((a, b) => a.start - b.start);
  return { spans, unquotable, overlapped };
}

export function AnnotatedMessage({
  message,
  verdict,
}: {
  message: string;
  verdict: CompositeVerdict;
}) {
  const [isolated, setIsolated] = useState<FrameworkName | 'gemini' | null>(null);
  const { spans, unquotable, overlapped } = useMemo(
    () => locate(message, verdict),
    [message, verdict],
  );

  // Marked lenses, in fleet order, with what they found.
  const margin = useMemo(() => {
    const rows = LENS_ORDER.map((lens) => {
      const signal = verdict.core.signals.find((s) => s.framework === lens);
      return {
        lens: lens as FrameworkName | 'gemini',
        name: FRAMEWORK_META[lens].name,
        note: FRAMEWORK_META[lens].lens,
        percent: signal?.severityPercent ?? 0,
        marks: spans.filter((s) => s.lens === lens).length,
        tags: signal?.tags ?? [],
      };
    });
    if (verdict.semantic?.available) {
      rows.push({
        lens: 'gemini',
        name: SEMANTIC_META.name,
        note: SEMANTIC_META.lens,
        percent: verdict.semantic.severityPercent,
        marks: spans.filter((s) => s.lens === 'gemini').length,
        tags: verdict.semantic.tactic ? [verdict.semantic.tactic] : [],
      });
    }
    return rows;
  }, [verdict, spans]);

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) pieces.push(message.slice(cursor, span.start));
    const dimmed = isolated !== null && isolated !== span.lens;
    const lit = isolated === span.lens;
    pieces.push(
      <mark
        key={`m${i}`}
        style={{ '--mark': LENS_COLOR[span.lens].onPaper } as React.CSSProperties}
        className={[
          'mark bg-transparent text-inherit',
          span.lens === 'gemini' ? 'mark--model' : '',
          dimmed ? 'mark--muted' : '',
          lit ? 'mark--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {message.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < message.length) pieces.push(message.slice(cursor));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <figure className="paper m-0 rounded-sm px-7 py-6 sm:px-9 sm:py-8">
        <figcaption className="label mb-4 flex items-center gap-2 !text-[color:var(--paper-faint)]">
          <span className="h-px w-5 bg-[color:var(--paper-edge)]" />
          Their message
        </figcaption>
        <blockquote className="m-0 whitespace-pre-wrap text-[17px] leading-[1.75] tracking-[0.005em]">
          {pieces}
        </blockquote>
      </figure>

      <aside className="flex flex-col gap-1">
        <p className="label mb-2">
          {spans.length > 0 ? `${spans.length} marked` : 'Nothing marked'}
        </p>

        {margin.map((row) => {
          const c = LENS_COLOR[row.lens];
          const active = isolated === row.lens;
          // Three states, not two. A lens that found nothing and a lens that
          // found something it could not quote are different facts, and
          // collapsing them would hide exactly the case worth seeing: Gemini
          // voting while failing the quoting discipline the rules cannot fail.
          const absence: Absence =
            row.marks > 0
              ? 'none'
              : overlapped.has(row.lens)
                ? 'overlap'
                : row.percent > 0
                  ? 'unquoted'
                  : 'none';
          const silent = row.marks === 0 && row.percent === 0;
          const unquoted = row.marks === 0 && absence === 'unquoted';
          return (
            <button
              key={row.lens}
              type="button"
              disabled={row.marks === 0}
              onMouseEnter={() => setIsolated(row.lens)}
              onMouseLeave={() => setIsolated(null)}
              onFocus={() => setIsolated(row.lens)}
              onBlur={() => setIsolated(null)}
              onClick={() => setIsolated(active ? null : row.lens)}
              className={`group rounded-sm border-l-2 py-2 pl-3 pr-2 text-left transition ${
                silent ? 'cursor-default opacity-40' : ''
              } ${row.marks > 0 ? 'hover:bg-white/[0.04]' : ''} ${
                active ? 'bg-white/[0.06]' : ''
              }`}
              style={{
                borderLeftColor: silent ? 'var(--ink-line)' : unquoted ? 'var(--v-mixed)' : c.lit,
                borderLeftStyle: unquoted ? 'dashed' : 'solid',
              }}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: silent ? 'var(--text-faint)' : c.lit }}
                >
                  {row.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-text-faint">
                  {row.percent}%
                </span>
              </span>
              <span
                className="mt-0.5 block text-[11px] leading-snug"
                style={{ color: unquoted ? 'var(--v-mixed)' : 'var(--text-faint)' }}
              >
                {row.marks > 0
                  ? row.marks === 1
                    ? '1 span marked'
                    : `${row.marks} spans marked`
                  : silent
                    ? 'found nothing'
                    : absence === 'overlap'
                      ? 'same span, already marked above'
                      : 'voted, but quoted nothing found here'}
              </span>
            </button>
          );
        })}

        <p className="mt-3 border-t border-ink-line pt-3 text-[11px] leading-relaxed text-text-faint">
          Solid rules are deterministic lenses. The{' '}
          <span className="border-b-2 border-dashed" style={{ borderColor: 'var(--lens-gemini-lit)' }}>
            dashed
          </span>{' '}
          one is Gemini — a vote, not a rule.
        </p>

        {unquotable.length > 0 && (
          <p className="mt-2 rounded-sm border border-[color:var(--v-mixed)]/40 bg-[color:var(--v-mixed)]/10 px-2.5 py-2 text-[11px] leading-relaxed text-[color:var(--v-mixed)]">
            {unquotable.length === 1 ? 'One quote was' : `${unquotable.length} quotes were`} not
            found verbatim in the message and {unquotable.length === 1 ? 'is' : 'are'} not marked.
            Nothing is approximated here.
          </p>
        )}
      </aside>
    </div>
  );
}
