import Link from 'next/link';
import { LINEAGE, REPO_URL, STACK } from './site';

/**
 * GAMBIT YourMove — footer.
 *
 * Carries the one line that is the whole thesis, the stack (so a judge can see
 * the Gemini/Vertex/ADK requirement met at a glance), the lineage the
 * architecture is ported from, and the source + licence.
 */

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-line">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <p className="max-w-xl text-sm text-text-dim">
          The verdict is sealed by a deterministic fleet{' '}
          <span className="font-semibold text-text">before</span> any model is called. Gemini narrates and
          votes; it never decides.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {STACK.map((s) => (
            <span
              key={s}
              className="rounded border border-ink-line bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-text-faint"
            >
              {s}
            </span>
          ))}
        </div>

        <p className="mt-5 font-mono text-[11px] text-text-faint">
          Ported from{' '}
          {LINEAGE.map((l, i) => (
            <span key={l.name}>
              <span className="text-text-faint">{l.name}</span>
              {i < LINEAGE.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-faint">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-text">
            GitHub
          </a>
          <Link href="/architecture" className="transition hover:text-text">
            Architecture
          </Link>
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-text"
          >
            Apache-2.0
          </a>
          <span className="text-text-faint">© 2026 Anna Tchijova</span>
        </div>
      </div>
    </footer>
  );
}
