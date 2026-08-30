/**
 * GAMBIT YourMove — add a real message to the FIELD corpus.
 *
 * ============================================================================
 * WHY THIS SCRIPT EXISTS, AND WHAT IT REFUSES TO DO
 * ============================================================================
 *
 * The field corpus is the only thing in this repository that could ever support
 * an accuracy claim, and it is empty. The authored corpus cannot substitute for
 * it at any size: those cases were written by the author of the rules, so
 * agreement there measures self-consistency and nothing else. Writing more
 * authored cases does not move the accuracy question one inch.
 *
 * What does move it is a real message someone actually received, labelled by a
 * human with what they think it is. This script exists to make adding one take
 * ten seconds, because friction is the reason that file is still empty.
 *
 * THE ONE DISCIPLINE IT ENFORCES. A label chosen AFTER seeing what the engine
 * said is not evidence — it is the engine grading itself through a human who
 * has already been anchored. So `--expect` is required BEFORE anything is
 * classified, and the engine's answer is printed only after the case is
 * written. You commit to your reading first. If the engine then disagrees, that
 * disagreement is the finding: leave the label alone and fix the rules, or
 * leave both alone and record that the rules are wrong here.
 *
 * Usage:
 *   npm run corpus:field -- --expect PRESSURE_TEST --message "I need an answer by Friday."
 *   npm run corpus:field -- --list
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOVE_TYPES, classifyUserMove, type MoveType } from '../src/lib/state_rules';

const CORPUS_PATH = resolve(process.cwd(), 'corpus/user_moves.json');

interface MoveCase {
  id: string;
  expect: MoveType;
  message: string;
  /** Free-form context: where this message came from. Optional. */
  source?: string;
}

interface Corpus {
  note: string;
  authored: MoveCase[];
  field: MoveCase[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function die(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function load(): Corpus {
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
}

function listFieldCases(corpus: Corpus): void {
  if (corpus.field.length === 0) {
    console.log('\nThe field corpus is empty. No accuracy claim is available.\n');
    console.log('Add one:');
    console.log('  npm run corpus:field -- --expect PRESSURE_TEST --message "..."\n');
    return;
  }
  console.log(`\n${corpus.field.length} field case(s):\n`);
  for (const c of corpus.field) {
    console.log(`  ${c.id.padEnd(14)} ${c.expect.padEnd(26)} "${c.message.slice(0, 58)}"`);
  }
  console.log('\nRun `npm run calibrate:rules` for agreement.\n');
}

function main(): void {
  const corpus = load();

  if (process.argv.includes('--list')) {
    listFieldCases(corpus);
    return;
  }

  const message = arg('message')?.trim();
  const expect = arg('expect')?.trim().toUpperCase();

  if (!message || !expect) {
    die(
      'Both --expect and --message are required.\n\n' +
        `  --expect  one of: ${MOVE_TYPES.join(', ')}\n` +
        '  --message the message, verbatim, as it was actually received\n\n' +
        'Example:\n' +
        '  npm run corpus:field -- --expect PRESSURE_TEST --message "I need an answer by Friday."\n\n' +
        'Label it before you see what the engine says. That ordering is the whole\n' +
        'point — a label chosen afterwards is not evidence.',
    );
  }

  if (!(MOVE_TYPES as readonly string[]).includes(expect)) {
    die(`"${expect}" is not a move type.\n\nValid labels:\n  ${MOVE_TYPES.join('\n  ')}`);
  }

  const duplicate = [...corpus.authored, ...corpus.field].find((c) => c.message === message);
  if (duplicate) {
    die(`That exact message is already in the corpus as "${duplicate.id}".`);
  }

  const id = arg('id')?.trim() || `field-${String(corpus.field.length + 1).padStart(2, '0')}`;
  if ([...corpus.authored, ...corpus.field].some((c) => c.id === id)) {
    die(`The id "${id}" is already taken. Pass a different --id.`);
  }

  const entry: MoveCase = { id, expect: expect as MoveType, message };
  const source = arg('source')?.trim();
  if (source) entry.source = source;

  corpus.field.push(entry);
  writeFileSync(CORPUS_PATH, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');

  // Only now — after the label is committed to disk — does the engine speak.
  const result = classifyUserMove(message);
  const agrees = result.moveType === expect;

  console.log(`\nAdded ${id} to the field corpus (now ${corpus.field.length} case(s)).`);
  console.log(`\n  you said     ${expect}`);
  console.log(`  engine said  ${result.moveType}   (rank ${result.rank}, ${result.criterion})`);
  console.log(`\n  ${agrees ? 'They agree.' : 'THEY DISAGREE — and that is the useful part.'}`);
  if (!agrees) {
    console.log(
      '\n  Do not edit the label to match. Either the rule is wrong and should be\n' +
        '  fixed, or your reading was, and either way the disagreement is the\n' +
        '  finding. Record it in docs/journal.md.',
    );
  }
  console.log('\nRun `npm run calibrate:rules` to regenerate the report.\n');
}

main();
