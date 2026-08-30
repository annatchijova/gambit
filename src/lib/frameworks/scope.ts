/**
 * GAMBIT YourMove — lexical scope guard.
 *
 * ============================================================================
 * THE HOLE THIS CLOSES
 * ============================================================================
 *
 * Every lens in the fleet is an ENGLISH lexical pattern. Hand it a message in
 * another language and no pattern fires, so `runFleet` reports CLEAN, zero
 * corroboration — and, because a quiet fleet with nothing crashed is treated as
 * a confident read, HIGH confidence.
 *
 * That is a confident all-clear on a message the engine never actually read. It
 * is the one silent degradation left in an architecture whose entire claim is
 * that it has none: "no patterns matched" and "nothing to worry about" are
 * different statements, and only the first one is true here.
 *
 * So before a CLEAN verdict is believed, ask a cheaper question: could these
 * lenses have looked at all? If the answer is no, the honest output is "out of
 * scope", not "clean".
 *
 * WHAT THIS IS NOT. This is not language identification. It does not name the
 * language, and it is not asked to: the only decision it informs is whether an
 * English lexicon had a fair chance. A deliberately crude, dependency-free,
 * deterministic test is the right size for that question — and it errs toward
 * IN_SCOPE, because wrongly telling a user their English message is
 * unreadable is worse than the CLEAN they would otherwise have seen.
 *
 * Pure and deterministic: no model, no clock, no network, no randomness.
 */

/**
 * High-frequency English function words. Function words are used because they
 * are what a lexicon-based reader depends on and what a translation removes:
 * content words survive borrowing ("email", "ok", "no"), grammar does not.
 */
const ENGLISH_FUNCTION_WORDS = new Set([
  'the', 'be', 'is', 'are', 'was', 'were', 'been', 'to', 'of', 'and', 'a', 'an',
  'in', 'that', 'this', 'these', 'those', 'have', 'has', 'had', 'i', 'you',
  'we', 'they', 'he', 'she', 'it', 'not', 'on', 'with', 'as', 'at', 'but',
  'for', 'from', 'by', 'or', 'if', 'so', 'my', 'your', 'our', 'their', 'me',
  'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'about',
  'there', 'what', 'when', 'which', 'who', 'because', 'just', 'more', 'than',
  'any', 'all', 'up', 'out', 'no', 'know', 'get', 'like', 'want', 'need',
]);

/**
 * Below this many words the density test is meaningless — a three-word English
 * reply can easily contain no function word at all. Short messages are always
 * treated as in scope.
 */
const MIN_WORDS_FOR_TEST = 8;

/**
 * Share of tokens that must be English function words. Set low on purpose:
 * this must not fire on terse, jargon-heavy or number-heavy English.
 */
const MIN_FUNCTION_WORD_SHARE = 0.12;

export type Coverage = 'in_scope' | 'out_of_scope';

export interface ScopeAssessment {
  coverage: Coverage;
  /** Why, in words the interface can show the user verbatim. */
  reason: string;
  /** Function-word share, as a rounded percentage. Diagnostics only. */
  englishSharePercent: number;
  wordCount: number;
}

/**
 * Decide whether the English lenses had a fair chance at this message.
 *
 * `corroboration` is the number of lenses that fired. When any lens fired and
 * could quote itself, the message is in scope by demonstration — whatever the
 * word statistics say — so the check only ever downgrades a silent fleet.
 */
export function assessScope(raw: string, corroboration: number): ScopeAssessment {
  const words = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const wordCount = words.length;
  const hits = words.filter((w) => ENGLISH_FUNCTION_WORDS.has(w)).length;
  const share = wordCount === 0 ? 0 : hits / wordCount;
  const englishSharePercent = Math.round(share * 100);

  const inScope = (reason: string): ScopeAssessment => ({
    coverage: 'in_scope',
    reason,
    englishSharePercent,
    wordCount,
  });

  // A lens that fired and quoted the message has demonstrated coverage.
  if (corroboration > 0) {
    return inScope('At least one lens matched and quoted this message.');
  }
  if (wordCount < MIN_WORDS_FOR_TEST) {
    return inScope('Too short to assess for language; read as in scope.');
  }
  if (share >= MIN_FUNCTION_WORD_SHARE) {
    return inScope('Reads as English; the lenses had a fair chance.');
  }

  return {
    coverage: 'out_of_scope',
    reason:
      'This does not read as English, and every lens in the deterministic fleet ' +
      'is an English pattern. No rule matched because none could — this is not ' +
      'a clean verdict, it is no verdict at all.',
    englishSharePercent,
    wordCount,
  };
}
