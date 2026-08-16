/* ============================================================
   RULES — Mothership 0e (Player's Survival Guide).
   Engine-level. Modules may EXTEND but should rarely replace.
   ============================================================ */
import { d, dN } from "./dice.js";

export const CLASSES = {
  teamster: {
    key: "teamster", name: "TEAMSTER",
    blurb: "Rough-and-tumble working crew. The people who actually keep the lights on.",
    saves: { sanity: 30, fear: 35, body: 30, armor: 35 },
    bonus: { strength: 5, speed: 5 },
    fixedSkills: ["Zero-G", "Mechanical Repair"],
    pick: { from: ["Heavy Machinery", "Piloting"], count: 1 },
    points: 4,
    panic: "Once per session, re-roll one roll on the Panic Effect table.",
  },
  android: {
    key: "android", name: "ANDROID",
    blurb: "Synthetic. Unbothered by fear, and unsettling to everyone who isn't.",
    saves: { sanity: 20, fear: 85, body: 40, armor: 25 },
    bonus: { intellect: 10 },
    fixedSkills: ["Computers", "Mathematics", "Linguistics"],
    pick: null, points: 2,
    panic: "Fear saves made in the presence of an Android are at Disadvantage.",
  },
  scientist: {
    key: "scientist", name: "SCIENTIST",
    blurb: "Doctors and researchers. The ones who want to cut it open and find out.",
    saves: { sanity: 40, fear: 25, body: 25, armor: 30 },
    bonus: { intellect: 5 },
    fixedSkills: [],
    pick: { from: ["Biology", "Hydroponics", "Geology", "Computers", "Mathematics", "Chemistry"], count: 2 },
    points: 3,
    panic: "When a Scientist fails a Sanity save, every friendly nearby gains 1 Stress.",
  },
  marine: {
    key: "marine", name: "MARINE",
    blurb: "Trained to shoot things. Contagiously calm, and contagiously not.",
    saves: { sanity: 25, fear: 30, body: 35, armor: 40 },
    bonus: { combat: 5 },
    fixedSkills: ["Military Training"],
    pick: null, points: 3,
    panic: "When a Marine Panics, every friendly nearby must make a Fear save.",
  },
};

export const SKILL_TREE = {
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
    Xenobiology: ["Genetics", "Botany", "Pathology"], Xenoesotericism: ["Mysticism"],
  },
};
export const SKILL_BONUS = { trained: 10, expert: 15, master: 20 };
export const SKILL_COST = { trained: 1, expert: 2, master: 3 };

export function skillTier(name) {
  if (SKILL_TREE.trained[name] !== undefined) return "trained";
  if (SKILL_TREE.expert[name] !== undefined) return "expert";
  if (SKILL_TREE.master[name] !== undefined) return "master";
  return null;
}

export const PANIC_TABLE = [
  { max: 3, name: "Laser Focus", t: "Something in you goes very quiet and very sharp. Advantage on all rolls for 1d10 hours.", e: { adv: "1d10 hours" } },
  { max: 5, name: "Major Adrenaline Rush", t: "Advantage on all rolls for the next 3d10 minutes.", e: { adv: "3d10 minutes" } },
  { max: 7, name: "Minor Adrenaline Rush", t: "Advantage on all rolls for the next 1d10 minutes.", e: { adv: "1d10 minutes" } },
  { max: 9, name: "Anxious", t: "Gain 1 Stress.", e: { stress: 1 } },
  { max: 11, name: "Nervous Twitch", t: "Gain 2 Stress. The nearest crew member gains 1.", e: { stress: 2, nearby: 1 } },
  { max: 13, name: "Cowardice", t: "Gain 1 Stress. For 1d10 hours you must pass a Fear save to enter combat, or flee.", e: { stress: 1, cowardice: true } },
  { max: 15, name: "Hallucinations", t: "For 2d10 hours you have trouble telling what is really there.", e: { hallucinating: true } },
  { max: 17, name: "Crippling Fear", t: "Gain a permanent phobia. Encountering it means a Fear save at Disadvantage or 1d10 Stress.", e: { phobia: true } },
  { max: 19, name: "Overwhelmed", t: "Gain 1d10 Stress.", e: { stressDice: "1d10" } },
  { max: 21, name: "Rattled", t: "You scream. Disadvantage on all rolls for 2d10 minutes. Everything nearby heard that.", e: { dis: true, noise: true } },
  { max: 22, name: "Paranoid", t: "For 1d10 days, whenever anyone rejoins your group, Fear save or 1 Stress.", e: { paranoid: true } },
  { max: 23, name: "Death Drive", t: "Whenever you meet a stranger or a known enemy, Sanity save or attack immediately.", e: { deathdrive: true } },
  { max: 24, name: "Catatonic", t: "You stop. Unresponsive and unmoving for a long, long while.", e: { catatonic: true } },
  { max: 25, name: "Broken", t: "Panic again whenever a nearby crew member fails a save.", e: { broken: true } },
  { max: 26, name: "Psychotic", t: "Attack the nearest crew member until you have done at least 2d10 damage. If nobody is near, attack the room.", e: { psychotic: true } },
  { max: 27, name: "Compounding Problems", t: "Roll twice more on this table.", e: { again: 2 } },
  { max: 28, name: "Descent into Madness", t: "Gain two new phobias. Your Stress cannot drop below 5.", e: { floor: 5 } },
  { max: 29, name: "Psychological Collapse", t: "You are permanently, irreparably insane. Your character is finished.", e: { end: "insane" } },
  { max: 99, name: "Heart Attack", t: "Instant death.", e: { end: "dead" } },
];
export const panicEffect = (total) =>
  PANIC_TABLE.find((r) => total <= r.max) || PANIC_TABLE[PANIC_TABLE.length - 1];

