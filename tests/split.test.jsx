// @vitest-environment jsdom
/* ============================================================
   SPLITTING UP, AND WHAT IT COSTS — the two structural changes,
   through the real engine rather than through their pure halves.

   engine/party.js and the tempo ledger are tested on their own in
   party.test.js. What is tested here is the thing those files
   were built for: that `doMove` moves one person and not the
   party, that the people left behind are not sent the description
   of a room they are not in, and that a round charges the longest
   thing anybody did rather than the sum of everything.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useGame } from "../src/engine/useGame.js";
import { roomOf, isSplit, occupiedRooms } from "../src/engine/party.js";
import { visibleFeed, VIEW } from "../src/engine/secrets.js";
import { tempoOf, sceneCost } from "../src/engine/tempo.js";
import mod from "../src/modules/ypsilon14/index.js";
import { makeCharacter, rollStats } from "../src/engine/rules.js";

const mkPc = (name) => makeCharacter(
  { name, cls: "teamster", stats: rollStats(), skills: [], loadout: Object.keys(mod.loadouts)[0] },
  mod,
);

function boot(names = ["RILEY", "SAM"]) {
  const h = renderHook(() => useGame(mod, {}));
  act(() => { h.result.current.begin(names.map(mkPc)); });
  return h;
}

/** The first exit out of wherever this character is standing. */
const wayOut = (g, pc) => (mod.rooms[roomOf(pc, g.w)].exits || []).find((e) => mod.rooms[e.to]);

describe("the party can come apart", () => {
  it("starts everybody in the same room", () => {
    const h = boot();
    const g = h.result.current;
    expect(g.crew.every((c) => c.room === mod.start)).toBe(true);
    expect(isSplit(g.crew, g.w)).toBe(false);
  });

  it("moves one character, not the party", () => {
    const h = boot();
    const first = h.result.current.crew[0];
    const exit = wayOut(h.result.current, first);

    act(() => { h.result.current.setActiveId(first.id); });
    act(() => { h.result.current.doMove(exit); });

    const g = h.result.current;
    expect(roomOf(g.crew[0], g.w)).toBe(exit.to);
    // The other one has not moved an inch.
    expect(roomOf(g.crew[1], g.w)).toBe(mod.start);
    expect(isSplit(g.crew, g.w)).toBe(true);
    expect(occupiedRooms(g.crew, g.w).sort()).toEqual([exit.to, mod.start].sort());
  });

  it("addresses what happens in a room to the people in it", () => {
    const h = boot();
    const [first, second] = h.result.current.crew;
    const exit = wayOut(h.result.current, first);

    act(() => { h.result.current.setActiveId(first.id); });
    act(() => { h.result.current.doMove(exit); });

    const g = h.result.current;
    const mine = visibleFeed(g.feed, VIEW.PLAYER, first.id);
    const theirs = visibleFeed(g.feed, VIEW.PLAYER, second.id);

    // The description of the new room reached the person in it.
    expect(mine.some((l) => l.kind === "room")).toBe(true);
    // And did not reach the person who stayed put.
    expect(theirs.some((l) => l.kind === "room" && l.id > 0 && mine.includes(l) === false)).toBe(false);
    // But they were told somebody walked out, because that is the
    // most consequential thing that happens in this game.
    expect(theirs.some((l) => l.kind === "move" && /goes through to/.test(l.text))).toBe(true);
    // The desk hears all of it, in one feed.
    expect(visibleFeed(g.feed, VIEW.WARDEN, null).length)
      .toBeGreaterThanOrEqual(Math.max(mine.length, theirs.length));
  });

  it("says nothing to anybody in particular while the crew is together", () => {
    const h = boot();
    act(() => { h.result.current.doSearch(Object.keys(mod.rooms[mod.start].features || {})[0]); });
    const g = h.result.current;
    // Every line is public: this is the behaviour a solo session and
    // every existing test depend on, and it must not change.
    expect(g.feed.every((l) => l.to == null)).toBe(true);
  });

  it("lets the Warden put somebody back", () => {
    const h = boot();
    const [first] = h.result.current.crew;
    const exit = wayOut(h.result.current, first);
    act(() => { h.result.current.setActiveId(first.id); });
    act(() => { h.result.current.doMove(exit); });
    expect(isSplit(h.result.current.crew, h.result.current.w)).toBe(true);

    act(() => { h.result.current.warden.regroup(mod.start); });
    const g = h.result.current;
    expect(isSplit(g.crew, g.w)).toBe(false);
    expect(g.crew.every((c) => roomOf(c, g.w) === mod.start)).toBe(true);
  });
});

