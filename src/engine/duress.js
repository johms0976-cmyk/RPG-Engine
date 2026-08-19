/* ============================================================
   DURESS — how much trouble this character is in, as one number.

   The problem is a phone-shaped one. On a shared screen the
   Warden says "it's on you, it has you by the arm" and everyone
   watches you go pale. On six separate handsets the same fact is
   a line of text three rows up in a log nobody is reading, and
   the player carries on browsing their inventory while something
   eats them.

   PlayerStatus answers "am I hurt" with a meter, which is the
   right answer to a slow question. It is the wrong answer to a
   fast one. A meter that has gone from eight pips to three does
   not make anybody look up.

   So: one derived level, computed from state that already
   exists, driving one unmissable visual. Nothing here is stored,
   nothing is sent, nothing new has to be maintained by the
   Warden — it is a reading of the world, taken fresh every
   render, on the phone that owns the character.

     0  CLEAR      nothing pressing
     1  EXPOSED    in a fight, or worn down
     2  PRESSED    hurt badly, in reach of something, or about to
                   panic
     3  CRITICAL   held, dying, or out of Health

   Level 3 is deliberately hard to reach. A warning that is on
   for an hour is wallpaper by minute ten.
   ============================================================ */

import { grabberOf, liveEnemies } from "./combat.js";
import { othersHere, isSplit } from "./party.js";

export const DURESS = { CLEAR: 0, EXPOSED: 1, PRESSED: 2, CRITICAL: 3 };

export const DURESS_NAME = ["clear", "exposed", "pressed", "critical"];

/** Distance at which a threat is close enough to reach you this turn. */
export const REACH_M = 5;

/** Stress at which the next failed Save is a Panic Check. Mirrors the
    threshold PlayerStatus already warns at, so the two never disagree. */
export const PANIC_STRESS = 8;

/** Conditions that mean the body is actively failing, as opposed to
    the many that are merely unpleasant. */
const BLEEDING = new Set([
  "Bleeding Out", "Coughing Fit", "Compound Fracture", "Broken", "Suffocating",
]);

/**
 * Read the world for one character.
 *
 * Returns { level, name, tags, headline, sources } where `tags` are
 * short all-caps chips for the edge of the screen and `headline` is
 * the single loudest thing, for the one line there is room for.
 */
