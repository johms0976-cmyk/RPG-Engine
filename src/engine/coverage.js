/* ============================================================
   COVERAGE — what the module does not cover.

   `defineModule` already reports two things at load: `problems`
   (this cannot work) and `warnings` (this will silently do
   nothing). Both are correctness. Neither answers the question an
   author actually has at 1am, which is:

     "Is this finished? Is there a room in here I built and then
      never gave anybody a reason to be in?"

   That question has an arithmetic answer and nobody was
   computing it. Another Bug Hunt has 48 rooms and 14 listeners;
   Dead Weight has 9 rooms and no room `actions` at all. Those are
   not bugs and neither of them is wrong. They are the shape of
   the module, and an author who could see the shape would make
   different decisions about where to spend the next hour.

   ------------------------------------------------------------
   THIS IS NOT A LINTER AND MUST NOT BECOME ONE

   Nothing in here is an error, and nothing in here should ever
   be promoted to `problems`. A room with no features is a
   corridor, and corridors are good — a module made entirely of
   rooms that each reward a search is exhausting to play and
   worse to run. Empty space is a design choice, and software
   that nags about it is software telling an author their module
   is wrong when it is merely quiet.

   So the output is a REPORT, not a verdict. It says what is
   there. It draws no conclusion, ranks nothing, and never uses
   the word "should". The author is the one who knows whether the
   fourteenth empty room is a corridor or an oversight.

   That distinction is why this lives in its own file rather than
   as more pushes into `warnings`: a warning is a claim that
   something is wrong, and none of this is.

   ------------------------------------------------------------
   WHY ROOM REACH IS THE ONE THING IT DOES ASSERT

   One exception, and it is in `problems` territory but sits here
   because it is a whole-graph fact rather than a per-room one: a
   room that cannot be reached from `start` by any exit, gate,
   `moveTo` or threat placement is a room no table will ever see.
   That is not a design choice, it is forty minutes of writing
   that will never reach a player, and an author wants to know
   before they write the forty-first.

   It is still reported rather than raised, because there is one
   legitimate reason for it: a room reached only through a module
   `hook`, which this cannot see into. So it names the rooms and
   says which are unreachable *by declaration*, and lets the
   author recognise their own hook.
   ============================================================ */

