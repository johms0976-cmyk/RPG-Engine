/* ============================================================
   THE PRESSURE RUNG, AND THE ARGUMENT NOBODY PASSED IT.

   `rungPressure` has always taken `lastActedAt` and `useDirector`
   — the only caller of `directorPlan` in the app — never supplied
   one. `directorPlan` defaults it to 0 and the rung opens with
   `if (!lastActedAt) return null`, so the rung could not fire in
   the shipped app: not in any module, not at any stall length.

   That is the same shape of bug as the automatic-weapons one in
   the playtest report's §3 — a rule implemented, reachable in a
   unit test, and doing nothing at a table — and it is why the
   wardenless finding in §6 read as "atmosphere and no pressure".
   Dead Weight's `director.pressure` is `prowl`, its only threat
   movement. §1 stopped `prowl` throwing. It still never ran.

   The unit tests for this rung passed throughout, because they
   call the rung directly and pass `lastActedAt` themselves. So
   the assertion that matters is the wiring one at the bottom.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  directorPlan, rungPressure, PRESSURE_STALL_MS,
} from "../src/engine/director.js";

const NOW = 1_700_000_000_000;

const MOD = {
  id: "t", title: "T",
  rooms: { bay: { name: "BAY", look: "cold", tags: [], exits: [], features: {} } },
  threats: { it: { name: "IT", unseen: true } },
  director: { pressure: "prowl" },
  hooks: { prowl: () => {} },
};

const W = (patch = {}) => ({
  room: "bay", clock: 0, visited: { bay: true },
  flags: {}, threats: {}, countdowns: {}, clocks: {}, tracks: {},
  meters: {}, oracleMemory: {}, ...patch,
});

const crew = [{ id: "a", name: "A", alive: true }];

describe("rungPressure", () => {
  it("declines before the stall threshold", () => {
    expect(rungPressure({
      mod: MOD, w: W(), now: NOW, lastActedAt: NOW - PRESSURE_STALL_MS + 1000,
    })).toBe(null);
  });

  it("asks the module to move its threat once the table has gone quiet", () => {
    const m = rungPressure({
      mod: MOD, w: W(), now: NOW, lastActedAt: NOW - PRESSURE_STALL_MS,
    });
    expect(m).toMatchObject({ kind: "pressure", rung: "pressure", run: "prowl" });
  });

  it("declines for a module with no pressure hook, however long the silence", () => {
    expect(rungPressure({
      mod: { ...MOD, director: {} }, w: W(), now: NOW, lastActedAt: NOW - 60 * 60 * 1000,
    })).toBe(null);
  });

  /* THE ONE THAT WOULD HAVE CAUGHT IT.

     Not "does the rung work" but "can the rung be reached". A zero
     `lastActedAt` is indistinguishable from a table that has never
     acted, which is why this failed open rather than loudly. */
  it("is unreachable through directorPlan when lastActedAt is not supplied", () => {
    const plan = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      /* everything a stalled table would have EXCEPT lastActedAt */
      startedAt: NOW - 20 * 60 * 1000,
      lastLineAt: NOW - 10 * 60 * 1000,
      lastAtmosphereAt: NOW - 10 * 60 * 1000,
    });
    expect(plan && plan.rung).not.toBe("pressure");
  });

  it("is reached through directorPlan once it is", () => {
    const plan = directorPlan({
      mod: MOD, w: W(), crew, now: NOW,
      startedAt: NOW - 20 * 60 * 1000,
      lastActedAt: NOW - PRESSURE_STALL_MS,
      lastLineAt: NOW - 10 * 60 * 1000,
      lastAtmosphereAt: NOW - 10 * 60 * 1000,
    });
    expect(plan).toMatchObject({ kind: "pressure", rung: "pressure" });
  });
});

describe("useDirector wiring", () => {
  /* A source assertion rather than a behavioural one, deliberately.
     The behaviour needs a mounted hook, a fake timer and a stalled
     game to observe, and all three would make this test about
     React. What went wrong was one missing line in an object
     literal, and this is the cheapest thing that fails when it goes
     missing again. */
  const src = readFileSync(new URL("../src/net/useDirector.js", import.meta.url), "utf8");

  it("passes lastActedAt into directorPlan", () => {
    expect(src).toMatch(/lastActedAt:\s*lastActedAt\.current/);
  });

  it("tracks it off the fiction clock, not the feed", () => {
    /* The feed is the wrong signal: the director's own atmosphere
       lines are feed lines, so a stalled table would keep resetting
       its stall timer with the scenery it was being given. */
    expect(src).toMatch(/lastActedAt\s*=\s*useRef\(0\)/);
    expect(src).toMatch(/clockNow/);
  });
});
