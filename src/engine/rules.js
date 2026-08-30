/* ============================================================
   RULES — the functions the engine calls, over whatever system
   is loaded.

   Until 2.20.0 this file held Mothership 1e itself: four stats,
   four saves, four classes, the Panic table, the skill tree and
   the wake table, all as literals, imported directly by thirty-
   one other files. None of that was ever *decided* to be
   Mothership-specific. It simply was, and the engine could not
   be anything else as a result.

   The numbers now live in `engine/rulesets/mothership.js` and
   arrive here through `activeRuleset()`. THE EXPORTS BELOW ARE
   UNCHANGED — `CLASSES`, `SKILL_TREE`, `PANIC_TABLE`, `STAT_KEYS`
   and the rest are still exported from `engine/rules.js` with
   the same shapes, so no call site needed touching and none did.
   What changed is that they are now reads rather than literals,
   which is what makes them swappable.

   Read `engine/ruleset.js` before assuming the system is fully
   pluggable. It is not, and that header says exactly which three
   pieces are still Mothership-shaped.

   The functions that stayed here are the ones that are about
   CHARACTERS rather than about a system: how a save resolves
   against worn armour, what a fresh character looks like, how
   rest works. They read the ruleset for their numbers.
   ============================================================ */
import { d, dN, check, pad } from "./dice.js";
import { activeRuleset } from "./ruleset.js";
/* Importing a ruleset registers it. Mothership is imported here
   because it is the default and something has to put it in the
   registry before `activeRuleset()` is first called; a second
   ruleset would be imported in exactly the same way. */
import "./rulesets/mothership.js";

/* Resolved ONCE, at import. See the header of ruleset.js: consumers
   read these at module scope, so a mid-session swap would leave half
   the app holding the old numbers with no error anywhere. */
const RS = activeRuleset();

export const RULESET = RS;

export const CLASSES = RS.classes;
export const SKILL_TREE = RS.skills.tree;
export const PANIC_TABLE = RS.panic.table;
export const PANIC_TRIGGERS = RS.panic.triggers;
export const WAKE_TABLE = RS.wake;
export const TRINKETS = RS.flavour.trinkets;
export const PATCHES = RS.flavour.patches;

export const SKILL_BONUS = RS.skills.bonus;
export const SKILL_COST = RS.skills.cost;
/** Training time in sessions. Rapid Skill Learning house rule halves the long haul. */
export const SKILL_TIME = RS.skills.time;
export const SKILL_TIME_RAPID = RS.skills.timeRapid;

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

export const panicEffect = (total) =>
  PANIC_TABLE.find((r) => total <= r.max) || PANIC_TABLE[PANIC_TABLE.length - 1];

/** RAW panic triggers (PSG 26.2). Used by the UI to explain why a check fired. */
export const STAT_KEYS = RS.stats;
export const SAVE_KEYS = RS.saves;
export const STAT_LABEL = RS.labels;

/* ---------------- derived values ---------------- */

/** Armor Save = base + best worn suit. Armor Points track degradation. */
export function armorSave(pc, items) {
  const worn = (pc.items || [])
    .map((i) => items[i])
    .filter((i) => i && i.armor)
    .map((i) => ({ id: i, armor: i.armor }));
  const base = RS.armorSave ? (pc.saves[RS.armorSave] || 0) : 0;
  if (!worn.length) return base;
  const best = Math.max(...worn.map((w) => w.armor));
  const lost = pc.armorDamage || 0;
  return base + Math.max(0, best - lost);
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
  /* `armorSave` was compared against the literal "armor". A ruleset
     that calls its protection something else was silently getting the
     unmodified save with no worn armour added to it. */
  if (kind === "save") return name === RS.armorSave ? armorSave(pc, items) : pc.saves[name];
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
  return RS.rollStats();
}

let PC_SEQ = 0;
export const newPcId = () => `pc${++PC_SEQ}_${Math.random().toString(36).slice(2, 7)}`;

export function makeCharacter({ name, cls, stats, skills, loadout, trinket, patch }, { items, loadouts, meters = {} }) {
  /* A ruleset with no classes is legitimate — see ruleset.js — so
     this must not assume one was found. Previously `c.bonus` on an
     unknown class threw, which was fine when the four class keys
     were literals in this file and is not now. */
  const c = CLASSES[cls] || { bonus: {}, saves: {} };
  const s = { ...stats };
  Object.entries(c.bonus || {}).forEach(([k, v]) => (s[k] += v));
  const kit = loadouts[loadout];
  const maxHealth = RS.health(s);
  return {
    id: newPcId(),
    name: name || "UNNAMED",
    cls, level: 0, xp: 0,
    stats: s,
    saves: { ...c.saves },
    maxHealth, health: maxHealth,
    stress: RS.startingStress, resolve: 0,
    wounds: 0, maxWounds: RS.maxWounds,
    skills: [...skills],
    items: kit ? [...kit.items].filter((i) => items[i]) : [],
    ammo: {},          // itemId -> shots remaining in the weapon
    spare: {},         // itemId -> spare magazines / reloads
    uses: {},          // consumable charges spent
    buffs: [],         // timed modifier grants (drugs, aiming, adrenaline)
    credits: RS.startingCredits(),
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
