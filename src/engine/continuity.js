/* ============================================================
   CONTINUITY — what a table invented, kept.

   ------------------------------------------------------------
   THE GAP THIS CLOSES

   `campaign.js` records who was on the crew, what they survived,
   and how long it took. All true, all useful, and none of it is
   what a returning table actually remembers.

   What they remember is *the airlock on Ypsilon still does not
   seal*. Somebody made that up in week one, everybody agreed, and
   by week three it is simply a fact about the ship — as real to
   them as anything in the module, and considerably more theirs.

   `ruling.js` already makes that durable WITHIN a session, and
   since 2.17 `tableRuling.js` lets a wardenless table make them
   too. But the world is discarded when the session ends and the
   campaign ledger never sees one. So a table's own inventions
   have a lifetime of a single evening, which is exactly one
   evening shorter than the thing they are for.

   (Not to be confused with `engine/lore.js`, which indexes the
   AUTHOR's material so a Warden can search it mid-scene. That is
   the module's fiction made findable; this is the table's own
   fiction made durable. Opposite directions.)

   ------------------------------------------------------------
   IT IS STILL A LEDGER

   `campaign.js` states its own rule and this file gets no
   exemption: *a campaign records what happened; it does not
   participate.* Nothing here is read by a rung, no module can
   gate on it, and a session started inside a campaign is
   byte-identical to one started outside.

   So carrying facts forward is OFFERED, never automatic. At the
   start of a session the table is shown what they invented last
   time and chooses what is still true. That choice is the whole
   design, for three reasons:

     · A fact invented in Ypsilon's mine is often nonsense on a
       different ship. "The grille in the workspace is painted
       over" does not travel.
     · A table's memory is the authority on their own fiction, not
       a storage layer. Software that silently reinstates
       something they had forgotten is overruling them about their
       own game.
     · Six months on they will not remember which of forty facts
       they meant, and forty auto-applied facts is not continuity,
       it is clutter.

   Carrying nothing forward is a normal outcome and is one tap.

   ------------------------------------------------------------
   INV-1 IS UNTOUCHED, AGAIN

   Every string here was typed by a person at a table and is
   stored, read back and re-offered verbatim. This file selects,
   filters and copies. No pools, no templates, no rng — for the
   same reason `ruling.js` and `tableRuling.js` have none.
   ============================================================ */

import { SCOPE } from "./ruling.js";

export const CONTINUITY_VERSION = 1;

/** How many facts a table is shown at the top of a session.
 *
 *  Twenty is a screen you read. Forty is a screen you scroll past
 *  and tap "all" on without reading, which produces continuity
 *  nobody chose and is worse than none. Past the limit the most
 *  recent survive: a fact invented last week is likelier to still
 *  matter than one from the first session. */
export const CARRY_LIMIT = 20;

/**
 * Pull the keepable facts out of a finished world.
 *
 * Three filters, each a judgement about what "keepable" means:
 *
 *  · RETIRED ONES ARE DROPPED. A retired ruling is a fact the
 *    table took back. Carrying it forward would reinstate
 *    something they explicitly withdrew.
 *
 *  · PRIVATE ONES ARE DROPPED. A ruling with `told` was the
 *    Warden telling one player something the others must not
 *    hear. That is a secret with a lifetime of one scene, and a
 *    campaign ledger the whole table reads is the last place for
 *    it.
 *
 *  · THE MODULE TRAVELS WITH THE FACT. A fact about room `work`
 *    is meaningful only in a module that has a `work`, so the id
 *    is stamped on and `offerable` uses it.
 */
export function harvest(w, { modId = "" } = {}) {
  const rulings = (w && Array.isArray(w.rulings) ? w.rulings : []).filter(Boolean);
  return rulings
    .filter((r) => !r.retired)
    .filter((r) => !(r.told && r.told.length))
    .map((r) => ({
      v: CONTINUITY_VERSION,
      text: r.text,
      scope: r.scope || SCOPE.ROOM,
      room: r.room || null,
      subject: r.subject || null,
      /* WHO MADE IT TRUE, kept because it reads differently
         later. "The table decided this" and "the Warden ruled
         this" are different kinds of fact to a group looking
         back, and the second has an author who can be asked. */
      by: r.by || "warden",
      modId,
      at: r.at || Date.now(),
    }));
}

/** Append to a campaign's facts, newest last, de-duplicated on
 *  the sentence itself. A table that invents the same fact in two
 *  sessions has confirmed it, not created two of them. */
