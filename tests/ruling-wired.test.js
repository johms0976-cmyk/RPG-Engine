/* ============================================================
   Does a ruling actually change the game, or is it just stored?

   `tests/ruling.test.js` covers the store. This covers the wiring:
   the room describing it, the parser matching it, the transcript
   keeping it, and — the one that matters — the shared screen not
   publishing a whisper.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { answerLook, MISS } from "../src/engine/look.js";
import { toMarkdown } from "../src/engine/transcript.js";
import { makeRulingControls } from "../src/engine/wardenRulings.js";
import { makeRuling, commitRuling, SCOPE } from "../src/engine/ruling.js";
import { VOTE_TOPICS, openVote, castVote, decided, closeVote } from "../src/engine/vote.js";

const MOD = {
  id: "t", title: "TEST", start: "bay",
  rooms: {
    bay: {
      name: "DOCKING BAY",
      look: "Cold, and too big for the light in it.",
      exits: [{ to: "hall", label: "The corridor" }],
      features: { crates: { name: "Ore crates", d: "Rock. Just rock." } },
    },
    hall: { name: "CORRIDOR", look: "Grating.", exits: [], features: {} },
  },
  npcs: {}, items: {}, threats: {}, endings: {}, handouts: {},
};

const W = (over = {}) => ({
  room: "bay", visited: { bay: true }, clock: 0, session: 1,
  npcs: {}, searched: {}, clues: [], rulings: [], rollLog: [], ...over,
});
const PC = (over = {}) => ({
  id: "pc1", name: "RILEY", room: "bay", cls: "teamster",
  health: 20, maxHealth: 20, stress: 2, resolve: 0, items: [], conditions: [], ...over,
});

const rule = (w, spec) => {
  const { ruling, error } = makeRuling({ room: "bay", ...spec });
  if (error) throw new Error(error);
  return commitRuling(w, ruling);
};

describe("a ruling changes the room", () => {
  it("is read out with the room description afterwards", () => {
    const w = rule(W(), { text: "One of the ceiling panels is hanging loose." });
    const out = answerLook({ mod: MOD, w, pc: PC(), about: "what do I see" });
    expect(out.text).toMatch(/too big for the light/);
    expect(out.text).toMatch(/ceiling panels is hanging loose/);
  });

  it("does not follow the crew into the next room", () => {
    const w = rule(W({ visited: { bay: true, hall: true } }), { text: "A panel is loose." });
    const out = answerLook({ mod: MOD, w, pc: PC({ room: "hall" }), about: "what do I see" });
    expect(out.text).not.toMatch(/panel/);
  });

  it("appears in the list of things in here, beside the module's own", () => {
    const w = rule(W(), {
      text: "Four wing-nuts, one missing.", scope: SCOPE.THING, subject: "ceiling panel",
    });
    const out = answerLook({ mod: MOD, w, pc: PC(), about: "what things are here" });
    expect(out.text).toMatch(/Ore crates/);
    expect(out.text).toMatch(/ceiling panel/);
  });
});

describe("a ruling is a noun the parser now knows", () => {
  it("answers a look addressed at it by name", () => {
    const w = rule(W(), {
      text: "Four wing-nuts, one missing.", scope: SCOPE.THING, subject: "ceiling panel",
    });
    const out = answerLook({ mod: MOD, w, pc: PC(), about: "look at the ceiling panel" });
    expect(out.matched).toBe(true);
    expect(out.text).toMatch(/wing-nuts/);
  });

  it("returned nothing about it before anybody ruled", () => {
    /* Asked bare, with no facet keyword to fall through to. ("look at
       the ceiling panel" contains `look`, which is a room-facet
       keyword, so it lands on the room description instead of MISS —
       pre-existing behaviour and not something rulings change.) */
    const out = answerLook({ mod: MOD, w: W(), pc: PC(), about: "ceiling panel" });
    expect(out.text).toBe(MISS);
  });

  it("beats the module when the two are about the same thing", () => {
    // The author shipped ore crates. The Warden has since said the
    // crates are welded to the deck. The most recent human statement
    // is the true one.
    const w = rule(W(), {
      text: "They are welded to the deck. Nobody is moving these.",
      scope: SCOPE.THING, subject: "ore crates",
    });
    const out = answerLook({ mod: MOD, w, pc: PC(), about: "the ore crates" });
    expect(out.text).toMatch(/welded to the deck/);
  });

  it("still cannot hand over an unsearched feature's description", () => {
    // THE SEARCH RULE. A ruling is a sentence a person typed; it is
    // never read out of a feature's `d`, so no path through here can
    // give a search result away for free.
    const w = rule(W(), {
      text: "One of them has been opened and closed again.",
      scope: SCOPE.THING, subject: "ore crates",
    });
    const out = answerLook({ mod: MOD, w, pc: PC(), about: "the ore crates" });
    expect(out.text).not.toMatch(/Rock\. Just rock\./);
  });
});

