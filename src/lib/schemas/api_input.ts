import { z } from 'zod';
import { userContextOverrideSchema } from './read_schema';

/**
 * GAMBIT YourMove — request-boundary validation.
 *
 * Everything crossing into a route handler is parsed here first. A route that
 * reads `body.message` without going through one of these schemas is a bug,
 * regardless of how obvious the shape looks.
 *
 * The upper bound on `message` is a real control, not a formality: the
 * Adversary prompt grows with the transition history, so an unbounded paste
 * would grow the prompt, the latency and the bill together.
 */

export const MAX_MESSAGE_CHARS = 4_000;

export const readRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Paste the message you received before running READ.')
    .max(
      MAX_MESSAGE_CHARS,
      `Message is longer than ${MAX_MESSAGE_CHARS} characters. Trim it to the part you need read.`,
    ),
  context: userContextOverrideSchema.optional(),
});

export type ReadRequest = z.infer<typeof readRequestSchema>;

export interface ApiErrorBody {
  error: {
    kind: 'bad_request' | 'timeout' | 'upstream' | 'invalid_response' | 'config';
    message: string;
    /** Present for validation failures, keyed by field path. */
    fields?: Record<string, string[]>;
  };
}

/** Flatten a Zod error into a field → messages map for the UI. */
export function fieldErrors(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
