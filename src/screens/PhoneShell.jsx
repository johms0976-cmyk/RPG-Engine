/* ============================================================
   PHONE SHELL — sheet first.

   The old layout put the character sheet behind a drawer, which
   is the right call when one screen serves the whole table and
   the world is the shared object. Once every player has their
   own screen it inverts: your sheet is what you stare at, and
   the world is what you swipe to. Turn state lives in a fixed
   strip so nobody has to ask whose go it is.
   ============================================================ */
import React, { useState } from "react";
import { Panel, Bar, StatBox, Btn } from "../ui/kit.jsx";
import Feed2 from "../ui/Feed2.jsx";
import ClueBoard from "../ui/ClueBoard.jsx";
import RollTheatre from "../ui/RollTheatre.jsx";
import { STAT_LABEL, STAT_KEYS, SAVE_KEYS } from "../engine/rules.js";
import { currentTurn } from "../engine/combat.js";

const TABS = [
  { id: "sheet", label: "Sheet" },
  { id: "world", label: "World" },
  { id: "board", label: "Board" },
  { id: "feed", label: "Log" },
];

/** Stress mapped onto the five dread steps. Deliberately not linear —
    the first few points of Stress should feel like nothing, because
    in play they are nothing. */
export function dreadLevel(stress = 0) {
  if (stress <= 2) return 0;
  if (stress <= 4) return 1;
  if (stress <= 7) return 2;
  if (stress <= 10) return 3;
  if (stress <= 14) return 4;
  return 5;
}

export default function PhoneShell({ g, children, onOpenLocker }) {
  const [tab, setTab] = useState("sheet");
  const [roll, setRoll] = useState(null);
  const { pc, crew, feed, combat, w } = g;

  React.useEffect(() => {
    if (g.lastRoll && g.lastRoll.who === (pc && pc.name)) setRoll(g.lastRoll);
  }, [g.lastRoll, pc && pc.name]);

  if (!pc) return null;
  const turn = combat ? currentTurn(combat) : null;
  const mine = turn && turn.side === "pc" && turn.id === pc.id;

  return (
    <div className="phone dread" data-stress={dreadLevel(pc.stress)}>
      <div className={`phone-turn ${combat ? (mine ? "is-mine" : "is-waiting") : "is-waiting"}`}>
        {combat
          ? mine ? "Your turn" : `Round ${combat.round} · ${turn ? turn.name || turn.id : "…"}`
          : `${(w.rooms && w.rooms[w.room]) || w.room}`}
      </div>

      <div className="phone-body dread-pulse">
        {roll && <RollTheatre roll={roll} onDone={() => setRoll(null)} />}

        {tab === "sheet" && (
          <div className="stack">
            <Panel title={pc.name}>
              <Bar label="Health" value={pc.health} max={pc.maxHealth} />
              <Bar label="Stress" value={pc.stress} max={20} warn />
              <div className="statgrid" style={{ marginTop: 10 }}>
                {STAT_KEYS.map((k) => <StatBox key={k} label={STAT_LABEL[k]} value={pc.stats[k]} />)}
              </div>
              <div className="statgrid" style={{ marginTop: 8 }}>
                {SAVE_KEYS.map((k) => <StatBox key={k} label={k} value={pc.saves[k]} />)}
              </div>
              {pc.conditions && pc.conditions.length > 0 && (
                <p className="clue-meta" style={{ marginTop: 8 }}>{pc.conditions.join(" · ")}</p>
              )}
            </Panel>

            <Panel title="Skills">
              <p style={{ margin: 0 }}>{(pc.skills || []).join(" · ") || "None."}</p>
            </Panel>

            <Panel title="Carrying">
              <p style={{ margin: 0 }}>
                {(pc.items || []).map((i) => (g.items[i] ? g.items[i].n : i)).join(" · ") || "Nothing."}
              </p>
              <p className="clue-meta" style={{ marginTop: 8 }}>{pc.credits}cr</p>
            </Panel>

            {onOpenLocker && (
              <Btn kind="ghost" onClick={onOpenLocker}>Keep a copy of this character</Btn>
            )}
          </div>
        )}

        {tab === "world" && children}

        {tab === "board" && (
          <ClueBoard
            clues={w.clues}
            onPin={(t, k) => g.pinClue && g.pinClue(t, k)}
            onResolve={(id, r) => g.setClueResolved && g.setClueResolved(id, r)}
          />
        )}

        {tab === "feed" && (
          <Panel title="Log"><Feed2 feed={feed} /></Panel>
        )}
      </div>

      <nav className="phone-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
