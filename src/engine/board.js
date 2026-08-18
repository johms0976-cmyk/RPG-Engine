/* ============================================================
   THE BOARD — what the crew knows, and what they have scrawled
   on the map.

   Two separate problems that share a shape.

   Clues: the feed is 400 lines deep by hour three and players
   have forgotten the code they found in hour one. A running log
   is not a record. This is the pinboard: short, pinned, sorted,
   and never auto-scrolled away.

   Marks: every real table draws on the map. "DON'T GO IN HERE"
   written across a room in shared pen does more for a session
   than any amount of fog-of-war fidelity. Marks are player-owned
   and public — the crew's reasoning made visible to the crew.
   ============================================================ */

let SEQ = 0;
const uid = (p) => `${p}${++SEQ}_${Math.random().toString(36).slice(2, 6)}`;

/* ---------------- clues ---------------- */

export const CLUE_KINDS = {
  fact: { label: "Fact", blurb: "Something established." },
  code: { label: "Code", blurb: "A number, a password, a door." },
  name: { label: "Name", blurb: "A person, a ship, a company." },
  lead: { label: "Lead", blurb: "Somewhere to go, something to try." },
  warn: { label: "Warning", blurb: "Something that hurt somebody." },
};

export function makeClue({ text, kind = "fact", room, by, clock = 0, secret = false }) {
  return {
    id: uid("clue"),
    text: String(text).slice(0, 240),
    kind: CLUE_KINDS[kind] ? kind : "fact",
    room: room || null,
    by: by || null,
    clock,
    at: Date.now(),
    secret: !!secret,
    resolved: false,
  };
}

export const addClue = (clues, clue) => [...(clues || []), clue];
export const resolveClue = (clues, id, resolved = true) =>
  (clues || []).map((c) => (c.id === id ? { ...c, resolved } : c));
export const dropClue = (clues, id) => (clues || []).filter((c) => c.id !== id);

/** Open clues first, newest first within that. Warden-only clues are
    filtered out for players before this is ever called. */
export function sortClues(clues) {
  return [...(clues || [])].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.clock - a.clock;
  });
}

export const visibleClues = (clues, isWarden) =>
  sortClues((clues || []).filter((c) => isWarden || !c.secret));

/* ---------------- threads ----------------

   The board answers "what do we know". It could not answer "and
   what has that got to do with the other thing", which is the
   entire activity a conspiracy board exists for. A thread is two
   clue ids and an optional word for why.

   Threads are undirected: linking A to B is the same as linking B
   to A, and the board must never grow two lines between the same
   pair because somebody dragged it the other way round. */

const pairKey = (a, b) => [a, b].sort().join("::");

export function makeLink({ a, b, note }) {
  return { id: uid("link"), a, b, note: note ? String(note).slice(0, 60) : null, at: Date.now() };
}

export const linkExists = (links, a, b) =>
  (links || []).some((l) => pairKey(l.a, l.b) === pairKey(a, b));

export function addLink(links, a, b, note) {
  if (!a || !b || a === b || linkExists(links, a, b)) return links || [];
  return [...(links || []), makeLink({ a, b, note })];
}

export const dropLink = (links, id) => (links || []).filter((l) => l.id !== id);

/** Every thread touching this clue. */
export const linksFor = (links, clueId) =>
  (links || []).filter((l) => l.a === clueId || l.b === clueId);

/** A thread is spent when both ends are resolved — it dims rather
    than disappearing, because the shape of a solved case is worth
    keeping on the wall. */
export function linkState(link, clues) {
  const find = (id) => (clues || []).find((c) => c.id === id);
  const a = find(link.a); const b = find(link.b);
  if (!a || !b) return "broken";
  if (a.resolved && b.resolved) return "spent";
  return "live";
}

/** Drop any thread whose clue has gone. Called wherever a clue is
    unpinned, so the board cannot accumulate lines to nowhere. */
export const pruneLinks = (links, clues) =>
  (links || []).filter((l) => linkState(l, clues) !== "broken");

/** Cheap duplicate guard — players re-pin the same code constantly. */
export function isDuplicateClue(clues, text) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const n = norm(text);
  return (clues || []).some((c) => norm(c.text) === n);
}

/* ---------------- marks ---------------- */

export const MARK_KINDS = {
  danger: { label: "Danger", glyph: "!", blurb: "Something here hurt us." },
  safe: { label: "Clear", glyph: "✓", blurb: "We checked. It's fine." },
  locked: { label: "Locked", glyph: "⌗", blurb: "Sealed, needs something." },
  loot: { label: "Gear", glyph: "◆", blurb: "Worth coming back for." },
  note: { label: "Note", glyph: "?", blurb: "Anything else." },
};

export function makeMark({ room, kind = "note", text = "", by, byName, clock = 0 }) {
  return {
    id: uid("mark"),
    room,
    kind: MARK_KINDS[kind] ? kind : "note",
    text: String(text).slice(0, 60),
    by: by || null,
    byName: byName || null,
    clock,
    at: Date.now(),
  };
}

export const addMark = (marks, mark) => [...(marks || []), mark];
export const dropMark = (marks, id) => (marks || []).filter((m) => m.id !== id);

/** Only the author or the Warden may rub one out — otherwise the crew
    spends the session deleting each other's warnings. */
export function canRemoveMark(mark, { pcId, isWarden }) {
  return !!isWarden || (!!pcId && mark.by === pcId);
}

export const marksIn = (marks, roomId) => (marks || []).filter((m) => m.room === roomId);

/** One glyph per room for the map layer: the loudest mark wins, so a
    room with a danger flag and three notes still reads as danger. */
const PRIORITY = ["danger", "locked", "loot", "safe", "note"];
export function markSummary(marks) {
  const byRoom = {};
  for (const m of marks || []) {
    const cur = byRoom[m.room];
    if (!cur || PRIORITY.indexOf(m.kind) < PRIORITY.indexOf(cur.kind)) {
      byRoom[m.room] = { kind: m.kind, count: 1, glyph: MARK_KINDS[m.kind].glyph };
    } else {
      cur.count += 1;
    }
  }
  for (const room of Object.keys(byRoom)) {
    byRoom[room].count = (marks || []).filter((m) => m.room === room).length;
  }
  return byRoom;
}
