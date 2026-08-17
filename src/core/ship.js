/* ============================================================
   SHIPS — the module/hull model from PSG 27-31.

   A ship is not a bag of numbers, it is a bill of materials.
   You buy MODULES; hull, stats, fuel capacity and crew limits
   all fall out of that. So this file stores only the module
   counts and derives everything else, which means a ship that
   loses a Thruster to a Critical Hit recomputes its Speed for
   free rather than needing the damage code to remember to.

   All functions here are pure. Nothing imports React, and
   nothing imports the module/cartridge system either — a ship
   is engine furniture, not module content.
   ============================================================ */

/* ---------------- module catalogue ---------------- */

const tri = (n) => (n * (n + 1)) / 2; // 1st drive 1 hull, 2nd 2, 3rd 3...

/**
 * Every module: what it costs in hull and what it is for.
 * `hull` is a function of the whole spec so that modules whose
 * cost depends on other modules (thrusters, engine, frame) can
 * say so honestly instead of being special-cased elsewhere.
 */
export const MODULES = {
  /* --- primary (required or near-required) --- */
  lifeSupport: {
    name: "Life Support", required: true, primary: true,
    hull: (m) => m.lifeSupport,
    blurb: "Each point keeps 10 humans breathing. Androids don't count.",
  },
  command: {
    name: "Command", required: true, primary: true,
    hull: (m) => m.command,
    blurb: "Bridge. One module per 4 officer positions.",
  },
  armor: {
    name: "Armor", required: true, primary: true,
    hull: (m) => m.armor * 3,
    blurb: "3 hull per point. +10% Armor Save each, to a maximum of 80.",
  },
  weaponMount: {
    name: "Weapon Mount", primary: true,
    hull: (m) => m.weaponMount,
    blurb: "One mount per weapon.",
  },
  medbay: {
    name: "Medical Bay", primary: true,
    hull: (m) => m.medbay,
    blurb: "+5% Intellect each to Scientists and Androids. Advantage on Body Saves to heal.",
  },
  jumpDrive: {
    name: "Jump Drive", primary: true,
    hull: (m) => tri(m.jumpDrive),
    blurb: "Each point is one jump rating, max 9. Costs escalate: 1, 2, 3...",
  },

  /* --- secondary --- */
  scienceLab: {
    name: "Science Lab",
    hull: (m) => m.scienceLab,
    blurb: "+5% Intellect each for research. Doubles as a repair shop.",
  },
  cryo: {
    name: "Cryochamber",
    hull: (m) => m.cryo,
    blurb: "4 cryopods per hull point. Staying awake through a jump is its own problem.",
  },
  livingQuarters: {
    name: "Living Quarters",
    hull: (m) => m.livingQuarters,
    blurb: "Private staterooms for officers. Without them: +1 Stress per journey.",
  },
  barracks: {
    name: "Barracks",
    hull: (m) => m.barracks,
    blurb: "Bunks for up to 12. Without them: +1 Stress per journey.",
  },
  cargoHold: {
    name: "Cargo Hold",
    hull: (m) => m.cargoHold,
    blurb: "10 cargo units each. Also the answer to brigs, hangars and armouries.",
  },
  computer: {
    name: "Computer",
    hull: (m) => m.computer,
    blurb: "Intellect ×10+30, Combat ×10+10. One per jump drive. Each grants a combat action.",
  },
  galley: {
    name: "Galley",
    hull: (m) => m.galley,
    blurb: "One per 2 Life Support on trips over a day. Holds a month of food.",
  },

  /* --- derived-requirement modules --- */
  thrusters: {
    name: "Thrusters", required: true, derived: true,
    hull: (m, base) => (m.thrusters ? m.thrusters + Math.ceil(base / 10) : 0),
    blurb: "+10% Speed each, max 80. Costs an extra hull per 10 base hull.",
  },
  engine: {
    name: "Engine", required: true, derived: true,
    hull: (m) => m.engine,
    blurb: "One per jump drive, plus one per 4 thrusters, plus one per 20 base hull.",
  },
  fuel: {
    name: "Fuel", required: true, derived: true,
    hull: (m) => m.fuel,
    blurb: "3 per engine point, minimum. Extra capacity is extra hull.",
  },
  frame: {
    name: "Frame", required: true, derived: true,
    hull: (m) => m.frame,
    blurb: "Corridors, airlocks, vents, comms. 1 per 10 base hull.",
  },
};

