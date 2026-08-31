'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FleetLevel } from '@/lib/frameworks';
import { LEVEL_STYLE } from '@/components/verdict_ui';
import type { Disposition } from '@/lib/watch/sentinel';

/**
 * WATCH — the autonomous mode's dashboard.
 *
 * It runs one background pass over the inbox (GET /api/watch?draft=1) and shows
 * what the agent did without being asked: what it archived on its own, what it
 * kept on watch, and the small set it decided needed a human — with drafts
 * already staged. The decision path that produced this is deterministic and
 * sealed (see src/lib/watch/sentinel.ts); this page only renders it. There is
 * still no send button anywhere.
 */

interface ThinkOption {
  stance: 'soft' | 'tactical' | 'direct';
  label: string;
  draft: string;
  concedes: string;
  holds: string;
  assumptions: string[];
}
interface ThinkOutput {
  principle: string;
  options: ThinkOption[];
}
type DraftResult = { ok: true; think: ThinkOutput } | { ok: false; reason: string };

interface WatchEntry {
  seq: number;
  id: string;
  from: string;
  scenario: string;
  message: string;
  level: FleetLevel;
  scorePercent: number;
  confidence: string;
  corroboration: number;
  activeFrameworks: string[];
  coverage: 'in_scope' | 'out_of_scope';
  disposition: Disposition;
  reason: string;
  verdictSeal: string;
  prevHash: string | null;
  hash: string;
  draft: DraftResult | null;
}

interface WatchResponse {
  mode: 'live' | 'mock';
  meta: { completedAt: string; inboxSize: number; drafted: number; draftFailures: number; elapsedMs: number };
  counts: Record<Disposition, number>;
  chain: { head: string | null; verifiedThroughIndex: number; intact: boolean };
  entries: WatchEntry[];
}

const DISPOSITION_META: Record<Disposition, { title: string; blurb: string; accent: string }> = {
  ESCALATED: {
    title: 'Escalated to you',
    blurb: 'Corroborated pressure. The agent staged drafts and stopped — your call.',
    accent: 'var(--v-manipulative, #d9513c)',
  },
  WATCH: {
    title: 'On watch',
    blurb: 'A weak or unreadable signal. Held, not escalated, not archived.',
    accent: 'var(--v-persuasive, #cf9a24)',
  },
  ARCHIVED: {
    title: 'Archived on its own',
    blurb: 'No corroborated signal. Handled silently — you were never interrupted.',
    accent: 'var(--v-clean, #1f9e8a)',
  },
};

