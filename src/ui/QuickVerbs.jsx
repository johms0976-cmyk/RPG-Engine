/* ============================================================
   VERBS FIRST — B.2

   What a phone showed a player who had never read the book: a
   scrolling log, and a text box whose placeholder was

     look · search the crates · go to the workspace · ask sonya
     about mike · help

   which is a syntax lesson delivered at the exact moment somebody
   is trying to be a person in a room. Six people on a sofa, half of
   them there because somebody else organised it, and the interface
   asks them to guess a grammar.

   The verbs did exist — in `TurnActions`, in a drawer, behind a
   tab. So the failure was never "there is nothing to do", it was
   "the thing to do is one navigation away and the thing in front of
   you is a parser". A first-time player does not open the drawer.
   They put the phone down.

   ------------------------------------------------------------
   WHAT THIS IS AND IS NOT

   It is not a replacement for the command bar. Typing is faster
   once you know the grammar and the people who know it should keep
   it — this sits directly above it, and both go through
   `doFreeAction`, so there is exactly one code path and the verbs
   can never drift out of step with what the parser accepts.

   It is not the full action list either. Five is the ceiling: the
   point is to answer "what can I even do here" in one glance, and
   a grid of fifteen re-creates the problem it was written for at a
   different size.

   ------------------------------------------------------------
   HOW THE FIVE ARE CHOSEN

   From what is actually in the room, most specific first. A verb
   that names a thing you can see ("Search the crates") teaches the
   grammar by example in a way "Search" never does — after two
   scenes the player types it themselves, which is the outcome
   worth wanting.
   ============================================================ */
import React from "react";
import "./verbs.css";

const CAP = 5;

/**
 * The verbs worth offering in this room, right now.
 *
 * Pure and exported separately from the component so the choosing
 * can be tested without rendering anything.
 *
 * @returns {Array<{id: string, label: string, cmd: string}>}
 */
export function verbsFor({ room, exits = [], npcs = [], combat = null, myTurn = false }) {
  const out = [];

  /* IN A FIGHT, ONLY THE FIGHT.

     Offering "search the crates" while something is eating the
     crew is worse than offering nothing: it reads as the game not
     knowing what is happening. `TurnActions` already owns combat
     properly, so this steps back rather than competing with it. */
  if (combat) {
    if (myTurn) out.push({ id: "attack", label: "Attack", cmd: "attack" });
    return out;
  }

  /* Always first, always free, and the one verb that is never
     wrong. A player who taps nothing else will tap this. */
  out.push({ id: "look", label: "Look around", cmd: "look" });

  /* Named features beat a bare "search": "Search the crates" is a
     sentence somebody can copy. */
  const features = Object.keys((room && room.features) || {});
  for (const f of features) {
    if (out.length >= CAP) break;
    out.push({ id: `search:${f}`, label: `Search the ${f}`, cmd: `search ${f}` });
  }

  /* Someone to talk to is almost always more interesting than
     another door, so people come before exits. */
  for (const n of npcs) {
    if (out.length >= CAP) break;
    const name = (n && (n.name || n.id)) || "";
    if (!name) continue;
    out.push({ id: `talk:${name}`, label: `Talk to ${name}`, cmd: `talk to ${name}` });
  }

  for (const e of exits) {
    if (out.length >= CAP) break;
    const to = (e && (e.label || e.name || e.to)) || "";
    if (!to) continue;
    out.push({ id: `go:${to}`, label: `Go to the ${to}`, cmd: `go to ${to}` });
  }

  return out.slice(0, CAP);
}

export default function QuickVerbs({ room, exits, npcs, combat, myTurn, onVerb, disabled = false }) {
  const verbs = verbsFor({ room, exits, npcs, combat, myTurn });
  if (!verbs.length) return null;

  return (
    <div className="verbs" role="group" aria-label="Things you can do">
      {verbs.map((v) => (
        <button
          key={v.id}
          type="button"
          className="verb"
          disabled={disabled}
          /* The same string the parser would get from the text box,
             through the same function. A verb that produced a
             different result from typing it would be two games. */
          onClick={() => onVerb(v.cmd)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
