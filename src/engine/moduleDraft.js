/* ============================================================
   A MODULE BEING WRITTEN.

   `portableModule.js` made a scenario a file: JSON, loaded at
   runtime, distributable by email, with no build step. What it
   did not do was give anybody a way to *write* one. The honest
   state of authoring until now is that you either edit JavaScript
   in `src/modules/` and run a build, or you hand-write several
   hundred lines of JSON in a text editor against a nine-hundred-
   line format document. Both of those are a toolchain, and the
   toolchain is a rounding error of the people who write
   Mothership scenarios.

   This is the model behind the editor screen. The screen is a
   view over it and holds no rules of its own.

   ------------------------------------------------------------
   IT DOES NOT INVENT A SECOND FORMAT

   The single most tempting mistake here is an editor document —
   a richer shape with ids, ordering, undo history and back-
   references, serialised down to a portable module on export.
   That shape would immediately be the real format, the portable
   one would become its output, and the two would drift, because
   an exporter is the last thing anybody updates.

   So a draft IS a portable module: the same raw object
   `readPortableModule` reads, edited in place. Every operation
   below takes one and returns another. `compile` is the whole of
   the validation story and it is the engine's own, which means
   the editor cannot produce something the shelf refuses — the
   thing on screen while you type is the thing the library will
   say about it.

   The cost of that is real and worth naming: there is no undo
   stack, no stable identity for a room across a rename, and no
   room for editor-only metadata. The screen keeps the previous
   draft for one step, which covers the mistake people actually
   make, and everything else is the price of one format.

   ------------------------------------------------------------
   RENAMING IS THE ONLY OPERATION WITH TEETH

   Every other edit touches one place. A room id is referenced
   from `start`, from every exit that leads to it, from any
   `moveTo` anywhere in the effect tree, from an NPC or threat's
   starting position, from `retreatTo`, from `restSpots`, and from
   the map's own layout. An editor that renames the key and leaves
   the other seven is an editor that silently breaks a module the
   first time somebody tidies up a name — which is the point at
   which authors stop trusting it and go back to the text editor.

   `renameRoom` retargets all of them. It is the one function here
   that would be worth writing even if the screen were thrown
   away.
   ============================================================ */

import { readPortableModule, PMOD_KIND, PMOD_VERSION } from "./portableModule.js";

export const DRAFT_VERSION = 1;

/* Its own key, and deliberately not the shelf's. A draft and an
   installed module have different lifetimes and different failure
   modes: a half-written module must never appear in the library,
   and clearing the shelf must never throw away an evening's
   writing. Sibling of moduleStore.js, same reasoning as its
   header gives for not sharing storage.js's key. */
const DRAFT = "rpg-engine:draft:v1";

const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

/** An id a filesystem, a URL and a JSON key will all accept. */
export const slug = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "untitled";

/* Structured clone by JSON, which is exactly the right depth here:
   a draft is a portable module, a portable module is JSON by
   definition, and anything in it that would not survive this round
   trip is something `readPortableModule` is about to refuse
   anyway. */
const copy = (v) => JSON.parse(JSON.stringify(v));

/**
 * The smallest thing that is a module.
 *
 * One room rather than three. The template in `src/modules/_template`
 * ships three because it is demonstrating exits and a gate; this is
 * demonstrating nothing, and a new author's first act should be
 * adding the second room rather than deleting two they did not write.
 */
export function blankDraft({ title = "UNTITLED", id } = {}) {
  const roomId = "start";
  return {
    engine: "^2.0.0",
    id: id || slug(title),
    title,
    blurb: "",
    byline: "",
    length: "One shot",
    start: roomId,
    rooms: {
      [roomId]: {
        name: "WHERE IT BEGINS",
        look: "",
        exits: [],
        features: {},
      },
    },
    endings: {},
  };
}

/**
 * Open something for editing.
 *
 * Accepts an envelope, a bare module, or a module already defined by
 * the engine — the last of which is how "fork Ypsilon 14" works, and
 * is lossy in exactly the way `toPortable` documents. The refusal
 * shape matches `readPortableModule` so a caller has one error path.
 *
 * @returns {{ok: true, raw: object} | {ok: false, error: string, detail?: string[]}}
 */
