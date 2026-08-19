/* ============================================================
   PARTY — where each person actually is.

   The engine used to hold one field, `w.room`, and move it. That
   is correct for one player and quietly wrong for six: `doMove`
   wrote it, `describeRoom` and `threatCheckOnEntry` fired for
   everybody, and the result was a horror game in which nobody
   could ever be alone. Ypsilon 14's best material — Giovanni on
   the Heracles, the vents, somebody going back for the cat, the
   person who stayed in the washroom — is all people being alone,
   and none of it could happen.

   So a character now carries its own `room`, and `w.room` becomes
   *derived*: where most of the crew is. The module simulation
   still wants a single answer to "where are the visitors" —
   sim.js scores rooms by how lonely the warm things in them are —
   and a derived majority is a better answer than a lie.

   Two rules keep this from turning every existing session into a
   game of six separate solitaires:

     1. `roomOf` falls back to `w.room`. A save written before
        this file existed, a character built by a phone, a
        module's own `moveTo` — all of them still work.

     2. `audienceFor` returns **null while the party is together**.
        A null audience is a public feed line, exactly as before,
        so a table that never splits sees no change at all and
        every existing test still passes. Only once two people are
        genuinely in different rooms does the engine start
        addressing what it says, and then it addresses it to the
        room rather than to the table.

   Nothing here touches state. It is all reads, so it is testable
   without a DOM and cannot drift from what the UI shows.
   ============================================================ */

/** Is this character on their feet and in the game? */
export const isUp = (c) => !!c && c.alive !== false && !c.unconscious;

/** Where is this character? Falls back to the party's room, then to
    the module's start, so a character that predates per-PC rooms is
    simply standing with everybody else. */
export function roomOf(pc, w) {
  if (pc && pc.room) return pc.room;
  return (w && w.room) || null;
}

/** Everyone standing in a given room. Includes the unconscious —
    they are lying in it — but never the dead, who are nowhere. */
export function pcsIn(crew, roomId, w) {
  return (crew || []).filter((c) => c.alive !== false && roomOf(c, w) === roomId);
}

/** Everyone standing in the same room as this character, themselves
    included. The replacement for crew.js's `othersNearby`, which
    assumed the whole crew was always nearby. */
export function withMe(crew, pc, w) {
  return pcsIn(crew, roomOf(pc, w), w);
}

/** Everyone else in this character's room. */
export function othersHere(crew, pc, w) {
  return withMe(crew, pc, w).filter((c) => c.id !== (pc && pc.id) && isUp(c));
}

/** Is this character on their own? The condition the whole module
    is built around, and the thing sim.js hunts for. */
export function isAlone(crew, pc, w) {
  return othersHere(crew, pc, w).length === 0;
}

/** Every distinct room the living crew occupies, in crew order. */
export function occupiedRooms(crew, w) {
  const out = [];
  for (const c of crew || []) {
    if (c.alive === false) continue;
    const r = roomOf(c, w);
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/** Has the party come apart? */
export const isSplit = (crew, w) => occupiedRooms(crew, w).length > 1;

/**
 * The derived `w.room`: where most of the crew is.
 *
 * Ties break towards the room the party was already considered to
 * be in, so three-and-three does not make the base's simulation
 * flicker between two compartments every time somebody searches a
 * locker. Failing that, the first room in crew order.
 */
export function majorityRoom(crew, w, fallback) {
  const counts = new Map();
  for (const c of crew || []) {
    if (!isUp(c)) continue;
    const r = roomOf(c, w);
    if (!r) continue;
    counts.set(r, (counts.get(r) || 0) + 1);
  }
  if (!counts.size) return fallback || (w && w.room) || null;

  const prior = (w && w.room) || null;
  let best = null;
  let bestN = -1;
  for (const [room, n] of counts) {
    if (n > bestN || (n === bestN && room === prior)) { best = room; bestN = n; }
  }
  return best;
}

/**
 * Who should hear a line about something happening in `roomId`?
 *
 * Returns `null` when the party is together — meaning "say it out
 * loud", the engine's behaviour before any of this existed. Once
 * the party has split it returns the ids of the people who are
 * actually in that room, and secrets.js addresses the line to them
 * on the way out.
 *
 * The Warden's own screen is never filtered, so the desk always
 * hears everything, in one feed, in order. That is the whole
 * reason splitting the party is survivable for the person running
 * it.
 */
export function audienceFor(crew, w, roomId) {
  if (!isSplit(crew, w)) return null;
  const here = pcsIn(crew, roomId, w).map((c) => c.id);
  return here.length ? here : [];
}

/** A short readable statement of how the party is arranged, for the
    Warden's screen and the table screen. */
export function partySummary(crew, w, mod) {
  const rooms = occupiedRooms(crew, w);
  const nameOfRoom = (id) => (mod && mod.rooms && mod.rooms[id] && mod.rooms[id].name) || id;
  return rooms.map((r) => ({
    room: r,
    name: nameOfRoom(r),
    who: pcsIn(crew, r, w).filter(isUp).map((c) => ({ id: c.id, name: c.name })),
  }));
}

/** Everything a character can reach from where *they* are standing.
    `visibleExits` in world.js reads `w.room`; this is the per-person
    version, and the one every phone should be using. */
export function exitsFor(mod, w, pc) {
  const id = roomOf(pc, w);
  const room = mod.rooms[id];
  if (!room) return [];
  return (room.exits || []).filter((e) => !e.hidden || w.flags[e.hidden]);
}
