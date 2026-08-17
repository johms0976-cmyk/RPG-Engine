/* ============================================================
   DEMANDS — the bridge between the pure core and real characters.

   The core refuses to know what a PC is. When a Critical Hit
   vents a room, it does not reach into anybody's Health; it
   emits a demand:

       { kind: "bodySave", who: "all", dmg: "1d10", fatal: false }

   This file is the only place that knows how to cash one of
   those in against the existing useGame API. Keeping it separate
   means the core stays testable and the coupling lives in one
   readable switch instead of being smeared through both halves.
   ============================================================ */
import { evalDice } from "../engine/dice.js";
import { CYBERMODS } from "../core/index.js";

export function applyDemand(g, d) {
  if (!g || !d) return;
  const crew = g.crew.filter((c) => c.alive !== false && !c.unconscious);

  switch (d.kind) {
    /* --- ship criticals --- */
    case "bodySave": {
      // "who" is all aboard, or everyone in the affected module.
      // The engine has no room-level crew positions for ship
      // modules, so "room" resolves to whoever is aboard and is
      // narrated as such rather than silently treated as "all".
      const targets = crew;
      if (!targets.length) return;
      if (d.who === "room") {
        g.api.say("system", `Anyone in the affected section: Body Save${d.fatal ? " or they do not come out" : ""}.`);
      }
      for (const c of targets) {
        const r = g.api.rollNow({
          kind: "save", name: "body", pcId: c.id,
          mode: d.mode || "none",
          why: d.why || "the ship coming apart",
          autoPanic: false,
        });
        if (r.success) continue;
        if (d.fatal && d.who === "room") {
          g.api.hurt(evalDice("2d10"), d.why, c.id);
        } else if (d.dmg) {
          g.api.hurt(evalDice(d.dmg), d.why, c.id);
        }
      }
      return;
    }

    case "androidShutdown": {
      const droids = crew.filter((c) => c.cls === "android");
      if (!droids.length) {
        g.api.say("system", "No androids aboard to drop.");
        return;
      }
      droids.forEach((c) => {
        g.api.addCondition("Shut Down — needs rebooting", c.id);
        g.api.say("horror", `${c.name} stops mid-sentence and does not start again.`);
      });
      return;
    }

    case "cryoLoss":
      g.api.say("horror",
        `${d.count} cryopod${d.count === 1 ? "" : "s"} opened to vacuum. Whoever the Warden had sleeping in them is a decision that has now been made.`);
      return;

    case "hyperspaceWatch": {
      // Anyone awake through a jump has a bad time (PSG 27.2).
      const awake = crew;
      if (!awake.length) return;
      g.api.say("horror", "Somebody has to stay awake for the jump. They always report it differently afterwards.");
      awake.forEach((c) => {
        g.api.rollNow({ kind: "save", name: "sanity", pcId: c.id, why: "time in hyperspace", autoPanic: false });
      });
      return;
    }

    case "crewWitnessedDeath":
      g.api.stressCrew(1, `watching ${d.name} go`);
      return;

    /* --- downtime --- */
    case "fullHeal": {
      const pc = g.crew.find((c) => c.id === d.pcId);
      if (!pc) return;
      g.api.heal(pc.maxHealth, d.pcId);
      return;
    }

    case "stressSave": {
      const pc = g.crew.find((c) => c.id === d.pcId);
      if (!pc) return;
      const r = g.api.rollNow({
        kind: "save", name: "fear", pcId: d.pcId, mode: d.mode || "none",
        why: d.why, autoStress: false, autoPanic: false,
      });
      if (!r.success) {
        g.api.say("system", `${pc.name} does not shake it off.`);
        return;
      }
      const shed = Math.floor(r.margin / 10) * (r.critHit ? 2 : 1);
      if (shed > 0) g.api.stress(-shed, d.why, d.pcId);
      else g.api.say("system", `${pc.name} sleeps, and wakes up carrying the same amount.`);
      return;
    }

    case "stress":
      g.api.stress(d.amount, d.why, d.pcId);
      return;

    case "removeCondition": {
      const pc = g.crew.find((c) => c.id === d.pcId);
      if (!pc || !pc.conditions.includes(d.condition)) return;
      g.setCrew
        ? g.setCrew(g.crew.map((c) => (c.id === d.pcId ? { ...c, conditions: c.conditions.filter((x) => x !== d.condition) } : c)))
        : g.api.say("good", `${pc.name} is no longer carrying the ${d.condition}.`);
      return;
    }

    case "addiction":
      g.api.addCondition("Addiction", d.pcId);
      g.api.say("stress", "That is going to want feeding again.");
      return;

    case "credits": {
      const pc = g.crew.find((c) => c.id === d.pcId);
      if (!pc) return;
      g.api.say("item", `${pc.name}: +${d.amount}cr.`);
      return;
    }

    case "debt":
      g.api.say("horror", `${d.amount}cr owed, to somebody who does not send invoices.`);
      return;

    case "cybermod": {
      const mod = CYBERMODS[d.mod];
      const pc = g.crew.find((c) => c.id === d.pcId);
      if (!mod || !pc) return;
      g.api.addBuff({
        source: mod.name,
        stats: mod.effect.stat ? { [mod.effect.stat]: mod.effect.bonus } : undefined,
        grants: [
          mod.effect.save && { kind: "save", name: mod.effect.save, bonus: mod.effect.bonus },
          mod.effect.tagBonus && { kind: "tag", name: mod.effect.tagBonus.tag, bonus: mod.effect.tagBonus.bonus },
        ].filter(Boolean),
      }, d.pcId);
      g.api.addCondition(mod.name, d.pcId);
      return;
    }

    case "train":
      g.api.say("system", `Training logged: ${d.skill || "unspecified"}. Spend the points on the level-up screen.`);
      return;

    case "advanceTime":
      g.api.advance(d.minutes);
      return;

    default:
      return;
  }
}

export default applyDemand;
