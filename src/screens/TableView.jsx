/* ============================================================
   TABLE VIEW — the shared screen. What everyone can look at.

   Deliberately holds no secrets: no threat positions, no hidden
   search results, no unspent clocks. The Warden view has those.
   ============================================================ */
import React from "react";
import { Panel, Feed, Bar } from "../ui/kit.jsx";
import { MapV2 } from "../ui/Map2.jsx";
import { fmtClock } from "../engine/rules.js";
import { currentTurn, liveEnemies } from "../engine/combat.js";

export default function TableView({ g, peers }) {
  const { mod, w, crew, feed, combat } = g;
  const room = mod.rooms[w.room];
  const turn = combat ? currentTurn(combat) : null;
  const enemies = combat ? liveEnemies(combat) : [];
  const claimed = Object.fromEntries((peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]));

  return (
    <div className="table-view">
      <header className="table-head">
        <h1>{mod.title}</h1>
        <div className="table-clock">
          <span>{room ? room.name : "—"}</span>
          <span>{fmtClock(w.clock)}</span>
        </div>
      </header>

      <div className="table-grid">
        <Panel title="The crew" bodyClass="table-crew">
          {crew.map((c) => {
            const out = c.alive === false;
            const acting = turn && turn.side === "pc" && turn.id === c.id;
            return (
              <div key={c.id} className={`table-pc${out ? " is-out" : ""}${acting ? " is-acting" : ""}`}>
                <div className="table-pc-name">
                  <strong>{c.name}</strong>
                  <span>{claimed[c.id] || "unclaimed"}</span>
                </div>
                {out ? (
                  <div className="table-pc-dead">deceased</div>
                ) : (
                  <>
                    <Bar label="Health" value={c.health} max={c.maxHealth} />
                    <Bar label="Stress" value={c.stress} max={20} warn />
                  </>
                )}
              </div>
            );
          })}
        </Panel>

        <Panel title={combat ? `Combat — round ${combat.round}` : "The ship"} bodyClass="table-map">
          {combat ? (
            <ul className="table-enemies">
              {enemies.map((e) => (
                <li key={e.uid}>
                  <span>{e.name}</span>
                  <span>{e.wounds}/{e.maxWounds} wounds</span>
                </li>
              ))}
              {turn && <li className="table-turn">Acting: {turn.name || turn.id}</li>}
            </ul>
          ) : (
            <MapV2 mod={mod} w={w} crew={crew} />
          )}
        </Panel>
      </div>

      <Panel title="What happened" bodyClass="table-feed">
        <Feed feed={feed} />
      </Panel>
    </div>
  );
}
