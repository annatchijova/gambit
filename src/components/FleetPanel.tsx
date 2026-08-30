import type { CompositeVerdict, FleetLevel, SealedSignal } from '@/lib/frameworks';
import {
  FRAMEWORK_META,
  LEVEL_BAR,
  LEVEL_STYLE,
  LEVEL_TICKS,
  SEMANTIC_META,
  levelFromPercent,
} from './verdict_ui';

/**
 * GAMBIT YourMove — the fleet panel.
 *
 * Where the architecture becomes visible, in the dark forensic aesthetic of the
 * sibling tools: a stamped, sealed verdict (vigia-repo), a row of analyst agents
 * that light up (wolf-and-cronos), and a chain-of-custody strip. A row of
 * deterministic lenses reads the message; the Gemini lens sits beside them; the
 * rule engine and the model are shown agreeing or splitting, never averaged.
 *
 * All display. Every number here was decided and sealed server-side.
 */

export function FleetPanel({ verdict }: { verdict: CompositeVerdict }) {
  const { core, semantic, divergence } = verdict;
  const s = LEVEL_STYLE[verdict.level];
  const bestEffort = verdict.determinismLevel === 'best_effort_with_semantic';
  // The lenses are English patterns. When they could not read the message at
  // all, "CLEAN" would be a confident all-clear on something never read — so
  // the hero says so instead of showing a reassuring zero. See lib/frameworks/scope.ts.
  const outOfScope = core.coverage === 'out_of_scope';

  return (
    <section className="dot-grid overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {outOfScope && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300">
            Outside the rule engine&rsquo;s scope
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-amber-100/90">
            {core.scopeReason}
          </p>
        </div>
      )}

      {/* Verdict hero -------------------------------------------------------- */}
      <div className={`border-b border-white/8 p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              {outOfScope ? 'No reading available' : 'Sealed verdict'}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span
                className={`font-mono text-3xl font-bold tracking-tight ${
                  outOfScope ? 'text-amber-300' : s.text
                }`}
              >
                {outOfScope ? 'NO VERDICT' : verdict.level}
              </span>
              {!outOfScope && (
                <span className="font-mono text-lg tabular-nums text-white/40">
                  {verdict.scorePercent}%
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-md text-sm text-white/50">
              {outOfScope
                ? 'No rule matched, because none could read this message. That is not the same as finding nothing wrong.'
                : s.gloss}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`stamp ${bestEffort ? 'text-violet-300' : 'text-emerald-300'}`}>
              {bestEffort ? '◆ sealed + model' : '✓ sealed'}
            </span>
            <span className="text-xs text-white/40">{verdict.confidence} confidence</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${
                bestEffort
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
              title={
                bestEffort
                  ? 'The score includes the model’s vote and is not bit-for-bit replayable.'
                  : 'No usable model vote — this verdict is the deterministic core, replayable exactly.'
              }
            >
              {bestEffort ? 'best-effort' : 'deterministic · replayable'}
            </span>
          </div>
        </div>

        <ScoreBar compositePercent={verdict.scorePercent} corePercent={core.scorePercent} />
      </div>

      <div className="space-y-6 p-6">
        {/* Divergence: rule engine vs model -------------------------------- */}
        {divergence && semantic?.available && (
          <div>
            <SectionLabel n="01">Rule engine vs model</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <MethodCard title="Deterministic fleet" level={divergence.coreLevel} percent={core.scorePercent} />
              <MethodCard
                title={`Gemini · ${semantic.grid}/20`}
                level={divergence.semanticLevel}
                percent={semantic.severityPercent}
              />
            </div>
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                divergence.agree
                  ? 'border-white/10 bg-white/[0.02] text-white/55'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              {divergence.note}
            </p>
          </div>
        )}

        {/* Fleet grid ------------------------------------------------------ */}
        <div>
          <SectionLabel n="02">
            The fleet — {core.corroboration}/{core.signals.length} rule agents fired
            {core.gatePassed ? '' : ' · below gate'}
          </SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {core.signals.map((sig) => (
              <AgentCard
                key={sig.framework}
                signal={sig}
                fired={core.activeFrameworks.includes(sig.framework)}
              />
            ))}
            {semantic && <SemanticCard semantic={semantic} level={divergence?.semanticLevel} />}
          </div>
        </div>

        {/* Chain of custody ------------------------------------------------ */}
        <div>
          <SectionLabel n="03">Chain of custody</SectionLabel>
          <SealChain verdict={verdict} />
        </div>
      </div>
    </section>
  );
}

function ScoreBar({ compositePercent, corePercent }: { compositePercent: number; corePercent: number }) {
  return (
    <div className="mt-5">
      <div className="relative h-3 w-full rounded-full border border-white/10 bg-black/40">
        <div
          className="brand-gradient h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${compositePercent}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-white/80"
          style={{ left: `${corePercent}%` }}
          title={`Deterministic core alone: ${corePercent}%`}
        />
        {LEVEL_TICKS.map((t) => (
          <div key={t.label} className="absolute top-0 h-full w-px bg-white/15" style={{ left: `${t.at}%` }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-white/25">
        <span>clean</span>
        <span>mixed</span>
        <span>persuasive</span>
        <span>manip.</span>
      </div>
      <p className="mt-1.5 text-right font-mono text-[11px] tabular-nums text-white/40">
        composite {compositePercent}% · core marker {corePercent}%
      </p>
    </div>
  );
}

function MethodCard({ title, level, percent }: { title: string; level: FleetLevel; percent: number }) {
  const s = LEVEL_STYLE[level];
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
      <div className={`h-1 w-full ${LEVEL_BAR[level]}`} />
      <div className="p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{title}</p>
        <div className="mt-1 flex items-baseline justify-between">
          <span className={`font-mono text-sm font-bold ${s.text}`}>{level}</span>
          <span className="font-mono text-sm tabular-nums text-white/50">{percent}%</span>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ signal, fired }: { signal: SealedSignal; fired: boolean }) {
  const meta = FRAMEWORK_META[signal.framework];
  const accent = fired ? LEVEL_BAR[levelFromPercent(signal.severityPercent)] : 'bg-white/10';
  return (
    <div
      className={`overflow-hidden rounded-lg border transition ${
        fired
          ? 'border-fuchsia-500/30 bg-fuchsia-500/[0.05] shadow-[0_0_16px_rgba(168,85,247,0.12)]'
          : 'border-white/8 bg-white/[0.01]'
      }`}
    >
      <div className={`h-0.5 w-full ${accent}`} />
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${
              fired ? 'brand-gradient text-white' : 'bg-white/10 text-white/40'
            }`}
          >
            {meta.glyph}
          </span>
          <span className={`text-sm font-medium ${fired ? 'text-white/90' : 'text-white/40'}`}>
            {meta.name}
          </span>
          <span className="ml-auto font-mono text-xs tabular-nums text-white/45">
            {signal.severityPercent}%
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-white/35">{meta.lens}</p>
        {fired && signal.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {signal.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SemanticCard({
  semantic,
  level,
}: {
  semantic: NonNullable<CompositeVerdict['semantic']>;
  level?: FleetLevel;
}) {
  const active = semantic.available;
  return (
    <div
      className={`overflow-hidden rounded-lg border transition ${
        active
          ? 'border-violet-400/40 bg-violet-500/[0.06] shadow-[0_0_16px_rgba(217,70,239,0.12)]'
          : 'border-dashed border-white/15 bg-white/[0.01]'
      }`}
    >
      <div className={`h-0.5 w-full ${active && level ? LEVEL_BAR[level] : 'bg-white/10'}`} />
      <div className="p-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${
              active ? 'brand-gradient text-white' : 'bg-white/10 text-white/40'
            }`}
          >
            {SEMANTIC_META.glyph}
          </span>
          <span className={`text-sm font-medium ${active ? 'text-white/90' : 'text-white/40'}`}>
            {SEMANTIC_META.name}
          </span>
          <span className="ml-auto font-mono text-xs tabular-nums text-white/45">
            {active ? `${semantic.severityPercent}%` : 'silent'}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-white/35">{SEMANTIC_META.lens}</p>
        {active ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {level && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
                {level}
              </span>
            )}
            {semantic.tactic && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                {semantic.tactic}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-white/30">Model did not vote — core stands alone.</p>
        )}
      </div>
    </div>
  );
}

function SealChain({ verdict }: { verdict: CompositeVerdict }) {
  const links = [
    { label: 'deterministic core', hash: verdict.core.seal },
    { label: 'composite', hash: verdict.seal },
  ];
  return (
    <div className="rounded-lg border border-violet-500/20 bg-black/30 p-4 [animation:seal-pulse_3.5s_ease-in-out_infinite]">
      <ol className="space-y-3">
        {links.map((l) => (
          <li key={l.label} className="relative border-l-2 border-violet-400/40 pl-4">
            <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full brand-gradient" />
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{l.label}</p>
            <p className="break-all font-mono text-[11px] text-white/55">{l.hash}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-white/8 pt-3 text-xs text-white/40">
        The deterministic verdict was sealed <span className="brand-text font-semibold">before</span> the
        model was called. Swap or silence the model and the wording and best-effort score change — never the
        sealed core.
      </p>
    </div>
  );
}

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
      <span className="font-mono text-white/25">{n}</span>
      {children}
    </h3>
  );
}
