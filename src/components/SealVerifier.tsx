'use client';

import { useState } from 'react';
import type { CompositeVerdict } from '@/lib/frameworks';
import { compositeSealInput, fleetSealInput } from '@/lib/frameworks/seal_payload';

/**
 * GAMBIT YourMove — verify the seal, in the reader's own browser.
 *
 * ============================================================================
 * WHY THIS BUTTON EXISTS
 * ============================================================================
 *
 * Everywhere else, this app ASSERTS that the verdict was sealed before the
 * model ran and that the model could not alter it. An assertion is exactly the
 * kind of thing a user should not have to take on faith — least of all from the
 * system making it about itself.
 *
 * So the check runs here, on the client, with the browser's own Web Crypto
 * SHA-256, over the payload rebuilt from the numbers currently rendered on
 * screen. Nothing is sent anywhere and no server is asked to vouch for itself.
 * If a byte of the verdict had been altered after sealing — by the model, by
 * this route, in transit — the digest computed here would not match the one
 * that travelled with it.
 *
 * WHAT A MATCH PROVES, precisely: the levels, exact scores, per-lens severities,
 * tags, evidence and crash list on screen are the ones the deterministic fleet
 * committed to. It does NOT prove those numbers are correct, and it does not
 * make the model-influenced composite score reproducible — that verdict is
 * flagged best-effort for exactly that reason. It proves integrity, not truth.
 */

type Status =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; coreOk: boolean; compositeOk: boolean; coreDigest: string }
  | { phase: 'unavailable'; message: string };

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function SealVerifier({ verdict }: { verdict: CompositeVerdict }) {
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  async function verify() {
    // Web Crypto needs a secure context. Say so plainly rather than rendering a
    // failed check, which would read as "the seal is broken".
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      setStatus({
        phase: 'unavailable',
        message:
          'This browser exposes no Web Crypto in the current context (it needs HTTPS or localhost), so the check cannot run here. The seal is unaffected.',
      });
      return;
    }

    setStatus({ phase: 'working' });

    const core = verdict.core;
    const coreDigest = await sha256Hex(fleetSealInput(core));
    const compositeDigest = await sha256Hex(
      compositeSealInput({
        sealVersion: verdict.sealVersion,
        schemaVersion: verdict.schemaVersion,
        coreSeal: core.seal,
        determinismLevel: verdict.determinismLevel,
        level: verdict.level,
        score: verdict.score,
        semantic: verdict.semantic,
      }),
    );

    setStatus({
      phase: 'done',
      coreOk: coreDigest === core.seal,
      compositeOk: compositeDigest === verdict.seal,
      coreDigest,
    });
  }

  return (
    <div className="rounded-sm border border-ink-line bg-ink p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">
            Chain of custody
          </p>
          <p className="mt-1 max-w-md text-sm text-text-dim">
            Do not take our word for it. Recompute the SHA-256 in your own browser and
            compare it to the seal that travelled with this verdict.
          </p>
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={status.phase === 'working'}
          className="shrink-0 rounded-sm border border-ink-line px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-text transition hover:border-[color:var(--v-clean)] hover:bg-white/[0.04] disabled:opacity-50"
        >
          {status.phase === 'working' ? 'Hashing…' : 'Verify seal'}
        </button>
      </div>

      {status.phase === 'unavailable' && (
        <p className="mt-3 rounded-sm border-l-2 px-3 py-2 text-sm" style={{ borderColor: 'var(--v-mixed)', background: 'color-mix(in srgb, var(--v-mixed) 10%, transparent)', color: 'var(--v-mixed)' }}>
          {status.message}
        </p>
      )}

      {status.phase === 'done' && (
        <div className="mt-3 space-y-2">
          <CheckRow
            ok={status.coreOk}
            label="Deterministic core"
            okText="recomputed here — matches the sealed digest"
            badText="DOES NOT MATCH — this verdict was altered after sealing"
          />
          <CheckRow
            ok={status.compositeOk}
            label="Composite"
            okText="binds the core seal — matches"
            badText="DOES NOT MATCH — the composite was altered after sealing"
          />
          <p className="break-all pt-1 font-mono text-[10px] leading-relaxed text-text-faint">
            {status.coreDigest}
          </p>
          {status.coreOk && status.compositeOk && (
            <p className="text-xs leading-relaxed text-text-faint">
              Your browser just confirmed the numbers on screen are the ones the rule
              engine committed to before Gemini was called. That is integrity, not
              accuracy — it proves nothing was changed, not that the reading is right.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CheckRow({
  ok,
  label,
  okText,
  badText,
}: {
  ok: boolean;
  label: string;
  okText: string;
  badText: string;
}) {
  return (
    <p
      className="flex flex-wrap items-baseline gap-x-2 text-sm"
      style={{ color: ok ? 'var(--v-clean)' : 'var(--v-manipulative)' }}
    >
      <span className="font-mono text-xs">{ok ? '✓' : '✗'}</span>
      <span className="font-medium">{label}</span>
      <span className={ok ? 'text-text-dim' : ''}>{ok ? okText : badText}</span>
    </p>
  );
}
