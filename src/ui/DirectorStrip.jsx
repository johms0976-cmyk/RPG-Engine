/* ============================================================
   THE DIRECTOR'S STRIP — a suggestion, and a person deciding.

   This is how the director earns the chair rather than being
   handed it. Assisted mode is the whole point: a Warden is
   present, the policy proposes, and a human accepts or ignores
   every single Move. Nothing runs on its own. If the ladder is
   badly ordered, or the atmosphere rung is too talkative, or the
   guard drops something it should not, a person finds out at a
   table that is still working — instead of four players finding
   out at a table that is not.

   Empty-chair mode is then a one-line change: the veto set to
   auto. Which is the correct order to build these in, because
   the version with a human in it is the version that can tell
   you it is wrong.

   Deliberately small and ignorable. It renders one suggestion,
   never a queue: a strip that accumulates becomes a list of jobs
   and a Warden with a list of jobs is worse off than one with
   nothing. A Move that goes unanswered simply expires when the
   policy next disagrees with itself.
   ============================================================ */
import React from "react";
import { moveLabel } from "../engine/director.js";

export default function DirectorStrip({ move, mod, crew, onTake, onDismiss, vetoes, limit }) {
  if (!move) return null;
  const label = moveLabel(move, { mod, crew });
  if (!label) return null;

  /* HOW CLOSE THIS RUNG IS TO BEING RETIRED.

     Waving the same rung away three times stops it being offered
     for the rest of the session, which is the cheapest instrument
     available for finding out which rungs are wrong. But a system
     that quietly stops offering something is a system nobody can
     tell is broken — so the last refusal is announced before it
     happens rather than discovered afterwards by its absence. */
  const seen = (vetoes && move.rung && vetoes[move.rung]) || 0;
  const lastChance = limit && seen === limit - 1;

  return (
    <div className="dir-strip" role="status">
      <span className="dir-k">SUGGESTION</span>
      <span className="dir-what">
        {label}
        {/* Why the director thinks so. A nudge you can see the reason
            for is a system being legible; the same nudge without one
            is a system being weird. */}
        <span className="dir-rung">{move.rung}</span>
        {/* The words themselves, where there are any. A Warden
            deciding whether to say something needs to see what it
            is, not a category. */}
        {move.text && <em className="dir-text">{move.text}</em>}
      </span>
      <span className="dir-row">
        <button type="button" className="btn inline small accent" onClick={() => onTake && onTake(move)}>
          Do it
        </button>
        <button type="button" className="btn inline small ghost"
          title={lastChance ? `One more "no" and ${move.rung} stops being suggested this session` : undefined}
          onClick={() => onDismiss && onDismiss(move)}>
          {lastChance ? "No — and stop" : "No"}
        </button>
      </span>
    </div>
  );
}
