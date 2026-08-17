/* ============================================================
   GEAR — the standard Player's Survival Guide kit.
   Modules merge their own items on top of this table.

   Item fields the engine understands:
     n, d            name and description
     cost            credits (PSG equipment list)
     armor: n        adds to Armor Save; also the item's Armor Points
     tag: "WPN"      appears in the combat weapon list
     dmg: "2d10"     damage expression
     range:{s,m,l}   metres. Short = no penalty, Medium = -10,
                     Long = Disadvantage, beyond Long = out of reach
     melee: true     close quarters only; uses Close-Quarters Combat
     shots: n        magazine capacity
     spare: n        spare reloads carried by default
     auto: true      fully automatic: one burst then reload, unless the
                     shooter has Firearms or Military Training (then
                     `burst` shots before reloading)
     burst: n        shots per burst for trained shooters
     vsArmor: -10    defender subtracts this from their Armor Save
     crit: {...}     what a Critical Success does with this weapon:
                       mult: 2|3          damage multiplier
                       limb: true         hacks off a limb
                       bleed: "1d10"      ongoing damage per round
                       knockdown: true    target is prone
                       knockback: true    target is shoved
                       impale: "1d10"     extra damage when pulled out
                       save: "body"       target saves or suffers `saveText`
     uses: n         consumable charges
     heal: "2d10"    healing when used
     calm: n         Stress removed when used
     grants: [...]   modifier grants, see modifiers.js
     loud: true      firing it makes noise
     cuts: true      can cut through doors and airlocks
     water/ir/light/vacc/scanner/player  module vocabulary
   ============================================================ */

