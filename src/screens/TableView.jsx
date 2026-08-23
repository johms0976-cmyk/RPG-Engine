/* ============================================================
   TABLE VIEW — the shared screen. What everyone can look at.

   Deliberately holds no secrets: no threat positions, no hidden
   search results, no unspent clocks. The Warden view has those.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { Panel, Bar } from "../ui/kit.jsx";
import { MapV2 } from "../ui/Map2.jsx";
import { fmtClock } from "../engine/rules.js";
import { currentTurn, liveEnemies } from "../engine/combat.js";
import { Artefact } from "../ui/Artefact.jsx";
import FeedLog from "../ui/FeedLog.jsx";
import RecapCard from "../ui/RecapCard.jsx";
import { tempoOf, sceneHolder } from "../engine/tempo.js";
import "../ui/tempo.css";

/** How long the table screen sits untouched before it stops being a
    dashboard and becomes set dressing. Long enough that it never
    happens mid-scene; short enough that it happens during the pauses
    the game is full of. */
const IDLE_MS = 45000;

export default function TableView({ g, peers, spotlight, safetyCall, vote }) {
  const { mod, w, crew, feed, combat } = g;
  const room = mod.rooms[w.room];
  const t = tempoOf(w);
  const turn = combat ? currentTurn(combat) : null;
  const enemies = combat ? liveEnemies(combat) : [];
  const claimed = Object.fromEntries((peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]));
  const sceneOwner = sceneHolder(t);

  /* ---- the idle state ----
     A shared screen that is a dashboard for four hours is furniture.
     When nothing has happened for a while it becomes the room instead:
     the name at size, the pinned situation under it, and the last line
     of narration as a lower third. It comes back the instant anything
     moves, so it can never be in the way. */
  const [idle, setIdle] = useState(false);
  const lastId = feed.length ? feed[feed.length - 1].id : 0;
  useEffect(() => {
    setIdle(false);
    const timer = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(timer);
  }, [lastId, w.room, combat, spotlight, t.situation, t.held, t.breather]);

  const lastSaid = [...feed].reverse().find((l) => !l.wardenOnly && ["room", "npc", "interject", "say", "share"].includes(l.kind));

  /* A break is not idleness, it is a declared state, and the screen
     should say so from across the room. */
  if (t.breather || (idle && !combat)) {
    return (
      <div className="table-view is-cinema">
        <div className="cinema">
          <div>
            <div className="cinema-room">{t.breather ? mod.title : (room ? room.name : mod.title)}</div>
            <div className="cinema-sub">
              {t.breather ? "TAKING FIVE" : `${fmtClock(w.clock)} · ${crew.filter((c) => c.alive !== false).length} ABOARD`}
            </div>
            {t.situation && !t.breather && <div className="cinema-situation">{t.situation}</div>}
            {t.breather && <div className="cinema-break">CLOCKS STOPPED</div>}
          </div>
          {!t.breather && lastSaid && (
            <div className="cinema-lower">{lastSaid.text}</div>
          )}
        </div>
        {w.recap && <RecapCard recap={w.recap} flat={false} />}
      </div>
    );
  }

  return (
    <div className="table-view">
      <header className="table-head">
        <h1>{mod.title}</h1>
        <div className="table-clock">
          <span>{room ? room.name : "—"}</span>
          <span>{fmtClock(w.clock)}</span>
        </div>
      </header>

      {/* The pinned line, where everyone can see it without a phone. */}
      {t.situation && (
        <div className="situation" style={{ fontSize: "clamp(14px, 1.6vw, 20px)" }}>
          <span className="situation-mark" aria-hidden="true" />
          <span className="situation-text">{t.situation}</span>
        </div>
      )}
      {(t.held || sceneOwner) && (
        <div className={`held-strip${t.held ? "" : " is-breather"}`}>
          {t.held
            ? (t.heldWhy || "THE WARDEN IS SPEAKING")
            : `ROUND THE ROOM · ${(crew.find((c) => c.id === sceneOwner) || {}).name || ""}`}
        </div>
      )}

      {/* THE CARD, IN THE MIDDLE OF THE TABLE.

          Here as well as on every phone, because a wardenless table's
          shared screen is the only thing everybody is already looking
          at — and because a pause that is only visible if you check
          your handset is a pause half the table will miss.

          It says nothing about who, for the same reason it never has.
          There is no clear button here: taking it down belongs on the
          phones, where reaching for it identifies nobody. */}
      {safetyCall && (
        <div className="table-safety" role="alert">
          <strong>The table is paused.</strong>
          <span>
            {safetyCall.level === "stop"
              ? "Someone played the stop card. This is out of the game."
              : safetyCall.level === "veil"
                ? "Someone asked to veil this. It happens off-screen."
                : "Someone asked to check in."}
          </span>
          <span className="table-safety-foot">Clear it from any phone.</span>
        </div>
      )}

      {/* The table's open question, so the people who have not
          answered can see that they have not answered. */}
      {vote && !vote.result && (
        <div className="table-vote" role="status">
          <strong>{vote.label}</strong>
          <span>{Object.keys(vote.cast || {}).length} of {vote.of.length} have answered — check your phone.</span>
        </div>
      )}

      <div className="table-grid">
        <Panel title="The crew" bodyClass="table-crew">
          {crew.map((c) => {
            const out = c.alive === false;
            const acting = turn && turn.side === "pc" && turn.id === c.id;
            /* The desk-side half of the spotlight. The player's phone
               buzzed; this is so the rest of the table looks up at the
               same person the Warden just addressed. */
            const lit = !!(spotlight && spotlight.pcId === c.id);
            const holding = sceneOwner === c.id;
            return (
              <div key={c.id}
                className={`table-pc${out ? " is-out" : ""}${acting || holding ? " is-acting" : ""}${lit ? " is-lit" : ""}`}>
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

      {/* A prop the Warden is holding up. It takes the middle of the
          shared screen because that is what holding something up is. */}
      {w.tableHandout && mod.handouts[w.tableHandout] && (
        <Panel title="On the table" bodyClass="table-prop">
          <Artefact id={w.tableHandout} handout={mod.handouts[w.tableHandout]} flat />
        </Panel>
      )}

      <Panel title="What happened" bodyClass="table-feed">
        <FeedLog feed={feed} crew={crew} showStamps={false} />
      </Panel>

      {/* The recap, held up. Same card the phones get. */}
      {w.recap && <RecapCard recap={w.recap} />}
    </div>
  );
}
