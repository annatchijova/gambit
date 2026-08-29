'use client';

/**
 * GAMBIT YourMove — worked examples.
 *
 * A blank textarea tells a first-time visitor nothing about what to paste.
 * These do: four real negotiation messages, one per common tactic plus a clean
 * control, each a click away from a live read. The clean one is deliberate —
 * it shows the tool does not cry wolf on an honest message.
 */

export interface Example {
  label: string;
  hint: string;
  message: string;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Manufactured urgency',
    hint: 'A deadline with no reason behind it',
    message:
      "Act now — this is your last chance and the offer won't last. With all due respect, but you should know better; you'll regret it if you miss out. Trust me, I've been doing this for years.",
  },
  {
    label: 'Guilt + reciprocity',
    hint: 'Turning a favour into leverage',
    message:
      "After everything I have done for you, I would hate to see you walk away over a few hundred dollars. I really thought we had an understanding here — don't put me in a tough spot with my boss.",
  },
  {
    label: 'Borrowed authority',
    hint: 'Asserting a rule instead of a reason',
    message:
      "In my professional opinion, the market dictates this rate — it's standard practice and everyone in the industry already works this way. This is simply how it's done.",
  },
  {
    label: 'A reasonable message',
    hint: 'What honest looks like (should read clean)',
    message:
      'The going rate for this scope is around 95k based on comparable roles I pulled. Here are the figures — happy to walk through the reasoning and adjust if your numbers differ.',
  },
];

export function Examples({ onPick, disabled }: { onPick: (message: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        Try an example
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(ex.message)}
            className="group rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-violet-400/40 hover:bg-violet-500/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-white/85">{ex.label}</span>
              <span className="font-mono text-[10px] text-white/25 transition group-hover:text-violet-300">
                run →
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/40">{ex.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
