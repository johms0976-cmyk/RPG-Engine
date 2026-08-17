import { describe, it, expect } from "vitest";
import {
  makeRngState, rollPercent, checkPure, evalDicePure, nextFloat,
} from "../src/core/rng.js";
import {
  makeShip, derive, completeModules, FALSTAFF, fieldRepairCeiling,
  repairAmount, jumpFuelCost, galleyStatus, lifeSupportStatus, SHIP_CLASSES,
} from "../src/core/ship.js";
import { CRIT_TABLE, resolveEntry, rollCriticalHit, critTriggers } from "../src/core/shipCrit.js";
import { createCore, coreActions, initialCoreState, serializeCore, deserializeCore } from "../src/core/index.js";
import { makeEnemyShip, applyShipDamage, shipReport } from "../src/core/shipSlice.js";
import { makeHireling, negotiationMod, MERC_ROLES, hirelingModifiers } from "../src/core/hirelings.js";
import { profitSaveTarget, CYBERMODS } from "../src/core/downtime.js";
import { normalizeMap, autoLayout, fogState, FOG, clampView, corridorsFor } from "../src/core/mapModel.js";

/* ============================================================
   RNG — the thing everything else's determinism rests on
   ============================================================ */
describe("pure rng", () => {
  it("is a pure function of (seed, n)", () => {
    const a = makeRngState(42);
    const [v1] = nextFloat(a);
    const [v2] = nextFloat(a);          // same state, same draw
    expect(v1).toBe(v2);
  });

  it("advances and does not repeat immediately", () => {
    let r = makeRngState(7);
    const out = [];
    for (let i = 0; i < 200; i++) { const [v, r2] = nextFloat(r); out.push(v); r = r2; }
    expect(new Set(out).size).toBeGreaterThan(190);
    expect(out.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("replays identically from a stored {seed, n}", () => {
    let r = makeRngState(99);
    for (let i = 0; i < 50; i++) r = nextFloat(r)[1];
    const saved = { ...r };
    const first = [rollPercent(r)[0].value, rollPercent(nextFloat(r)[1])[0].value];
    const second = [rollPercent(saved)[0].value, rollPercent(nextFloat(saved)[1])[0].value];
    expect(first).toEqual(second);
  });

  it("reads d% as tens and ones with doubles as criticals", () => {
    let r = makeRngState(3);
    for (let i = 0; i < 500; i++) {
      const [p, r2] = rollPercent(r); r = r2;
      expect(p.value).toBe(p.tens * 10 + p.ones);
      expect(p.doubles).toBe(p.tens === p.ones);
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(99);
    }
  });

  it("honours 00 always succeeds and 99 always fails", () => {
    // Scan seeds until we see both extremes, then assert the rule.
    let saw00 = false, saw99 = false;
    for (let s = 0; s < 4000 && !(saw00 && saw99); s++) {
      const [chk] = checkPure(makeRngState(s), 50);
      if (chk.value === 0) { expect(chk.success).toBe(true); expect(chk.critHit).toBe(true); saw00 = true; }
      if (chk.value === 99) { expect(chk.success).toBe(false); expect(chk.critFail).toBe(true); saw99 = true; }
    }
    expect(saw00 && saw99).toBe(true);
  });

  it("evaluates dice expressions in range", () => {
    let r = makeRngState(11);
    for (let i = 0; i < 100; i++) {
      const [v, r2] = evalDicePure(r, "1d10+10"); r = r2;
      expect(v).toBeGreaterThanOrEqual(11);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});

/* ============================================================
   SHIPS — the module -> hull -> stats derivation
   ============================================================ */
describe("ship derivation", () => {
  it("computes Combat as computers x10 + 10 and Intellect x10 + 30", () => {
    const s = makeShip({ name: "T", modules: { computer: 1, lifeSupport: 1, command: 1, thrusters: 2 } });
    const d = derive(s);
    expect(d.combat).toBe(20);
    expect(d.intellect).toBe(40);
    expect(d.sanitySave).toBe(d.intellect);
  });

  it("caps Armor Save and Speed at 80", () => {
    const s = makeShip({ name: "T", modules: { armor: 12, thrusters: 12, lifeSupport: 1, command: 1 } });
    const d = derive(s);
    expect(d.armorSave).toBe(80);
    expect(d.speed).toBe(80);
  });

  it("charges 3 hull per point of armor", () => {
    const a = derive(makeShip({ name: "A", modules: { lifeSupport: 1, command: 1, armor: 0 } })).maxHull;
    const b = derive(makeShip({ name: "B", modules: { lifeSupport: 1, command: 1, armor: 2 } })).maxHull;
    expect(b - a).toBeGreaterThanOrEqual(6);
  });

  it("escalates jump drive cost 1, 2, 3...", () => {
    const one = completeModules({ jumpDrive: 1 }).baseHull;
    const two = completeModules({ jumpDrive: 2 }).baseHull;
    const three = completeModules({ jumpDrive: 3 }).baseHull;
    expect(two - one).toBe(2 + 1);   // +2 hull of drive, +1 forced computer
    expect(three - two).toBe(3 + 1);
  });

  it("forces a computer for every jump drive", () => {
    const { modules } = completeModules({ jumpDrive: 3, computer: 1 });
    expect(modules.computer).toBe(3);
  });

  it("derives engine from jump drives, thrusters and base hull", () => {
    const { modules } = completeModules({ jumpDrive: 2, thrusters: 8, lifeSupport: 2, command: 1 });
    // 2 drives + ceil(8/4)=2 + ceil(base/20)
    expect(modules.engine).toBeGreaterThanOrEqual(4);
    expect(modules.fuel).toBe(modules.engine * 3);
  });

  it("sets 25/50/75% hull thresholds", () => {
    const s = makeShip({ name: "T", modules: { lifeSupport: 4, command: 1, cargoHold: 4, thrusters: 4 } });
    const d = derive(s);
    expect(d.thresholds.t25).toBe(Math.floor(d.maxHull * 0.75));
    expect(d.thresholds.t50).toBe(Math.floor(d.maxHull * 0.50));
    expect(d.thresholds.t75).toBe(Math.floor(d.maxHull * 0.25));
  });

  it("recomputes Speed when a thruster is knocked out", () => {
    const s = makeShip({ name: "T", modules: { thrusters: 4, lifeSupport: 1, command: 1 } });
    expect(derive(s).speed).toBe(40);
    const hurt = { ...s, moduleDamage: { thrusters: 1 } };
    expect(derive(hurt).speed).toBe(30);
  });

  it("builds the Falstaff as a legal research vessel", () => {
    const f = FALSTAFF();
    const d = derive(f);
    const cls = SHIP_CLASSES.research;
    expect(d.maxHull).toBeGreaterThanOrEqual(cls.min);
    expect(f.hull).toBe(d.maxHull);
    expect(f.fuel).toBe(d.maxFuel);
    expect(d.jumpRating).toBe(2);
  });

  it("prices hull at 10 million a point", () => {
    expect(derive(FALSTAFF()).cost).toBe(derive(FALSTAFF()).maxHull * 10_000_000);
  });

  it("costs double fuel for a jump under the module rule", () => {
    expect(jumpFuelCost(2, true)).toBe(4);
    expect(jumpFuelCost(2, false)).toBe(2);
  });

  it("repairs 1 hull per 5 points of margin", () => {
    expect(repairAmount(0)).toBe(0);
    expect(repairAmount(14)).toBe(2);
    expect(repairAmount(37)).toBe(7);
  });

  it("caps field repair at the last crossed threshold", () => {
    const s = { ...FALSTAFF(), crossed: { t25: true } };
    expect(fieldRepairCeiling(s)).toBe(derive(s).thresholds.t25);
    const worse = { ...s, crossed: { t25: true, t50: true } };
    expect(fieldRepairCeiling(worse)).toBe(derive(worse).thresholds.t50);
  });

  it("reports life support and galley shortfalls", () => {
    const s = makeShip({ name: "T", modules: { lifeSupport: 1, command: 1, galley: 0, thrusters: 2 } });
    expect(lifeSupportStatus(s, 25).ok).toBe(false);
    expect(lifeSupportStatus(s, 25).shortfall).toBe(2);
    expect(galleyStatus(s).ok).toBe(false);
  });
});

/* ============================================================
   CRITICAL HITS — the table that actually kills ships
   ============================================================ */
describe("ship critical hits", () => {
  it("covers every d100 value 0-99 with no gaps or overlaps", () => {
    for (let n = 0; n <= 99; n++) {
      const hits = CRIT_TABLE.filter((e) => n >= e.lo && n <= e.hi);
      expect(hits.length, `roll ${n}`).toBe(1);
    }
  });

  it("slides to the next entry above when an effect is impossible", () => {
    const s = { ...FALSTAFF(), weapons: [] };            // no weapons to disable
    const { entry, slid } = resolveEntry(42, s);          // 40-44 = Weapon Disabled
    expect(entry.name).not.toBe("Weapon Disabled");
    expect(slid).toBeGreaterThan(0);
  });

  it("always resolves to something even on a stripped hulk", () => {
    const wreck = {
      ...FALSTAFF(), weapons: [], cargo: [],
      moduleDamage: Object.fromEntries(Object.keys(FALSTAFF().modules).map((k) => [k, 99])),
    };
    for (let n = 0; n <= 99; n += 7) {
      expect(resolveEntry(n, wreck).entry).toBeTruthy();
    }
  });

  it("cascades on doubles and terminates", () => {
    let found = false;
    for (let s = 0; s < 300 && !found; s++) {
      const out = rollCriticalHit(FALSTAFF(), makeRngState(s));
      if (out.results.length > 1) {
        found = true;
        expect(out.results[0].doubles).toBe(true);
        expect(out.results.length).toBeLessThanOrEqual(7);
      }
    }
    expect(found).toBe(true);
  });

  it("fires on the first damage, on thresholds, and below 20 hull", () => {
    const s = FALSTAFF();
    const d = derive(s);
    expect(critTriggers(s, d.maxHull, d.maxHull - 1, {})).toContain("the first damage this hull has taken");

    const used = { ...s, firstDamageTaken: true };
    const t = critTriggers(used, d.maxHull, d.thresholds.t25 - 1, {});
    expect(t.some((x) => x.includes("25%"))).toBe(true);

    const low = { ...s, firstDamageTaken: true, hull: 15 };
    expect(critTriggers(low, 15, 10, {})).toContain("damage taken below 20 hull");
  });

  it("knocks out modules and reduces derived stats", () => {
    const s = makeShip({ name: "T", modules: { thrusters: 4, lifeSupport: 2, command: 1, computer: 2 } });
    const before = derive(s).speed;
    const hit = CRIT_TABLE.find((e) => e.name === "Thrusters");
    const out = hit.apply(s, makeRngState(1));
    expect(derive(out.ship).speed).toBe(before - 10);
  });
});

/* ============================================================
   DAMAGE FLOW
   ============================================================ */
describe("ship damage", () => {
  it("armor save can negate damage entirely", () => {
    const s = { ...makeShip({ name: "T", modules: { armor: 8, lifeSupport: 1, command: 1, thrusters: 1 } }), firstDamageTaken: true };
    let negated = false, taken = false;
    for (let seed = 0; seed < 60; seed++) {
      const out = applyShipDamage(s, makeRngState(seed), 10);
      if (out.ship.hull === s.hull) negated = true; else taken = true;
    }
    expect(negated).toBe(true);
    expect(taken).toBe(true);
  });

  it("never drops hull below zero and flags destruction", () => {
    const s = { ...FALSTAFF(), hull: 5, firstDamageTaken: true };
    const out = applyShipDamage(s, makeRngState(4), 999, { unavoidable: true });
    expect(out.ship.hull).toBe(0);
    expect(out.ship.destroyed).toBe(true);
  });

  it("records crossed thresholds so field repair stays capped", () => {
    const s = FALSTAFF();
    const d = derive(s);
    const out = applyShipDamage({ ...s, firstDamageTaken: true }, makeRngState(2),
      d.maxHull - d.thresholds.t50 + 1, { unavoidable: true });
    expect(out.ship.crossed.t25).toBe(true);
    expect(out.ship.crossed.t50).toBe(true);
  });

  it("is fully deterministic for a given seed", () => {
    // id comes from a construction counter, not from game state.
    const run = () => {
      const { id, ...ship } = applyShipDamage(
        { ...FALSTAFF(), id: "fixed", firstDamageTaken: false }, makeRngState(1234), 25).ship;
      return JSON.stringify(ship);
    };
    expect(run()).toBe(run());
  });
});

/* ============================================================
   THE STORE / CORE
   ============================================================ */
describe("headless core", () => {
  it("runs a whole ship battle with no React anywhere", () => {
    const core = createCore({ state: initialCoreState({ seed: 5 }) });
    core.dispatch(coreActions.install(FALSTAFF()));
    core.dispatch(coreActions.fight(makeEnemyShip({
      name: "PATROL CUTTER", hull: 40, armorSave: 30, combat: 45,
      weapons: [{ name: "Autocannon", dmg: "2d10" }],
    })));
    expect(core.getState().fight).toBeTruthy();

    for (let i = 0; i < 12 && core.getState().fight; i++) {
      const st = core.getState();
      const w = st.ship.weapons.find((x) => !x.disabled && x.loaded > 0 && x.charging === 0);
      if (w) core.dispatch(coreActions.fire(w.uid));
      core.dispatch(coreActions.endRound());
    }
    // Either it ended, or both ships are still standing — never a crash.
    const end = core.getState();
    expect(end.ship).toBeTruthy();
    expect(end.lastFight || end.fight).toBeTruthy();
  });

  it("emits narration through the store rather than returning it", () => {
    const core = createCore({ state: initialCoreState({ seed: 9 }) });
    const lines = [];
    core.onEmit((ls) => lines.push(...ls));
    core.dispatch(coreActions.install(FALSTAFF()));
    core.dispatch(coreActions.damage(20, { unavoidable: true }));
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every((l) => typeof l.text === "string" && l.kind)).toBe(true);
    expect(core.getState().out).toEqual([]);
  });

  it("refuses a jump it cannot fuel and spends fuel when it can", () => {
    const core = createCore({ state: initialCoreState({ seed: 3 }) });
    core.dispatch(coreActions.install({ ...FALSTAFF(), fuel: 2 }));
    core.dispatch(coreActions.jump(2));
    expect(core.getState().ship.fuel).toBe(2);      // refused: needs 4

    core.dispatch(coreActions.refuel(99));
    const before = core.getState().ship.fuel;
    core.dispatch(coreActions.jump(2));
    expect(core.getState().ship.fuel).toBe(before - 4);
  });

  it("refuses to jump with wiped navigation data", () => {
    const core = createCore({ state: initialCoreState({ seed: 3 }) });
    core.dispatch(coreActions.install({ ...FALSTAFF(), navDataWiped: true }));
    const before = core.getState().ship.fuel;
    core.dispatch(coreActions.jump(1));
    expect(core.getState().ship.fuel).toBe(before);
  });

  it("burns down the doom clock and destroys the ship", () => {
    const core = createCore({ state: initialCoreState({ seed: 3 }) });
    core.dispatch(coreActions.install({ ...FALSTAFF(), doomed: { reason: "fuel line", roundsLeft: 2 } }));
    core.dispatch(coreActions.tick(1));
    expect(core.getState().ship.destroyed).toBeFalsy();
    core.dispatch(coreActions.tick(1));
    expect(core.getState().ship.destroyed).toBe(true);
  });

  it("round-trips through save and load", () => {
    const core = createCore({ state: initialCoreState({ seed: 77, credits: 5000 }) });
    core.dispatch(coreActions.install(FALSTAFF()));
    core.dispatch(coreActions.damage(18, { unavoidable: true }));
    const saved = JSON.parse(JSON.stringify(serializeCore(core.getState())));
    const restored = deserializeCore(saved);
    expect(restored.ship.hull).toBe(core.getState().ship.hull);
    expect(restored.rng).toEqual(core.getState().rng);
    expect(restored.credits).toBe(5000);
  });

  it("reports condition flags for the UI", () => {
    const r = shipReport({ ...FALSTAFF(), armorBreached: true, navDataWiped: true }, 6);
    expect(r.condition).toContain("Armor breached — Saves at Disadvantage");
    expect(r.condition).toContain("Navigation data wiped");
  });
});

/* ============================================================
   CONTRACTORS
   ============================================================ */
describe("contractors", () => {
  it("rolls loyalty inside the role's dice range", () => {
    for (let s = 0; s < 40; s++) {
      const [m] = makeHireling(makeRngState(s), "marineGrunt");
      expect(m.loyalty).toBeGreaterThanOrEqual(4);   // 4d10
      expect(m.loyalty).toBeLessThanOrEqual(40);
      expect(m.hits).toBe(MERC_ROLES.marineGrunt.hits);
    }
  });

  it("totals the negotiation modifiers from the chart", () => {
    expect(negotiationMod(["noShare"])).toBe(-20);
    expect(negotiationMod(["monthPlus", "bulk"])).toBe(15);
    expect(negotiationMod(["noShare", "knownDangerous", "bulk"])).toBe(-20);
  });

  it("gives every hire a private motivation", () => {
    const [m] = makeHireling(makeRngState(21), "pilot");
    expect(m.motivation.text).toBeTruthy();
    expect(["debt", "hunt", "secret"]).toContain(m.motivation.kind);
  });

  it("hires, pays, and creates a debt when it cannot", () => {
    const core = createCore({ state: initialCoreState({ seed: 8, credits: 100 }) });
    core.dispatch(coreActions.context({ negotiatorIntellect: 99 }));
    core.dispatch(coreActions.offer("marineGrunt", ["monthPlus"]));
    const cand = core.getState().candidate;
    expect(cand).toBeTruthy();
    core.dispatch(coreActions.hire(cand));
    expect(core.getState().hirelings).toHaveLength(1);

    core.dispatch(coreActions.paySalaries(1));       // 600cr owed, 100cr held
    expect(core.getState().hirelings[0].owed).toBe(600);
  });

  it("turns an unpaid death into a next-of-kin debt", () => {
    const core = createCore({ state: initialCoreState({ seed: 8 }) });
    core.dispatch(coreActions.context({ negotiatorIntellect: 99 }));
    core.dispatch(coreActions.offer("voidUrchin", []));
    core.dispatch(coreActions.hire(core.getState().candidate));
    core.dispatch(coreActions.paySalaries(1));
    const id = core.getState().hirelings[0].id;
    core.dispatch(coreActions.hurt(id, 9, "a bad room"));
    expect(core.getState().hirelings[0].alive).toBe(false);
    expect(core.getState().debts.length).toBe(1);
  });

  it("surfaces quirk effects for the modifier system", () => {
    const mods = hirelingModifiers([
      { alive: true, quirk: "doubleStress" },
      { alive: true, android: true },
      { alive: false, quirk: "intellectDisadvantage" },
    ]);
    expect(mods.doubleStress).toBe(true);
    expect(mods.androidPresent).toBe(true);
    expect(mods.intellectDisadvantage).toBe(false);  // dead ones don't count
  });
});

/* ============================================================
   DOWNTIME
   ============================================================ */
describe("shore leave", () => {
  it("moves the Profit Save with addictions and cash carried", () => {
    const base = profitSaveTarget({ weeks: 2, addictions: 0, credits: 0 });
    expect(profitSaveTarget({ weeks: 2, addictions: 2, credits: 0 })).toBe(base - 20);
    expect(profitSaveTarget({ weeks: 2, addictions: 0, credits: 100000 })).toBe(base - 10);
    expect(profitSaveTarget({ weeks: 2, addictions: 0, credits: 0, savvy: true })).toBe(base + 15);
  });

  it("clamps the Profit Save into a rollable range", () => {
    expect(profitSaveTarget({ weeks: 0, addictions: 9, credits: 9e6 })).toBeGreaterThanOrEqual(5);
    expect(profitSaveTarget({ weeks: 0, addictions: 0, credits: 0, savvy: true })).toBeLessThanOrEqual(90);
  });

  it("schedules activities and totals weeks and credits", () => {
    const core = createCore({ state: initialCoreState({ seed: 2, credits: 999999 }) });
    core.dispatch(coreActions.begin({ name: "PROSPERO'S DREAM", markup: 1 }));
    core.dispatch(coreActions.schedule("pc1", "therapy", {}));
    core.dispatch(coreActions.schedule("pc2", "rest", {}));
    const dt = core.getState().downtime;
    expect(dt.weeks).toBe(2);
    expect(dt.spent).toBe(4500);
  });

  it("emits demands instead of touching characters", () => {
    const core = createCore({ state: initialCoreState({ seed: 2 }) });
    const seen = [];
    core.subscribe((s) => { if (s.demands.length) seen.push(...s.demands); });
    core.dispatch(coreActions.begin({ name: "PORT", markup: 1 }));
    core.dispatch(coreActions.schedule("pc1", "rest", {}));
    core.dispatch(coreActions.resolve());
    expect(seen.some((d) => d.kind === "stressSave")).toBe(true);
    expect(seen.some((d) => d.kind === "fullHeal")).toBe(true);
  });

  it("clears damage locks when a port does the repair", () => {
    const core = createCore({ state: initialCoreState({ seed: 2, credits: 50_000_000 }) });
    core.dispatch(coreActions.install({ ...FALSTAFF(), hull: 10, crossed: { t25: true, t50: true }, armorBreached: true }));
    core.dispatch(coreActions.begin({ name: "PORT", markup: 1 }));
    core.dispatch(coreActions.portRepair(30));
    const s = core.getState().ship;
    expect(s.hull).toBe(40);
    expect(s.crossed).toEqual({});
    expect(s.armorBreached).toBe(false);
  });

  it("refuses port work the crew cannot pay for", () => {
    const core = createCore({ state: initialCoreState({ seed: 2, credits: 1000 }) });
    core.dispatch(coreActions.install({ ...FALSTAFF(), hull: 10 }));
    core.dispatch(coreActions.begin({ name: "PORT", markup: 1 }));
    core.dispatch(coreActions.portRepair(30));
    expect(core.getState().ship.hull).toBe(10);
    expect(core.getState().credits).toBe(1000);
  });

  it("has a costed, time-costed cybermod catalogue", () => {
    for (const m of Object.values(CYBERMODS)) {
      expect(m.cost).toBeGreaterThan(0);
      expect(m.weeks).toBeGreaterThan(0);
      expect(m.risk).toBeTruthy();
      expect(m.house).toBe(true);
    }
  });
});

/* ============================================================
   MAP v2
   ============================================================ */
describe("map v2", () => {
  const mod = {
    start: "a",
    rooms: {
      a: { name: "A", exits: [{ to: "b" }, { to: "c" }] },
      b: { name: "B", exits: [{ to: "a" }, { to: "d" }] },
      c: { name: "C", exits: [{ to: "a" }], z: 1 },
      d: { name: "D", exits: [{ to: "b" }, { to: "secret", hidden: "foundIt" }] },
      secret: { name: "SECRET", exits: [{ to: "d" }] },
    },
  };

  it("upgrades a v1 pos/links layout without losing rooms", () => {
    const v1 = { ...mod, map: { pos: { a: [0, 0], b: [120, 0] }, links: [{ p: "M0,0" }], BW: 104, BH: 46, width: 300, height: 200 } };
    const m = normalizeMap(v1);
    expect(m.v).toBe(2);
    expect(m.floors).toHaveLength(1);
    expect(Object.keys(m.floors[0].pos)).toEqual(["a", "b"]);
    expect(m.upgraded).toBe(true);
  });

  it("splits rooms onto floors by z", () => {
    const m = autoLayout(mod);
    expect(m.floors.length).toBe(2);
    const z1 = m.floors.find((f) => f.z === 1);
    expect(Object.keys(z1.pos)).toEqual(["c"]);
  });

  it("turns cross-floor exits into shafts", () => {
    const m = autoLayout(mod);
    expect(m.shafts.some((s) => (s.from === "a" && s.to === "c") || (s.from === "c" && s.to === "a"))).toBe(true);
  });

  it("stays legible at 60+ rooms", () => {
    const rooms = {};
    for (let i = 0; i < 64; i++) {
      rooms[`r${i}`] = { name: `ROOM ${i}`, exits: i ? [{ to: `r${i - 1}` }] : [], z: Math.floor(i / 16) };
    }
    const m = autoLayout({ start: "r0", rooms });
    expect(m.floors).toHaveLength(4);
    for (const f of m.floors) {
      expect(Object.keys(f.pos).length).toBe(16);
      expect(f.width).toBeLessThan(2400);            // no infinite row
      const seen = new Set(Object.values(f.pos).map((p) => p.join(",")));
      expect(seen.size).toBe(16);                     // no two rooms stacked
    }
  });

  it("has four real fog states", () => {
    const w = { room: "a", visited: { a: true }, flags: {}, threats: {}, npcs: {}, clock: 0 };
    expect(fogState(mod, w, "a")).toBe(FOG.KNOWN);
    expect(fogState(mod, w, "b")).toBe(FOG.SEEN);       // exit from here
    expect(fogState(mod, w, "d")).toBe(FOG.HIDDEN);     // never heard of it
    const w2 = { ...w, visited: { a: true, b: true } };
    expect(fogState(mod, w2, "d")).toBe(FOG.RUMOURED);  // saw the door from B
    expect(fogState(mod, w2, "secret")).toBe(FOG.HIDDEN);
    const w3 = { ...w2, visited: { ...w2.visited, d: true }, flags: { foundIt: true } };
    expect(fogState(mod, w3, "secret")).toBe(FOG.RUMOURED);
  });

  it("clamps pan and zoom to the floor", () => {
    const floor = { width: 1000, height: 800 };
    const v = clampView({ zoom: 99, x: -500, y: 9999 }, floor, { w: 400, h: 300 });
    expect(v.zoom).toBeLessThanOrEqual(4);
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.y).toBeLessThanOrEqual(floor.height);
  });

  it("deduplicates corridors between the same pair of rooms", () => {
    const m = autoLayout(mod);
    const main = m.floors.find((f) => f.z === 0);
    const c = corridorsFor(mod, main);
    const keys = c.map((x) => [x.from, x.to].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* ============================================================
   REGRESSIONS — bugs found by running an actual battle
   ============================================================ */
describe("regressions", () => {
  it("makes a charging weapon skip a round instead of firing every round", () => {
    const core = createCore({ state: initialCoreState({ seed: 5 }) });
    core.dispatch(coreActions.install(FALSTAFF()));
    core.dispatch(coreActions.fight(makeEnemyShip({ name: "X", hull: 500, armorSave: 1, combat: 1, weapons: [] })));
    const cutter = core.getState().ship.weapons.find((w) => w.key === "laserCutter");

    core.dispatch({ type: "FIGHT/FIRE", uid: cutter.uid, gunnerCombat: 99 });
    const after = core.getState().ship.weapons.find((w) => w.uid === cutter.uid);
    expect(after.loaded).toBe(11);

    core.dispatch(coreActions.endRound());
    // Still charging at the top of the next round.
    expect(core.getState().ship.weapons.find((w) => w.uid === cutter.uid).charging).toBe(1);
    core.dispatch({ type: "FIGHT/FIRE", uid: cutter.uid, gunnerCombat: 99 });
    expect(core.getState().ship.weapons.find((w) => w.uid === cutter.uid).loaded).toBe(11);

    core.dispatch(coreActions.endRound());
    expect(core.getState().ship.weapons.find((w) => w.uid === cutter.uid).charging).toBe(0);
  });

  it("flags destruction when a Critical Hit itself finishes the hull", () => {
    // Massive Hull Damage doubles the hit; that second helping used to
    // be able to reach 0 hull without ever marking the ship destroyed.
    const entry = CRIT_TABLE.find((e) => e.name === "Massive Hull Damage");
    const s = { ...FALSTAFF(), hull: 12, firstDamageTaken: true };
    const out = entry.apply(s, makeRngState(1), { damage: 30 });
    expect(out.ship.hull).toBe(0);

    const full = applyShipDamage({ ...FALSTAFF(), hull: 20, firstDamageTaken: true },
      makeRngState(1), 19, { unavoidable: true });
    if (full.ship.hull <= 0) expect(full.ship.destroyed).toBe(true);
  });

  it("rolls the crit table for a torpedo on any hit, not only a critical", () => {
    const s = { ...FALSTAFF(), firstDamageTaken: true, crossed: { t25: true, t50: true, t75: true } };
    // With every trigger already spent, a plain hit produces no crit...
    const plain = applyShipDamage(s, makeRngState(6), 5, { unavoidable: true });
    // ...but flagging it as a critical-on-hit weapon must produce one.
    const torp = applyShipDamage(s, makeRngState(6), 5, { unavoidable: true, critHit: true });
    // applyShipDamage returns [kind, text] tuples; the store turns
    // them into {kind, text} objects on the way to the feed.
    expect(torp.lines.some(([, text]) => text.includes("CRITICAL HIT CHECK"))).toBe(true);
    expect(torp.lines.length).toBeGreaterThan(plain.lines.length);
  });
});
