/* ============================================================
   ANOTHER BUG HUNT — GEAR AND PAPER

   Everything here is merged over the core PSG table, so the
   standard kit (pulse rifle, hazard suit, stimpak, bioscanner)
   is already available and is not repeated.

   Two item properties are load-bearing in this module:

     acid: true   hydrofluoric acid. The one thing that reliably
                  gets through carc armour. Every carc threat
                  carries a counter keyed to `tag:acid`, so an
                  item with this property is the difference
                  between a fight and a funeral.

     carc: true   carcinid tissue, pheromone, or DNA. The
                  mothership's hatches are grown rather than
                  built, and they open for anything that smells
                  correct. Carried carc matter is a key.
   ============================================================ */

export const items = {
  /* ---------------- authorisation ---------------- */
  edemcard: {
    n: "Dr Edem's Keycard", found: true,
    d: "Worn smooth at one corner. Opens the Greta Base operating theatre and the Cryovault under Heron. Edem does not hand it over, and does not explain why.",
  },
  controlcard: {
    n: "Control Room Keycard", found: true,
    d: "Brookman's. The only one left that opens the tower control room, and he will give it to anybody who asks him for it.",
  },
  tracker: {
    n: "Personal Locator Tracker", found: true, handout: "trackerlog",
    d: "Keyed to the colony's synthetic. It still has a fix: somewhere up in the foothills, a long way from anywhere Hinton is supposed to be.",
  },

  /* ---------------- the weakness ---------------- */
  tumbler: {
    n: "Vacuum Tumbler", found: true, acid: true, uses: 1,
    d: "A dead marine's drinking flask with the label scraped off. Inside, frozen solid, is hydrofluoric acid. He worked out what kills them and then sat down in the cold to keep it.",
  },
  acidvial: {
    n: "Vial of Hydrofluoric Acid", found: true, acid: true, uses: 1,
    d: "Lab stock, properly stoppered. Enough for one throw. Carapace goes to soft grey slurry where it lands.",
  },
  acidcan: {
    n: "Lead Container — Hydrofluoric Acid", found: true, acid: true, uses: 4,
    d: "Heavy, shielded, and four good throws' worth. The only reason the medbay is still worth walking into.",
  },
  chemo: {
    n: "Chemotherapeutic Agents", found: true,
    d: "Twenty-five litres, frozen. Written up for radiation exposure. Somebody in this colony was buying it for a different reason and did not write that part down. Raw, it is an anticancer drug and a very good poison. It needs a rig and somebody who knows the dose.",
  },
  /* ---------------- the second weakness ----------------
     The module set this up in three places — the case in the
     freezer, the unfinished arithmetic on the Heron bench, the
     residue in the bullet holes under the thruster bell — and
     then nothing anywhere consumed any of it. This is what it
     was for. The Shriek is a cancer pattern; doxorubicin is what
     you give a cancer. Edem worked the dose three ways and never
     finished the fourth, which is precisely why using it is a
     gamble and not a cure button. */
  cytotoxin: {
    n: "Cytotoxin — Three Doses", found: true, uses: 3,
    d: "Edem's compound, run off the clean room rig and drawn into three amber syringes. It kills the larva. It is also, unavoidably, chemotherapy, and the dose was never finished — get it wrong and you will have poisoned somebody who was going to live for another six hours.",
  },

  /* ---------------- things that make other things work ---------------- */
  portablegen: {
    n: "Portable Generator", found: true,
    d: "A petrol set on a frame, two-man lift. Six hours of fuel. It is the difference between a dark lab and a working one, and between a tower nobody can light and comms.",
  },
  raft: {
    n: "Inflatable Raft", found: true,
    d: "Stowed in a tower locker by somebody who thought it was funny. Given the state of the lake, it has stopped being funny and started being the plan.",
  },

  /* ---------------- what the Company sent you for ---------------- */
  larva: {
    n: "Larval Specimen Tube", found: true, carc: true,
    d: "A sealed containment cylinder with something curled inside it, jointed and patient. This is the sample on the contract. It is also a key to every door on the mothership.",
  },
  edemterminal: {
    n: "Portable Computer Terminal", found: true,
    d: "Edem's. Four months of sequencing work on the carcs' genome, and the only reason any of it was worth dying for.",
  },
  datastick: {
    n: "Unmarked Datastick", found: true, handout: "datastick",
    d: "Palmed rather than collected. Whatever is on it, Edem did not want it in the same pocket as the research.",
  },
  logiccore: {
    n: "Hinton's Logic Core", found: true,
    d: "A synthetic's memory, in a case the size of a paperback and heavier than it looks. Everything he learned about the Shriek is in here — including, if anyone can read it, how to undo it.",
  },
  carclimb: {
    n: "Severed Carcinid Limb", found: true, carc: true,
    d: "A metre of black jointed shell, still faintly warm. Held near a grown hatch it reads as one of them and the hatch opens.",
  },

  /* ---------------- ordnance ---------------- */
  amr: {
    n: "Wilbur Mk-II Anti-Material Rifle", found: true,
    dmg: "2d10*5", tag: "WPN", shots: 12, spare: 0, loud: true, vsArmor: -20,
    range: { s: 30, m: 200, l: 1500 },
    d: "Two-handed, heavy, and useless unless you are prone or braced. It kills a carc a round and it makes you a stationary object while it does.",
    grants: [{ tags: ["close"], dis: true }],
  },
  lat90: {
    n: "LAT-90 Rocket Launcher", found: true,
    dmg: "2d10*10", tag: "WPN", shots: 1, spare: 0, loud: true, vsArmor: -40,
    range: { s: 50, m: 300, l: 2000 },
    d: "One missile, no reload worth the name, and SOME PIG scratched down the tube in marker. Qadir carried it as far as a drainage grate.",
  },
  gpmg: {
    n: "GPMG", found: true,
    dmg: "4d10", tag: "WPN", shots: 100, spare: 1, loud: true, auto: true, burst: 10, falloff: true,
    range: { s: 30, m: 100, l: 400 },
    d: "Belt-fed, tripod-hungry, and the colonists have four of them left. It will not get through carapace. It will absolutely get their attention.",
  },
  webgun: {
    n: "Carcinid Fibre Projector", found: true, carc: true,
    dmg: "1d10", tag: "WPN", shots: 8, spare: 0,
    range: { s: 10, m: 20, l: 30 },
    d: "A black tube on an umbilical, feeding from a swollen sac you wear against your back. The trigger is in the wrong place for a hand. It throws a rope of fibre that dries hard in seconds.",
  },
  fibretube: {
    n: "Bone-Ceramic Fibre Tube", found: true, carc: true,
    d: "Twenty-two kilos of dug-out alien plumbing with eight fleshy nodules along the top. Each gives once and refills in ten minutes. Given four hours, the colonists can turn what it makes into ammunition.",
  },
  /* THE GRANT THAT COULD NEVER FIRE.

     This carried `grants: [{ tags: ["carc"], bonus: 20 }]`, and
     `collectModifiers` matches a grant's tags against the tags the
     *roll* declares. A combat roll declares "attack" and "melee" or
     "ranged" — never "carc" — so the bonus was dead. Widening it to
     "ranged" would have handed the crew +20 against Hinton and the
     colonists too, which is not what coated rounds are.

     The right shape was already in the module: acid is a counter, a
     named button that appears in a fight only when somebody is
     carrying the answer. Coated rounds are now the same, with a
     magazine count that runs out. */
  coatedammo: {
    n: "Coated Rounds", found: true,
    d: "Ordinary shots finished in Edem's compound, drying matte and slightly wrong in the hand. They go through carapace as though it were not there. There are never as many as you would like, and the box does not refill.",
  },

  /* ---------------- small things people leave behind ---------------- */
  tinfoilhat: {
    n: "Foil Cap", found: true,
    d: "Hand-folded from ration foil, several layers, done carefully by a man who worked out that the thing coming for the colony arrived over the air. He was right about the mechanism. He was wrong about what it protects you from — and about half of what he was wrong about turns out to be the half that matters.",
  },
  rosary: {
    n: "Rosary", found: true,
    d: "Left in an airlock locker with two rifle magazines, by someone who evidently could not decide which of the three was going to help.",
  },
  journal: {
    n: "Small Journal", found: true, handout: "journal",
    d: "Kept under a bunk in the enlisted barracks. Two names, six months, and no indication either of them told anybody.",
  },
  survey: {
    n: "Samsa VI Planetary Survey", found: true, handout: "survey",
    d: "Company issue, from before anyone landed. Somebody has gone over the foothills in pencil, more than once.",
  },
  orgchart: {
    n: "Mission Organisation Chart", found: true, handout: "orgchart",
    d: "Held in a dead officer's other hand. Every box has been annotated since it was printed, and most of the annotations are two letters long.",
  },
  logbook: {
    n: "Analysis Log Book", found: true, handout: "logbook",
    d: "The observation lab's running record. The last entries stop being a log and start being someone talking themselves into something.",
  },
  doxonote: {
    n: "Research Notes — Doxorubicin", found: true, handout: "doxonote",
    d: "Left out on a bench in the Heron labs, mid-calculation. Somebody was working out a dose and had stopped caring how it sounded.",
  },
};

