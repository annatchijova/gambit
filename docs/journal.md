# Build journal

The competition submission requires a **Findings and learnings** section. That
section is written from this file, so it is written from things that actually
happened rather than reconstructed on the last night.

Fifteen minutes at the end of each day. Four labels, borrowed from the
abductive loop: what the code definitely does, what is still a guess, what got
confirmed, what got killed.

- **CODE FACT** — observed in this repository. Reproducible.
- **HYPOTHESIS** — plausible, not yet tested. Says what would settle it.
- **CONFIRMED** — a hypothesis that survived a test. Names the test.
- **FALSIFIED** — a hypothesis that died. Names what replaced it.

Never promote a HYPOTHESIS to CODE FACT without naming the observation. A
belief that travels without its evidence is how a write-up ends up claiming
something nobody checked.

---

## Day 1 — 2026-08-17

**CODE FACT.** `@google/adk@1.6.0` installs, imports and runs on Node 22 inside
a Next 16 App Router project. `Runner` + `InMemorySessionService` work
programmatically; the `npx adk` CLI is not needed.

**CODE FACT.** `Runner.runAsync()` accepts `abortSignal`. Timeout is native to
the SDK.

**CODE FACT.** `Runner.runAsync()` accepts `stateDelta`, and the delta is
committed to session state. Observed: session seeded `{leverage: 0.5}`, run
with `stateDelta {leverage: 0.65}`, read back as `0.65`.

**CODE FACT.** `@google/adk@1.6.0` exposes no retry, backoff or attempt option
in `RunnerConfig`, `RunConfig` or `GeminiParams`.

**FALSIFIED.** The plan asserted that retry with exponential backoff and
jitter was "handled in ADK's transport layer". It is not. Replaced by an
explicit policy in `src/lib/resilience.ts` (3.5 s critical / 5.0 s background,
one retry, full jitter). Had this gone unchecked, the project would have
shipped with no retry while documenting one.

**FALSIFIED — the expensive one.** Assumed a failed model call would throw and
be caught. It does not: ADK yields an event carrying `errorCode`, then the
generator completes normally. The natural implementation would have reported a
403 as a successful run returning an empty string. Replaced by explicit event
inspection in `src/lib/adk/client.ts`; an empty run is now an
`invalid_response` failure, not an empty success.

**FALSIFIED.** A code comment claimed that without rank-1-before-rank-2
ordering, every conditional trade would be misread as an unconditional
concession. Writing the test disproved it: `UNCONDITIONAL_CONCESSION` carries
an explicit `!CONDITION` guard, so the two predicates are disjoint and neither
can shadow the other at any ordering. The comment was rewritten and the test
now asserts the disjointness, which is the invariant that actually holds. The
ordering stays as a second line of defence against a deleted guard.

**HYPOTHESIS.** The account can call `gemini-3.5-flash` and
`gemini-3.5-flash-lite`. Model IDs are documented; no successful call has been
made from any machine yet, because the development sandbox blocks
`generativelanguage.googleapis.com`. **Settled by:** one live `POST /api/read`
with a real key. This is the first task of Day 2 and it blocks everything.

**HYPOTHESIS.** p50 ≤ 1.8 s / p95 ≤ 2.5 s on the critical path. Still a guess —
no live call has been timed. **Settled by:** the Day 5 telemetry run.

**HYPOTHESIS.** The lexical classifier in `state_rules.ts` labels real
negotiation messages the way a human would. Determinism is tested; accuracy is
not. **Settled by:** the Day 2 calibration log against real messages.

---

## Day 2 — _(pending)_
