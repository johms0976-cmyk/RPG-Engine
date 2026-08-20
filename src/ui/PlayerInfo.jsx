/* ============================================================
   PLAYER INFO — four things the phone knew and never said.

   Each of these is built entirely from state that was already in
   every snapshot. Nothing here needed a protocol change, a host
   change, or a new trust boundary. They were all simply never
   rendered, which is the recurring shape of the gap between "the
   Warden's screen" and "the only screen a player has".
   ============================================================ */
import React, { useMemo } from "react";
import { Panel, Label } from "./kit.jsx";
import Hint, { Disclosure } from "./Hint.jsx";
import { explainCondition, orderConditions, isBoon } from "../engine/conditions.js";
import { currentTurn } from "../engine/combat.js";
import { roomOf } from "../engine/party.js";

/* ============================================================
   CONDITIONS — see engine/conditions.js.

   Rendered as disclosures rather than tags with tooltips, for the
   reason in ui/Hint.jsx: a tooltip on a phone is a deleted
   sentence. Closed, this occupies the same space the tags did.
   ============================================================ */
export function Conditions({ conditions, compact }) {
  const list = orderConditions(conditions);
  if (!list.length) return null;

  return (
    <div className="conds">
      {!compact && <Label>CONDITIONS</Label>}
      {list.map((c) => {
        const e = explainCondition(c);
        return (
          <Disclosure
            key={c}
            tone={isBoon(c) ? "good" : "bad"}
            summary={e ? e.name : c}
            meta={e && e.from === "panic" ? "panic effect" : e && e.from === "module" ? "situation" : undefined}
          >
            <p style={{ margin: 0 }}>{e ? e.text : "No rule text for this one."}</p>
            {e && e.detail && <p className="clue-meta" style={{ margin: "6px 0 0" }}>{e.detail}</p>}
          </Disclosure>
        );
      })}
    </div>
  );
}

/* ============================================================
   PARTY KIT — who has the one of the thing.

   Mothership parties do not have inventories. They have a
   flashlight, two stimpaks and one cutting torch, distributed
   across four people who cannot see each other's sheets.

   At a table this is solved by shouting. On phones it was solved
   by nothing: the Crew panel showed Health and Stress, `crew[].items`
   travelled in every snapshot and was read by nobody, and the
   question "does anyone have a pry bar" had no answer short of
   four people opening four inventories.

   Grouped by item rather than by person on purpose. The question
   is almost never "what is Riley carrying" — it is "who has the
   torch", and a list keyed by person makes you scan every entry
   to answer it.

   Nothing is hidden here that is not already hidden: redactPc
   ships other people's item lists as they are, because carried
   gear is visible in the fiction. If a module ever wants
   concealed items that is a redaction change, not a change here.
   ============================================================ */
export function PartyKit({ crew, items, pc, w, mod }) {
  const groups = useMemo(() => {
    const by = new Map();
    for (const c of crew || []) {
      if (c.alive === false) continue;
      for (const id of c.items || []) {
        const it = items[id];
        if (!it) continue;
        if (!by.has(id)) by.set(id, { it, holders: [] });
        by.get(id).holders.push(c);
      }
    }
    return [...by.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.it.n.localeCompare(b.it.n));
  }, [crew, items]);

  if (!groups.length) return null;

  /* Where somebody is standing matters once the party splits: a
     stimpak two decks away is not a stimpak you have. */
  const myRoom = pc && w ? roomOf(pc, w) : null;
  const roomName = (c) => {
    if (!w || !mod) return null;
    const r = roomOf(c, w);
    if (!r || r === myRoom) return null;
    return (mod.rooms[r] && mod.rooms[r].name) || r;
  };

  return (
    <Panel title="Between us" icons={`${groups.length} kinds`}>
      <div className="kit">
        {groups.map(({ id, it, holders }) => {
          const total = holders.length;
          const mine = pc && holders.some((h) => h.id === pc.id);
          return (
            <Disclosure
              key={id}
              tone={mine ? "good" : undefined}
              summary={it.n}
              meta={holders
                .map((h) => {
                  const away = roomName(h);
                  const who = h.id === (pc && pc.id) ? "you" : h.name;
                  return away ? `${who} (${away})` : who;
                })
                .join(", ")}
            >
              <p style={{ margin: 0 }}>{it.d || "No description."}</p>
              <p className="clue-meta" style={{ margin: "6px 0 0" }}>
                {total === 1 ? "There is one of these on the crew." : `${total} of these between you.`}
                {it.shots ? ` Holds ${it.shots}.` : ""}
                {it.uses ? ` ${it.uses} uses when full.` : ""}
              </p>
            </Disclosure>
          );
        })}
      </div>
    </Panel>
  );
}

