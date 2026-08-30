/* ============================================================
   THE RULESET SEAM.

   The claim under test is narrow and it is the only one worth
   making: `rules.js` no longer HOLDS a system, it READS one, and
   a system that is not Mothership survives the reading.

   That is proven with a ruleset defined here in the test file
   rather than shipped — three stats, three saves, no classes, no
   panic table, a different armour save and a different health
   formula. It exists to be different, and if the engine can
   carry it then the numbers really are outside `rules.js` rather
   than merely re-exported from a new location.

   IT IS A TEST AND NOT A PRODUCT ON PURPOSE. A plugin interface
   with one shipped implementation is a rename; a second one
   invented to make a version number look better is worse. What
   this file demonstrates is the seam. What it does not
   demonstrate — because it is still true — is that character
   creation, panic and module loadouts remain Mothership-shaped.
   See the header of `engine/ruleset.js` for the list.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  defineRuleset, registerRuleset, getRuleset, rulesets, activeRulesetId,
} from "../src/engine/ruleset.js";
import mothership from "../src/engine/rulesets/mothership.js";
import {
  RULESET, CLASSES, STAT_KEYS, SAVE_KEYS, STAT_LABEL, PANIC_TABLE,
  SKILL_TREE, SKILL_COST, panicEffect, skillTier, makeCharacter, armorSave, baseValue,
} from "../src/engine/rules.js";

/* ---------------- the shipped one ---------------- */

describe("Mothership, declared through the contract", () => {
  it("is valid", () => {
    expect(mothership.problems).toEqual([]);
    expect(mothership.warnings).toEqual([]);
  });

  it("is what the engine is running", () => {
    expect(activeRulesetId()).toBe("mothership1e");
    expect(RULESET.id).toBe("mothership1e");
  });

  it("carries every number rules.js used to hold, unchanged", () => {
    /* The refactor's whole promise: nothing moved that anybody can
       see. Thirty-one files import these and none of them changed. */
    expect(STAT_KEYS).toEqual(["strength", "speed", "intellect", "combat"]);
    expect(SAVE_KEYS).toEqual(["sanity", "fear", "body", "armor"]);
    expect(STAT_LABEL.strength).toBe("Strength");
    expect(Object.keys(CLASSES)).toEqual(["teamster", "android", "scientist", "marine"]);
    expect(PANIC_TABLE).toHaveLength(19);
    expect(panicEffect(1).name).toBe("Laser Focus");
    expect(panicEffect(99).name).toBe("Heart Attack");
    expect(SKILL_COST).toEqual({ trained: 1, expert: 2, master: 3 });
    expect(skillTier("Zero-G")).toBe("trained");
    expect(SKILL_TREE.expert.Astrogation).toEqual(["Piloting"]);
  });
});

/* ---------------- something that is not Mothership ---------------- */

const OTHER = defineRuleset({
  id: "conformance-witness",
  name: "A DIFFERENT GAME",
  stats: ["grit", "wit", "reach"],
  saves: ["nerve", "flesh", "plating"],
  labels: { grit: "Grit", wit: "Wit", reach: "Reach", nerve: "Nerve", flesh: "Flesh", plating: "Plating" },
  armorSave: "plating",
  classes: {},
  skills: { tree: { basic: { Climbing: [], Wiring: [] } }, cost: { basic: 1 }, bonus: { basic: 10 } },
  panic: { table: [], triggers: {} },
  rollStats: () => ({ grit: 40, wit: 40, reach: 40 }),
  health: (s) => s.grit + s.reach,
  startingStress: 0,
  maxWounds: 4,
  startingCredits: () => 0,
});

describe("a ruleset that is deliberately not Mothership", () => {
  it("validates", () => {
    expect(OTHER.problems).toEqual([]);
  });

  it("registers and comes back", () => {
    registerRuleset(OTHER);
    expect(getRuleset("conformance-witness")).toBe(OTHER);
    expect(rulesets().map((r) => r.id)).toContain("mothership1e");
  });

  it("has no classes, which is allowed", () => {
    /* Every default in `defineRuleset` is the empty one rather than
       Mothership's, so a ruleset that declares no classes gets none
       rather than four smuggled in behind it. */
    expect(OTHER.classes).toEqual({});
    expect(OTHER.panic.table).toEqual([]);
  });

  it("keeps its own health formula and starting numbers", () => {
    expect(OTHER.health({ grit: 40, reach: 30 })).toBe(70);
    expect(OTHER.startingStress).toBe(0);
    expect(OTHER.maxWounds).toBe(4);
  });

  it("names its own armour save", () => {
    expect(OTHER.armorSave).toBe("plating");
  });

  it("fills in labels rather than rendering raw keys, and says it did", () => {
    const terse = defineRuleset({ id: "t", name: "T", stats: ["vigour"], saves: ["will"] });
    expect(terse.labels.vigour).toBe("Vigour");
    expect(terse.warnings.join(" ")).toMatch(/no label for "vigour"/);
  });
});

