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
        "Thanks for the offer. I want to give this the consideration it deserves, so I'll come back to you with a proper answer — I just need a little time to look at it properly.",
      concedes: 'Signals real interest, which tells them you are unlikely to walk away.',
      holds: 'Gives no ground on price, terms, or the timeline.',
      assumptions: [],
    },
    {
      stance: 'tactical',
      draft:
        "I'm interested, but the timeline you've set doesn't work for me. If the terms are as strong as you say, they'll hold until the end of the week — can we agree on that?",
      concedes: 'Commits you to acting by the end of the week if they agree.',
      holds: 'Refuses the original deadline and makes them prove it was real.',
      assumptions: [],
    },
    {
      stance: 'direct',
      draft:
        "I don't make decisions this size under a countdown. I'm happy to keep talking on the merits, but the deadline isn't a factor for me.",
      concedes: 'Some warmth — it reads firm, and can cost you if the relationship is fragile.',
      holds: 'The whole pressure lever: the deadline stops working on you.',
      assumptions: [],
    },
  ],
};
