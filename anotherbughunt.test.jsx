import { describe, it, expect } from "vitest";
import mod from "../src/modules/anotherbughunt/index.js";

describe("ANOTHER BUG HUNT", () => {
  it("starts at the landing zone with the storm running", () => {
    expect(mod.start).toBe("lz");
    expect(mod.rooms.lz).toBeTruthy();
    const cd = mod.onStart.find((e) => e.countdown);
    expect(cd.countdown.minutes).toBe(600);
  });

  it("loads without problems or warnings", () => {
    expect(mod.problems || []).toEqual([]);
    expect(mod.warnings || []).toEqual([]);
  });

  it("every exit points at a real room or a real ending", () => {
    for (const [id, r] of Object.entries(mod.rooms))
      for (const e of r.exits || []) {
        if (e.to.startsWith("@")) expect(mod.endings[e.to.slice(1)], `${id} -> ${e.to}`).toBeTruthy();
        else expect(mod.rooms[e.to], `${id} -> ${e.to}`).toBeTruthy();
      }
  });

  it("every carc threat can be answered with acid", () => {
    for (const id of ["carc", "hatchling", "abara", "ziegler", "retinue", "maascarc"])
      expect(mod.threats[id].counters.some((c) => c.id === "acid"), id).toBe(true);
  });

  it("the Shriek runs all five published stages", () => {
    expect(mod.tracks.shriek.stages).toHaveLength(5);
  });

  it("every NPC's knows-list is their whole script", () => {
    for (const [id, n] of Object.entries(mod.npcs))
      if (!n.silent) expect(Array.isArray(n.knows), id).toBe(true);
  });

  it("the map places every room that is on it", () => {
    const extras = new Set((mod.map.extras || []).map((e) => e.room));
    for (const [id, r] of Object.entries(mod.rooms))
      if (r.onMap !== false && !extras.has(id))
        expect(mod.map.pos[id], `no map position for ${id}`).toBeTruthy();
  });
});

/* ============================================================
   THE LOOSE THREADS.

   Every one of these was a piece of content that existed in the
   module and could not be reached, used or fired by any sequence
   of play. A test that only checks the module loads will never
   catch that, which is exactly how they survived. These assert
   the chain, not the syntax.
   ============================================================ */
describe("ANOTHER BUG HUNT — nothing on the mantelpiece stays unfired", () => {
  const featuresOf = (id) => Object.values(mod.rooms[id].features || {});
  const givesOf = (id) => featuresOf(id).flatMap((f) => f.gives || []);
  const allGives = () => Object.keys(mod.rooms).flatMap(givesOf);
  const runNames = (eff, out = []) => {
    for (const e of [].concat(eff || [])) {
      if (!e || typeof e !== "object") continue;
      if (e.run) out.push(e.run);
      for (const k of ["then", "else", "onPass", "onFail", "effects", "onBreak", "onHold"]) {
        if (e[k]) runNames(e[k], out);
      }
    }
    return out;
  };
  const everyRun = () => {
    const out = [];
    for (const r of Object.values(mod.rooms)) {
      runNames(r.onFirstEnter, out); runNames(r.onEnter, out);
      for (const f of Object.values(r.features || {})) runNames(f.effects, out);
      for (const e of r.exits || []) runNames(e.effects, out);
      for (const a of r.actions || []) runNames(a.effects, out);
    }
    for (const a of mod.actions || []) runNames(a.effects, out);
    for (const d of Object.values(mod.devices || {})) {
      for (const a of d.actions || []) runNames(a.effects, out);
    }
    for (const e of Object.values(mod.itemUse || {})) runNames(e, out);
    for (const t of Object.values(mod.threats || {})) {
      for (const c of t.counters || []) { runNames(c.onBreak, out); runNames(c.onHold, out); runNames(c.effects, out); }
    }
    return out;
  };

  it("every {run:...} names a hook that exists", () => {
    for (const name of everyRun()) expect(typeof mod.hooks[name], name).toBe("function");
  });

  it("the doxorubicin thread runs end to end", () => {
    expect(allGives()).toContain("chemo");                       // reagent, Greta freezer
    expect(allGives()).toContain("doxonote");                    // the unfinished dose, Heron lab
    expect(mod.handouts.doxonote.effects.some((e) => e.flag === "knows_doxo")).toBe(true);
    expect(mod.devices.synth.actions.map((a) => a.id)).toContain("doxo");
    expect(mod.items.cytotoxin).toBeTruthy();
    expect(typeof mod.hooks.compoundDoxo).toBe("function");
  });

  it("the cytotoxin has somewhere to go once it exists", () => {
    expect((mod.actions || []).some((a) => a.id === "dose")).toBe(true);
    const bedside = ["doseUnderhill", "doseWeaver", "doseDemar"];
    for (const h of bedside) expect(everyRun(), h).toContain(h);
  });

  it("coated rounds are a counter on every carc, not a grant that cannot match", () => {
    expect(mod.items.coatedammo.grants).toBeUndefined();
    for (const id of ["carc", "hatchling", "abara", "ziegler", "retinue", "maascarc"])
      expect(mod.threats[id].counters.some((c) => c.id === "coated"), id).toBe(true);
  });

  it("the anti-material rifle and the GPMG can be picked up", () => {
    expect(allGives()).toContain("amr");
    expect(allGives()).toContain("gpmg");
  });

  it("the raft is stowed somewhere and used somewhere else", () => {
    expect(allGives()).toContain("raft");
    const raftExits = Object.values(mod.rooms)
      .flatMap((r) => r.exits || [])
      .filter((e) => e.needs === "has:raft");
    expect(raftExits.length).toBeGreaterThanOrEqual(2);
  });

  it("the assimilated marine has a way into play", () => {
    const ids = (mod.director.attacks || []).map((a) => a.threatId);
    expect(ids).toContain("grunt");
  });

  it("the foil cap does something", () => {
    expect(mod.itemUse.tinfoilhat).toBeTruthy();
    expect(allGives()).toContain("tinfoilhat");
    expect(typeof mod.hooks.wearFoil).toBe("function");
    expect(typeof mod.hooks.wearingFoil).toBe("function");
  });
});
