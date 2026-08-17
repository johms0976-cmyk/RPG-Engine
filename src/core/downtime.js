/* ============================================================
   SHORE LEAVE — the between-sessions half of the game.

   Mothership's dungeon is a ship and its downtime is a starport.
   This models the second one: the crew docks, and time becomes
   the resource instead of oxygen. Everything costs weeks and
   credits, and the Profit Save decides how much of the money
   actually survives contact with the port.

   PROVENANCE, honestly stated: recovery, stress relief, repair
   costs and upgrade times are PSG rules (25.2, 28.1, 36.1).
   The Profit Save and the cybermod catalogue are NOT in the
   Player's Survival Guide — they are this engine's house
   implementation of a common Mothership downtime loop, and are
   flagged as such in the UI so a Warden can switch them off.
   ============================================================ */
import { checkPure, evalDicePure, pick, rollDie } from "./rng.js";
import { emit, emitAll } from "./store.js";
import { derive, REPAIR_COST_PER_HULL, UPGRADE_COST_PER_HULL, repairDays, upgradeWeeks } from "./ship.js";

/* ---------------- cybermods (house content) ---------------- */

export const CYBERMODS = {
  neuralLace: {
    name: "Neural Lace", cost: 45000, weeks: 2, house: true,
    effect: { stat: "intellect", bonus: 5 },
    blurb: "+5 Intellect. Thoughts arrive fractionally before you have them.",
    risk: "Sanity Saves at Disadvantage while Stress is 8 or higher.",
  },
  subdermalPlate: {
    name: "Subdermal Plating", cost: 30000, weeks: 3, house: true,
    effect: { save: "armor", bonus: 10 },
    blurb: "+10 Armor Save. You do not set off metal detectors, which cost extra.",
    risk: "−5 Speed. The weight is real.",
  },
  adrenalPump: {
    name: "Adrenal Pump", cost: 38000, weeks: 2, house: true,
    effect: { stat: "speed", bonus: 5 },
    blurb: "+5 Speed. It fires whether or not you asked it to.",
    risk: "+1 Stress the first time it triggers each session.",
  },
  ocularSuite: {
    name: "Ocular Suite", cost: 22000, weeks: 1, house: true,
    effect: { tagBonus: { tag: "search", bonus: 10 } },
    blurb: "+10 to searching and spotting. Low light stops mattering.",
    risk: "Bright light is a Body Save or a wasted round.",
  },
  cortisolGovernor: {
    name: "Cortisol Governor", cost: 60000, weeks: 4, house: true,
    effect: { resolve: 1 },
    blurb: "+1 Resolve. The fear arrives on a delay and slightly muffled.",
    risk: "You will not notice you are afraid until it is worth being afraid.",
  },
  prostheticArm: {
    name: "Prosthetic Arm", cost: 18000, weeks: 2, house: true,
    effect: { stat: "strength", bonus: 5 },
    blurb: "+5 Strength. Grip strength sufficient to be a problem.",
    risk: "Androids find it uncanny, which is its own kind of funny.",
  },
};

/* ---------------- downtime activities ---------------- */

export const ACTIVITIES = {
  rest: {
    name: "Rest", weeks: 1, cost: 500,
    blurb: "Sleep in a bed that is not moving. Heal, and try a Fear Save to bleed off Stress.",
  },
  therapy: {
    name: "Therapy", weeks: 2, cost: 4000,
    blurb: "A professional, or the closest thing the port has. Advantage on the Stress Save, and a shot at a phobia.",
  },
  carouse: {
    name: "Carouse", weeks: 1, cost: 2000,
    blurb: "Drink the memory down. Reliable on Stress, unreliable about everything else.",
  },
  train: {
    name: "Train", weeks: 0, cost: 0,
    blurb: "Spend banked skill points. Time depends on the tier of the skill.",
  },
  work: {
    name: "Take a contract", weeks: 2, cost: 0,
    blurb: "Dock work, hauling, security. Pays badly and reliably.",
  },
  cybermod: {
    name: "Cybermod surgery", weeks: 0, cost: 0,
    blurb: "Elective augmentation. Weeks and credits depend on the mod.",
  },
  shipRepair: {
    name: "Ship repairs", weeks: 0, cost: 0,
    blurb: "A day per 10 hull, 100,000cr per hull. Clears the 25/50/75 damage locks.",
  },
  shipUpgrade: {
    name: "Ship upgrades", weeks: 0, cost: 0,
    blurb: "A week per 10 hull added, 10 million per hull. Ships are absurd.",
  },
};

