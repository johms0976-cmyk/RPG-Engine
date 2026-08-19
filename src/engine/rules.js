/* ============================================================
   RULES — Mothership 1e (Player's Survival Guide).
   Engine-level. Modules may EXTEND but should rarely replace.
   ============================================================ */
import { d, dN, check, pad } from "./dice.js";

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
export const SKILL_BONUS = { trained: 10, expert: 15, master: 20 };
export const SKILL_COST = { trained: 1, expert: 2, master: 3 };
/** Training time in sessions. Rapid Skill Learning house rule halves the long haul. */
export const SKILL_TIME = { trained: 6, expert: 12, master: 24 };
export const SKILL_TIME_RAPID = { trained: 3, expert: 5, master: 7 };

export function skillTier(name) {
  if (SKILL_TREE.trained[name] !== undefined) return "trained";
  if (SKILL_TREE.expert[name] !== undefined) return "expert";
  if (SKILL_TREE.master[name] !== undefined) return "master";
  return null;
}

export const allSkills = () => [
  ...Object.keys(SKILL_TREE.trained),
  ...Object.keys(SKILL_TREE.expert),
  ...Object.keys(SKILL_TREE.master),
];

/** Can this character take `skill` given what they already have? */
export function canTakeSkill(pc, skill) {
  const tier = skillTier(skill);
  if (!tier) return { ok: false, why: "unknown skill" };
  if ((pc.skills || []).includes(skill)) return { ok: false, why: "already trained" };
  const prereqs = SKILL_TREE[tier][skill] || [];
  if (!prereqs.length) return { ok: true };
  const has = prereqs.some((p) => (pc.skills || []).includes(p));
  return has ? { ok: true } : { ok: false, why: `needs one of: ${prereqs.join(", ")}` };
}

