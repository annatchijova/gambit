/**
 * Generates docs/state_rules.md from the rule table in src/lib/state_rules.ts.
 *
 * The document is NOT hand-written, on purpose. A hand-written copy of the
 * rule table is a copy that drifts, and the first time it drifts is the first
 * time someone points at the doc during a demo and describes behaviour the
 * code no longer has. Run `npm run docs:rules` after touching RULES.
 *
 * `npm run docs:check` fails if the committed doc is stale.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/lib/state_rules';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'docs', 'state_rules.md');

function sign(n: number): string {
  return n === 0 ? '0' : n > 0 ? `+${n}` : `${n}`;
}

const rows = RULES.map(
  (r) =>
    `| ${r.rank} | \`${r.type}\` | ${r.criterion} | ${sign(r.delta.leverage)} | ${sign(r.delta.trust)} | ${sign(r.delta.patience)} |`,
).join('\n');

const rationale = RULES.map(
  (r) => `**${r.rank}. \`${r.type}\`** — ${r.rationale}`,
).join('\n\n');

const doc = `<!--
  GENERATED FILE — do not edit by hand.
  Source of truth: src/lib/state_rules.ts
  Regenerate with: npm run docs:rules
-->

# Deterministic state rules

GAMBIT YourMove never lets a language model decide how the opponent's model of
the negotiation changes. Every change to \`perceivedUserLeverage\`, \`trust\` and
\`patience\` is produced by the rule table below, in code, before any agent is
called. The Adversary agent receives the resulting state as an established
fact and may only phrase a reply consistent with it.

## What is and is not claimed

**Deterministic — guaranteed and tested.** The same message and the same prior
state always produce the same classification and the same next state, on any
machine, in any run. No model call, no randomness, no clock, no floating-point
arithmetic. Every transition is sealed with a SHA-256 over its canonical form
and carries the previous seal, so the log is a verifiable chain.

**Accurate — not claimed.** Whether the classifier assigns the label a human
negotiation coach would assign has not been measured against a labelled
corpus. The classifier is a lexical heuristic over surface patterns. It is
auditable and reproducible; it is not validated. Do not describe it as
accurate in the write-up or on camera.

## Scale

Scores are integers on a closed \`[0, 100]\` interval. The approved rule table
was written in hundredths (\`+0.15\`, \`-0.20\`); on this scale those are \`+15\`
and \`-20\`, with no conversion loss and no float drift. Divide by 100 at the
presentation layer only.

Deltas are clamped at the floor and ceiling. Each transition records what the
rule *requested* and what was actually *applied*, so a clamped move stays
visible instead of implying a change that never happened.

## Rule table

Precedence is data, not the order of if-statements: rules are stored as a
rank-ordered array and walked in order. Reordering it changes behaviour
visibly and is caught by the precedence tests.

| Rank | MoveType | Trigger | Δ leverage | Δ trust | Δ patience |
|---|---|---|---|---|---|
${rows}

## Why the ranks sit where they do

${rationale}

## Totality

\`DEFAULT_AMBIGUOUS\` matches unconditionally, so classification is total:
every possible input — empty, emoji-only, 4,000 characters of mixed intent —
lands on a rule with a defined impact. There is no branch where a fallback
gets improvised inside a prompt at two in the morning.
`;

const mode = process.argv[2];
mkdirSync(dirname(outPath), { recursive: true });

if (mode === '--check') {
  let current = '';
  try {
    current = readFileSync(outPath, 'utf8');
  } catch {
    console.error('docs/state_rules.md is missing. Run: npm run docs:rules');
    process.exit(1);
  }
  if (current !== doc) {
    console.error(
      'docs/state_rules.md is out of date with src/lib/state_rules.ts. Run: npm run docs:rules',
    );
    process.exit(1);
  }
  console.log('docs/state_rules.md is up to date.');
} else {
  writeFileSync(outPath, doc, 'utf8');
  console.log(`Wrote ${outPath} (${RULES.length} rules).`);
}
