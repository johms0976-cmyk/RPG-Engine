/* ============================================================
   REACTIONS — the thing to do when it is not your go.

   This is where a party game is lost: one player acting and four
   looking at a group chat. Every existing answer to that — share a
   secret, ask the room, dispute, vote — is a *move*, and a move
   costs thought and arrives with consequences. Between them there
   was nothing to do that cost nothing, and "nothing to do that
   costs nothing" is most of what people at a real table are doing
   most of the time.

   ------------------------------------------------------------
   WHY THE VOCABULARY IS CLOSED

   INV-6 says the engine never composes a sentence a person did not
   write. A free-text reaction would be a phone publishing arbitrary
   narration about the room, which is the Warden's job and nobody
   else's.

   A fixed set is a different thing. The player is not writing a
   sentence, they are pointing at one of six that already existed —
   the same act as pointing at a stat on a sheet. Nothing here
   asserts a fact about the world: no reaction moves anything, sees
   anything, or claims anything happened. They are all descriptions
   of a body in a chair.

   ------------------------------------------------------------
   AND WHY THEY ARE ALL PHYSICAL

   No dialogue. "I don't like this" was in the roadmap and is wrong
   for the same reason free text is wrong: it puts specific words in
   a player's mouth and then attributes them to their character on a
   screen the whole room is reading. A flinch is a body. A line of
   dialogue is writing.

   Third person, because the shared screen reads them as narration
   and the phone is not the one saying them out loud.
   ============================================================ */

/** The whole set. Six, because that is a thumb-sized grid on the
    narrowest phone anybody will bring, and because a longer list
    turns a reflex into a decision — which is the one thing this is
    not for. */
export const REACTIONS = [
  { id: "flinch", label: "Flinch", says: "flinches" },
  { id: "stare", label: "Stare", says: "stares" },
  { id: "recoil", label: "Back away", says: "backs away" },
  { id: "laugh", label: "Laugh", says: "laughs, badly" },
  { id: "swear", label: "Swear", says: "swears under their breath" },
  { id: "steady", label: "Steady them", says: "puts a hand out" },
];

const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));

/** The one a phone asked for, or null. Unknown ids are dropped
    rather than coerced: a phone sending something not on this list
    is a phone that has been tampered with, and the right answer to
    that is silence. */
export function reactionById(id) {
  return BY_ID.get(String(id || "")) || null;
}

/** How often one person may do this.

    Free and out-of-turn and untimed by the tempo brakes — so the
    only thing standing between six bored players and a feed made
    entirely of flinching is this number.

    Twelve seconds is long enough that a reaction reads as a
    response to something, and short enough that it never feels
    like a resource. It is enforced in the engine rather than on
    the phone, for the reason `jumpIn` is: a limit a phone applies
    to itself is a limit that stops existing the moment somebody
    opens the console. */
export const REACT_COOLDOWN_MS = 12 * 1000;

/** Should this reaction be let through? Pure, so the test does not
    need a clock. */
export function canReact(lastAt, now = Date.now()) {
  return !lastAt || now - lastAt >= REACT_COOLDOWN_MS;
}

/** How long a reaction stays up on the shared screen.

    They do not belong in the log — a reaction is the shape of a
    room at a moment, and a room at a moment is not a record. It
    surfaces, it is seen, it goes. */
export const REACT_VISIBLE_MS = 8 * 1000;

/** The ones still worth showing, newest last. */
export function liveReactions(reactions = [], now = Date.now()) {
  return reactions.filter((r) => now - r.at < REACT_VISIBLE_MS);
}
