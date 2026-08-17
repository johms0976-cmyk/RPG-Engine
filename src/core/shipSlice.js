/* ============================================================
   SHIP SLICE — the reducer that owns state.ship and state.fight.

   Everything is a pure (state, action) => state. The RNG lives in
   state.rng and is threaded through every roll, so a ship battle
   is exactly reproducible from a seed. That is what makes the
   whole thing testable without React, which was the point of #30.

   Damage flow, faithfully:
     attacker Combat Check  ->  defender Armor Save to AVOID it
     ->  hull loss  ->  trigger check  ->  Critical Hit table.
   ============================================================ */
import { emit, emitAll } from "./store.js";
import { checkPure, evalDicePure, rollDie, pick } from "./rng.js";
import {
  derive, makeShip, SHIP_WEAPONS, jumpFuelCost, FUEL_BURN,
  fieldRepairCeiling, repairAmount, galleyStatus, lifeSupportStatus, travelTime,
} from "./ship.js";
import { rollCriticalHit, critTriggers } from "./shipCrit.js";

/* ---------------- actions ---------------- */

export const shipActions = {
  install: (ship) => ({ type: "SHIP/INSTALL", ship }),
  damage: (amount, opts = {}) => ({ type: "SHIP/DAMAGE", amount, opts }),
  critical: (ctx = {}) => ({ type: "SHIP/CRITICAL", ctx }),
  repair: (stat, mode) => ({ type: "SHIP/REPAIR", stat, mode }),
  refuel: (units) => ({ type: "SHIP/REFUEL", units }),
  restock: () => ({ type: "SHIP/RESTOCK" }),
  burn: (days) => ({ type: "SHIP/BURN", days }),
  jump: (rating) => ({ type: "SHIP/JUMP", rating }),
  loadCargo: (item) => ({ type: "SHIP/CARGO_ADD", item }),
  dropCargo: (index) => ({ type: "SHIP/CARGO_DROP", index }),
  reload: (uid) => ({ type: "SHIP/RELOAD", uid }),
  seal: (index) => ({ type: "SHIP/SEAL", index }),
  fight: (enemy) => ({ type: "FIGHT/START", enemy }),
  fire: (uid) => ({ type: "FIGHT/FIRE", uid }),
  evade: () => ({ type: "FIGHT/EVADE" }),
  hail: () => ({ type: "FIGHT/HAIL" }),
  fieldRepair: (stat) => ({ type: "FIGHT/REPAIR", stat }),
  flee: () => ({ type: "FIGHT/FLEE" }),
  endRound: () => ({ type: "FIGHT/END_ROUND" }),
  endFight: (why) => ({ type: "FIGHT/END", why }),
  tick: (rounds = 1) => ({ type: "SHIP/TICK", rounds }),
};

/* ---------------- damage application ---------------- */

/**
 * Apply raw damage to a ship, running the Armor Save and every
 * Critical Hit trigger it sets off. Pure.
 * @returns {{ship, rng, lines: Array, demands: Array}}
 */
