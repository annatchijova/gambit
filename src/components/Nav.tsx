import Link from 'next/link';
import { REPO_URL } from './site';

/**
 * GAMBIT YourMove — top navigation.
 *
 * Sticky, quiet, and enough to make the app read as a product rather than a
 * bare form: the wordmark home-links, and the two things a visitor reaches for
 * — how it works, and the source — are one click away.
 */

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-line bg-ink/85 backdrop-blur-md">
      {/* Wraps rather than overflowing. Five links no longer fit one 390px row:
          before this, every page scrolled 253px sideways on a phone. */}
      <nav className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-paper font-mono text-xs font-bold text-paper-ink">
            G
          </span>
          <span className="text-sm font-semibold tracking-wide text-text">GAMBIT</span>
          <span className="label hidden sm:inline">YourMove</span>
        </Link>

        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[13px] sm:gap-x-1 sm:text-sm">
          <Link
            href="/fleet"
            className="rounded-sm px-2 py-1.5 text-text-dim transition hover:bg-white/[0.05] hover:text-text sm:px-3"
          >
            Fleet
          </Link>
          <Link
            href="/chat"
            className="rounded-sm px-2 py-1.5 text-text-dim transition hover:bg-white/[0.05] hover:text-text sm:px-3"
          >
            Assistant
          </Link>
          <Link
            href="/train"
            className="rounded-sm px-2 py-1.5 text-text-dim transition hover:bg-white/[0.05] hover:text-text sm:px-3"
          >
            Train
          </Link>
          <Link
            href="/architecture"
            className="rounded-sm px-2 py-1.5 text-text-dim transition hover:bg-white/[0.05] hover:text-text sm:px-3"
          >
            How it works
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-text-dim transition hover:bg-white/[0.05] hover:text-text sm:px-3"
          >
            <GitHubMark />
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}
