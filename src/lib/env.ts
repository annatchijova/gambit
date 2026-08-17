import 'server-only';

/**
 * GAMBIT YourMove — environment boundary.
 *
 * Every value the process reads from outside itself is validated here, once,
 * with a named error. Nothing downstream is allowed to do
 * `process.env.WHATEVER!` and hope.
 *
 * Deliberately NOT validated at module load: Next.js evaluates modules during
 * `next build`, and a build machine legitimately has no API key. Validation
 * runs on first request instead, so a missing key fails the request loudly
 * rather than failing the build mysteriously.
 */

export type Backend = 'gemini-api' | 'vertex-ai';

export interface ServerEnv {
  backend: Backend;
  /** Present only when backend === 'gemini-api'. */
  apiKey?: string;
  /** Present only when backend === 'vertex-ai'. */
  project?: string;
  /** Present only when backend === 'vertex-ai'. */
  location?: string;
  /** Enables verbose per-request telemetry lines in the server log. */
  telemetryVerbose: boolean;
}

export class EnvError extends Error {
  readonly code = 'ENV_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

let cached: ServerEnv | null = null;

/**
 * Resolve and validate server environment.
 *
 * Two supported backends, both allowed by the competition rules:
 *   - Gemini API  → GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY, the name the
 *     ADK/GenAI SDKs read natively)
 *   - Vertex AI   → GOOGLE_GENAI_USE_VERTEXAI=true + project + location
 *
 * @throws {EnvError} when neither backend is fully configured.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const useVertex =
    (process.env.GOOGLE_GENAI_USE_VERTEXAI ?? '').toLowerCase() === 'true';

  const telemetryVerbose =
    (process.env.GAMBIT_TELEMETRY_VERBOSE ?? '').toLowerCase() === 'true';

  if (useVertex) {
    const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
    if (!project || !location) {
      throw new EnvError(
        'Vertex AI backend selected (GOOGLE_GENAI_USE_VERTEXAI=true) but ' +
          'GOOGLE_CLOUD_PROJECT and/or GOOGLE_CLOUD_LOCATION are missing. ' +
          'See .env.example.',
      );
    }
    cached = { backend: 'vertex-ai', project, location, telemetryVerbose };
    return cached;
  }

  const apiKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    ''
  ).trim();

  if (!apiKey) {
    throw new EnvError(
      'No Gemini credentials found. Set GEMINI_API_KEY for the Gemini API, ' +
        'or GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT and ' +
        'GOOGLE_CLOUD_LOCATION for Vertex AI. See .env.example.',
    );
  }

  cached = { backend: 'gemini-api', apiKey, telemetryVerbose };
  return cached;
}

/** Test seam — clears the memoised env so a test can vary process.env. */
export function resetServerEnvCache(): void {
  cached = null;
}