export const PANIC_TABLE = [
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
export const panicEffect = (total) =>
  PANIC_TABLE.find((r) => total <= r.max) || PANIC_TABLE[PANIC_TABLE.length - 1];

/** RAW panic triggers (PSG 26.2). Used by the UI to explain why a check fired. */
export const PANIC_TRIGGERS = {
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

export const WAKE_TABLE = [
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
  '"#1 Worker"', "Blood type reference patch", '"Don\'t Run - You\'ll Only Die Tired"', "Biohazard symbol",
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

/* ---------------- derived values ---------------- */

/** Armor Save = base + best worn suit. Armor Points track degradation. */
export function armorSave(pc, items) {
  const worn = (pc.items || [])
    .map((i) => items[i])
    .filter((i) => i && i.armor)
    .map((i) => ({ id: i, armor: i.armor }));
  if (!worn.length) return pc.saves.armor;
  const best = Math.max(...worn.map((w) => w.armor));
  const lost = pc.armorDamage || 0;
  return pc.saves.armor + Math.max(0, best - lost);
}

export function bestArmorItem(pc, items) {
  let best = null;
  for (const id of pc.items || []) {
    const it = items[id];
    if (it && it.armor && (!best || it.armor > best.it.armor)) best = { id, it };
  }
  return best;
}

/** Base value before modifiers. The modifier pipeline adds the rest. */
export function baseValue(pc, kind, name, items) {
  if (kind === "save") return name === "armor" ? armorSave(pc, items) : pc.saves[name];
  return pc.stats[name];
}

export const clampTarget = (n) => Math.max(1, Math.min(99, Math.round(n)));

/* ---------------- character creation ---------------- */

/**
 * PSG 1.1: "You'll roll 6d10 for each Stat and record the results in
 * order starting with Strength, then Speed, Intellect and finally
 * Combat. A Stat of 30 is about average."
 */
export function rollStats() {
  return {
    strength: dN(6, 10), speed: dN(6, 10),
    intellect: dN(6, 10), combat: dN(6, 10),
  };
}

let PC_SEQ = 0;
export const newPcId = () => `pc${++PC_SEQ}_${Math.random().toString(36).slice(2, 7)}`;

export function makeCharacter({ name, cls, stats, skills, loadout, trinket, patch }, { items, loadouts, meters = {} }) {
  const c = CLASSES[cls];
  const s = { ...stats };
  Object.entries(c.bonus).forEach(([k, v]) => (s[k] += v));
  const kit = loadouts[loadout];
  const maxHealth = Math.max(1, s.strength * 2);
  return {
    id: newPcId(),
    name: name || "UNNAMED",
    cls, level: 0, xp: 0,
    stats: s,
    saves: { ...c.saves },
    maxHealth, health: maxHealth,
    stress: 2, resolve: 0,
    wounds: 0, maxWounds: 2,
    skills: [...skills],
    items: kit ? [...kit.items].filter((i) => items[i]) : [],
    ammo: {},          // itemId -> shots remaining in the weapon
    spare: {},         // itemId -> spare magazines / reloads
    uses: {},          // consumable charges spent
    buffs: [],         // timed modifier grants (drugs, aiming, adrenaline)
    credits: dN(5, 10) * 10,
    trinket, patch,
    conditions: [],
    armorDamage: 0,
    alive: true, unconscious: false, wakeAt: null,
    lastRestDay: -1, lastAssistDay: -1,
    spentSkills: [],   // exhaustible-skills house rule
    usedPanicReroll: false,
    meters: Object.fromEntries(Object.entries(meters).map(([k, m]) => [k, m.start ?? 0])),
    tracks: {},
  };
}

/** Load a fresh weapon's magazine and give it spare reloads. */
export function primeAmmo(pc, items) {
  const ammo = { ...pc.ammo }, spare = { ...pc.spare };
  for (const id of pc.items) {
    const it = items[id];
    if (!it || !it.shots) continue;
    if (ammo[id] == null) ammo[id] = it.shots;
    if (spare[id] == null) spare[id] = it.spare ?? 2;
  }
  return { ...pc, ammo, spare };
}

export function randomFlavour() {
  return {
    trinket: TRINKETS[Math.floor(Math.random() * TRINKETS.length)],
    patch: PATCHES[Math.floor(Math.random() * PATCHES.length)],
  };
}

/* ---------------- rest, healing and stress relief (PSG 10.3, 25.2) ---------------- */

export const RestQuality = {
  SAFE: { key: "SAFE", name: "Somewhere safe", healMode: "none", stressMode: "none",
    blurb: "A bunk, a locked door, and nothing moving outside it." },
  MEDBAY: { key: "MEDBAY", name: "In a medbay", healMode: "advantage", stressMode: "none",
    blurb: "Proper equipment. Advantage on the Body Save to heal." },
  ROUGH: { key: "ROUGH", name: "Somewhere unsettling", healMode: "disadvantage", stressMode: "disadvantage",
    blurb: "You sleep in shifts, or you don't sleep. Disadvantage on both Saves." },
  CRYO: { key: "CRYO", name: "Cryosleep", healMode: "none", stressMode: "blocked",
    blurb: "Your body keeps. Your mind does not get the benefit." },
};

/**
 * Resolve one character's rest. Pure — returns a report, mutates nothing.
 * @returns {{heal:number, healRoll:object, stressRelief:number, stressRoll:object, notes:string[]}}
 */
export function resolveRest(pc, opts) {
  const { quality = RestQuality.SAFE, items = {}, houseRules = {}, assistAdv = false,
          bodyMode = "none", fearMode = "none", rng } = opts;
  const notes = [];
  const o = { advTieBreak: houseRules.advTieBreak, rng };

  const combine = (a, b) => (a === b ? a : a === "none" ? b : b === "none" ? a : "none");
  const healMode = combine(quality.healMode, bodyMode);

  const healRoll = check(pc.saves.body, healMode, o);
  let heal = 0;
  if (healRoll.critFail) {
    heal = -(1 + Math.floor((rng || Math.random)() * 10));
    notes.push("The wound has opened again in the night.");
  } else if (healRoll.success) {
    heal = healRoll.margin * (healRoll.critHit ? 2 : 1);
  } else {
    notes.push("You wake up no better than you went down.");
  }

  let stressMode = quality.stressMode === "blocked" ? "blocked" : combine(quality.stressMode, fearMode);
  if (assistAdv && stressMode !== "blocked") stressMode = combine(stressMode, "advantage");

  let stressRelief = 0, stressRoll = null;
  if (stressMode === "blocked") {
    notes.push("Cryosleep does nothing for what is in your head.");
  } else {
    stressRoll = check(pc.saves.fear, stressMode, o);
    if (stressRoll.success) {
      stressRelief = Math.floor(stressRoll.margin / 10) * (stressRoll.critHit ? 2 : 1);
      // The rulebook's own example lets a Critical Success be worth at
      // least a point even when the margin is under 10.
      if (stressRelief === 0 && stressRoll.critHit) stressRelief = 1;
    }
  }

  const floor = (pc.conditions || []).includes("Descent into Madness") ? 5 : 0;
  const cappedRelief = Math.max(0, Math.min(stressRelief, pc.stress - floor));
  if (cappedRelief < stressRelief) notes.push("Something in you will not come down below five.");

  return { heal, healRoll, stressRelief: cappedRelief, stressRoll, notes };
}

/* ---------------- progression (PSG 35-36) ---------------- */

/**
 * XP needed for the next level. The book advances characters by
 * surviving sessions and achieving goals; this is the engine's
 * interpretation of that as a spendable currency.
 */
export const xpForLevel = (level) => 10 + level * 5;

export const ADVANCEMENTS = [
  { id: "stat", name: "Harden a Stat", blurb: "+5 to one Stat, to a maximum of 85." },
  { id: "save", name: "Harden a Save", blurb: "+5 to one Save, to a maximum of 85." },
  { id: "resolve", name: "Gain Resolve", blurb: "+1 Resolve, to a maximum of 5. Every point is -1 on the Panic Effect table." },
  { id: "skill", name: "Learn a Skill", blurb: "Take a new Skill you have the prerequisites for." },
];

export function applyAdvancement(pc, choice) {
  const next = { ...pc, stats: { ...pc.stats }, saves: { ...pc.saves }, skills: [...pc.skills] };
  if (choice.id === "stat" && STAT_KEYS.includes(choice.key)) {
    next.stats[choice.key] = Math.min(85, next.stats[choice.key] + 5);
    if (choice.key === "strength") {
      next.maxHealth = Math.max(1, next.stats.strength * 2);
      next.health = Math.min(next.maxHealth, next.health + 10);
    }
  } else if (choice.id === "save" && SAVE_KEYS.includes(choice.key)) {
    next.saves[choice.key] = Math.min(85, next.saves[choice.key] + 5);
  } else if (choice.id === "resolve") {
    next.resolve = Math.min(5, next.resolve + 1);
  } else if (choice.id === "skill") {
    const ok = canTakeSkill(next, choice.key);
    if (!ok.ok) return { pc, error: ok.why };
    next.skills.push(choice.key);
  } else {
    return { pc, error: "unknown advancement" };
  }
  next.level = pc.level + 1;
  next.xp = pc.xp - xpForLevel(pc.level);
  return { pc: next, error: null };
}

export const fmtClock = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export const fmtDuration = (mins) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

export { d, dN, pad };
