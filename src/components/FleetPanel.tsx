'use client';

import { useState } from 'react';
import type { CompositeVerdict } from '@/lib/frameworks';
import { LENS_COLOR, LEVEL_COLOR, LEVEL_STYLE, LEVEL_TICKS, levelFromPercent } from './verdict_ui';
import { SealVerifier } from './SealVerifier';

/**
 * GAMBIT YourMove — the instrument panel.
 *
 * This sits BELOW the annotated message, and that order is the argument: the
 * evidence is the thing, and everything here is a reading of it. So the panel
 * carries only what the marked-up text cannot say for itself —
 *
 *   the verdict and how sure it is;
 *   where the rules and the model disagree;
 *   proof that none of it was altered after sealing.
 *
 * The per-lens grid that used to live here is gone: AnnotatedMessage's margin
 * says the same thing while pointing at the words that caused it, and saying it
 * twice made the page long without making it clearer.
 *
 * All display. Every number here was decided and sealed server-side.
 */

export function FleetPanel({ verdict }: { verdict: CompositeVerdict }) {
  // Progressive disclosure: the sealed verdict headline stays; the dense
  // secondary detail (rules-vs-model scale, chain-of-custody hashes, VERIFY
  // SEAL) is one click away, not gone — the seal must still be verifiable.
  const [showDetail, setShowDetail] = useState(false);
  const { core, semantic, divergence } = verdict;
  const style = LEVEL_STYLE[verdict.level];
  const bestEffort = verdict.determinismLevel === 'best_effort_with_semantic';
  // The lenses are English patterns. When they could not read the message at
  // all, a clean-looking zero would be a confident all-clear on something never
  // read. See lib/frameworks/scope.ts.
  const outOfScope = core.coverage === 'out_of_scope';
  const modelSpoke = Boolean(semantic?.available);

  return (
    <section className="overflow-hidden rounded-sm border border-ink-line bg-ink-raised">
      {outOfScope && (
        <div
          className="border-b border-ink-line px-6 py-3.5"
          style={{ background: 'color-mix(in srgb, var(--v-mixed) 12%, transparent)' }}
        >
          <p className="label" style={{ color: 'var(--v-mixed)' }}>
            Outside the rule engine&rsquo;s scope
          </p>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text">
            {core.scopeReason}
          </p>
        </div>
      )}

      {/* Verdict ------------------------------------------------------------ */}
      <div className="ruled flex flex-wrap items-start justify-between gap-x-10 gap-y-5 border-b border-ink-line p-6">
        <div className="min-w-0">
          <p className="label">
            {outOfScope ? 'Model-only reading — nothing sealed by the rules' : 'Sealed verdict'}
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span
              className="font-mono text-[2rem] font-bold leading-none tracking-tight"
              style={{ color: modelSpoke ? LEVEL_COLOR[verdict.level] : 'var(--v-mixed)' }}
            >
              {modelSpoke || !outOfScope ? verdict.level : 'NO VERDICT'}
            </span>
            {(modelSpoke || !outOfScope) && (
              <span className="font-mono text-lg tabular-nums text-text-faint">
                {verdict.scorePercent}%
              </span>
            )}
          </div>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-text-dim">
            {outOfScope
              ? modelSpoke
                ? 'Gemini read this message; the rules could not. Nothing here is corroborated by a deterministic lens, so it rests on one unverifiable opinion.'
                : 'No rule matched, because none could read this message — and the model did not answer either. That is not the same as finding nothing wrong.'
              : style.gloss}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <span
            className="stamp"
            style={{ color: bestEffort ? 'var(--lens-gemini-lit)' : 'var(--v-clean)' }}
          >
            {bestEffort ? '◆ sealed + model' : '✓ sealed'}
          </span>
          <span className="label !tracking-[0.12em]">{verdict.confidence} confidence</span>
          <span
            className="rounded-sm border px-2.5 py-1 font-mono text-[10px] tracking-wide"
            style={{
              color: outOfScope || bestEffort ? 'var(--v-mixed)' : 'var(--v-clean)',
              borderColor: `color-mix(in srgb, ${
                outOfScope || bestEffort ? 'var(--v-mixed)' : 'var(--v-clean)'
              } 45%, transparent)`,
            }}
            title={
              bestEffort
                ? 'The score includes the model’s vote and is not bit-for-bit replayable.'
                : 'No usable model vote — this verdict is the deterministic core, replayable exactly.'
            }
          >
            {outOfScope
              ? 'model only · rules out of scope'
              : bestEffort
                ? 'best-effort'
                : 'deterministic · replayable'}
          </span>
        </div>
      </div>

      <div className={`px-6 py-3 ${showDetail ? 'border-b border-ink-line' : ''}`}>
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-sm text-text-dim underline underline-offset-4 transition hover:text-text"
          aria-expanded={showDetail}
        >
          {showDetail ? 'Hide the full read ↑' : 'Show the full read ↓'}
        </button>
      </div>

      {showDetail && (
      <div className="space-y-7 p-6">
        {/* Where the two readers land -------------------------------------- */}
        {divergence && semantic?.available && (
          <div>
            <h3 className="label mb-4">Rules and model, on one scale</h3>
            <ReadingScale
              rulesPercent={core.scorePercent}
              modelPercent={semantic.severityPercent}
              agree={divergence.agree}
            />
            <p
              className="mt-4 rounded-sm border-l-2 px-3.5 py-2.5 text-[13px] leading-relaxed"
              style={
                divergence.agree
                  ? { borderColor: 'var(--ink-line)', color: 'var(--text-dim)' }
                  : {
                      borderColor: 'var(--v-mixed)',
                      background: 'color-mix(in srgb, var(--v-mixed) 9%, transparent)',
                      color: 'var(--text)',
                    }
              }
            >
              {divergence.note}
            </p>
          </div>
        )}

        {/* Chain of custody ------------------------------------------------- */}
        <div className="space-y-3">
          <h3 className="label">Chain of custody</h3>
          <SealChain verdict={verdict} />
          {/* The claim above is checkable, so let the reader check it. */}
          <SealVerifier verdict={verdict} />
        </div>
      </div>
      )}
    </section>
  );
}

