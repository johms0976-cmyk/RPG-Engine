/* ============================================================
   MOTHERSHIP 1e — the Player's Survival Guide, as a ruleset.

   Every number in this file was in `engine/rules.js` until
   2.20.0 and none of it has changed. What changed is where it
   lives: `rules.js` now holds the FUNCTIONS the engine calls and
   this holds the SYSTEM they operate on, which is the split that
   makes `engine/ruleset.js` possible at all.

   Nothing here imports `rules.js`. That is not tidiness, it is
   the direction of the dependency — `rules.js` reads this, so a
   read the other way would be a cycle, and the cycle would
   resolve at import time as `undefined` constants rather than as
   an error anybody could find.

   ------------------------------------------------------------
   WHAT IS AND IS NOT ORIGINAL

   The Panic table, the classes, the skill tree and the wake
   table are Mothership 1e's rules, implemented from the Player's
   Survival Guide, which is the same standing this material has
   had in this repository since 2.0 — see NOTICE.md. Moving it
   between files changes nothing about that.

   The trinkets and patches are the PSG's lists. The generators
   in `screens/WardenTools.jsx` are original to this engine and
   are deliberately NOT here, because they are not rules.
   ============================================================ */

import { dN } from "../dice.js";
import { defineRuleset, registerRuleset } from "../ruleset.js";

const CLASSES = {
  teamster: {
    key: "teamster", name: "TEAMSTER",
    blurb: "Rough-and-tumble working crew. The people who actually keep the lights on.",
    saves: { sanity: 30, fear: 35, body: 30, armor: 35 },
    bonus: { strength: 5, speed: 5 },
    fixedSkills: ["Zero-G", "Mechanical Repair"],
    pick: { from: ["Heavy Machinery", "Piloting"], count: 1 },
    points: 4,
    panic: "Once per session, re-roll one roll on the Panic Effect table.",
    ability: "panicReroll",
  },
  android: {
    key: "android", name: "ANDROID",
    blurb: "Synthetic. Unbothered by fear, and unsettling to everyone who isn't.",
    saves: { sanity: 20, fear: 85, body: 40, armor: 25 },
    bonus: { intellect: 10 },
    fixedSkills: ["Computers", "Mathematics", "Linguistics"],
    pick: null, points: 2,
    panic: "Fear Saves made in the presence of an Android are at Disadvantage.",
    ability: "androidDread",
  },
  scientist: {
    key: "scientist", name: "SCIENTIST",
    blurb: "Doctors and researchers. The ones who want to cut it open and find out.",
    saves: { sanity: 40, fear: 25, body: 25, armor: 30 },
    bonus: { intellect: 5 },
    fixedSkills: [],
    pick: { from: ["Biology", "Hydroponics", "Geology", "Computers", "Mathematics", "Chemistry"], count: 2 },
    points: 3,
    panic: "When a Scientist fails a Sanity Save, every friendly nearby gains 1 Stress.",
    ability: "scientistContagion",
  },
  marine: {
    key: "marine", name: "MARINE",
    blurb: "Trained to shoot things. Contagiously calm, and contagiously not.",
    saves: { sanity: 25, fear: 30, body: 35, armor: 40 },
    bonus: { combat: 5 },
    fixedSkills: ["Military Training"],
    pick: null, points: 3,
    panic: "When a Marine Panics, every friendly nearby must make a Fear Save. A nearby Marine grants +5 Combat and +5 Fear.",
    ability: "marineContagion",
  },
};

const TREE = {
  trained: {
    Archaeology: [], Art: [], Athletics: [], Biology: [], Chemistry: [], Computers: [], Driving: [],
    "First Aid": [], Geology: [], "Heavy Machinery": [], Hydroponics: [], Linguistics: [], Mathematics: [],
    "Mechanical Repair": [], "Military Training": [], Piloting: [], Rimwise: [], Scavenging: [], Theology: [], "Zero-G": [],
  },
  expert: {
    "Asteroid Mining": ["Zero-G", "Geology", "Heavy Machinery"], Astrogation: ["Piloting"],
    Botany: ["Hydroponics"], "Close-Quarters Combat": ["Athletics", "Military Training"],
    Engineering: ["Heavy Machinery", "Computers", "Mechanical Repair"], Explosives: ["Chemistry", "Military Training"],
    Firearms: ["Rimwise", "Military Training"], Genetics: ["Biology"], Gunnery: ["Military Training"],
    Hacking: ["Computers"], "Jury-Rigging": ["Scavenging"], Mysticism: ["Art", "Archaeology", "Theology"],
    Pathology: ["First Aid"], Physics: ["Mathematics"], Planetology: ["Geology"], Psychology: ["Linguistics"],
    Tactics: ["Theology", "Military Training"], "Vehicle Specialization": ["Mechanical Repair", "Driving"],
  },
  master: {
    "Artificial Intelligence": ["Hacking", "Engineering"], Command: ["Vehicle Specialization", "Tactics"],
    Cybernetics: ["Jury-Rigging", "Engineering"], Hyperspace: ["Astrogation", "Physics"],
    Robotics: ["Engineering"], Sophontology: ["Psychology"], "Weapon Specialization": ["Firearms", "Gunnery", "Close-Quarters Combat"],
    /* Surgery is a Master skill in 1e and was missing from this tree
       while being referenced in three other places — the Surgeon
       hireling carries it (core/hirelings.js), gear.js prices work
       against it, and downtime.js offers it. So skillTier("Surgery")
       returned null, a hireling held a skill the engine did not
       recognise, and no player could ever take it at level-up. */
    Surgery: ["Pathology"],
    Xenobiology: ["Genetics", "Botany", "Pathology"], Xenoesotericism: ["Mysticism"],
  },
};