describe("the whisper that must not reach the shared screen", () => {
  const w = () => rule(W(), {
    text: "You and only you notice the second set of prints.", told: ["pc1"],
  });

  it("reaches the player it was told to", () => {
    const out = answerLook({ mod: MOD, w: w(), pc: PC({ id: "pc1" }), about: "what do I see" });
    expect(out.text).toMatch(/second set of prints/);
  });

  it("does not reach anybody else", () => {
    const out = answerLook({ mod: MOD, w: w(), pc: PC({ id: "pc2" }), about: "what do I see" });
    expect(out.text).not.toMatch(/prints/);
  });

  it("does not reach the shared screen, which has no viewer at all", () => {
    // The dangerous case: `answerLook` called without a pc falls back
    // to the world's room and would happily print everything if the
    // viewer defaulted open instead of closed.
    const out = answerLook({ mod: MOD, w: w(), pc: null, about: "what do I see" });
    expect(out.text).not.toMatch(/prints/);
    expect(out.text).toMatch(/too big for the light/);
  });

  it("does not turn up in somebody else's things-in-here list", () => {
    const w2 = rule(W(), {
      text: "Only you can see it.", scope: SCOPE.THING, subject: "smear", told: ["pc1"],
    });
    expect(answerLook({ mod: MOD, w: w2, pc: PC({ id: "pc2" }), about: "what things are here" }).text)
      .not.toMatch(/smear/);
    expect(answerLook({ mod: MOD, w: w2, pc: PC({ id: "pc1" }), about: "what things are here" }).text)
      .toMatch(/smear/);
  });
});

describe("the record keeps it", () => {
  const md = (w, opts) => toMarkdown({ mod: MOD, world: w, crew: [PC()], feed: [], ...opts });

  it("gathers rulings into their own section", () => {
    const out = md(rule(W(), { text: "A panel is loose." }), { isWarden: true });
    expect(out).toMatch(/Rulings made at the table/);
    expect(out).toMatch(/A panel is loose/);
  });

  it("keeps a private one out of the wrong person's copy", () => {
    const w = rule(W(), { text: "Only you saw it.", told: ["pc1"] });
    expect(md(w, { viewerPcId: "pc2" })).not.toMatch(/Only you saw it/);
    expect(md(w, { viewerPcId: "pc1" })).toMatch(/Only you saw it/);
  });

  it("says nothing at all about rulings when none were made", () => {
    expect(md(W(), { isWarden: true })).not.toMatch(/Rulings made at the table/);
  });

  it("marks which rolls came off the table's own dice", () => {
    const w = W({ rollLog: [
      { clock: 0, who: "RILEY", label: "Fear", value: 97, target: 35, success: false, margin: -62, declared: true },
      { clock: 1, who: "RILEY", label: "Body", value: 12, target: 40, success: true, margin: 28 },
    ] });
    const out = md(w, { isWarden: true });
    expect(out).toMatch(/table dice/);
    expect(out.match(/table dice/g)).toHaveLength(1);
  });
});

