/* ============================================================
   SHIP CRITICAL HITS — PSG 34.1.

   This is the table that actually kills ships. Hull attrition
   almost never does; a bad roll here does.

   Three rules make it more than a lookup:

   1. TRIGGERS. It fires on a Critical Hit, on a critically failed
      Armor Save, the FIRST time the ship takes damage at all, on
      crossing 25/50/75% hull lost, and on any damage taken at 20
      hull or less. A ship in bad shape rolls on this constantly.

   2. DOUBLES CASCADE. Doubles means roll again. And again. One
      hit can dismantle an entire ship.

   3. FALLBACK. If an effect can't happen — all weapons already
      dead — you take the next entry ABOVE instead. So a wrecked
      ship's rolls slide downward into the cheap results, which is
      a surprisingly humane bit of design.

   Crew consequences are returned as `demands` rather than applied
   here, because this module knows about ships and refuses to know
   about characters. The host resolves them against real PCs.
   ============================================================ */
import { rollPercent, evalDicePure, pick, rollDie } from "./rng.js";
import { derive, MODULE_KEYS } from "./ship.js";

const dmgModule = (ship, key, n = 1) => ({
  ...ship,
  moduleDamage: { ...ship.moduleDamage, [key]: (ship.moduleDamage[key] || 0) + n },
});

const NON_ESSENTIAL = ["livingQuarters", "barracks", "scienceLab", "medbay", "galley", "cargoHold"];

/**
 * The table. `lo`/`hi` are inclusive d100 bounds.
 * `can(ship)`   — is this effect still possible?
 * `apply(ship, rng, ctx)` — returns { ship, rng, text, demands }
 */
