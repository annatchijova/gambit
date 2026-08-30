import {
  composeVerdict,
  runFleet,
  semanticVote,
  unavailableSemantic,
  type CompositeVerdict,
  type SemanticSignal,
} from './frameworks';
import type { ReadOutput } from './schemas/read_schema';

/**
 * GAMBIT YourMove — assembling the READ verdict.
 *
 * This is the seam where the two analysts meet. The deterministic fleet reads
 * the raw message with no model in the loop and produces a sealed, reproducible
 * verdict. The language model reads the same message and returns, among its
 * narrative, a single numeric vote (`manipulationSeverity`). Here that vote
 * becomes a SemanticSignal and is composed with the sealed core into a
 * CompositeVerdict — best-effort, flagged, never replayable, but with the
 * model's judgement genuinely in it.
 *
 * Pure and deterministic GIVEN (message, read): the only non-determinism is
 * upstream, in obtaining `read` from the model. Kept out of the route handler
 * so it can be tested without a network.
 */

/** Turn a validated READ output into the model's semantic vote. */
export function semanticVoteFromRead(read: ReadOutput, model: string): SemanticSignal {
  return semanticVote({
    grid: read.manipulationSeverity,
    tactic: read.likelyTactic,
    evidence: read.evidence,
    model,
  });
}

/**
 * Build the composite verdict for one message.
 *
 * `read` is the model's narrative-and-vote, or null when the model did not
 * answer. A null `read` yields the deterministic core verdict unchanged (honest
 * degradation): the fleet always runs, because it needs no key and no network.
 */
export function buildReadVerdict(
  message: string,
  read: ReadOutput | null,
  model: string,
): CompositeVerdict {
  const core = runFleet(message);
  const semantic = read ? semanticVoteFromRead(read, model) : unavailableSemantic(model);
  return composeVerdict(core, semantic);
}

/**
 * Describe the read for THINK, in prose the drafting agent can ground on.
 *
 * Recomputed server-side from the deterministic fleet, so THINK never trusts a
 * number the client sent. The optional `hint` carries the tactic the model
 * named in READ — not sealed, only tone-shaping, so a message the rules could
 * not read still gets drafts appropriate to what the model saw.
 */
export function buildReadSummary(
  message: string,
  hint?: { tactic?: string; level?: string },
): string {
  const core = runFleet(message);
  const activeTitles = core.signals
    .filter((s) => core.activeFrameworks.includes(s.framework))
    .map((s) => s.title);

  const lines: string[] = [];
  if (core.coverage === 'out_of_scope') {
    lines.push('The deterministic rule engine could not read this message (out of its scope).');
  } else {
    lines.push(`The deterministic rule engine reads this message as ${core.level} (${core.scorePercent}%).`);
    lines.push(
      activeTitles.length > 0
        ? `Lenses that fired: ${activeTitles.join('; ')}.`
        : 'No single lens fired strongly.',
    );
  }
  if (hint?.tactic) {
    lines.push(`READ named the most likely tactic as "${hint.tactic}"${hint.level ? ` (${hint.level})` : ''}.`);
  }
  return lines.join(' ');
}
