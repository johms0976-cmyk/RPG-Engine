/* ============================================================
   THE SEAM, FINISHED.

   `tests/ruleset.test.js` covers the contract as it stood at
   2.20.0 — stats, saves, classes, skills, and the numbers coming
   from a file rather than from `rules.js`. This covers the three
   pieces that were still Mothership-shaped and are not any more:

     1. creation renders the steps a ruleset declares, and only
        those, and can be COMPLETED without the ones it omits
     2. a system with no panic table has no panic, at all
        seventeen call sites, rather than rolling against an
        empty array
     3. a module says which system it was written for, and one
        written for another is refused rather than loaded into a
        session where every check reads `undefined`

   Where the earlier file asserts the DATA is swappable, this
   asserts the ENGINE is. It is the difference between a ruleset
   that validates and a ruleset somebody could play.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { defineRuleset, CREATE_STEPS } from "../src/engine/ruleset.js";
import { defineModule } from "../src/engine/defineModule.js";
import { readPortableModule } from "../src/engine/portableModule.js";
import { blankDraft, toEnvelope } from "../src/engine/moduleDraft.js";
import { RULESET, CLASSES } from "../src/engine/rules.js";
import ypsilon from "../src/modules/ypsilon14/index.js";
import deadweight from "../src/modules/deadweight/index.js";

/* ---------------- 1. creation steps ---------------- */

describe("creation is declared, not assumed", () => {
  it("Mothership declares all six", () => {
    expect(RULESET.create.steps).toEqual(CREATE_STEPS);
  });

  it("carries the ruleset's own sentence about its dice", () => {
    /* "6d10, 30 is about average" is a fact about Mothership and was
       written into the creator's markup. */
    expect(RULESET.create.statNote).toMatch(/6d10/);
  });

  it("lets a system leave out the steps it does not have", () => {
    const rs = defineRuleset({
      id: "no-classes", name: "N", stats: ["grit"], saves: ["nerve"],
      create: { steps: ["name", "stats", "loadout"] },
    });
    expect(rs.problems).toEqual([]);
    expect(rs.create.steps).toEqual(["name", "stats", "loadout"]);
  });

  it("REFUSES a class step with no classes", () => {
    /* The failure this prevents is a creator that renders an empty
       class picker and then will not let anybody finish, with nothing
       on screen saying why. */
    const rs = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      create: { steps: ["name", "class"] },
    });
    expect(rs.problems.join(" ")).toMatch(/class step but the ruleset declares no classes/);
  });

  it("refuses a skills step with no tree", () => {
    const rs = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      create: { steps: ["skills"] },
    });
    expect(rs.problems.join(" ")).toMatch(/skills step but the ruleset declares no skill tree/);
  });

  it("refuses a step nothing knows how to draw", () => {
    /* A step the creators cannot render is a step that silently does
       nothing, which is the worst of the three possible outcomes. */
    const rs = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      create: { steps: ["name", "haggle"] },
    });
    expect(rs.problems.join(" ")).toMatch(/unknown creation step "haggle"/);
  });

  it("defaults to all six when a ruleset says nothing", () => {
    const rs = defineRuleset({
      id: "x", name: "X", stats: ["grit"], saves: ["nerve"],
      classes: { a: { name: "A" } },
      skills: { tree: { basic: { Climbing: [] } } },
    });
    expect(rs.create.steps).toEqual(CREATE_STEPS);
  });
});

/* ---------------- 2. panic is optional ---------------- */

describe("a system with no panic mechanic", () => {
  it("says so, derived rather than declared", () => {
    /* `enabled` is computed from the table so the two cannot
       disagree — a ruleset cannot claim panic and ship no table. */
    const none = defineRuleset({ id: "x", name: "X", stats: ["a"], saves: ["b"], create: { steps: ["name"] } });
    expect(none.panic.enabled).toBe(false);
    expect(RULESET.panic.enabled).toBe(true);
  });

  it("still has the triggers, which are prose about a system that has one", () => {
    expect(Object.keys(RULESET.panic.triggers).length).toBeGreaterThan(0);
  });
});

describe("the one class ability that touches panic", () => {
  it("is found by its ability key, not by the class being called teamster", () => {
    /* The class data has carried `ability: "panicReroll"` since 2.0
       and nothing read it. A ruleset whose equivalent class has any
       other name was getting no reroll. */
    const rerollers = Object.values(CLASSES).filter((c) => c.ability === "panicReroll");
    expect(rerollers.map((c) => c.name)).toEqual(["TEAMSTER"]);
  });
});

/* ---------------- 3. modules name their system ---------------- */

describe("a module says what it was written for", () => {
  it("every module that ships does", () => {
    expect(ypsilon.ruleset).toBe("mothership1e");
    expect(deadweight.ruleset).toBe("mothership1e");
  });

  it("and loads with no problems and no warnings because of it", () => {
    for (const m of [ypsilon, deadweight]) {
      expect(m.problems).toEqual([]);
      expect(m.warnings).toEqual([]);
    }
  });

  it("REFUSES one written for a system that is not loaded", () => {
    /* The silent failure this prevents: a playable-looking session
       where every check resolves against a stat that does not exist,
       no error anywhere, and the first sign of trouble is a roll
       target of NaN. */
    const wrong = defineModule({
      id: "wrong", title: "WRONG", ruleset: "some-other-game",
      start: "a", rooms: { a: { name: "A", look: "x", exits: [] } },
    });
    expect(wrong.problems.join(" ")).toMatch(/written for the "some-other-game" ruleset/);
    expect(wrong.problems.join(" ")).toMatch(/"mothership1e" is loaded/);
  });

  it("WARNS rather than refuses when a module does not say", () => {
    /* Every module written before the field exists omits it. Treating
       that as a refusal would empty the library on upgrade. */
    const quiet = defineModule({
      id: "quiet", title: "QUIET",
      start: "a", rooms: { a: { name: "A", look: "x", exits: [] } },
    });
    expect(quiet.problems).toEqual([]);
    expect(quiet.warnings.join(" ")).toMatch(/does not say which ruleset/);
    /* Null rather than filled in with the loaded one — exporting it
       must not put words in its author's mouth. */
    expect(quiet.ruleset).toBeNull();
  });

  it("survives the trip through a .mship file", () => {
    const read = readPortableModule({
      id: "trip", title: "TRIP", ruleset: "mothership1e",
      start: "a", rooms: { a: { name: "A", look: "x", exits: [] } },
    });
    expect(read.ok).toBe(true);
    expect(read.mod.ruleset).toBe("mothership1e");
    /* Its other warnings — no endings, no cast — are the module's
       own business. What matters is that the ruleset one is gone. */
    expect(read.mod.warnings.join(" ")).not.toMatch(/ruleset/);
  });

  it("is stated by default in anything written in the editor", () => {
    /* The editor knows which system it is running under, so a module
       written there has no excuse for being silent about it. */
    expect(blankDraft().ruleset).toBe("mothership1e");
    expect(JSON.parse(toEnvelope(blankDraft())).module.ruleset).toBe("mothership1e");
  });
});
