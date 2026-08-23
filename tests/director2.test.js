/* ============================================================
   THE DIRECTOR, PART TWO — the four defects and the new rungs.

   `tests/director.test.js` covers the ladder as it shipped. This
   covers what was broken in it and what has been added since.

   The four defect tests are the important ones and they are
   written as regressions rather than as features, because all
   four were invisible: a stage counter nothing wrote, a Move kind
   nothing executed, a promise the docs made that the code did
   not, and a privacy guarantee that was simply untrue with the
   chair empty. None of them would ever have thrown.
   ============================================================ */

import { describe, it, expect } from "vitest";
import {
  directorPlan, safeMove, LADDER, moveLabel, isSpoken, VETO_LIMIT,
  rungScripted, rungEnding, rungCallRoll, rungNpc, rungAftermath,
  NPC_QUIET_MS, NPC_GAP_MS, AFTERMATH_MS,
} from "../src/engine/director.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";
import { allowedPeerMode, PEER_MODES } from "../src/net/protocol.js";

const NOW = 1_700_000_000_000;

const MOD = {
  id: "t", title: "T",
  rooms: {
    bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} },
    duct: { name: "DUCT", look: "narrow", tags: ["cold"], exits: [], features: {} },
  },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: { it: { name: "IT", unseen: true } },
  npcs: {
    sonya: { name: "SONYA", knows: ["The pumps have been odd for weeks.", "Mike is still missing."] },
    quiet: { name: "QUIET", knows: [] },
  },
  endings: { sealed: { title: "SEALED", text: "…" } },
};

const crew = [{ id: "riley", name: "RILEY", alive: true }, { id: "dana", name: "DANA", alive: true }];

const W = (patch = {}) => ({
  room: "bay",
  clock: 0,
  visited: { bay: true },
  threats: {},
  npcs: {},
  countdowns: {},
  flags: {},
  oracleMemory: {},
  floor: { ...DEFAULT_FLOOR },
  ...patch,
});

/* ============================================================
   DEFECT 1 — the stage counter nothing wrote
   ============================================================ */
describe("the escalation ladder actually advances", () => {
  const withEscalate = {
    ...MOD,
    director: {
      escalate: [
        { label: "one", atClock: 10, effects: [{ say: "first" }] },
        { label: "two", atClock: 20, effects: [{ say: "second" }] },
      ],
    },
  };

  it("reads the stage from a flag, which is a thing the engine can write", () => {
    /* The regression. It used to read `w.directorStage` — a
       top-level field nothing in src/ ever set — so entry 0
       qualified forever. A flag is written by `warden.flag`, saved,
       and restored, like every other piece of module progress. */
    const first = rungScripted({ mod: withEscalate, w: W({ clock: 15 }), crew, now: NOW });
    expect(first).toMatchObject({ kind: "escalate", stage: 0 });

    const second = rungScripted({
      mod: withEscalate, w: W({ clock: 25, flags: { directorStage: 1 } }), crew, now: NOW,
    });
    expect(second).toMatchObject({ stage: 1 });
  });

  it("carries the number the executor must write back", () => {
    const move = rungScripted({ mod: withEscalate, w: W({ clock: 15 }), crew, now: NOW });
    expect(move.nextStage).toBe(1);
  });

  it("stops at the end of the list rather than wrapping", () => {
    const done = rungScripted({
      mod: withEscalate, w: W({ clock: 999, flags: { directorStage: 2 } }), crew, now: NOW,
    });
    expect(done).toBe(null);
  });

  it("honours a `when` as well as a clock", () => {
    const gated = {
      ...MOD,
      director: { escalate: [{ atClock: 10, when: "flag:ready", effects: [{ say: "x" }] }] },
    };
    expect(rungScripted({ mod: gated, w: W({ clock: 50 }), crew, now: NOW })).toBe(null);
    expect(rungScripted({
      mod: gated, w: W({ clock: 50, flags: { ready: true } }), crew, now: NOW,
    })).toMatchObject({ kind: "escalate" });
  });

  it("never fires an entry with no trigger at all, rather than firing it immediately", () => {
    const untriggered = { ...MOD, director: { escalate: [{ effects: [{ say: "x" }] }] } };
    expect(rungScripted({ mod: untriggered, w: W({ clock: 999 }), crew, now: NOW })).toBe(null);
  });
});

/* ============================================================
   DEFECT 4 — `dark` on a table that cannot honour it
   ============================================================ */
describe("the promise we will not make with the chair empty", () => {
  it("keeps every mode on a Warden table", () => {
    for (const m of PEER_MODES) expect(allowedPeerMode(m, "warden")).toBe(m);
  });

  it("refuses dark when nobody is the Warden", () => {
    /* The router is then a device belonging to somebody who is also
       playing, chosen because they opened the tab. "Dark" is a
       promise the software cannot keep, so it is not made. */
    expect(allowedPeerMode("dark", "wardenless")).toBe("seen");
  });

  it("leaves the two honest modes alone", () => {
    expect(allowedPeerMode("open", "wardenless")).toBe("open");
    expect(allowedPeerMode("seen", "wardenless")).toBe("seen");
  });

  it("downgrades rather than refusing, so the whisper still arrives", () => {
    expect(allowedPeerMode("dark", "wardenless")).not.toBe(null);
  });
});

