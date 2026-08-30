import { describe, expect, it } from 'vitest';
import { assessScope, runFleet, verifyFleetSeal } from '../src/lib/frameworks';
import readCorpus from '../corpus/read_messages.json';
import moveCorpus from '../corpus/user_moves.json';

/**
 * The scope guard exists to close the last silent degradation in the fleet: an
 * English lexicon reading a non-English message matches nothing, and "nothing
 * matched" was being reported as CLEAN at High confidence — a confident
 * all-clear on a message the engine never read.
 *
 * Two failure modes matter, and they pull in opposite directions:
 *
 *   FALSE NEGATIVE — a non-English message still reported as a clean read.
 *                    That is the bug this guard exists for.
 *   FALSE POSITIVE — an English message declared unreadable. That is WORSE:
 *                    it breaks the tool on its actual input. Hence the whole
 *                    English corpus is asserted below, terse cases included.
 */

const SPANISH =
  'Esta oferta solo vale hasta la medianoche. Después de todo lo que hicimos ' +
  'por vos, lo mínimo que podrías hacer es firmar el contrato hoy mismo.';

describe('non-English input is reported as no verdict, not a clean one', () => {
  it('marks a Spanish message out of scope', () => {
    const v = runFleet(SPANISH);
    expect(v.coverage).toBe('out_of_scope');
  });

  it('refuses to call that silence High confidence', () => {
    const v = runFleet(SPANISH);
    // Without the guard this is the exact bug: CLEAN + High on an unread message.
    expect(v.level).toBe('CLEAN');
    expect(v.confidence).toBe('Low');
  });

  it('carries a reason the interface can show verbatim', () => {
    expect(runFleet(SPANISH).scopeReason).toMatch(/not .*a clean verdict/i);
  });

  it('holds across several non-English languages', () => {
    const messages = [
      'Esta proposta é válida apenas até a meia-noite, depois de tudo o que fizemos por você.',
      "Cette offre n'est valable que jusqu'à minuit, après tout ce que nous avons fait pour vous.",
      'Dieses Angebot gilt nur bis Mitternacht, nach allem was wir für Sie getan haben.',
    ];
    for (const m of messages) {
      expect(runFleet(m).coverage).toBe('out_of_scope');
    }
  });
});

describe('English input is never declared unreadable', () => {
  it('passes every message in the READ corpus', () => {
    const offenders = readCorpus.cases
      .filter((c) => runFleet(c.message).coverage === 'out_of_scope')
      .map((c) => c.id);
    expect(offenders).toEqual([]);
  });

  it('passes every authored classifier case, including the terse ones', () => {
    const offenders = moveCorpus.authored
      .filter((c) => runFleet(c.message).coverage === 'out_of_scope')
      .map((c) => c.id);
    expect(offenders).toEqual([]);
  });

  it('treats a message too short to judge as in scope', () => {
    expect(assessScope('Fine, I accept.', 0).coverage).toBe('in_scope');
  });

  it('does not second-guess a lens that fired and quoted the message', () => {
    // Demonstrated coverage beats a word count: if a lens matched, the lenses
    // could evidently read it.
    expect(assessScope(SPANISH, 2).coverage).toBe('in_scope');
  });
});

describe('the guard is presentation, never provenance', () => {
  it('leaves the seal intact and verifiable', () => {
    const v = runFleet(SPANISH);
    expect(verifyFleetSeal(v)).toBe(true);
  });

  it('stays deterministic across runs', () => {
    const a = runFleet(SPANISH);
    const b = runFleet(SPANISH);
    expect(a.coverage).toBe(b.coverage);
    expect(a.seal).toBe(b.seal);
  });
});
