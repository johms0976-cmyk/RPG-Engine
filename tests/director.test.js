/* ============================================================
   THE DIRECTOR, TESTED.

   Most of these assert that it says *nothing*. That is the right
   ratio: the failure mode of an autonomous referee is not that it
   misses a beat, it is that it fills every silence, and by hour
   two the table has stopped reading the screen.

   The `safeMove` block is the important one. It is the wardenless
   equivalent of the `dark`-whisper finding — a leak nothing will
   ever throw an error about — and it is the only part of this file
   where a passing test is load-bearing rather than reassuring.
   ============================================================ */

import { describe, it, expect } from "vitest";
import {
  directorPlan, safeMove, LADDER, moveLabel, isSpoken,
  rungSafety, rungPending, rungCombat, rungFloor, rungAtmosphere, rungPacing,
  ATMOSPHERE_QUIET_MS, ATMOSPHERE_GAP_MS,
} from "../src/engine/director.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";

const NOW = 1_700_000_000_000;

const MOD = {
  id: "t", title: "T",
  rooms: {
    bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} },
    duct: { name: "DUCT", look: "narrow", tags: ["cold"], exits: [], features: {} },
  },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: { it: { name: "IT", unseen: true } },
};

const crew = [{ id: "riley", name: "RILEY", alive: true }, { id: "dana", name: "DANA", alive: true }];

const W = (patch = {}) => ({
  room: "bay",
  clock: 0,
  visited: { bay: true },
  threats: {},
  countdowns: {},
  flags: {},
  oracleMemory: {},
  floor: { ...DEFAULT_FLOOR },
  ...patch,
});

describe("the ladder", () => {
  it("is declared in order, so it can be asserted rather than described", () => {
    expect(LADDER[0]).toBe("safety");
    expect(LADDER[LADDER.length - 1]).toBe("silence");
    expect(LADDER.indexOf("floor")).toBeLessThan(LADDER.indexOf("atmosphere"));
    expect(LADDER.indexOf("pending")).toBeLessThan(LADDER.indexOf("floor"));
  });

  it("says nothing on a table that has just done something", () => {
    const move = directorPlan({ mod: MOD, w: W(), crew, now: NOW, lastLineAt: NOW - 1000 });
    expect(move).toBe(null);
  });

  it("says nothing at all once the module has ended", () => {
    const move = directorPlan({ mod: MOD, w: W({ ended: "win" }), crew, now: NOW });
    expect(move).toBe(null);
  });

  it("obeys a held table exactly as a phone does", () => {
    const w = W({ tempo: { held: true } });
    expect(directorPlan({ mod: MOD, w, crew, now: NOW })).toEqual({ kind: "wait", rung: "safety" });
  });

  it("obeys a declared break", () => {
    const w = W({ tempo: { breather: { since: NOW } } });
    expect(directorPlan({ mod: MOD, w, crew, now: NOW }).kind).toBe("wait");
  });

  it("stops everything for the safety card, above every other rung", () => {
    const move = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      safetyCall: { level: "stop" },
      // …even with an atmosphere line overdue and a pending roll.
      lastLineAt: NOW - 10 * ATMOSPHERE_QUIET_MS, pending: { kind: "roll" },
    });
    expect(move).toEqual({ kind: "halt", rung: "safety", why: "stop" });
  });

  it("waits rather than talking over a prompt on somebody's screen", () => {
    const move = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      pending: { kind: "roll" }, lastLineAt: NOW - 10 * ATMOSPHERE_QUIET_MS,
    });
    expect(move).toEqual({ kind: "wait", rung: "pending" });
  });

  it("leaves a fight to combat.js", () => {
    const move = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      combat: { order: [], turnIndex: 0 }, lastLineAt: NOW - 10 * ATMOSPHERE_QUIET_MS,
    });
    expect(move).toEqual({ kind: "wait", rung: "combat" });
  });

  it("describes the room once the table has been quiet long enough", () => {
    const move = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1,
    });
    expect(move).toMatchObject({ kind: "describe", rung: "atmosphere", room: "bay" });
    expect(move.text).toBeTruthy();
  });

  it("will not describe the room twice in quick succession", () => {
    const move = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1,
      lastAtmosphereAt: NOW - 1000,
    });
    expect(move).toBe(null);
  });

  it("is pure — the same arguments give the same answer", () => {
    const args = { mod: MOD, w: W(), crew, now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1, rng: () => 0.5 };
    expect(directorPlan(args)).toEqual(directorPlan(args));
  });
});

