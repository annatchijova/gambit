import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

/**
 * TYPOGRAPHY — no `next/font/google` here, deliberately.
 *
 * `next/font/google` fetches font files from fonts.googleapis.com at BUILD
 * time. That turns every `next build` — including the Cloud Run build — into
 * a step that fails when the network is restricted, which is exactly the
 * situation a hackathon build should not be exposed to. The stack below is
 * resolved by the browser at runtime and needs no network at build time.
 *
 * If a specific typeface is chosen on the design pass (Day 3), self-host it
 * with `next/font/local` rather than reintroducing the fetch.
 */
export const metadata: Metadata = {
  title: 'GAMBIT YourMove',
  description:
    'Tactical AI copilot for high-stakes negotiations. Reads the tactic, shows the evidence, and leaves the move to you. Now with WATCH — an autonomous agent that triages a whole inbox in the background, seals a verdict for every message before any model runs, and escalates only what needs you.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink text-text">
        <Nav />
        <div className="relative flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
