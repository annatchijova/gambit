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

/**
 * One lens, one hue — the palette the annotations are drawn in.
 *
 * `onPaper` is used for the mark laid under the counterparty's words (a light
 * surface); `lit` is the same hue raised to carry on the ink ground. Defined
 * here, beside the other presentation metadata, so a colour is never invented
 * at a call site and the margin list and the marks can never disagree.
 */
export const LENS_COLOR: Record<FrameworkName | 'gemini', { onPaper: string; lit: string }> = {
  grice: { onPaper: 'var(--lens-grice)', lit: 'var(--lens-grice-lit)' },
  cialdini: { onPaper: 'var(--lens-cialdini)', lit: 'var(--lens-cialdini-lit)' },
  aristotle: { onPaper: 'var(--lens-aristotle)', lit: 'var(--lens-aristotle-lit)' },
  berne: { onPaper: 'var(--lens-berne)', lit: 'var(--lens-berne-lit)' },
  gemini: { onPaper: 'var(--lens-gemini)', lit: 'var(--lens-gemini-lit)' },
};

/** Verdict hue, one warming ramp from quiet to alarmed. */
export const LEVEL_COLOR: Record<FleetLevel, string> = {
  CLEAN: 'var(--v-clean)',
  MIXED: 'var(--v-mixed)',
  PERSUASIVE: 'var(--v-persuasive)',
  MANIPULATIVE: 'var(--v-manipulative)',
};

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

/** Solid accent colour for a card's top edge, by level. */
export const LEVEL_BAR: Record<FleetLevel, string> = {
  CLEAN: 'bg-emerald-400/70',
  MIXED: 'bg-amber-400/80',
  PERSUASIVE: 'bg-orange-400/80',
  MANIPULATIVE: 'bg-rose-400/90',
};

/** Score-bar threshold marks, matching the engine's level thresholds. */
export const LEVEL_TICKS: Array<{ at: number; label: FleetLevel }> = [
  { at: 25, label: 'MIXED' },
  { at: 50, label: 'PERSUASIVE' },
  { at: 75, label: 'MANIPULATIVE' },
];

/**
 * Classify a display percentage into a level, on the same thresholds the engine
 * uses. Presentation only — for colouring an individual agent card by its own
 * severity. The authoritative levels come sealed from the server.
 */
export function levelFromPercent(pct: number): FleetLevel {
  if (pct >= 75) return 'MANIPULATIVE';
  if (pct >= 50) return 'PERSUASIVE';
  if (pct >= 25) return 'MIXED';
  return 'CLEAN';
}

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
