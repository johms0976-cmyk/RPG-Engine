/* ============================================================
   YPSILON 14 — WHAT YOU CAN PICK UP
   Merged on top of the core GEAR table. `found: true` highlights
   an item on the sheet as something taken from the base rather
   than signed out of your own hold.

   Anything with `water: true` can be thrown at the thing in the
   dark. That property is the single most valuable stat here and
   almost nobody notices it on the way in.
   ============================================================ */
export const items = {
  /* ---- authority ---- */
  keycard: {
    n: "Sonya's Keycard",
    d: "Team leader authorisation. Airlocks, docking clamps, the pump controls, and the base self-destruct.",
    found: true,
  },
  manifest: {
    n: "Cargo Manifest (signed)",
    d: "Six pallets of consumables and medical stock, consigned to Greta Base, Samsa IV. Countersigned by you.",
    found: true,
  },

  /* ---- weapons found on the base ---- */
  revolver: {
    n: "Revolver", d: "3d10 damage. Knockdown on a critical. −5 against Armor. Eight in the cylinder.",
    dmg: "3d10", tag: "WPN", shots: 8, spare: 1, loud: true, vsArmor: -5,
    crit: { mult: 2, knockdown: true }, range: { s: 20, m: 30, l: 125 }, found: true,
  },
  handgun: {
    n: "Handgun (full clip)", d: "2d10 damage. Jerome keeps it under his pillow and thinks that is a secret.",
    dmg: "2d10", tag: "WPN", shots: 8, spare: 1, loud: true, range: { s: 20, m: 30, l: 100 }, found: true,
  },
  ammo: { n: "Loose Ammunition", d: "Mismatched rounds out of a sock. Enough for one reload of most things.", found: true },
  minelaser: {
    n: "Handheld Laser Cutter (scorched)",
    d: "The tool that carved SILENCE into the rock. d% damage, six charges, one round to recharge. Cuts locks. Burns goo.",
    dmg: "d%", tag: "WPN", shots: 6, spare: 0, melee: true, cuts: true, burns: true, found: true,
  },

  /* ---- water, in its several forms ---- */
  squirtbottle: {
    n: "Empty Squirt Bottle",
    d: "For misting the hydroponics. Empty. There is water in the mess, the washrooms and the medbay.",
    fillable: true, found: true,
  },
  fullbottle: {
    n: "Squirt Bottle (full)",
    d: "Half a litre of water and a trigger. Three good squeezes. It is worth more than the revolver.",
    water: true, uses: 3, found: true,
  },
  extractor: {
    n: "Steam Extractor (dripping)",
    d: "A ceiling unit torn out of the washroom, heavy with condensate. One enormous splash, and then it is scrap.",
    water: true, uses: 1, found: true,
  },
  jerrycan: {
    n: "Jerrycan of Water",
    d: "Twenty litres, drawn off the galley line. Speed Checks at Disadvantage while you are carrying it.",
    water: true, uses: 4, grants: [{ kind: "stat", name: "speed", dis: true }], found: true,
  },

  /* ---- sound, in its several forms ---- */
  tape1: { n: "Cassette 1 — blue, 'SONYA'", d: "Scratched, handwritten label.", handout: "tape1", found: true },
  tape2: { n: "Cassette 2 — yellow, unmarked", d: "Found where somebody threw it.", handout: "tape2", found: true },
  tape3: { n: "Cassette 3 — white, printed label", d: "Dr E Giovanni — Log HRCLS-EX0119.", handout: "tape3", found: true },
  tape4: {
    n: "Cassette 4 — grey, 'DECOY'", d: "A recording of a great deal of noise. Play it somewhere you are not.",
    handout: "tape4", decoy: true, found: true,
  },
  recorder: {
    n: "Portable Cassette Player-Recorder", d: "Plays and records. Runs on almost nothing. Fits in a pocket.",
    player: true, records: true, found: true,
  },
  boombox: {
    n: "Boombox", d: "Loud. Genuinely loud. Sonya's, and she will want it back.",
    player: true, loud: true, found: true,
  },

  /* ---- evidence ---- */
  gootissue: {
    n: "Sample: Yellow Goo", d: "Tissues from Kantaro's bunk, stained with something that is still slowly moving.",
    goo: true, evidence: true, found: true,
  },
  gooslide: {
    n: "Prepared Slide: Yellow Goo", d: "Giovanni's own specimen, mounted and labelled. Proof, to anyone who understands it.",
    goo: true, evidence: true, found: true,
  },
  scrappaper: { n: "Scrap of Paper", d: "Four digits in pencil: 0389.", found: true },
  giovannicase: {
    n: "Dr Giovanni's Sample Case",
    d: "Lead-lined, Company-sealed, keyed to a thumb that is no longer attached to a functioning person. It is warm.",
    evidence: true, sealed: true, found: true,
  },
  cattreats: { n: "Cat Treats", d: "Morgan's contraband. Prince is a professional and will follow these.", found: true },
};