/** Rooms reachable from `start` by anything the module declares. */
function reachable(mod) {
  const rooms = mod.rooms || {};
  const seen = new Set();
  const queue = [];

  if (rooms[mod.start]) { seen.add(mod.start); queue.push(mod.start); }

  /* A threat's or an NPC's starting room is a place the module put
     somebody, which is a strong statement that it is part of the
     map even if no exit reaches it — the vents in Ypsilon 14 are
     exactly this. Same for anything a `moveTo` names. */
  const seed = (id) => { if (rooms[id] && !seen.has(id)) { seen.add(id); queue.push(id); } };
  for (const t of Object.values(mod.threats || {})) if (t && t.start) seed(t.start);
  for (const n of Object.values(mod.npcs || {})) if (n && n.start) seed(n.start);

  /* Every `moveTo` anywhere in the module, at any depth. Cheap and
     total: the alternative is walking the effect tree by hand and
     missing the one nested inside a `pick` inside a `when`. */
  try {
    const json = JSON.stringify(mod, (k, v) => (typeof v === "function" ? undefined : v));
    for (const m of json.matchAll(/"moveTo"\s*:\s*"([a-zA-Z0-9_-]+)"/g)) seed(m[1]);
  } catch { /* circular or exotic; the exits below still run */ }

  while (queue.length) {
    const id = queue.shift();
    for (const e of rooms[id].exits || []) {
      const to = e && e.to;
      if (!to || String(to).startsWith("@")) continue; // an ending, not a room
      if (rooms[to] && !seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  return seen;
}

/**
 * A plain-data report. No judgements, no severities, no ordering
 * by importance — the caller decides what to show.
 */
export function coverage(mod) {
  const rooms = mod.rooms || {};
  const ids = Object.keys(rooms);
  const d = mod.director || {};

  const listeners = Array.isArray(d.listeners) ? d.listeners.filter(Boolean) : [];
  const reach = reachable(mod);

  /* A room is "quiet" when it offers nothing but its own
     description: no features to look at, no actions, no device,
     no NPC, no threat. Not wrong. Possibly a corridor. */
  const quiet = [];
  const unreachable = [];

  const npcRooms = new Set(
    Object.values(mod.npcs || {}).map((n) => n && n.start).filter(Boolean),
  );
  const threatRooms = new Set(
    Object.values(mod.threats || {}).map((t) => t && t.start).filter(Boolean),
  );

  for (const id of ids) {
    if (!reach.has(id)) unreachable.push(id);
    const r = rooms[id] || {};
    const hasFeatures = r.features && Object.keys(r.features).length > 0;
    const hasActions = Array.isArray(r.actions) && r.actions.length > 0;
    const hasEffects =
      (Array.isArray(r.onFirstEnter) && r.onFirstEnter.length) ||
      (Array.isArray(r.onEnter) && r.onEnter.length);
    if (!hasFeatures && !hasActions && !hasEffects && !npcRooms.has(id) && !threatRooms.has(id)) {
      quiet.push(id);
    }
  }

  /* NPCs who run out of things to say. `knows` is the complete set
     of sentences a person can ever speak (INV-6), so an NPC with
     three entries is done after three questions. Eight to twelve
     is a person; three is a kiosk. Silent NPCs are exempt — an
     animal or a corpse is meant to have nothing. */
  const thinNpcs = Object.entries(mod.npcs || {})
    .filter(([, n]) => n && !n.silent)
    .map(([id, n]) => [id, (Array.isArray(n.knows) ? n.knows.length : 0)])
    .filter(([, n]) => n < 4);

  /* Endings nothing anywhere routes to.

     THE FIRST VERSION OF THIS WAS USELESS AND THE REASON IS
     WORTH KEEPING. It searched `JSON.stringify(mod)` with
     functions stripped, and reported eight of Ypsilon 14's nine
     endings as unreferenced — because almost every ending in
     every module here is reached by `api.endGame("x")` inside a
     hook, and a hook is a function. A report that flags correct
     work as suspect on its first run is worse than no report:
     the author learns to skip the section, and then misses the
     one real finding when it eventually appears.

     So the search corpus includes function source. `toString()`
     on a hook gives its body, which is where `endGame` lives. */
  let corpus = "";
  try {
    corpus = JSON.stringify(mod, (k, v) => (typeof v === "function" ? v.toString() : v));
  } catch { /* nothing to search; the list will simply be empty */ }
  const unreferencedEndings = Object.keys(mod.endings || {}).filter(
    (id) =>
      !corpus.includes(`"end":"${id}"`) &&
      !corpus.includes(`"@${id}"`) &&
      !corpus.includes(`endGame(\\"${id}\\")`) &&
      !corpus.includes(`endGame('${id}')`) &&
      !corpus.includes(`end: \\"${id}\\"`),
  );

  return {
    rooms: ids.length,
    listeners: listeners.length,
    quietRooms: quiet,
    unreachableRooms: unreachable,
    thinNpcs,
    unreferencedEndings,
    threats: Object.keys(mod.threats || {}).length,
    npcs: Object.keys(mod.npcs || {}).length,
    endings: Object.keys(mod.endings || {}).length,
  };
}

/**
 * The report as lines an author can read on the module's card.
 * Empty array means there is nothing worth saying, which is a
 * legitimate and common outcome — silence is the correct output
 * for a module with no gaps, exactly as it is for the director.
 */
export function coverageNotes(mod) {
  const c = coverage(mod);
  const out = [];

  if (c.unreachableRooms.length) {
    out.push(
      `${c.unreachableRooms.length} room${c.unreachableRooms.length === 1 ? "" : "s"} `
      + `no exit reaches: ${c.unreachableRooms.join(", ")}. `
      + `If a hook moves the crew there, this is fine and expected.`,
    );
  }
  if (c.quietRooms.length) {
    out.push(
      `${c.quietRooms.length} of ${c.rooms} rooms offer nothing but their description: `
      + `${c.quietRooms.join(", ")}. Corridors are good; this is only a count.`,
    );
  }
  if (c.thinNpcs.length) {
    out.push(
      `NPCs who run dry fast: `
      + c.thinNpcs.map(([id, n]) => `${id} (${n} line${n === 1 ? "" : "s"})`).join(", ")
      + `. \`knows\` is everything they can ever say.`,
    );
  }
  if (c.unreferencedEndings.length) {
    out.push(
      `Endings nothing declares a route to: ${c.unreferencedEndings.join(", ")}. `
      + `Reached from a hook, this is fine.`,
    );
  }
  /* The listener count, stated once, without an opinion attached.
     The engine now supplies a common pack (engine/listenerPack.js)
     so a low number is no longer the silence it used to be. */
  if (c.rooms >= 8 && c.listeners < 6) {
    out.push(
      `${c.listeners} phrase listener${c.listeners === 1 ? "" : "s"} across ${c.rooms} rooms. `
      + `The common pack covers what every table says; these are for what only yours does.`,
    );
  }
  return out;
}

export default coverage;
