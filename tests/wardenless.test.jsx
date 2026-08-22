// @vitest-environment jsdom
/* ============================================================
   THE EMPTY CHAIR, WIRED.

   engine/director.js is tested as arithmetic in
   tests/director.test.js. This is the half with hands: does a
   Move actually reach the engine, does assisted mode really
   propose rather than act, and is the deck really unreachable.

   That last one is the test worth having. "The host device shows
   the table screen and nothing else" is a sentence in a design
   doc until something checks it, and the failure it guards
   against is not a crash — it is one person quietly knowing
   where the creature is while they are also playing.
   ============================================================ */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";

import { useDirector, DIRECTOR_TICK_MS, SUGGESTION_MS } from "../src/net/useDirector.js";
import HostBar from "../src/net/HostBar.jsx";
import { TABLE_MODES, packSnapshot } from "../src/net/protocol.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";

const MOD = {
  id: "t", title: "T",
  rooms: { bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} } },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: {},
};

/** A game stub: enough surface for the director to act on, and a
    record of everything it was asked to do. */
function fakeGame() {
  const said = [];
  const effects = [];
  return {
    said, effects,
    mod: MOD,
    w: {
      room: "bay", clock: 0, visited: { bay: true },
      threats: {}, countdowns: {}, flags: {}, oracleMemory: {},
      floor: { ...DEFAULT_FLOOR },
    },
    crew: [{ id: "riley", name: "RILEY", alive: true }],
    feed: [],
    combat: null,
    pending: null,
    warden: { say: (text, tone) => said.push({ text, tone }), scene: () => {} },
    runEffects: (list) => effects.push(list),
    whisperTo: () => {},
    floorNote: () => {},
  };
}

describe("the director, given hands", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does nothing at all while disabled", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: false }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 6); });
    expect(result.current.move).toBe(null);
    expect(g.said).toEqual([]);
  });

  it("proposes rather than acts when a Warden is there", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: false }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(result.current.move).toBeTruthy();
    // The whole point of assisted mode: nothing reached the engine.
    expect(g.said).toEqual([]);
  });

  it("acts without asking when the chair is empty", () => {
    const g = fakeGame();
    renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(g.said.length).toBeGreaterThan(0);
    expect(g.said[0].text).toBeTruthy();
  });

  it("holds one suggestion, never a queue", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    const first = result.current.move;
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 3); });
    expect(result.current.move).toBe(first);
  });

  it("lets an unanswered suggestion go stale rather than nagging", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(result.current.move).toBeTruthy();
    act(() => { vi.advanceTimersByTime(SUGGESTION_MS + DIRECTOR_TICK_MS); });
    // It may have been replaced, but it is not the same stale one.
    expect(result.current.move === null || result.current.move.at > 0).toBe(true);
  });

  it("routes a taken Move to the engine, and only then", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    const move = result.current.move;
    expect(g.said).toEqual([]);
    act(() => { result.current.take(move); });
    expect(g.said.length).toBe(1);
    expect(result.current.move).toBe(null);
  });

  it("drops a dismissed Move without touching the engine", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    act(() => { result.current.dismiss(); });
    expect(result.current.move).toBe(null);
    expect(g.said).toEqual([]);
  });

  it("fires an escalation through the module's own applier", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { result.current.take({ kind: "escalate", effects: [{ say: "It begins." }] }); });
    expect(g.effects).toEqual([[{ say: "It begins." }]]);
  });

  it("names who for a spotlight and lets the host do the routing", () => {
    const g = fakeGame();
    const spots = [];
    const { result } = renderHook(() => useDirector({
      g, mod: MOD, enabled: true, onSpotlight: (pcId, text) => spots.push({ pcId, text }),
    }));
    act(() => { result.current.take({ kind: "spotlight", pcId: "riley", text: "A gap opens." }); });
    expect(spots).toEqual([{ pcId: "riley", text: "A gap opens." }]);
  });

  it("never surfaces a decision to do nothing as a suggestion", () => {
    const g = fakeGame();
    g.pending = { kind: "roll", req: { pcId: "riley" } };   // rung 2: wait
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(result.current.move).toBe(null);
  });

  it("stops everything for the safety card, and proposes nothing", () => {
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({
      g, mod: MOD, enabled: true, auto: true, safetyCall: { level: "stop" },
    }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 30); });
    expect(result.current.move).toBe(null);
    expect(g.said).toEqual([]);
  });
});

describe("the lock — no route to the deck when nobody is the Warden", () => {
  const bar = (onView) => render(
    <HostBar
      view="table" onView={onView} status="open" peers={[]} crew={[]}
      pending={0} distorted={0} activity={[]} onWhisper={() => {}}
    />,
  );

  it("offers the three views on an ordinary hosted table", () => {
    bar(() => {});
    expect(screen.queryByText("Warden")).toBeTruthy();
    expect(screen.queryByText("Table")).toBeTruthy();
  });

  it("renders no switcher at all when there is no Warden", () => {
    bar(null);
    // Absent, not disabled and not hidden: a disabled control is one
    // devtools attribute away from being pressed.
    expect(screen.queryByText("Warden")).toBeNull();
    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.queryByText(/^Board/)).toBeNull();
  });
});

describe("the mode travels", () => {
  it("is one of two, and defaults to the way it always worked", () => {
    expect(TABLE_MODES).toEqual(["warden", "wardenless"]);
    const snap = packSnapshot({ seq: 1, phase: "lobby", mod: MOD, g: null, claims: {}, roster: [] });
    expect(snap.mode).toBe("warden");
  });

  it("tells the phones when nobody is coming", () => {
    const snap = packSnapshot({
      seq: 1, phase: "lobby", mod: MOD, g: null, claims: {}, roster: [],
      mode: "wardenless", ready: { c1: true },
    });
    expect(snap.mode).toBe("wardenless");
    expect(snap.ready).toEqual({ c1: true });
  });

  it("refuses a mode it does not know rather than passing it on", () => {
    const snap = packSnapshot({
      seq: 1, phase: "lobby", mod: MOD, g: null, claims: {}, roster: [], mode: "anarchy",
    });
    expect(snap.mode).toBe("warden");
  });

  it("carries no character data on the ready map", () => {
    const snap = packSnapshot({
      seq: 1, phase: "lobby", mod: MOD, g: null, claims: {}, roster: [],
      mode: "wardenless", ready: { c1: true, c2: false },
    });
    for (const v of Object.values(snap.ready)) expect(typeof v).toBe("boolean");
  });
});