/* ---------------- what it refuses ---------------- */

describe("what a ruleset may not do", () => {
  it("must have stats and saves", () => {
    const bad = defineRuleset({ id: "x", name: "X" });
    expect(bad.problems).toEqual(expect.arrayContaining([
      "ruleset is missing stats", "ruleset is missing saves",
    ]));
  });

  it("may not name the same key as both a stat and a save", () => {
    /* `baseValue` switches on `kind`, so one name meaning two numbers
       shows up only as a wrong target percentage. */
    const bad = defineRuleset({ id: "x", name: "X", stats: ["body"], saves: ["body"] });
    expect(bad.problems.join(" ")).toMatch(/both a stat and a save/);
  });

  it("may not give a class a save or a stat that does not exist", () => {
    const bad = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      classes: { hauler: { name: "HAULER", saves: { sanity: 30 }, bonus: { speed: 5 } } },
    });
    expect(bad.problems.join(" ")).toMatch(/unknown save "sanity"/);
    expect(bad.problems.join(" ")).toMatch(/unknown stat "speed"/);
  });

  it("may not build a skill on a prerequisite it does not have", () => {
    const bad = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      skills: { tree: { expert: { Astrogation: ["Piloting"] } } },
    });
    expect(bad.problems.join(" ")).toMatch(/needs unknown skill "Piloting"/);
  });

  it("may not point armorSave at a save it does not have", () => {
    const bad = defineRuleset({ id: "x", name: "X", stats: ["grit"], saves: ["nerve"], armorSave: "plating" });
    expect(bad.problems.join(" ")).toMatch(/armorSave names "plating"/);
  });

  it("registers a broken ruleset anyway, with its problems attached", () => {
    /* Refusing would make a broken ruleset indistinguishable from a
       missing one, and "nothing happened" is the hardest failure to
       find. */
    const bad = defineRuleset({ id: "broken", name: "B" });
    registerRuleset(bad);
    expect(getRuleset("broken").problems.length).toBeGreaterThan(0);
  });
});

/* ---------------- the engine reading through it ---------------- */

describe("the functions that stayed in rules.js", () => {
  const items = {
    vest: { n: "Vest", armor: 7 },
    torch: { n: "Torch" },
  };

  it("adds worn armour to the save the RULESET names, not to one called armor", () => {
    /* This was a literal string comparison. A system whose protection
       is called anything else was silently getting the unmodified
       save with no worn armour in it at all. */
    const pc = { saves: { armor: 30 }, items: ["vest"], armorDamage: 0 };
    expect(armorSave(pc, items)).toBe(37);
    expect(baseValue(pc, "save", "armor", items)).toBe(37);
  });

  it("still degrades armour", () => {
    const pc = { saves: { armor: 30 }, items: ["vest"], armorDamage: 3 };
    expect(armorSave(pc, items)).toBe(34);
  });

  it("does not throw on a character with no class", () => {
    /* Legitimate under a classless ruleset. `c.bonus` on an unknown
       class used to throw, which was fine while the four class keys
       were literals in rules.js and is not now. */
    const pc = makeCharacter(
      { name: "NOBODY", cls: null, stats: { strength: 30, speed: 30, intellect: 30, combat: 30 }, skills: [], loadout: null },
      { items: {}, loadouts: {} },
    );
    expect(pc.name).toBe("NOBODY");
    expect(pc.maxHealth).toBe(60);
    expect(pc.saves).toEqual({});
  });

  it("builds a Mothership character exactly as before", () => {
    const pc = makeCharacter(
      { name: "RILEY", cls: "teamster", stats: { strength: 30, speed: 30, intellect: 30, combat: 30 }, skills: ["Zero-G"], loadout: null },
      { items: {}, loadouts: {} },
    );
    /* Teamster: +5 Strength, +5 Speed. Health is Strength × 2. */
    expect(pc.stats.strength).toBe(35);
    expect(pc.maxHealth).toBe(70);
    expect(pc.saves.fear).toBe(35);
    expect(pc.stress).toBe(2);
    expect(pc.maxWounds).toBe(2);
  });
});
