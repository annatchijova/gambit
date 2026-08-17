/**
 * Day 2 calibration harness for READ.
 *
 *   npm run dev                # in one terminal
 *   npm run calibrate:read     # in another
 *
 * Runs every corpus case through the REAL HTTP route — boundary validation,
 * ADK call, deadline policy, response re-validation, all of it. Calling the
 * agent directly would be easier and would prove less: it would skip exactly
 * the layers most likely to break.
 *
 * Writes docs/read_test_log.md with one section per case and an empty verdict
 * line for you to fill in. That log is the evidence layer for prompt
 * calibration, and it is where the submission's "Findings and learnings"
 * section gets its material.
 *
 * IT DOES NOT SCORE ITSELF. There is no ground truth here — a model grading
 * its own tactic labels would produce a number with nothing behind it. You
 * read the output and write MATCH / MISS / ARGUABLE. Fifteen cases, fifteen
 * minutes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corpusPath = join(here, '..', 'corpus', 'read_messages.json');
const outPath = join(here, '..', 'docs', 'read_test_log.md');

const BASE = process.env.GAMBIT_BASE_URL ?? 'http://localhost:3000';

interface Case {
  id: string;
  scenario: string;
  probe: string;
  message: string;
}

interface Outcome {
  testCase: Case;
  ms: number;
  status: number;
  mode?: string;
  body: Record<string, unknown>;
}

async function run(testCase: Case): Promise<Outcome> {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: testCase.message }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return {
    testCase,
    ms: Math.round(performance.now() - t0),
    status: res.status,
    mode: typeof body.mode === 'string' ? body.mode : undefined,
    body,
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(Math.ceil((p / 100) * sorted.length), sorted.length) - 1];
}

function renderCase(o: Outcome): string {
  const head = `### ${o.testCase.id} — ${o.testCase.scenario}

**Probing:** ${o.testCase.probe}

> ${o.testCase.message.replace(/\n/g, '\n> ')}

**Round trip:** ${o.ms} ms · **HTTP:** ${o.status}${o.mode ? ` · **Mode:** ${o.mode}` : ''}
`;

  if (o.status !== 200) {
    const err = (o.body as { error?: { kind?: string; message?: string } }).error;
    return `${head}
**FAILED** — \`${err?.kind ?? 'unknown'}\`: ${err?.message ?? JSON.stringify(o.body).slice(0, 200)}

**Your verdict:** _(n/a — the call failed)_

---
`;
  }

  const read = (o.body as { read?: Record<string, unknown> }).read;
  if (!read) return `${head}\n**FAILED** — 200 with no \`read\` field.\n\n---\n`;

  const evidence = (read.evidence as string[] | undefined) ?? [];
  const alternatives =
    (read.alternatives as Array<{ tactic: string; why: string }> | undefined) ?? [];
  const lev = read.leverageAssessment as Record<string, string> | undefined;

  return `${head}
| Field | Value |
|---|---|
| Tactic | **${read.likelyTactic}** |
| Confidence | **${read.confidence}** |
| Subtext | ${String(read.subtext ?? '').replace(/\|/g, '\\|')} |

**Evidence quoted**
${evidence.map((e) => `- “${e}”`).join('\n') || '- _(none)_'}

**Alternatives offered**
${alternatives.map((a) => `- **${a.tactic}** — ${a.why}`).join('\n') || '- _(none)_'}

**Leverage** — you: ${lev?.userPosition ?? '—'} · them: ${lev?.opponentPosition ?? '—'} · risk: ${lev?.primaryRisk ?? '—'}

**Quotes verified verbatim?** _(yes / no — check each quote actually appears in the message above)_

**Your verdict:** _(MATCH / MISS / ARGUABLE — and one line on why)_

---
`;
}

async function main() {
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { cases: Case[] };

  try {
    const ping = await fetch(`${BASE}/api/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'ping' }),
    });
    if (ping.status >= 500) {
      const body = await ping.json().catch(() => ({}));
      console.error(
        `The server answered ${ping.status}. Fix this before calibrating:\n` +
          JSON.stringify(body, null, 2),
      );
      process.exit(1);
    }
  } catch {
    console.error(`Could not reach ${BASE}. Start the app first: npm run dev`);
    process.exit(1);
  }

  const results: Outcome[] = [];
  // Sequential on purpose: concurrent calls would distort the latency figures,
  // and these numbers feed the Day 5 baseline.
  for (const c of corpus.cases) {
    process.stdout.write(`  ${c.id} … `);
    const o = await run(c);
    results.push(o);
    const read = (o.body as { read?: { likelyTactic?: string; confidence?: string } }).read;
    console.log(
      o.status === 200
        ? `${o.ms} ms — ${read?.likelyTactic} (${read?.confidence})`
        : `${o.ms} ms — HTTP ${o.status}`,
    );
  }

  const okMs = results.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  const mock = results.some((r) => r.mode === 'mock');

  const header = `# READ calibration log

Generated by \`npm run calibrate:read\` against \`${BASE}\`.
${mock ? '\n> **These are fixture responses.** GAMBIT_MOCK was enabled, so no model was called and nothing here calibrates anything. Re-run with real credentials.\n' : ''}
## What this measures, and what it does not

Each case below went through the full HTTP route, so a 200 here means the
boundary validation, the ADK call, the deadline policy and the schema
re-validation all worked. That part is machine-checked.

Whether the tactic label is *right* is not machine-checked and cannot be. Fill
in the verdict lines yourself. A model grading its own labels would produce a
percentage with nothing behind it.

Two things worth checking on every case, because they are the product's actual
claims:

1. **Are the quotes verbatim?** Every string in \`evidence\` must appear in the
   message exactly. A paraphrase presented as a quote is a defect, not a style
   choice.
2. **Is the confidence honest?** The two \`lowsignal-*\` cases must come back
   **Low**. If either returns High, the uncertainty layer is decorative and the
   prompt needs work before Day 3.

## Latency

Sequential calls from one machine, one network, no warm-up. Indicative only —
the Day 5 telemetry run is the real baseline.

| n (HTTP 200) | p50 | p95 | max |
|---|---|---|---|
| ${okMs.length} | ${percentile(okMs, 50) ?? '—'} ms | ${percentile(okMs, 95) ?? '—'} ms | ${okMs.at(-1) ?? '—'} ms |

Plan hypothesis: p50 ≤ 1800 ms, p95 ≤ 2500 ms. ${
    okMs.length
      ? (percentile(okMs, 50) ?? 0) <= 1800 && (percentile(okMs, 95) ?? 0) <= 2500
        ? 'Consistent with these samples — still a hypothesis until Day 5.'
        : '**Not met by these samples.** Record the real numbers in the write-up rather than repeating the target.'
      : 'No successful samples.'
  }

---

`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, header + results.map(renderCase).join('\n'), 'utf8');
  console.log(`\nWrote ${outPath} — ${results.length} cases. Fill in the verdict lines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
