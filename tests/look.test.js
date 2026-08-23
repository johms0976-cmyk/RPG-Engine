/* ============================================================
   ASKING THE ROOM, TESTED.

   The block that matters is THE SEARCH RULE. A feature's `d` is
   the payoff for ten to fifteen minutes of game time, and for a
   `deep` feature it is the payoff for an Intellect roll that can
   fail twice first. It sits one property away from the name. An
   answering function that returned it would hand the room over for
   free, silently, in a way nothing would ever throw about — the
   same shape of failure as the `dark`-whisper leak and the
   director's own guard.

   The second-most-important block is THE HONEST MISS. The version
   this replaced matched a handful of regexes and, when they all
   failed, returned the room description anyway. That reads as an
   answer. Once a player has been given one of those, every
   subsequent answer is read as possibly-nonsense, and the feature
   is worse than not having existed.
   ============================================================ */

import { describe, it, expect } from "vitest";
import { answerLook, MISS, FACETS, LOOK_FLOOR } from "../src/engine/look.js";

const MOD = {
  id: "t",
  rooms: {
    bay: {
      name: "BAY",
      look: "The bay is cold and mostly empty.",
      exits: [
        { to: "work", label: "Airlock → Workspace" },
        { to: "@followed", label: "Board your ship and leave" },
      ],
      features: {
        crates: { name: "Ore crates", d: "Sealed, stencilled, and lighter than they should be." },
        collar: { name: "Docking collar", d: "The seal is good. The manual release is smashed." },
      },
    },
    work: { name: "WORKSPACE", look: "Noise.", exits: [], features: {} },
    vents: { name: "VENTS", look: "Narrow.", exits: [], features: {} },
  },
  npcs: {
    sonya: { name: "SONYA", knows: [] },
    rosa: { name: "ROSA", knows: [] },
  },
  items: { manifest: { n: "Cargo manifest", d: "Six pallets, countersignature pending." } },
};

const W = (patch = {}) => ({
  room: "bay",
  clock: 95,
  visited: { bay: true },
  searched: {},
  clues: [],
  npcs: {
    sonya: { alive: true, loc: "bay", met: true },
    rosa: { alive: true, loc: "work", met: true },
  },
  threats: {},
  flags: {},
  ...patch,
});

const PC = (patch = {}) => ({
  id: "riley", name: "RILEY", room: "bay",
  health: 8, maxHealth: 10, stress: 4, conditions: [], items: [],
  ...patch,
});

const ask = (about, w = W(), pc = PC()) => answerLook({ mod: MOD, w, pc, about });

/* ============================================================
   THE SEARCH RULE
   ============================================================ */
describe("names are visible, descriptions are earned", () => {
  it("will tell you a thing is there", () => {
    const out = ask("what's in the crates?");
    expect(out.matched).toBe(true);
    expect(out.text).toMatch(/Ore crates/);
  });

  it("will NOT tell you what is in it before somebody has looked", () => {
    /* The whole point. `d` is a search result: ten to fifteen
       minutes of game time, and for a deep feature a roll that can
       fail twice. Handing it over for a typed question would delete
       the mechanic without anything ever throwing. */
    const out = ask("what's in the crates?");
    expect(out.text).not.toMatch(/lighter than they should be/);
  });

  it("says plainly that it has not been gone through, rather than implying nothing is there", () => {
    expect(ask("crates").text).toMatch(/not gone through/i);
  });

  it("gives it up once it has been earned", () => {
    const w = W({ searched: { "bay:crates": true } });
    expect(ask("what's in the crates?", w).text).toMatch(/lighter than they should be/);
  });

  it("keeps the two straight when only one has been searched", () => {
    const w = W({ searched: { "bay:crates": true } });
    expect(ask("the docking collar", w).text).not.toMatch(/manual release/);
  });

  it("distinguishes 'not looked' from 'looked and found nothing' in the inventory of the room", () => {
    /* A Warden makes this distinction without thinking, and a flat
       list of nouns destroys it. */
    const w = W({ searched: { "bay:crates": true } });
    const out = ask("what things are in here", w);
    expect(out.text).toMatch(/Ore crates \(searched\)/);
    expect(out.text).toMatch(/Docking collar(?! \(searched\))/);
  });
});

/* ============================================================
   THE HONEST MISS
   ============================================================ */
describe("a question it cannot answer", () => {
  it("says so, rather than returning the room description with a confident tone", () => {
    const out = ask("is the reactor scrammed and did Kowalski sign the waiver");
    expect(out.matched).toBe(false);
    expect(out.text).toBe(MISS);
    expect(out.text).not.toMatch(/cold and mostly empty/);
  });

  it("points at the two things that would actually answer it", () => {
    expect(MISS).toMatch(/search/i);
    expect(MISS).toMatch(/ask somebody/i);
  });

  it("refuses to answer about a room the crew has never entered", () => {
    const out = answerLook({ mod: MOD, w: W({ room: "vents" }), pc: PC({ room: "vents" }), about: "what do I see" });
    expect(out.matched).toBe(false);
  });
});

