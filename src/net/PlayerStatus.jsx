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
import { panicChance, panicBand, pct, panicOddsSentence } from "../engine/odds.js";
import ClockStrip from "../ui/Clocks.jsx";
import Hint from "../ui/Hint.jsx";

/* ROOM CONDITIONS THE PLAYER IS STANDING IN.

   Both of these were simulation state with no route to a phone.
   Noise is how the creature sees, and until now a player could not
   tell whether the room they were in was advertising them; water
   is their single best defence against it, and it ran on a
   countdown nobody could read. Neither is a number — "loud" and
   "wet, 40m" is all the resolution the decision needs.

   Read straight off world flags rather than imported from the
   module, because this strip renders for every module and must not
   know that Ypsilon 14 exists. A module that sets no such flags
   shows nothing. */
function roomConditions(w, room) {
  if (!w || !room) return [];
  const out = [];
  const n = w.flags && w.flags[`noise:${room}`];
  if (n && n.level > 0) {
    out.push({
      k: "noise",
      label: n.level >= 8 ? "SCREAMING" : n.level >= 5 ? "LOUD" : "WORKING",
      hint: n.level >= 5
        ? "This room is loud. Anything that hunts by sound knows there is something here."
        : "Working noise — enough to cover a footstep, not enough to carry.",
    });
  }
  const wet = w.flags && w.flags[`wet:${room}`];
  if (w.flags && w.flags.showers && room === "wash") {
    out.push({ k: "wet", label: "WASH", hint: "The showers are running. It will not come in here willingly." });
  } else if (wet && wet > w.clock) {
    out.push({ k: "wet", label: `WET ${wet - w.clock}m`, hint: "Standing water, for now. It will not cross this willingly." });
  }
  return out;
}

/* THE CAT, PROMOTED OUT OF THE FEED.

   Prince is the module's best instrument — he will not enter a
   room the thing is in, and he stares at it — and every one of his
   tells was a line in a scrolling log on a phone, which is to say
   most of them were never read. Once he is following someone he
   becomes a persistent piece of state in the one strip players
   always look at, and reading him becomes a skill the table
   acquires rather than a coincidence. */
function princeState(w, room) {
  if (!w || !w.flags || !w.flags.prince_follows) return null;
  const p = w.npcs && w.npcs.prince;
  if (!p || !p.alive) return null;
  const it = w.threats && w.threats.it;
  if (p.loc !== room) return { label: "PRINCE", text: "elsewhere on the base" };
  if (it && !it.dead && it.loc === room) return { label: "PRINCE", text: "will not come in", alarm: true };
  if (it && !it.dead && p.state === "staring") return { label: "PRINCE", text: "staring at nothing", alarm: true };
  return { label: "PRINCE", text: "with you" };
}

/* ============================================================
   HOW CLOSE AM I TO A PANIC CHECK?

   Health and Stress were both on the strip and one of them was
   lying by omission. A pip bar answers "how much Stress" — but
   the question a player is actually asking is "what happens if
   the Warden calls for a check", and 2d10 is triangular, so the
   two are not the same shape at all. Stress 8 is a 28% chance of
   Panicking. Stress 12 is 64%. On a twenty-segment bar those are
   four pips and six, at arm's length, in a dark room.

   Nobody is doing that arithmetic at the table, so it goes here,
   in the smallest honest form: the rule, and the number. The
   colour band means the reader does not have to interpret the
   number at a glance, and the title carries the full sentence
   for anyone who wants to know which way is bad.

   Nothing is shown under Stress 2, where 2d10 cannot fail. An
   empty scary label is the fastest way to make a real one
   invisible. */
function PanicOdds({ stress }) {
  if (!stress || stress < 2) return null;
  const p = pct(panicChance(stress));
  /* The `title` here was doing the whole job of saying which way is
     bad — and on a phone a title attribute is a deleted sentence.
     The number without the rule is worse than useless to a new
     player, who has no way to know whether 28% is the good half or
     the bad one. See ui/Hint.jsx. */
  return (
    <div className={`pstatus-panic is-${panicBand(stress)}`}
      title={panicOddsSentence(stress)}
      aria-label={panicOddsSentence(stress)}>
      <span className="pstatus-panic-k">PANIC</span>
      <span className="pstatus-panic-v">{p}%</span>
      <span className="pstatus-panic-rule" aria-hidden="true">2d10 &gt; {stress}</span>
      <Hint text={panicOddsSentence(stress)} label="What the Panic figure means" />
    </div>
  );
}

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

