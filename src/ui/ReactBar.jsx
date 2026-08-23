/* ============================================================
   THE TWO THINGS TO DO WHILE SOMEBODY ELSE HAS THE FLOOR.

   Both live below the fold on the phone and neither is ever the
   loudest thing on it — they are for the four people who are not
   currently acting, and the moment one of them competes with the
   turn actions it has become a distraction from the game rather
   than a way into it.
   ============================================================ */
import React from "react";
import { REACTIONS } from "../engine/reactions.js";
import "./react.css";

/** One tap, no confirmation, no undo.

    A confirmation step on a reflex is a contradiction: the entire
    value is that it costs nothing, and a modal asking "react with
    flinch?" costs more than the thing is worth. Nothing here can
    move anything, so there is nothing to protect. */
export function ReactBar({ onReact, cooling = false, disabled = false }) {
  return (
    <section className="react-bar" aria-label="React">
      <h3 className="react-title">While you wait</h3>
      <div className="react-grid">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="react-btn"
            disabled={disabled || cooling}
            onClick={() => onReact(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {/* The cooldown is stated rather than hidden. A dead button
          with no reason is the "I tapped and nothing happened"
          failure this codebase has already fixed twice. */}
      {cooling && <p className="react-cool">Give it a moment.</p>}
    </section>
  );
}

/** "I'm helping her."

    The mechanic is old — modifiers.js has turned an assist into
    Advantage since the beginning. What never existed was a way for
    the helper to start it: the assist was something the person
    ROLLING picked off a menu of bodies, which is backwards. At a
    table the sentence comes from the person helping, before the
    dice are out, and the whole point is that everyone hears it. */
export function AssistOffer({ crew = [], me, offered = null, onOffer, onWithdraw, spent = false }) {
  const others = crew.filter((c) => c.id !== me && c.alive !== false);
  if (!others.length) return null;

  /* Spent for the day. The button is gone rather than present and
     refusing, because a player who taps a live-looking button and
     gets nothing learns not to trust the screen. */
  if (spent && !offered) {
    return (
      <section className="assist-bar">
        <h3 className="react-title">Helping</h3>
        <p className="assist-spent">You have already helped someone today.</p>
      </section>
    );
  }

  if (offered) {
    return (
      <section className="assist-bar">
        <h3 className="react-title">Helping</h3>
        <p className="assist-live">
          You are helping <strong>{offered.toName}</strong>. It is on the table screen.
        </p>
        {/* Withdrawing is free and silent. An offer nobody took
            should not cost the person who made it. */}
        <button type="button" className="assist-btn is-off" onClick={onWithdraw}>
          Never mind
        </button>
      </section>
    );
  }

  return (
    <section className="assist-bar">
      <h3 className="react-title">Helping</h3>
      <div className="assist-grid">
        {others.map((c) => (
          <button
            key={c.id}
            type="button"
            className="assist-btn"
            onClick={() => onOffer(c.id)}
          >
            Help {c.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export default ReactBar;
