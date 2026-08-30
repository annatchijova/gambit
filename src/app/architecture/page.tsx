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
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">
          The model narrates the verdict. It never decides it.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-dim">
          A language model can read the evidence correctly and still reach the wrong conclusion under
          narrative pressure. So in GAMBIT the model is kept out of the decision: a deterministic fleet
          computes and seals the verdict first, and the model only votes beside it and puts it into words.
        </p>
      </header>

      <PipelineDiagram />

      <section>
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">
          What that buys — three guarantees
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g.n} className="rounded-sm border border-ink-line bg-ink-raised p-4">
              <span className="font-mono text-xs text-text-faint">{g.n}</span>
              <h3 className="mt-1 text-sm font-semibold text-text">{g.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-ink-line bg-ink-raised p-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">Lineage</h2>
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
          className="inline-flex rounded-sm bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
        >
          Try it on a message →
        </Link>
      </div>
    </main>
  );
}
