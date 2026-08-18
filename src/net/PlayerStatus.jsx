/* ============================================================
   PLAYER STATUS — the strip that is always there.

   The three questions a player asks between every action are
   "where am I", "am I hurt", and "is it my go". All three used to
   live behind a drawer, so answering any of them cost a tap and
   lost your place in the log. On a shared screen that is fine —
   the Warden answers out loud. On six separate phones it is the
   single biggest source of "what's happening?".

   So they live at the top, permanently, in about 44px. Health and
   Stress are drawn as filled segments rather than numbers because
   at arm's length on a sofa you read a shape faster than you read
   "12/16" — the numbers are still there for anyone who wants them,
   and for screen readers, which get the full sentence.

   The turn state is the loudest thing on it. Out of combat it says
   the room. In combat it is either your name or theirs, and when
   it is yours the whole strip changes colour, because a player who
   has not noticed it is their turn is the most common way a
   Mothership session stalls.
   ============================================================ */
import React from "react";
import { currentTurn } from "../engine/combat.js";

/** Segmented meter. `warn` flips it to the blood colour. */
function Pips({ label, value, max, warn, invert }) {
  const n = Math.max(1, Math.min(12, max || 1));
  const filled = Math.round((Math.max(0, value) / Math.max(1, max)) * n);
  return (
    <div className={`pips ${warn ? "is-warn" : ""}`}>
      <span className="pips-label">{label}</span>
      <span
        className="pips-track"
        role="meter"
        aria-label={`${label} ${value} of ${max}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={(invert ? i < filled : i < filled) ? "on" : ""} aria-hidden="true" />
        ))}
      </span>
      <span className="pips-num">{value}</span>
    </div>
  );
}

export default function PlayerStatus({ g, waitingOn }) {
  if (!g || !g.pc) return null;
  const { pc, mod, w, combat } = g;

  const room = (mod.rooms && mod.rooms[w.room] && mod.rooms[w.room].name) || w.room || "somewhere";
  const turn = combat ? currentTurn(combat) : null;
  const mine = !!(turn && turn.side === "pc" && turn.id === pc.id);
  const actor = combat && combat.actors ? combat.actors[pc.id] : null;

  let state = "calm";
  if (mine) state = "mine";
  else if (combat) state = "combat";
  else if (waitingOn) state = "held";

  const headline = combat
    ? mine
      ? `Your turn · ${actor ? actor.actions : 0} action${actor && actor.actions === 1 ? "" : "s"}`
      : `Round ${combat.round} · ${turn ? turn.name || "…" : "…"}`
    : waitingOn
      ? `Waiting on ${waitingOn}`
      : room;

  return (
    <header className="pstatus" data-state={state}>
      <div className="pstatus-who">
        <strong>{pc.name}</strong>
        <span>{(pc.cls || "").toUpperCase()}</span>
      </div>

      <div className="pstatus-turn" aria-live="polite">{headline}</div>

      <div className="pstatus-meters">
        <Pips label="HP" value={pc.health} max={pc.maxHealth} warn={pc.health <= pc.maxHealth / 3} />
        <Pips label="ST" value={pc.stress} max={20} warn={pc.stress >= 8} invert />
      </div>
    </header>
  );
}
