/* ============================================================
   CLASS EFFECTS — the rules that are about somebody else.

   Every other number on a Mothership sheet describes its owner.
   These four do not. A Marine who Panics puts the whole room on a
   Fear Save. A Scientist who fails a Sanity Save hands out Stress
   to everyone standing near them. Standing next to an Android
   makes *your* Fear Saves worse, and it is the Android's sheet
   that says so. A Teamster carries a once-per-session Panic
   re-roll that is forgotten every single session because nothing
   ever reminds anyone it exists.

   `CLASSES[x].panic` in rules.js has carried the text since the
   engine was written, and the engine enacts all four correctly.
   The gap was entirely in the telling: the rule lived on one
   player's sheet, and the person it happened *to* was somebody
   else, who had no way to know it had happened or why. At a
   shared table the Warden says it out loud. On six phones nobody
   says anything, and the Stress just appears.

   So two things live here. `CLASS_EFFECTS` is the standing
   description — what your class does to the room — which belongs
   permanently on the Sheet tab rather than being something you
   are told once during character creation. `classAlert` turns a
   feed line the engine has tagged into a card, addressed to the
   person it actually happened to.

   Split from rules.js because rules.js is the rules and this is
   how they are narrated, and because a pure mapping is a thing
   you can test.
   ============================================================ */

/**
 * `you`   what this class does to everyone else, in the second
 *         person, for the owner's own sheet.
 * `them`  the same rule described from the outside, for the card
 *         that fires on somebody else's phone.
 * `when`  the trigger, short enough to sit under the line.
 */
export const CLASS_EFFECTS = {
  teamster: {
    name: "TEAMSTER",
    you: "Once a session you may re-roll a Panic Effect. It is the only second chance anybody at this table gets.",
    when: "when a Panic Effect goes badly",
    solo: true,
  },
  android: {
    name: "ANDROID",
    you: "Everyone near you takes their Fear Saves at Disadvantage. You are the reason, and they will work it out.",
    them: "There is an Android in the room. Fear Saves here are at Disadvantage — that is not your nerves, it is the company you keep.",
    when: "constantly, to everyone nearby",
  },
  scientist: {
    name: "SCIENTIST",
    you: "When you fail a Sanity Save, everyone near you gains 1 Stress. They are watching you for a reason.",
    them: "The Scientist just failed a Sanity Save. Whatever they understood, you did not — and you gained a point of Stress for watching them realise it.",
    when: "on a failed Sanity Save",
  },
  marine: {
    name: "MARINE",
    you: "When you Panic, everyone near you must make a Fear Save. While you are standing, a nearby crewmate gets +5 Combat and +5 Fear.",
    them: "The Marine broke. If they can go, anyone can — make a Fear Save.",
    when: "when you Panic",
  },
};

/** The standing line for a character's own sheet. */
export function classLine(cls) {
  const e = CLASS_EFFECTS[cls];
  return e ? e.you : null;
}

/* Cards, keyed by the tag the engine stamps on the feed line. Each
   one answers the question the event raises on the receiving phone,
   which is never "what happened" — the feed says that — but "why did
   that just happen to me". */
const CARDS = {
  scientistContagion: {
    kicker: "CLASS EFFECT",
    title: "The Scientist lost their grip",
    body: CLASS_EFFECTS.scientist.them,
    mine: "You failed a Sanity Save, and everyone standing near you gained a point of Stress for it. That is what a Scientist is.",
  },
  marineContagion: {
    kicker: "CLASS EFFECT",
    title: "The Marine broke",
    body: CLASS_EFFECTS.marine.them,
    mine: "You Panicked, and you are the Marine. Everyone nearby is rolling a Fear Save because of it.",
  },
  crewDeath: {
    kicker: "PANIC TRIGGER",
    title: "You watched someone die",
    body: "Seeing a crew member die is a Panic Check. Not a Save you chose, not a roll you can talk your way out of.",
  },
  multiPanic: {
    kicker: "PANIC TRIGGER",
    title: "Two of them went at once",
    body: "More than one crew member Panicking in front of you is itself a Panic trigger. The room is coming apart faster than any one person in it.",
  },
  teamsterReroll: {
    kicker: "ONCE A SESSION",
    title: "You are a Teamster",
    body: "Your Panic Effect was bad enough to be worth the re-roll, so it has been spent. There is not another one this session.",
    onlyMine: true,
  },
};

/**
 * Turn a tagged feed line into a card for one particular phone, or
 * null if this line is not one or is not that phone's business.
 *
 * @param line     a feed line as it arrives on the handset
 * @param myPcId   the character this phone is holding
 * @param crew     for naming the person it happened because of
 */
export function classAlert(line, myPcId, crew = []) {
  const tag = line && line.extra && line.extra.classfx;
  if (!tag || !myPcId) return null;
  const card = CARDS[tag];
  if (!card) return null;

  const ids = (line.extra && line.extra.ids) || [];
  const by = (line.extra && line.extra.by) || null;
  const isMine = by === myPcId;
  const affectsMe = ids.includes(myPcId);

  /* The Teamster's re-roll is nobody else's business — it is a note
     to its owner that a resource is now gone, not an event in the
     room. Everything else only fires for people it landed on. */
  if (card.onlyMine && !isMine) return null;
  if (!card.onlyMine && !isMine && !affectsMe) return null;

  const source = crew.find((c) => c.id === by);
  return {
    id: `classfx:${line.id}`,
    kicker: card.kicker,
    title: isMine && card.mine ? "That was you" : card.title,
    body: isMine && card.mine ? card.mine : card.body,
    who: source && !isMine ? source.name : null,
  };
}