export function duressOf({ pc, combat, w, mod, crew }) {
  if (!pc || pc.alive === false) {
    return { level: DURESS.CLEAR, name: "clear", tags: [], headline: null, sources: [] };
  }

  const sources = [];
  const add = (level, tag, headline) => sources.push({ level, tag, headline });

  /* ---- violence ---- */
  if (combat) {
    add(DURESS.EXPOSED, "IN A FIGHT", "You are in a fight.");

    const holder = grabberOf(combat, pc.id);
    if (holder) {
      add(DURESS.CRITICAL, "HELD", `${holder.name} has hold of you.`);
    }

    // Anything alive and close enough to reach you before your next go.
    const near = liveEnemies(combat).filter((e) => (e.distance ?? 99) <= REACH_M);
    if (near.length) {
      add(
        DURESS.PRESSED,
        near.length > 1 ? `${near.length} IN REACH` : "IN REACH",
        near.length > 1
          ? `${near.length} of them are close enough to reach you.`
          : `${near[0].name} is close enough to reach you.`,
      );
    }

    const actor = combat.actors && combat.actors[pc.id];
    if (actor && actor.stunned) add(DURESS.PRESSED, "STUNNED", "You are stunned.");
    if (actor && actor.prone) add(DURESS.EXPOSED, "DOWN", "You are on the floor.");
  }

  /* ---- the body ---- */
  const max = Math.max(1, pc.maxHealth || 1);
  const frac = Math.max(0, pc.health) / max;

  if (pc.unconscious) add(DURESS.CRITICAL, "UNCONSCIOUS", "You are unconscious.");
  else if (pc.health <= 0) add(DURESS.CRITICAL, "DYING", "You are out of Health.");
  else if (frac <= 0.25) add(DURESS.CRITICAL, "BADLY HURT", "You are badly hurt.");
  else if (frac <= 0.5) add(DURESS.PRESSED, "HURT", "You are hurt.");

  if ((pc.wounds || 0) > 0 && (pc.maxWounds || 2) - pc.wounds <= 1) {
    add(DURESS.CRITICAL, "ONE WOUND LEFT", "One more wound is the last one.");
  }

  for (const c of pc.conditions || []) {
    if (BLEEDING.has(c)) add(DURESS.CRITICAL, c.toUpperCase(), `${c}.`);
  }

  /* ---- the mind ---- */
  if (pc.stress >= PANIC_STRESS + 4) {
    add(DURESS.CRITICAL, "BREAKING", "Your Stress is past the point of holding.");
  } else if (pc.stress >= PANIC_STRESS) {
    add(DURESS.PRESSED, "PANIC RISK", "The next failed Save is a Panic Check.");
  }

  /* ---- the clock ----
     A countdown inside five minutes is duress even standing still in
     an empty room, which is exactly when a player forgets about it. */
  const soonest = Object.entries((w && w.countdowns) || {})
    .filter(([, c]) => !c.paused)
    .map(([id, c]) => ({ id, left: c.left }))
    .sort((a, b) => a.left - b.left)[0];

  if (soonest && soonest.left <= 2) {
    add(DURESS.CRITICAL, `${soonest.id.toUpperCase()} ${soonest.left}M`, `${soonest.id.toUpperCase()} — ${soonest.left} minutes.`);
  } else if (soonest && soonest.left <= 5) {
    add(DURESS.PRESSED, `${soonest.id.toUpperCase()} ${soonest.left}M`, `${soonest.id.toUpperCase()} — ${soonest.left} minutes.`);
  }

  /* ---- being on your own ----
     Only once the party has actually split, because in a game where
     everyone is always in the same room "alone" is not a state, it
     is the absence of one, and a chip that is on permanently is
     wallpaper. EXPOSED rather than PRESSED: being by yourself is
     not an emergency, it is the condition under which one arrives. */
  if (crew && isSplit(crew, w) && othersHere(crew, pc, w).length === 0) {
    add(DURESS.EXPOSED, "ALONE", "There is nobody else in here.");
  }

  /* ---- the room ----
     Modules can mark a room as actively hostile (vacuum, fire, no air)
     with a tag; standing in one is duress in itself. */
  const room = mod && w && mod.rooms && mod.rooms[w.room];
  const hostile = (room && room.tags || []).find((t) =>
    /vacuum|airless|fire|burning|flood|radiation|toxic|freezing/i.test(String(t)));
  if (hostile) add(DURESS.PRESSED, String(hostile).toUpperCase(), `You cannot stay in here.`);

  if (!sources.length) {
    return { level: DURESS.CLEAR, name: "clear", tags: [], headline: null, sources: [] };
  }

  const level = sources.reduce((m, s) => Math.max(m, s.level), DURESS.CLEAR);
  const loudest = sources
    .filter((s) => s.level === level)
    .sort((a, b) => a.tag.length - b.tag.length)[0];

  return {
    level,
    name: DURESS_NAME[level],
    // Highest-severity chips first, capped — the edge of a phone is
    // not a status readout and four of these is already too many.
    tags: [...sources].sort((a, b) => b.level - a.level).map((s) => s.tag).slice(0, 3),
    headline: loudest ? loudest.headline : null,
    sources,
  };
}

/** Did it get worse since last render? The phone uses this to decide
    whether to buzz — a rising level is news, a steady one is not. */
export function duressRose(prev, next) {
  return !!next && (!prev || next.level > prev.level) && next.level >= DURESS.PRESSED;
}