const PANIC = [
  { max: 3, name: "Laser Focus", t: "Something in you goes very quiet and very sharp. Advantage on all rolls for 1d10 hours.", e: { adv: "1d10 hours" } },
  { max: 5, name: "Major Adrenaline Rush", t: "Advantage on all rolls for the next 3d10 minutes.", e: { adv: "3d10 minutes" } },
  { max: 7, name: "Minor Adrenaline Rush", t: "Advantage on all rolls for the next 1d10 minutes.", e: { adv: "1d10 minutes" } },
  { max: 9, name: "Anxious", t: "Gain 1 Stress.", e: { stress: 1 } },
  { max: 11, name: "Nervous Twitch", t: "Gain 2 Stress. The nearest crew member gains 1.", e: { stress: 2, nearby: 1 } },
  { max: 13, name: "Cowardice", t: "Gain 1 Stress. For 1d10 hours you must pass a Fear Save to enter combat, or flee.", e: { stress: 1, cowardice: true } },
  { max: 15, name: "Hallucinations", t: "For 2d10 hours you have trouble telling what is really there.", e: { hallucinating: true } },
  { max: 17, name: "Crippling Fear", t: "Gain a permanent phobia. Encountering it means a Fear Save at Disadvantage or 1d10 Stress.", e: { phobia: true } },
  { max: 19, name: "Overwhelmed", t: "Gain 1d10 Stress.", e: { stressDice: "1d10" } },
  { max: 21, name: "Rattled", t: "You scream. Disadvantage on all rolls for 2d10 minutes. Everything nearby heard that.", e: { dis: true, noise: true } },
  { max: 22, name: "Paranoid", t: "For 1d10 days, whenever anyone rejoins your group, Fear Save or 1 Stress.", e: { paranoid: true } },
  { max: 23, name: "Death Drive", t: "Whenever you meet a stranger or a known enemy, Sanity Save or attack immediately.", e: { deathdrive: true } },
  { max: 24, name: "Catatonic", t: "You stop. Unresponsive and unmoving for a long, long while.", e: { catatonic: true } },
  { max: 25, name: "Broken", t: "Panic again whenever a nearby crew member fails a Save.", e: { broken: true } },
  { max: 26, name: "Psychotic", t: "Attack the nearest crew member until you have done at least 2d10 damage. If nobody is near, attack the room.", e: { psychotic: true } },
  { max: 27, name: "Compounding Problems", t: "Roll twice more on this table.", e: { again: 2 } },
  { max: 28, name: "Descent into Madness", t: "Gain two new phobias. Your Stress cannot drop below 5.", e: { floor: 5 } },
  { max: 29, name: "Psychological Collapse", t: "You are permanently, irreparably insane. Your character is finished.", e: { end: "insane" } },
  { max: 99, name: "Heart Attack", t: "Instant death.", e: { end: "dead" } },
];

const TRIGGERS = {
  critFail: "a Critical Failure on a Save",
  bigHit: "losing more than half your Health in one hit",
  critHitTaken: "being hit with a Critical Success",
  firstContact: "meeting something you have no name for",
  crewDeath: "watching a crew member die",
  multiPanic: "seeing more than one crew member Panic at once",
  shipCrit: "your ship taking a Critical Hit",
  hopeless: "all hope being gone",
  marineContagion: "a Marine losing it in front of you",
};

