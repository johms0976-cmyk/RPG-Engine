/* ============================================================
   PAPER MODE.

   The claim being tested is narrow and it is the whole feature:
   what comes out is the module, reproduced, and not a summary of
   it. Every string on the page is one the author wrote.

   The second claim is that it is usable without a session. A
   Warden prepping on a train has no world, and a pack that needs
   one is a pack that only exists after the evening it was for.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { paperPack, paperMarkdown, paperFilename, blankSheet } from "../src/engine/paper.js";
import { STAT_KEYS, SAVE_KEYS } from "../src/engine/rules.js";
import { defineModule } from "../src/engine/defineModule.js";
import deadweight from "../src/modules/deadweight/index.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

const mod = defineModule({
  id: "pack", title: "A COLD START", start: "hold",
  blurb: "Three rooms and something in the dark.",
  contentWarning: "Suffocation.",
  items: { fuse: { n: "Spare Fuse", d: "Ceramic.", found: true } },
  handouts: { log: { label: "SHIFT REPORT", text: "It stops mid-word." } },
  endings: { out: { title: "AWAY", text: "The dock falls behind you." } },
  npcs: { cham: { name: "CHAM", role: "Engineer", knows: ["The fuse is spare.", "Nobody comes down here."] } },
  threats: {
    thing: {
      name: "THE PASSENGER", combat: 55, speed: 45, maxHits: 2,
      attacks: [{ name: "Grip", dmg: "2d10", text: "It takes hold without hurrying." }],
    },
  },
  rooms: {
    hold: {
      n: 1, name: "CARGO HOLD", tags: ["DARK"],
      look: "Crates lashed to the deck.",
      exits: [
        { to: "bridge", label: "Pressure door", mins: 5, gate: { flag: "bridge_open", roll: { stat: "strength", label: "DOOR" } } },
        { to: "@out", label: "Cut loose and go" },
      ],
      features: {
        panel: { name: "Breaker panel", d: "A blown fuse.", gives: ["fuse"] },
        grating: { name: "The grating", d: "Scratches.", deep: true, effects: [{ save: "fear", onFail: [{ stress: 2 }] }] },
      },
    },
    bridge: {
      name: "BRIDGE", look: "Consoles up and idling.",
      exits: [{ to: "hold", label: "Back" }],
      features: {},
    },
  },
});

describe("the pack without a session", () => {
  const pack = paperPack(mod);

  it("builds from a module alone", () => {
    /* A Warden prepping on a train has no world. A pack that needs
       one only exists after the evening it was for. */
    expect(pack.rooms).toHaveLength(2);
    expect(pack.card.title).toBe("A COLD START");
  });

  it("reproduces the author's words rather than describing them", () => {
    expect(pack.rooms[0].look).toBe("Crates lashed to the deck.");
    expect(pack.endings[0].text).toBe("The dock falls behind you.");
    expect(pack.handouts[0].text).toBe("It stops mid-word.");
  });

  it("says where the exits go, and which are locked", () => {
    const [door, out] = pack.rooms[0].exits;
    expect(door.gate.flag).toBe("bridge_open");
    expect(door.gate.roll).toContain("STRENGTH");
    expect(door.gate.open).toBe(false);
    /* An exit to an ending is marked as one — a Warden reading it off
       paper has no `@` convention in their head. */
    expect(out.ending).toBe(true);
    expect(out.label).toBe("Cut loose and go");
  });

  it("labels what a feature does, mechanically, without inventing prose", () => {
    const [panel, grating] = pack.rooms[0].features;
    expect(panel.gives).toEqual(["Spare Fuse"]);
    expect(panel.beats).toEqual([]);
    expect(grating.deep).toBe(true);
    expect(grating.beats).toEqual(expect.arrayContaining(["FEAR save", "+2 Stress"]));
  });

  it("carries every line an NPC can say, because that is the ceiling", () => {
    expect(pack.cast[0].knows.map((k) => k.text))
      .toEqual(["The fuse is spare.", "Nobody comes down here."]);
  });

  it("leaves the standard kit off the module's pages", () => {
    /* `defineModule` merges the whole PSG kit into `items`. Reprinting
       eighty pieces of shared gear per module is how a folder becomes
       too thick to carry — it is on the character sheet already. */
    expect(pack.items).toEqual([
      { id: "fuse", name: "Spare Fuse", text: "Ceramic.", tag: "" },
    ]);
  });

  it("carries the flags, which are the hardest thing to hold off a screen", () => {
    expect(pack.flags.some((f) => f.id === "bridge_open")).toBe(true);
  });
});

describe("the pack mid-campaign", () => {
  it("marks what the table has already used and does not remove it", () => {
    /* Struck through, not deleted. A Warden reprinting in week three
       wants to know what has been turned over. */
    const w = {
      visited: { hold: true },
      flags: { bridge_open: true },
      searched: { "hold:panel": true },
      handouts: { log: { first: 1 } },
      npcs: {}, clocks: {}, countdowns: {},
    };
    const pack = paperPack(mod, w);
    expect(pack.rooms[0].visited).toBe(true);
    expect(pack.rooms[0].exits[0].gate.open).toBe(true);
    expect(pack.rooms[0].features[0].done).toBe(true);
    expect(pack.rooms[0].features[1].done).toBe(false);
    expect(pack.handouts[0].opened).toBe(true);
  });
});

describe("markdown, for the people who want a file", () => {
  const md = paperMarkdown(paperPack(mod));

  it("is the same material, and the author's own strings", () => {
    expect(md).toContain("# A COLD START");
    expect(md).toContain("Crates lashed to the deck.");
    expect(md).toContain("The dock falls behind you.");
    expect(md).toContain("Content warning.");
  });

  it("names the destination of every exit", () => {
    expect(md).toContain("→ bridge");
    expect(md).toContain("→ @out");
  });

  it("gets a filename a Warden will recognise", () => {
    expect(paperFilename(mod)).toBe("pack-pack.md");
  });
});

describe("the blank sheet", () => {
  it("is blank, and takes its boxes from the ruleset's own keys", () => {
    /* Not a hardcoded four-and-four. When the stat list changes the
       sheet changes with it — which is the whole of what paper mode
       needs from #23. */
    const sheet = blankSheet({ stats: STAT_KEYS, saves: SAVE_KEYS });
    expect(sheet.stats.map((s) => s.key)).toEqual(STAT_KEYS);
    expect(sheet.saves.map((s) => s.key)).toEqual(SAVE_KEYS);
    expect(sheet.lined.gear).toBeGreaterThan(0);
  });
});

describe("the modules that actually ship", () => {
  it("packs both without throwing", () => {
    /* Ypsilon is twelve rooms across eleven files with thirty-one
       hooks; Dead Weight is nine rooms and two. Between them they use
       most of the DSL, which makes them the real test of a reader. */
    for (const m of [deadweight, ypsilon]) {
      const pack = paperPack(m);
      expect(pack.rooms.length).toBe(Object.keys(m.rooms).length);
      expect(paperMarkdown(pack).length).toBeGreaterThan(1000);
    }
  });

  it("survives a module with almost nothing in it", () => {
    const bare = defineModule({
      id: "bare", title: "BARE", start: "a",
      rooms: { a: { name: "A", look: "", exits: [] } },
    });
    const pack = paperPack(bare);
    expect(pack.rooms).toHaveLength(1);
    expect(pack.cast).toEqual([]);
    expect(() => paperMarkdown(pack)).not.toThrow();
  });
});
