/* ============================================================
   NOISE AS TERRAIN

   The creature is an echolocation predator. That is the single
   defining fact about it — the module says so on its first page,
   the goggles exist because of it, the boombox exists because of
   it, and half the items in items.js carry `loud: true`.

   And yet noise was a *momentary* effect: `noise()` printed a
   line, rolled `noiseDraw` against each threat, moved it, and the
   sound stopped existing. `choosePrey()` never read noise at all.
   So the fiction said "noise is how it sees" and the simulation
   said "noise is a 55% dice roll that expires immediately".

   What was missing is that sound has a *location* and a
   *duration*. Cutting a pressure door is not an event, it is
   twenty minutes of the loudest thing on the base, coming from
   one room, while you are standing in it and cannot hear anything
   else. This file makes that a persistent, decaying, per-room
   quantity that the creature's scoring reads and the players can
   see on their own room.

   Three consequences, all of them decisions the players now get
   to make:

     · Being loud is a *choice with a cost*, not a dice roll you
       lose. Firing a flare gun indoors marks the room for the
       next quarter of an hour.
     · The creature can arrive *pointing the wrong way*, because
       it is heading for a sound that was made ten minutes ago by
       someone who has since moved. That is the single most
       valuable behaviour this change buys: it makes the boombox
       and the recorded tape into real tools rather than flavour.
     · Water and noise pull in opposite directions. The showers
       are the safest room on the base and running them is loud.
       Nothing in the module forces that trade before now.

   The level scale is deliberately tiny — four values, named
   rather than numeric at the edges — because a player reading
   QUIET / WORKING / LOUD off their status strip is the whole
   interface. A 0-100 meter would be a lie about the precision of
   anything underneath it.
   ============================================================ */

/** Every noise level the module can produce, loudest last. */
export const NOISE = {
  QUIET: 0,
  WORKING: 2,    // hand tools, conversation, a door cycling
  LOUD: 5,       // power tools, a fight, the slurry pump
  SCREAMING: 8,  // gunfire indoors, a flare, someone panicking
};

/** How much a room's level falls per simulation step (10 minutes).
    One per step means a gunshot is still faintly interesting eighty
    minutes later, which is about right for a sealed metal box. */
export const NOISE_DECAY = 1;

/** Above this, the creature can hear it from an adjacent room. */
export const NOISE_CARRIES = 4;

const key = (room) => `noise:${room}`;

/** The stored record for a room, or null. Shape is
    `{ level, at, why }` — `at` is the clock reading when the sound
    was last made, which is what lets the creature be *late*. */
export function noiseRecord(w, room) {
  if (!w || !room) return null;
  const n = w.flags && w.flags[key(room)];
  return n && n.level > 0 ? n : null;
}

/** How loud a room is right now, 0 if silent. */
export function noiseAt(w, room) {
  const n = noiseRecord(w, room);
  return n ? n.level : 0;
}

/** Player-facing word for a level. Four states, because the strip
    has room for one word and a player needs to know whether they
    are currently advertising their position. */
export function noiseLabel(level) {
  if (!level || level <= NOISE.QUIET) return "quiet";
  if (level < NOISE.LOUD) return "working";
  if (level < NOISE.SCREAMING) return "loud";
  return "screaming";
}

/** The same thing said as a sentence, for the feed and for screen
    readers, which get no benefit from a one-word badge. */
export function noiseBlurb(level) {
  if (!level || level <= NOISE.QUIET) return "Nothing in here is making a sound but you.";
  if (level < NOISE.LOUD) return "There is working noise in here — enough to cover a footstep, not enough to carry.";
  if (level < NOISE.SCREAMING) return "This room is loud. Anything that hunts by sound knows there is something here.";
  return "This room is screaming. You could not hear a door open behind you.";
}

/**
 * Add sound to a room. Levels do not simply sum — two people
 * talking is not a gunshot — so a new sound raises the floor and
 * adds a little, which keeps a sustained job (a cutting torch,
 * ten minutes at a time) climbing without letting six people
 * chatting reach the same level as a firefight.
 *
 * Returns the new flag value; the caller writes it, so this stays
 * a pure function and is testable without an api object.
 */
export function addNoise(current, level, clock, why) {
  const was = current && current.level > 0 ? current.level : 0;
  const next = Math.max(was, level) + (was && level ? 1 : 0);
  return {
    level: Math.min(NOISE.SCREAMING + 2, next),
    at: clock,
    why: why || (current && current.why) || null,
  };
}

/**
 * One step of decay across every room that has a level.
 * Returns a patch object of `{ flagKey: value|null }`, null meaning
 * delete. Pure, for the same reason as above.
 */
export function decayNoise(flags, steps = 1) {
  const patch = {};
  if (!flags) return patch;
  for (const k of Object.keys(flags)) {
    if (!k.startsWith("noise:")) continue;
    const n = flags[k];
    if (!n || typeof n.level !== "number") { patch[k] = null; continue; }
    const level = n.level - NOISE_DECAY * steps;
    patch[k] = level > 0 ? { ...n, level } : null;
  }
  return patch;
}

/**
 * What the creature can hear from where it is standing, and how
 * appealing it is. Returns a list of `{ room, level, age, score }`
 * sorted loudest-first.
 *
 * `age` is why this is worth doing at all. A sound made forty
 * minutes ago still scores — it is the only lead the thing has —
 * but it scores *less*, and when the creature arrives the room may
 * well be empty. Being drawn to where somebody was is exactly the
 * behaviour a predator that hunts by echo should show, and it is
 * what turns a decoy from a scripted flag into a tactic.
 */
export function heardBy(w, adjacency, from) {
  const out = [];
  if (!w || !w.flags) return out;
  const near = new Set([from, ...((adjacency && adjacency[from]) || [])]);
  for (const k of Object.keys(w.flags)) {
    if (!k.startsWith("noise:")) continue;
    const room = k.slice(6);
    const n = w.flags[k];
    if (!n || !(n.level > 0)) continue;
    // Quiet rooms are only audible from inside them.
    if (!near.has(room) && n.level < NOISE_CARRIES) continue;
    const age = Math.max(0, (w.clock || 0) - (n.at || 0));
    const stale = Math.min(0.75, age / 120);      // ~2 hours to fully cold
    out.push({ room, level: n.level, age, score: n.level * (1 - stale) });
  }
  return out.sort((a, b) => b.score - a.score);
}