export const CRIT_TABLE = [
  {
    lo: 0, hi: 9, name: "Cargo Destroyed",
    can: (s) => (s.cargo || []).length > 0,
    apply(s, rng) {
      const [n, r1] = evalDicePure(rng, "1d10");
      const lost = Math.min(n, s.cargo.length);
      const kept = s.cargo.slice(0, s.cargo.length - lost);
      const gone = s.cargo.slice(s.cargo.length - lost);
      return {
        ship: { ...s, cargo: kept }, rng: r1,
        text: `CARGO DESTROYED. ${lost} unit${lost === 1 ? "" : "s"} gone: ${gone.map((c) => (c.name || c)).join(", ")}.`,
      };
    },
  },
  {
    lo: 10, hi: 14, name: "Life Support System",
    can: (s) => derive(s).live.lifeSupport > 0,
    apply(s, rng) {
      return {
        ship: dmgModule(s, "lifeSupport"), rng,
        text: "LIFE SUPPORT. One module gone. The air stops being a given.",
      };
    },
  },
  {
    lo: 15, hi: 19, name: "Massive Hull Damage",
    can: () => true,
    apply(s, rng, ctx) {
      const extra = ctx.damage || 0;
      return {
        ship: { ...s, hull: Math.max(0, s.hull - extra) }, rng,
        text: `MASSIVE HULL DAMAGE. The hit lands twice — a further ${extra} hull.`,
        demands: [{ kind: "bodySave", who: "all", dmg: "1d10", why: "the ship folding around you" }],
      };
    },
  },
  {
    lo: 20, hi: 24, name: "Armor Breach",
    can: (s) => !s.armorBreached,
    apply: (s, rng) => ({
      ship: { ...s, armorBreached: true }, rng,
      text: "ARMOR BREACH. Armor Saves at Disadvantage until this is repaired.",
    }),
  },
  {
    lo: 25, hi: 29, name: "Data Storage Wiped",
    can: (s) => !s.navDataWiped,
    apply: (s, rng) => ({
      ship: { ...s, navDataWiped: true }, rng,
      text: "DATA STORAGE WIPED. Navigation and research data gone. Nobody on board knows where you are.",
    }),
  },
  {
    lo: 30, hi: 34, name: "Thrusters",
    can: (s) => derive(s).live.thrusters > 0,
    apply: (s, rng) => ({
      ship: dmgModule(s, "thrusters"), rng,
      text: "THRUSTERS. One module gone. −10% Speed.",
    }),
  },
  {
    lo: 35, hi: 39, name: "Room Destroyed",
    can: (s) => NON_ESSENTIAL.some((k) => derive(s).live[k] > 0),
    apply(s, rng) {
      const live = derive(s).live;
      const [key, r1] = pick(rng, NON_ESSENTIAL.filter((k) => live[k] > 0));
      return {
        ship: dmgModule(s, key), rng: r1,
        text: `ROOM DESTROYED. ${key.replace(/([A-Z])/g, " $1").toUpperCase()} is opened to vacuum.`,
        demands: [{ kind: "bodySave", who: "room", room: key, fatal: true, why: "the room coming apart" }],
      };
    },
  },
  {
    lo: 40, hi: 44, name: "Weapon Disabled",
    can: (s) => s.weapons.some((w) => !w.disabled),
    apply(s, rng) {
      const live = s.weapons.filter((w) => !w.disabled);
      const [target, r1] = pick(rng, live);
      return {
        ship: { ...s, weapons: s.weapons.map((w) => (w.uid === target.uid ? { ...w, disabled: true } : w)) },
        rng: r1,
        text: `WEAPON DISABLED. The ${target.key} will not fire until it is repaired.`,
      };
    },
  },
  {
    lo: 45, hi: 49, name: "Jump Drive",
    can: (s) => derive(s).live.jumpDrive > 0,
    apply: (s, rng) => ({
      ship: dmgModule(s, "jumpDrive"), rng,
      text: "JUMP DRIVE. One point of rating gone. Wherever you were going just got further away.",
    }),
  },
  {
    lo: 50, hi: 54, name: "Engines",
    can: (s) => derive(s).live.engine > 0,
    apply: (s, rng) => ({
      ship: dmgModule(s, "engine"), rng,
      text: "ENGINES. One engine module gone.",
    }),
  },
  {
    lo: 55, hi: 59, name: "System Overload",
    can: (s) => s.computerDownRounds <= 0,
    apply(s, rng) {
      const [n, r1] = evalDicePure(rng, "1d10");
      return {
        ship: { ...s, computerDownRounds: n, combatPenalty: (s.combatPenalty || 0) + 10 }, rng: r1,
        text: `SYSTEM OVERLOAD. Computer and Jump Drives dead for ${n} round${n === 1 ? "" : "s"} unless repaired. −10% Combat.`,
      };
    },
  },
  {
    lo: 60, hi: 64, name: "Artificial Gravity",
    can: (s) => !s.gravityOut,
    apply: (s, rng) => ({
      ship: { ...s, gravityOut: true }, rng,
      text: "ARTIFICIAL GRAVITY. Everything that was resting on something is now travelling.",
      demands: [{ kind: "bodySave", who: "all", dmg: "1d10", why: "the floor letting go" }],
    }),
  },
  {
    lo: 65, hi: 69, name: "EMP",
    can: () => true,
    apply: (s, rng) => ({
      ship: { ...s, systemsDownRounds: Math.max(s.systemsDownRounds, 1) }, rng,
      text: "EMP. Everything shuts down for a round. Androids drop where they stand and will need rebooting.",
      demands: [{ kind: "androidShutdown", why: "an electromagnetic pulse" }],
    }),
  },
  {
    lo: 70, hi: 74, name: "Cryosleep Chambers",
    can: (s) => derive(s).cryoPods > 0,
    apply(s, rng) {
      const [n, r1] = evalDicePure(rng, "1d10");
      const pods = derive(s).cryoPods;
      const lost = Math.min(n, pods);
      return {
        ship: dmgModule(s, "cryo", Math.ceil(lost / 4)), rng: r1,
        text: `CRYOSLEEP CHAMBERS. ${lost} pod${lost === 1 ? "" : "s"} destroyed. Whoever was inside them did not wake up first.`,
        demands: [{ kind: "cryoLoss", count: lost }],
      };
    },
  },
  {
    lo: 75, hi: 79, name: "Hull Breach",
    can: () => true,
    apply(s, rng) {
      const live = derive(s).live;
      const rooms = MODULE_KEYS.filter((k) => live[k] > 0);
      const [room, r1] = pick(rng, rooms);
      return {
        ship: { ...s, breaches: [...s.breaches, { room, sealed: false }] }, rng: r1,
        text: `HULL BREACH. ${String(room).toUpperCase()} is depressurising. Seal the airlocks or start counting suits.`,
        demands: [{ kind: "bodySave", who: "room", room, mode: "disadvantage", fatal: true, why: "being near the breach" }],
      };
    },
  },
  {
    lo: 80, hi: 84, name: "Navigation Controls",
    can: (s) => !s.navDamaged,
    apply: (s, rng) => ({
      ship: { ...s, navDamaged: true }, rng,
      text: "NAVIGATION CONTROLS. The ship cannot change direction until someone repairs them.",
    }),
  },
  {
    lo: 85, hi: 89, name: "Internal Fire",
    can: () => true,
    apply(s, rng) {
      const live = derive(s).live;
      const rooms = MODULE_KEYS.filter((k) => live[k] > 0);
      const [room, r1] = pick(rng, rooms);
      const [turns, r2] = evalDicePure(r1, "1d10");
      return {
        ship: { ...s, fires: [...s.fires, { room, turnsLeft: turns }] }, rng: r2,
        text: `INTERNAL FIRE in ${String(room).toUpperCase()}. It spreads one room a turn and takes this one in ${turns}.`,
      };
    },
  },
  {
    lo: 90, hi: 94, name: "System Reboot",
    can: (s) => s.rebootRounds <= 0,
    apply(s, rng) {
      const [n, r1] = evalDicePure(rng, "1d10");
      return {
        ship: { ...s, rebootRounds: n, systemsDownRounds: Math.max(s.systemsDownRounds, n) }, rng: r1,
        text: `SYSTEM REBOOT. The entire ship stops being a ship for ${n} turn${n === 1 ? "" : "s"}.`,
      };
    },
  },
  {
    lo: 95, hi: 98, name: "Bridge Destroyed",
    can: (s) => derive(s).live.command > 0,
    apply: (s, rng) => ({
      ship: dmgModule(s, "command"), rng,
      text: "BRIDGE DESTROYED. Whoever was flying this is now a passenger, briefly.",
      demands: [{ kind: "bodySave", who: "room", room: "command", fatal: true, why: "the bridge going" }],
    }),
  },
  {
    lo: 99, hi: 99, name: "Fuel Line",
    can: () => true,
    apply(s, rng) {
      const [turns, r1] = evalDicePure(rng, "1d10");
      return {
        ship: { ...s, doomed: { reason: "fuel line", roundsLeft: turns } }, rng: r1,
        text: `FUEL LINE. The ship is destroyed in ${turns} turn${turns === 1 ? "" : "s"}. That is not a threat, it is a schedule.`,
      };
    },
  },
];