export const MODULE_KEYS = Object.keys(MODULES);

const ZERO = MODULE_KEYS.reduce((a, k) => { a[k] = 0; return a; }, {});

/* ---------------- ship classes (PSG 28) ---------------- */

export const SHIP_CLASSES = {
  escapePod: { name: "Escape Pod", min: 20, max: 35, requires: {}, note: "Can drop-land on a surface." },
  utilityPod: { name: "Utility Pod", min: 22, max: 45, requires: { weaponMount: 1, cargoHold: 1 }, note: "External maintenance and repair." },
  fighter: { name: "Fighter", min: 34, max: 68, requires: { armor: 3, weaponMount: 1, thrusters: 3 }, note: "The pilot fires from the command module." },
  shuttle: { name: "Shuttle", min: 25, max: 50, requires: { galley: 1, livingQuarters: 1, cargoHold: 1 }, note: "Usually hangared inside something larger." },
  courier: { name: "Courier", min: 30, max: 60, requires: { jumpDrive: 1, computer: 1, galley: 1, cryo: 1, livingQuarters: 1, cargoHold: 1, thrusters: 3 }, note: "Fast. Built for messages and people who need to leave." },
  research: { name: "Research Vessel", min: 35, max: 90, requires: { computer: 1, galley: 1, livingQuarters: 1, barracks: 1, cargoHold: 1, scienceLab: 1 }, note: "Sent to look at things that should not be looked at." },
  cutter: { name: "Cutter", min: 50, max: 125, requires: { armor: 3, galley: 1, weaponMount: 3, medbay: 1, livingQuarters: 2, barracks: 1, cargoHold: 1, thrusters: 3 }, note: "Police and patrol. Often an escort." },
};

/* ---------------- ship weapons (PSG 30.3) ---------------- */

export const SHIP_WEAPONS = {
  laserCutter: { name: "Laser Cutter", dmg: "1d10", mdmg: true, shots: 12, mounts: 1, charge: 1, cooldownDays: 1, cost: 45000, note: "One round to charge. A full day to recharge after 12." },
  autocannon: { name: "Autocannon", dmg: "2d10", mdmg: true, shots: 24, mounts: 1, automatable: true, cost: 120000, note: "The default for anything travelling the far reaches." },
  railgun: { name: "Railgun", dmg: "1d10+10", mdmg: true, shots: 12, mounts: 2, automatable: false, cost: 400000, note: "Military. Takes two mounts and will not accept automation." },
  turrets: { name: "Machine Gun Turrets", dmg: "5d10", mdmg: false, shots: 36, mounts: 1, automatable: true, cost: 30000, note: "Anti-personnel. Does normal damage, not megadamage." },
  torpedoes: { name: "Torpedoes", dmg: "3d10", mdmg: true, shots: 2, mounts: 1, critOnHit: true, targetArmorAdv: true, cost: 250000, note: "Rolls on the Critical Hit table on any hit. The target saves at Advantage." },
  riggingGun: { name: "Rigging Gun", dmg: "1", mdmg: true, shots: 3, mounts: 1, grapple: true, cost: 20000, note: "Barely scratches. Attaches the two ships together, which is the point." },
};

/* ---------------- travel time (PSG 27.1) ---------------- */

export const TRAVEL_TIME = [
  { maxSpeed: 30, interplanetary: "weeks", interstellar: "years", intergalactic: "millennia" },
  { maxSpeed: 50, interplanetary: "days", interstellar: "months", intergalactic: "decades" },
  { maxSpeed: 80, interplanetary: "hours", interstellar: "weeks", intergalactic: "years" },
];

