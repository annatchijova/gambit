import type { ThinkOutput } from '../schemas/think_schema';

/**
 * GAMBIT YourMove — deterministic THINK fixture.
 *
 * Same contract as the READ fixture: entered only when GAMBIT_MOCK=true, tagged
 * mode:"mock" on the wire, never a silent fallback. It lets the THINK interface
 * be built and demoed without a key or a model call.
 */

export const THINK_FIXTURE: ThinkOutput = {
  principle:
    'Do not let their deadline become your deadline. Any reply should protect your right to take the time to decide.',
  options: [
    {
      stance: 'soft',
      draft:
        "Thanks for the offer. I want to give this the consideration it deserves, so I'll come back to you with a proper answer — I just need a little time to look at it against my other options.",
      rationale:
        'Keeps the relationship warm while quietly refusing the artificial urgency. Buys time without conceding anything.',
      watchOut: 'A patient counterparty can simply repeat the deadline; you may need a firmer line next round.',
    },
    {
      stance: 'tactical',
      draft:
        "I'm interested, but the timeline you've set doesn't work for me. If the terms are as strong as you say, they'll hold until the end of the week — can we agree on that?",
      rationale:
        'Tests whether the deadline is real by asking for a small, reasonable extension. A genuine offer usually survives it.',
      watchOut: 'Naming a specific date commits you to acting by then; keep it comfortable.',
    },
    {
      stance: 'direct',
      draft:
        "I don't make decisions this size under a countdown. I'm happy to keep talking on the merits, but the deadline isn't a factor for me.",
      rationale: 'States the boundary plainly and removes the pressure lever entirely.',
      watchOut: 'Reads as confrontational; best when you genuinely hold an alternative and the relationship can take it.',
    },
  ],
};