export function draftFrom(input) {
  const read = readPortableModule(input);
  if (!read.ok) return read;

  /* The DEFINED module is not what we want to edit — it carries the
     engine's defaults, an auto-generated map, a derived director and
     a coverage report, none of which the author wrote. Editing those
     would mean an author who opens a module and saves it without
     touching anything has just adopted every default as their own
     explicit choice. So we edit the input. */
  let raw = typeof input === "string" ? JSON.parse(input) : copy(input);
  if (raw && raw.kind === PMOD_KIND) raw = raw.module;
  return { ok: true, raw: copy(raw) };
}

/**
 * What the engine will say about this, right now.
 *
 * The same call the shelf makes, which is the entire point: there is
 * no second opinion here and no editor-specific linting. `ok` means
 * the file would load; `problems` means the library card would refuse
 * to start it; `coverage` is the report from `coverage.js`, which is
 * not correctness and must never be rendered as though it were.
 *
 * Never throws. An editor that crashes on a keystroke is worse than
 * one that says nothing.
 */
export function compile(raw) {
  const read = readPortableModule(raw);
  if (!read.ok) {
    return {
      ok: false, mod: null,
      problems: [read.error, ...(read.detail || [])],
      warnings: [], coverage: [],
    };
  }
  const mod = read.mod;
  return {
    ok: (mod.problems || []).length === 0,
    mod,
    problems: mod.problems || [],
    warnings: mod.warnings || [],
    coverage: mod.coverage || [],
  };
}

/* ---------------- rooms ---------------- */

export const roomIds = (raw) => Object.keys((raw && raw.rooms) || {});

