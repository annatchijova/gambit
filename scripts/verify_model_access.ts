/**
 * Pre-flight: prove this account can actually call the models the competition
 * requires, on the backend that is configured.
 *
 *   npm run verify:model
 *
 * This exists because "the model ID is documented" and "my account can call
 * it" are different claims, and the second one blocks every other day of the
 * build. Ten minutes here beats discovering a quota or region problem on
 * Day 8.
 *
 * Deliberately independent of the app's ADK seam: it builds its own Gemini
 * handles from `MODELS`. If this passes and the route still fails, the
 * problem is in our code, not in the credentials — which is exactly the split
 * you want a pre-flight to give you.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Gemini, InMemorySessionService, LlmAgent, Runner } from '@google/adk';
import { MODELS, assertModelFloor } from '../src/lib/models';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'docs', 'model_access.md');

const PROMPT = 'Reply with exactly one word: ready';
const PER_CALL_TIMEOUT_MS = 20_000; // generous: this is a reachability probe, not a latency benchmark

interface Probe {
  role: string;
  model: string;
  ok: boolean;
  ms: number;
  detail: string;
}

function resolveBackend():
  | { kind: 'vertex-ai'; project: string; location: string }
  | { kind: 'gemini-api'; apiKey: string } {
  const useVertex = (process.env.GOOGLE_GENAI_USE_VERTEXAI ?? '').toLowerCase() === 'true';

  if (useVertex) {
    const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
    if (!project || !location) {
      console.error(
        'GOOGLE_GENAI_USE_VERTEXAI=true but GOOGLE_CLOUD_PROJECT and/or\n' +
          'GOOGLE_CLOUD_LOCATION are missing. See .env.example.',
      );
      process.exit(2);
    }
    return { kind: 'vertex-ai', project, location };
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY ?? '').trim();
  if (!apiKey) {
    console.error(
      'No credentials found.\n' +
        '  Gemini API : set GEMINI_API_KEY\n' +
        '  Vertex AI  : set GOOGLE_GENAI_USE_VERTEXAI=true, GOOGLE_CLOUD_PROJECT,\n' +
        '               GOOGLE_CLOUD_LOCATION, and run\n' +
        '               gcloud auth application-default login\n' +
        'See .env.example.',
    );
    process.exit(2);
  }
  return { kind: 'gemini-api', apiKey };
}

async function probe(role: string, model: string): Promise<Probe> {
  const backend = resolveBackend();
  const gemini =
    backend.kind === 'vertex-ai'
      ? new Gemini({ model, vertexai: true, project: backend.project, location: backend.location })
      : new Gemini({ model, apiKey: backend.apiKey });

  const agent = new LlmAgent({
    name: 'probe',
    model: gemini,
    instruction: 'Answer in one word.',
    includeContents: 'none',
  });

  const sessionService = new InMemorySessionService();
  const runner = new Runner({ appName: 'probe', agent, sessionService });
  const session = await sessionService.createSession({ appName: 'probe', userId: 'probe' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  const t0 = performance.now();

  try {
    let text = '';
    for await (const event of runner.runAsync({
      userId: 'probe',
      sessionId: session.id,
      newMessage: { role: 'user', parts: [{ text: PROMPT }] },
      abortSignal: controller.signal,
    })) {
      // ADK reports model failures as events, not exceptions. Checking this
      // is the whole reason a naive probe would report a false pass.
      if (event.errorCode || event.errorMessage) {
        return {
          role,
          model,
          ok: false,
          ms: Math.round(performance.now() - t0),
          detail: `${event.errorCode ?? 'error'}: ${String(event.errorMessage ?? '').slice(0, 180)}`,
        };
      }
      if (!event.partial && event.content?.parts) {
        text += event.content.parts.map((p) => p.text ?? '').join('');
      }
    }
    const ms = Math.round(performance.now() - t0);
    return text.trim()
      ? { role, model, ok: true, ms, detail: `replied ${JSON.stringify(text.trim().slice(0, 40))}` }
      : { role, model, ok: false, ms, detail: 'completed with no content' };
  } catch (err) {
    return {
      role,
      model,
      ok: false,
      ms: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message.slice(0, 180) : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  assertModelFloor();
  const backend = resolveBackend();
  const label =
    backend.kind === 'vertex-ai'
      ? `Vertex AI (project ${backend.project}, ${backend.location})`
      : 'Gemini API (API key)';

  console.log(`Backend: ${label}\n`);

  const distinct = [...new Set(Object.values(MODELS))];
  const roleOf = (m: string) =>
    Object.entries(MODELS)
      .filter(([, v]) => v === m)
      .map(([k]) => k)
      .join(', ');

  const results: Probe[] = [];
  for (const model of distinct) {
    process.stdout.write(`  ${model} … `);
    const r = await probe(roleOf(model), model);
    results.push(r);
    console.log(r.ok ? `OK  ${r.ms} ms  (${r.detail})` : `FAIL  ${r.detail}`);
  }

  const allOk = results.every((r) => r.ok);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `# Model access — verification result

Generated by \`npm run verify:model\`. Overwritten on every run; commit it
after a successful run so the submission can point at evidence rather than at
an assertion.

**Backend:** ${label}
**Verdict:** ${allOk ? 'all required models reachable' : 'AT LEAST ONE MODEL IS NOT REACHABLE'}

| Roles | Model | Result | Round trip | Detail |
|---|---|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.role} | \`${r.model}\` | ${r.ok ? 'OK' : 'FAIL'} | ${r.ms} ms | ${r.detail.replace(/\|/g, '\\|')} |`,
  )
  .join('\n')}

The round-trip column is a reachability figure on a one-word prompt from a
single machine and network. It is **not** the latency baseline — that comes
from \`npm run calibrate:read\` against real prompts, and again from the
telemetry run on Day 5.
`,
    'utf8',
  );

  console.log(`\nWrote ${outPath}`);
  if (!allOk) {
    console.error('\nAt least one model is not reachable. Do not start Day 2 work until this passes.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
