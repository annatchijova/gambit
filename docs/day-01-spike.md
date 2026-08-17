# Day 1 — ADK spike

**Date:** 2026-08-17
**Question the plan asked:** can this project be built on `@google/adk` for
TypeScript, and does ADK give native control over timeout and retry, or do we
wrap it ourselves?

Findings are labelled by how they were established. `VERIFIED` means observed
directly in this repository. `DOCUMENTED` means read from an official source
but not executed here. `OPEN` means still untested.

---

## 1. Package and versions

| Item | Value | Basis |
|---|---|---|
| `@google/adk` | 1.6.0 | VERIFIED — installed and imported |
| `@google/genai` | 2.17.1 | VERIFIED — transitive and direct |
| `zod` | 4.4.3, single deduped copy | VERIFIED — `npm ls zod` |
| Node | v22.22.2 | VERIFIED |
| Next.js | 16.3.1 (Turbopack) | VERIFIED — production build passes |

ADK declares `zod: ^4.2.1` and its `LlmAgentSchema` type accepts a Zod v3
object, a Zod v4 object, or a raw GenAI `Schema`. We use one Zod v4 schema for
both the agent's `outputSchema` and the post-hoc response validation.

## 2. Model IDs

| Role | Model | Basis |
|---|---|---|
| READ / THINK / Adversary | `gemini-3.5-flash` | DOCUMENTED — listed as the stable ID on ai.google.dev |
| Coach / Score | `gemini-3.5-flash-lite` | DOCUMENTED — listed in the same family |

`OPEN`: neither ID has been called successfully from this machine. The
development sandbox blocks `generativelanguage.googleapis.com`, so the first
live call happens on the developer's own machine. Until then, "the account has
access to these models" is unverified. This is the one Day-1 item that must be
closed before Day 2 work begins, because it blocks everything downstream.

## 3. Timeout and retry — the plan's open fork, resolved as a SPLIT

The plan carried this as a genuine fork with two outcomes. Both turned out to
be partly right.

**Timeout — native. `VERIFIED`.**
`Runner.runAsync()` accepts an `abortSignal: AbortSignal` parameter. The
deadline is therefore enforced by the SDK, and we do not need a
`Promise.race` wrapper. This matters beyond tidiness: racing a promise leaves
the underlying request running and still billed, and it cannot cancel the
upstream call. We create the `AbortController` and hand ADK the signal.

**Retry — NOT native. `VERIFIED` by exhaustive inspection of the shipped type
definitions.** There is no retry, backoff, attempt-count or jitter option in
`RunnerConfig`, in `RunConfig`, or in `GeminiParams`. `RunConfig` exposes
`maxLlmCalls` (a spend ceiling, not a retry policy) and `streamingMode`.

Consequence: the retry policy in `src/lib/resilience.ts` is ours. Had we
shipped the plan's earlier assumption — "handled in ADK's transport layer,
with exponential backoff and jitter" — the project would have had **no retry
at all** while its own documentation claimed otherwise.

## 4. State integration point — `VERIFIED`

`Runner.runAsync()` accepts `stateDelta: Record<string, unknown>`, applied to
the session before the agent runs. A smoke run confirmed that a session
created with `{ leverage: 0.5 }` and run with `stateDelta: { leverage: 0.65 }`
reported `0.65` afterwards.

This is the concrete answer to "how does `state_rules.ts` connect to ADK
session state", which the plan flagged as unspecified: the deterministic
engine computes the next state, the route writes it via `stateDelta`, and the
Adversary agent receives it as an established fact. The agent is given no tool
that can write those values back.

`State` also exposes `app:`, `user:` and `temp:` key prefixes for scoping.
Unused so far; `temp:` is the natural home for per-turn scratch values that
should not persist.

## 5. The finding that would have shipped a silent bug — `VERIFIED`

**`Runner.runAsync()` does not throw when the model call fails.**

Observed directly: a run with an invalid API key completed normally and
yielded one event carrying `errorCode: '403'` and an `errorMessage`, with no
`content`. The async generator then finished cleanly. No exception was raised
at any point.

The obvious implementation — wrap `for await (...)` in try/catch, accumulate
text, return it — therefore treats a hard upstream failure as a **successful
run that produced an empty string**. Nothing throws, nothing logs, and the UI
renders a blank but confident-looking card.

This is precisely the silent-degradation mode the project claims not to have,
and it would have been discovered on stage rather than on Day 1.

`src/lib/adk/client.ts` handles it: every event is inspected for `errorCode`
and converted into a typed `GambitCallError`, and a run that ends with no
final content is treated as `invalid_response` rather than as an empty
success. Both paths were exercised end-to-end against the running server.

## 6. Verified end-to-end on this machine

- `npm run build` — passes (Next 16, Turbopack).
- `npm run typecheck`, `npm run lint` — clean.
- `npm test` — 40 tests passing.
- `POST /api/read` with `GAMBIT_MOCK=true` → 200, `mode: "mock"`.
- `POST /api/read` with an empty message → 400 with a field-level error.
- `POST /api/read` with a non-JSON body → 400.
- `POST /api/read` with no credentials → 500, `kind: "config"`, naming the
  environment variables to set. It does **not** fall back to the fixture.
- `POST /api/read` with an invalid key → 500, `kind: "config"`, derived from
  the ADK error event rather than from an exception.

## 7. Deviations from the plan, with reasons

1. **`next/font/google` removed.** It fetches font files from
   `fonts.googleapis.com` at build time, which makes every `next build`
   — including the Cloud Run build — depend on that host being reachable. A
   system font stack removes the dependency. If a typeface is chosen on Day 3,
   self-host it with `next/font/local`.
2. **No `export const runtime` / `export const dynamic`.** In Next 16
   `'nodejs'` is the default and the Edge runtime is deprecated with an
   explicit instruction to remove the export; `dynamic` was removed as a
   segment-config option. POST handlers are never cached anyway.
3. **camelCase on the wire.** The planning document sketched the READ schema
   in snake_case. The codebase is camelCase throughout, and one convention is
   worth more than fidelity to a sketch. Change it in
   `src/lib/schemas/read_schema.ts` only, before Day 2, if you disagree.
4. **`state_rules.ts` pulled forward from Day 6 to Day 1.** It is pure
   TypeScript with no dependency on ADK, on the network or on a key, and it is
   the highest-risk component in the plan. Building it while nothing blocks it
   removes the risk from the week where everything else lands. Its tests pass;
   its accuracy remains unmeasured.

## 8. Still open after Day 1

| # | Item | Blocks |
|---|---|---|
| 1 | Confirm the account can actually call `gemini-3.5-flash` and `gemini-3.5-flash-lite` | Day 2 onward — everything |
| 2 | First live READ call, real latency measurement | Day 5 telemetry baseline |
| 3 | Cloud Run deploy of the current build | Continuous-deploy discipline; do it before the app grows |
| 4 | Whether `outputSchema` and tools can coexist on one ADK agent | Day 7, if the Adversary needs a tool |
| 5 | Classifier accuracy against real messages | Day 2 calibration log |