export function applyShipDamage(ship, rng, amount, opts = {}) {
  const d = derive(ship);
  const lines = [];
  let demands = [];
  let r = rng;
  let s = ship;

  // --- Armor Save: roll under to avoid the damage entirely ---
  if (!opts.unavoidable) {
    let mode = "none";
    if (ship.armorBreached) mode = "disadvantage";
    if (opts.targetArmorAdv) mode = mode === "disadvantage" ? "none" : "advantage";

    const [save, r1] = checkPure(r, d.armorSave, mode);
    r = r1;
    lines.push(["roll" + (save.success ? "good" : "bad"),
      `${ship.name} — ARMOR SAVE ${d.armorSave}%${mode !== "none" ? ` [${mode === "advantage" ? "+" : "−"}]` : ""}` +
      ` · rolled ${String(save.value).padStart(2, "0")} · ${save.critFail ? "CRITICAL FAILURE" : save.success ? "HELD" : "FAILED"}`]);

    if (save.success && !save.critFail) {
      lines.push(["good", "The plating takes it. No hull damage."]);
      return { ship: s, rng: r, lines, demands };
    }
    if (save.critFail) opts = { ...opts, critFailedArmorSave: true };
  }

  // --- hull loss ---
  const before = s.hull;
  const after = Math.max(0, s.hull - amount);
  const triggers = critTriggers(s, before, after, opts);

  s = {
    ...s,
    hull: after,
    firstDamageTaken: true,
    crossed: {
      ...s.crossed,
      t25: s.crossed.t25 || after <= d.thresholds.t25,
      t50: s.crossed.t50 || after <= d.thresholds.t50,
      t75: s.crossed.t75 || after <= d.thresholds.t75,
    },
  };
  lines.push(["dmg", `${ship.name} takes ${amount} hull. ${after}/${d.maxHull}.`]);

  if (after <= 0) {
    lines.push(["horror", `${ship.name} comes apart. There is no version of this where that is survivable from inside.`]);
    return { ship: { ...s, destroyed: true }, rng: r, lines, demands };
  }

  // --- criticals ---
  if (triggers.length) {
    lines.push(["panic", `CRITICAL HIT CHECK — ${triggers.join("; ")}.`]);
    const out = rollCriticalHit(s, r, { damage: amount });
    s = out.ship; r = out.rng;
    demands = [...demands, ...out.demands];
    out.results.forEach((res, i) => {
      lines.push(["panic",
        `${i > 0 ? "DOUBLES — AGAIN · " : ""}d100 = ${String(res.roll).padStart(2, "0")}` +
        `${res.slid ? ` (slid ${res.slid} up the table — that system was already gone)` : ""}\n${res.text}`]);
    });

    // A critical can cost hull of its own (Massive Hull Damage), so the
    // hull is re-reported and re-checked for destruction afterwards.
    if (s.hull !== after) lines.push(["dmg", `${ship.name} — hull now ${s.hull}/${d.maxHull}.`]);
    if (s.hull <= 0) {
      lines.push(["horror", `${ship.name} comes apart. There is no version of this where that is survivable from inside.`]);
      return { ship: { ...s, hull: 0, destroyed: true }, rng: r, lines, demands };
    }
  }

  return { ship: s, rng: r, lines, demands };
}

/* ---------------- the slice ---------------- */

