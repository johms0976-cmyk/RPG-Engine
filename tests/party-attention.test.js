/* ============================================================
   THE ROOM THE DIRECTOR IS LOOKING AT.

   `party.js` shipped so that six people could stop being one
   person. `director.js` was written before it and never revisited,
   so every room-aware rung read `w.room` — the *majority* room —
   and delivered every line to the whole table through
   `warden.say`. Three in the ducting and three in the mess meant
   the mess got narrated to all six, and the three in the ducting
   received nothing at all and could not be attacked, tested or
   spoken to.

   The tests below are in two halves, and the second half is the
   one that matters more:

     · the split table now gets its attention shared out
     · THE UNSPLIT TABLE IS BYTE-IDENTICAL

   The second is not a nicety. Every existing director test in this
   repo describes a party standing in one room, and if any of them
   had had to change to accommodate this, that would have been the
   signal that the change was wrong rather than that the tests
   were.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  focusRoom, directorPlan, LADDER, RUNGS,
  rungAtmosphere, rungNpc, rungCallRoll, rungAftermath,
  ATMOSPHERE_QUIET_MS,
} from "../src/engine/director.js";
import { VOTE_TOPICS, openVote, castVote, closeVote } from "../src/engine/vote.js";
import { defineModule } from "../src/engine/defineModule.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

const NOW = 1_700_000_000_000;

const world = (over = {}) => ({
  room: "mess", clock: 0, visited: { mess: true, duct: true },
  flags: {}, threats: {}, npcs: {}, clues: [], oracleMemory: {}, tempo: {},
  ...over,
});

/* Three in the mess, two in the ducting. The shape the module's own
   best material is made of, and the shape the director could not
   previously see. */
const split = [
  { id: "a", name: "Ana", alive: true, room: "mess" },
  { id: "b", name: "Bo", alive: true, room: "mess" },
  { id: "c", name: "Cass", alive: true, room: "mess" },
  { id: "d", name: "Dev", alive: true, room: "duct" },
  { id: "e", name: "El", alive: true, room: "duct" },
];

const together = split.map((c) => ({ ...c, room: "mess" }));

/* ============================================================
   1 — WHICH ROOM
   ============================================================ */

describe("focusRoom", () => {
  it("returns the party's own room when nobody has split", () => {
    expect(focusRoom(world(), together, {})).toBe("mess");
  });

  it("survives a crew with no rooms at all — the pre-party.js save", () => {
    const old = [{ id: "a", alive: true }, { id: "b", alive: true }];
    expect(focusRoom(world(), old, {})).toBe("mess");
  });

  it("starts a fresh split where the table's attention already was", () => {
    /* A tie goes to the majority room. The two who just walked out
       have not been neglected yet, and jumping to them the instant
       they leave would make walking out a way to seize the floor. */
    expect(focusRoom(world(), split, {})).toBe("mess");
  });

  it("then rotates to whoever has been waiting longest", () => {
    expect(focusRoom(world(), split, { mess: NOW })).toBe("duct");
  });

  it("and rotates back rather than parking on the minority", () => {
    expect(focusRoom(world(), split, { mess: NOW, duct: NOW + 1000 })).toBe("mess");
  });

  it("never names a room nobody is standing in", () => {
    const w = world({ visited: { mess: true, duct: true, vault: true } });
    /* `vault` has been visited and is empty. Attention is about
       people, not places. */
    expect(focusRoom(w, split, { mess: NOW, duct: NOW })).not.toBe("vault");
  });
});

/* ============================================================
   2 — THE RUNGS FOLLOW IT
   ============================================================ */

/* Atmosphere pools are keyed to room TAGS through `mod.flavour` —
   see `atmosphere` in oracle.js. Two rooms with different tags is
   what makes "which room did it describe" answerable from the text
   rather than only from the Move's own field. */
const mod = defineModule({
  id: "t",
  title: "T",
  start: "mess",
  flavour: {
    galley: ["The mess ticks as it cools."],
    crawl: ["The ducting breathes on you."],
  },
  rooms: {
    mess: { name: "Mess", look: "A mess.", tags: ["galley"] },
    duct: { name: "Ducting", look: "A duct.", tags: ["crawl"] },
  },
});

