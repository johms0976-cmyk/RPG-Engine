/* ============================================================
   CONTINUITY — a table's own facts, across sessions.

   The value being tested is not storage. It is that a group who
   invented something in week one is offered it in week three,
   chooses, and is never overruled by the software about their
   own fiction.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  harvest, addFacts, offerable, seedWorld, toFragment, CARRY_LIMIT,
} from "../src/engine/continuity.js";
import { SCOPE, roomAddendum, rulingNouns } from "../src/engine/ruling.js";

const ruling = (over = {}) => ({
  v: 1, id: "r1", scope: SCOPE.ROOM,
  text: "The airlock does not seal properly. It never has.",
  room: "dock", subject: null, key: null, by: "table",
  told: null, clock: 0, at: 1000, retired: false, ...over,
});

describe("harvesting a finished session", () => {
  it("keeps what the table made true", () => {
    const out = harvest({ rulings: [ruling()] }, { modId: "ypsilon14" });
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("airlock");
    expect(out[0].modId).toBe("ypsilon14");
  });

  it("DROPS RETIRED ONES — the table took those back", () => {
    expect(harvest({ rulings: [ruling({ retired: true })] })).toEqual([]);
  });

  it("DROPS PRIVATE ONES — a whispered fact is not the campaign's", () => {
    /* A ruling with `told` was the Warden telling one player
       something the others must not hear. The campaign record is
       read by everybody. */
    expect(harvest({ rulings: [ruling({ told: ["pc1"] })] })).toEqual([]);
  });

  it("keeps who made it true", () => {
    const [a] = harvest({ rulings: [ruling({ by: "warden" })] });
    const [b] = harvest({ rulings: [ruling({ by: "table" })] });
    expect(a.by).toBe("warden");
    expect(b.by).toBe("table");
  });

  it("survives a world with nothing in it", () => {
    expect(harvest(null)).toEqual([]);
    expect(harvest({})).toEqual([]);
    expect(harvest({ rulings: [null, undefined] })).toEqual([]);
  });
});

describe("accumulating across sessions", () => {
  it("does not store the same fact twice", () => {
    const one = addFacts({ facts: [] }, harvest({ rulings: [ruling()] }));
    const two = addFacts({ facts: one }, harvest({ rulings: [ruling({ id: "r2" })] }));
    /* Inventing the same fact in two sessions is confirming it,
       not creating two of them. */
    expect(two).toHaveLength(1);
  });

  it("appends genuinely new ones", () => {
    const one = addFacts({ facts: [] }, harvest({ rulings: [ruling()] }));
    const two = addFacts({ facts: one }, harvest({
      rulings: [ruling({ text: "Prince the cat will not enter the workspace." })],
    }));
    expect(two).toHaveLength(2);
  });
});

describe("what a returning table is offered", () => {
  const campaign = {
    facts: [
      { text: "Ypsilon's airlock sticks.", scope: SCOPE.ROOM, room: "dock", modId: "ypsilon14", at: 1 },
      { text: "The Company pays late, always.", scope: SCOPE.WORLD, room: null, modId: "ypsilon14", at: 2 },
      { text: "Deck three smells of ozone.", scope: SCOPE.ROOM, room: "b5", modId: "anotherbughunt", at: 3 },
    ],
  };

  it("offers a room fact back only in its own module", () => {
    const y = offerable(campaign, "ypsilon14").map((f) => f.text);
    expect(y).toContain("Ypsilon's airlock sticks.");
    expect(y).not.toContain("Deck three smells of ozone.");
  });

  it("offers world facts everywhere", () => {
    for (const mod of ["ypsilon14", "anotherbughunt", "deadweight"]) {
      expect(offerable(campaign, mod).map((f) => f.text))
        .toContain("The Company pays late, always.");
    }
  });

  it("caps at a screen you would actually read", () => {
    const many = {
      facts: Array.from({ length: 60 }, (_, i) => ({
        text: `Fact ${i}`, scope: SCOPE.WORLD, modId: "x", at: i,
      })),
    };
    const got = offerable(many, "x");
    expect(got).toHaveLength(CARRY_LIMIT);
    /* The most recent survive: last week's invention is likelier
       to still matter than the first session's. */
    expect(got[got.length - 1].text).toBe("Fact 59");
  });
});

describe("carrying them into a new session", () => {
  it("changes what the room says, exactly as a fresh ruling would", () => {
    const chosen = harvest({ rulings: [ruling()] }, { modId: "ypsilon14" });
    const w = seedWorld({ rulings: [] }, chosen);
    expect(roomAddendum(w, "dock").join(" ")).toContain("airlock");
  });

  it("a named thing is still a noun the parser can match", () => {
    const chosen = harvest({
      rulings: [ruling({ scope: SCOPE.THING, subject: "ceiling panel", room: "work" })],
    });
    const w = seedWorld({ rulings: [] }, chosen);
    expect(rulingNouns(w, "work")).toContain("ceiling panel");
  });

  it("is marked as carried, not as freshly invented", () => {
    const w = seedWorld({ rulings: [] }, harvest({ rulings: [ruling()] }));
    /* The transcript should not imply somebody made this up
       thirty seconds ago. */
    expect(w.rulings[0].by).toBe("carried");
  });

  it("carrying nothing is a no-op", () => {
    const w = { rulings: [] };
    expect(seedWorld(w, [])).toBe(w);
    expect(seedWorld(w, null)).toBe(w);
  });
});

describe("exporting a table's own version of a module", () => {
  const campaign = {
    name: "The Samsa Run",
    sessions: [{}, {}, {}],
    facts: [
      { text: "The airlock does not seal properly.", scope: SCOPE.ROOM, room: "dock", modId: "ypsilon14", at: 1 },
      { text: "Prince the cat is never wrong.", scope: SCOPE.THING, subject: "Prince", room: "work", modId: "ypsilon14", at: 2 },
    ],
  };

  it("emits loadable listener source", () => {
    const src = toFragment(campaign, { modId: "ypsilon14", title: "Ypsilon 14" });
    expect(src).toContain("export const listeners = [");
    expect(src).toContain("The airlock does not seal properly.");
    expect(src).toContain('tone: "warden"');
  });

  it("uses the named thing as the phrase when there is one", () => {
    const src = toFragment(campaign, { modId: "ypsilon14" });
    expect(src).toContain('phrases: ["prince"]');
  });

  it("scopes a room fact to its room", () => {
    expect(toFragment(campaign, { modId: "ypsilon14" })).toContain('when: "room:dock"');
  });

  it("tells the reader to read it before using it", () => {
    /* Half of what a table types at eleven at night is a joke.
       A fragment that presented itself as finished content would
       be lying about what it is. */
    expect(toFragment(campaign, { modId: "ypsilon14" })).toContain("READ THIS BEFORE USING IT");
  });

  it("names the table and the session count", () => {
    const src = toFragment(campaign, { modId: "ypsilon14" });
    expect(src).toContain("The Samsa Run");
    expect(src).toContain("3 sessions");
  });

  it("is valid JavaScript", async () => {
    const src = toFragment(campaign, { modId: "ypsilon14" });
    const mod = await import(
      `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`
    );
    expect(Array.isArray(mod.listeners)).toBe(true);
    expect(mod.listeners[0].effects[0].say).toContain("airlock");
  });
});
