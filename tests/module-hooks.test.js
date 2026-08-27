/* ============================================================
   MODULE HOOKS, CALLED THE WAY THE ENGINE CALLS THEM.

   `{ run: "name" }` in an effect list reaches `api.run(name, vars)`,
   and `vars` is the effect's template variables — almost always an
   empty object. It is NOT the world.

   Three hooks in Dead Weight were written as `(api, w) => …` and read
   `w.flags`, so every one of them threw the moment it fired. Nothing
   caught it because no test ever fired a `run:` hook: `ignition` is
   the module's own countdown expiry, which means the ninety-minute
   module could not reach its own ending, and the throw ate the
   `endGame` call that came after it, so the session simply carried on
   past the burn forever.

   This walks every module on the shelf, collects every hook named by
   a `run:` anywhere in the module, and calls it against a recording
   stub. A hook that reads its second argument as state fails here
   instead of at somebody's table.
   ============================================================ */
import { describe, it, expect } from "vitest";
import MODULES from "../src/modules/index.js";
import { createWorld } from "../src/engine/world.js";

/** Every `run:` name anywhere in a module, however deeply nested. */
function runNames(node, found = new Set(), seen = new WeakSet()) {
  if (!node || typeof node !== "object") return found;
  if (seen.has(node)) return found;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const v of node) runNames(v, found, seen);
    return found;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "run" && typeof v === "string") found.add(v);
    else if (v && typeof v === "object") runNames(v, found, seen);
  }
  return found;
}

/** Enough api for a hook to do its work without a React tree. */
function stubApi(mod) {
  const world = createWorld(mod);
  const said = [];
  /* A plausible acting character. Hooks are entitled to assume one
     exists — nothing fires a `run:` effect with nobody acting. */
  const pc = {
    id: "pc1", name: "TEST", cls: "teamster", room: world.room,
    stats: { strength: 40, speed: 40, intellect: 40, combat: 40 },
    saves: { sanity: 30, fear: 35, body: 30, armor: 35 },
    health: 60, maxHealth: 60, stress: 2, resolve: 0,
    skills: [], items: [], ammo: {}, spare: {}, uses: {}, buffs: [],
    conditions: [], credits: 0, alive: true, unconscious: false,
    meters: {}, tracks: {},
  };
  const api = {
    mod,
    items: { ...(mod.items || {}) },
    world: () => world,
    pc: () => pc,
    crew: () => [pc],
    rng: () => 0.5,
    ctx: () => ({ world, mod, pc, crew: [pc], items: mod.items || {} }),
    ended: () => false,
    roomOf: () => world.room,
    pcsIn: () => [pc],
    crewRooms: () => [world.room],
    alone: () => false,
    split: () => false,
    say: (tone, text) => said.push({ tone, text }),
    sayIn: (room, tone, text) => said.push({ room, tone, text }),
    sayOthers: () => {},
    npcSay: () => {},
    whisper: () => {},
    whisperTo: () => {},
    flag: (k, v = true) => { world.flags[k] = v; },
    meter: () => {},
    give: () => {}, take: () => {},
    stress: () => {}, stressCrew: () => {},
    heal: () => {}, hurt: () => {}, panic: () => {},
    addCondition: () => {}, addBuff: () => {},
    advance: () => {}, advanceNow: () => {}, noise: () => {},
    vanish: () => {}, rollTable: () => {},
    setThreat: (id, patch) => { world.threats[id] = { ...(world.threats[id] || {}), ...patch }; },
    setNpc: () => {},
    startTrack: () => {}, awardXp: () => {},
    countdown: () => {}, stopCountdown: () => {},
    offerRest: () => {}, setMarks: () => {},
    rollNow: () => ({ success: true, roll: 50, target: 50 }),
    ask: () => {}, startCombat: () => {},
    endGame: (id) => { world.ended = id; },
    moveTo: () => {},
    run: (name) => { const f = mod.hooks[name]; if (f) f(api, {}); },
    effects: () => {},
  };
  return { api, world, said };
}

describe("every hook a module names in a `run:` effect", () => {
  for (const mod of MODULES) {
    const names = [...runNames({
      rooms: mod.rooms, actions: mod.actions, tables: mod.tables,
      itemUse: mod.itemUse, handouts: mod.handouts, endings: mod.endings,
      onStart: mod.onStart, director: mod.director, threats: mod.threats,
      npcs: mod.npcs, devices: mod.devices,
    })];

    it(`${mod.id}: exists and survives being called with no vars`, () => {
      const missing = names.filter((n) => typeof (mod.hooks || {})[n] !== "function");
      expect(missing, `${mod.id} names hooks it does not define`).toEqual([]);

      for (const n of names) {
        const { api } = stubApi(mod);
        /* The engine calls `fn(api, vars)`. A hook that treats the
           second argument as the world blows up right here. */
        expect(() => mod.hooks[n](api, {}), `${mod.id}.hooks.${n}`).not.toThrow();
      }
    });

    it(`${mod.id}: no hook reads its second argument as state`, () => {
      /* A `run:` hook declaring two parameters is not automatically
         wrong, but it has to be deliberate, so this pins the arity
         rather than trusting the call above to have exercised every
         branch. */
      const greedy = names.filter((n) => (mod.hooks[n] || {}).length >= 2);
      expect(greedy, `${mod.id}: these take a second argument the engine does not supply as state`)
        .toEqual([]);
    });
  }
});

describe("Dead Weight can reach its own ending", () => {
  const dw = MODULES.find((m) => m.id === "deadweight");

  it("lights the burn and ends the session when the cable is still attached", () => {
    const { api, world, said } = stubApi(dw);
    dw.hooks.ignition(api, {});
    expect(world.flags.burn_lit).toBe(true);
    expect(world.ended).toBe("burned");
    expect(said.length).toBeGreaterThan(0);
  });

  it("lights the burn and does NOT end it when the crew already cut", () => {
    const { api, world } = stubApi(dw);
    world.flags.cable_cut = true;
    dw.hooks.ignition(api, {});
    expect(world.flags.burn_lit).toBe(true);
    expect(world.ended).toBeFalsy();
  });

  it("moves the threat when the hold is open, and only warns when it is not", () => {
    const { api, world, said } = stubApi(dw);
    world.threats.sleeper = { loc: "coldhold", dead: false };
    dw.hooks.prowl(api, {});
    expect(said.length).toBe(1);
    expect(world.threats.sleeper.loc).toBe("coldhold");

    const two = stubApi(dw);
    two.world.threats.sleeper = { loc: "coldhold", dead: false };
    two.world.flags.hold_open = true;
    dw.hooks.prowl(two.api, {});
    expect(two.world.threats.sleeper.loc).toBe("hopperdeck");
  });

  it("counts the coolant rods up to three and then takes the cold back", () => {
    const { api, world } = stubApi(dw);
    for (let i = 0; i < 3; i++) dw.hooks.reseat(api, {});
    expect(world.flags.rods_seated).toBe(3);
    expect(world.flags.hold_cold).toBe(true);
  });
});
