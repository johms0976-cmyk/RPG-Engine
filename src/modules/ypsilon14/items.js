/* Items that exist only on Ypsilon 14. Merged on top of the core GEAR table.
   `found: true` highlights them in the sheet. */
export const items = {
  keycard: { n: "Sonya's Keycard", d: "Authorises airlock use and the self-destruct sequence at the workspace terminal.", found: true },
  revolver: { n: "Revolver", d: "3d10 dmg, knockdown on crit. −5 vs Armor. 8 shots.", dmg: "3d10", tag: "WPN", shots: 8, loud: true, found: true },
  handgun: { n: "Handgun (full clip)", d: "2d10 dmg. Jerome kept it under his pillow.", dmg: "2d10", tag: "WPN", shots: 8, loud: true, found: true },
  ammo: { n: "Loose Ammunition", d: "Mismatched rounds from Mike's old bunk.", found: true },
  squirtbottle: { n: "Empty Squirt Bottle", d: "For misting plants. Fill it and you have a weapon of sorts.", water: true, found: true },
  tape1: { n: "Cassette 1 — blue, 'SONYA'", d: "Scratched, handwritten label.", handout: "tape1", found: true },
  tape2: { n: "Cassette 2 — yellow, unmarked", d: "Found where it was thrown away.", handout: "tape2", found: true },
  tape3: { n: "Cassette 3 — white, printed label", d: "Dr E Giovanni — Log HRCLS-EX0119.", handout: "tape3", found: true },
  recorder: { n: "Portable Cassette Player", d: "Plays and records. Runs on almost nothing.", player: true, found: true },
  boombox: { n: "Boombox", d: "Loud. Very loud. Plays cassettes.", player: true, loud: true, found: true },
  scrappaper: { n: "Scrap of Paper", d: "Four digits in pencil: 0389.", found: true },
  minelaser: { n: "Handheld Laser Cutter (scorched)", d: "The missing tool. d% damage, 6 shots, one round to recharge.", dmg: "d%", tag: "WPN", shots: 6, cuts: true, melee: true, found: true },
  extractor: { n: "Steam Extractor", d: "A heavy ceiling unit pulled out of the washroom. Awkward. Full of condensate.", water: true, found: true },
  gootissue: { n: "Sample: Yellow Goo", d: "Tissues stained with something that will not stop moving slowly.", goo: true, found: true },
};

/* Cassettes. Every handout needs a player of some kind — that requirement
   is a `needs` predicate the engine evaluates against the character. */
export const handouts = {
  tape1: {
    label: "▶ BLUE — 'SONYA'",
    text: "Music, played loud. Nothing else on the tape. It fills the room and everything outside the room.",
    needs: "tag:player",
    needsText: "You have nothing to play it on. There's a boombox in Sonya's bunk and a portable player-recorder in the unused bunk [3].",
    effects: [{ when: "tag:loud", then: [{ noise: "music at full volume" }] }],
  },
  tape2: {
    label: "▶ YELLOW — UNMARKED",
    text: "Mike's voice, close to the microphone and unsteady.\n\nHe says his name. He says he isn't right, that something is wrong. He gets stuck on the word water and can't get past it. He says he can't stay up here much longer. He admits he broke the shower and told Sonya it was an accident — but it's the water, he doesn't think it likes the water. He says he's going back into the mine. He needs quiet. Then, twice: please fix me. He doesn't finish the last sentence.",
    needs: "tag:player",
    needsText: "You have nothing to play it on.",
    effects: [
      { flag: { heard_tape2: true, knows_water: true } },
      { save: "sanity", onFail: [{ stress: 1, why: "you listened to the whole thing" }] },
      { when: "tag:loud", then: [{ noise: "music at full volume" }] },
    ],
  },
  tape3: {
    label: "▶ WHITE — DR E GIOVANNI, LOG HRCLS-EX0119",
    text: "Dr Giovanni, dictating, brisk and delighted.\n\nInitial reports confirmed: the subject is biochemical in nature. Its point of origin suggests a medical use, though he doubts that. He notes the disappearance of a worker — number 7709 — and rules it unrelated. Then a click, and: possible negative reaction to water. Not certain. He'll follow it up in the morning.\n\nAnother click. Initial results on the substance's medical properties are positive. Whether its effects on human biology can be controlled is inconclusive; what he is looking at is essentially alien. Another click. He calls it incredible, twice. A rate of healing beyond anything — almost as if the cells are being replaced entirely, the body rewritten at molecular level, broken down like a cocoon and remade.\n\nAnother click. His voice has changed. If anyone finds this, please — and then a sound of pain. Don't touch it. Do not come into contact with the —\n\nThe recording ends in sounds of pain, and then silence.",
    needs: "tag:player",
    needsText: "You have nothing to play it on.",
    effects: [
      { flag: { heard_tape3: true, knows_water: true } },
      { save: "sanity", onFail: [{ stress: 2, why: "you listened to the whole thing" }] },
    ],
  },
};
