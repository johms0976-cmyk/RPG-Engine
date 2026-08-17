import { describe, it, expect } from "vitest";
import mod from "../src/modules/ypsilon14/index.js";
import { stepToward, ADJ, npcsAt } from "../src/modules/ypsilon14/sim.js";
import { createWorld } from "../src/engine/world.js";
import { test as pred } from "../src/engine/effects.js";
import { spawnEnemy, setEnemy, grabberOf, resolveEnemyAttack, resolveEscape } from "../src/engine/combat.js";
import { withDefaults } from "../src/engine/houserules.js";
import { makeRng } from "../src/engine/oracle.js";
import { makeCharacter, rollStats } from "../src/engine/rules.js";

const mkPc = (name, cls) => makeCharacter(
  { name, cls, stats: rollStats(), skills: [], loadout: "excavation" },
  { items: mod.items, loadouts: mod.loadouts });

const ctxFor = (world, pc) => ({ world, pc, crew: pc ? [pc] : [], items: mod.items, mod, houseRules: withDefaults({}) });

describe("ypsilon 14 — the module loads clean", () => {
  it("has no validation problems or warnings", () => {
    expect(mod.problems).toEqual([]);
    expect(mod.warnings).toEqual([]);
  });

  it("keeps the Warden material that defineModule used to drop", () => {
    expect(mod.warden.setting).toMatch(/echolocation/);
    expect(mod.lore.cast.kantaro.secret).toMatch(/nine days ago/);
    expect(mod.tutorial.leadsInto).toMatch(/Greta Base/);
  });

  it("gives the thing somewhere to actually be", () => {
    const w = createWorld(mod, 1);
    expect(w.threats.it.loc).toBe("vents");
    expect(mod.threats.it.retreatTo).toBe("ante");
  });

  it("has a Devour attack that grapples, as well as claws", () => {
    const names = mod.threats.it.attacks.map((a) => a.name);
    expect(names).toContain("Devour");
    expect(mod.threats.it.attacks.find((a) => a.name === "Devour").grapple).toBe(true);
    expect(mod.threats.it.grapple.condition).toBe("BEING DEVOURED");
  });

  it("does not hand out water for free — the bottle starts empty", () => {
    expect(mod.items.squirtbottle.water).toBeUndefined();
    expect(mod.items.fullbottle.water).toBe(true);
    expect(mod.items.jerrycan.water).toBe(true);
  });
});

describe("the base's geography", () => {
  it("routes the thing from the vents to its pod", () => {
    expect(stepToward("vents", "ante")).toBe("work");
    expect(stepToward("work", "ante")).toBe("entrance");
    expect(stepToward("entrance", "ante")).toBe("ante");
  });

  it("routes around a room it refuses to enter", () => {
    expect(stepToward("mess", "work", ["quarters"])).toBe("vents");
  });

  it("agrees with the room exits it was drawn from", () => {
    for (const [from, tos] of Object.entries(ADJ)) {
      for (const to of tos) expect(mod.rooms[to], `${from} -> ${to}`).toBeTruthy();
    }
  });
});

describe("predicates the module leans on", () => {
  const world = createWorld(mod, 2);
  const pc = mkPc("TEST", "teamster");

  it("knows where an npc is, not just that they exist", () => {
    expect(pred("npcAt:sonya@work", ctxFor(world, pc))).toBe(true);
    expect(pred("npcAt:sonya@mess", ctxFor(world, pc))).toBe(false);
  });

  it("knows where the threat is", () => {
    expect(pred("threatAt:it@vents", ctxFor(world, pc))).toBe(true);
    expect(pred("threatAt:it@mess", ctxFor(world, pc))).toBe(false);
  });

  it("reports who is in a room", () => {
    const api = { world: () => world, mod };
    expect(npcsAt(api, "work").sort()).toEqual(["dana", "rosa", "sonya"]);
    expect(npcsAt(api, "db1")).toEqual(["giovanni"]);
  });
});