export function addFacts(campaign, entries) {
  const have = campaign && Array.isArray(campaign.facts) ? campaign.facts : [];
  const seen = new Set(have.map((l) => String(l.text).trim().toLowerCase()));
  const fresh = (entries || []).filter((e) => {
    const k = String(e.text).trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return [...have, ...fresh];
}

/**
 * What to offer a table starting a session.
 *
 * WORLD-scoped facts travel everywhere: "the Company pays late"
 * is true wherever you go. ROOM and THING facts come back only in
 * the module they were invented in, because a fact about a room
 * that does not exist here cannot be about anything.
 */
export function offerable(campaign, modId) {
  const facts = (campaign && campaign.facts) || [];
  return facts
    .filter((l) => l.scope === SCOPE.WORLD || l.modId === modId)
    .slice(-CARRY_LIMIT);
}

/** Turn chosen facts back into rulings on a fresh world. The
 *  shape matches `makeRuling`'s output because `roomAddendum`,
 *  `thingAnswer` and `rulingNouns` all read these directly. */
export function seedWorld(w, chosen, now = Date.now()) {
  const picked = (chosen || []).filter(Boolean);
  if (!picked.length) return w;
  const rulings = picked.map((l, i) => ({
    v: 1,
    id: `carried${i}_${String(l.at || 0).slice(-5)}`,
    scope: l.scope || SCOPE.ROOM,
    text: l.text,
    room: l.room || null,
    subject: l.subject || null,
    key: l.subject
      ? String(l.subject).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
      : null,
    /* CARRIED, not re-made. The transcript should say this came
       from a previous session rather than implying somebody
       invented it thirty seconds ago. */
    by: "carried",
    told: null,
    clock: 0,
    at: now,
    retired: false,
  }));
  return { ...w, rulings: [...(w.rulings || []), ...rulings] };
}

/* ============================================================
   EXPORT AS A MODULE FRAGMENT

   A table that has played Ypsilon three times has, by the third,
   a version of Ypsilon that is theirs. This writes it down in the
   only format that makes it reusable: module source.

   It emits a `listeners` array rather than patching rooms, and
   that choice is the interesting one. Patching a room's `look`
   would mean rewriting authored prose, which is somebody else's
   work and not ours to edit. A listener adds a voice without
   touching anything — it fires when a player mentions the thing,
   says the table's own sentence, and leaves the module exactly as
   its author wrote it.

   The output is a file a person reads and edits before using. It
   is deliberately not auto-loadable: a table's private jokes and
   half-finished ideas are in here, and a fragment that installed
   itself would drag all of it into the next campaign unread.
   ============================================================ */

/** Words worth listening for, taken from the fact itself. Nouns
 *  are approximated as "words the table bothered to type that are
 *  not furniture" — crude, and meant to be, because the output is
 *  edited by a human before it is used. */
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "it", "its", "this", "that", "these", "those", "there", "here", "of", "in", "on",
  "at", "to", "for", "with", "from", "by", "as", "has", "have", "had", "not", "no",
  "you", "your", "they", "them", "their", "we", "our", "if", "when", "still", "does",
  "do", "did", "can", "will", "would", "one", "two", "all", "any", "some", "up", "down",
]);

function phrasesFrom(entry) {
  if (entry.subject) return [String(entry.subject).toLowerCase()];
  const words = String(entry.text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((x) => x.length > 3 && !STOP.has(x));
  /* Two is specific enough to be useful and few enough to stay
     editable by hand. */
  return [...new Set(words)].slice(0, 2);
}

const q = (s) => JSON.stringify(String(s));

/**
 * @returns {string} JavaScript source for a module fragment.
 */
export function toFragment(campaign, { modId = "", title = "" } = {}) {
  const facts = ((campaign && campaign.facts) || []).filter(
    (l) => !modId || l.modId === modId || l.scope === SCOPE.WORLD,
  );
  const name = (campaign && campaign.name) || "this table";
  const sessions = ((campaign && campaign.sessions) || []).length;

  const head = [
    "/* ============================================================",
    `   ${String(title || modId || "MODULE").toUpperCase()} — as ${name} plays it`,
    "",
    `   ${facts.length} fact${facts.length === 1 ? "" : "s"} this table made true across`,
    `   ${sessions} session${sessions === 1 ? "" : "s"}, exported from their campaign record.`,
    "",
    "   READ THIS BEFORE USING IT. Everything below was typed at a",
    "   table mid-session, which means some of it is considered",
    "   world-building and some of it is a joke that was funny at",
    "   eleven at night. Only you know which.",
    "",
    "   Each entry is a listener: it fires when somebody mentions",
    "   the thing and says the table's own sentence back. Nothing",
    "   here edits the module's own prose — that is its author's",
    "   work, and a fragment that rewrote it would be replacing",
    "   their module with yours.",
    "",
    "   Merge into a module's `director.listeners`. Module-specific",
    "   listeners win over the common pack; these behave the same.",
    "   ============================================================ */",
    "",
    "export const listeners = [",
  ];

  const body = facts.map((l, i) => [
    `  {`,
    `    id: ${q(`carried_${i}`)},`,
    `    phrases: [${phrasesFrom(l).map(q).join(", ")}],`,
    l.room ? `    when: ${q(`room:${l.room}`)},` : null,
    `    effects: [{ say: ${q(l.text)}, tone: "warden" }],`,
    `  },`,
  ].filter(Boolean).join("\n"));

  return [...head, ...body, "];", ""].join("\n");
}

export default { harvest, addFacts, offerable, seedWorld, toFragment };