describe("the empty chair can now decide what is true", () => {
  it("has a topic to put it to", () => {
    expect(VOTE_TOPICS.ruling).toBeTruthy();
  });

  it("never invents a fact out of silence", () => {
    const v = openVote("ruling", { of: ["a", "b", "c"], note: "The panel comes down." });
    expect(closeVote(v, v.closesAt + 1).result.choice).toBe("no");
  });

  it("carries on a majority of everybody entitled to vote", () => {
    let v = openVote("ruling", { of: ["a", "b", "c"], note: "The panel comes down." });
    v = castVote(v, "a", "yes");
    expect(decided(v)).toBeNull();
    v = castVote(v, "b", "yes");
    expect(decided(v)).toBe("yes");
  });

  it("carries the proposal itself, so the table votes on a sentence", () => {
    const v = openVote("ruling", { of: ["a", "b"], note: "The panel comes down." });
    expect(v.note).toBe("The panel comes down.");
  });

  it("gives the proposer no extra weight", () => {
    let v = openVote("ruling", { of: ["a", "b", "c"], by: "a", note: "x" });
    v = castVote(v, "a", "yes");
    expect(decided(v)).toBeNull();
  });
});

describe("the Warden's controls", () => {
  /* A stand-in for the slice of useGame these touch. Enough to assert
     the order of operations, which is the part that matters: the
     sentence reaches the table before anything is stored. */
  const harness = () => {
    let world = W();
    const feed = [];
    const notes = [];
    const c = makeRulingControls({
      W: () => world,
      commitW: (patch) => { world = { ...world, ...patch }; },
      say: (kind, text, extra, to) => feed.push({ kind, text, to }),
      nameOf: (id) => ({ pc1: "RILEY", pc2: "CHI" }[id] || null),
      note: (t) => notes.push(t),
    });
    return { ...c, feed, notes, world: () => world };
  };

  it("says it, then stores it", () => {
    const h = harness();
    const res = h.rule("A panel is loose.");
    expect(res.ok).toBe(true);
    expect(h.feed[0].text).toBe("A panel is loose.");
    expect(h.world().rulings).toHaveLength(1);
  });

  it("addresses a private one rather than hiding it client-side", () => {
    const h = harness();
    h.rule("Only you see it.", { told: ["pc1"] });
    expect(h.feed[0].to).toEqual(["pc1"]);
    expect(h.notes[0]).toMatch(/RILEY/);
  });

  it("leaves a public one unaddressed", () => {
    const h = harness();
    h.rule("Everyone sees it.");
    expect(h.feed[0].to).toBeUndefined();
  });

  it("names the thing in the line when the ruling is about one", () => {
    const h = harness();
    h.rule("Four wing-nuts.", { scope: SCOPE.THING, subject: "ceiling panel" });
    expect(h.feed[0].text).toMatch(/^ceiling panel — /);
  });

  it("refuses an empty ruling without saying anything", () => {
    const h = harness();
    expect(h.rule("   ").ok).toBe(false);
    expect(h.feed).toHaveLength(0);
    expect(h.world().rulings).toHaveLength(0);
  });

  it("says the retraction out loud too", () => {
    const h = harness();
    const { ruling } = h.rule("The door is welded.");
    h.unrule(ruling.id, "the module already said otherwise");
    expect(h.feed[1].text).toMatch(/Scratch that/);
    expect(h.world().rulings[0].retired).toBe(true);
  });

  it("retracts a private ruling privately", () => {
    const h = harness();
    const { ruling } = h.rule("Only you see it.", { told: ["pc1"] });
    h.unrule(ruling.id);
    expect(h.feed[1].to).toEqual(["pc1"]);
  });

  it("will not retract something twice", () => {
    const h = harness();
    const { ruling } = h.rule("A fact.");
    h.unrule(ruling.id);
    expect(h.unrule(ruling.id).ok).toBe(false);
  });
});