describe("being devoured", () => {
  const pc = { ...mkPc("HELD", "marine"), id: "pc1" };
  const base = { round: 1, enemies: [spawnEnemy("it", mod.threats.it, 0)], actors: { pc1: {} }, order: [], turnIndex: 0 };

  it("starts with nobody in its mouth", () => {
    expect(base.enemies[0].grabbed).toBeNull();
    expect(grabberOf(base, "pc1")).toBeNull();
  });

  it("finds the grabber once it has hold of you", () => {
    const c = setEnemy(base, base.enemies[0].uid, { grabbed: "pc1" });
    expect(grabberOf(c, "pc1").threatId).toBe("it");
  });

  it("keeps working on the same victim instead of attacking someone else", () => {
    const c = setEnemy(base, base.enemies[0].uid, { grabbed: "pc1" });
    const rep = resolveEnemyAttack({ enemy: c.enemies[0], crew: [pc], combat: c, ctx: ctxFor(createWorld(mod, 3), pc) });
    expect(rep.holding).toBe(true);
    expect(rep.victimId).toBe("pc1");
    expect(rep.save).toBe("body");
  });

  it("lets you roll Strength to tear free", () => {
    const c = setEnemy(base, base.enemies[0].uid, { grabbed: "pc1" });
    const rep = resolveEscape({ pc, enemy: c.enemies[0], ctx: ctxFor(createWorld(mod, 4), pc) });
    expect(typeof rep.free).toBe("boolean");
    expect(rep.target).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------
   A stub of the engine api, good enough to run the base's simulation
   for a whole session and see whether it behaves like a place.
   ------------------------------------------------------------------ */
function harness(seed = 7, opts = {}) {
  const world = createWorld(mod, seed);
  const pc = { ...mkPc("SIM", "teamster"), id: "pc1" };
  const log = [];
  let combat = null;
  const roll = makeRng(seed);
  const api = {
    mod, items: mod.items, rng: roll,
    world: () => world,
    pc: () => pc,
    crew: () => [pc],
    ctx: () => ctxFor(world, pc),
    ended: () => !!world.ended,
    say: (tone, text) => log.push({ tone, text }),
    npcSay: (id, text) => log.push({ tone: "npc", text: `${id}: ${text}` }),
    flag: (k, v = true) => { world.flags[k] = v; },
    give: () => {}, take: () => {},
    stress: () => {}, stressCrew: () => {}, heal: () => {},
    hurt: () => {}, panic: () => {}, addCondition: () => {}, addBuff: () => {},
    awardXp: () => {}, meter: () => {},
    advance: (m) => { world.clock += m; },
    noise: () => {},
    rollNow: () => ({ success: true }),
    rollTable: (id) => log.push({ tone: "table", text: id }),
    startCombat: (id) => { combat = id; log.push({ tone: "combat", text: id }); },
    startTrack: () => {}, countdown: () => {}, stopCountdown: () => {},
    setThreat: (id, p) => {
      const t = world.threats[id];
      if (p.loc !== undefined) t.loc = p.loc;
      if (p.retreat !== undefined) t.retreatUntil = world.clock + p.retreat;
      if (p.heal !== undefined) t.dmg = Math.max(0, t.dmg - p.heal);
      if (p.dmg !== undefined) t.dmg = p.dmg;
      if (p.dead !== undefined) { t.dead = p.dead; t.loc = null; }
    },
    setNpc: (id, p) => { Object.assign(world.npcs[id], p); },
    vanish: (o) => {
      const eligible = mod.npcOrder.filter(
        (id) => world.npcs[id].alive && !world.npcs[id].taken && mod.npcs[id].vanishable !== false
      );
      const victim = o.id && eligible.includes(o.id) ? o.id : eligible[0];
      if (!victim) return null;
      const witnessed = world.npcs[victim].loc === world.room;
      Object.assign(world.npcs[victim], { taken: true, alive: false, loc: null });
      log.push({ tone: "vanish", text: victim });
      mod.hooks.onVanish(api, { id: victim, name: mod.npcs[victim].name, witnessed });
      return victim;
    },
    effects: () => {},
    run: (n) => mod.hooks[n] && mod.hooks[n](api),
    endGame: (id) => { world.ended = id; },
    moveTo: (r) => { world.room = r; },
  };
  if (opts.room) world.room = opts.room;
  const run = (hours) => {
    for (let i = 0; i < hours * 6; i++) {
      world.clock += 10;
      mod.hooks.onTick(api, { mins: 10, clock: world.clock, from: world.clock - 10 });
      if (world.ended) break;
    }
  };
  return { api, world, log, run, combat: () => combat };
}

describe("the base runs itself", () => {
  it("moves the thing out of the vents and around the base", () => {
    const h = harness(11);
    const seen = new Set();
    for (let i = 0; i < 60; i++) { h.run(0.5); seen.add(h.world.threats.it.loc); }
    expect(seen.size).toBeGreaterThan(2);
  });

  it("gets hungry and takes somebody", () => {
    const h = harness(12);
    h.run(12);
    const taken = mod.npcOrder.filter((id) => h.world.npcs[id].taken);
    expect(taken.length).toBeGreaterThan(0);
  });

  it("frightens the crew, and frightened crew muster instead of wandering", () => {
    const h = harness(13);
    h.run(24);
    expect(h.world.flags.crew_fear || 0).toBeGreaterThan(0);
    if (h.world.flags.muster) {
      h.run(3);
      const inMess = mod.npcOrder.filter(
        (id) => h.world.npcs[id].alive && !h.world.npcs[id].taken && h.world.npcs[id].loc === "mess"
      );
      expect(inMess.length).toBeGreaterThan(1);
    }
  });

  it("kills Kantaro on his own timetable, not the plot's", () => {
    const h = harness(14);
    h.run(24);
    expect(h.world.flags.kantaro_dead).toBe(true);
    expect(h.world.flags.crew_fear).toBeGreaterThanOrEqual(2);
  });

  it("sends a wounded thing home to the pod, and mends it there", () => {
    const h = harness(15);
    h.world.threats.it.dmg = 25;
    h.run(4);
    expect(h.world.threats.it.dmg).toBe(0);
  });

  it("leaves a wounded thing with nowhere to go once the pod is dead", () => {
    const h = harness(16);
    h.world.flags.pod_dead = true;
    h.world.threats.it.dmg = 25;
    h.run(4);
    expect(h.world.threats.it.dmg).toBe(25);
  });

  it("will not cross standing water unless it has nothing left to lose", () => {
    const h = harness(17);
    h.world.flags.showers = true;
    h.world.threats.it.loc = "quarters";
    for (let i = 0; i < 40; i++) {
      h.run(0.5);
      if (h.world.threats.it.loc === "wash") break;
    }
    expect(h.world.threats.it.loc).not.toBe("wash");
  });

  it("follows a decoy tape to an empty room", () => {
    const h = harness(18);
    h.world.threats.it.loc = "mess";
    h.world.flags.decoy_room = "work";
    h.world.flags.decoy_until = h.world.clock + 600;
    h.run(2);
    expect(["work", "quarters", "vents"]).toContain(h.world.threats.it.loc);
  });

  it("burns through suit air while the players are in vacuum", () => {
    const h = harness(19, { room: "depths" });
    h.run(2);
    expect(h.world.flags.air_used).toBeGreaterThan(90);
    expect(h.log.some((l) => /minutes of air remaining/.test(l.text))).toBe(true);
  });

  it("teaches the tutorial beats once each, and only once", () => {
    const h = harness(20, { room: "depths" });
    h.run(6);
    const taught = h.log.filter((l) => l.text.startsWith("▌"));
    const ids = taught.map((t) => t.text);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