describe("the rungs speak about the room they were pointed at", () => {
  const quiet = { rng: () => 0, now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1, lastAtmosphereAt: 0 };

  it("describes the majority room when that is the focus", () => {
    const m = rungAtmosphere({ mod, w: world(), focus: "mess", ...quiet });
    expect(m.room).toBe("mess");
    expect(m.text).toContain("mess");
  });

  it("describes the OTHER room when the focus has rotated to it", () => {
    /* The line the two people in the ducting could never previously
       receive, because no rung would look at the room they were in. */
    const m = rungAtmosphere({ mod, w: world(), focus: "duct", ...quiet });
    expect(m.room).toBe("duct");
    expect(m.text).toContain("ducting");
  });

  it("tests somebody who is actually standing there", () => {
    const rolls = [{ id: "r1", stat: "fear", save: true, reason: "because." }];
    const m = rungCallRoll({
      mod: { ...mod, director: { rolls } }, w: world(), crew: split, focus: "duct",
    });
    expect(["d", "e"]).toContain(m.pcId);
    expect(m.room).toBe("duct");
  });

  it("lets an NPC in the focus room speak, and not one somewhere else", () => {
    const withNpcs = {
      ...mod,
      npcs: { gio: { name: "Gio", knows: ["It has been like this for days."] } },
    };
    const w = world({ npcs: { gio: { alive: true, met: true, loc: "duct", told: [] } } });
    expect(rungNpc({ mod: withNpcs, w, now: NOW, lastNpcAt: 0, focus: "duct" })).toBeTruthy();
    expect(rungNpc({ mod: withNpcs, w, now: NOW, lastNpcAt: 0, focus: "mess" })).toBe(null);
  });

  it("answers a failed roll where the roll was failed", () => {
    /* Not where most people are. Somebody who went off alone and
       came unstuck is the single most important case for this — it
       is the moment they are most owed a sentence. */
    const withFail = { ...mod, director: { onFail: ["It goes badly."] } };
    const feed = [{ id: 9, kind: "roll", at: NOW, extra: { roll: { failed: true, pcId: "e" } } }];
    const m = rungAftermath({
      mod: withFail, w: world(), crew: split, feed,
      rng: () => 0, now: NOW, lastAftermathAt: 0, focus: "mess",
    });
    expect(m.room).toBe("duct");
  });
});

/* ============================================================
   3 — AND THE TABLE THAT NEVER SPLIT CANNOT TELL
   ============================================================ */

describe("an unsplit table is unchanged", () => {
  it("plans against the party's own room exactly as before", () => {
    const args = {
      mod, w: world(), crew: together, feed: [], rng: () => 0,
      now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1,
      startedAt: NOW - 60_000,
    };
    const m = directorPlan(args);
    expect(m).toBeTruthy();
    expect(m.room).toBe("mess");
  });

  it("does the same with no ledger and with a stale one", () => {
    /* The rotation ledger is per-session and starts empty. A table
       that has never split must produce the same Move either way,
       or resuming a save would change what the director says. */
    const base = {
      mod, w: world(), crew: together, feed: [], rng: () => 0,
      now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1,
      startedAt: NOW - 60_000,
    };
    const cold = directorPlan(base);
    const warm = directorPlan({ ...base, roomServedAt: { mess: NOW - 500_000 } });
    expect(warm.room).toBe(cold.room);
    expect(warm.text).toBe(cold.text);
  });
});

/* ============================================================
   4 — THE LADDER IS WRITTEN DOWN ONCE

   `LADDER` used to be a hand-maintained array and `directorPlan`
   walked a separate one. By 2.11.0 they disagreed by two entries —
   `lastCall` and `listen` both ran and neither was listed — and
   nothing caught it, because the only assertions on `LADDER` were
   about `LADDER`.
   ============================================================ */