/* ============================================================
   THE NEW RUNGS
   ============================================================ */
describe("an ending the module declared", () => {
  const withEnding = {
    ...MOD,
    director: { endings: [{ id: "sealed", when: "flag:locked" }] },
  };

  it("is noticed when its condition becomes true", () => {
    const move = rungEnding({ mod: withEnding, w: W({ flags: { locked: true } }), crew });
    expect(move).toMatchObject({ kind: "end", ending: "sealed" });
  });

  it("says nothing while it is not", () => {
    expect(rungEnding({ mod: withEnding, w: W(), crew })).toBe(null);
  });

  it("cannot invent an ending the module never declared", () => {
    const bogus = { ...MOD, director: { endings: [{ id: "nope", when: "flag:locked" }] } };
    expect(rungEnding({ mod: bogus, w: W({ flags: { locked: true } }), crew })).toBe(null);
  });

  it("does not re-end a finished game", () => {
    expect(rungEnding({ mod: withEnding, w: W({ ended: true, flags: { locked: true } }), crew })).toBe(null);
  });
});

describe("a roll, called", () => {
  const withRolls = {
    ...MOD,
    director: {
      rolls: [{ id: "r1", when: "flag:seen", stat: "fear", reason: "You saw what it did." }],
    },
  };

  it("names a player and a reason", () => {
    const move = rungCallRoll({ mod: withRolls, w: W({ flags: { seen: true } }), crew });
    expect(move).toMatchObject({ kind: "callRoll", stat: "fear", save: true });
    expect(crew.map((c) => c.id)).toContain(move.pcId);
    expect(move.reason.length).toBeGreaterThan(0);
  });

  it("fires once", () => {
    const w = W({ flags: { seen: true, directorRolls: { r1: true } } });
    expect(rungCallRoll({ mod: withRolls, w, crew })).toBe(null);
  });

  it("waits for its condition", () => {
    expect(rungCallRoll({ mod: withRolls, w: W(), crew })).toBe(null);
  });

  /* THE GUARD THAT MATTERS. A director that can call a roll can fail
     somebody, and a failure fires consequence. Requiring the reason
     means it can never spring a test for a danger the table was
     never shown — a module author who cannot write the sentence has
     not yet earned the roll. */
  it("is dropped entirely when it cannot say why", () => {
    const silent = { ...MOD, director: { rolls: [{ id: "r", when: "flag:seen", stat: "fear" }] } };
    const move = rungCallRoll({ mod: silent, w: W({ flags: { seen: true } }), crew });
    expect(move).not.toBe(null);
    expect(safeMove(move, { w: W(), mod: silent, crew })).toBe(null);
  });

  it("survives the guard when it can", () => {
    const move = rungCallRoll({ mod: withRolls, w: W({ flags: { seen: true } }), crew });
    expect(safeMove(move, { w: W(), mod: withRolls, crew })).toBe(move);
  });
});

describe("an NPC who speaks first", () => {
  const present = () => W({
    npcs: { sonya: { alive: true, loc: "bay", met: true, told: [] } },
  });

  it("says an untold thing from their own knows list", () => {
    const move = rungNpc({ mod: MOD, w: present(), now: NOW, lastNpcAt: 0, npcSpokeAt: {} });
    expect(move).toMatchObject({ kind: "npcSay", npcId: "sonya", index: 0 });
    /* INV-6 by construction: the text is an entry from the list, not
       something assembled. */
    expect(MOD.npcs.sonya.knows).toContain(move.text);
  });

  it("stays quiet about people the crew has not met", () => {
    const w = W({ npcs: { sonya: { alive: true, loc: "bay", met: false, told: [] } } });
    expect(rungNpc({ mod: MOD, w, now: NOW, npcSpokeAt: {} })).toBe(null);
  });

  it("stays quiet about people who are not in the room", () => {
    const w = W({ npcs: { sonya: { alive: true, loc: "duct", met: true, told: [] } } });
    expect(rungNpc({ mod: MOD, w, now: NOW, npcSpokeAt: {} })).toBe(null);
  });

  it("has nothing to say for somebody with an empty knows list", () => {
    const w = W({ npcs: { quiet: { alive: true, loc: "bay", met: true, told: [] } } });
    expect(rungNpc({ mod: MOD, w, now: NOW, npcSpokeAt: {} })).toBe(null);
  });

  it("does not repeat something already told", () => {
    const w = W({ npcs: { sonya: { alive: true, loc: "bay", met: true, told: [0] } } });
    expect(rungNpc({ mod: MOD, w, now: NOW, npcSpokeAt: {} }).index).toBe(1);
  });

  it("will not let one person monologue", () => {
    const move = rungNpc({
      mod: MOD, w: present(), now: NOW, npcSpokeAt: { sonya: NOW - 1000 },
    });
    expect(move).toBe(null);
  });

  it("will not let the room take turns at you either", () => {
    const move = rungNpc({ mod: MOD, w: present(), now: NOW, lastNpcAt: NOW - 1000, npcSpokeAt: {} });
    expect(move).toBe(null);
  });

  it("leaves a long enough gap to be a person rather than a kiosk", () => {
    expect(NPC_QUIET_MS).toBeGreaterThanOrEqual(3 * 60 * 1000);
    expect(NPC_GAP_MS).toBeGreaterThanOrEqual(3 * 60 * 1000);
  });
});

