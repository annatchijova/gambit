'use client';

import { useRef, useState } from 'react';
import type { CompositeVerdict } from '@/lib/frameworks';
import type { ReadOutput } from '@/lib/schemas/read_schema';
import type { AskTurn } from '@/lib/schemas/ask_schema';

/**
 * GAMBIT YourMove — asking about a verdict that is already sealed.
 *
 * ============================================================================
 * WHY A CHAT DOES NOT BREAK THE ARCHITECTURE
 * ============================================================================
 *
 * READ is stateless on purpose, and nothing here changes that. This panel opens
 * a conversation whose SUBJECT is a verdict the deterministic fleet already
 * produced and sealed. The model explains; it cannot revise. The numbers above
 * this panel keep rendering from the sealed verdict no matter what is said
 * here, and the reader can re-hash that seal in their own browser after any
 * amount of conversation and still get a match.
 *
 * Three things this component does rather than assumes:
 *
 *   - It sends the MESSAGE, never the verdict. The server recomputes the fleet
 *     from that message and grounds the answer in what it computes for itself.
 *   - It checks the seal the server says it grounded in against the seal on
 *     screen. If they ever differ, the answer is about a different verdict than
 *     the reader is looking at, and it says so instead of showing the prose.
 *   - It marks every answer as the model speaking, in the same dashed register
 *     the annotations use, so nothing here is mistaken for a sealed reading.
 */

const STARTERS = [
  'Why did the rules and Gemini disagree?',
  'Which lens is doing the most work here?',
  'What would make this a clean message?',
] as const;

type Entry =
  | { kind: 'q'; text: string }
  | { kind: 'a'; text: string; outOfRemit: boolean; mock: boolean }
  | { kind: 'error'; text: string };

export function AskPanel({
  message,
  verdict,
  read,
}: {
  message: string;
  verdict: CompositeVerdict;
  read: ReadOutput | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (question.length === 0 || busy) return;

    // The transcript the server needs, rebuilt from what is on screen. Errors
    // are not part of the conversation and are not sent.
    const history: AskTurn[] = [];
    for (const e of entries) {
      if (e.kind === 'q') history.push({ role: 'user', text: e.text });
      else if (e.kind === 'a') history.push({ role: 'assistant', text: e.text });
    }

    setEntries((prev) => [...prev, { kind: 'q', text: question }]);
    setDraft('');
    setBusy(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, question, history, read }),
      });
      const body = await res.json();

      if (!res.ok) {
        setEntries((prev) => [
          ...prev,
          { kind: 'error', text: body?.error?.message ?? 'The question did not go through.' },
        ]);
        return;
      }

      // The answer must be about the verdict on screen, not some other one.
      if (body.groundedInSeal !== verdict.core.seal) {
        setEntries((prev) => [
          ...prev,
          {
            kind: 'error',
            text:
              'That answer was grounded in a different verdict than the one shown above, so it is not being displayed. Run the read again.',
          },
        ]);
        return;
      }

      setEntries((prev) => [
        ...prev,
        {
          kind: 'a',
          text: body.answer.answer,
          outOfRemit: Boolean(body.answer.outOfRemit),
          // Tagged per answer, never inferred. A stored answer must not be
          // mistakable for a live one — the same rule the READ fixture obeys.
          mock: body.mode === 'mock',
        },
      ]);
    } catch {
      setEntries((prev) => [...prev, { kind: 'error', text: 'Could not reach the server.' }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="rounded-sm border border-ink-line bg-ink-raised p-6">
      <h2 className="label">Ask about this reading</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-dim">
        Gemini can explain the verdict above. It cannot change it — the numbers were sealed before
        it was called, and they stay sealed however long you talk. Asking explains; it does not
        decide for you or send anything. (Drafting a reply is a separate, explicit step.)
      </p>

      {entries.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="rounded-sm border border-ink-line px-3 py-1.5 text-left text-[12px] text-text-dim transition hover:border-[color:var(--lens-gemini-lit)] hover:text-text disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <ol className="mt-5 list-none space-y-4 p-0">
          {entries.map((e, i) =>
            e.kind === 'q' ? (
              <li key={i} className="text-[14px] font-semibold leading-relaxed text-text">
                {e.text}
              </li>
            ) : e.kind === 'error' ? (
              <li
                key={i}
                className="border-l-2 pl-3.5 text-[13px] leading-relaxed"
                style={{ borderColor: 'var(--v-manipulative)', color: 'var(--v-manipulative)' }}
              >
                {e.text}
              </li>
            ) : (
              <li
                key={i}
                className="border-l-2 border-dashed pl-3.5"
                style={{ borderColor: 'var(--lens-gemini-lit)' }}
              >
                {e.mock && (
                  <p className="label mb-1" style={{ color: 'var(--lens-grice-lit)' }}>
                    Stored answer — GAMBIT_MOCK is on, no model was called
                  </p>
                )}
                {e.outOfRemit && (
                  <p className="label mb-1" style={{ color: 'var(--v-mixed)' }}>
                    Outside what GAMBIT does
                  </p>
                )}
                <p className="m-0 text-[13px] leading-relaxed text-text-dim">{e.text}</p>
              </li>
            ),
          )}
        </ol>
      )}

      <form
        className="mt-5 flex gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          ask(draft);
        }}
      >
        <label htmlFor="ask" className="sr-only">
          Your question about this reading
        </label>
        <input
          id="ask"
          ref={inputRef}
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          maxLength={500}
          placeholder="Ask why a lens fired…"
          className="min-w-0 flex-1 rounded-sm border border-ink-line bg-ink px-3.5 py-2 text-sm text-text outline-none transition placeholder:text-text-faint focus:border-[color:var(--lens-gemini-lit)]"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="shrink-0 rounded-sm border border-ink-line px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-text transition hover:border-[color:var(--lens-gemini-lit)] disabled:opacity-40"
        >
          {busy ? 'Asking…' : 'Ask'}
        </button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
        Answers are the model speaking — dashed, like its annotations, and best-effort. The sealed
        verdict is unaffected: verify it above after asking anything you like.
      </p>
    </section>
  );
}
