/* ============================================================
   DEATH TAKEOVER — 0 Health, and the roll that decides.

   PanicTakeover exists because Panic is the game's signature and
   a card with a heading was the wrong weight for it. This is the
   same argument, one notch further up: reaching 0 Health and
   making a Body Save is the single most consequential thing that
   will happen to a character, and it was one line in a scrolling
   log between a damage line and a room description.

   Two differences from PanicTakeover, both deliberate:

     · IT DOES NOT LEAVE ON ITS OWN. Panic is punctuation — it
       hands the screen back after two seconds because the game
       carries on around you. This does not. Somebody either
       stopped breathing or did not, and a player should have to
       press the thing that acknowledges which. A screen that
       dismissed itself would be saying the moment was routine.

     · IT SHOWS THE ARITHMETIC. The save value, the roll, and
       which way it went. Not for verification — the engine is
       not being audited — but because at 0 Health the question
       every player asks out loud is "what did I need?", and the
       answer being on the screen is the difference between a
       result and a story.

   It renders for the owner of the character only. Watching
   somebody else die is a Panic trigger and is handled as one; it
   is not this screen.
   ============================================================ */
import React, { useEffect } from "react";

/** The pattern is two heavy beats and nothing else. */
const PATTERN_DIED = [140, 90, 420];
const PATTERN_LIVED = [60, 50, 60];

export default function DeathTakeover({ event, onDismiss, muted = false }) {
  useEffect(() => {
    if (!event || muted || !navigator.vibrate) return;
    navigator.vibrate(event.survived ? PATTERN_LIVED : PATTERN_DIED);
  }, [event, muted]);

  if (!event) return null;

  const { survived, save, roll, name, why } = event;

  return (
    <div className={`deathover ${survived ? "is-down" : "is-dead"}`}
      role="alertdialog" aria-modal="true"
      aria-label={survived ? "You are unconscious" : "You are dead"}>
      <div className="deathover-inner">
        <span className="deathover-kicker">
          {survived ? "0 HEALTH · BODY SAVE" : "0 HEALTH · BODY SAVE FAILED"}
        </span>

        <strong className="deathover-name">
          {survived ? "UNCONSCIOUS" : "DEAD"}
        </strong>

        {/* What you needed and what you got. The whole reason the
            structured copy exists — see useGame's 0-Health branch. */}
        <div className="deathover-maths" aria-label={`Needed ${save} or under, rolled ${roll}`}>
          <span><i>NEEDED</i>{save} or under</span>
          <span><i>ROLLED</i>{String(roll).padStart(2, "0")}</span>
        </div>

        <p className="deathover-body">
          {survived
            ? "You went down instead of out. The Warden has rolled, secretly, for when you come back and what it costs — you will find out when you wake up, if you wake up."
            : "That is the whole of it. No further roll, no save against this one."}
          {why ? ` (${why})` : ""}
        </p>

        {/* Naming them is not redundant on a phone that may have been
            face-down on the table for the last minute. */}
        <p className="deathover-who">{name}</p>

        <button type="button" className="deathover-go" onClick={onDismiss} autoFocus>
          {survived ? "Understood" : "Understood"}
        </button>
      </div>
    </div>
  );
}

/**
 * Pull the death out of a feed line, for this phone only.
 *
 * `extra.death` is stamped by useGame at the 0-Health branch, so
 * nothing here parses prose. Returns null unless the line is about
 * the character this handset is holding — the takeover is a first-
 * person event, and watching somebody else go down arrives as a
 * Panic trigger instead.
 */
export function deathFrom(line, myPcId) {
  const d = line && line.extra && line.extra.death;
  if (!d || !myPcId || d.pcId !== myPcId) return null;
  return { id: line.id, ...d };
}
