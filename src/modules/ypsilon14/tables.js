/* ============================================================
   YPSILON 14 — ROLLABLE TABLES
   For the offline Warden, and for any Warden who needs a beat
   and does not want to invent one under pressure.
   ============================================================ */
export const tables = {
  quiet: {
    name: "The base, while you are alone in it", die: "1d10", tone: "warden",
    entries: [
      { max: 1, text: "A radio on a workbench opens, carries four seconds of someone breathing, and closes." },
      { max: 2, text: "The drills change note far below, hold the new note for a minute, and go back." },
      { max: 3, text: "A door you did not open is open." },
      { max: 4, text: "Condensation runs down a bulkhead in a line that stops halfway and does not continue." },
      { max: 5, text: "You can hear the hydroponics misting. Nobody has misted the hydroponics in nine days." },
      { max: 6, text: "Somebody's abandoned mug is still warm." },
      { max: 7, text: "A vent cover two compartments away closes itself, unhurried, like a hand pulling a curtain." },
      { max: 8, text: "The lights dip for the length of a breath. The generator does not report a fault." },
      { max: 9, text: "You hear the cat, somewhere, complaining, and then not." },
      { max: 10, text: "Nothing at all happens, for a long time, in a way you find you do not like." },
    ],
  },

  vents: {
    name: "In the ducting", die: "1d10", tone: "search",
    entries: [
      { max: 2, text: "A drift of shed rock dust with a wide, smooth channel pushed through the middle of it." },
      { max: 4, text: "Somebody's contraband: a sealed bag of tobacco and a note that says PUT IT BACK, RIE." },
      { max: 5, text: "A cat's collar, chewed through, three metres from where a cat could have got to." },
      { max: 6, text: "Warm patches on the duct floor, in a line, each about the size of a person lying down." },
      { max: 7, text: "A maintenance stencil from nineteen years ago, and under it, scratched recently: 'IT IS IN HERE WITH US'." },
      { max: 8, text: "A residue on the duct wall, barely perceptible, tacky, that comes away on your glove and then does not." },
      { max: 9, text: "Bone. Not human. Not from anything on the manifest either.", effects: [{ stress: 1, why: "not from anything on the manifest" }] },
      { max: 10, text: "The ducting ahead of you is warm and the ducting behind you is warm and you did not warm either of them.", effects: [{ stress: 1, why: "both directions" }] },
    ],
  },

  radio: {
    name: "Radio check — who answers", die: "1d10", tone: "system",
    entries: [
      { max: 4, text: "Everyone answers, in order, tired and unimpressed." },
      { max: 7, text: "Everyone answers except one, who comes back forty seconds later out of breath and says they were in the head." },
      { max: 9, text: "One channel stays open and empty. Then a click. Then it closes." },
      { max: 10, text: "Somebody answers who has already been taken off the manifest. It is a recording, running on a loop, on a set nobody is holding.", effects: [{ stress: 1, why: "you know who that was" }] },
    ],
  },
};
