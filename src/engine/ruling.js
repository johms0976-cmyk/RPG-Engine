/* ============================================================
   RULINGS — the thing the module did not anticipate, written
   down so it stays true.

   `director.js` names this gap in its own header and is right to:

     "Not an improviser. A Warden rewards the clever idea the
      module never anticipated. This cannot ... What it does
      instead is answer with the oracle and a complication, and
      the fiction does not update."

   The last clause is the expensive half, and it is expensive
   even at tables that *have* a Warden, which is most of them.
   A player asks whether the ceiling panel comes down. The
   Warden says yes, it is on four wing-nuts and one is missing.
   Right now that sentence goes in the feed and then it is gone:

     · `answerLook` does not know the panel exists, so ten
       minutes later "look at the ceiling panel" returns MISS
       and the room contradicts the Warden.
     · the parser cannot match it, so nobody can interact with
       the thing they were just told about.
     · a save and reload loses it entirely.
     · the transcript has it as one line of chat rather than as
       a fact about the ship.

   So the table learns, quickly and without ever discussing it,
   that things the Warden invents are less real than things the
   module shipped. That is a bad lesson and it is the software
   teaching it.

   ------------------------------------------------------------
   THIS IS NOT AN IMPROVISER EITHER

   Nothing here writes a sentence. `commitRuling` takes a string
   a human typed and stores it. INV-1 is untouched and this file
   deliberately has no pools, no tables and no `rng` — if it ever
   grows one, it has become the thing the repo refused to build.

   What changes is *durability*, not authorship. The Warden was
   already improvising; they were doing it into a chat log.

   ------------------------------------------------------------
   WHY IT IS A SEPARATE STORE AND NOT A PATCHED MODULE

   The tempting implementation is to write the new feature
   straight into `mod.rooms[x].features`. Three reasons not to:

     1. THE MODULE IS SHARED AND THE RULING IS NOT. Two tables
        running Ypsilon 14 have one module object and different
        evenings. Mutating the module makes one table's ceiling
        panel appear in the other's — which is exactly the class
        of bug that is invisible in testing and obvious in
        production.

     2. A RULING CAN BE WRONG. Rulings get retired. Unpicking a
        mutation from a nested module object is guesswork;
        dropping an entry from a list is not.

     3. PROVENANCE IS THE POINT. A Warden reading the session
        back wants to know which facts the author wrote and
        which the table made up at 11pm. Merged into the module,
        that distinction is destroyed permanently.

   So: a flat, append-mostly list on the world, merged at read
   time by whoever is answering a question.

   ------------------------------------------------------------
   THE REDACTION TRAP

   INV-6's warning about the director applies here doubled. A
   ruling made in a whisper to one player — "you and only you
   notice the second set of prints" — is a secret, and the
   default for anything landing on a shared screen must be that
   it is not published. `visible()` takes the viewer, every read
   path goes through it, and a ruling with a `told` list is
   invisible to everyone outside it *including the table view*.

   The safe default is the private one only where the Warden
   asked for private. A ruling with no `told` is public, because
   the overwhelming majority of rulings are the Warden answering
   out loud and making them secret-by-default would train Wardens
   to ignore the control.
   ============================================================ */

export const RULING_VERSION = 1;

/** Where a ruling attaches, and therefore who reads it back. */
export const SCOPE = {
  /** A room. Appended to that room's description on every look. */
  ROOM: "room",
  /** A named thing — a feature, an object, a body. Answers a look
      addressed at that name, in the room it was made in. */
  THING: "thing",
  /** A standing fact about the fiction with no location. Shows on
      the Warden's dossier and in the transcript, and answers
      nothing on its own. */
  WORLD: "world",
};

export const SCOPE_LABEL = {
  [SCOPE.ROOM]: "about this room",
  [SCOPE.THING]: "about one thing",
  [SCOPE.WORLD]: "a standing fact",
};

