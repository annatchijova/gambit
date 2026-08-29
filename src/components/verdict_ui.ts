import type { FleetLevel, FrameworkName } from '@/lib/frameworks';

/**
 * GAMBIT YourMove — presentation metadata for the fleet UI.
 *
 * Client-safe: type-only imports from the frameworks barrel, so none of the
 * server-only engine code (node:crypto) is pulled into the bundle. This file
 * holds only how things LOOK — colours, labels, thresholds — never how the
 * verdict is computed.
 */

export interface LevelStyle {
  /** Tailwind classes for a filled badge at this level. */
  badge: string;
  /** Text colour class. */
  text: string;
  /** Border/ring accent. */
  ring: string;
  /** One-line gloss for the audit panel. */
  gloss: string;
}

export const LEVEL_STYLE: Record<FleetLevel, LevelStyle> = {
  CLEAN: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    text: 'text-emerald-300',
    ring: 'border-emerald-500/40',
    gloss: 'No corroborated manipulation signature.',
  },
  MIXED: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    text: 'text-amber-300',
    ring: 'border-amber-500/40',
    gloss: 'Some signals, no clear pattern. Common in ordinary messages.',
  },
  PERSUASIVE: {
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    text: 'text-orange-300',
    ring: 'border-orange-500/40',
    gloss: 'Active persuasion. May be legitimate — weigh the sender’s interest.',
  },
  MANIPULATIVE: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/50',
    text: 'text-rose-300',
    ring: 'border-rose-500/50',
    gloss: 'Several techniques converging to override judgement.',
  },
};

/** Score-bar threshold marks, matching the engine's level thresholds. */
export const LEVEL_TICKS: Array<{ at: number; label: FleetLevel }> = [
  { at: 25, label: 'MIXED' },
  { at: 50, label: 'PERSUASIVE' },
  { at: 75, label: 'MANIPULATIVE' },
];

export interface FrameworkMeta {
  /** Single-glyph badge for the agent grid. */
  glyph: string;
  name: string;
  /** What this lens looks for, one line. */
  lens: string;
}

export const FRAMEWORK_META: Record<FrameworkName, FrameworkMeta> = {
  grice: { glyph: 'G', name: 'Grice', lens: 'Cooperative Principle — evasion, obfuscation' },
  cialdini: { glyph: 'C', name: 'Cialdini', lens: 'Influence tactics — urgency, authority, scarcity' },
  aristotle: { glyph: 'A', name: 'Aristotle', lens: 'Rhetorical balance — pathos over logos' },
  berne: { glyph: 'B', name: 'Berne', lens: 'Transactional analysis — ulterior moves' },
};

/** Display metadata for the model lens, which sits beside the deterministic four. */
export const SEMANTIC_META = {
  glyph: '◆',
  name: 'Gemini',
  lens: 'Semantic analyst — paraphrase, implication (best-effort vote)',
} as const;