export const travelTime = (speed) =>
  TRAVEL_TIME.find((t) => speed <= t.maxSpeed) || TRAVEL_TIME[TRAVEL_TIME.length - 1];

/* ---------------- derivation ---------------- */

/**
 * Work out the required modules (thrusters surcharge, engine,
 * fuel, frame) from the discretionary ones. Returns a full
 * module record. Callers give us what they *want*; this tells
 * them what they must therefore also carry.
 */
export function completeModules(want = {}) {
  const m = { ...ZERO, ...want };

  // A jump drive is useless without a computer to astrogate with.
  // This has to happen BEFORE base hull is totalled, or the hull
  // the forced computer occupies goes unpaid for.
  m.computer = Math.max(m.computer, m.jumpDrive);

  const baseKeys = ["lifeSupport", "command", "armor", "weaponMount", "medbay", "jumpDrive",
    "scienceLab", "cryo", "livingQuarters", "barracks", "cargoHold", "computer", "galley"];
  const baseHull = baseKeys.reduce((n, k) => n + MODULES[k].hull(m), 0);

  m.engine = Math.max(
    m.engine,
    m.jumpDrive + Math.ceil(m.thrusters / 4) + Math.ceil(baseHull / 20)
  );
  const minFuel = m.engine * 3;
  m.fuel = Math.max(m.fuel, minFuel);
  m.frame = Math.max(m.frame, Math.ceil(baseHull / 10));

  return { modules: m, baseHull, minFuel };
}

/**
 * Everything the sheet computes for you. `damage` is a record of
 * modules knocked out by Critical Hits; it is subtracted from the
 * module counts before deriving stats, which is how losing a
 * Thruster costs you 10% Speed without any extra bookkeeping.
 */
export function derive(ship) {
  const dmg = ship.moduleDamage || {};
  const live = {};
  for (const k of MODULE_KEYS) live[k] = Math.max(0, (ship.modules[k] || 0) - (dmg[k] || 0));

  const { baseHull } = completeModules(ship.modules);
  const thrusterHull = MODULES.thrusters.hull(ship.modules, baseHull);
  const maxHull = baseHull + thrusterHull + ship.modules.engine + ship.modules.fuel + ship.modules.frame;

  const armorSave = Math.min(80, live.armor * 10);
  const speed = Math.min(80, live.thrusters * 10);
  const intellect = live.computer * 10 + 30;
  const combat = live.computer * 10 + 10;

  return {
    live,
    baseHull,
    maxHull,
    armorSave,
    speed,
    intellect,
    combat,
    sanitySave: intellect,          // "the ship's Intellect is also its Sanity Save"
    jumpRating: Math.min(9, live.jumpDrive),
    maxFuel: ship.modules.fuel,
    maxCargo: live.cargoHold * 10,
    maxCrew: live.lifeSupport * 10,
    cryoPods: live.cryo * 4,
    galleyMonths: live.galley,
    computerActions: live.computer, // actions per round in ship combat
    medbayBonus: live.medbay * 5,
    labBonus: live.scienceLab * 5,
    weaponSlots: live.weaponMount,
    thresholds: {
      t25: Math.floor(maxHull * 0.75),  // hull remaining when 25% is gone
      t50: Math.floor(maxHull * 0.50),
      t75: Math.floor(maxHull * 0.25),
    },
    cost: maxHull * 10_000_000,
  };
}

/* ---------------- construction ---------------- */

let SHIP_SEQ = 0;

