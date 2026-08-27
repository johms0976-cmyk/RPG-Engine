/* ============================================================
   TABLE VIEW — the shared screen. What everyone can look at.

   THE RULE, STATED ONCE AND ENFORCED BELOW:

     THE TABLE SCREEN SHOWS WHAT THE ROOM CAN HEAR.
     THE PHONES HOLD WHAT INDIVIDUALS KNOW.

   This file used to open by *claiming* it held no secrets — "no
   threat positions, no hidden search results, no unspent clocks"
   — and then rendered three things straight off the host's
   unredacted state. The map was fine, because `markersFor` gates
   threat markers on `wardenView` and this screen never passes it.
   The other two were not:

     · `liveEnemies(combat)` with real names and a hit tally.
       Ypsilon 14's threat is `unseen: true`, named IT, carrying
       `combatLabel: "SOMETHING YOU CANNOT SEE"` written for
       exactly this case. On the shared screen it announced
       itself. And the tally is the worse half — redactCombat
       says why: knowing it is on two of three hits is knowing
       there is a three, which is knowing what it is.

     · the whole feed, including lines carrying `to` — which is
       how a split party gets private room descriptions — and
       lines carrying `secretText`.

   Neither needed new machinery. `secrets.js` already exported
   `redactCombat` and `visibleFeed` and this file simply never
   called them. Note the viewer id passed to `visibleFeed` is
   `null`, and that is the whole trick: `addressedTo` returns
   false for every line that names anybody, so what survives is
   exactly the set of public lines. Not "one player's view" —
   the room's.

   It costs nothing while the party is together, because an
   unsplit party has `audienceFor` returning null and every line
   is already public. It only starts subtracting once people
   walk off in different directions, which is precisely when it
   should.

   WHAT IS DELIBERATELY NOT REDACTED: the crew panel. Health and
   Stress bars for everyone stay public, as they always have
   been. At a real table you can see that somebody is bleeding
   and you can hear them coming apart, and Stress in particular
   is a number the rest of the crew is *supposed* to be watching
   climb.
   ============================================================ */
import React, { useEffect, useMemo, useState } from "react";
import { Panel, Bar } from "../ui/kit.jsx";
import { MapV2 } from "../ui/Map2.jsx";
import { fmtClock } from "../engine/rules.js";
import { currentTurn, liveEnemies } from "../engine/combat.js";
import { redactCombat, visibleFeed, VIEW } from "../engine/secrets.js";
import { isSplit, partySummary } from "../engine/party.js";
import { Artefact } from "../ui/Artefact.jsx";
import FeedLog from "../ui/FeedLog.jsx";
import RecapCard from "../ui/RecapCard.jsx";
import TableMoment, { momentFrom } from "../ui/TableMoment.jsx";
import { tempoOf, sceneHolder } from "../engine/tempo.js";
import TableFar from "./TableFar.jsx";
import "../ui/tempo.css";

/** How long the table screen sits untouched before it stops being a
    dashboard and becomes set dressing. Long enough that it never
    happens mid-scene; short enough that it happens during the pauses
    the game is full of. */
const IDLE_MS = 45000;