export const entryFor = (roll) => CRIT_TABLE.find((e) => roll >= e.lo && roll <= e.hi) || CRIT_TABLE[0];

/**
 * "If a Critical Hit Effect cannot be accomplished then use the
 * next entry above on the table." Walk upward; wrap once so a
 * thoroughly dismantled ship still resolves to something.
 */
export function resolveEntry(roll, ship) {
  const start = CRIT_TABLE.indexOf(entryFor(roll));
  for (let i = 0; i < CRIT_TABLE.length; i++) {
    const idx = (start - i + CRIT_TABLE.length) % CRIT_TABLE.length;
    if (CRIT_TABLE[idx].can(ship)) return { entry: CRIT_TABLE[idx], slid: i };
  }
  return { entry: CRIT_TABLE[0], slid: 0 };
}

/**
 * Roll the table once, cascading on doubles.
 * @returns {{ship, rng, results: Array, demands: Array}}
 */
export function rollCriticalHit(ship, rng, ctx = {}, depth = 0) {
  const [roll, r1] = rollPercent(rng);
  const { entry, slid } = resolveEntry(roll.value, ship);

  const out = entry.apply(ship, r1, ctx);
  const results = [{
    roll: roll.value, tens: roll.tens, ones: roll.ones, doubles: roll.doubles,
    name: entry.name, slid, text: out.text,
  }];
  let demands = out.demands || [];
  let s = out.ship;
  let r = out.rng;

  // Doubles: roll again. Cap the cascade so a pathological seed
  // cannot hang the reducer — 6 systems is already total doom.
  if (roll.doubles && depth < 6) {
    const again = rollCriticalHit(s, r, ctx, depth + 1);
    s = again.ship; r = again.rng;
    results.push(...again.results);
    demands = [...demands, ...again.demands];
  }

  return { ship: s, rng: r, results, demands };
}

/** Which trigger conditions a given hit satisfies (PSG 34.1). */
export function critTriggers(ship, before, after, opts = {}) {
  const d = derive(ship);
  const t = [];
  if (opts.critHit) t.push("a critical hit");
  if (opts.critFailedArmorSave) t.push("a critically failed Armor Save");
  if (!ship.firstDamageTaken) t.push("the first damage this hull has taken");
  if (before > d.thresholds.t25 && after <= d.thresholds.t25 && !ship.crossed.t25) t.push("25% of hull lost");
  if (before > d.thresholds.t50 && after <= d.thresholds.t50 && !ship.crossed.t50) t.push("50% of hull lost");
  if (before > d.thresholds.t75 && after <= d.thresholds.t75 && !ship.crossed.t75) t.push("75% of hull lost");
  if (before <= 20) t.push("damage taken below 20 hull");
  return t;
}