export function shipSlice(state, action) {
  const ship = state.ship;

  switch (action.type) {
    case "SHIP/INSTALL": {
      const s = action.ship;
      const d = derive(s);
      return emitAll({ ...state, ship: s }, [
        ["system", `${s.name} — ${s.classLabel}. Hull ${s.hull}/${d.maxHull}, Armor ${d.armorSave}%, Speed ${d.speed}%, Combat ${d.combat}%, Jump-${d.jumpRating}.`],
        ["system", `Fuel ${s.fuel}/${d.maxFuel}. Galley stock ${s.galleyStock} month${s.galleyStock === 1 ? "" : "s"}. Thresholds at ${d.thresholds.t25} / ${d.thresholds.t50} / ${d.thresholds.t75} hull.`],
      ]);
    }

    case "SHIP/DAMAGE": {
      if (!ship) return state;
      const out = applyShipDamage(ship, state.rng, action.amount, action.opts);
      let next = { ...state, ship: out.ship, rng: out.rng };
      next = emitAll(next, out.lines);
      if (out.demands.length) next = { ...next, demands: [...(next.demands || []), ...out.demands] };
      return next;
    }

    case "SHIP/CRITICAL": {
      if (!ship) return state;
      const out = rollCriticalHit(ship, state.rng, action.ctx || {});
      let next = { ...state, ship: out.ship, rng: out.rng };
      out.results.forEach((res, i) => {
        next = emit(next, "panic",
          `${i > 0 ? "DOUBLES — AGAIN · " : ""}CRITICAL HIT · d100 = ${String(res.roll).padStart(2, "0")}\n${res.text}`);
      });
      if (out.demands.length) next = { ...next, demands: [...(next.demands || []), ...out.demands] };
      return next;
    }

    /* ---- repair (PSG 28.1): Intellect Check, 1 hull per 5 margin ---- */
    case "SHIP/REPAIR":
    case "FIGHT/REPAIR": {
      if (!ship) return state;
      const d = derive(ship);
      if (ship.repairUsed && action.type === "SHIP/REPAIR") {
        return emit(state, "system", "You have already had a go at this one. It needs a dock, a spare, or somebody else's ship.");
      }
      const [chk, r1] = checkPure(state.rng, action.stat || 30, action.mode || "none");
      let next = { ...state, rng: r1 };
      next = emit(next, chk.success ? "rollgood" : "rollbad",
        `REPAIR · Intellect ${action.stat || 30}% · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "SUCCESS" : "FAILURE"}`);

      if (!chk.success) {
        return emit({ ...next, ship: { ...ship, repairUsed: true } }, "system",
          "You make it marginally worse and skin a knuckle doing it.");
      }
      const ceiling = fieldRepairCeiling(ship);
      const want = repairAmount(chk.margin) * (chk.critHit ? 2 : 1);
      const got = Math.max(0, Math.min(want, ceiling - ship.hull));
      const capped = want > got;

      next = { ...next, ship: { ...ship, hull: ship.hull + got, repairUsed: true } };
      next = emit(next, got > 0 ? "good" : "system",
        got > 0
          ? `+${got} hull. ${ship.hull + got}/${d.maxHull}.${capped ? " That is as far as it goes without a starport — the damage past that line is structural." : ""}`
          : "Nothing left to safely patch out here. This needs a dock.");
      return next;
    }

    /* ---- fuel & consumables ---- */
    case "SHIP/REFUEL": {
      if (!ship) return state;
      const d = derive(ship);
      const got = Math.min(action.units, d.maxFuel - ship.fuel);
      return emit({ ...state, ship: { ...ship, fuel: ship.fuel + got } },
        "good", `Refuelled ${got}. Tank at ${ship.fuel + got}/${d.maxFuel}.`);
    }

    case "SHIP/RESTOCK": {
      if (!ship) return state;
      const d = derive(ship);
      return emit({ ...state, ship: { ...ship, galleyStock: d.galleyMonths } },
        "good", `Galley restocked — ${d.galleyMonths} month${d.galleyMonths === 1 ? "" : "s"} of food aboard.`);
    }

    case "SHIP/BURN": {
      if (!ship) return state;
      const days = action.days || 1;
      const cost = days * FUEL_BURN.thrusterDay;
      const fuel = Math.max(0, ship.fuel - cost);
      let next = { ...state, ship: { ...ship, fuel } };
      next = emit(next, "system", `${days} day${days === 1 ? "" : "s"} under thrust. −${cost} fuel, ${fuel} left.`);
      if (fuel <= 0) next = emit(next, "horror", "The tank is dry. You are now a very expensive rock with people in it.");
      else if (fuel <= 3) next = emit(next, "stress", "Fuel is down to the last few units.");
      return next;
    }

    case "SHIP/JUMP": {
      if (!ship) return state;
      const d = derive(ship);
      const rating = Math.min(action.rating, d.jumpRating);

      if (d.jumpRating <= 0) return emit(state, "system", "No working jump drive. Nothing to jump with.");
      if (d.live.computer <= 0) return emit(state, "system", "No computer. Nothing to astrogate with, and nobody does that by hand.");
      if (ship.navDataWiped) return emit(state, "system", "Navigation data is gone. You do not know where you are, so you cannot know where you would arrive.");

      const cost = jumpFuelCost(rating, state.houseRules?.jumpFuelDouble !== false);
      if (ship.fuel < cost) {
        return emit(state, "system", `A Jump-${rating} needs ${cost} fuel. You have ${ship.fuel}.`);
      }

      let next = { ...state, ship: { ...ship, fuel: ship.fuel - cost } };
      next = emit(next, "system", `JUMP-${rating}. Burning ${cost} fuel. ${ship.fuel - cost} remaining.`);

      // Time dilation: the book is deliberately unreliable about this.
      const [dil, r1] = rollDie(state.rng, 10);
      next = { ...next, rng: r1 };
      const years = rating >= 5 ? dil * rating : rating >= 3 ? dil : 0;
      const months = years ? 0 : dil;
      next = emit(next, "horror", years
        ? `You come out the other side. Local calendars say ${years} year${years === 1 ? "" : "s"} passed. Yours says four hours.`
        : `You come out the other side. Somewhere between ${months} weeks and nothing at all has happened out here. The clocks disagree with each other.`);

      // Anyone awake through hyperspace is the crew's problem, not the hull's.
      next = { ...next, demands: [...(next.demands || []), { kind: "hyperspaceWatch", rating }] };
      return next;
    }

    case "SHIP/CARGO_ADD":
      if (!ship) return state;
      if (ship.cargo.length >= derive(ship).maxCargo)
        return emit(state, "system", "The holds are full.");
      return emit({ ...state, ship: { ...ship, cargo: [...ship.cargo, action.item] } },
        "item", `Loaded: ${action.item.name || action.item}.`);

    case "SHIP/CARGO_DROP": {
      if (!ship) return state;
      const item = ship.cargo[action.index];
      if (!item) return state;
      return emit({ ...state, ship: { ...ship, cargo: ship.cargo.filter((_, i) => i !== action.index) } },
        "item", `Jettisoned: ${item.name || item}.`);
    }

    case "SHIP/RELOAD": {
      if (!ship) return state;
      return emit({
        ...state,
        ship: {
          ...ship,
          weapons: ship.weapons.map((w) =>
            w.uid === action.uid ? { ...w, loaded: SHIP_WEAPONS[w.key].shots } : w),
        },
      }, "system", "Reloaded from the magazine in cargo.");
    }

    case "SHIP/SEAL": {
      if (!ship) return state;
      return emit({
        ...state,
        ship: { ...ship, breaches: ship.breaches.map((b, i) => (i === action.index ? { ...b, sealed: true } : b)) },
      }, "good", "Airlock sealed. The room beyond it belongs to space now, but the rest of the ship does not.");
    }

    /* ---- per-round upkeep: fires, reboots, doom clocks ---- */
    case "SHIP/TICK": {
      if (!ship) return state;
      let s = ship;
      let next = state;
      const rounds = action.rounds || 1;

      if (s.systemsDownRounds > 0) s = { ...s, systemsDownRounds: Math.max(0, s.systemsDownRounds - rounds) };
      if (s.computerDownRounds > 0) {
        s = { ...s, computerDownRounds: Math.max(0, s.computerDownRounds - rounds) };
        if (s.computerDownRounds === 0) {
          s = { ...s, combatPenalty: Math.max(0, (s.combatPenalty || 0) - 10) };
          next = emit(next, "good", "The computer comes back up, sullenly.");
        }
      }
      if (s.rebootRounds > 0) {
        s = { ...s, rebootRounds: Math.max(0, s.rebootRounds - rounds) };
        if (s.rebootRounds === 0) next = emit(next, "good", "Systems finish rebooting. Lights, in order, down the length of the ship.");
      }

      if (s.fires.length) {
        const fires = s.fires.map((f) => ({ ...f, turnsLeft: f.turnsLeft - rounds }));
        const burnt = fires.filter((f) => f.turnsLeft <= 0);
        for (const f of burnt) {
          s = { ...s, moduleDamage: { ...s.moduleDamage, [f.room]: (s.moduleDamage[f.room] || 0) + 1 } };
          next = emit(next, "horror", `The fire finishes ${String(f.room).toUpperCase()}.`);
        }
        s = { ...s, fires: fires.filter((f) => f.turnsLeft > 0) };
        if (s.fires.length) next = emit(next, "stress", `Fire still burning: ${s.fires.map((f) => `${f.room} (${f.turnsLeft})`).join(", ")}.`);
      }

      if (s.doomed) {
        const left = s.doomed.roundsLeft - rounds;
        if (left <= 0) {
          next = emit(next, "horror", `${s.name} is gone — ${s.doomed.reason}.`);
          return { ...next, ship: { ...s, hull: 0, destroyed: true, doomed: null } };
        }
        s = { ...s, doomed: { ...s.doomed, roundsLeft: left } };
        next = emit(next, "panic", `${left} turn${left === 1 ? "" : "s"} before the ${s.doomed.reason} takes the ship.`);
      }

      return { ...next, ship: s };
    }

    default:
      return state;
  }
}

