'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * /chat — the assistant.
 *
 * The open-ended, LLM-forward surface: a copilot that helps, suggests, searches
 * the web, and reads a pasted contract for inconsistencies. The disclaimer is
 * fixed and unmissable — guidance, not legal advice. The assistant's own turns
 * are marked in the model's slate, and with a dashed rule, the same way Gemini
 * is marked everywhere else: a different kind of witness, never a rule.
 */

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Paste a contract clause and ask what looks inconsistent or one-sided.',
  'What is a fair day rate for a senior freelance developer in my region?',
  'They sent a lowball offer with a deadline. How should I think about replying?',
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? 'The message failed.');
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: body.reply as string }]);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-12">
      <header>
        <p className="label">Assistant</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-text">Think it through with a copilot.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-dim">
          Ask anything about a negotiation or a contract. It can look things up, suggest wording, and point
          out what is inconsistent or worth checking in a document you paste.
        </p>
      </header>

      <div className="rounded-sm border border-ink-line bg-ink-raised px-3 py-2 text-xs text-text-dim">
        <span className="label !text-[color:var(--lens-aristotle-lit)]">Not legal advice</span>{' '}
        — it flags inconsistencies and things to check, but confirm anything with legal or financial weight
        with a qualified professional.
      </div>

      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="label">Try</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-sm border border-ink-line bg-ink-raised px-3 py-2 text-left text-sm text-text-dim transition hover:border-text-faint hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div
                key={i}
                className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-sm border border-ink-line bg-ink-raised px-3 py-2 text-sm text-text"
              >
                {m.content}
              </div>
            ) : (
              <div
                key={i}
                className="mr-auto max-w-[92%] whitespace-pre-wrap rounded-sm border border-ink-line bg-ink-raised px-3 py-2.5 text-sm leading-relaxed text-text"
                style={{ borderLeft: '2px dashed color-mix(in srgb, var(--lens-gemini-lit) 55%, transparent)' }}
              >
                {m.content}
              </div>
            ),
          )}
          {sending && (
            <div className="mr-auto flex items-center gap-2 rounded-sm border border-ink-line bg-ink-raised px-3 py-2">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: 'var(--lens-gemini-lit)' }}
              />
              <span className="text-xs text-text-dim">thinking, and searching the web if it helps…</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <div className="rounded-sm border-l-2 border-[color:var(--v-manipulative)] bg-[color:var(--v-manipulative)]/10 p-3">
          <p className="text-sm text-text">{error}</p>
        </div>
      )}

      <div className="sticky bottom-4 flex flex-col gap-2 rounded-sm border border-ink-line bg-ink/90 p-2 backdrop-blur">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={8000}
          placeholder="Ask, or paste a contract clause…  (Cmd/Ctrl+Enter to send)"
          className="w-full resize-y rounded-sm border border-ink-line bg-ink p-3 text-sm leading-relaxed text-text outline-none transition placeholder:text-text-faint focus:border-[color:var(--lens-aristotle-lit)]"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-faint">It never sends or signs anything. You decide.</span>
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || input.trim().length === 0}
            className="rounded-sm bg-paper px-5 py-2 text-sm font-semibold text-paper-ink transition hover:bg-white disabled:cursor-not-allowed disabled:bg-ink-line disabled:text-text-faint"
          >
            {sending ? 'Working…' : 'Send'}
          </button>
        </div>
      </div>
    </main>
  );
}
