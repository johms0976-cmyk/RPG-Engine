/* ============================================================
   The changes from the engine review, held down by tests.

   Grouped by the finding each one closes rather than by file,
   because the thing worth protecting is the behaviour and the
   file it lives in is an implementation detail.
   ============================================================ */

import { describe, it, expect } from "vitest";
import {
  rungPacing, safeMove, isSpoken, moveLabel, MOVE_HARSH,
  PASS_TIME_MIN, PASS_TIME_MAX, PASS_TIME_GAP_MS,
} from "../src/engine/director.js";
import { chooseVictim, moraleBroken, TACTICS } from "../src/engine/combat.js";
import { riskOf, cleanReason } from "../src/engine/oracle.js";
import { check } from "../src/engine/dice.js";
import { makeRng } from "../src/engine/oracle.js";

/* A world far enough behind that pacing calls it drifting: an hour
   of real time at the default rate should have bought a lot more
   fiction than four minutes of it. */
const HOUR = 60 * 60 * 1000;
const now = 5_000_000;
const drifting = {
  mod: { director: { rate: 4 } },
  w: { clock: 4, threats: {}, visited: {} },
  now,
  startedAt: now - HOUR,
  combat: null,
  pending: null,
  lastPassAt: 0,
};

describe("7.1 — the empty chair's hand on the clock", () => {
  it("spends fiction-minutes when the table has drifted", () => {
    const m = rungPacing(drifting);
    expect(m).toBeTruthy();
    expect(m.kind).toBe("passTime");
    expect(m.mins).toBeGreaterThanOrEqual(PASS_TIME_MIN);
  });

  it("never skips more than the cap, however far behind the table is", () => {
    const m = rungPacing({ ...drifting, startedAt: now - 12 * HOUR });
    expect(m.mins).toBeLessThanOrEqual(PASS_TIME_MAX);
  });

  it("stays out of a fight — rounds are seconds", () => {
    expect(rungPacing({ ...drifting, combat: { enemies: [] } })).toBeNull();
  });

  it("does not run the clock while somebody is reading a prompt", () => {
    expect(rungPacing({ ...drifting, pending: { pcId: "pc1" } })).toBeNull();
  });

  it("spaces the skips out", () => {
    expect(rungPacing({ ...drifting, lastPassAt: now - 1000 })).toBeNull();
    expect(rungPacing({ ...drifting, lastPassAt: now - PASS_TIME_GAP_MS - 1 })).toBeTruthy();
  });

  it("does nothing at all when the table is keeping pace", () => {
    expect(rungPacing({ ...drifting, w: { ...drifting.w, clock: 240 } })).toBeNull();
  });

  it("is refused by safeMove if a rung ever forgets its own cap", () => {
    const base = { kind: "passTime", rung: "pacing" };
    const ctx = { w: drifting.w, mod: drifting.mod, crew: [] };
    expect(safeMove({ ...base, mins: PASS_TIME_MAX + 1 }, ctx)).toBeNull();
    expect(safeMove({ ...base, mins: -10 }, ctx)).toBeNull();
    expect(safeMove({ ...base, mins: undefined }, ctx)).toBeNull();
    expect(safeMove({ ...base, mins: PASS_TIME_MIN }, ctx)).toBeTruthy();
  });

  it("is visible to a Warden before it lands, and is not counted as cruelty", () => {
    // Spoken: the clock is the module's main antagonist.
    expect(isSpoken({ kind: "passTime", mins: 10 })).toBe(true);
    // Not harsh: otherwise a drifting evening trips the breather rung,
    // answering "nothing is happening" with "let us all stop".
    expect(MOVE_HARSH.passTime).toBe(false);
    expect(moveLabel({ kind: "passTime", mins: 10 })).toMatch(/10 minutes/);
  });
});

describe("7.2 — the empty chair can ask for a save", () => {
  it("tests the character when they describe risking something", () => {
    expect(riskOf("I force the hatch with the crowbar")).toMatchObject({ stat: "strength", save: false });
    expect(riskOf("I hotwire the door panel")).toMatchObject({ stat: "intellect" });
    expect(riskOf("I vault the railing")).toMatchObject({ stat: "speed" });
  });

  it("knows the difference between enduring and doing", () => {
    expect(riskOf("I steady myself and look anyway")).toMatchObject({ stat: "fear", save: true });
  });

  it("never tests somebody for asking a question", () => {
    expect(riskOf("can I force the hatch?")).toBeNull();
    expect(riskOf("is the hatch jammed")).toBeNull();
    expect(riskOf("could we pry it open")).toBeNull();
  });

  it("leaves ordinary chatter to the oracle", () => {
    expect(riskOf("I look around the room")).toBeNull();
    expect(riskOf("I ask her about the cargo")).toBeNull();
    expect(riskOf("")).toBeNull();
  });

  it("quotes the player rather than composing a reason", () => {
    // Every surviving word is the player's own — this is what keeps
    // the feature clear of INV-1.
    const r = riskOf("I try to force the maintenance hatch");
    expect(r.reason).toBe("force the maintenance hatch");
    expect(cleanReason("I wrench the panel off.")).toBe("wrench the panel off");
  });
});

describe("7.6 — the dice come off the seeded stream", () => {
  it("replays identically from the same seed", () => {
    const roll = (seed) => {
      const rng = makeRng(seed);
      return [0, 1, 2, 3, 4].map(() => check(50, "none", { rng }).value);
    };
    expect(roll(1234)).toEqual(roll(1234));
    expect(roll(1234)).not.toEqual(roll(9999));
  });
});

describe("7.7 — the thing behaves like a creature", () => {
  const mk = (id, health, room) => ({ id, health, maxHealth: 10, room });
  const crew = [mk("a", 10, "hold"), mk("b", 3, "hold"), mk("c", 10, "vents")];
  const combat = { actors: { a: { actions: 2 }, b: { actions: 2 }, c: { actions: 2 } } };

  it("defaults to the old behaviour so every existing module is unchanged", () => {
    expect(chooseVictim({}, crew, combat).id).toBe("b");             // most wounded
    expect(chooseVictim({ tactics: "weakest" }, crew, combat).id).toBe("b");
  });

  it("takes whoever is alone when told to", () => {
    expect(chooseVictim({ tactics: "isolated" }, crew, combat).id).toBe("c");
  });

  it("goes for whoever just made a noise", () => {
    const loud = { actors: { a: { actions: 2 }, b: { actions: 2 }, c: { actions: 0, aimReady: true } } };
    expect(chooseVictim({ tactics: "loudest" }, crew, loud).id).toBe("c");
  });

  it("falls back rather than crashing on a tactic nobody declared", () => {
    expect(TACTICS).toContain("weakest");
    expect(chooseVictim({ tactics: "nonsense" }, crew, combat).id).toBe("b");
  });

  it("breaks off once it has taken enough — and reads hits the right way round", () => {
    const t = { morale: 0.5 };
    // hits counts wounds TAKEN. Untouched is full health, not broken.
    expect(moraleBroken(t, { hits: 0, maxHits: 4 })).toBe(false);
    expect(moraleBroken(t, { hits: 1, maxHits: 4 })).toBe(false);
    expect(moraleBroken(t, { hits: 2, maxHits: 4 })).toBe(true);
  });

  it("stays in the fight if it has hold of somebody, however hurt", () => {
    expect(moraleBroken({ morale: 0.9 }, { hits: 3, maxHits: 4, grabbed: "pc1" })).toBe(false);
  });

  it("never fires for a threat that did not ask for it", () => {
    expect(moraleBroken({}, { hits: 3, maxHits: 4 })).toBe(false);
  });
});