/* ---------------- ship-to-ship combat slice ---------------- */

export function makeEnemyShip({ name, hull, armorSave = 30, combat = 40, speed = 40, weapons = [], intent = "hostile" }) {
  return { name, hull, maxHull: hull, armorSave, combat, speed, weapons, intent, crossed: {}, destroyed: false, disabled: false };
}

export function fightSlice(state, action) {
  const f = state.fight;
  const ship = state.ship;

  switch (action.type) {
    case "FIGHT/START": {
      if (!ship) return emit(state, "system", "You have no ship to fight in.");
      const d = derive(ship);
      const enemy = action.enemy;
      const fight = {
        enemy,
        round: 1,
        actionsLeft: Math.max(1, d.computerActions) + (state.aboardCount || 1),
        maxActions: Math.max(1, d.computerActions) + (state.aboardCount || 1),
        grappled: false,
        over: null,
      };
      return emitAll({ ...state, fight }, [
        ["horror", `${enemy.name} is closing. Hull ${enemy.hull}, Armor ${enemy.armorSave}%, Combat ${enemy.combat}%.`],
        ["system", `Round 1. ${fight.actionsLeft} actions — ${d.computerActions} from the computer, the rest from whoever is at a station.`],
      ]);
    }

    case "FIGHT/FIRE": {
      if (!f || !ship) return state;
      if (f.actionsLeft <= 0) return emit(state, "system", "No actions left this round.");
      const w = ship.weapons.find((x) => x.uid === action.uid);
      if (!w) return state;
      const spec = SHIP_WEAPONS[w.key];
      if (w.disabled) return emit(state, "system", `The ${spec.name} is wrecked.`);
      if (w.loaded <= 0) return emit(state, "system", `The ${spec.name} is empty. Reload from cargo.`);
      if (w.charging > 0) return emit(state, "system", `The ${spec.name} is still charging.`);
      if (ship.systemsDownRounds > 0) return emit(state, "system", "Nothing is answering. The ship is dark.");

      const d = derive(ship);
      const gunner = Math.max(d.combat - (ship.combatPenalty || 0), action.gunnerCombat || 0);
      const [chk, r1] = checkPure(state.rng, gunner, action.mode || "none");
      let next = { ...state, rng: r1 };
      next = emit(next, chk.success ? "rollgood" : "rollbad",
        `${spec.name} — COMBAT ${gunner}% · rolled ${String(chk.value).padStart(2, "0")} · ${chk.critHit ? "CRITICAL HIT" : chk.success ? "HIT" : "MISS"}`);

      let nship = {
        ...ship,
        weapons: ship.weapons.map((x) => (x.uid === w.uid
          // +1 because end-of-round decrements every weapon, including
          // this one. Without it a "1 round to charge" weapon fires
          // every round and the charge time is cosmetic.
          ? { ...x, loaded: x.loaded - 1, charging: spec.charge ? spec.charge + 1 : 0 }
          : x)),
      };
      let enemy = f.enemy;

      if (chk.success) {
        const [raw, r2] = evalDicePure(next.rng, spec.dmg);
        next = { ...next, rng: r2 };
        // Megadamage hits hull directly; ordinary damage barely scratches it.
        const hullDmg = spec.mdmg ? raw * (chk.critHit ? 2 : 1) : Math.floor(raw / 100);

        if (spec.grapple) {
          next = emit(next, "system", `The rigging line goes taut. ${enemy.name} is attached to you now — a Speed Check to break it, and that usually costs something.`);
          next = { ...next, fight: { ...f, grappled: true } };
        }

        if (hullDmg <= 0 && !spec.grapple) {
          next = emit(next, "system", `${raw} damage — enough to hurt people on the other side of that hull, not the hull.`);
        } else if (hullDmg > 0) {
          // The enemy's own armor save.
          const [save, r3] = checkPure(next.rng, enemy.armorSave, spec.targetArmorAdv ? "advantage" : "none");
          next = { ...next, rng: r3 };
          if (save.success && !save.critFail) {
            next = emit(next, "system", `${enemy.name} rolls ${String(save.value).padStart(2, "0")} against Armor ${enemy.armorSave}% — it glances off.`);
          } else {
            const after = Math.max(0, enemy.hull - hullDmg);
            enemy = { ...enemy, hull: after };
            next = emit(next, "dmg", `${hullDmg} hull into ${enemy.name}. ${after}/${enemy.maxHull}.`);
            if (spec.critOnHit || chk.critHit || save.critFail) {
              const [tr, r4] = evalDicePure(next.rng, "1d10");
              next = { ...next, rng: r4 };
              next = emit(next, "panic", `Something inside ${enemy.name} lets go — smoke, then a system going dark. (${tr > 5 ? "Badly" : "Not fatally"}.)`);
              if (tr > 7) enemy = { ...enemy, disabled: true };
            }
            if (after <= 0) {
              enemy = { ...enemy, destroyed: true };
              next = emit(next, "horror", `${enemy.name} breaks apart. Whatever was aboard is now debris travelling at the same speed you are.`);
            }
          }
        }
      }

      const fight = { ...next.fight || f, enemy, actionsLeft: f.actionsLeft - 1 };
      next = { ...next, ship: nship, fight };
      if (enemy.destroyed || enemy.disabled) return fightSlice(next, { type: "FIGHT/END", why: enemy.destroyed ? "destroyed" : "disabled" });
      return next;
    }

    case "FIGHT/EVADE": {
      if (!f || !ship) return state;
      const d = derive(ship);
      const [chk, r1] = checkPure(state.rng, d.speed, ship.navDamaged ? "disadvantage" : "none");
      let next = emit({ ...state, rng: r1 }, chk.success ? "rollgood" : "rollbad",
        `EVASIVE · Speed ${d.speed}%${ship.navDamaged ? " [−] nav damage" : ""} · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "SUCCESS" : "FAILURE"}`);
      next = emit(next, chk.success ? "good" : "system",
        chk.success ? "You put the hull edge-on. The next thing they send at you comes in at Disadvantage."
          : "You bleed speed and gain nothing.");
      return { ...next, fight: { ...f, actionsLeft: f.actionsLeft - 1, evading: chk.success } };
    }

    case "FIGHT/HAIL": {
      if (!f) return state;
      const [roll, r1] = rollDie(state.rng, 10);
      let next = { ...state, rng: r1 };
      const enemy = f.enemy;
      const receptive = roll + (enemy.hull / Math.max(1, enemy.maxHull) < 0.4 ? 4 : 0);
      next = emit(next, "system", `You open a channel to ${enemy.name}.`);
      if (receptive >= 8) {
        next = emit(next, "good", "They answer. Whatever they wanted, they want to talk about it more than they want to keep shooting.");
        return fightSlice({ ...next, fight: { ...f, actionsLeft: f.actionsLeft - 1 } }, { type: "FIGHT/END", why: "parley" });
      }
      next = emit(next, "horror", receptive >= 5
        ? "Carrier tone. Someone is listening and choosing not to speak."
        : "The channel opens onto breathing, and then closes.");
      return { ...next, fight: { ...f, actionsLeft: f.actionsLeft - 1 } };
    }

    case "FIGHT/FLEE": {
      if (!f || !ship) return state;
      const d = derive(ship);
      if (f.grappled) return emit(state, "system", "You are rigged to them. Cut the line first.");
      const [chk, r1] = checkPure(state.rng, d.speed);
      let next = emit({ ...state, rng: r1 }, chk.success ? "rollgood" : "rollbad",
        `RUN · Speed ${d.speed}% vs their ${f.enemy.speed}% · rolled ${String(chk.value).padStart(2, "0")}`);
      if (chk.success && d.speed >= f.enemy.speed) {
        return fightSlice(next, { type: "FIGHT/END", why: "escaped" });
      }
      next = emit(next, "system", "They match you. Turning your back just changed which plating they are shooting at.");
      return { ...next, fight: { ...f, actionsLeft: f.actionsLeft - 1 } };
    }

    /* Enemy turn + upkeep. */
    case "FIGHT/END_ROUND": {
      if (!f || !ship) return state;
      let next = state;
      const enemy = f.enemy;

      if (!enemy.destroyed && !enemy.disabled) {
        for (const w of enemy.weapons) {
          const [chk, r1] = checkPure(next.rng, enemy.combat, f.evading ? "disadvantage" : "none");
          next = { ...next, rng: r1 };
          next = emit(next, chk.success ? "rollbad" : "rollgood",
            `${enemy.name} fires ${w.name} — Combat ${enemy.combat}%${f.evading ? " [−]" : ""} · rolled ${String(chk.value).padStart(2, "0")} · ${chk.success ? "ON TARGET" : "WIDE"}`);
          if (!chk.success) continue;

          const [raw, r2] = evalDicePure(next.rng, w.dmg);
          next = { ...next, rng: r2 };
          const amount = (w.mdmg === false ? Math.floor(raw / 100) : raw) * (chk.critHit ? 2 : 1);
          if (amount <= 0) { next = emit(next, "system", "Anti-personnel fire rakes the hull and does nothing to it."); continue; }

          const out = applyShipDamage(next.ship, next.rng, amount, {
            // Torpedoes roll on the Critical Hit table on any hit.
            critHit: chk.critHit || !!w.critOnHit,
            targetArmorAdv: !!w.targetArmorAdv,
          });
          next = { ...next, ship: out.ship, rng: out.rng };
          next = emitAll(next, out.lines);
          if (out.demands.length) next = { ...next, demands: [...(next.demands || []), ...out.demands] };
          if (out.ship.destroyed) return fightSlice(next, { type: "FIGHT/END", why: "lost" });
        }
      }

      next = shipSlice(next, { type: "SHIP/TICK", rounds: 1 });
      if (next.ship.destroyed) return fightSlice(next, { type: "FIGHT/END", why: "lost" });

      const d = derive(next.ship);
      const actions = Math.max(1, d.computerActions) + (next.aboardCount || 1);
      const nship = {
        ...next.ship,
        weapons: next.ship.weapons.map((w) => (w.charging > 0 ? { ...w, charging: w.charging - 1 } : w)),
      };
      next = { ...next, ship: nship };
      next = emit(next, "system", `Round ${f.round + 1}. ${actions} action${actions === 1 ? "" : "s"}.`);
      return { ...next, fight: { ...next.fight, round: f.round + 1, actionsLeft: actions, maxActions: actions, evading: false } };
    }

    case "FIGHT/END": {
      if (!f) return state;
      const why = action.why;
      const text = {
        destroyed: `${f.enemy.name} is wreckage. The silence afterwards is worse than the noise was.`,
        disabled: `${f.enemy.name} is drifting and dark. You could board it. You could also leave.`,
        escaped: "You break contact. Their lights fall away behind you and do not follow.",
        parley: "The shooting stops. For now that counts as winning.",
        lost: "Your ship is gone.",
      }[why] || "It ends.";
      return emit({ ...state, fight: null, lastFight: { ...f, over: why } }, why === "lost" ? "horror" : "good", text);
    }

    default:
      return state;
  }
}

