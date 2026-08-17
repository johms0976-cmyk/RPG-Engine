import { describe, it, expect } from "vitest";
import {
  redactPc, redactWorld, redactState, visibleFeed, visibleConditions, secretsHeld, VIEW,
} from "../src/engine/secrets.js";
import { distort, distortionsActive } from "../src/net/distort.js";

const pc = (over = {}) => ({
  id: "pc1", name: "LILITH", alive: true, health: 40, maxHealth: 74,
  stress: 6, conditions: [], buffs: [], ...over,
});
const world = (over = {}) => ({
  seed: 12345, room: "bridge", clock: 100,
  threats: { thing: { loc: "vents", seen: false, distracted: 3 } },
  clocks: { hunt: { next: 40, on: true } },
  oracleMemory: { a: 1 }, rollLog: [1, 2, 3],
  ...over,
});
const state = (over = {}) => ({
  w: world(), crew: [pc(), pc({ id: "pc2", name: "ABEL" })], feed: [], ...over,
});

describe("hidden conditions", () => {
  it("does not tell you that you are hallucinating", () => {
    const me = pc({ conditions: ["Hallucinating", "Phobia"] });
    expect(visibleConditions(me, VIEW.PLAYER, "pc1")).toEqual(["Phobia"]);
  });

  it("does tell the rest of the crew, who can watch you", () => {
    const them = pc({ id: "pc2", conditions: ["Hallucinating"] });
    expect(visibleConditions(them, VIEW.PLAYER, "pc1")).toEqual(["Hallucinating"]);
  });

  it("tells the Warden everything", () => {
    const me = pc({ conditions: ["Hallucinating", "Paranoid"] });
    expect(visibleConditions(me, VIEW.WARDEN, "pc1")).toHaveLength(2);
  });

  it("removes the secret timer rather than zeroing it", () => {
    const me = pc({ buffs: [{ kind: "hallucinating", until: 900 }, { kind: "adv", until: 200 }] });
    const seen = redactPc(me, VIEW.PLAYER, "pc1");
    expect(seen.buffs).toHaveLength(1);
    expect(seen.buffs[0].kind).toBe("adv");
    expect(JSON.stringify(seen)).not.toContain("hallucinating");
  });
});

describe("the world the crew is allowed to see", () => {
  it("hides where an unseen threat is", () => {
    const w = redactWorld(world(), VIEW.PLAYER);
    expect(w.threats.thing.loc).toBe(null);
  });

  it("shows a threat once it has been seen", () => {
    const w = redactWorld(world({ threats: { thing: { loc: "vents", seen: true } } }), VIEW.PLAYER);
    expect(w.threats.thing.loc).toBe("vents");
  });

  it("hides clock timers, the oracle's memory and the roll log", () => {
    const w = redactWorld(world(), VIEW.PLAYER);
    expect(w.clocks).toEqual({});
    expect(w.oracleMemory).toBeUndefined();
    expect(w.rollLog).toBeUndefined();
  });

  it("hands the Warden the world untouched", () => {
    const w = world();
    expect(redactWorld(w, VIEW.WARDEN)).toBe(w);
  });
});

describe("addressed feed lines", () => {
  const feed = [
    { id: 1, text: "public" },
    { id: 2, text: "for pc1", to: "pc1" },
    { id: 3, text: "for pc2", to: "pc2" },
    { id: 4, text: "warden note", wardenOnly: true },
  ];

  it("delivers a whisper only to its addressee", () => {
    expect(visibleFeed(feed, VIEW.PLAYER, "pc1").map((l) => l.id)).toEqual([1, 2]);
    expect(visibleFeed(feed, VIEW.PLAYER, "pc2").map((l) => l.id)).toEqual([1, 3]);
  });

  it("never leaks a Warden-only line", () => {
    expect(visibleFeed(feed, VIEW.PLAYER, "pc1").some((l) => l.wardenOnly)).toBe(false);
  });

  it("leaves the Warden's own view whole", () => {
    expect(visibleFeed(feed, VIEW.WARDEN, null)).toHaveLength(4);
  });
});

describe("the whole redaction", () => {
  it("strips a state end to end without mutating the original", () => {
    const s = state({
      crew: [pc({ conditions: ["Hallucinating"] })],
      feed: [{ id: 1, text: "a" }, { id: 2, text: "b", wardenOnly: true }],
    });
    const before = JSON.stringify(s);
    const out = redactState(s, VIEW.PLAYER, "pc1");
    expect(out.crew[0].conditions).toEqual([]);
    expect(out.feed).toHaveLength(1);
    expect(out.w.threats.thing.loc).toBe(null);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("reports to the Warden what a player is not being told", () => {
    const s = state({ crew: [pc({ conditions: ["Hallucinating", "Phobia"] })] });
    expect(secretsHeld(s, "pc1")).toContain("Hallucinating");
    expect(secretsHeld(s, "pc1")).not.toContain("Phobia");
  });
});

describe("distortion", () => {
  const hallucinating = state({ crew: [pc({ conditions: ["Hallucinating"] }), pc({ id: "pc2" })] });

  it("leaves an unafflicted character's world alone", () => {
    const s = state();
    expect(distort(s, "pc1")).toBe(s);
  });

  it("invents a door for someone who is hallucinating", () => {
    const out = distort(hallucinating, "pc1");
    expect(out.phantomExit).toBeTruthy();
    expect(out.phantomExit.from).toBe("bridge");
  });

  it("gives the same phantom every time, so it reads as real", () => {
    const a = distort(hallucinating, "pc1");
    const b = distort(hallucinating, "pc1");
    expect(a.phantomExit).toEqual(b.phantomExit);
  });

  it("gives different characters different phantoms", () => {
    const both = state({ crew: [pc({ conditions: ["Hallucinating"] }), pc({ id: "pc2", conditions: ["Hallucinating"] })] });
    expect(distort(both, "pc1").phantomExit.id).not.toBe(distort(both, "pc2").phantomExit.id);
  });

  it("marks anything invented, so nothing invented can be load-bearing", () => {
    const out = distort(hallucinating, "pc1");
    for (const line of out.feed) if (line.id < 0) expect(line.phantom).toBe(true);
    expect(out.phantomExit.id).toMatch(/^__phantom_/);
  });

  it("misreports other people's stress under paranoia, never your own", () => {
    const s = state({ crew: [pc({ conditions: ["Paranoid"] }), pc({ id: "pc2", stress: 4 })] });
    const out = distort(s, "pc1");
    expect(out.crew[0].stress).toBe(6);
    expect(out.crew[1].stress).toBeGreaterThan(4);
  });

  it("misreports your own health under Broken", () => {
    const s = state({ crew: [pc({ conditions: ["Broken"], health: 40 })] });
    const out = distort(s, "pc1");
    expect(out.crew[0].health).not.toBe(40);
    expect(out.crew[0].health).toBeLessThanOrEqual(out.crew[0].maxHealth);
  });

  it("does not lie to the dead", () => {
    const s = state({ crew: [pc({ conditions: ["Hallucinating"], alive: false })] });
    expect(distort(s, "pc1")).toBe(s);
  });

  it("tells the Warden who is being lied to", () => {
    const active = distortionsActive(hallucinating);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("LILITH");
    expect(active[0].kinds).toEqual(["Hallucinating"]);
  });
});