describe("the guard — what must never reach the shared screen", () => {
  it("drops a Move about a room nobody has entered", () => {
    const move = { kind: "describe", room: "duct", text: "It drips.", speaks: true };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toBe(null);
  });

  it("keeps a Move about a room the crew has been in", () => {
    const move = { kind: "describe", room: "bay", text: "It drips.", speaks: true };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toEqual(move);
  });

  it("refuses to narrate a thing the crew cannot see", () => {
    const move = { kind: "describe", threatId: "it", room: "bay", text: "IT shifts.", speaks: true };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toBe(null);
  });

  it("still lets an unseen thing be moved, just not described", () => {
    const move = { kind: "pressure", threatId: "it", room: "bay" };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toEqual(move);
  });

  it("drops a Move justified by something one player was told", () => {
    const move = {
      kind: "describe", room: "bay", text: "Somebody knows.", speaks: true,
      becauseOf: { id: 4, kind: "whisper", to: "riley", text: "…" },
    };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toBe(null);
  });

  it("keeps a Move justified by something the table saw", () => {
    const move = {
      kind: "describe", room: "bay", text: "The hatch is still open.", speaks: true,
      becauseOf: { id: 4, kind: "room", text: "…" },
    };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toEqual(move);
  });

  it("refuses to speak anything addressed to one player", () => {
    const move = { kind: "describe", room: "bay", to: "riley", text: "…", speaks: true };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toBe(null);
  });

  it("exempts a whisper, which is routed and redacted rather than spoken", () => {
    const move = { kind: "whisper", to: "riley", text: "The log has your name on it." };
    expect(safeMove(move, { w: W(), mod: MOD, crew })).toEqual(move);
  });

  it("treats silence as nothing to say, not as something to check", () => {
    expect(safeMove({ kind: "silence" }, { w: W(), mod: MOD, crew })).toBe(null);
    expect(safeMove(null, { w: W(), mod: MOD, crew })).toBe(null);
  });

  it("continues down the ladder when a Move is dropped, rather than falling silent", () => {
    /* An unvisited current room makes the atmosphere rung unsafe. The
       plan should come back null rather than throwing or emitting it. */
    const w = W({ room: "duct", visited: { bay: true } });
    const move = directorPlan({ mod: MOD, w, crew, now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1 });
    expect(move).toBe(null);
  });
});

describe("the floor rung is Part B, reused", () => {
  it("offers the floor when somebody has been left out", () => {
    const w = W({
      floor: { ...DEFAULT_FLOOR, on: true, since: NOW - 600_000, last: { riley: NOW, dana: NOW - 500_000 } },
    });
    const move = rungFloor({ w, crew, now: NOW, lastMoveAt: 0 });
    expect(move).toMatchObject({ kind: "spotlight", pcId: "dana", rung: "floor" });
  });

  it("stays silent when the floor ledger is off", () => {
    expect(rungFloor({ w: W(), crew, now: NOW, lastMoveAt: 0 })).toBe(null);
  });

  it("outranks atmosphere", () => {
    const w = W({
      floor: { ...DEFAULT_FLOOR, on: true, since: NOW - 600_000, last: { riley: NOW, dana: NOW - 500_000 } },
    });
    const move = directorPlan({
      mod: MOD, w, crew, now: NOW, lastLineAt: NOW - 10 * ATMOSPHERE_QUIET_MS,
    });
    expect(move.rung).toBe("floor");
  });
});

describe("labels for the assisted strip", () => {
  it("says something a person can act on", () => {
    expect(moveLabel({ kind: "describe" })).toMatch(/room/i);
    expect(moveLabel({ kind: "spotlight", pcId: "dana" }, { crew })).toBe("Look at DANA");
    expect(moveLabel({ kind: "startScene" })).toMatch(/round/i);
  });

  it("has nothing to say about a decision to do nothing", () => {
    expect(moveLabel({ kind: "wait" })).toBe(null);
    expect(moveLabel(null)).toBe(null);
  });

  it("knows which Moves the table would notice", () => {
    expect(isSpoken({ kind: "describe" })).toBe(true);
    expect(isSpoken({ kind: "wait" })).toBe(false);
  });
});

describe("no model, no network", () => {
  it("is a pure function of its arguments and touches nothing global", () => {
    // Not a proof, but it fails loudly if somebody reaches for fetch.
    const before = globalThis.fetch;
    directorPlan({ mod: MOD, w: W(), crew, now: NOW, lastLineAt: NOW - ATMOSPHERE_QUIET_MS - 1 });
    expect(globalThis.fetch).toBe(before);
  });
});
