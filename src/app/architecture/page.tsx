import Link from 'next/link';
import type { Metadata } from 'next';
import { PipelineDiagram } from '@/components/PipelineDiagram';
import { LINEAGE } from '@/components/site';

export const metadata: Metadata = {
  title: 'How it works — GAMBIT YourMove',
  description:
    'The architecture: a deterministic fleet seals the verdict before any model is called, and the model votes beside the rules.',
};

/**
 * /architecture — the "how it works" destination linked from the nav and footer.
 *
 * Static, server-rendered. It explains the one load-bearing decision — the model
 * is kept out of the sealed verdict — through the pipeline diagram and the three
 * guarantees that decision buys.
 */

const GUARANTEES = [
  {
    n: '01',
    title: 'Determinism',
    body: 'The four rule lenses use no model, no clock, no randomness, and no floating-point arithmetic. The same message yields the same verdict and the same SHA-256 seal on any machine — so a read can be replayed and verified, not just trusted.',
  },
  {
    n: '02',
    title: 'Corroboration',
    body: 'One lens firing is noise. A non-clean verdict needs at least two independent lenses to agree; below that gate the verdict is forced clean regardless of any single signal. The model can raise an alert the rules missed — and that disagreement is shown, never averaged away.',
  },
  {
    n: '03',
    title: 'Honest degradation',
    body: 'If the model does not answer, the deterministic verdict still stands — the fleet needs no key and no network. Any score that includes the model is flagged best-effort and not claimed replayable. The app never shows a confident read that was actually a fallback.',
  },
];

export default function Architecture() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <header>
        <p className="label">Architecture</p>
        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-read)] text-[2.3rem] font-normal leading-[1.15] tracking-[-0.02em] text-text">
          The model narrates the verdict.
          <br />
          It never decides it.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim">
          A language model can read the evidence correctly and still reach the wrong conclusion under
          narrative pressure. So in GAMBIT the model is kept out of the decision: a deterministic fleet
          computes and seals the verdict first, and the model only votes beside it and puts it into words.
        </p>
      </header>

      <PipelineDiagram />

      {/* The reading key. This page argues that a rule and a model are
          different kinds of witness; the interface already says so in the
          marks, so show that here rather than asserting it again in prose. */}
      <section>
        <h2 className="label mb-3">How to read a marked message</h2>
        <div className="paper rounded-sm px-7 py-6 sm:px-9 sm:py-7">
          <p className="m-0 text-[17px] leading-[1.8]">
            This price is{' '}
            <span className="mark" style={{ '--mark': 'var(--lens-cialdini)' } as React.CSSProperties}>
              only good until midnight
            </span>
            , and after everything I have done for you I think that is{' '}
            <span
              className="mark mark--model"
              style={{ '--mark': 'var(--lens-gemini)' } as React.CSSProperties}
            >
              more than fair
            </span>
            .
          </p>
          <dl className="mt-6 grid gap-x-8 gap-y-3 border-t pt-5 text-[13px] sm:grid-cols-2" style={{ borderColor: 'var(--paper-edge)' }}>
            <div>
              <dt className="font-semibold" style={{ color: 'var(--lens-cialdini)' }}>
                Solid — a rule
              </dt>
              <dd className="m-0 mt-1 leading-relaxed" style={{ color: 'var(--paper-faint)' }}>
                One of four deterministic lenses matched, and lifted this span from your text. Sealed
                before any model ran. Same message, same mark, every time.
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: 'var(--lens-gemini)' }}>
                Dashed — the model
              </dt>
              <dd className="m-0 mt-1 leading-relaxed" style={{ color: 'var(--paper-faint)' }}>
                Gemini quoted this. It catches paraphrase no rule anticipated, and it is best-effort:
                two runs can differ, so nothing it touches is claimed replayable.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 className="label mb-3">What that buys — three guarantees</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div
              key={g.title}
              className="rounded-sm border border-ink-line bg-ink-raised p-4"
              style={{ borderTopColor: 'var(--v-clean)', borderTopWidth: '2px' }}
            >
              <h3 className="text-sm font-semibold text-text">{g.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-ink-line bg-ink-raised p-6">
        <h2 className="label">Lineage</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">
          The architecture is ported from a family of deterministic manipulation-detection tools — the same
          DNA, applied to negotiation:
        </p>
        <ul className="mt-3 space-y-1.5">
          {LINEAGE.map((l) => (
            <li key={l.name} className="flex items-baseline gap-3 text-sm">
              <span className="font-mono font-semibold text-text">{l.name}</span>
              <span className="text-text-faint">{l.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex rounded-sm bg-paper px-5 py-2 text-sm font-semibold text-paper-ink transition hover:bg-white"
        >
          Try it on a message →
        </Link>
      </div>
    </main>
  );
}
