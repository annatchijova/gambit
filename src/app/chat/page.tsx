'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * /chat — the assistant.
 *
 * The open-ended, LLM-forward surface: a copilot that helps, suggests, searches
 * the web, and reads a pasted contract for inconsistencies and red flags. The
 * disclaimer is fixed and unmissable — guidance, not legal advice — because this
 * is exactly the surface where a user might mistake help for a ruling.
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
        <p className="brand-text text-[11px] font-semibold uppercase tracking-[0.24em]">Assistant</p>
        <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">Think it through with a copilot.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
          Ask anything about a negotiation or a contract. It can look things up, suggest wording, and point
          out what is inconsistent or worth checking in a document you paste.
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200/90">
        Guidance, not legal advice. It can flag inconsistencies and things to check, but confirm anything
        with legal or financial weight with a qualified professional.
      </div>

      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Try</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-white/70 transition hover:border-violet-400/40 hover:bg-violet-500/[0.05]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90'
                  : 'mr-auto max-w-[92%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-violet-400/20 bg-violet-500/[0.05] px-3 py-2.5 text-sm leading-relaxed text-white/85'
              }
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="mr-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full brand-gradient" />
              <span className="text-xs text-white/50">thinking, and searching the web if it helps…</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>
      )}

      <div className="sticky bottom-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0a0a0b]/90 p-2 backdrop-blur">
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
          className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white/90 outline-none transition placeholder:text-white/25 focus:border-white/30"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/30">It never sends or signs anything. You decide.</span>
          <button
            type="button"
            onClick={() => send()}
            disabled={sending || input.trim().length === 0}
            className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
          >
            {sending ? 'Working…' : 'Send'}
          </button>
        </div>
      </div>
    </main>
  );
}