/* ============================================================
   THE ORDER — who goes, and how long until you do.

   `combat.order` and `combat.turnIndex` are in every snapshot and
   the phone rendered one derived fact from them: the name of
   whoever is up. That answers "is it me" and nothing else.

   The question an experienced player is actually asking in a
   Mothership fight is "does the thing act before I do", because
   the answer decides whether you shoot or whether you run. In
   this system that is not a guess — initiative was rolled, the
   order is fixed for the round, and the information exists. It
   was simply never drawn.

   Unseen threats keep their redaction: secrets.js has already
   stripped the name and hit tally by the time this renders, so a
   thing nobody can see sits in the order as the thing nobody can
   see, which is exactly right — you know something is going to
   move, and not what.
   ============================================================ */
export function Initiative({ combat, crew, pcId }) {
  if (!combat || !combat.order || !combat.order.length) return null;
  const turn = currentTurn(combat);
  const idx = combat.turnIndex || 0;

  const nameFor = (slot) => {
    if (slot.side === "pc") {
      const c = (crew || []).find((x) => x.id === slot.id);
      return c ? c.name : "…";
    }
    const e = (combat.enemies || []).find((x) => x.uid === slot.id);
    return (e && e.name) || slot.name || "something";
  };

  const myIdx = combat.order.findIndex((s) => s.side === "pc" && s.id === pcId);
  const until = myIdx < 0 ? null : myIdx >= idx ? myIdx - idx : combat.order.length - idx + myIdx;

  return (
    <div className="initiative">
      <div className="initiative-head">
        <span>ROUND {combat.round}</span>
        {until === 0 ? (
          <strong>your go</strong>
        ) : until != null ? (
          <span>{until} before you</span>
        ) : (
          <span>you are out of this</span>
        )}
      </div>
      <ol className="initiative-list">
        {combat.order.map((slot, i) => {
          const me = slot.side === "pc" && slot.id === pcId;
          const now = turn && turn.side === slot.side && turn.id === slot.id;
          const done = i < idx;
          const actor = slot.side === "pc" ? (combat.actors || {})[slot.id] : null;
          const gone = actor && actor.fled;
          return (
            <li
              key={`${slot.side}:${slot.id}:${i}`}
              className={[
                "initiative-slot",
                slot.side === "enemy" ? "is-enemy" : "is-pc",
                me ? "is-me" : "",
                now ? "is-now" : "",
                done ? "is-done" : "",
                gone ? "is-gone" : "",
              ].filter(Boolean).join(" ")}
              aria-current={now ? "step" : undefined}
            >
              <span className="initiative-n">{i + 1}</span>
              <span className="initiative-who">{me ? "You" : nameFor(slot)}</span>
              {gone && <span className="initiative-tag">fled</span>}
            </li>
          );
        })}
      </ol>
      <p className="clue-meta" style={{ margin: "6px 0 0" }}>
        Fixed for the whole fight. Everyone who passed their Speed Check acts
        before the enemies; everyone who failed acts after.
      </p>
    </div>
  );
}

/* ============================================================
   YOUR ROLLS — the ten seconds after the dice land.

   `lastRoll` is a single slot on the host, so the phone's dice
   theatre shows whatever rolled most recently *anywhere at the
   table*. In practice a player finishes their own reveal, looks
   up to say something, looks back, and the panel is now showing
   somebody else's Body Save. Their own margin — which is the
   number the Warden is about to narrate from — is gone.

   The world does carry a `rollLog`, and secrets.js strips it from
   player snapshots, correctly: it contains every roll made at the
   table including ones no player is meant to see.

   So the history is kept locally instead. This phone watches its
   own character's rolls go past and remembers them. No protocol
   change, nothing new is sent, and by construction it can only
   ever contain rolls this phone was already shown.
   ============================================================ */
