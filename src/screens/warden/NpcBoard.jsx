/* ============================================================
   THE NPC BOARD — running ten people instead of remembering them.

   Ypsilon 14 has ten miners and a cat. With six PCs that is
   seventeen actors, and `lore.js` carries public / private /
   secret / underPressure layers for every one of them — genuinely
   good content that was reachable only through a tab switch and a
   dropdown. A Warden asked "what does Rosa know about the drills?"
   had to leave the levers, find the dossier, choose a name, read,
   and come back, mid-sentence, while six people waited.

   This is the same data on the same screen as the controls. One
   row per NPC:

     name · room · state · nerve · bond · what they want · one line

   THE SORT IS THE FEATURE. Rows are ordered by proximity to the
   players — in the room, then next door, then everywhere else —
   because the NPC a Warden needs is almost always the one the
   crew can currently see. An alphabetical list is a lookup table;
   a proximity list is a cast list for the scene that is actually
   happening.

   Nothing here is generated. Every field is read off state the
   engine already owns, and the "if pressed" line comes from the
   module's own `underPressure` text. A board that invented
   dialogue would be a worse version of the Warden.
   ============================================================ */
import React, { useMemo } from "react";
import { Btn } from "../../ui/kit.jsx";

/** Nerve, as a word. The module tracks `crew_fear` globally and
    `mood` per person; a Warden needs the combination, not either. */
function nerveOf(state, fear) {
  const mood = (state && state.mood) || 0;
  const n = Math.max(mood, fear || 0);
  if (n >= 4) return { label: "BREAKING", level: 4 };
  if (n >= 3) return { label: "frightened", level: 3 };
  if (n >= 2) return { label: "uneasy", level: 2 };
  if (n >= 1) return { label: "wary", level: 1 };
  return { label: "steady", level: 0 };
}

/** In the room, next door, or elsewhere. */
function proximity(npcRoom, crewRooms, adjacency) {
  if (!npcRoom) return 3;
  if (crewRooms.includes(npcRoom)) return 0;
  for (const r of crewRooms) {
    if (((adjacency && adjacency[r]) || []).includes(npcRoom)) return 1;
  }
  return 2;
}

const PROX_LABEL = ["here", "next door", "elsewhere", "—"];

export default function NpcBoard({ g, onSpeak }) {
  const { mod, w, crew } = g;

  const crewRooms = useMemo(() => {
    const set = new Set();
    for (const c of crew || []) {
      if (c.alive === false) continue;
      set.add(c.room || w.room);
    }
    return [...set].filter(Boolean);
  }, [crew, w.room]);

  /* Adjacency is a module concern and most modules do not publish
     one, so "next door" degrades to "elsewhere" rather than
     throwing. The board is still useful without it. */
  const adjacency = mod.adjacency || (mod.sim && mod.sim.adjacency) || null;

  /* THE PRESSURE LINES LIVE IN THE DOSSIER, NOT ON THE NPC.

     `mod.npcs[id]` is what the *engine* needs to run somebody —
     post, haunt, bond, what they know. `mod.lore.cast[id]` is what
     the *Warden* needs to play them, and `underPressure` is the
     single most useful sentence in it: one line on what this
     person does when the situation stops being manageable. Being
     in a different file is exactly why it was never on screen at
     the moment it was needed. */
  const cast = (mod.lore && mod.lore.cast) || {};

  const rows = useMemo(() => {
    const out = [];
    for (const id of mod.npcOrder || Object.keys(mod.npcs || {})) {
      const def = mod.npcs[id];
      const st = (w.npcs && w.npcs[id]) || {};
      if (!def) continue;
      const prox = proximity(st.loc, crewRooms, adjacency);
      out.push({
        id,
        def,
        st,
        lore: cast[id] || {},
        prox,
        nerve: nerveOf(st, w.flags && w.flags.crew_fear),
        gone: st.alive === false || !!st.taken,
      });
    }
    /* Dead and taken sink to the bottom — they are still worth
       showing, because "Kantaro is gone" is a fact the Warden is
       asked about, but they are never the row you need first. */
    return out.sort((a, b) => (a.gone - b.gone) || (a.prox - b.prox) || a.def.name.localeCompare(b.def.name));
  }, [mod, w.npcs, w.flags, crewRooms, adjacency, cast]);

  if (!rows.length) return <p style={{ opacity: 0.6 }}>This module has no cast.</p>;

  return (
    <div className="npcboard">
      <div className="npcboard-head">
        <span>{rows.filter((r) => !r.gone).length} still on their feet</span>
        {w.flags && w.flags.crew_fear > 0 && (
          <span className="npcboard-fear">CREW FEAR · {w.flags.crew_fear}</span>
        )}
      </div>

      <table className="npcboard-table">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">Where</th>
            <th scope="col">Nerve</th>
            <th scope="col">Will admit</th>
            <th scope="col">If pressed</th>
            <th scope="col"><span className="sr-only">Speak as</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const room = r.st.loc ? ((mod.rooms[r.st.loc] && mod.rooms[r.st.loc].name) || r.st.loc) : "—";
                    const bond = r.def.bond && mod.npcs[r.def.bond] ? mod.npcs[r.def.bond].name : null;
            return (
              <tr key={r.id} className={r.gone ? "is-gone" : ""} data-prox={r.prox}>
                <th scope="row">
                  <span className="npcboard-name">{r.def.name}</span>
                  {bond && <span className="npcboard-bond" title={`Will go looking for ${bond}`}>♦ {bond}</span>}
                </th>
                <td>
                  {r.gone ? (r.st.taken ? "taken" : "dead") : room}
                  {!r.gone && <span className="npcboard-prox">{PROX_LABEL[r.prox]}</span>}
                </td>
                <td>
                  <span className={`npcboard-nerve n${r.nerve.level}`}>{r.gone ? "—" : r.nerve.label}</span>
                </td>
                {/* What they are doing about it, in the module's own
                    words where it has them, and their post otherwise. */}
                <td className="npcboard-intent">
                  {r.gone ? "" : (r.lore.willAdmit || r.def.brief || "")}
                </td>
                {/* The single most useful column, and the reason the
                    dossier had to come to the levers rather than the
                    other way round. */}
                <td className="npcboard-pressed">
                  {r.gone ? "" : (r.lore.underPressure || "")}
                </td>
                <td>
                  {!r.gone && onSpeak && (
                    <Btn kind="ghost" className="inline small" onClick={() => onSpeak(r.id)}>
                      Speak
                    </Btn>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