/** Long enough to be a fact, short enough to be read aloud. */
export const MAX_RULING = 400;

export const RULING_ERRORS = {
  EMPTY: "A ruling needs a sentence.",
  LONG: `Keep it under ${MAX_RULING} characters — this gets read out.`,
  NO_SUBJECT: "A ruling about one thing needs the thing's name.",
  NO_ROOM: "A ruling about a room needs a room.",
};

let SEQ = 0;
const newId = () => `rul${++SEQ}_${Math.random().toString(36).slice(2, 7)}`;

/** Names are matched loosely because they are typed twice by two
    different people — once by the Warden making the ruling and once
    by the player asking about it. */
export const normaliseSubject = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Build a ruling. Pure — validates and returns, touches no state.
 *
 * @param {object} spec
 * @param {string} spec.text     the human's own sentence. Stored verbatim.
 * @param {string} [spec.scope]  one of SCOPE. Defaults to ROOM.
 * @param {string} [spec.room]   room id. Required for ROOM and THING.
 * @param {string} [spec.subject] the thing's name. Required for THING.
 * @param {string} [spec.by]     who made it — a pcId, or "warden", or
 *                               "table" when a wardenless vote carried it.
 * @param {string[]|null} [spec.told] pcIds this is private to. null = public.
 * @param {number} [spec.clock]  fiction clock, for the transcript.
 * @param {number} [spec.at]     wall clock.
 * @returns {{ruling:object}|{error:string}}
 */
export function makeRuling(spec = {}) {
  const text = String(spec.text || "").trim();
  if (!text) return { error: RULING_ERRORS.EMPTY };
  if (text.length > MAX_RULING) return { error: RULING_ERRORS.LONG };

  const scope = spec.scope || SCOPE.ROOM;
  if ((scope === SCOPE.ROOM || scope === SCOPE.THING) && !spec.room) {
    return { error: RULING_ERRORS.NO_ROOM };
  }
  if (scope === SCOPE.THING && !normaliseSubject(spec.subject)) {
    return { error: RULING_ERRORS.NO_SUBJECT };
  }

  return {
    ruling: {
      v: RULING_VERSION,
      id: newId(),
      scope,
      text,
      room: spec.room || null,
      subject: scope === SCOPE.THING ? String(spec.subject).trim() : null,
      key: scope === SCOPE.THING ? normaliseSubject(spec.subject) : null,
      by: spec.by || "warden",
      told: Array.isArray(spec.told) && spec.told.length ? [...spec.told] : null,
      clock: spec.clock ?? 0,
      at: spec.at ?? Date.now(),
      retired: false,
    },
  };
}

/** Append. Returns a new world; never mutates. */
export function commitRuling(w, ruling) {
  return { ...w, rulings: [...(w.rulings || []), ruling] };
}

/**
 * Retire, rather than delete.
 *
 * A Warden who rules that the door is welded and then remembers the
 * module already said otherwise needs the fact to stop being true
 * without the record of having said it disappearing — because the
 * players heard it, and a transcript that quietly loses the thing
 * six people reacted to is worse than one that shows the correction.
 */
export function retireRuling(w, id, why = null) {
  return {
    ...w,
    rulings: (w.rulings || []).map((r) =>
      r.id === id ? { ...r, retired: true, retiredWhy: why, retiredAt: Date.now() } : r),
  };
}

/**
 * Can this viewer see this ruling?
 * @param {object} r
 * @param {string|null} viewerPcId  null means the Warden or the shared
 *                                  table screen — see below.
 * @param {boolean} isWarden        the Warden sees everything.
 */
export function visible(r, viewerPcId, isWarden = false) {
  if (!r || r.retired) return false;
  if (isWarden) return true;
  if (!r.told) return true;
  return !!viewerPcId && r.told.includes(viewerPcId);
}

/**
 * Everything this viewer can see, newest last.
 * The shared table screen passes `viewerPcId = null` and
 * `isWarden = false`, which correctly hides every private ruling —
 * the table view is a screen the whole room reads.
 */