/**
 * One axis, two markers.
 *
 * The old panel put the rules and the model in two cards side by side, which
 * shows both numbers and hides the only thing worth seeing: the DISTANCE
 * between them. On a shared scale, agreement is two markers nearly touching and
 * a split is a visible gap — the architecture's whole point, read at a glance.
 */
function ReadingScale({
  rulesPercent,
  modelPercent,
  agree,
}: {
  rulesPercent: number;
  modelPercent: number;
  agree: boolean;
}) {
  const lo = Math.min(rulesPercent, modelPercent);
  const hi = Math.max(rulesPercent, modelPercent);

  return (
    <div className="pt-7">
      <div className="relative h-9 rounded-sm border border-ink-line bg-ink">
        {/* Level bands, so a position means something without reading numbers. */}
        {LEVEL_TICKS.map((t) => (
          <span
            key={t.label}
            className="absolute top-0 h-full w-px bg-ink-line"
            style={{ left: `${t.at}%` }}
          />
        ))}

        {/* The gap between the two readings, drawn as a gap. */}
        {!agree && (
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2"
            style={{
              left: `${lo}%`,
              width: `${hi - lo}%`,
              background:
                'repeating-linear-gradient(90deg, var(--v-mixed) 0 3px, transparent 3px 6px)',
            }}
          />
        )}

        <Marker percent={rulesPercent} color="var(--v-clean)" label="rules" solid above />
        <Marker
          percent={modelPercent}
          color={LENS_COLOR.gemini.lit}
          label="gemini"
          solid={false}
          above={false}
        />
      </div>

      {/* Band names sit at the position each band STARTS, not spread evenly —
          the label has to mean the same thing as the tick beside it. */}
      <div className="relative mt-14 h-3">
        {(
          [
            { at: 0, name: 'clean' },
            { at: 25, name: 'mixed' },
            { at: 50, name: 'persuasive' },
            { at: 75, name: 'manip.' },
          ] as const
        ).map((b) => (
          <span
            key={b.name}
            className="label absolute top-0 !text-[9px]"
            style={{ left: `${b.at}%`, transform: b.at === 0 ? 'none' : 'translateX(2px)' }}
          >
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * One reader's position on the scale. `above` puts the label over the bar and
 * `!above` under it, so two markers landing on nearly the same score cannot
 * overprint each other — which is precisely the case worth reading clearly.
 */
function Marker({
  percent,
  color,
  label,
  solid,
  above,
}: {
  percent: number;
  color: string;
  label: string;
  solid: boolean;
  above: boolean;
}) {
  const stem = solid
    ? { background: color }
    : { backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0 3px, transparent 3px 6px)` };
  return (
    <span
      className={`absolute flex -translate-x-1/2 flex-col items-center ${
        above ? '-top-6' : 'top-full'
      }`}
      style={{ left: `${percent}%` }}
    >
      {above && (
        <span
          className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color }}
        >
          {label} {percent}%
        </span>
      )}
      <span className={above ? 'mt-0.5 h-[38px] w-0.5' : 'h-3 w-0.5'} style={stem} />
      {!above && (
        <span
          className="mt-0.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color }}
        >
          {label} {percent}%
        </span>
      )}
    </span>
  );
}

function SealChain({ verdict }: { verdict: CompositeVerdict }) {
  const links = [
    { label: 'deterministic core', hash: verdict.core.seal },
    { label: 'composite', hash: verdict.seal },
  ];
  return (
    <div className="rounded-sm border border-ink-line bg-ink p-4">
      <ol className="m-0 list-none space-y-3 p-0">
        {links.map((l) => (
          <li key={l.label} className="relative border-l pl-4" style={{ borderColor: 'var(--v-clean)' }}>
            <span
              className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--v-clean)' }}
            />
            <p className="label">{l.label}</p>
            <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-text-dim">
              {l.hash}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3.5 border-t border-ink-line pt-3.5 text-xs leading-relaxed text-text-faint">
        The deterministic verdict was sealed <span className="font-semibold text-text">before</span>{' '}
        the model was called. Swap or silence the model and the wording and the best-effort score
        change — never the sealed core.
      </p>
    </div>
  );
}

export { levelFromPercent };