describe("a failed roll, narrated", () => {
  const failure = (at) => ([{ id: 7, kind: "roll", at, extra: { roll: { failed: true } } }]);
  const withFail = { ...MOD, director: { onFail: ["It does not go your way."] } };

  it("answers a fresh failure from the module's own pool", () => {
    const move = rungAftermath({
      mod: withFail, w: W(), feed: failure(NOW - 1000), rng: () => 0, now: NOW, lastAftermathAt: 0,
    });
    expect(move).toMatchObject({ kind: "describe", rung: "aftermath", answered: 7 });
    expect(withFail.director.onFail).toContain(move.text);
  });

  it("says nothing about a success", () => {
    const feed = [{ id: 7, kind: "roll", at: NOW, extra: { roll: { failed: false } } }];
    expect(rungAftermath({ mod: withFail, w: W(), feed, rng: () => 0, now: NOW })).toBe(null);
  });

  it("answers each failure once", () => {
    const move = rungAftermath({
      mod: withFail, w: W(), feed: failure(NOW), rng: () => 0, now: NOW, lastAftermathAt: 7,
    });
    expect(move).toBe(null);
  });

  it("does not turn up late to a failure the table has moved past", () => {
    const move = rungAftermath({
      mod: withFail, w: W(), feed: failure(NOW - AFTERMATH_MS - 1), rng: () => 0, now: NOW,
    });
    expect(move).toBe(null);
  });

  it("stays silent on a module with no pool, which is what it does today", () => {
    expect(rungAftermath({ mod: MOD, w: W(), feed: failure(NOW), rng: () => 0, now: NOW })).toBe(null);
  });
});

/* ============================================================
   THE VETO LADDER
   ============================================================ */
describe("what the table has already said no to", () => {
  const chatty = { ...MOD };

  it("stops offering a rung that has been waved away enough times", () => {
    const args = {
      mod: chatty, w: W(), crew, now: NOW,
      lastLineAt: NOW - 10 * 60 * 1000, lastAtmosphereAt: 0, rng: () => 0,
    };
    expect(directorPlan(args)).toMatchObject({ rung: "atmosphere" });
    expect(directorPlan({ ...args, vetoes: { atmosphere: VETO_LIMIT } })).toBe(null);
  });

  it("still obeys the safety rung, which is not a suggestion", () => {
    const move = directorPlan({
      mod: chatty, w: W(), crew, now: NOW,
      safetyCall: { level: "stop" },
      vetoes: { safety: 99 },
    });
    expect(move).toMatchObject({ kind: "halt" });
  });

  it("takes more than one refusal, because twice is a coincidence", () => {
    expect(VETO_LIMIT).toBeGreaterThan(2);
  });
});

/* ============================================================
   THE SHAPE OF THE THING
   ============================================================ */
describe("the extended ladder", () => {
  it("puts consequence and endings above housekeeping", () => {
    expect(LADDER.indexOf("aftermath")).toBeLessThan(LADDER.indexOf("floor"));
    expect(LADDER.indexOf("ending")).toBeLessThan(LADDER.indexOf("atmosphere"));
  });

  it("still ends in silence", () => {
    expect(LADDER[LADDER.length - 1]).toBe("silence");
  });

  it("labels every new move kind, so nothing reaches the strip unnamed", () => {
    const kinds = [
      { kind: "callRoll", pcId: "riley", stat: "fear", save: true },
      { kind: "npcSay", npcId: "sonya" },
      { kind: "end", ending: "sealed" },
      { kind: "escalate", label: "the base notices" },
    ];
    for (const m of kinds) {
      expect(moveLabel(m, { mod: MOD, crew })).toBeTruthy();
    }
  });

  it("counts the loud ones as spoken, so a Warden sees them before they land", () => {
    expect(isSpoken({ kind: "callRoll" })).toBe(true);
    expect(isSpoken({ kind: "end" })).toBe(true);
    expect(isSpoken({ kind: "npcSay" })).toBe(true);
  });

  it("still makes no model call", () => {
    const before = globalThis.fetch;
    directorPlan({
      mod: MOD, w: W(), crew, now: NOW, lastLineAt: NOW - 10 * 60 * 1000, rng: () => 0,
    });
    expect(globalThis.fetch).toBe(before);
  });
});
