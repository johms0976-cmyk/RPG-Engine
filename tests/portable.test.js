import { describe, it, expect } from "vitest";
import {
  exportCharacter, parseCharacter, adoptCharacter, newHistory, recordSession,
  toCompact, fromCompact, CHAR_KIND, CHAR_VERSION,
} from "../src/engine/portable.js";
import { validateCharacter } from "../src/engine/validate.js";
import { makeCharacter, rollStats, CLASSES } from "../src/engine/rules.js";

const MOD = {
  items: { crowbar: { n: "Crowbar" }, vaccsuit: { n: "Vaccsuit" } },
  loadouts: { excavation: { items: ["crowbar", "vaccsuit"] } },
};
const legal = (over = {}) => makeCharacter({
  name: "LILITH", cls: "teamster",
  stats: { strength: 37, speed: 33, intellect: 30, combat: 30 },
  skills: ["Zero-G", "Mechanical Repair", "Piloting", "Astrogation", "Rimwise"],
  loadout: "excavation", ...over,
}, MOD);

describe("exporting a character", () => {
  it("keeps the person and drops the session", () => {
    const pc = { ...legal(), ammo: { smg: 30 }, wounds: 1, buffs: [{ x: 1 }], armorDamage: 2 };
    const file = exportCharacter(pc, { moduleId: "ypsilon14" });
    expect(file.kind).toBe(CHAR_KIND);
    expect(file.pc.name).toBe("LILITH");
    expect(file.pc.skills).toContain("Zero-G");
    expect(file.pc.ammo).toBeUndefined();
    expect(file.pc.wounds).toBeUndefined();
    expect(file.pc.armorDamage).toBeUndefined();
  });

  it("drops the id so importing twice gives two people, not a twin", () => {
    expect(exportCharacter(legal()).pc.id).toBeUndefined();
  });

  it("survives a round trip through JSON", () => {
    const file = exportCharacter(legal(), { moduleId: "ypsilon14" });
    const back = parseCharacter(JSON.stringify(file));
    expect(back.ok).toBe(true);
    expect(back.character.pc.stats).toEqual(file.pc.stats);
  });
});

