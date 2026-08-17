/**
 * GAMBIT YourMove — Single source of truth for model identifiers.
 *
 * PROVENANCE
 *   Model IDs verified against https://ai.google.dev/gemini-api/docs/models
 *   on 2026-08-17. `gemini-3.5-flash` is documented as the stable ID
 *   (preview channel is `gemini-3-flash-preview`); `gemini-3.5-flash-lite`
 *   is documented as the Flash-Lite variant of the same family.
 *
 * WHY THIS FILE EXISTS
 *   Model IDs are the one string in this codebase that (a) is mandated by an
 *   external rulebook, and (b) will be grepped by a judge. Scattering it
 *   across five route handlers is how a project ends up shipping two
 *   different model versions in the same submission. One constant, one place.
 *
 * HACKATHON CONSTRAINT
 *   The competition requires Gemini 3.5 or newer via the Gemini API or
 *   Vertex AI. Anything assigned below must satisfy that.
 */

export const MODEL_FAMILY_FLOOR = '3.5' as const;

/**
 * Per-module model assignment.
 *
 * Critical path (user is blocked, waiting on screen) gets Flash.
 * Non-blocking path (renders after the critical response) gets Flash-Lite.
 */
export const MODELS = {
  /** READ — tactic hypothesis + uncertainty layer. Critical path. */
  READ: 'gemini-3.5-flash',
  /** THINK — three strategic options in one call. Critical path. */
  THINK: 'gemini-3.5-flash',
  /** TRAIN / Adversary — opponent simulation. Critical path. */
  ADVERSARY: 'gemini-3.5-flash',
  /** TRAIN / Coach — async micro-feedback. Non-blocking, cheaper tier. */
  COACH: 'gemini-3.5-flash-lite',
  /** SCORE — narration of an already-computed score. Non-blocking. */
  SCORE: 'gemini-3.5-flash-lite',
} as const;

export type ModelRole = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelRole];

/**
 * Guard against a silent downgrade below the competition floor.
 *
 * This is a lexical check, not a capability check: it proves nobody typed
 * `gemini-2.5-flash` into this file, it does NOT prove the model exists or
 * that the account has access. Access is verified at request time, where a
 * 4xx from the API surfaces honestly instead of being swallowed.
 */
export function assertModelFloor(): void {
  const offenders = Object.entries(MODELS).filter(
    ([, id]) => !/^gemini-3\.(?:[5-9]|\d{2,})/.test(id),
  );
  if (offenders.length > 0) {
    throw new Error(
      `[models] Model ID below the required Gemini ${MODEL_FAMILY_FLOOR} floor: ` +
        offenders.map(([role, id]) => `${role}=${id}`).join(', '),
    );
  }
}