/* ---------------- reporting helpers (pure, for the UI) ---------------- */

export function shipReport(ship, headcount = 0) {
  if (!ship) return null;
  const d = derive(ship);
  const ls = lifeSupportStatus(ship, headcount);
  const g = galleyStatus(ship);
  return {
    derived: d,
    lifeSupport: ls,
    galley: g,
    travel: travelTime(d.speed),
    condition: [
      ship.armorBreached && "Armor breached — Saves at Disadvantage",
      ship.navDataWiped && "Navigation data wiped",
      ship.navDamaged && "Navigation controls damaged",
      ship.gravityOut && "No artificial gravity",
      ship.systemsDownRounds > 0 && `Systems down (${ship.systemsDownRounds})`,
      ship.computerDownRounds > 0 && `Computer offline (${ship.computerDownRounds})`,
      ship.fires.length > 0 && `Fire in ${ship.fires.map((f) => f.room).join(", ")}`,
      ship.breaches.some((b) => !b.sealed) && "Unsealed hull breach",
      ship.doomed && `${ship.doomed.reason.toUpperCase()} — ${ship.doomed.roundsLeft} turns`,
      !ls.ok && `Life support short by ${ls.shortfall}`,
      !g.ok && (g.starving ? "Galley empty" : "Not enough galleys for this crew"),
    ].filter(Boolean),
  };
}