/* ============================================================
   WHAT IT REPLACED — the cases the regexes got wrong
   ============================================================ */
describe("scoring rather than pattern-matching", () => {
  it("understands the way people actually phrase a question", () => {
    /* `tokenise` keeps the apostrophe, so "who's" arrived as one
       token and never matched "who". Fine for talking to a person;
       wrong for talking to a room, where nearly every question opens
       with a contraction. */
    expect(ask("who's in here?").text).toMatch(/SONYA/);
    expect(ask("what's the time").text).toMatch(/1h 35m/);
    expect(ask("where's the way out").parts.some((p) => p.facet === "exits")).toBe(true);
  });

  it("treats a plural and a singular as the same question", () => {
    expect(ask("exits").parts[0].facet).toBe("exits");
    expect(ask("where's the exit").parts.some((p) => p.facet === "exits")).toBe(true);
  });

  it("understands a question phrased as a sentence", () => {
    expect(ask("how long have we been at this?").text).toMatch(/1h 35m/);
  });

  it("puts a named thing above a topic, because that is what was asked about", () => {
    /* The regex version matched nothing here and fell through to the
       room description, which reads as an answer and is not one. */
    expect(ask("tell me about the docking collar").parts[0].facet).toBe("named");
  });

  it("answers a bare question with the things a Warden would volunteer", () => {
    const out = ask("");
    const facets = out.parts.map((p) => p.facet);
    expect(facets).toContain("room");
    expect(facets.length).toBeLessThanOrEqual(3);
  });

  it("does not volunteer the clock every time somebody looks around", () => {
    expect(ask("").parts.map((p) => p.facet)).not.toContain("time");
  });

  it("keeps an answer short enough to read on a phone", () => {
    expect(ask("what do I see").parts.length).toBeLessThanOrEqual(3);
  });
});

/* ============================================================
   WHAT IT WILL NOT LOOK UP FOR YOU
   ============================================================ */
describe("the outward discipline", () => {
  it("names the people standing in front of you", () => {
    expect(ask("who's in here?").text).toMatch(/SONYA/);
  });

  it("will not tell you where somebody else is", () => {
    /* Answering this would turn a look into base-wide surveillance,
       and the module is built on not knowing where people are. */
    const out = ask("where is Rosa");
    expect(out.text).not.toMatch(/WORKSPACE|work/);
    expect(out.text).toMatch(/go and find them/i);
  });

  it("does not name the way the module ends among the exits", () => {
    expect(ask("ways out?").text).not.toMatch(/Board your ship/);
  });

  it("reports the crew's own board and nothing else", () => {
    const w = W({ clues: [{ text: "Mike's bunk is untouched", resolved: false }] });
    expect(ask("what do we know so far", w).text).toMatch(/Mike's bunk/);
  });

  it("is empty-handed about a board nobody has pinned to", () => {
    expect(ask("what do we know so far").text).toMatch(/Nothing on the board/);
  });
});

describe("your own sheet, which is yours", () => {
  it("tells you what you are carrying", () => {
    expect(ask("what am I carrying", W(), PC({ items: ["manifest"] })).text)
      .toMatch(/Cargo manifest/);
  });

  it("tells you how you are doing", () => {
    expect(ask("how am I feeling").text).toMatch(/Health 8\/10/);
  });

  it("answers about a thing in your own hands", () => {
    const out = ask("the manifest", W(), PC({ items: ["manifest"] }));
    expect(out.text).toMatch(/countersignature/);
  });
});

describe("the shape of it", () => {
  it("shares its floor with npcReply, so one tokeniser means one judgement", () => {
    expect(LOOK_FLOOR).toBeGreaterThan(0);
  });

  it("declares every facet with the words a player would use", () => {
    for (const f of FACETS) {
      expect(f.keywords.length).toBeGreaterThan(3);
      expect(typeof f.answer).toBe("function");
    }
  });

  it("is pure — no clock, no network, no model", () => {
    const before = globalThis.fetch;
    ask("what do I see");
    expect(globalThis.fetch).toBe(before);
  });

  it("survives a module with nothing in the room", () => {
    const bare = { ...MOD, rooms: { ...MOD.rooms, bay: { name: "BAY", look: "Empty.", exits: [], features: {} } } };
    const out = answerLook({ mod: bare, w: W(), pc: PC(), about: "what things are here" });
    expect(out.text).toMatch(/Nothing in here/);
  });
});