/* ---------------- Profit Save (house rule) ---------------- */

/**
 * The Profit Save. A starport is an entropy engine for money.
 * At the end of shore leave you roll under your Profit Save to
 * keep what is left; failure means the port took a bite.
 *
 * Base 40%, modified by:
 *   +10  every full month of downtime you did NOT take
 *   −10  per crew member carrying an Addiction
 *   −5   per 50,000cr you are carrying (money attracts)
 *   +15  someone in the crew has Rimwise or Business Acumen
 */
export function profitSaveTarget({ weeks = 0, addictions = 0, credits = 0, savvy = false }) {
  let t = 40;
  // Every full month you did NOT spend ashore is a month the port
  // did not get to work on you.
  t += Math.floor(Math.max(0, 4 - weeks) / 2) * 10;
  t -= addictions * 10;
  t -= Math.floor(credits / 50000) * 5;
  if (savvy) t += 15;
  return Math.max(5, Math.min(90, Math.round(t)));
}

/* ---------------- the slice ---------------- */

export const downtimeActions = {
  begin: (port) => ({ type: "DOWN/BEGIN", port }),
  schedule: (pcId, activity, opts) => ({ type: "DOWN/SCHEDULE", pcId, activity, opts }),
  unschedule: (pcId, index) => ({ type: "DOWN/UNSCHEDULE", pcId, index }),
  resolve: () => ({ type: "DOWN/RESOLVE" }),
  portRepair: (hull) => ({ type: "DOWN/PORT_REPAIR", hull }),
  portUpgrade: (moduleKey, count) => ({ type: "DOWN/PORT_UPGRADE", moduleKey, count }),
  profitSave: () => ({ type: "DOWN/PROFIT" }),
  end: () => ({ type: "DOWN/END" }),
};

const emptyDowntime = (port) => ({
  port: port || { name: "an unnamed port", quality: "standard", markup: 1 },
  plans: {},        // pcId -> [{activity, opts, weeks, cost}]
  weeks: 0,
  spent: 0,
  resolved: false,
  results: [],
});