function shortHash(h: string | null): string {
  if (!h) return '—';
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export default function WatchPage() {
  const [data, setData] = useState<WatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/watch?draft=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`The watch pass returned ${res.status}.`);
      setData((await res.json()) as WatchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The watch pass failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <main
      style={{ background: 'var(--ink, #191613)', color: 'var(--text, #f4efe6)' }}
      className="min-h-screen px-6 py-10 sm:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-faint, #8f8677)' }}>
            GAMBIT · autonomous mode
          </p>
          <h1 className="mt-2 text-3xl font-semibold">WATCH — the inbox reads itself</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-dim, #c2b9aa)' }}>
            One background pass. The agent reads every message, seals a verdict for each before any
            model is called, decides on its own what to archive and what needs you, and pre-stages
            drafts only for what it escalates. It does the heavy lifting. It never sends.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void run()}
              disabled={loading}
              className="rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{ borderColor: 'var(--ink-line, #3a322b)', background: 'var(--ink-raised, #221d18)' }}
            >
              {loading ? 'Running pass…' : 'Run watch pass'}
            </button>
            {data && (
              <span className="text-xs" style={{ color: 'var(--text-faint, #8f8677)' }}>
                {data.mode === 'live' ? 'live · Gemini on Vertex AI' : 'mock mode'} · read{' '}
                {data.meta.inboxSize} messages in {data.meta.elapsedMs} ms ·{' '}
                {new Date(data.meta.completedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        {error && (
          <div
            className="mb-6 rounded-md border px-4 py-3 text-sm"
            style={{ borderColor: '#d9513c66', background: '#d9513c14', color: '#f18a72' }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(['ESCALATED', 'WATCH', 'ARCHIVED'] as Disposition[]).map((d) => (
                <div
                  key={d}
                  className="rounded-lg border p-4"
                  style={{ borderColor: 'var(--ink-line, #3a322b)', background: 'var(--ink-raised, #221d18)' }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium" style={{ color: DISPOSITION_META[d].accent }}>
                      {DISPOSITION_META[d].title}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">{data.counts[d]}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-faint, #8f8677)' }}>
                    {DISPOSITION_META[d].blurb}
                  </p>
                </div>
              ))}
            </section>

            <section
              className="mb-8 rounded-lg border px-4 py-3 text-xs"
              style={{ borderColor: 'var(--ink-line, #3a322b)', background: 'var(--ink-raised, #221d18)' }}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-medium" style={{ color: data.chain.intact ? '#5ecdb8' : '#f18a72' }}>
                  {data.chain.intact ? 'Chain intact' : 'Chain broken'}
                </span>
                <span style={{ color: 'var(--text-faint, #8f8677)' }}>
                  {data.entries.length} decisions sealed and chained · head{' '}
                  <code>{shortHash(data.chain.head)}</code>
                </span>
                <span style={{ color: 'var(--text-faint, #8f8677)' }}>
                  drafts staged {data.meta.drafted}
                  {data.meta.draftFailures > 0 ? ` · ${data.meta.draftFailures} deferred` : ''}
                </span>
              </div>
            </section>

            {(['ESCALATED', 'WATCH', 'ARCHIVED'] as Disposition[]).map((d) => {
              const group = data.entries.filter((e) => e.disposition === d);
              if (group.length === 0) return null;
              return (
                <section key={d} className="mb-10">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: DISPOSITION_META[d].accent }}>
                    {DISPOSITION_META[d].title} · {group.length}
                  </h2>
                  <div className="space-y-4">
                    {group.map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                  </div>
                </section>
              );
            })}

            <footer className="mt-12 border-t pt-6 text-xs" style={{ borderColor: 'var(--ink-line, #3a322b)', color: 'var(--text-faint, #8f8677)' }}>
              GAMBIT drafted. You decide, you edit, you send. There is no send button here either.
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

function EntryCard({ entry }: { entry: WatchEntry }) {
  const style = LEVEL_STYLE[entry.level];
  return (
    <article
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--ink-line, #3a322b)', background: 'var(--ink-raised, #221d18)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${style.badge}`}>
          {entry.level} · {entry.scorePercent}%
        </span>
        <span className="text-xs" style={{ color: 'var(--text-faint, #8f8677)' }}>
          {entry.from} · {entry.scenario} · confidence {entry.confidence}
        </span>
        {entry.activeFrameworks.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-faint, #8f8677)' }}>
            lenses: {entry.activeFrameworks.join(', ')}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text, #f4efe6)' }}>
        “{entry.message}”
      </p>

      <p className="mt-2 text-xs italic" style={{ color: 'var(--text-dim, #c2b9aa)' }}>
        {entry.reason}
      </p>

      <div className="mt-2 font-mono text-[10px]" style={{ color: 'var(--text-faint, #8f8677)' }}>
        seal {shortHash(entry.verdictSeal)} · prev {shortHash(entry.prevHash)} → {shortHash(entry.hash)}
      </div>

      {entry.draft && <DraftBlock draft={entry.draft} />}
    </article>
  );
}

function DraftBlock({ draft }: { draft: DraftResult }) {
  if (!draft.ok) {
    return (
      <p className="mt-4 rounded border px-3 py-2 text-xs" style={{ borderColor: '#cf9a2455', color: '#efc158' }}>
        Draft deferred: {draft.reason}
      </p>
    );
  }
  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--ink-line, #3a322b)' }}>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-dim, #c2b9aa)' }}>
        <span className="font-medium">Staged for you — </span>
        {draft.think.principle}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {draft.think.options.map((o) => (
          <div
            key={o.stance}
            className="rounded border p-3"
            style={{ borderColor: 'var(--ink-line, #3a322b)', background: 'var(--ink, #191613)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text, #f4efe6)' }}>
              {o.stance} · {o.label}
            </div>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-dim, #c2b9aa)' }}>
              {o.draft}
            </p>
            <p className="mt-2 text-[10px]" style={{ color: 'var(--text-faint, #8f8677)' }}>
              concedes: {o.concedes}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-faint, #8f8677)' }}>
              holds: {o.holds}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