describe("the ladder cannot drift", () => {
  it("derives the names from the functions that actually run", () => {
    expect(LADDER).toEqual([...RUNGS.map(([name]) => name), "silence"]);
  });

  it("lists every rung the loop walks, including the two that went missing", () => {
    expect(LADDER).toContain("lastCall");
    expect(LADDER).toContain("listen");
    expect(RUNGS).toHaveLength(17);
  });

  it("has no duplicate and no empty names", () => {
    const names = RUNGS.map(([n]) => n);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => typeof n === "string" && n.length)).toBe(true);
  });

  it("pairs every name with a callable", () => {
    expect(RUNGS.every(([, fn]) => typeof fn === "function")).toBe(true);
  });
});

/* ============================================================
   5 — THE MODULE IS LISTENING

   `rungListen` shipped in 2.10.0 and no module declared a single
   listener, so the gap it was written to close — that the director
   never answers a sentence anybody said — stayed open at every
   real table while being closed in the engine.
   ============================================================ */

describe("Ypsilon 14 declares listeners", () => {
  it("has them, and they survive defineModule", () => {
    expect(ypsilon.director.listeners.length).toBeGreaterThan(8);
  });

  it("gives every one of them something to say", () => {
    /* `defineModule` refuses a listener with neither effects nor a
       label, because it would fire and produce nothing. */
    for (const l of ypsilon.director.listeners) {
      expect(l.phrases.length).toBeGreaterThan(0);
      expect(l.effects || l.label).toBeTruthy();
    }
  });

  it("uses phrases long enough not to fire on their own negation", () => {
    /* "alone" matches "we should not go alone", which means the
       opposite. Substring matching is the engine's choice and the
       author's problem. */
    for (const l of ypsilon.director.listeners) {
      for (const p of l.phrases) expect(p.length).toBeGreaterThan(2);
    }
  });

  it("keeps the module's answer to its own mystery out of them", () => {
    /* THE ONE THAT MATTERS. A listener fires on the exact subject
       somebody just raised, so a table that guesses correctly must
       not be rewarded with a confirmation. Nothing a listener says
       may name the creature or what it does. */
    const forbidden = ["creature", "alien", "monster", "in the vent", "eats", "devour"];
    /* The SPOKEN text only. A `when` clause naming the
       `knows_devour` flag is the module gating a listener on
       something the crew has already worked out — which is the
       system working, and is never read aloud to anybody. */
    const said = ypsilon.director.listeners
      .flatMap((l) => (l.effects || []).map((e) => e.say || ""))
      .join(" ")
      .toLowerCase();
    for (const word of forbidden) expect(said).not.toContain(word);
  });
});

/* ============================================================
   6 — THE FLOOR IS REACHABLE

   `floor.js` is off by default on the argument that four friends
   who have played together for a decade will resent it. That
   argument assumed a person sitting there who could turn it on,
   and its only switch was inside `WardenDeck`, which wardenless
   mode locks away by design.
   ============================================================ */

describe("the table can ask for the floor to be watched", () => {
  it("is a topic the table can put to itself", () => {
    expect(VOTE_TOPICS.floor).toBeTruthy();
    expect(VOTE_TOPICS.floor.options.map((o) => o.id)).toEqual(["yes", "no"]);
  });

  it("leaves it alone unless the room actually says yes", () => {
    expect(VOTE_TOPICS.floor.fallback).toBe("no");
  });

  it("names nobody, in the question as well as in the answer", () => {
    /* Rule 1 in floor.js is that nothing this produces is ever
       about a person. A ballot reading "Riley keeps talking over
       people" would break it before the vote had even landed. */
    const text = `${VOTE_TOPICS.floor.label} ${VOTE_TOPICS.floor.blurb}`.toLowerCase();
    expect(text).toContain("who");
    expect(text).not.toMatch(/\b(riley|somebody's name|player \d)\b/);
  });

  it("carries a majority the same way every other topic does", () => {
    let v = openVote("floor", { of: ["p1", "p2", "p3"], at: NOW });
    v = castVote(v, "p1", "yes");
    v = castVote(v, "p2", "yes");
    v = closeVote(v, NOW + 200_000);
    expect(v.result.choice).toBe("yes");
  });
});
