import type { CompositeVerdict, FleetLevel, SealedSignal } from '@/lib/frameworks';
import {
  FRAMEWORK_META,
  LEVEL_STYLE,
  LEVEL_TICKS,
  SEMANTIC_META,
} from './verdict_ui';

/**
 * GAMBIT YourMove — the fleet panel.
 *
 * This is where the architecture becomes visible. A row of analyst agents reads
 * the message; each lights up when it fires. A score bar shows where the
 * deterministic core landed and where the model's vote pulled it. A divergence
 * strip puts the rule engine and the model side by side — agreement or split,
 * shown, not averaged. And a seal strip proves the deterministic core was fixed
 * before any model was called.
 *
 * All display. Every number here was decided and sealed server-side; this
 * component only renders it.
 */

export function FleetPanel({ verdict }: { verdict: CompositeVerdict }) {
  const { core, semantic, divergence } = verdict;
  const composite = LEVEL_STYLE[verdict.level];
  const bestEffort = verdict.determinismLevel === 'best_effort_with_semantic';

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      {/* Header: composite verdict + honesty chips ------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold tracking-wide ${composite.badge}`}
          >
            {verdict.level}
          </span>
          <span className="text-sm text-white/50">{verdict.confidence} confidence</span>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${
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
          {bestEffort ? 'best-effort · includes model vote' : 'deterministic · replayable'}
        </span>
      </div>

      <p className="mt-2 text-sm text-white/45">{composite.gloss}</p>

      {/* Score bar with threshold ticks and the core marker --------------- */}
      <ScoreBar compositePercent={verdict.scorePercent} corePercent={core.scorePercent} />

      {/* Divergence: rule engine vs model -------------------------------- */}
      {divergence && semantic?.available && (
        <div className="mt-6">
          <SectionLabel>Rule engine vs model</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodCard title="Deterministic fleet" level={divergence.coreLevel} percent={core.scorePercent} />
            <MethodCard
              title={`Gemini (${semantic.grid}/20)`}
              level={divergence.semanticLevel}
              percent={semantic.severityPercent}
            />
          </div>
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              divergence.agree
                ? 'border-white/10 bg-white/[0.02] text-white/60'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            }`}
          >
            {divergence.note}
          </p>
        </div>
      )}

      {/* The fleet grid: four deterministic agents + the model ----------- */}
      <div className="mt-6">
        <SectionLabel>
          The fleet — {core.corroboration} of {core.signals.length} rule agents fired
          {core.gatePassed ? '' : ' (below corroboration gate)'}
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

      {/* Seal strip ------------------------------------------------------- */}
      <SealStrip verdict={verdict} />
    </section>
  );
}

function ScoreBar({ compositePercent, corePercent }: { compositePercent: number; corePercent: number }) {
  return (
    <div className="mt-5">
      <div className="relative h-3 w-full rounded-full border border-white/10 bg-black/40">
        <div
          className="brand-gradient h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${compositePercent}%` }}
        />
        {/* Where the deterministic core alone landed. */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/70"
          style={{ left: `${corePercent}%` }}
          title={`Deterministic core: ${corePercent}%`}
        />
        {LEVEL_TICKS.map((t) => (
          <div key={t.label} className="absolute top-0 h-full" style={{ left: `${t.at}%` }}>
            <div className="h-full w-px bg-white/15" />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-white/25">
        <span>clean</span>
        <span>mixed</span>
        <span>persuasive</span>
        <span>manipulative</span>
      </div>
      <p className="mt-1 text-right text-xs tabular-nums text-white/40">
        composite {compositePercent}% · core {corePercent}%
      </p>
    </div>
  );
}

function MethodCard({ title, level, percent }: { title: string; level: FleetLevel; percent: number }) {
  const s = LEVEL_STYLE[level];
  return (
    <div className={`rounded-lg border bg-black/20 p-3 ${s.ring}`}>
      <p className="text-[11px] uppercase tracking-widest text-white/35">{title}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${s.text}`}>{level}</span>
        <span className="text-sm tabular-nums text-white/50">{percent}%</span>
      </div>
    </div>
  );
}

function AgentCard({ signal, fired }: { signal: SealedSignal; fired: boolean }) {
  const meta = FRAMEWORK_META[signal.framework];
  return (
    <div
      className={`rounded-lg border p-3 transition ${
        fired
          ? 'border-fuchsia-500/40 bg-fuchsia-500/[0.06] shadow-[0_0_18px_rgba(168,85,247,0.15)]'
          : 'border-white/8 bg-white/[0.01]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
            fired ? 'brand-gradient text-white' : 'bg-white/10 text-white/40'
          }`}
        >
          {meta.glyph}
        </span>
        <span className={`text-sm font-medium ${fired ? 'text-white/90' : 'text-white/40'}`}>
          {meta.name}
        </span>
        <span className="ml-auto text-xs tabular-nums text-white/40">{signal.severityPercent}%</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-white/35">{meta.lens}</p>
      {fired && signal.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {signal.tags.map((t) => (
            <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
              {t}
            </span>
          ))}
        </div>
      )}
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
      className={`rounded-lg border p-3 transition ${
        active
          ? 'border-violet-400/50 bg-violet-500/[0.07] shadow-[0_0_18px_rgba(217,70,239,0.15)]'
          : 'border-dashed border-white/15 bg-white/[0.01]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
            active ? 'brand-gradient text-white' : 'bg-white/10 text-white/40'
          }`}
        >
          {SEMANTIC_META.glyph}
        </span>
        <span className={`text-sm font-medium ${active ? 'text-white/90' : 'text-white/40'}`}>
          {SEMANTIC_META.name}
        </span>
        <span className="ml-auto text-xs tabular-nums text-white/40">
          {active ? `${semantic.severityPercent}%` : 'silent'}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-white/35">{SEMANTIC_META.lens}</p>
      {active ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {level && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">{level}</span>}
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
  );
}

function SealStrip({ verdict }: { verdict: CompositeVerdict }) {
  return (
    <div className="mt-6 rounded-lg border border-violet-500/20 bg-black/30 p-3 [animation:seal-pulse_3s_ease-in-out_infinite]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-white/45">
        <span>
          <span className="text-white/30">core seal </span>
          {verdict.core.seal.slice(0, 20)}…
        </span>
        <span>
          <span className="text-white/30">composite </span>
          {verdict.seal.slice(0, 20)}…
        </span>
      </div>
      <p className="mt-2 text-xs text-white/40">
        The deterministic verdict was sealed <span className="brand-text font-semibold">before</span> the
        model was called. Swapping or silencing the model changes the wording and the best-effort score —
        never the sealed core.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{children}</h3>
  );
}
