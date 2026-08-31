import { describe, expect, it } from 'vitest';
import type { FleetVerdict } from '../src/lib/frameworks';
import { WATCH_INBOX } from '../src/lib/watch/inbox';
import {
  routeVerdict,
  runTriage,
  verifyTriageChain,
  type Disposition,
} from '../src/lib/watch/sentinel';

/**
 * WATCH sentinel — the autonomous decision path.
 *
 * These tests assert the three properties the mode rests on, none of which
 * depend on a network or a key: determinism of the pass, tamper-evidence of the
 * chain, and honest degradation of the routing policy.
 */

/** Build a minimal fleet verdict for policy tests, overriding only what matters. */
function verdict(over: Partial<FleetVerdict>): FleetVerdict {
  return {
    schemaVersion: 1,
    sealVersion: 'gambit-fleet-v1',
    level: 'CLEAN',
    score: '0',
    scorePercent: 0,
    confidence: 'High',
    activeFrameworks: [],
    silentFrameworks: [],
    crashedFrameworks: [],
    corroboration: 0,
    gatePassed: false,
    signals: [],
    coverage: 'in_scope',
    scopeReason: '',
    seal: '0'.repeat(64),
    ...over,
  } as FleetVerdict;
}

describe('routeVerdict — the autonomous disposition policy', () => {
  it('archives a clean, un-corroborated message without interrupting anyone', () => {
    expect(routeVerdict(verdict({ level: 'CLEAN', gatePassed: false })).disposition).toBe('ARCHIVED');
  });

  it('archives even a loud single lens below the corroboration gate', () => {
    // Loud level but the gate did not pass: the fleet forces CLEAN, we archive.
    expect(routeVerdict(verdict({ level: 'CLEAN', gatePassed: false, scorePercent: 80 })).disposition).toBe('ARCHIVED');
  });

  it('keeps a mixed signal on watch rather than escalating it', () => {
    expect(routeVerdict(verdict({ level: 'MIXED', gatePassed: true, corroboration: 2 })).disposition).toBe('WATCH');
  });

  it('escalates corroborated persuasive or manipulative pressure', () => {
    expect(routeVerdict(verdict({ level: 'PERSUASIVE', gatePassed: true, corroboration: 2 })).disposition).toBe('ESCALATED');
    expect(routeVerdict(verdict({ level: 'MANIPULATIVE', gatePassed: true, corroboration: 3 })).disposition).toBe('ESCALATED');
  });

  it('flags an out-of-scope message for a human instead of archiving it as clean', () => {
    // Honest degradation: even with the fleet quiet, a message the lenses could
    // not read must not be issued a confident all-clear.
    const d = routeVerdict(verdict({ level: 'CLEAN', gatePassed: false, coverage: 'out_of_scope' }));
    expect(d.disposition).toBe('WATCH');
  });
});

describe('runTriage — one autonomous pass', () => {
  it('is deterministic: same inbox in, byte-identical pass out', () => {
    const a = runTriage(WATCH_INBOX);
    const b = runTriage(WATCH_INBOX);
    expect(a).toEqual(b);
    expect(a.head).toBe(b.head);
  });

  it('routes every message and the counts sum to the inbox size', () => {
    const { entries, counts } = runTriage(WATCH_INBOX);
    expect(entries).toHaveLength(WATCH_INBOX.length);
    const total = (Object.values(counts) as number[]).reduce((s, n) => s + n, 0);
    expect(total).toBe(WATCH_INBOX.length);
  });

  it('exercises every disposition bucket with the shipped inbox', () => {
    const { counts } = runTriage(WATCH_INBOX);
    const buckets: Disposition[] = ['ARCHIVED', 'WATCH', 'ESCALATED'];
    for (const b of buckets) expect(counts[b]).toBeGreaterThan(0);
  });

  it('seals a verifiable, tamper-evident chain over its decisions', () => {
    const { entries, head } = runTriage(WATCH_INBOX);
    expect(verifyTriageChain(entries)).toBe(-1);
    expect(head).toBe(entries[entries.length - 1].hash);
    expect(head).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects an altered decision', () => {
    const { entries } = runTriage(WATCH_INBOX);
    const target = entries.findIndex((e) => e.disposition === 'ARCHIVED');
    expect(target).toBeGreaterThanOrEqual(0);
    // Flip a decision without re-sealing: the chain must catch it at that index.
    const tampered = entries.map((e, i) => (i === target ? { ...e, disposition: 'ESCALATED' as Disposition } : e));
    expect(verifyTriageChain(tampered)).toBe(target);
  });

  it('detects a reordered chain', () => {
    const { entries } = runTriage(WATCH_INBOX);
    const swapped = [entries[1], entries[0], ...entries.slice(2)];
    // The first entry now carries a non-null prevHash where null is expected.
    expect(verifyTriageChain(swapped)).toBe(0);
  });
});