/* The tag form. Conditions are stamped with their parameters —
   "Advantage (3d10 minutes)", "Rattled — Disadvantage" — and the
   parameter is the part that does not fit in 60px. The full text
   lives on the Sheet tab. */
function shortCond(c) {
  const s = String(c || "");
  if (s.startsWith("Advantage (")) return "ADRENALINE";
  return s.split(" — ")[0].split(" (")[0].toUpperCase();
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

  const conditions = roomConditions(w, myRoom);
  const prince = princeState(w, myRoom);

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
          actually be spent on their behalf.

          The title carries the rule, because the bare number is
          actively misleading without it: a player who reads "25m"
          as "I have cost the table 25 minutes" will hang back for
          no reason, when the truth is that the round costs whatever
          the *slowest* of them spends and their 25 may well be
          free. Deciding between a ten-minute locker and a five-
          minute errand is only a decision if you know that. */}
      {t.scene && sceneSpent(t, pc.id) > 0 && (
        <div
          className="pstatus-cost"
          title={`Your round so far: ${sceneSpent(t, pc.id)}m. The round will cost whatever the slowest of you spends.`}
          aria-label={`Your round so far, ${sceneSpent(t, pc.id)} minutes. The round costs whatever the slowest of you spends.`}
        >
          {sceneSpent(t, pc.id)}m
          {/* Actively misleading without its rule: a player who reads
              "25m" as "I have cost the table 25 minutes" hangs back
              for no reason, when the round costs whatever the slowest
              of them spends and their 25 may well be free. */}
          <Hint
            text={`Your round so far: ${sceneSpent(t, pc.id)} minutes. The round will cost whatever the slowest of you spends, not the total — so this may well be free.`}
            label="What this figure counts"
          />
        </div>
      )}

      {/* The room, as the creature experiences it. */}
      {conditions.length > 0 && (
        <div className="pstatus-conds">
          {conditions.map((c) => (
            <span key={c.k} className={`pstatus-cond is-${c.k}`} title={c.hint}>
              {c.label}
              {/* LOUD and WET are the two pieces of simulation state
                  a player can actually act on — one is the room
                  advertising them to something that hunts by sound,
                  the other is their best defence against it. Both
                  explanations were in a tooltip. */}
              <Hint text={c.hint} label={`What ${c.label} means`} />
            </span>
          ))}
        </div>
      )}

      {prince && (
        <div className={`pstatus-prince ${prince.alarm ? "is-alarm" : ""}`}
          aria-label={`Prince ${prince.text}`}>
          <span className="pstatus-prince-k">{prince.label}</span>
          <span className="pstatus-prince-v">{prince.text}</span>
          {/* Reading the cat is a skill the table is meant to
              acquire. It can only be acquired if someone says, once,
              that he is worth reading. */}
          <Hint
            text="The cat will not enter a room the thing is in, and he stares at it when it is near. He is the most reliable instrument on this station and nobody will tell you that out loud."
            label="Why the cat matters"
          />
        </div>
      )}

      {/* Your own conditions, at a glance. The full rule for each is
          one tap away on the Sheet tab — this is the reminder that
          there is something to read. */}
      {(pc.conditions || []).length > 0 && (
        <div className="pstatus-conds">
          {(pc.conditions || []).map((c) => (
            <span key={c} className="pstatus-cond is-self">{shortCond(c)}</span>
          ))}
        </div>
      )}

      <div className="pstatus-meters">
        <Pips label="HP" value={pc.health} max={pc.maxHealth} warn={pc.health <= pc.maxHealth / 3} />
        <Pips label="ST" value={pc.stress} max={20} warn={pc.stress >= 8} invert />
        <PanicOdds stress={pc.stress} />
      </div>

      {/* THE CLOCK, WHERE THE CLOCK BELONGS.

          `w.countdowns` was rendered inside the Location panel, in
          the right-hand drawer, two taps from the log. In a one-shot
          the countdown *is* the tension — a four-hour cargo window
          with a thing loose on the station is the entire structure of
          Ypsilon 14 — and putting it behind a drawer means the table
          only feels it when somebody thinks to go and look.

          ClockStrip renders nothing at all when nothing is ticking,
          so this costs no height until it matters, and `compact`
          keeps it to the two soonest. It stays in the Location panel
          as well: this is the pressure, that is the detail. */}
      <ClockStrip w={w} compact />
    </header>
  );
}