export const WAKE_TABLE = [
  { max: 1, t: "Comatose and brain-dead. Only extraordinary measures will bring you back." },
  { max: 3, t: "You wake in 1d10 days with 1 Health. Permanent −5 Strength, −5 Speed, −5 Intellect. +1d10 Stress." },
  { max: 6, t: "You wake in 1d10 hours with 1 Health. Permanent −5 Strength, −5 Speed. +3 Stress." },
  { max: 9, t: "You wake in 1d10 minutes with 1 Health. Permanent −5 Strength. +2 Stress." },
  { max: 10, t: "You wake immediately with 1 Health. Disadvantage on everything for 1d10 minutes. +1 Stress." },
];

export const TRINKETS = [
  "Preserved insectile aberration", "Faded green poker chip", "Dessicated husk doll", "Necklace of shell casings",
  "Corroded android logic core", "Pamphlet: Signs of Parasitical Infection", "Bone knife", "Dog tags (heirloom)",
  "Medical container, purple powder", "Vantablack marble", "Bag of assorted teeth", "Ashes (a relative)",
  "Cigarettes (grinning skull)", "Key to a childhood home", "Titanium toothpick", "Journal of grudges",
  "Fleshy thing sealed in a murky jar", "Trilobite fossil", "Stress ball: ZERO STRESS IN ZERO G",
  "Coffee cup, chipped: HAPPINESS IS MANDATORY", "Locket with a hair braid", "Taxidermied cat",
  "Miniature chess set, bone, pieces missing", "Manual: Mining Safety and You",
];
export const PATCHES = [
  '"#1 Worker"', "Blood type reference patch", '"Don\'t Run — You\'ll Only Die Tired"', "Biohazard symbol",
  '"Be Sure: Doubletap"', "Smiley face (glow in the dark)", "Jolly Roger", '"APEX PREDATOR"',
  '"Powered By Coffee"', '"DO YOUR JOB"', "Allergic to bullshit (medical style)", '"Fix Me First"',
  '"Troubleshooter"', "Skull and crossed wrenches", '"SUCK IT UP"', '"Meat Bag"', '"I Am Not A Robot"',
  '"Space IS My Home"', '"LONER"', '"Too Pretty To Die"', "Fun meter (reading: bad time)", '"Volunteer"',
];

export const STAT_KEYS = ["strength", "speed", "intellect", "combat"];
export const SAVE_KEYS = ["sanity", "fear", "body", "armor"];
export const STAT_LABEL = {
  strength: "Strength", speed: "Speed", intellect: "Intellect", combat: "Combat",
  sanity: "Sanity", fear: "Fear", body: "Body", armor: "Armor",
};

/* ---- derived values. `items` is the merged item table from the module. ---- */

export function armorSave(pc, items) {
  const worn = pc.items.map((i) => items[i]).filter((i) => i && i.armor).map((i) => i.armor);
  return pc.saves.armor + (worn.length ? Math.max(...worn) : 0);
}

export function skillBonus(pc, skill) {
  if (!skill || !pc.skills.includes(skill)) return 0;
  const t = skillTier(skill);
  return t ? SKILL_BONUS[t] : 0;
}

/** Best bonus among a list of skills — lets modules say "Xenobiology OR Biology". */
export function bestSkillBonus(pc, skills = []) {
  return skills.reduce((best, s) => Math.max(best, skillBonus(pc, s)), 0);
}

export function statValue(pc, kind, name, skill, items) {
  const base = kind === "save"
    ? (name === "armor" ? armorSave(pc, items) : pc.saves[name])
    : pc.stats[name];
  const bonus = Array.isArray(skill) ? bestSkillBonus(pc, skill) : skillBonus(pc, skill);
  return Math.max(1, Math.min(99, base + bonus));
}

export function rollStats() {
  return {
    strength: dN(2, 10) + 25, speed: dN(2, 10) + 25,
    intellect: dN(2, 10) + 25, combat: dN(2, 10) + 25,
  };
}

export function makeCharacter({ name, cls, stats, skills, loadout, trinket, patch }, { items, loadouts, meters = {} }) {
  const c = CLASSES[cls];
  const s = { ...stats };
  Object.entries(c.bonus).forEach(([k, v]) => (s[k] += v));
  const kit = loadouts[loadout];
  return {
    name: name || "UNNAMED",
    cls, level: 0,
    stats: s,
    saves: { ...c.saves },
    maxHealth: s.strength * 2,
    health: s.strength * 2,
    stress: 2,
    resolve: 0,
    skills,
    items: kit ? [...kit.items].filter((i) => items[i]) : [],
    uses: {},
    credits: dN(5, 10) * 10,
    trinket, patch,
    conditions: [],
    /** module-defined extra meters, e.g. Gradient Descent's "The Bends" */
    meters: Object.fromEntries(Object.entries(meters).map(([k, m]) => [k, m.start ?? 0])),
    tracks: {},
    xp: 0,
  };
}

export function randomFlavour() {
  return {
    trinket: TRINKETS[Math.floor(Math.random() * TRINKETS.length)],
    patch: PATCHES[Math.floor(Math.random() * PATCHES.length)],
  };
}

export const fmtClock = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export { d, dN };
