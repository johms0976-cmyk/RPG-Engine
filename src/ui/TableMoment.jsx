/* ============================================================
   TABLE MOMENT — Panic and Death, on the screen everybody is
   already looking at.

   PanicTakeover.jsx says, in its own header: "On a shared screen
   that is enough, because everyone at the table watched the
   Warden's face." That sentence is true and it is load-bearing,
   and with the chair empty there is no face. Both takeovers are
   imported by ClientShell and nothing else, so in the two
   configurations the empty chair is actually played in —
   phones-and-a-TV, and one laptop passed round — the game's
   signature mechanic arrived as a line in a scrolling log
   between a damage roll and a room description.

   ------------------------------------------------------------
   THE SPLIT: WHAT IS PUBLIC, AND WHAT IS THE PLAYER'S

   Not a copy of the phone card. The two screens are answering
   two different questions and they should not say the same
   thing.

     THE ROOM asks *what just happened to whom*. Everyone at a
     real table sees you panic — it is the most public thing in
     Mothership, it is a Panic trigger for everyone watching, and
     the whole point of a shared screen is that the table looks
     up at the same moment. So: the effect's name, at size, and
     whose it is.

     THE PLAYER asks *what did I need*. DeathTakeover shows the
     save, the roll and which way it went, and gives its reason:
     at 0 Health that is the question the person who rolled asks
     out loud. That stays on the handset. It is arithmetic about
     one character and putting it on the wall turns a death into
     a scoreboard.

   So this deliberately carries NO numbers. Not the stress, not
   the save, not the roll, not the effect total.

   ------------------------------------------------------------
   IT NEVER BLOCKS AND IT NEVER WAITS

   DeathTakeover does not leave on its own, and is right not to:
   a player should have to press the thing that acknowledges
   their own character stopped breathing. This is the opposite
   case. Nobody owns the shared screen, so there is nobody to
   press it, and a card sitting unacknowledged on a TV until
   somebody walks over is worse than no card. It shows for a
   beat and hands the screen back.

   Longer for a death than a panic, because a death is a bigger
   silence and the table needs the room name back underneath it
   either way.
   ============================================================ */
import React, { useEffect, useState } from "react";

export const PANIC_HOLD_MS = 3400;
export const DEATH_HOLD_MS = 5200;

export default function TableMoment({ moment, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!moment) return undefined;
    setLeaving(false);
    const hold = moment.kind === "death" ? DEATH_HOLD_MS : PANIC_HOLD_MS;
    /* Two timers rather than one so the thing fades rather than
       vanishing. The second is the one that actually clears it. */
    const fade = setTimeout(() => setLeaving(true), hold - 500);
    const gone = setTimeout(() => onDone && onDone(), hold);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [moment, onDone]);

  if (!moment) return null;

  const dead = moment.kind === "death" && !moment.survived;
  const down = moment.kind === "death" && moment.survived;

  return (
    <div
      className={`tablemoment ${moment.kind === "death" ? (dead ? "is-dead" : "is-down") : "is-panic"}${leaving ? " is-leaving" : ""}`}
      /* `status`, not `alert`. On the shared screen this is a
         thing to look at, not a thing to interrupt a screen
         reader mid-sentence for — and the phone that owns this
         event is already raising a proper alertdialog. */
      role="status"
      aria-live="polite"
    >
      <div className="tablemoment-inner">
        <span className="tablemoment-kicker">
          {moment.kind === "death" ? (dead ? "0 HEALTH" : "0 HEALTH · STILL BREATHING") : "PANIC"}
        </span>
        <strong className="tablemoment-name">
          {moment.kind === "death" ? (dead ? "DEAD" : "UNCONSCIOUS") : moment.name}
        </strong>
        {moment.who && <span className="tablemoment-who">{moment.who}</span>}
      </div>
    </div>
  );
}

/**
 * The most recent moment worth taking the shared screen for, or null.
 *
 * Scans backwards and stops at the first hit, so a snapshot that
 * arrives carrying both a panic and a death shows the death — the
 * later line wins, which is also the more serious one, because
 * watching somebody go down is what caused the panic.
 *
 * `sinceId` is the last id already shown. Lines at or below it are
 * history: a table screen that remounts must not replay somebody's
 * death from forty minutes ago.
 *
 * BOTH BRANCHES REQUIRE THE ENGINE'S STRUCTURED STAMP. No prose is
 * parsed here. That is stricter than the phone, deliberately —
 * `panicFrom` falls back to reading the sentence so that an old
 * saved session still gets a takeover, and a scrappy subtitle on a
 * handset is a fair trade. The same scrappiness across a television
 * in front of six people is not, and the failure mode of a loose
 * match here is the screen shouting "PANIC CHECK · RILEY · 2D10"
 * at the room. Missing one panic from a pre-update save is cheap.
 */
export function momentFrom(feed, sinceId = 0) {
  if (!feed || !feed.length) return null;

  for (let i = feed.length - 1; i >= 0; i--) {
    const line = feed[i];
    if (!line || (line.id || 0) <= sinceId) break;

    const d = line.extra && line.extra.death;
    if (d) {
      return {
        id: line.id,
        kind: "death",
        survived: !!d.survived,
        who: d.name || null,
        name: null,
      };
    }

    const p = line.extra && line.extra.panic;
    if (p) {
      return {
        id: line.id,
        kind: "panic",
        name: String(p.effect || "PANIC").toUpperCase().slice(0, 28),
        who: p.who || null,
      };
    }
  }
  return null;
}