export const GEAR = {
  /* ---- tools & cutting ---- */
  crowbar: {
    n: "Crowbar", cost: 50,
    d: "Advantage on Strength Checks to force doors or lift weight. +5 Mechanical Repair. 1d10 damage, close quarters.",
    dmg: "1d10", tag: "WPN", melee: true,
    grants: [
      { kind: "stat", name: "strength", tags: ["force", "pry", "lift"], adv: true },
      { tags: ["repair", "mechanical"], bonus: 5 },
    ],
  },
  handwelder: {
    n: "Hand Welder", cost: 250,
    d: "Ultra heat emitter. Cuts through airlocks and heavy doors. 1d10 damage, -10 vs Armor Save.",
    dmg: "1d10", tag: "WPN", melee: true, cuts: true, vsArmor: -10,
    grants: [{ tags: ["cut", "door", "weld"], bonus: 10 }],
  },
  lasercutter: {
    n: "Laser Cutter", cost: 1200,
    d: "Wide beam. d% damage. One round to recharge between shots. 6 shots.",
    dmg: "d%", tag: "WPN", shots: 6, spare: 0, cuts: true, recharge: 1,
    range: { s: 25, m: 250, l: 700 },
    grants: [{ tags: ["cut", "door"], bonus: 10 }],
  },
  lockpicks: {
    n: "Lockpick Set", cost: 400,
    d: "+10% on rolls to open airlock and electronic door systems.",
    grants: [{ tags: ["lockpick", "door", "electronic"], bonus: 10 }],
  },
  toolkit: {
    n: "Electronic Tool Set", cost: 100,
    d: "+10% to repairing electronics.",
    grants: [{ tags: ["repair", "electronic"], bonus: 10 }],
  },

  /* ---- sensing ---- */
  bodycam: { n: "Body Cam", cost: 200, d: "Streams what you see back to a terminal." },
  bioscanner: { n: "Bioscanner", cost: 1000, d: "Scans 100m for signs of life. Tells you where, not what.", scanner: true },
  medscanner: {
    n: "Medscanner", cost: 800, d: "Reads a living or dead body for disease and abnormality. +10 to diagnose.",
    grants: [{ tags: ["diagnose", "medical"], bonus: 10 }],
  },
  cybscanner: {
    n: "Cybernetic Diagnostic Scanner", cost: 800, d: "Diagnoses androids. Androids hate it. +10 on android diagnosis.",
    grants: [{ tags: ["android", "diagnose"], bonus: 10 }],
  },
  irgoggles: { n: "Infrared Goggles", cost: 1500, d: "Heat signatures, sometimes hours old.", ir: true },
  binoculars: { n: "Binoculars", cost: 150, d: "20x. Thermal and night options.", grants: [{ tags: ["observe", "spot"], bonus: 10 }] },
  flashlight: { n: "Flashlight", cost: 50, d: "Illuminates 20m ahead.", light: true },
  surveykit: { n: "Survey Kit", cost: 1000, d: "Maps a few kilometres of surface. Reads atmosphere and gravity.", grants: [{ tags: ["survey", "geology"], bonus: 10 }] },
  locator: { n: "Locator", cost: 200, d: "Lets a terminal track where you are." },
  hud: {
    n: "Heads-Up Display", cost: 100,
    d: "See through squad body cams. Enables smart-link targeting.",
    grants: [{ kind: "stat", name: "combat", tags: ["smartlink"], bonus: 5 }],
  },

  /* ---- suits & armour ---- */
  vaccsuit: {
    n: "Vaccsuit", cost: 10000,
    d: "+7% Armor. Speed Checks at Disadvantage. Needs an oxygen tank.",
    armor: 7, vacc: true,
    grants: [{ kind: "stat", name: "speed", dis: true }],
  },
  hazardsuit: {
    n: "Hazard Suit", cost: 4000,
    d: "+5% Armor. Air filtration, one hour of stored air. +10 Body Saves against airborne contaminants.",
    armor: 5, vacc: true,
    grants: [{ kind: "save", name: "body", tags: ["airborne", "gas", "toxin"], bonus: 10 }],
  },
  battledress: { n: "Standard Battle Dress", cost: 2000, d: "+10% Armor. Light plate.", armor: 10 },
  advbattledress: {
    n: "Advanced Battle Dress", cost: 12000, d: "+20% Armor. Powered. Integrated HUD.",
    armor: 20, grants: [{ kind: "stat", name: "combat", tags: ["smartlink"], bonus: 5 }],
  },
  o2tank: { n: "Oxygen Tank", cost: 50, d: "12 hours of air. 6 under stress. Explosive." },
  magboots: { n: "Mag-Boots", cost: 300, d: "Magnetic grip on hull plate and metal asteroid.", grants: [{ tags: ["zerog", "climb"], bonus: 10 }] },
  rebreather: { n: "Rebreather", cost: 500, d: "Twenty minutes of filtered air." },
  radio: { n: "Short-range Comms", cost: 100, d: "Surface-to-surface within a dozen kilometres." },
  longcomms: { n: "Long-range Comms", cost: 500, d: "Orbit-to-surface. Slow, and everyone can hear it." },

  /* ---- melee ---- */
  vibechete: {
    n: "Vibechete", cost: 75,
    d: "2d10 damage, close quarters. A critical hacks off a limb. Won't cut airlocks.",
    dmg: "2d10", tag: "WPN", melee: true, crit: { limb: true, mult: 2 },
  },
  scalpel: {
    n: "Scalpel", cost: 50,
    d: "1d10 damage, close quarters. A critical adds 1d10 and starts a bleed. +10 Surgery.",
    dmg: "1d10", tag: "WPN", melee: true, crit: { mult: 1, bonus: "1d10", bleed: "1d10" },
    grants: [{ tags: ["surgery", "medical"], bonus: 10 }],
  },
  stunbaton: {
    n: "Stun Baton", cost: 115,
    d: "1d10 damage, close quarters. Body Save or stunned for one round.",
    dmg: "1d10", tag: "WPN", melee: true,
    onHit: { save: "body", saveText: "stunned for a round", condition: "Stunned" },
  },
  boneknife: { n: "Bone Knife", cost: 25, d: "1d5 damage, close quarters. Better than nothing.", dmg: "1d5", tag: "WPN", melee: true },

  /* ---- firearms ---- */
  flaregun: {
    n: "Flare Gun", cost: 85,
    d: "1d10 damage. High-intensity flare visible from 25km. 2 shots.",
    dmg: "1d10", tag: "WPN", shots: 2, spare: 2, range: { s: 5, m: 10, l: 20 }, loud: true,
  },
  rigginggun: {
    n: "Rigging Gun", cost: 350,
    d: "2d10 damage. Impales on a critical - triple damage, and another 1d10 when the grapnel comes out. 500m micro-filament. 1 shot.",
    dmg: "2d10", tag: "WPN", shots: 1, spare: 3, range: { s: 10, m: 30, l: 100 },
    crit: { mult: 3, impale: "1d10" },
  },
  revolver: {
    n: "Revolver", cost: 750,
    d: "3d10 damage. Kineti-slugs, -5 vs Armor Save. Knockdown on a critical. 8 shots.",
    dmg: "3d10", tag: "WPN", shots: 8, spare: 2, range: { s: 20, m: 30, l: 125 },
    vsArmor: -5, loud: true, crit: { mult: 2, knockdown: true },
  },
  smg: {
    n: "SMG", cost: 1200,
    d: "4d10 damage. Fully automatic - 1(5) shots. Empties itself unless you know what you're doing.",
    dmg: "4d10", tag: "WPN", shots: 5, spare: 3, range: { s: 10, m: 75, l: 150 },
    auto: true, burst: 5, loud: true,
  },
  pulserifle: {
    n: "Pulse Rifle", cost: 1600,
    d: "5d10 damage. Fully automatic, 1(3). Phosphorus rounds double damage on a critical. Smart-link: +5 Combat with a HUD.",
    dmg: "5d10", tag: "WPN", shots: 3, spare: 3, range: { s: 15, m: 125, l: 300 },
    auto: true, burst: 3, loud: true, crit: { mult: 2 },
    grants: [{ kind: "stat", name: "combat", tags: ["smartlink"], bonus: 5, needsItem: "hud" }],
  },
  smartrifle: {
    n: "Smart Rifle", cost: 12000,
    d: "1d10 damage, triple on a critical. Armour piercing, -10 vs Armor Save. Smart-link: +10 Combat with a HUD. 12 shots.",
    dmg: "1d10", tag: "WPN", shots: 12, spare: 2, range: { s: 25, m: 200, l: 500 },
    vsArmor: -10, loud: true, crit: { mult: 3 },
    grants: [{ kind: "stat", name: "combat", tags: ["smartlink"], bonus: 10, needsItem: "hud" }],
  },
  shotgun: {
    n: "Combat Shotgun", cost: 1400,
    d: "2d10 damage. Half damage at medium range, quarter at long. Knockback on a hit, knockdown on a critical. 4 shots.",
    dmg: "2d10", tag: "WPN", shots: 4, spare: 3, range: { s: 10, m: 20, l: 30 },
    loud: true, falloff: true, crit: { mult: 2, knockdown: true }, knockback: true,
  },
  nailgun: {
    n: "Nail Gun", cost: 150,
    d: "2d10 damage, double on a critical. Heavy-duty nails, -10 vs Armor Save. 32 shots.",
    dmg: "2d10", tag: "WPN", shots: 32, spare: 1, range: { s: 1, m: 5, l: 10 },
    vsArmor: -10, crit: { mult: 2 },
  },
  tranqpistol: {
    n: "Tranq Pistol", cost: 850,
    d: "No damage. Body Save at Advantage or unconscious for 1d10 rounds. 6 shots.",
    tag: "WPN", shots: 6, spare: 2, range: { s: 2, m: 10, l: 20 }, dmg: "0",
    onHit: { save: "body", saveMode: "advantage", saveText: "unconscious for 1d10 rounds", knockout: "1d10" },
  },
  flamethrower: {
    n: "Flame Thrower", cost: 2000,
    d: "2d10 damage. Body Save or catch fire for 1d10 per round. 8 shots.",
    dmg: "2d10", tag: "WPN", shots: 8, spare: 1, range: { s: 2, m: 10, l: 20 }, loud: true,
    onHit: { save: "body", saveText: "set on fire", bleed: "1d10", condition: "On fire" },
  },
  fraggrenades: {
    n: "Frag Grenades x6", cost: 420,
    d: "1d10 to everything within 15m. Very loud. Six of them.",
    dmg: "1d10", tag: "WPN", shots: 6, spare: 0, range: { s: 20, m: 30, l: 40 },
    loud: true, blast: 15,
  },
  foamgun: {
    n: "Foam Gun", cost: 275,
    d: "No damage. Body Save or become stuck. Fire retardant. 10 shots.",
    tag: "WPN", shots: 10, spare: 1, range: { s: 1, m: 5, l: 10 }, dmg: "0",
    onHit: { save: "body", saveText: "stuck fast", condition: "Foamed" },
  },

  /* ---- medical & drugs ---- */
  firstaid: {
    n: "First Aid Kit", cost: 75,
    d: "Heals 1d5. +10% to bandaging wounds and stopping bleeding.",
    heal: "1d5", uses: 3,
    grants: [{ tags: ["firstaid", "bandage", "bleed"], bonus: 10 }],
  },
  stimpak: {
    n: "Stimpak x6", cost: 3000,
    d: "Heals 2d10. +2d10 Strength and Combat for 1d10 hours. Addictive.",
    uses: 6, heal: "2d10",
    buff: { stats: { strength: "2d10", combat: "2d10" }, hours: "1d10", source: "Stimpak", addictive: true },
  },
  painpills: {
    n: "Pain Pills x6", cost: 500,
    d: "Heals 1d10 and drops Stress by 1. Addictive.",
    uses: 6, heal: "1d10", calm: 1, addictive: true,
  },
  automed: {
    n: "Automed x6", cost: 1000,
    d: "+10% Body Saves against disease and poison, +10% Fear Saves to shed Stress. Lasts an hour.",
    uses: 6,
    buff: {
      hours: 1, source: "Automed",
      grants: [
        { kind: "save", name: "body", tags: ["disease", "poison", "infection"], bonus: 10 },
        { kind: "save", name: "fear", tags: ["rest", "stress"], bonus: 10 },
      ],
    },
  },

  /* ---- sundries ---- */
  waterfilter: { n: "Water Filter", cost: 800, d: "50 litres of clean water an hour from almost anything.", water: true },
  mres: { n: "MREs x7", cost: 70, d: "A week of joyless calories.", uses: 7 },
  campinggear: { n: "Camping Gear", cost: 500, d: "A bag, a bedroll, and a stove. Makes a rough rest merely uncomfortable.", grants: [{ tags: ["rest"], bonus: 5 }] },
};