export function makeShip({ id, name, className, modules, weapons = [], fuel, cargo = [], debt, crewIds = [] }) {
  const cls = SHIP_CLASSES[className] || null;
  const want = { ...(cls ? cls.requires : {}), ...modules };
  const { modules: full } = completeModules(want);

  const ship = {
    id: id || `ship${++SHIP_SEQ}`,
    name: name || "UNNAMED HULL",
    className: className || null,
    classLabel: cls ? cls.name : "Custom",
    modules: full,
    moduleDamage: {},
    weapons: weapons.map((w, i) => ({
      uid: `w${i}`,
      key: w.key || w,
      loaded: SHIP_WEAPONS[w.key || w] ? SHIP_WEAPONS[w.key || w].shots : 0,
      disabled: false,
      charging: 0,
      automated: !!w.automated,
    })),
    hull: 0,
    fuel: 0,
    galleyStock: 0,
    cargo,
    crewIds,
    debt: debt || 0,
    /* condition flags set by Critical Hits */
    armorBreached: false,
    navDataWiped: false,
    navDamaged: false,
    gravityOut: false,
    systemsDownRounds: 0,
    computerDownRounds: 0,
    fires: [],
    breaches: [],
    rebootRounds: 0,
    doomed: null,          // {reason, roundsLeft} — fuel line, etc.
    crossed: {},           // which 25/50/75 thresholds have already fired
    firstDamageTaken: false,
    repairUsed: false,     // one field repair attempt per port visit
    log: [],
  };

  const d = derive(ship);
  ship.hull = d.maxHull;
  ship.fuel = fuel != null ? fuel : d.maxFuel;
  ship.galleyStock = d.galleyMonths;
  return ship;
}

/** The Falstaff, the book's own worked example. A usable default. */
export const FALSTAFF = () => makeShip({
  name: "THE FALSTAFF",
  className: "research",
  modules: {
    lifeSupport: 2, command: 1, armor: 2, weaponMount: 1, medbay: 1, jumpDrive: 2,
    scienceLab: 1, cryo: 2, livingQuarters: 4, barracks: 1, cargoHold: 3,
    computer: 1, galley: 1, thrusters: 4,
  },
  weapons: [{ key: "laserCutter" }, { key: "autocannon", automated: true }],
  debt: 0,
});

/* ---------------- fuel, galley, life support ---------------- */

/** Jump cost. The book contradicts itself; the house rule picks. */
export const jumpFuelCost = (rating, doubled = true) => (doubled ? rating * 2 : rating);

export const FUEL_BURN = {
  thrusterDay: 1,        // 1 unit/day under thrust
  orbitWeek: 1,          // 1 unit/week parked in orbit
  launch: 3,             // leaving an average-gravity surface
};

/** Is life support able to carry everyone aboard? */
export function lifeSupportStatus(ship, headcount) {
  const d = derive(ship);
  const required = Math.ceil(headcount / 10);
  const have = d.live.lifeSupport;
  return {
    have, required, headcount,
    shortfall: Math.max(0, required - have),
    ok: have >= required,
  };
}

/** Galley requirement: 1 per 2 Life Support, for trips over a day. */
export function galleyStatus(ship) {
  const d = derive(ship);
  const required = Math.ceil(d.live.lifeSupport / 2);
  return {
    have: d.live.galley, required,
    stock: ship.galleyStock,
    ok: d.live.galley >= required && ship.galleyStock > 0,
    starving: ship.galleyStock <= 0,
  };
}

/* ---------------- repair & upgrade economics (PSG 28.1) ---------------- */

export const REPAIR_COST_PER_HULL = 100_000;
export const UPGRADE_COST_PER_HULL = 10_000_000;
export const repairDays = (hull) => Math.max(1, Math.ceil(hull / 10));
export const upgradeWeeks = (hull) => Math.max(1, Math.ceil(hull / 10));

/**
 * A field repair cannot take the ship back past a threshold it has
 * already crossed — that needs a starport. Returns the hull ceiling
 * a crew can currently repair up to.
 */
export function fieldRepairCeiling(ship) {
  const d = derive(ship);
  if (ship.crossed.t75) return d.thresholds.t75;
  if (ship.crossed.t50) return d.thresholds.t50;
  if (ship.crossed.t25) return d.thresholds.t25;
  return d.maxHull;
}

/** 1 hull per 5 points the Intellect Check succeeded by. */
export const repairAmount = (margin) => Math.max(0, Math.floor(margin / 5));