/* ============================================================
   HANDOUTS

   Long text with consequences attached. All of it is written
   for this engine — the original module's prose is not
   reproduced here and this is not a substitute for owning it.
   ============================================================ */
export const handouts = {
  orgchart: {
    style: "corporate",
    label: "SAMSA VI — MISSION ORGANISATION CHART",
    text:
      "Nineteen names in nineteen boxes: command, two marine squads, the science section, the flight crew.\n\n"
      + "Somebody has been keeping it current in ballpoint. Against eight of the boxes, KIA. Against seven "
      + "more, MIA. The pen changes colour twice, which means this was done on at least three separate days "
      + "by somebody who kept coming back to it.\n\n"
      + "The science officer's box — HINTON, SYNTHETIC — has no annotation at all. Neither does the box for "
      + "the mission specialist, Dr Edem.",
    effects: [{ flag: "knows_roster" }, { save: "sanity", onFail: [{ stress: 1, why: "you counted the boxes twice" }] }],
  },

  logbook: {
    style: "handwritten",
    label: "OBSERVATION LAB — ANALYSIS LOG",
    text:
      "Months of clean, bored entries. Sample counts. Temperature. Then the handwriting gets faster.\n\n"
      + "The last dozen pages are Dr Edem's, and they are excited in a way the earlier pages never are. They "
      + "have found that the animals make a sound to reproduce — a shriek somewhere above what a person hears "
      + "comfortably — and Edem has given it a name in a language that is not theirs. Crabsong. It is written "
      + "out four times in the margin, in slightly different hands each time, the way you write a word you "
      + "have decided to be known for.\n\n"
      + "One line, near the end, is squeezed in below the ruled space: the android did most of the work. It "
      + "is followed immediately by a longer paragraph explaining why that is not the same as having made the "
      + "discovery.",
    effects: [{ flag: "knows_shriek" }],
  },

  doxonote: {
    style: "handwritten",
    label: "BENCH NOTES — UNFINISHED",
    text:
      "Dosage arithmetic, worked three ways and not finished. The compound named at the top is old — a "
      + "chemotherapy agent, human, and centuries out of clinical use.\n\n"
      + "The margin has the question the arithmetic is actually about, and it is not a medical question. "
      + "It asks what dose kills something that is not a tumour but is built like one.",
    effects: [{ flag: "knows_doxo" }],
  },

  journal: {
    style: "handwritten",
    label: "SMALL JOURNAL — ENLISTED BARRACKS",
    text:
      "Six months of a relationship conducted almost entirely in shift gaps, written down by the one of the "
      + "two who needed to write it down. It is careful about names and not careful at all about anything else.\n\n"
      + "The last entry is four days before the base went quiet and is about nothing: whose turn it was to "
      + "sort out the birthday cake.",
    effects: [{ save: "sanity", onFail: [{ stress: 1, why: "you know how this ends" }] }],
  },

  survey: {
    style: "corporate",
    label: "SAMSA VI — PLANETARY SURVEY (PRE-LANDING)",
    text:
      "Orbital photography, mineral assay, weather modelling. A wet world with a bad temper and nothing on it "
      + "worth the freight.\n\n"
      + "The foothills north-west of the base are marked with a shape the survey classes as a geological "
      + "anomaly and declines to discuss. Somebody has been back to that page repeatedly in pencil. The last "
      + "annotation is not a measurement. It is a question mark, gone over until it tore the paper.",
    effects: [{ flag: "knows_mountain" }],
  },

  trackerlog: {
    style: "corporate",
    label: "PERSONAL LOCATOR — HINTON, SCIENCE OFFICER",
    text:
      "SIGNAL: ACQUIRED. Steady. It has been steady for a long time.\n\n"
      + "The fix is not in the base and not in the station. It is up in the foothills, under a great deal of "
      + "rock, and it has not moved more than forty metres in three months.\n\n"
      + "Nobody filed him as missing because nobody checked. There was a great deal else going on.",
    effects: [{ flag: "knows_mountain" }],
  },

  datastick: {
    style: "corporate",
    label: "DATASTICK — CONTENTS",
    text:
      "Not research. A single Company personnel file with a debt schedule attached, and a corporate holding "
      + "order naming three people who share Dr Edem's surname.\n\n"
      + "The order has an expiry condition rather than an expiry date. The condition is the delivery of a "
      + "viable carcinid genome.",
    effects: [{ flag: "knows_edem" }, { stress: 1, why: "now you know what they are for" }],
  },
};
