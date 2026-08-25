// @vitest-environment jsdom
/* ============================================================
   THE HALF WITH HANDS.

   `tests/party-attention.test.js` tests the arithmetic. This is
   the half that would have caught the two defects those tests
   could not:

   1. `sessionEndsAt` had a rung, a plan parameter, a hook
      parameter and four unit assertions, and NO PRODUCER. Nothing
      set it, nothing carried it, and `App.jsx` constructed
      `useDirector` without it — so `rungLastCall` returned null on
      every tick of every session ever played while its tests were
      green. A unit test on a rung cannot see that. Only a test
      that goes through the hook can.

   2. The director spoke through `warden.say`, which addresses the
      whole table, so a room-scoped line reached people who were
      not in the room. Also invisible to a rung test, because the
      rung was emitting the right Move all along — it was the
      executor that threw the room away.

   Both are the same class of bug: correct pure half, disconnected
   wire. Assert the wire.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { useDirector, DIRECTOR_TICK_MS } from "../src/net/useDirector.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";

const MOD = {
  id: "t",
  title: "T",
  rooms: {
    bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} },
    hold: { name: "HOLD", look: "colder", tags: ["cold"], exits: [], features: {} },
  },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: {},
  npcs: {},
  endings: {},
};

/** A game stub that records HOW it was spoken to, not merely that
    it was. The distinction is the whole point of this file. */
function fakeGame(over = {}) {
  const said = [];
  const inRoom = [];
  const flags = [];
  return {
    said, inRoom, flags,
    mod: MOD,
    w: {
      room: "bay", clock: 0, visited: { bay: true, hold: true },
      threats: {}, countdowns: {}, flags: {}, oracleMemory: {},
      floor: { ...DEFAULT_FLOOR },
      ...(over.w || {}),
    },
    crew: over.crew || [{ id: "riley", name: "RILEY", alive: true, room: "bay" }],
    feed: [],
    combat: null,
    pending: null,
    warden: {
      say: (text, tone) => said.push({ text, tone }),
      scene: () => {},
      flag: (name, value) => flags.push({ name, value }),
    },
    /* The verb the director should be reaching for. Present on the
       real game object as `api.sayIn` and always has been. */
    api: { sayIn: (room, tone, text) => inRoom.push({ room, tone, text }) },
    say: (tone, text) => said.push({ text, tone }),
    runEffects: () => {},
    whisperTo: () => {},
    floorNote: () => {},
  };
}

describe("the session clock reaches the director", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("says nothing about the time when the table set no length", () => {
    /* The default, and it must stay the default. A table that did
       not ask to be steered is never steered. */
    const g = fakeGame();
    renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(g.flags.find((f) => f.name === "lastCall")).toBeFalsy();
  });

  it("announces last call once the declared length has passed", () => {
    /* THE TEST THAT WOULD HAVE CAUGHT IT. `sessionEndsAt` in the
       past, through the hook, all the way to the flag. */
    const g = fakeGame();
    renderHook(() => useDirector({
      g, mod: MOD, enabled: true, auto: true,
      sessionEndsAt: Date.now() - 1000,
    }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 4); });
    expect(g.flags.find((f) => f.name === "lastCall")).toBeTruthy();
  });

  it("and says it once rather than every tick", () => {
    const g = fakeGame();
    renderHook(() => useDirector({
      g, mod: MOD, enabled: true, auto: true,
      sessionEndsAt: Date.now() - 1000,
    }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 40); });
    expect(g.flags.filter((f) => f.name === "lastCall")).toHaveLength(1);
  });

  it("does not announce it early", () => {
    const g = fakeGame();
    renderHook(() => useDirector({
      g, mod: MOD, enabled: true, auto: true,
      sessionEndsAt: Date.now() + 60 * 60 * 1000,
    }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(g.flags.find((f) => f.name === "lastCall")).toBeFalsy();
  });
});

describe("and the app actually hands it over", () => {
  /* THE GAP THAT LET IT SHIP, CLOSED.

     Every test above passes `sessionEndsAt` into the hook by hand,
     which is exactly what the four original assertions on
     `rungLastCall` did — and it is why nobody noticed for two
     releases that `App.jsx` never passed it at all. A hook test
     cannot see an argument its own caller forgot.

     So this reads the source, in the same spirit as
     `tests/floor.test.js` reading imports and `tests/offline.test.js`
     grepping for `fetch`. It is a crude test and it is guarding
     against a defect that was invisible to every sophisticated one. */
  /* `import.meta.url` is an http URL under jsdom, unlike in the
     node-environment source tests this one is modelled on. Vitest
     runs from the project root. */
  const read = (rel) => readFileSync(join(process.cwd(), rel), "utf8");

  it("passes sessionEndsAt to useDirector", () => {
    const src = read("src/App.jsx");
    const call = src.slice(src.indexOf("useDirector({"));
    expect(call.slice(0, call.indexOf("});"))).toContain("sessionEndsAt");
  });

  it("gets that value from something a person can set", () => {
    /* A hard-coded zero would satisfy the test above and mean
       nothing. The lobby is where the table agrees it. */
    expect(read("src/screens/Lobby.jsx")).toContain("onSessionMins");
    expect(read("src/App.jsx")).toContain("sessionMins");
  });
});

describe("a line about a room is said in that room", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("routes narration through the room rather than at the table", () => {
    const g = fakeGame();
    renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(g.inRoom.length).toBeGreaterThan(0);
    expect(g.inRoom[0].room).toBeTruthy();
    /* And it did NOT go out to everybody as well. One line, one
       audience — a director that did both would leak the split
       party's whereabouts while appearing to work. */
    expect(g.said).toEqual([]);
  });

  it("shares its attention between two rooms rather than parking on the majority", () => {
    /* Three in the bay, two in the hold. Previously the hold could
       not be described at all, because every rung read `w.room`. */
    const g = fakeGame({
      crew: [
        { id: "a", name: "A", alive: true, room: "bay" },
        { id: "b", name: "B", alive: true, room: "bay" },
        { id: "c", name: "C", alive: true, room: "bay" },
        { id: "d", name: "D", alive: true, room: "hold" },
        { id: "e", name: "E", alive: true, room: "hold" },
      ],
    });
    renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    /* Long enough for several atmosphere lines, which have their own
       cooldown — this is deliberately not a tight loop. */
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 200); });
    const rooms = new Set(g.inRoom.map((l) => l.room));
    expect(rooms.has("bay")).toBe(true);
    expect(rooms.has("hold")).toBe(true);
  });

  it("falls back to the table for a game object with no api", () => {
    /* A Move with no room, or a game too old to carry an api, is
       correctly addressed to everybody. The fallback is behaviour,
       not padding. */
    const g = fakeGame();
    delete g.api;
    renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(g.said.length).toBeGreaterThan(0);
  });
});