describe("importing", () => {
  it("refuses things that are not characters", () => {
    expect(parseCharacter("not json").ok).toBe(false);
    expect(parseCharacter(JSON.stringify({ kind: "something-else" })).ok).toBe(false);
    expect(parseCharacter(JSON.stringify({ kind: CHAR_KIND, v: 1, pc: null })).ok).toBe(false);
  });

  it("refuses a file from a future version rather than guessing", () => {
    const r = parseCharacter(JSON.stringify({ kind: CHAR_KIND, v: CHAR_VERSION + 5, pc: {} }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/newer version/);
  });

  it("migrates a v1 file forward", () => {
    const v1 = { kind: CHAR_KIND, v: 1, pc: { ...exportCharacter(legal()).pc, conditions: undefined, resolve: undefined } };
    const r = parseCharacter(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    expect(r.character.v).toBe(CHAR_VERSION);
    expect(r.character.pc.conditions).toEqual([]);
    expect(r.character.history).toBeDefined();
  });

  it("re-derives health on adoption instead of trusting the file", () => {
    const file = exportCharacter(legal());
    file.pc.maxHealth = 9999; file.pc.health = 9999;
    const pc = adoptCharacter(file, "pc_new");
    expect(pc.maxHealth).toBe(file.pc.stats.strength * 2);
    expect(pc.health).toBe(pc.maxHealth);
  });

  it("clears session bookkeeping on the way in", () => {
    const pc = adoptCharacter(exportCharacter(legal()), "pc_new");
    expect(pc.wounds).toBe(0);
    expect(pc.usedPanicReroll).toBe(false);
    expect(pc.ammo).toEqual({});
  });
});

describe("the QR form", () => {
  it("carries the character in far fewer bytes", () => {
    const file = exportCharacter(legal());
    const compact = toCompact(file);
    expect(compact.length).toBeLessThan(JSON.stringify(file).length / 2);
    expect(compact.length).toBeLessThan(900);
  });

  it("comes back as the same character", () => {
    const file = exportCharacter(legal());
    const back = fromCompact(toCompact(file));
    expect(back.ok).toBe(true);
    expect(back.character.pc.name).toBe(file.pc.name);
    expect(back.character.pc.stats).toEqual(file.pc.stats);
    expect(back.character.pc.saves).toEqual(file.pc.saves);
    expect(back.character.pc.skills).toEqual(file.pc.skills);
  });

  it("rejects a QR that isn't one of ours", () => {
    expect(fromCompact('{"k":"other"}').ok).toBe(false);
    expect(fromCompact("https://example.com").ok).toBe(false);
  });
});

describe("history", () => {
  it("accumulates scars across sessions", () => {
    let h = newHistory();
    h = recordSession(h, { moduleId: "ypsilon14", title: "Ypsilon 14", survived: true, witnessed: ["HALL"], panics: 2, peakStress: 9 });
    h = recordSession(h, { moduleId: "ypsilon14", title: "Ypsilon 14", survived: true, witnessed: ["HALL", "PARK"], panics: 1, peakStress: 6 });
    expect(h.sessions).toBe(2);
    expect(h.panics).toBe(3);
    expect(h.witnessed).toEqual(["HALL", "PARK"]);
    expect(h.modules).toEqual(["ypsilon14"]);
    expect(h.longestStress).toBe(9);
  });
});

describe("catching edited files", () => {
  const check = (mutate) => {
    const file = exportCharacter(legal());
    mutate(file.pc);
    return validateCharacter(file);
  };

  it("passes a character the engine actually made", () => {
    for (const cls of Object.keys(CLASSES)) {
      const c = CLASSES[cls];
      const skills = [...c.fixedSkills, ...(c.pick ? c.pick.from.slice(0, c.pick.count) : [])];
      const budget = [];
      let left = c.points;
      for (const s of ["Rimwise", "Athletics", "Art", "Chemistry"]) {
        if (left >= 1 && !skills.includes(s)) { budget.push(s); left -= 1; }
      }
      const pc = makeCharacter({ name: "X", cls, stats: rollStats(), skills: [...skills, ...budget], loadout: "excavation" }, MOD);
      const r = validateCharacter(exportCharacter(pc));
      expect(r.errors, `${cls}: ${JSON.stringify(r.findings)}`).toBe(0);
    }
  });

  it("catches a stat pushed past what 6d10 can roll", () => {
    const r = check((pc) => { pc.stats.combat = 85; });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.what === "stats")).toBe(true);
  });

  it("catches a stat below the minimum roll", () => {
    expect(check((pc) => { pc.stats.speed = 2; }).ok).toBe(false);
  });

  it("catches health that does not follow from Strength", () => {
    const r = check((pc) => { pc.maxHealth = 200; });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.what === "health")).toBe(true);
  });

  it("catches a save raised past the class starting value at level 0", () => {
    expect(check((pc) => { pc.saves.armor = 85; }).ok).toBe(false);
  });

  it("catches more skills than the point budget allows", () => {
    const r = check((pc) => {
      pc.skills = [...pc.skills, "Chemistry", "Art", "Botany", "Geology", "Hydroponics", "Linguistics"];
    });
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.what === "skills")).toBe(true);
  });

  it("catches an Expert skill held without its prerequisite", () => {
    const r = check((pc) => { pc.skills = ["Zero-G", "Mechanical Repair", "Piloting", "Surgery"]; });
    expect(r.ok).toBe(false);
  });

  it("catches invented skills", () => {
    expect(check((pc) => { pc.skills = [...pc.skills, "Wizardry"] }).ok).toBe(false);
  });

  it("catches Resolve gained without levelling", () => {
    const r = check((pc) => { pc.resolve = 3; });
    expect(r.suspect).toBeGreaterThan(0);
  });

  it("allows a levelled character the headroom they earned", () => {
    const file = exportCharacter(legal());
    file.pc.level = 3;
    file.pc.stats.combat = 45;
    file.pc.resolve = 2;
    expect(validateCharacter(file).ok).toBe(true);
  });

  it("rejects an unknown class outright", () => {
    const file = exportCharacter(legal());
    file.pc.cls = "wizard";
    expect(validateCharacter(file).ok).toBe(false);
  });
});
