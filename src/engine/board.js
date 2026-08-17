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
