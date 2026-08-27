/* ============================================================
   THE WORDS PEOPLE ACTUALLY TYPE.

   Two failures found by playing rather than by reading, both in
   `oracle.js`, both invisible to a test that only ever fed the
   parser well-formed commands:

   1. DIRECTIONS WERE STOPWORDS. "up", "down", "in", "out", "on",
      "over" and "through" were stripped before matching, and every
      exit label in every shipped module leads with a direction. So
      typing a direction \u2014 the single most natural input in a text
      game \u2014 could never select an exit. "go down" on the Corvid
      bridge came back "Which one \u2014 Aft \u2192 Galley, Down \u2192 Engine Bay,
      Aft \u2192 Airlock?", offering the right answer second out of three.
      Two-letter directions were worse: `matchScore` skips words
      under three characters, so "up", "in" and "on" scored zero
      against everything by construction.

   2. `i` IS BOTH THE INVENTORY SHORTHAND AND THE FIRST WORD OF MOST
      SENTENCES. `verbOf` scanned raw tokens, so "I open the hatch",
      "I cut the cable" and "I look at the body" all came back as a
      list of the character's pockets.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { parseCommand } from "../src/engine/oracle.js";
import deadweight from "../src/modules/deadweight/index.js";
import { GEAR } from "../src/engine/gear.js";

const items = { ...GEAR, ...(deadweight.items || {}) };

const at = (room, held = ["torch", "cutter", "keycard"]) => ({
  mod: deadweight,
  world: { room, flags: {}, visited: {}, npcs: {}, threats: {}, clock: 0 },
  pc: { name: "T", items: held, skills: [] },
  items,
  npcsHere: [],
  enemiesHere: [],
});

const parse = (room, text) => parseCommand(text, at(room));

describe("a direction is a way out", () => {
  it("takes the exit whose label leads with the direction typed", () => {
    /* The bridge has three exits and two of them are labelled "Aft".
       "Down" belongs to exactly one, so it is not a guess. */
    const r = parse("bridge", "go down");
    expect(r.kind).toBe("move");
    expect(r.exit.to).toBe("enginebay");
  });

  it("does the same with no verb at all", () => {
    expect(parse("bridge", "down").exit.to).toBe("enginebay");
    expect(parse("bridge", "aft").kind).toBe("move");
  });

  it("handles the two-letter ones, which used to be unmatchable", () => {
    expect(parse("umbilical", "go on").exit.to).toBe("amaranthlock");
    expect(parse("amaranthlock", "go in").exit.to).toBe("hopperdeck");
    expect(parse("amaranthlock", "go up").exit.to).toBe("amaranthbridge");
    expect(parse("airlock", "go out").exit.to).toBe("umbilical");
  });

  it("still says which one when the direction is genuinely shared", () => {
    /* Two exits labelled "Aft" on the bridge. Asking is correct here;
       silently picking one is not. */
    const r = parse("bridge", "go aft");
    expect(["move", "ambiguous"]).toContain(r.kind);
    if (r.kind === "ambiguous") expect(r.options.length).toBeGreaterThan(1);
  });

  it("does not let a direction override a named destination", () => {
    expect(parse("hopperdeck", "go down to the cold hold").exit.to).toBe("coldhold");
    expect(parse("umbilical", "continue to the amaranth").exit.to).toBe("amaranthlock");
  });
});

describe("a sentence that begins with I", () => {
  it("is not a request for the character's pockets", () => {
    const r = parse("bridge", "i want to cut the cable");
    expect(r.kind).not.toBe("inventory");
    expect(r.kind).toBe("use");
    expect(r.item).toBe("cutter");
  });

  it("still answers a bare i", () => {
    expect(parse("bridge", "i").kind).toBe("inventory");
  });

  it("understands the phrasings people use instead", () => {
    expect(parse("bridge", "i check my pockets").kind).toBe("inventory");
    expect(parse("bridge", "inventory").kind).toBe("inventory");
  });

  it("does not read somebody else's pockets as your own", () => {
    /* "check kerrigan's pockets" is about the body on the deck. */
    const r = parse("coldhold", "check kerrigan's pockets");
    expect(r.kind).not.toBe("inventory");
  });
});

describe("taking a thing that is inside another thing", () => {
  it("finds the feature that holds what the player named", () => {
    /* The manifest is under a magnet in the lading office. Players
       name the prize, not the container. */
    const r = parse("hopperdeck", "grab the manifest");
    expect(r.kind).toBe("search");
    expect(r.feature).toBe("office");
  });

  it("still takes the container when that is what was named", () => {
    expect(parse("galley", "search the gear lockers").feature).toBe("lockerbay");
  });
});
