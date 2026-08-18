/* ============================================================
   INITIATIVE — the order, edited.

   `combat.order` has always been a plain array of { side, id }
   and `turnIndex` a plain number. Everything a table does to an
   initiative order by hand was therefore already expressible;
   there was simply no UI, so the Warden's only options were the
   order the Speed Checks produced and ending the fight.

   Five things, all of which happen at every real table:

     move    somebody acts earlier or later than the dice said
     hold    they wait to see what happens — dropped to the end
             of the round with their turn intact, not spent
     skip    end whoever is acting, now
     drop    take somebody out of the ring entirely
     insert  the thing that comes through the door on round three

   The one invariant, enforced in engine/tempo.js rather than
   here: whoever is acting stays acting unless they were the one
   who moved.
   ============================================================ */
import React, { useState } from "react";
import { Btn, Label } from "../../ui/kit.jsx";

export default function InitiativeEditor({ g }) {
  const { combat, crew, mod, warden } = g;
  const [threatId, setThreatId] = useState(Object.keys(mod.threats)[0] || "");

  if (!combat) return null;

  const nameOf = (entry) => {
    if (entry.side === "pc") {
      const pc = crew.find((c) => c.id === entry.id);
      return pc ? pc.name : entry.id;
    }
    const e = (combat.enemies || []).find((x) => x.uid === entry.id);
    return e ? e.name : entry.id;
  };

  const deadEntry = (entry) => {
    if (entry.side === "pc") {
      const pc = crew.find((c) => c.id === entry.id);
      return !pc || pc.alive === false;
    }
    const e = (combat.enemies || []).find((x) => x.uid === entry.id);
    return !e || e.dead;
  };

  return (
    <div className="stack">
      <Label>THE ORDER — ROUND {combat.round}</Label>

      <ol className="initiative">
        {combat.order.map((entry, i) => {
          const acting = i === combat.turnIndex;
          return (
            <li key={`${entry.side}:${entry.id}:${i}`}
              className={`init-row${acting ? " is-acting" : ""}${entry.side === "enemy" ? " is-enemy" : ""}${deadEntry(entry) ? " is-dead" : ""}`}>
              <span className="init-n">{i + 1}</span>
              <span className="init-name">{nameOf(entry)}</span>

              <span className="init-tools">
                <Btn kind="ghost" className="inline small" title="Act one place earlier"
                  disabled={i === 0} onClick={() => warden.initiative("move", i, i - 1)}>↑</Btn>
                <Btn kind="ghost" className="inline small" title="Act one place later"
                  disabled={i === combat.order.length - 1}
                  onClick={() => warden.initiative("move", i, i + 1)}>↓</Btn>
                <Btn kind="ghost" className="inline small" title="Wait and see — end of the round, turn intact"
                  onClick={() => warden.initiative("hold", i)}>Hold</Btn>
                {acting && (
                  <Btn kind="accent" className="inline small" title="End this turn now"
                    onClick={() => warden.initiative("to", Math.min(i + 1, combat.order.length - 1))}>
                    Done
                  </Btn>
                )}
                <Btn kind="danger" className="inline small" title="Out of the fight"
                  onClick={() => warden.initiative("drop", i)}>×</Btn>
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <Label>SOMETHING ELSE ARRIVES</Label>
        <div className="btn-row">
          <select value={threatId} onChange={(e) => setThreatId(e.target.value)} aria-label="What joins">
            {Object.keys(mod.threats).map((id) => (
              <option key={id} value={id}>{mod.threats[id].name || id}</option>
            ))}
          </select>
          <Btn kind="danger" className="inline small" disabled={!threatId}
            onClick={() => warden.startCombat(threatId)}>
            It joins the fight
          </Btn>
        </div>
        <p className="clue-meta" style={{ margin: "6px 0 0" }}>
          Holding a turn is not spending it. They drop to the end of the round
          and still get their actions — which is what every table means by
          "I'll wait and see what he does."
        </p>
      </div>
    </div>
  );
}
