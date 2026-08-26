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
