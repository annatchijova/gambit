<!--
  GENERATED FILE — do not edit by hand.
  Source of truth: src/lib/state_rules.ts
  Regenerate with: npm run docs:rules
-->

# Deterministic state rules

GAMBIT YourMove never lets a language model decide how the opponent's model of
the negotiation changes. Every change to `perceivedUserLeverage`, `trust` and
`patience` is produced by the rule table below, in code, before any agent is
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

Scores are integers on a closed `[0, 100]` interval. The approved rule table
was written in hundredths (`+0.15`, `-0.20`); on this scale those are `+15`
and `-20`, with no conversion loss and no float drift. Divide by 100 at the
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
| 1 | `CONDITIONAL_TRADE` | Gives ground on one point only if the counterparty moves on another ("I can do X if you cover Y"). | +5 | +10 | 0 |
| 2 | `UNCONDITIONAL_CONCESSION` | Gives ground on price or timing without asking for anything back. | -20 | -10 | 0 |
| 3 | `REJECT_ANCHOR_WITH_ALT` | Refuses the anchor and names a concrete outside option (a real BATNA). | +15 | 0 | -5 |
| 4 | `PRESSURE_TEST` | Applies a deadline or tests the walk-away boundary without naming an alternative. | +10 | 0 | -15 |
| 5 | `COUNTER_ANCHOR_VALIDATED` | States a number and justifies it with an external standard (market data, comparables, costs). | +10 | +5 | 0 |
| 6 | `DEFAULT_AMBIGUOUS` | Mixed, generic, or clarifying message that triggers no rule above. | 0 | 0 | 0 |

## Why the ranks sit where they do

**1. `CONDITIONAL_TRADE`** — Runs first because the concession vocabulary is a superset of the unconditional case; if UNCONDITIONAL_CONCESSION ran first every trade would be misread as a giveaway.

**2. `UNCONDITIONAL_CONCESSION`** — A completed, irreversible transfer of value. Dominates refusals and postures, which cost the speaker nothing.

**3. `REJECT_ANCHOR_WITH_ALT`** — A held alternative is a structural position, so it outranks a deadline, which is only a posture.

**4. `PRESSURE_TEST`** — Costs the speaker nothing to assert, so it buys less leverage than a real alternative and burns the opponent’s patience instead.

**5. `COUNTER_ANCHOR_VALIDATED`** — Loosest substantive pattern — most negotiation messages contain a number — so it must not pre-empt the rules above.

**6. `DEFAULT_AMBIGUOUS`** — Total coverage by construction. Neutral impact is the honest response to an unrecognised move: the engine says "no signal" instead of inventing one.

## Totality

`DEFAULT_AMBIGUOUS` matches unconditionally, so classification is total:
every possible input — empty, emoji-only, 4,000 characters of mixed intent —
lands on a rule with a defined impact. There is no branch where a fallback
gets improvised inside a prompt at two in the morning.
