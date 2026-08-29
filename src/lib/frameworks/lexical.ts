import { Fraction } from '../fraction';

/**
 * GAMBIT YourMove — shared lexical primitives for the framework fleet.
 *
 * Every lens is built from the same three moves: does a pattern appear, how
 * many distinct categories fired, and — crucially — what was the VERBATIM span
 * in the ORIGINAL message that triggered it. The last one matters because
 * GAMBIT's whole posture is "quote, do not paraphrase": a signal the fleet
 * cannot back with the user's own words is a signal it should not raise.
 *
 * All of this is pure and deterministic. Patterns run over the normalised
 * (lower-cased) text; evidence is lifted from the raw text so the audit panel
 * shows what the counterparty actually wrote, original casing intact.
 */

/**
 * One named bundle of surface patterns. `weight` is how much this category
 * contributes to its lens's severity, as an exact rational.
 */
export interface Category {
  tag: string;
  weight: Fraction;
  pattern: RegExp;
}

export interface CategoryHit {
  tag: string;
  weight: Fraction;
  /** Verbatim span from the raw message, or null if it could not be lifted. */
  evidence: string | null;
}

/**
 * Find the first verbatim occurrence of `pattern` in the raw message.
 *
 * The lens patterns are authored against normalised (lower-cased, whitespace-
 * collapsed) text, so we match case-insensitively and then return the ORIGINAL
 * substring, trimmed and length-capped for display. Returns null when the raw
 * text does not contain a liftable span (e.g. the match only existed after
 * normalisation collapsed something) — the caller treats a null as "no
 * quotable evidence", never as a silent pass.
 */
export function verbatim(raw: string, pattern: RegExp): string | null {
  const re = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '') + 'i');
  const m = re.exec(raw);
  if (!m) return null;
  const span = m[0].trim();
  if (span.length === 0) return null;
  return span.length > 120 ? `${span.slice(0, 117)}...` : span;
}

/**
 * Run a category set against a message. Returns one hit per category that
 * fired, each carrying its verbatim evidence. Deterministic and order-stable:
 * categories are evaluated in the order given, so the resulting tag and
 * evidence lists are reproducible.
 */
export function runCategories(
  categories: readonly Category[],
  norm: string,
  raw: string,
): CategoryHit[] {
  const hits: CategoryHit[] = [];
  for (const c of categories) {
    if (c.pattern.test(norm)) {
      hits.push({ tag: c.tag, weight: c.weight, evidence: verbatim(raw, c.pattern) });
    }
  }
  return hits;
}

/**
 * Severity from a set of category hits: the sum of fired weights, clamped to
 * [0, 1]. Exact rational throughout — no float ever touches this number, so it
 * is safe to seal. A lens that wants a convergence bonus (several categories
 * firing at once) applies it on top of this and re-clamps.
 */
export function severityFromHits(hits: readonly CategoryHit[]): Fraction {
  return hits.reduce((acc, h) => acc.add(h.weight), Fraction.ZERO).clamp01();
}

/**
 * Collect the verbatim evidence from a set of hits, dropping nulls and
 * duplicates while preserving first-seen order. Capped to keep the audit panel
 * legible and the sealed payload bounded.
 */
export function collectEvidence(hits: readonly CategoryHit[], cap = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (h.evidence && !seen.has(h.evidence)) {
      seen.add(h.evidence);
      out.push(h.evidence);
      if (out.length >= cap) break;
    }
  }
  return out;
}
