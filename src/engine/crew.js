/* ============================================================
   CREW — party play.

   Mothership is a game about a crew, and almost every class
   ability in the book is about what your failure does to the
   person standing next to you:

     - a Scientist who fails a Sanity Save stresses everyone
     - a Marine who Panics makes everyone else roll Fear
     - Fear Saves near an Android are at Disadvantage
     - a nearby Marine steadies you: +5 Combat, +5 Fear
     - a Teamster can re-roll one Panic Effect per session
     - another crew member can assist you for Advantage

   None of that can exist with one character. This module holds
   the crew, decides who is "nearby", and exposes the contagion
   hooks that useGame fires.
   ============================================================ */

export const isAble = (pc) => !!pc && pc.alive !== false && !pc.unconscious;

/** Everyone still on their feet other than `pc`. */
export const othersNearby = (crew, pc) =>
  crew.filter((c) => c.id !== pc.id && isAble(c));

/** The whole crew, alive or not, for the roster display. */
export const roster = (crew) => crew.slice();

export const livingCrew = (crew) => crew.filter((c) => c.alive !== false);

export const findPc = (crew, id) => crew.find((c) => c.id === id) || null;

/** Replace one crew member, returning a new array. */
export function replacePc(crew, id, patch) {
  return crew.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

/** Apply a function to several crew members at once. */
export function patchMany(crew, ids, fn) {
  const set = new Set(ids);
  return crew.map((c) => (set.has(c.id) ? fn(c) : c));
}

/**
 * Class contagion after a Save.
 * Returns a list of consequences for useGame to enact, rather than
 * doing it here, so the feed messages stay in one place.
 */
export function saveContagion(pc, req, result, crew) {
  const out = [];
  if (result.success) return out;

  // Scientist: a failed Sanity Save stresses everyone nearby.
  if (pc.cls === "scientist" && req.kind === "save" && req.name === "sanity") {
    const others = othersNearby(crew, pc);
    if (others.length)
      out.push({
        kind: "stressOthers", ids: others.map((c) => c.id), amount: 1,
        text: `${pc.name} makes a sound nobody wants to hear from a scientist. Everyone nearby gains 1 Stress.`,
      });
  }
  return out;
}

/** Marine panic contagion: everyone nearby makes a Fear Save. */
export function panicContagion(pc, crew) {
  if (pc.cls !== "marine") return [];
  const others = othersNearby(crew, pc);
  if (!others.length) return [];
  return [{
    kind: "fearSaveOthers", ids: others.map((c) => c.id),
    text: `${pc.name} is a Marine, and Marines are not supposed to do that. Everyone nearby must make a Fear Save.`,
  }];
}

/** Watching someone die is a Panic trigger (PSG 26.2). */
export function deathContagion(dead, crew) {
  const others = othersNearby(crew, dead);
  if (!others.length) return [];
  return [{
    kind: "panicOthers", ids: others.map((c) => c.id),
    text: `${dead.name} is dead, and everyone saw it.`,
  }];
}

/**
 * More than one crew member Panicking at once is itself a trigger.
 * `justPanicked` is the set of ids that panicked in this beat.
 */
export function multiPanicContagion(justPanicked, crew) {
  if (justPanicked.length < 2) return [];
  const ids = crew.filter((c) => isAble(c) && !justPanicked.includes(c.id)).map((c) => c.id);
  if (!ids.length) return [];
  return [{
    kind: "panicOthers", ids,
    text: "Two of them go at once. Whatever was holding the room together is not holding it any more.",
  }];
}

/** Who can assist a roll right now? Once per day each. */
export function possibleAssists(crew, pc, day) {
  return othersNearby(crew, pc).filter((c) => c.lastAssistDay !== day);
}

/**
 * Who can give therapy before a rest? Psychology or Theology,
 * once per day, and the helper cannot also relieve their own
 * Stress that day (PSG 25.2).
 */
export function possibleTherapists(crew, pc, day) {
  return othersNearby(crew, pc).filter(
    (c) => c.lastAssistDay !== day &&
      (c.skills.includes("Psychology") || c.skills.includes("Theology") || c.skills.includes("Sophontology"))
  );
}

/** A crew of one is still a crew, but say so. */
export const crewSummary = (crew) => {
  const up = crew.filter(isAble).length;
  const down = crew.filter((c) => c.alive !== false && c.unconscious).length;
  const dead = crew.filter((c) => c.alive === false).length;
  const bits = [`${up} on their feet`];
  if (down) bits.push(`${down} down`);
  if (dead) bits.push(`${dead} dead`);
  return bits.join(", ");
};
