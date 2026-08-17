# GAMBIT YourMove

**Tactical AI copilot for high-stakes negotiations.**

You are about to reply to a message that will cost you money. GAMBIT reads
what the other side is actually doing, shows you the evidence it used, tells
you how sure it is — and then stops. It does not send anything, and it does
not decide anything on your behalf.

> AI increases agency. It does not replace it.

---

## Status

Day 1 of a 14-day build. **READ** is implemented end-to-end; **THINK**,
**TRAIN** and **SCORE** are not yet built and are deliberately absent from the
interface rather than stubbed, so nothing on screen promises a capability that
does not exist.

The deterministic state engine that TRAIN depends on
(`src/lib/state_rules.ts`) is complete and tested ahead of schedule, because
it has no dependency on the network, on a key, or on the SDK.

## Spin-up

Requires **Node 22 or newer**.

```bash
git clone <repository-url>
cd gambit-yourmove
npm install
cp .env.example .env.local
```

Then pick a backend and put it in `.env.local`.

**Gemini API** — fastest to start. Get a key at
[aistudio.google.com](https://aistudio.google.com):

```bash
GEMINI_API_KEY=...
```

**Vertex AI** — better for the Cloud Run deployment, because the service
authenticates with its own service account and no API key ever sits in an
environment variable:

```bash
gcloud auth application-default login
gcloud services enable aiplatform.googleapis.com --project <your-project>
```

```bash
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

**Confirm the backend works before writing anything else.** This is one call
per model and it either passes or it tells you exactly what is wrong:

```bash
npm run verify:model     # writes docs/model_access.md
npm run dev              # http://localhost:3000
```

**No key to hand?** Run the interface against a stored fixture:

```bash
GAMBIT_MOCK=true npm run dev
```

Fixture mode is opt-in only. It is never entered because a key is missing or a
call failed — those surface as errors. Every response is tagged
`mode: "mock"` and the interface shows a visible badge, so a fixture can never
be mistaken for a live read.

### Verify the checkout

```bash
npm run verify           # typecheck + lint + docs freshness + classifier regression + tests
```

Nothing in `verify` touches the network, so it runs the same on a laptop, in
CI and on a plane.

### Calibrate

Two harnesses, measuring two different things.

```bash
npm run calibrate:rules  # deterministic classifier vs. its corpus
npm run calibrate:read   # READ over 15 real messages (needs `npm run dev` running)
```

`calibrate:rules` reports the authored and field corpora **separately and
never averages them**. Agreement on the authored corpus says the engine
behaves as specified — it is a refactor guard. Only the field corpus, made of
messages a real user typed, can say anything about accuracy, and it starts
empty.

`calibrate:read` runs the full HTTP route and writes
`docs/read_test_log.md` with a blank verdict line per case. It deliberately
does not score itself: a model grading its own tactic labels produces a
percentage with nothing behind it. Two things to check on every case — that
the quoted evidence is verbatim, and that the two `lowsignal-*` cases come
back **Low**. If either returns High, the uncertainty layer is decorative.

### Deploy to Cloud Run

```bash
gcloud run deploy gambit-yourmove \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key    # or --set-secrets for a real secret
```

## Architecture

Four modules. Only the first is built.

| Module | Does | Status |
|---|---|---|
| **READ** | Names the tactic in an inbound message, with calibrated confidence, quoted evidence and competing readings | Built |
| **THINK** | Three strategic replies — soft, tactical, direct — shaped by the user's own voice profile and red lines | Phase 1B |
| **TRAIN** | Practice against a simulated counterparty that adapts, with asynchronous coaching | Phase 1C |
| **SCORE** | A negotiation score across four axes, computed from the transition log | Phase 1D |

### The part that matters: the model does not decide anything

The counterparty's model of the negotiation — `perceivedUserLeverage`,
`trust`, `patience` — is never updated by a language model.

Every user move is classified by a deterministic rule engine
(`src/lib/state_rules.ts`). The engine computes the next state, seals the
transition with a SHA-256 that chains to the previous one, and hands the
result to the Adversary agent as an established fact. The agent's only job is
to phrase a reply consistent with a state it cannot change. It is given no
tool that can write those values back.

The consequence is that every number on screen can be traced to a named rule,
and any session can be replayed to a bit-identical result. See
[`docs/state_rules.md`](docs/state_rules.md) — generated from the code, so it
cannot drift from it.

**What is claimed, precisely.** The engine is *deterministic*: same message,
same prior state, same result, on any machine. That is tested. The engine is
not claimed to be *accurate* — whether its labels match a human negotiation
coach's has not been measured. Determinism and accuracy are different
properties and only one of them is in evidence.

### Failure is visible, never silent

The Day 1 spike found that `Runner.runAsync()` does not throw when a model
call fails: it yields an event carrying an `errorCode` and then completes
normally. A straightforward implementation would report a 403 as a successful
run that produced an empty string, and render a blank but confident-looking
card.

Every call therefore runs under an explicit policy — 3.5 s on the critical
path, 5.0 s in the background, one retry with full jitter — and returns a
typed `Outcome` that forces the caller to handle the failure branch. When the
model does not answer, the user is told the model did not answer.

### Layout

```
src/
  app/
    api/read/route.ts        request boundary, policy, response re-validation
    page.tsx                 READ screen
  components/ReadCard.tsx    result card with the uncertainty layer
  lib/
    models.ts                single source of truth for model IDs
    env.ts                   credential boundary
    types.ts                 NegotiationState, VoiceProfile
    state_rules.ts           the deterministic engine
    resilience.ts            timeout, retry, honest degradation
    telemetry.ts             latency samples for the Day 5 / Day 13 measurements
    schemas/                 Zod contracts, in and out
    adk/                     ADK seam: model factory, runner, READ agent
    mock/                    opt-in fixture
docs/
  day-01-spike.md            what the spike established, and how
  journal.md                 running log; source for the submission write-up
  state_rules.md             GENERATED from state_rules.ts
tests/                       40 tests: determinism, precedence, chain, policy
scripts/                     doc generator
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 ·
[Google ADK for TypeScript](https://github.com/google/adk-js) ·
Gemini 3.5 Flash and 3.5 Flash-Lite · Cloud Run · Vitest

## Licence

Not yet chosen.
