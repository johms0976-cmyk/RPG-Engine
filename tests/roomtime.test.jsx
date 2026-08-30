// @vitest-environment jsdom
/* ============================================================
   WHERE THE TIME WENT.

   `tests/analytics.test.js` reads a world that already has
   `roomTime` on it. This makes one by playing, because the part
   that can rot is not the arithmetic — it is whether `commitW`
   is still the choke point every room change goes through.

   Nine call sites move the party. If a tenth is ever added that
   writes `wRef.current.room` directly instead of going through
   `commitW`, every test in the other file still passes and the
   report quietly stops counting one of the ways a crew can walk
   into a room. This is the test that fails.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGame } from "../src/engine/useGame.js";
import { sessionReport } from "../src/engine/analytics.js";
import { makeCharacter, rollStats } from "../src/engine/rules.js";
import mod from "../src/modules/ypsilon14/index.js";

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

const mkPc = (name) => makeCharacter(
  { name, cls: "teamster", stats: rollStats(), skills: [], loadout: Object.keys(mod.loadouts)[0] },
  mod,
);

async function started() {
  const hook = renderHook(() => useGame(mod, { slot: "roomtime" }));
  await act(async () => {
    hook.result.current.begin([mkPc("RILEY")]);
    await vi.advanceTimersByTimeAsync(200);
  });
  return hook;
}

/** Walk to the first room an exit leads to, whatever the module is. */
async function stepOnce(hook) {
  const g = hook.result.current;
  const here = g.mod.rooms[g.w.room];
  const exit = (here.exits || []).find(
    (e) => !String(e.to).startsWith("@") && !e.gate && g.mod.rooms[e.to],
  );
  if (!exit) return null;
  await act(async () => {
    g.doMove(exit);
    await vi.advanceTimersByTimeAsync(400);
  });
  return exit.to;
}

describe("a session that actually moves", () => {
  it("starts with the clock parked where the party is", async () => {
    const hook = await started();
    expect(hook.result.current.w.roomTime).toEqual({});
    expect(hook.result.current.w.roomSince).toBe(0);
  });

  it("banks the minutes against the room being LEFT", async () => {
    const hook = await started();
    const from = hook.result.current.w.room;
    const to = await stepOnce(hook);
    expect(to).toBeTruthy();

    const w = hook.result.current.w;
    expect(w.room).toBe(to);
    /* Every exit in this module costs time, so the room they left
       cannot be zero. The exact figure is the module's `mins` plus
       whatever the walk cost, which is not this test's business. */
    expect(w.roomTime[from]).toBeGreaterThan(0);
    expect(w.roomSince).toBe(w.clock);
  });

  it("keeps banking across several moves without losing any", async () => {
    const hook = await started();
    const seen = [hook.result.current.w.room];
    for (let i = 0; i < 3; i += 1) {
      const to = await stepOnce(hook);
      if (!to) break;
      seen.push(to);
    }
    const w = hook.result.current.w;
    /* Time banked plus time still open in the current room is the
       whole clock. A move that forgot to bank would lose a chunk and
       this is the only assertion that would notice. */
    const banked = Object.values(w.roomTime).reduce((a, n) => a + n, 0);
    const open = w.clock - w.roomSince;
    expect(banked + open).toBe(w.clock);
    expect(seen.length).toBeGreaterThan(1);
  });

  it("reaches the report, including the room they are standing in", async () => {
    const hook = await started();
    await stepOnce(hook);
    const g = hook.result.current;
    const report = sessionReport(g.mod, g.w, g.feed);

    /* Nothing is lost between the world and the report: the minutes
       add up to the clock. */
    const total = report.rooms.reduce((a, r) => a + r.minutes, 0);
    expect(total).toBe(g.w.clock);

    /* The room they are standing in has never been left, so its
       minutes come only from the open span `sessionReport` adds.
       Immediately after arriving that span is legitimately zero —
       no time has passed yet — so the assertion is that the report
       agrees with the world rather than that it is positive. */
    const here = report.rooms.find((r) => r.id === g.w.room);
    expect(here.minutes).toBe(g.w.clock - g.w.roomSince);
  });
});
