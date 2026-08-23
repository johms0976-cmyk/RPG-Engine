/* ============================================================
   TABLE FAR — the shared screen, read from a sofa.

   Same contract as TableView and it matters more here: this
   screen HOLDS NO SECRETS. No threat positions, no unsearched
   descriptions, no unspent clocks. Everything below is derived
   from the same places TableView derives from, and nothing new
   is read.

   ------------------------------------------------------------
   WHY THIS IS A SECOND FILE AND NOT A SCALE FACTOR

   Because scaling the dashboard produces a dashboard that does
   not fit. The desk layout is two panels, a forty-line log, a
   map, a handout slot and six crew cards — at couch sizes that is
   roughly four screens of content, and the honest result of
   `zoom: 1.8` is a shared screen that shows a third of itself.

   So the far layout carries only what everybody needs at the same
   moment, and it is a short list:

     1. whose go it is        (the biggest thing after the room)
     2. the room and the clock
     3. the pinned situation
     4. the crew, as one strip of shapes
     5. the last three lines

   Everything else — combat, a handout held up, the safety card,
   an open vote, the recap — is a TAKEOVER. It owns the screen
   while it matters and it leaves when it stops mattering, rather
   than competing forever for space the sofa cannot spare.

   The idle/cinema treatment lives in TableView and is reached
   from there, because a screen that has gone quiet is already the
   right size for a sofa and always was.
   ============================================================ */
import React from "react";
import { fmtClock } from "../engine/rules.js";
import { currentTurn, liveEnemies } from "../engine/combat.js";
import { tempoOf, sceneHolder } from "../engine/tempo.js";
import { liveReactions } from "../engine/reactions.js";
import { Artefact } from "../ui/Artefact.jsx";
import "../ui/react.css";
import "../ui/tv.css";

/** Kinds a person at the table would call "something that was said
    or happened". Deliberately the same set TableView uses for its
    lower third, plus the narration kinds — a sofa reading three
    lines needs the room's own voice in them, not only speech. */
const SPOKEN = ["room", "npc", "interject", "say", "share", "note", "warden"];