export default function TableView({ g, peers, spotlight, safetyCall, vote, distance = "desk" }) {
  const { mod, w, crew, feed, combat } = g;
  const room = mod.rooms[w.room];
  const t = tempoOf(w);

  /* ---- the two redactions (see the header) ---- */
  const shown = useMemo(
    () => (combat ? redactCombat(combat, mod, crew) : null),
    [combat, mod, crew],
  );
  const publicFeed = useMemo(() => visibleFeed(feed, VIEW.PLAYER, null), [feed]);

  const turn = shown ? currentTurn(shown) : null;
  const enemies = shown ? liveEnemies(shown) : [];
  const claimed = Object.fromEntries((peers || []).filter((p) => p.pcId).map((p) => [p.pcId, p.name]));
  const sceneOwner = sceneHolder(t);

  /* ---- where everybody is ----
     `w.room` is the MAJORITY room and always has been — party.js
     derives it that way on purpose so a module's simulation has a
     single answer to "where is the crew". That is the right answer
     for sim.js and the wrong one for a shared screen: two people in
     the washroom simply vanished from it, while the director was
     rotating its attention to them via `focusRoom`.

     Note what this does NOT do. An earlier draft highlighted
     whichever group the empty chair had last spoken to, derived
     from the `to` on the most recent narration line. That is a
     leak: the whole reason those two people are getting a private
     line is that the rest of the table cannot hear it, and putting
     ATTENTION: WASHROOM on the wall tells the room something
     happened there. Where people are standing is public — everyone
     watched them walk out. What they are being told is not. */
  const split = isSplit(crew, w);
  const groups = useMemo(
    () => (split ? partySummary(crew, w, mod) : []),
    [split, crew, w, mod],
  );

  /* ---- Panic and Death, at size ----
     Scanned off the *unredacted* feed. Both events are public in
     the fiction — everyone at a real table watches you panic, and
     watching it is itself a Panic trigger for them — and neither
     stamp carries anything private. What stays on the handset is
     the arithmetic; see ui/TableMoment.jsx. */
  const [moment, setMoment] = useState(null);
  /* PRIMED AT MOUNT, not zeroed. A table screen that reloads — or a
     Warden flipping to the table tab an hour in — must not replay
     somebody's death from forty minutes ago. Everything already in
     the feed when this mounts is history. */
  const seenMomentId = React.useRef(feed.length ? feed[feed.length - 1].id : 0);
  useEffect(() => {
    const next = momentFrom(feed, seenMomentId.current);
    if (!next) return;
    seenMomentId.current = next.id;
    setMoment(next);
  }, [feed]);

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

  /* `publicFeed` has already dropped wardenOnly and every addressed
     line, so the lower third can no longer quote a description that
     was meant for two people in another compartment. */
  const lastSaid = [...publicFeed].reverse().find((l) => ["room", "npc", "interject", "say", "share"].includes(l.kind));

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
        {/* A death arriving on a dozing screen also wakes it — the
            idle timer resets on any new line — but a breather does
            not clear itself, so the overlay has to exist on this
            branch as well or a moment during a declared pause would
            be swallowed. */}
        <TableMoment moment={moment} onDone={() => setMoment(null)} />
      </div>
    );
  }

  /* THE FAR LAYOUT.
     Below the cinema branch on purpose: a screen that has gone
     quiet is already the right size for a sofa and always was, so
     both distances share it and only the ACTIVE state forks. */
  if (distance === "couch") {
    return (
      <TableFar
        g={g} peers={peers} spotlight={spotlight}
        safetyCall={safetyCall} vote={vote}
        reactions={g.reactions || []} assistOffers={g.assistOffers || []}
      />
    );
  }

  return (
    <div className="table-view">
      <header className="table-head">
        <h1>{mod.title}</h1>
        <div className="table-clock">
          {/* With the party apart, one room name in the corner is a
              lie of omission, so the strip below carries it instead
              and this drops to a count. */}
          <span>{split ? `${groups.length} GROUPS` : (room ? room.name : "—")}</span>
          <span>{fmtClock(w.clock)}</span>
        </div>
      </header>

      {split && (
        <div className="table-groups" aria-label="Where the crew is">
          {groups.map((grp) => (
            <div key={grp.room} className={`table-group${grp.who.length === 1 ? " is-alone" : ""}`}>
              <span className="table-group-room">{grp.name}</span>
              <span className="table-group-who">
                {grp.who.map((p) => p.name).join(", ")}
                {grp.who.length === 1 ? " — alone" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

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
                  {/* A redacted enemy carries maxHits 0 and is not
                      counting. Printing "0/0 wounds" beside
                      SOMETHING YOU CANNOT SEE would hand back the
                      tally redactCombat just took away. */}
                  <span>{e.hidden ? "—" : `${e.wounds}/${e.maxWounds} wounds`}</span>
                </li>
              ))}
              {/* `order` entries are {side, id} and carry no name, so
                  the old `turn.name || turn.id` printed a raw uid —
                  "unseen#0", which names the threat this screen has
                  just gone to some trouble not to name. Resolved
                  against the redacted list instead. */}
              {turn && <li className="table-turn">Acting: {turnLabel(turn, crew, enemies)}</li>}
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
        <FeedLog feed={publicFeed} crew={crew} showStamps={false} />
      </Panel>

      {/* The recap, held up. Same card the phones get. */}
      {w.recap && <RecapCard recap={w.recap} />}

      <TableMoment moment={moment} onDone={() => setMoment(null)} />
    </div>
  );
}

/** Whose go it is, in words the room is allowed to have.
    Enemies resolve against the REDACTED list, so an unseen threat
    reports the label its module wrote for it. */
function turnLabel(turn, crew, enemies) {
  if (!turn) return "";
  if (turn.side === "pc") {
    const pc = (crew || []).find((c) => c.id === turn.id);
    return pc ? pc.name : "—";
  }
  const e = (enemies || []).find((x) => x.uid === turn.id);
  return e ? e.name : "—";
}