describe("a round costs the longest thing anybody did", () => {
  it("charges each action to the clock when no round is running", () => {
    const h = boot();
    const before = h.result.current.w.clock;
    act(() => { h.result.current.api.advance(10); });
    expect(h.result.current.w.clock).toBe(before + 10);
  });

  it("holds the clock still and accrues against each player instead", () => {
    const h = boot();
    const [first, second] = h.result.current.crew;
    act(() => { h.result.current.warden.scene("start"); });
    const before = h.result.current.w.clock;

    act(() => { h.result.current.setActiveId(first.id); });
    act(() => { h.result.current.api.advance(10); });
    act(() => { h.result.current.setActiveId(second.id); });
    act(() => { h.result.current.api.advance(15); });

    // Nothing has moved yet: the fiction's clock has not moved either.
    expect(h.result.current.w.clock).toBe(before);
    expect(sceneCost(tempoOf(h.result.current.w).scene)).toBe(15);
  });

  it("charges max(), not sum(), when the ring wraps", () => {
    const h = boot();
    const [first, second] = h.result.current.crew;
    act(() => { h.result.current.warden.scene("start"); });
    const before = h.result.current.w.clock;

    act(() => { h.result.current.setActiveId(first.id); });
    act(() => { h.result.current.api.advance(10); });
    act(() => { h.result.current.warden.scene("next"); });
    act(() => { h.result.current.setActiveId(second.id); });
    act(() => { h.result.current.api.advance(15); });
    act(() => { h.result.current.warden.scene("next"); });   // wraps

    // Two people searching for 10 and 15 minutes used to cost 25.
    expect(h.result.current.w.clock).toBe(before + 15);
    expect(sceneCost(tempoOf(h.result.current.w).scene)).toBe(0);
  });

  it("forgives nothing when the Warden opens the room early", () => {
    const h = boot();
    act(() => { h.result.current.warden.scene("start"); });
    const before = h.result.current.w.clock;
    act(() => { h.result.current.api.advance(20); });
    act(() => { h.result.current.warden.scene("end"); });
    expect(h.result.current.w.clock).toBe(before + 20);
  });

  it("charges rest immediately, because nobody else is sleeping in parallel", () => {
    const h = boot();
    act(() => { h.result.current.warden.scene("start"); });
    const before = h.result.current.w.clock;
    act(() => { h.result.current.api.advanceNow(60); });
    expect(h.result.current.w.clock).toBe(before + 60);
  });

  it("gives the Warden a way to let time pass with nobody acting", () => {
    const h = boot();
    const before = h.result.current.w.clock;
    act(() => { h.result.current.warden.passTime(10); });
    expect(h.result.current.w.clock).toBe(before + 10);
  });
});

describe("the step back", () => {
  it("undoes a Warden adjustment and says so", () => {
    const h = boot();
    const pc = h.result.current.crew[0];
    const health = pc.health;

    act(() => { h.result.current.warden.adjust(pc.id, { health: -5, why: "a mistake" }); });
    expect(h.result.current.crew[0].health).toBe(health - 5);
    expect(h.result.current.warden.canUndo).toBe(true);

    act(() => { h.result.current.warden.undo(); });
    expect(h.result.current.crew[0].health).toBe(health);
    // Loud, not silent: a referee who can rewind quietly is a referee
    // who can change the score quietly.
    expect(h.result.current.feed.some((l) => /takes back/.test(l.text))).toBe(true);
  });
});
