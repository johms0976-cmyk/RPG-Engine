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
import { DURESS } from "../engine/duress.js";
import { tempoOf, sceneHolder, scenePosition, sceneSpent, WAIT_TEXT } from "../engine/tempo.js";
import { roomOf, othersHere, isSplit } from "../engine/party.js";

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

export default function PlayerStatus({ g, waitingOn, duress }) {
  if (!g || !g.pc) return null;
  const { pc, mod, w, combat, crew } = g;

  /* The room *this* character is in. `w.room` is derived — where
     most of the crew is — and telling somebody standing alone in
     the vents that they are in the mess is worse than saying
     nothing. */
  const myRoom = roomOf(pc, w);
  const room = (mod.rooms && mod.rooms[myRoom] && mod.rooms[myRoom].name) || myRoom || "somewhere";
  const alone = isSplit(crew || [], w) && othersHere(crew || [], pc, w).length === 0;
  const turn = combat ? currentTurn(combat) : null;
  const mine = !!(turn && turn.side === "pc" && turn.id === pc.id);
  const actor = combat && combat.actors ? combat.actors[pc.id] : null;

  const t = tempoOf(w);
  const holder = sceneHolder(t);
  const scenePos = scenePosition(t, pc.id);
  const sceneMine = holder === pc.id;

  /* The strip's colour is now the loudest true thing about you, and
     duress outranks turn order: being held by something matters more
     than whose go it is, and a player who has not noticed they are
     being eaten is a worse failure than one who has not noticed it is
     their turn. */
  let state = "calm";
  if (duress && duress.level >= DURESS.CRITICAL) state = "critical";
  else if (duress && duress.level >= DURESS.PRESSED) state = "pressed";
  else if (mine || sceneMine) state = "mine";
  else if (combat) state = "combat";
  else if (t.held || t.breather) state = "held";
  else if (waitingOn) state = "held";

  const nameOf = (id) => {
    const c = (crew || []).find((x) => x.id === id);
    return (c && c.name) || "…";
  };

  let headline;
  if (t.breather) headline = WAIT_TEXT.breather;
  else if (t.held) headline = t.heldWhy || WAIT_TEXT.held;
  else if (combat) {
    headline = mine
      ? `Your turn · ${actor ? actor.actions : 0} action${actor && actor.actions === 1 ? "" : "s"}`
      : `Round ${combat.round} · ${turn ? turn.name || "…" : "…"}`;
  } else if (holder) {
    headline = sceneMine
      ? "The room is yours"
      : scenePos === 1 ? `You're next · ${nameOf(holder)} has it`
        : scenePos > 1 ? `${scenePos} ahead of you`
          : `${nameOf(holder)} has the room`;
  } else if (waitingOn) headline = `Waiting on ${waitingOn}`;
  else if (alone) headline = `${room} · alone`;
  else headline = room;

  /* Whatever is actually wrong takes the line, because it is more
     urgent than the room's name and there is only one line. */
  if (duress && duress.level >= DURESS.PRESSED && duress.headline && !mine) {
    headline = duress.headline;
  }

  return (
    <header className="pstatus" data-state={state} data-duress={duress ? duress.level : 0}>
      <div className="pstatus-who">
        <strong>{pc.name}</strong>
        <span>{(pc.cls || "").toUpperCase()}</span>
      </div>

      <div className="pstatus-turn" aria-live="polite">{headline}</div>

      {/* What your go has cost the fiction so far. The round is
          charged at max() when it wraps — see engine/tempo.js — so
          this is a player's only view of the number that will
          actually be spent on their behalf. */}
      {t.scene && sceneSpent(t, pc.id) > 0 && (
        <div className="pstatus-cost" aria-label={`${sceneSpent(t, pc.id)} minutes this round`}>
          {sceneSpent(t, pc.id)}m
        </div>
      )}

      <div className="pstatus-meters">
        <Pips label="HP" value={pc.health} max={pc.maxHealth} warn={pc.health <= pc.maxHealth / 3} />
        <Pips label="ST" value={pc.stress} max={20} warn={pc.stress >= 8} invert />
      </div>
    </header>
  );
}