export const LOADOUTS = {
  excavation: {
    name: "EXCAVATION", note: "Cutting, prying, and seeing in the dark.",
    items: ["crowbar", "handwelder", "lasercutter", "bodycam", "bioscanner", "irgoggles", "lockpicks", "vaccsuit", "o2tank", "magboots", "radio"],
  },
  exploration: {
    name: "EXPLORATION", note: "Long walks somewhere that wants you dead.",
    items: ["vibechete", "rigginggun", "flaregun", "firstaid", "vaccsuit", "o2tank", "longcomms", "surveykit", "waterfilter", "locator", "rebreather", "binoculars", "flashlight", "campinggear", "mres"],
  },
  extermination: {
    name: "EXTERMINATION", note: "For when the answer is ammunition.",
    items: ["smg", "fraggrenades", "battledress", "hud", "bodycam", "radio", "stimpak", "toolkit"],
  },
  examination: {
    name: "EXAMINATION", note: "Field medicine and unwise curiosity.",
    items: ["scalpel", "tranqpistol", "stunbaton", "hazardsuit", "medscanner", "automed", "painpills", "stimpak", "cybscanner"],
  },
};

/** Range band for a shot. Returns { band, penalty, mode, ok }. */
export function rangeBand(weapon, metres) {
  if (weapon.melee) {
    return metres <= 2
      ? { band: "close", penalty: 0, mode: "none", ok: true }
      : { band: "too far", penalty: 0, mode: "none", ok: false };
  }
  const r = weapon.range || { s: 10, m: 30, l: 100 };
  if (metres <= r.s) return { band: "short", penalty: 0, mode: "none", ok: true };
  if (metres <= r.m) return { band: "medium", penalty: -10, mode: "none", ok: true };
  if (metres <= r.l) return { band: "long", penalty: 0, mode: "disadvantage", ok: true };
  return { band: "out of range", penalty: 0, mode: "none", ok: false };
}

/** Shotgun-style damage falloff. */
export function damageScale(weapon, band) {
  if (!weapon.falloff) return 1;
  return band === "medium" ? 0.5 : band === "long" ? 0.25 : 1;
}

/** The shop stocks anything with a price. */
export const catalogue = (items) =>
  Object.entries(items)
    .filter(([, it]) => it.cost > 0)
    .map(([id, it]) => ({ id, ...it }))
    .sort((a, b) => a.cost - b.cost);