export function useRollHistory(lastRoll, pcName, limit = 12) {
  /* State, not a ref. A ref would be the obvious choice — nothing
     here needs to drive layout — but a ref that is mutated inside
     an effect does not schedule a render, so the panel would sit
     empty until some unrelated snapshot happened to repaint it.
     That is a subtle and thoroughly miserable bug: it works on the
     Warden's screen, where snapshots land constantly, and looks
     broken on a quiet phone. */
  const [rolls, setRolls] = React.useState([]);
  const seen = React.useRef(null);

  React.useEffect(() => {
    if (!lastRoll || !pcName) return;
    // `lastRoll` carries no id, so identity is the tuple. Two
    // identical rolls in a row are indistinguishable and that is
    // acceptable: the cost is one missed duplicate row.
    const key = `${lastRoll.who}:${lastRoll.label}:${lastRoll.value}:${lastRoll.target}`;
    if (key === seen.current) return;
    seen.current = key;
    if (lastRoll.who !== pcName) return;
    setRolls((prev) => [{ ...lastRoll, at: Date.now() }, ...prev].slice(0, limit));
  }, [lastRoll, pcName, limit]);

  return rolls;
}

export function RollHistory({ rolls }) {
  if (!rolls || !rolls.length) return null;
  return (
    <Panel title="Your rolls" icons={`last ${rolls.length}`}>
      <ul className="rollhist">
        {rolls.map((r, i) => (
          <li
            key={`${r.at}:${i}`}
            className={[
              "rollhist-row",
              r.critHit ? "is-crit" : r.critFail ? "is-critfail" : r.success ? "is-ok" : "is-no",
            ].join(" ")}
          >
            <span className="rollhist-v">{String(r.value).padStart(2, "0")}</span>
            <span className="rollhist-t">/ {r.target}</span>
            <span className="rollhist-l">{r.label}</span>
            <span className="rollhist-o">
              {r.critHit ? "CRIT" : r.critFail ? "CRIT FAIL" : r.success ? `by ${r.margin}` : `by ${-r.margin}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="clue-meta" style={{ margin: "6px 0 0" }}>
        Yours only, kept on this phone, cleared when you close the tab.
      </p>
    </Panel>
  );
}

/* ============================================================
   WHAT YOU CAN DO ABOUT STRESS.

   The Panic percentage on the status strip is the best thing on
   the phone and it created a problem it did not solve: a player
   watching a number climb with no idea what the moves against it
   are. There are exactly four, three of them are easy to forget,
   and one of them is the single most commonly missed rule in
   Mothership.
   ============================================================ */
export function StressRelief({ pc, crew }) {
  const talkers = (crew || []).filter(
    (c) => c.id !== pc.id && c.alive !== false && !c.unconscious
      && (c.skills || []).some((s) => s === "Psychology" || s === "Theology"),
  );
  return (
    <Panel title="Getting the number down">
      <div className="stack">
        <Disclosure summary="Hold a Panic Check" meta="free" defaultOpen>
          <p style={{ margin: 0 }}>
            Passing a Panic Check sheds 1 Stress. This is the only relief
            available mid-scene, it is the rule tables forget most often, and
            it means a Panic Check is not purely a thing to be dreaded.
          </p>
        </Disclosure>
        <Disclosure summary="Rest" meta="6+ hours">
          <p style={{ margin: 0 }}>
            A Fear Save. You shed 1 Stress for every 10 points you make it by,
            and a Critical Success doubles that. Once per day. It also costs
            six hours of a clock that is probably running.
          </p>
        </Disclosure>
        <Disclosure
          summary="Be talked down"
          meta={talkers.length ? talkers.map((c) => c.name).join(", ") : "nobody aboard"}
        >
          <p style={{ margin: 0 }}>
            {talkers.length
              ? "Psychology or Theology, during a rest, once per day each. It is worth asking for before you need it."
              : "Needs somebody with Psychology or Theology. Nobody on this crew has either, which is worth knowing now rather than at Stress 14."}
          </p>
        </Disclosure>
        <Disclosure summary="Resolve" meta={`${pc.resolve || 0} / 5`}>
          <p style={{ margin: 0 }}>
            Resolve does not reduce Stress. It comes straight off the Panic
            Effect total — every point is one row further up a table where up
            is survivable. It is the only defence against the roll that ends
            characters, and it caps at 5.
          </p>
        </Disclosure>
      </div>
    </Panel>
  );
}
