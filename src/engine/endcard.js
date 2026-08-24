/* ============================================================
   THE END CARD — B.5

   The full transcript already exists and is the right artefact for
   somebody who wants to reread the evening. It is the wrong one
   for the thing people actually do at the end of a session, which
   is send one message to a group chat.

   Nobody pastes four thousand words of markdown. They say "Riley
   made it" or "I got eaten in the vents in the first hour", and
   that message is how a one-off becomes a second session — it is
   the only artefact of the evening that reaches the people who
   were not at it.

   ------------------------------------------------------------
   NOTHING HERE IS WRITTEN

   Every line on the card is either a fact from the world state or
   a sentence lifted verbatim from the feed. INV-6 applies to an
   end card exactly as it applies to a director move: if a player
   reads "the thing found her in the dark" on a card and it turns
   out no such sentence was ever said at the table, the card has
   lied about their evening in the one artefact they are going to
   show other people.

   So `lastLine` is a search, not a generator. If it finds nothing,
   the card has no line on it and says so by omission.

   ------------------------------------------------------------
   AND IT IS THEIR FEED, NOT THE TABLE'S

   The snapshot each phone holds was redacted host-side, so the
   feed passed in here is already only what this player was told.
   Six cards from one table are six different and individually
   honest accounts, and none of them can leak somebody else's
   secret — because the text to leak was never on the device.
   ============================================================ */

/** Kinds that represent something said or narrated at the table,
    as opposed to bookkeeping. Deliberately excludes `system`: "day
    2 begins" is true and is not a memory. */
const SAYABLE = ["room", "npc", "say", "interject", "share", "warden"];

/** The last line of the feed that mentions this character by name.

    Verbatim, or nothing. Searching backwards because the memorable
    line about somebody is almost always the last one — usually the
    one about how they stopped being alive. */
export function lastLineAbout(feed = [], name = "") {
  if (!name) return null;
  const needle = String(name).toLowerCase();
  for (let i = feed.length - 1; i >= 0; i--) {
    const l = feed[i];
    if (!l || l.wardenOnly || !l.text) continue;
    if (!SAYABLE.includes(l.kind)) continue;
    if (!String(l.text).toLowerCase().includes(needle)) continue;
    return l.text;
  }
  return null;
}

/**
 * The card for one player, as data.
 *
 * Kept separate from the rendering so the tests can assert what is
 * on it without a DOM, and so the same object can be turned into
 * both the on-screen card and the copied text without either
 * drifting from the other.
 */
export function endCard({ mod, w, crew = [], feed = [], pcId }) {
  const pc = crew.find((c) => c.id === pcId) || null;
  if (!pc) return null;
  const ending = (mod && mod.endings && mod.endings[w.ended]) || null;
  const survived = pc.alive !== false;
  return {
    name: pc.name,
    /* The class as the module names it, not a key. */
    cls: (pc.cls && String(pc.cls).toUpperCase()) || "",
    survived,
    /* Two facts and no adjective. Whether dying in the first hour
       was tragic or funny is the player's to decide in the message
       they are about to write. */
    clock: w.clock || 0,
    endingTitle: ending ? ending.title : null,
    line: lastLineAbout(feed, pc.name),
    module: (mod && mod.title) || "",
  };
}

/** The card as the message somebody sends. Short on purpose: this
    competes with a person typing one sentence themselves, and it
    loses that competition at any length. */
export function endCardText(card) {
  if (!card) return "";
  const out = [];
  out.push(`${card.name}${card.cls ? ` · ${card.cls}` : ""}`);
  out.push(card.survived ? "Walked away." : "Did not make it.");
  if (card.line) out.push(`"${card.line}"`);
  if (card.module) out.push(`— ${card.module}`);
  return out.join("\n");
}
