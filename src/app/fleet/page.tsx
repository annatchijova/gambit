import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The fleet of agents — GAMBIT YourMove',
  description:
    'GAMBIT’s agent fleet: five Gemini agents and four deterministic rule-agents, split by the seal that keeps the model out of the decision.',
};

/**
 * /fleet — the agent-fleet diagram, in the app.
 *
 * Static and server-rendered. The whole thing lives inside `.fleetviz`, whose
 * styles are scoped in globals.css so its generic class names cannot leak.
 * Palette is a placeholder pending a re-theme onto the app's tokens.
 */
export default function Fleet() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="fleetviz">
        <div className="wrap">
          <header>
            <p className="eyebrow">GAMBIT YourMove · Google ADK + Gemini on Vertex</p>
            <h1 className="ttl">
              The fleet of <span className="grad">agents</span>
            </h1>
            <p className="lede">
              Nine analysts read every negotiation. The distinguishing move is not the count — it is{' '}
              <strong>where the line falls</strong>: four rule-agents decide and seal the verdict, and five
              real Gemini agents work <em>around</em> a verdict they can never change.
            </p>
            <div className="legend">
              <span>
                <i className="swatch sw-rule" /> rule-agent · no model
              </span>
              <span>
                <i className="swatch sw-gem" /> Gemini agent (ADK LlmAgent)
              </span>
              <span>
                <i className="swatch sw-seal" /> the seal
              </span>
            </div>
          </header>

          <section className="tier">
            <div className="tier-head">
              <span className="tier-num">01</span>
              <span className="tier-title">
                <b>Decide &amp; seal</b> · deterministic, runs first, no model
              </span>
            </div>

            <div className="center">
              <span className="msg-chip">One inbound message</span>
            </div>
            <span className="flow">↓</span>

            <div className="grid">
              <div className="card rule grice">
                <span className="top" />
                <span className="glyph">G</span>
                <div className="id">Grice</div>
                <div className="role">evasion, obfuscation</div>
              </div>
              <div className="card rule cialdini">
                <span className="top" />
                <span className="glyph">C</span>
                <div className="id">Cialdini</div>
                <div className="role">influence tactics</div>
              </div>
              <div className="card rule aristotle">
                <span className="top" />
                <span className="glyph">A</span>
                <div className="id">Aristotle</div>
                <div className="role">pathos vs logos</div>
              </div>
              <div className="card rule berne">
                <span className="top" />
                <span className="glyph">B</span>
                <div className="id">Berne</div>
                <div className="role">ulterior moves</div>
              </div>
            </div>
            <span className="flow">↓ each must quote a verbatim span to convict</span>
          </section>

          <div className="seal">
            <span className="mark">SHA-256 · sealed core verdict</span>
            <span className="snote">
              fixed here, before any model is called — and re-checkable in your own browser
            </span>
            <span className="hash">6fd111f5…</span>
          </div>

          <div className="center">
            <span className="verdict-chip">
              composite verdict <b>+ rule-vs-model divergence</b>, shown not averaged
            </span>
          </div>

          <section className="tier">
            <div className="tier-head">
              <span className="tier-num">02</span>
              <span className="tier-title">
                <b>Gemini agents</b> · vote, narrate, draft, converse — never decide
              </span>
            </div>

            <div className="grid five">
              <div className="card gem">
                <span className="top" />
                <span className="glyph">◆</span>
                <div className="id">gambit_read</div>
                <div className="role">reads the message and casts a manipulation vote beside the rules</div>
              </div>
              <div className="card gem">
                <span className="top" />
                <span className="glyph">◆</span>
                <div className="id">gambit_think</div>
                <div className="role">drafts three replies — soft, tactical, direct — never sends</div>
              </div>
              <div className="card gem">
                <span className="top" />
                <span className="glyph">◆</span>
                <div className="id">gambit_ask</div>
                <div className="role">answers questions about the sealed verdict; cannot revise it</div>
              </div>
              <div className="card gem">
                <span className="top" />
                <span className="glyph">◆</span>
                <div className="id">gambit_adversary</div>
                <div className="role">the practice counterparty, replies in persona</div>
              </div>
              <div className="card gem">
                <span className="top" />
                <span className="glyph">◆</span>
                <div className="id">gambit_assistant</div>
                <div className="role">chat, and reads a pasted contract for inconsistencies</div>
                <span className="tool">⌕ Google Search</span>
              </div>
            </div>
          </section>

          <footer className="foot">
            <span className="count">5 Gemini agents + 4 rule-agents · COACH &amp; SCORE reserved, not built</span>
            <span className="thesis">
              The rules decide; the model narrates. Sealed <b>before</b> Gemini is ever called.
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}