export function downtimeSlice(state, action) {
  const dt = state.downtime;

  switch (action.type) {
    case "DOWN/BEGIN": {
      const next = emit({ ...state, downtime: emptyDowntime(action.port) }, "system",
        `SHORE LEAVE · ${(action.port && action.port.name) || "port"}. The airlock cycles and the noise on the other side of it is people.`);
      return emit(next, "system",
        "Schedule what everybody does with the time. Weeks are the currency here; credits are only the second currency.");
    }

    case "DOWN/SCHEDULE": {
      if (!dt) return state;
      const def = ACTIVITIES[action.activity];
      if (!def) return state;
      const opts = action.opts || {};
      const mod = opts.cybermod ? CYBERMODS[opts.cybermod] : null;

      const weeks = mod ? mod.weeks : def.weeks;
      const cost = Math.round((mod ? mod.cost : def.cost) * (dt.port.markup || 1));
      const entry = { activity: action.activity, opts, weeks, cost };

      const plans = { ...dt.plans, [action.pcId]: [...(dt.plans[action.pcId] || []), entry] };
      const total = Object.values(plans).flat();
      return {
        ...state,
        downtime: {
          ...dt, plans,
          weeks: Math.max(0, ...Object.values(plans).map((p) => p.reduce((n, e) => n + e.weeks, 0))),
          spent: total.reduce((n, e) => n + e.cost, 0),
        },
      };
    }

    case "DOWN/UNSCHEDULE": {
      if (!dt) return state;
      const list = (dt.plans[action.pcId] || []).filter((_, i) => i !== action.index);
      const plans = { ...dt.plans, [action.pcId]: list };
      const total = Object.values(plans).flat();
      return {
        ...state,
        downtime: {
          ...dt, plans,
          weeks: Math.max(0, ...Object.values(plans).map((p) => p.reduce((n, e) => n + e.weeks, 0)), 0),
          spent: total.reduce((n, e) => n + e.cost, 0),
        },
      };
    }

    /**
     * Resolve every scheduled activity. The crew themselves live in
     * the React layer's state, so this emits `demands` describing
     * what to do to each PC rather than reaching into them.
     */
    case "DOWN/RESOLVE": {
      if (!dt || dt.resolved) return state;
      let next = state;
      let r = state.rng;
      const results = [];
      const demands = [];

      for (const [pcId, entries] of Object.entries(dt.plans)) {
        for (const entry of entries) {
          const who = (state.crewNames && state.crewNames[pcId]) || "Someone";
          switch (entry.activity) {
            case "rest": {
              demands.push({ kind: "fullHeal", pcId });
              demands.push({ kind: "stressSave", pcId, mode: "none", why: "a week of not being on that ship" });
              results.push(`${who} slept.`);
              break;
            }
            case "therapy": {
              demands.push({ kind: "stressSave", pcId, mode: "advantage", why: "two weeks of talking to a professional" });
              const [roll, r1] = rollDie(r, 10); r = r1;
              if (roll >= 7) {
                demands.push({ kind: "removeCondition", pcId, condition: "Phobia" });
                results.push(`${who} got somewhere with the phobia.`);
              } else {
                results.push(`${who} talked. Some of it landed.`);
              }
              break;
            }
            case "carouse": {
              demands.push({ kind: "stress", pcId, amount: -2, why: "a week the liver will remember" });
              const [roll, r2] = rollDie(r, 10); r = r2;
              if (roll <= 2) {
                demands.push({ kind: "addiction", pcId });
                results.push(`${who} found something that works and kept taking it.`);
              } else if (roll >= 9) {
                const [owed, r3] = evalDicePure(r, "2d10"); r = r3;
                results.push(`${who} owes ${owed * 100}cr to somebody with a memory for faces.`);
                demands.push({ kind: "debt", pcId, amount: owed * 100 });
              } else {
                results.push(`${who} drank it down.`);
              }
              break;
            }
            case "train": {
              demands.push({ kind: "train", pcId, skill: entry.opts.skill });
              results.push(`${who} trained ${entry.opts.skill || "something"}.`);
              break;
            }
            case "work": {
              const [pay, r4] = evalDicePure(r, "3d10"); r = r4;
              const credits = pay * 100;
              demands.push({ kind: "credits", pcId, amount: credits });
              results.push(`${who} worked the docks: +${credits}cr.`);
              break;
            }
            case "cybermod": {
              const mod = CYBERMODS[entry.opts.cybermod];
              if (!mod) break;
              // Surgery is a Body Save. Failing is not fatal, it is expensive.
              const [chk, r5] = checkPure(r, entry.opts.bodySave || 25); r = r5;
              if (chk.success) {
                demands.push({ kind: "cybermod", pcId, mod: entry.opts.cybermod });
                results.push(`${who} came out of surgery with a ${mod.name}.`);
              } else {
                demands.push({ kind: "stress", pcId, amount: 2, why: "a surgery that did not take" });
                results.push(`${who}'s ${mod.name} rejected. The money is gone; the scar is not.`);
              }
              break;
            }
            default: break;
          }
        }
      }

      results.forEach((line) => { next = emit(next, "system", line); });
      next = { ...next, rng: r, demands: [...(next.demands || []), ...demands] };
      return { ...next, downtime: { ...dt, resolved: true, results } };
    }

    /* ---- port work on the ship ---- */
    case "DOWN/PORT_REPAIR": {
      const ship = state.ship;
      if (!ship || !dt) return state;
      const d = derive(ship);
      const want = Math.min(action.hull, d.maxHull - ship.hull);
      if (want <= 0) return emit(state, "system", "The hull is intact. They will still find something to bill you for.");
      const cost = want * REPAIR_COST_PER_HULL * (dt.port.markup || 1);
      if ((state.credits || 0) < cost) {
        return emit(state, "system",
          `${want} hull is ${cost.toLocaleString()}cr and you have ${(state.credits || 0).toLocaleString()}cr. They will take 30-50% up front and the rest monthly, or they will keep the ship.`);
      }
      const days = repairDays(want);
      let next = { ...state, credits: state.credits - cost };
      next = { ...next, ship: { ...ship, hull: ship.hull + want, crossed: {}, repairUsed: false, armorBreached: false, navDamaged: false, moduleDamage: {}, fires: [], breaches: [] } };
      return emitAll(next, [
        ["good", `${want} hull repaired over ${days} day${days === 1 ? "" : "s"}. ${cost.toLocaleString()}cr.`],
        ["system", "The damage locks are cleared and every knocked-out module is back on the board."],
      ]);
    }

    case "DOWN/PORT_UPGRADE": {
      const ship = state.ship;
      if (!ship || !dt) return state;
      const count = action.count || 1;
      const before = derive(ship).maxHull;
      const nextModules = { ...ship.modules, [action.moduleKey]: (ship.modules[action.moduleKey] || 0) + count };
      const after = derive({ ...ship, modules: nextModules }).maxHull;
      const added = after - before;
      const cost = added * UPGRADE_COST_PER_HULL;

      if ((state.credits || 0) < cost) {
        return emit(state, "system",
          `That is ${added} hull — ${cost.toLocaleString()}cr — and you have ${(state.credits || 0).toLocaleString()}cr. Ships are not bought, they are owed.`);
      }
      const weeks = upgradeWeeks(added);
      return emitAll({
        ...state,
        credits: state.credits - cost,
        ship: { ...ship, modules: nextModules, hull: ship.hull + added },
      }, [
        ["good", `${count}× ${action.moduleKey} fitted. +${added} hull over ${weeks} week${weeks === 1 ? "" : "s"}.`],
        ["item", `${cost.toLocaleString()}cr.`],
      ]);
    }

    /* ---- the Profit Save ---- */
    case "DOWN/PROFIT": {
      if (!dt) return state;
      const target = profitSaveTarget({
        weeks: dt.weeks,
        addictions: state.addictionCount || 0,
        credits: state.credits || 0,
        savvy: !!state.savvy,
      });
      const [chk, r1] = checkPure(state.rng, target);
      let next = emit({ ...state, rng: r1 }, chk.success ? "rollgood" : "rollbad",
        `PROFIT SAVE · ${target}% · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "YOU KEEP IT" : "THE PORT TOOK ITS CUT"}`);

      if (chk.critHit) {
        const [bonus, r2] = evalDicePure(next.rng, "2d10");
        next = { ...next, rng: r2, credits: (next.credits || 0) + bonus * 500 };
        return emit(next, "good", `Something you were owed finally cleared: +${(bonus * 500).toLocaleString()}cr.`);
      }
      if (chk.success) return emit(next, "good", "You leave port with roughly what you arrived with. That is rarer than it sounds.");

      const share = chk.critFail ? 0.75 : 0.35;
      const lost = Math.floor((next.credits || 0) * share);
      next = { ...next, credits: (next.credits || 0) - lost };
      return emit(next, "horror", chk.critFail
        ? `${lost.toLocaleString()}cr gone. Fees, fines, a bar tab nobody will itemise, and one payment you do not remember authorising.`
        : `${lost.toLocaleString()}cr gone to docking fees, port tax and the small persistent theft of being somewhere expensive.`);
    }

    case "DOWN/END": {
      if (!dt) return state;
      const weeks = dt.weeks;
      let next = emit(state, "system",
        `${weeks} week${weeks === 1 ? "" : "s"} at ${dt.port.name}. The airlock cycles the other way.`);
      next = { ...next, demands: [...(next.demands || []), { kind: "advanceTime", minutes: weeks * 7 * 1440 }] };
      return { ...next, downtime: null };
    }

    default:
      return state;
  }
}
