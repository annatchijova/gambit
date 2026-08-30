/**
 * GAMBIT YourMove — how it works, as a diagram.
 *
 * A first-time visitor lands here not knowing what the app is. This is the
 * answer: the pipeline a message travels, drawn so the one idea that matters is
 * unmissable — the verdict is SEALED by a deterministic fleet BEFORE any model
 * is called, and the model is one voter shown beside the rules, never over them.
 *
 * Pure presentation. No data; it describes the architecture, it does not run it.
 */

const STAGES: Array<{ n: string; title: string; body: string; glyphs?: string[]; accent?: boolean }> = [
  {
    n: '01',
    title: 'Inbound message',
    body: 'Paste what the counterparty actually sent you — the email, the DM, the offer.',
  },
  {
    n: '02',
    title: 'Deterministic fleet',
    body: 'Four rule-based lenses read it independently: Grice, Cialdini, Aristotle, Berne. No model runs here — same message, same result, every time.',
    glyphs: ['G', 'C', 'A', 'B'],
  },
  {
    n: '03',
    title: 'Sealed core verdict',
    body: 'The fleet’s verdict is sealed with SHA-256 before anything else happens. This number is fixed and replayable.',
    accent: true,
  },
  {
    n: '04',
    title: 'Gemini semantic vote',
    body: 'Only now does the model read the message and cast one vote — catching paraphrase and implication the rules miss. Best-effort, and it cannot change the sealed core.',
    glyphs: ['◆'],
  },
  {
    n: '05',
    title: 'Composite verdict + divergence',
    body: 'You see the blended read and, crucially, where the rule engine and the model agree or split — surfaced, never averaged into false certainty.',
  },
];

export function PipelineDiagram() {
  return (
    <div className="ruled rounded-sm border border-ink-line bg-ink-raised p-6">
      <div className="mb-5 flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">How it works</span>
        <span className="text-xs text-text-faint">— the model narrates the verdict; it never decides it.</span>
      </div>

      <ol className="space-y-0">
        {STAGES.map((s, i) => (
          <li key={s.n} className="relative pl-8">
            {/* connector line */}
            {i < STAGES.length - 1 && (
              <span className="absolute left-[11px] top-6 h-full w-px bg-gradient-to-b from-violet-400/50 to-violet-400/10" />
            )}
            {/* node dot */}
            <span
              className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                s.accent ? 'bg-paper text-paper-ink' : 'border border-ink-line bg-ink text-text-faint'
              }`}
            >
              {s.n}
            </span>
            <div className="pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-text">{s.title}</h4>
                {s.accent && (
                  <span className="stamp text-emerald-300" style={{ transform: 'rotate(-2deg)' }}>
                    ✓ sealed
                  </span>
                )}
                {s.glyphs && (
                  <span className="flex gap-1">
                    {s.glyphs.map((g) => (
                      <span
                        key={g}
                        className="flex h-5 w-5 items-center justify-center rounded-sm bg-paper font-mono text-[10px] font-bold text-paper-ink"
                      >
                        {g}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-dim">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