const WAKE = [
  { max: 1, t: "Comatose and brain-dead. Only extraordinary measures will bring you back.",
    coma: true },
  { max: 3, t: "You wake in 1d10 days with 1 Health. Permanent -5 Strength, -5 Speed, -5 Intellect. +1d10 Stress.",
    penalties: { strength: -5, speed: -5, intellect: -5 }, stress: "1d10", wake: "1d10 days" },
  { max: 6, t: "You wake in 1d10 hours with 1 Health. Permanent -5 Strength, -5 Speed. +3 Stress.",
    penalties: { strength: -5, speed: -5 }, stress: 3, wake: "1d10 hours" },
  { max: 9, t: "You wake in 1d10 minutes with 1 Health. Permanent -5 Strength. +2 Stress.",
    penalties: { strength: -5 }, stress: 2, wake: "1d10 minutes" },
  { max: 10, t: "You wake immediately with 1 Health. Disadvantage on everything for 1d10 minutes. +1 Stress.",
    penalties: {}, stress: 1, wake: "immediately", dazed: true },
];

const TRINKETS = [
  "Preserved insectile aberration", "Faded green poker chip", "Dessicated husk doll", "Necklace of shell casings",
  "Corroded android logic core", "Pamphlet: Signs of Parasitical Infection", "Bone knife", "Dog tags (heirloom)",
  "Medical container, purple powder", "Vantablack marble", "Bag of assorted teeth", "Ashes (a relative)",
  "Cigarettes (grinning skull)", "Key to a childhood home", "Titanium toothpick", "Journal of grudges",
  "Fleshy thing sealed in a murky jar", "Trilobite fossil", "Stress ball: ZERO STRESS IN ZERO G",
  "Coffee cup, chipped: HAPPINESS IS MANDATORY", "Locket with a hair braid", "Taxidermied cat",
  "Miniature chess set, bone, pieces missing", "Manual: Mining Safety and You",
];

const PATCHES = [
  '"#1 Worker"', "Blood type reference patch", '"Don\'t Run - You\'ll Only Die Tired"', "Biohazard symbol",
  '"Be Sure: Doubletap"', "Smiley face (glow in the dark)", "Jolly Roger", '"APEX PREDATOR"',
  '"Powered By Coffee"', '"DO YOUR JOB"', "Allergic to bullshit (medical style)", '"Fix Me First"',
  '"Troubleshooter"', "Skull and crossed wrenches", '"SUCK IT UP"', '"Meat Bag"', '"I Am Not A Robot"',
  '"Space IS My Home"', '"LONER"', '"Too Pretty To Die"', "Fun meter (reading: bad time)", '"Volunteer"',
];

/* ============================================================
   THE DECLARATION
   ============================================================ */

export const mothership1e = defineRuleset({
  id: "mothership1e",
  name: "MOTHERSHIP 1e",
  system: "Mothership",
  blurb: "Four stats, four saves, four classes and a Panic table. The Player's Survival Guide.",

  stats: ["strength", "speed", "intellect", "combat"],
  saves: ["sanity", "fear", "body", "armor"],
  labels: {
    strength: "Strength", speed: "Speed", intellect: "Intellect", combat: "Combat",
    sanity: "Sanity", fear: "Fear", body: "Body", armor: "Armor",
  },
  /* Which save worn protection adds to. Named rather than assumed,
     so "armor" stops being a magic string inside `baseValue`. */
  armorSave: "armor",

  classes: CLASSES,

  skills: {
    tree: TREE,
    bonus: { trained: 10, expert: 15, master: 20 },
    cost: { trained: 1, expert: 2, master: 3 },
    time: { trained: 6, expert: 12, master: 24 },
    timeRapid: { trained: 3, expert: 5, master: 7 },
  },

  panic: { table: PANIC, triggers: TRIGGERS },
  wake: WAKE,

  /* All six, which is what Mothership has. A system with no classes
     drops "class" and "skills" and gets a creator without them. */
  create: {
    steps: ["name", "stats", "class", "skills", "loadout", "flavour"],
    statNote: "6d10 per Stat, in order: Strength, Speed, Intellect, Combat. 30 is about average.",
  },
  flavour: { trinkets: TRINKETS, patches: PATCHES },

  /* PSG 1.1: "You'll roll 6d10 for each Stat and record the results in
     order starting with Strength, then Speed, Intellect and finally
     Combat. A Stat of 30 is about average." */
  rollStats: () => ({
    strength: dN(6, 10), speed: dN(6, 10), intellect: dN(6, 10), combat: dN(6, 10),
  }),
  health: (s) => Math.max(1, s.strength * 2),
  startingStress: 2,
  maxWounds: 2,
  startingCredits: () => dN(5, 10) * 10,
});

registerRuleset(mothership1e);

export default mothership1e;