function Bar({ value, max, stress = false }) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / (max || 1)) * 100));
  return (
    <div className={`tv-bar${stress ? " is-stress" : ""}`} aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One card, centred, owning the screen. */
function Takeover({ label, title, alarm = false, children }) {
  return (
    <div className={`tv-takeover${alarm ? " is-alarm" : ""}`} role={alarm ? "alert" : "status"}>
      {label && <div className="tv-takeover-label">{label}</div>}
      {title && <h2 className="tv-takeover-title">{title}</h2>}
      {children}
    </div>
  );
}

export default function TableFar({ g, peers, spotlight, safetyCall, vote, reactions = [], assistOffers = [] }) {
  const { mod, w, crew, feed, combat } = g;
  const room = mod.rooms[w.room];
  const t = tempoOf(w);
  const turn = combat ? currentTurn(combat) : null;
  const enemies = combat ? liveEnemies(combat) : [];
  const claimed = Object.fromEntries(
    (peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]),
  );
  const sceneOwner = sceneHolder(t);
  const nameOf = (id) => (crew.find((c) => c.id === id) || {}).name || "";

  /* WHOSE GO IT IS, in the order a person would answer the question.
     A brake beats a turn: if the table is held, the true answer to
     "whose go is it" is nobody's, and a screen that names a player
     anyway has sent somebody to act into a pause. */
  let turnLabel = "ROUND THE ROOM";
  let turnWho = "";
  let turnHeld = false;
  if (t.held) {
    turnLabel = "HOLD";
    turnWho = t.heldWhy || "WAIT";
    turnHeld = true;
  } else if (combat && turn) {
    turnLabel = `ROUND ${combat.round}`;
    turnWho = turn.side === "pc" ? (nameOf(turn.id) || turn.name || turn.id) : (turn.name || turn.id);
    turnHeld = turn.side !== "pc";
  } else if (sceneOwner) {
    turnWho = nameOf(sceneOwner);
  } else if (spotlight && spotlight.pcId) {
    turnLabel = "OVER TO";
    turnWho = nameOf(spotlight.pcId);
  } else {
    turnLabel = "THE TABLE";
    turnWho = "ANYONE";
  }

  /* Recomputed every render rather than filtered on a timer. The
     shared screen re-renders on every snapshot anyway, and a
     setInterval here would be a second clock to keep in step with
     the one in reactions.js. */
  const live = liveReactions(reactions);

  const lines = [...feed]
    .filter((l) => !l.wardenOnly && SPOKEN.includes(l.kind))
    .slice(-3);

  /* ---- the takeovers, in priority order ----
     Safety first and unconditionally: it is the only card on this
     screen that is about the people rather than the characters.
     It carries no clear button, for the reason TableView gives —
     clearing lives on the phones, where reaching for it identifies
     nobody. */
  let takeover = null;
  if (safetyCall) {
    takeover = (
      <Takeover label="Out of the game" title="THE TABLE IS PAUSED" alarm>
        <div className="tv-takeover-body">
          {safetyCall.level === "stop"
            ? "Someone played the stop card."
            : safetyCall.level === "veil"
              ? "Someone asked to veil this. It happens off-screen."
              : "Someone asked to check in."}
        </div>
        <div className="tv-takeover-label">Clear it from any phone</div>
      </Takeover>
    );
  } else if (vote && !vote.result) {
    takeover = (
      <Takeover label="The table decides" title={vote.label}>
        <div className="tv-takeover-body">
          {Object.keys(vote.cast || {}).length} of {vote.of.length} have answered.
        </div>
        <div className="tv-takeover-label">Check your phone</div>
      </Takeover>
    );
  } else if (w.tableHandout && mod.handouts[w.tableHandout]) {
    takeover = (
      <Takeover label="On the table">
        <Artefact id={w.tableHandout} handout={mod.handouts[w.tableHandout]} flat />
      </Takeover>
    );
  } else if (combat && enemies.length) {
    takeover = (
      <Takeover label={`Combat · round ${combat.round}`} title={turnWho}>
        <ul className="tv-enemies">
          {enemies.map((e) => (
            <li key={e.uid}>
              <span>{e.name}</span>
              <span className="tv-wounds">{e.wounds}/{e.maxWounds}</span>
            </li>
          ))}
        </ul>
      </Takeover>
    );
  }

  return (
    <div className="tv">
      <header className="tv-head">
        <span className="tv-room">{room ? room.name : mod.title}</span>
        <span>{fmtClock(w.clock)}</span>
      </header>

      <div className={`tv-turn${turnHeld ? " is-held" : ""}`}>
        <span className="tv-turn-label">{turnLabel}</span>
        <span className="tv-turn-who">{turnWho}</span>
      </div>

      {t.situation && <div className="tv-situation">{t.situation}</div>}

      <div className="tv-crew">
        {crew.map((c) => {
          const out = c.alive === false;
          const lit = !!(spotlight && spotlight.pcId === c.id)
            || sceneOwner === c.id
            || !!(turn && turn.side === "pc" && turn.id === c.id);
          return (
            <div key={c.id} className={`tv-pc${out ? " is-out" : ""}${lit ? " is-lit" : ""}`}>
              <div className="tv-pc-name">{c.name}</div>
              <div className="tv-pc-who">{claimed[c.id] || "unclaimed"}</div>
              {!out && (
                <>
                  <Bar value={c.health} max={c.maxHealth} />
                  <Bar value={c.stress} max={20} stress />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="tv-feed" aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className="tv-line">
            {l.who && <span className="tv-line-who">{l.who}</span>}
            {l.text}
          </div>
        ))}
      </div>

      {/* B.4 — the offer, ON THE SHARED SCREEN, BEFORE THE ROLL.
          That placement is the whole feature. An assist selected
          from a menu by the person rolling is a modifier; an offer
          the room can see is two people in a scene together, and
          the mechanics underneath are identical. */}
      {assistOffers.length > 0 && (
        <div className="tv-offers">
          {assistOffers.map((o) => (
            <div key={o.by}>{o.byName} is helping {o.toName}</div>
          ))}
        </div>
      )}

      {/* B.3 — surfaced, seen, gone. Never in the log: a reaction
          is the shape of a room at a moment, and a room at a moment
          is not a record. */}
      {live.length > 0 && (
        <div className="tv-reactions">
          {live.map((r) => (
            <span key={r.id}>
              <span className="tv-react-who">{r.byName}</span>{r.says}
            </span>
          ))}
        </div>
      )}

      {takeover}
    </div>
  );
}