/* ============================================================
   HANDOUTS. Every tape needs something to play it on — that is a
   `needs` predicate, not a note in the text.
   ============================================================ */
export const handouts = {
  tape1: {
    label: "▶ BLUE — 'SONYA'",
    text: "Music, recorded loud off a worse copy. Nothing else on the tape. It fills the room, and then it fills the corridor, and then it fills whatever is in the corridor.",
    needs: "tag:player",
    needsText: "You have nothing to play it on. There is a boombox in Sonya's bunk [3-1] and a portable player in the unused bunk [3-10].",
    effects: [
      { flag: "heard_tape1" },
      { when: "tag:loud", then: [{ noise: "music at a volume the base was not designed for" }] },
    ],
  },

  tape2: {
    label: "▶ YELLOW — UNMARKED",
    text: "Mike Voss, too close to the microphone, breathing wrong.\n\nHe gives his name. He says he is not right, that something is wrong with him. He gets stuck on the word water and cannot get off it. He says he cannot stay up here much longer. He admits he broke the shower and told Sonya it was an accident — but it is the water, he does not think it likes the water. He says he is going back down into the mine. He says he needs quiet. Then twice, quietly: please fix me.\n\nHe does not finish the last sentence.",
    needs: "tag:player",
    needsText: "You have nothing to play it on.",
    effects: [
      { flag: { heard_tape2: true, knows_water: true, evidence: true } },
      { save: "sanity", why: "you listened to all of it", onFail: [{ stress: 1, why: "you listened to all of it" }] },
      { when: "tag:loud", then: [{ noise: "a dead man's voice at full volume" }] },
    ],
  },

  tape3: {
    label: "▶ WHITE — DR E GIOVANNI, LOG HRCLS-EX0119",
    text: "Giovanni dictating, brisk and delighted, over four sessions.\n\nOne: initial reports confirmed, the subject is biochemical. Point of origin suggests a medical application, which he doubts. He notes the disappearance of worker 7709 and rules it unrelated.\n\nTwo: a possible negative reaction to water. Not certain. He will follow it up in the morning.\n\nThree: results on the medical properties are positive. Whether the effects on human biology can be controlled is inconclusive. What he is looking at is essentially alien. He calls it incredible, twice. A rate of healing beyond anything — as if the cells were being replaced entirely, the body broken down like a cocoon and remade.\n\nFour: his voice has changed. If anyone finds this, please. Then a sound of pain. Don't touch it. Do not come into contact with the —\n\nThe recording runs on for another ninety seconds. None of it is words.",
    needs: "tag:player",
    needsText: "You have nothing to play it on.",
    effects: [
      { flag: { heard_tape3: true, knows_water: true, knows_goo_lite: true, evidence: true } },
      { save: "sanity", why: "you listened to all of it", onFail: [{ stress: 2, why: "you listened to all of it" }] },
    ],
  },

  tape4: {
    label: "▶ GREY — 'DECOY'",
    text: "Your own voice, and whatever else you could make a racket with, for twenty minutes.",
    needs: "tag:player",
    needsText: "You have nothing to play it on.",
    effects: [{ run: "playDecoy" }],
  },
};