/** A room id not already taken, derived from what was typed. */
export function freeRoomId(raw, wanted) {
  const base = slug(wanted);
  const taken = new Set(roomIds(raw));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 200; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

export function addRoom(raw, name = "NEW ROOM") {
  const id = freeRoomId(raw, name);
  const next = copy(raw);
  next.rooms = { ...(next.rooms || {}), [id]: { name, look: "", exits: [], features: {} } };
  /* A module with no `start` is a module that will not load, and the
     first room somebody adds to an empty draft is obviously it. */
  if (!next.start) next.start = id;
  return { raw: next, id };
}

export function setRoom(raw, id, patch) {
  if (!raw.rooms || !raw.rooms[id]) return raw;
  const next = copy(raw);
  next.rooms[id] = { ...next.rooms[id], ...patch };
  return next;
}

/**
 * Remove a room, and every declaration that pointed at it.
 *
 * Deliberately NOT a silent delete of the key. An exit to a room that
 * no longer exists is a `problem` on the card, so leaving them would
 * turn one deliberate deletion into three errors the author has to
 * hunt down — and the commonest way an editor teaches somebody to
 * distrust it is by breaking something in a place they were not
 * looking.
 *
 * Refuses to remove the last room: a module with no rooms is not a
 * smaller module, it is a broken one.
 */
export function removeRoom(raw, id) {
  const ids = roomIds(raw);
  if (ids.length <= 1 || !raw.rooms[id]) return raw;

  const next = copy(raw);
  delete next.rooms[id];

  for (const r of Object.values(next.rooms)) {
    if (Array.isArray(r.exits)) r.exits = r.exits.filter((e) => String(e.to) !== id);
  }
  /* Somebody has to be the start room. The lowest remaining id is
     arbitrary, and it is stated on the screen rather than assumed. */
  if (next.start === id) next.start = Object.keys(next.rooms)[0];

  for (const n of Object.values(next.npcs || {})) if (n && n.start === id) delete n.start;
  for (const t of Object.values(next.threats || {})) {
    if (t && t.start === id) delete t.start;
    if (t && t.retreatTo === id) delete t.retreatTo;
  }
  if (Array.isArray(next.restSpots)) next.restSpots = next.restSpots.filter((r) => r !== id);
  if (next.map && next.map.pos) delete next.map.pos[id];

  /* Effects are the deep case. A `moveTo` pointing at a room that has
     gone is a problem the author cannot see from any screen, because
     it might be four levels inside a gate's routes. */
  retarget(next, id, null);
  return next;
}

/**
 * Rename a room and follow every reference. See the header — this is
 * the operation the file exists for.
 *
 * Returns the draft unchanged if the new id is taken or empty, rather
 * than merging two rooms into one. Merging is a thing an author might
 * want and is never a thing they meant by typing in an id field.
 */
export function renameRoom(raw, from, to) {
  /* Guarded BEFORE slugging. `slug` falls back to "untitled" so that
     nothing downstream ever holds an empty key, which is right for
     creating a room and wrong here: an author who clears the id field
     has not asked for a room called "untitled", they have asked for
     nothing to happen yet. */
  if (!String(to || "").trim()) return raw;
  const id = slug(to);
  if (!raw.rooms || !raw.rooms[from]) return raw;
  if (!id || id === from || raw.rooms[id]) return raw;

  const next = copy(raw);

  /* Key order is what the map's auto-layout walks and what the room
     list shows, so a rename must not send a room to the end of the
     list. Rebuilt in place rather than deleted and re-added. */
  next.rooms = Object.fromEntries(
    Object.entries(next.rooms).map(([k, v]) => [k === from ? id : k, v]),
  );

  for (const r of Object.values(next.rooms)) {
    (r.exits || []).forEach((e) => { if (String(e.to) === from) e.to = id; });
  }
  if (next.start === from) next.start = id;
  for (const n of Object.values(next.npcs || {})) if (n && n.start === from) n.start = id;
  for (const t of Object.values(next.threats || {})) {
    if (t && t.start === from) t.start = id;
    if (t && t.retreatTo === from) t.retreatTo = id;
  }
  if (Array.isArray(next.restSpots)) {
    next.restSpots = next.restSpots.map((r) => (r === from ? id : r));
  }
  if (next.map && next.map.pos && next.map.pos[from]) {
    next.map.pos[id] = next.map.pos[from];
    delete next.map.pos[from];
  }
  retarget(next, from, id);
  return next;
}

/**
 * Every room reference buried in the effect tree, repointed.
 *
 * `null` means the room is gone, and the key is deleted rather than
 * left dangling. Walks the whole object because effects are reachable
 * from about a dozen places (see `allEffectSites` in defineModule.js)
 * and enumerating them here would be a second list to keep in step
 * with that one.
 */
function retarget(node, from, to, depth = 0) {
  if (!node || typeof node !== "object" || depth > 24) return;
  if (Array.isArray(node)) { node.forEach((n) => retarget(n, from, to, depth + 1)); return; }

  if (node.moveTo === from) {
    if (to) node.moveTo = to; else delete node.moveTo;
  }
  /* `npc: { loc }` and `threat: { loc }` move somebody into a room,
     which is a room reference wearing a different key. */
  for (const k of ["npc", "threat"]) {
    if (node[k] && typeof node[k] === "object" && node[k].loc === from) {
      if (to) node[k].loc = to; else delete node[k].loc;
    }
  }
  for (const v of Object.values(node)) retarget(v, from, to, depth + 1);
}

/* ---------------- exits ---------------- */

/**
 * Join two rooms.
 *
 * Two-way by default, and that is the interesting decision. A
 * one-way exit is a real and useful thing — a drop, a door that
 * locks behind you — but it is a deliberate one, and an editor whose
 * default strands the crew produces modules whose commonest bug is a
 * room you cannot leave. So the default is the reversible one and
 * `back: false` is the choice.
 *
 * An exit to an ending is written `@id` and is never reversed,
 * because an ending has no rooms in it to come back from.
 */
export function link(raw, from, to, { back = true, label } = {}) {
  if (!raw.rooms || !raw.rooms[from]) return raw;
  const ending = String(to).startsWith("@");
  if (!ending && !raw.rooms[to]) return raw;

  const next = copy(raw);
  const nameOf = (id) => (next.rooms[id] && next.rooms[id].name) || id;

  const add = (a, b) => {
    const room = next.rooms[a];
    room.exits = room.exits || [];
    if (room.exits.some((e) => String(e.to) === String(b))) return;
    room.exits.push({ to: b, label: label || (String(b).startsWith("@") ? "Leave" : nameOf(b)) });
  };

  add(from, to);
  if (back && !ending) add(to, from);
  return next;
}

export function setExit(raw, id, index, patch) {
  const room = raw.rooms && raw.rooms[id];
  if (!room || !room.exits || !room.exits[index]) return raw;
  const next = copy(raw);
  next.rooms[id].exits[index] = { ...next.rooms[id].exits[index], ...patch };
  return next;
}

export function removeExit(raw, id, index) {
  const room = raw.rooms && raw.rooms[id];
  if (!room || !room.exits || !room.exits[index]) return raw;
  const next = copy(raw);
  next.rooms[id].exits.splice(index, 1);
  return next;
}

/* ---------------- endings ---------------- */

export function addEnding(raw, name = "OUT") {
  const id = (() => {
    const base = slug(name);
    const taken = new Set(Object.keys(raw.endings || {}));
    if (!taken.has(base)) return base;
    for (let n = 2; n < 200; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
    return `${base}-${Date.now().toString(36)}`;
  })();
  const next = copy(raw);
  next.endings = { ...(next.endings || {}), [id]: { title: name, text: "" } };
  return { raw: next, id };
}

export function removeEnding(raw, id) {
  if (!raw.endings || !raw.endings[id]) return raw;
  const next = copy(raw);
  delete next.endings[id];
  for (const r of Object.values(next.rooms || {})) {
    if (Array.isArray(r.exits)) r.exits = r.exits.filter((e) => String(e.to) !== `@${id}`);
  }
  return next;
}

/* ---------------- the raw escape hatch ---------------- */

/**
 * Replace one room wholesale from typed JSON.
 *
 * The forms above cover prose, exits and structure, which is most of
 * what a module is. They do not cover effects, gates, device actions,
 * tables or countdowns, and they should not try: those are the parts
 * of the DSL where the shape genuinely matters, and a form that
 * half-covers them produces modules whose authors cannot tell what
 * they have written.
 *
 * So the deep parts stay typed, validated on every keystroke by the
 * same compile everything else goes through. That is a worse
 * experience than a form and a much better one than a text editor
 * with no validation at all, which is the honest alternative.
 */
export function setRoomJson(raw, id, text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { return { ok: false, error: `That isn't valid JSON: ${e.message}` }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return { ok: false, error: "A room has to be a JSON object." };
  const next = copy(raw);
  next.rooms[id] = parsed;
  return { ok: true, raw: next };
}

/* ---------------- in and out ---------------- */

/** The envelope, ready to write to a file or hand to `installModule`. */
export function toEnvelope(raw, { author = "", pretty = true } = {}) {
  return JSON.stringify({
    kind: PMOD_KIND,
    v: PMOD_VERSION,
    author,
    exported: Date.now(),
    module: raw,
  }, null, pretty ? 2 : 0);
}

/* ---------------- persistence ----------------

   Autosaved, and the reason is blunt: the commonest way to lose an
   hour of writing is closing a tab. It is one draft rather than a
   list, because a list is a file manager and this is not one — an
   author who wants a second module exports the first and starts
   again, which is also how they get a backup. */

export function saveDraft(raw) {
  if (!ok()) return false;
  try {
    localStorage.setItem(DRAFT, JSON.stringify({ v: DRAFT_VERSION, at: Date.now(), raw }));
    return true;
  } catch { return false; }
}

export function loadDraft() {
  if (!ok()) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (!stored || !stored.raw || typeof stored.raw !== "object") return null;
    return { raw: stored.raw, at: stored.at || 0 };
  } catch { return null; }
}

export function clearDraft() {
  if (!ok()) return false;
  try { localStorage.removeItem(DRAFT); return true; } catch { return false; }
}