export function rulingsFor(w, { viewerPcId = null, isWarden = false, room = null, scope = null } = {}) {
  return (w.rulings || []).filter((r) => {
    if (!visible(r, viewerPcId, isWarden)) return false;
    if (scope && r.scope !== scope) return false;
    if (room && r.scope !== SCOPE.WORLD && r.room !== room) return false;
    return true;
  });
}

/**
 * The lines to append to a room description. This is the hook that
 * makes a ruling as real as a module's own prose: `answerLook` calls
 * it, so the ceiling panel is still there ten minutes later.
 */
export function roomAddendum(w, roomId, opts = {}) {
  return rulingsFor(w, { ...opts, room: roomId, scope: SCOPE.ROOM }).map((r) => r.text);
}

/**
 * A ruling that answers a look addressed at a name. Returns the
 * newest match, because the most recent thing the Warden said about
 * the panel is the true one.
 */
export function thingAnswer(w, roomId, about, opts = {}) {
  const key = normaliseSubject(about);
  if (!key) return null;
  const pool = rulingsFor(w, { ...opts, room: roomId, scope: SCOPE.THING });
  const hit = pool.filter((r) => r.key === key || r.key.includes(key) || key.includes(r.key));
  return hit.length ? hit[hit.length - 1] : null;
}

/**
 * Names the parser should now recognise in this room.
 *
 * This is the part that turns a stored sentence into something a
 * player can *act on*. `look.js` scores a player's phrase against
 * the room's feature keys; feeding it the subjects of this room's
 * rulings means "pull the ceiling panel" stops returning MISS the
 * moment the Warden says the panel is there.
 */
export function rulingNouns(w, roomId, opts = {}) {
  return rulingsFor(w, { ...opts, room: roomId, scope: SCOPE.THING })
    .map((r) => r.subject)
    .filter(Boolean);
}

/**
 * The Warden's own list, including retired ones, newest first.
 * Retired entries are kept visible on this screen and only this
 * screen — the person who made the mistake is the person who needs
 * to see it.
 */
export function wardenLedger(w) {
  return [...(w.rulings || [])].reverse();
}

/**
 * Markdown for `transcript.js`. Rulings are gathered into their own
 * section rather than interleaved, because their value on a reread
 * is precisely that they are the table's inventions and a reader
 * wants them in one place.
 *
 * Private rulings are included only when the transcript being built
 * is the Warden's. A player's copy is built from their own feed and
 * gets their own rulings, which is the same bargain `endcard.js`
 * already makes.
 */
export function rulingsMarkdown(w, { viewerPcId = null, isWarden = false } = {}) {
  const all = rulingsFor(w, { viewerPcId, isWarden });
  const retired = isWarden ? (w.rulings || []).filter((r) => r.retired) : [];
  if (!all.length && !retired.length) return "";

  const line = (r) => {
    const where = r.scope === SCOPE.WORLD ? "everywhere"
      : r.scope === SCOPE.THING ? `${r.subject} · ${r.room}`
      : r.room;
    const priv = r.told ? " _(privately)_" : "";
    return `- **${where}** — ${r.text}${priv}`;
  };

  let out = "\n## Rulings made at the table\n\n";
  out += "_Facts the module did not ship. Somebody at this table decided these were true._\n\n";
  out += all.map(line).join("\n");
  if (retired.length) {
    out += "\n\n### Taken back\n\n";
    out += retired.map((r) => `- ~~${r.text}~~${r.retiredWhy ? ` — ${r.retiredWhy}` : ""}`).join("\n");
  }
  return `${out}\n`;
}

/**
 * Old saves have no `rulings` key. Everything above tolerates that,
 * but the world is written once at load and it is cheaper to have
 * the field than to defend against its absence in six places.
 */
export const upgradeWorld = (w) => (w && w.rulings ? w : { ...w, rulings: [] });
