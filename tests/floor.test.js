/* ============================================================
   THE FLOOR, TESTED.

   Three kinds of test here, and the third is the one that matters
   most in a year's time.

   1. The ledger and the scoring, as arithmetic.
   2. The levers, including the ones that must *not* fire — a
      brake that engages when it should not is worse than no
      brake, because it is unexplainable from the sofa.
   3. Two invariants read off the source tree, in the manner of
      tests/offline.test.js: the scoring never reaches a screen,
      and the tap report exists in both routers. Both are promises
      the comments make, and a promise in a comment decays.
   ============================================================ */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_FLOOR, floorOf,
  recordAct, recordSwallow, recordOffer, recordDecline, resetFloor,
  weightOf, sharesOf, isMuted, starvationOf, mostStarved, stampede,
  starvationOrder, floorVerdict, floorMove,
  MUTE_AFTER, RUNAWAY_LEAD, FLOOR_HOLD_MS, SWALLOW_SECONDS, STARVE_SCORE,
  OFFER_COOLDOWN_MS, MOVE_COOLDOWN_MS, BURST_ACTS, MINUTE_WEIGHT,
} from "../src/engine/floor.js";
import { makeScene, tempoVerdict, WAIT_TEXT } from "../src/engine/tempo.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOW = 1_700_000_000_000;

const crewOf = (...ids) => ids.map((id) => ({ id, name: id.toUpperCase(), alive: true }));
const world = (floor = {}, tempo = null) => ({
  floor: { ...DEFAULT_FLOOR, on: true, since: NOW - 600_000, ...floor },
  tempo: tempo || undefined,
});

describe("the ledger", () => {
  it("defaults to off, and reads through a world that has never heard of it", () => {
    expect(DEFAULT_FLOOR.on).toBe(false);
    expect(floorOf({}).on).toBe(false);
    expect(floorOf(undefined).acts).toEqual({});
    expect(floorOf({ floor: { on: true } }).on).toBe(true);
  });

  it("counts acts, stamps the time, and feeds the burst window", () => {
    let f = floorOf({});
    f = recordAct(f, "riley", NOW);
    f = recordAct(f, "riley", NOW + 1000);
    expect(f.acts.riley).toBe(2);
    expect(f.last.riley).toBe(NOW + 1000);
    expect(f.burst).toHaveLength(2);
  });

  it("counts swallowed taps separately from acts", () => {
    const f = recordSwallow(floorOf({}), "dana", NOW);
    expect(f.swallowed.dana).toBe(1);
    expect(f.acts.dana).toBeUndefined();
    expect(f.last.dana).toBeUndefined();
  });

  it("never mutates what it is given", () => {
    const f = floorOf({});
    const before = JSON.stringify(f);
    recordAct(f, "riley", NOW);
    recordSwallow(f, "riley", NOW);
    recordDecline(f, "riley");
    expect(JSON.stringify(f)).toBe(before);
  });

  it("resets volume on a round, and keeps consent", () => {
    let f = floorOf({});
    f = recordAct(f, "riley", NOW);
    f = recordSwallow(f, "dana", NOW);
    f = recordDecline(f, "dana");
    f = resetFloor(f, NOW + 5000);
    expect(f.acts).toEqual({});
    expect(f.swallowed).toEqual({});
    expect(f.burst).toEqual([]);
    expect(f.declines.dana).toBe(1);   // the thing that must survive
    expect(f.since).toBe(NOW + 5000);
  });

  it("stops asking after two declines, and not before", () => {
    let f = floorOf({});
    for (let i = 0; i < MUTE_AFTER - 1; i += 1) f = recordDecline(f, "dana");
    expect(isMuted(f, "dana")).toBe(false);
    f = recordDecline(f, "dana");
    expect(isMuted(f, "dana")).toBe(true);
  });
});

describe("weight and share", () => {
  it("counts minutes at a discount, read off the scene's own ledger", () => {
    const w = world({ acts: { riley: 2 } }, { scene: { order: ["riley"], idx: 0, cost: { riley: 20 } } });
    expect(weightOf(w, "riley")).toBeCloseTo(2 + 20 * MINUTE_WEIGHT);
  });

  it("is 1.0 each when the room is shared evenly", () => {
    const w = world({ acts: { riley: 3, dana: 3 } });
    const s = sharesOf(w, crewOf("riley", "dana"));
    expect(s.riley).toBeCloseTo(1);
    expect(s.dana).toBeCloseTo(1);
  });

  it("ignores the dead, who are not being left out of anything", () => {
    const w = world({ acts: { riley: 4 } });
    const crew = [...crewOf("riley"), { id: "dana", alive: false }];
    expect(Object.keys(sharesOf(w, crew))).toEqual(["riley"]);
  });
});

describe("starvation", () => {
  it("scores silence in seconds", () => {
    const w = world({ last: { dana: NOW - 200_000 } });
    expect(starvationOf(w, crewOf("dana"), NOW).dana).toBeCloseTo(200);
  });

  it("weights an eaten tap far above the same silence", () => {
    const quiet = world({ last: { dana: NOW - 30_000 } });
    const outrun = world({ last: { dana: NOW - 30_000 }, swallowed: { dana: 1 } });
    const a = starvationOf(quiet, crewOf("dana"), NOW).dana;
    const b = starvationOf(outrun, crewOf("dana"), NOW).dana;
    expect(b - a).toBe(SWALLOW_SECONDS);
  });

  it("is zero for whoever is holding the room", () => {
    const w = world(
      { last: { dana: NOW - 500_000 } },
      { scene: { order: ["dana", "riley"], idx: 0 } },
    );
    expect(starvationOf(w, crewOf("dana", "riley"), NOW).dana).toBe(0);
  });

  it("is zero for somebody who has told us twice they are happy watching", () => {
    const w = world({ last: { dana: NOW - 500_000 }, declines: { dana: MUTE_AFTER } });
    expect(starvationOf(w, crewOf("dana"), NOW).dana).toBe(0);
    expect(mostStarved(w, crewOf("dana"), NOW)).toBe(null);
  });

  it("names nobody below the threshold", () => {
    const w = world({ last: { dana: NOW - (STARVE_SCORE - 10) * 1000 } });
    expect(mostStarved(w, crewOf("dana"), NOW)).toBe(null);
  });

  it("picks the quietest when several qualify", () => {
    const w = world({ last: { dana: NOW - 200_000, kit: NOW - 400_000 } });
    expect(mostStarved(w, crewOf("dana", "kit"), NOW)).toBe("kit");
  });
});

describe("lever 1 — the ring's order", () => {
  it("opens the round with whoever has had least of it", () => {
    const crew = crewOf("riley", "dana", "kit");
    const w = world({ last: { riley: NOW - 1000, dana: NOW - 300_000, kit: NOW - 90_000 } });
    const scene = makeScene(crew, null, starvationOrder(w, crew, NOW));
    expect(scene.order).toEqual(["dana", "kit", "riley"]);
  });

  it("leaves crew order alone when no comparator is passed", () => {
    const crew = crewOf("riley", "dana", "kit");
    expect(makeScene(crew, null).order).toEqual(["riley", "dana", "kit"]);
  });

  it("breaks ties on crew order, so it cannot flicker", () => {
    const crew = crewOf("riley", "dana");
    const w = world({ last: {}, since: NOW - 100_000 });
    const a = makeScene(crew, null, starvationOrder(w, crew, NOW)).order;
    const b = makeScene(crew, null, starvationOrder(w, crew, NOW)).order;
    expect(a).toEqual(b);
    expect(a).toEqual(["riley", "dana"]);
  });
});

describe("lever 4 — the soft hold", () => {
  const runaway = (extra = {}) => world({
    acts: { riley: RUNAWAY_LEAD + 1, dana: 0 },
    last: { riley: NOW - 1000 },
    ...extra,
  });
  const crew = crewOf("riley", "dana");

  it("holds a runaway while somebody else is behind them", () => {
    expect(floorVerdict({ w: runaway(), pcId: "riley", crew, now: NOW })).toEqual({ wait: "floor" });
  });

  it("does nothing at all when the switch is off", () => {
    const w = runaway();
    w.floor.on = false;
    expect(floorVerdict({ w, pcId: "riley", crew, now: NOW })).toBe(null);
  });

  it("does nothing without a crew, so no existing caller changes meaning", () => {
    expect(floorVerdict({ w: runaway(), pcId: "riley", crew: null, now: NOW })).toBe(null);
  });

  it("does not hold when nobody else wants the floor", () => {
    const w = runaway({ declines: { dana: MUTE_AFTER } });
    expect(floorVerdict({ w, pcId: "riley", crew, now: NOW })).toBe(null);
  });

  it("does not hold the player who is behind", () => {
    expect(floorVerdict({ w: runaway(), pcId: "dana", crew, now: NOW })).toBe(null);
  });

  it("always releases — it is a beat, never a refusal", () => {
    const w = runaway();
    const later = NOW + FLOOR_HOLD_MS + 1;
    expect(floorVerdict({ w, pcId: "riley", crew, now: later })).toBe(null);
  });

  it("holds on one eaten tap even without a big lead", () => {
    const w = world({ acts: { riley: 1 }, last: { riley: NOW - 1000 }, swallowed: { dana: 1 } });
    expect(floorVerdict({ w, pcId: "riley", crew, now: NOW })).toEqual({ wait: "floor" });
  });

  it("is the weakest brake: a held table still says held", () => {
    const w = runaway();
    w.tempo = { held: true };
    const v = tempoVerdict({ w, action: "doSearch", pcId: "riley", crew, now: NOW });
    expect(v).toEqual({ wait: "held" });
  });

  it("reaches the phone through tempoVerdict, and never names anyone", () => {
    const v = tempoVerdict({ w: runaway(), action: "doSearch", pcId: "riley", crew, now: NOW });
    expect(v).toEqual({ wait: "floor" });
    expect(WAIT_TEXT.floor).toBeTruthy();
    expect(WAIT_TEXT.floor.toLowerCase()).not.toContain("riley");
  });

  it("never holds a free action — reading a handout is not a turn", () => {
    const v = tempoVerdict({ w: runaway(), action: "pinClue", pcId: "riley", crew, now: NOW });
    expect(v).toBe(null);
  });
});

describe("stampede detection", () => {
  const burst = (pcId, n, at = NOW) => Array.from({ length: n }, () => ({ pcId, at }));

  it("fires when one player carries a busy window", () => {
    const w = world({ burst: [...burst("riley", BURST_ACTS), ...burst("dana", 1)] });
    const s = stampede(w, crewOf("riley", "dana", "kit"), NOW);
    expect(s && s.pcId).toBe("riley");
  });

  it("does not fire when everybody is busy — that is a good minute", () => {
    const w = world({
      burst: [...burst("riley", 3), ...burst("dana", 3), ...burst("kit", 3)],
    });
    expect(stampede(w, crewOf("riley", "dana", "kit"), NOW)).toBe(null);
  });

  it("does not fire on a quiet window", () => {
    const w = world({ burst: burst("riley", BURST_ACTS - 1) });
    expect(stampede(w, crewOf("riley", "dana", "kit"), NOW)).toBe(null);
  });

  it("does not fire at a two-hander, where taking turns is automatic", () => {
    const w = world({ burst: burst("riley", BURST_ACTS + 4) });
    expect(stampede(w, crewOf("riley", "dana"), NOW)).toBe(null);
  });

  it("forgets a burst once its window has passed", () => {
    const w = world({ burst: burst("riley", BURST_ACTS + 4) });
    expect(stampede(w, crewOf("riley", "dana", "kit"), NOW + 120_000)).toBe(null);
  });
});

describe("the policy", () => {
  const crew = crewOf("riley", "dana", "kit");

  it("says nothing when the switch is off", () => {
    const w = world({ last: { dana: NOW - 500_000 } });
    w.floor.on = false;
    expect(floorMove({ w, crew, now: NOW })).toBe(null);
  });

  it("says nothing on a healthy table", () => {
    const w = world({ acts: { riley: 2, dana: 2, kit: 2 }, last: { riley: NOW, dana: NOW, kit: NOW } });
    expect(floorMove({ w, crew, now: NOW })).toBe(null);
  });

  it("offers the floor to whoever has been left out", () => {
    const w = world({ last: { riley: NOW, dana: NOW, kit: NOW - 500_000 } });
    const m = floorMove({ w, crew, now: NOW });
    expect(m).toMatchObject({ kind: "spotlight", pcId: "kit" });
    expect(m.text).toBeTruthy();
  });

  it("does not offer the same person twice inside the cooldown", () => {
    const w = world({
      last: { riley: NOW, dana: NOW, kit: NOW - 500_000 },
      offered: { kit: NOW - 1000 },
    });
    expect(floorMove({ w, crew, now: NOW })).toBe(null);
    const later = NOW + OFFER_COOLDOWN_MS;
    expect(floorMove({ w, crew, now: later })).toMatchObject({ kind: "spotlight", pcId: "kit" });
  });

  it("opens a round on a stampede, which names nobody", () => {
    const w = world({
      burst: Array.from({ length: BURST_ACTS + 2 }, () => ({ pcId: "riley", at: NOW })),
      last: { riley: NOW },
    });
    expect(floorMove({ w, crew, now: NOW })).toEqual({ kind: "scene" });
  });

  it("does not open a round when one is already running", () => {
    const w = world(
      {
        burst: Array.from({ length: BURST_ACTS + 2 }, () => ({ pcId: "riley", at: NOW })),
        last: { riley: NOW, dana: NOW, kit: NOW },
      },
      { scene: { order: ["riley", "dana", "kit"], idx: 0 } },
    );
    expect(floorMove({ w, crew, now: NOW })).toBe(null);
  });

  it("holds its tongue between moves", () => {
    const w = world({ last: { riley: NOW, dana: NOW, kit: NOW - 500_000 } });
    expect(floorMove({ w, crew, now: NOW, lastMoveAt: NOW - 1000 })).toBe(null);
    expect(floorMove({ w, crew, now: NOW, lastMoveAt: NOW - MOVE_COOLDOWN_MS })).toBeTruthy();
  });
});

/* ============================================================
   THE PROMISES, ENFORCED

   Same technique as tests/offline.test.js, and for the same
   reason: these are claims made in comments and in the Warden's
   own UI copy, and nothing else is checking them.
   ============================================================ */

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
};

describe("rule 2 — no screen ever shows a ranking", () => {
  /** The scoring functions. `floorOf` is exempt: the Warden's tab
      reads it for the on/off switch and nothing else. */
  const SCORING = ["sharesOf", "starvationOf", "weightOf", "mostStarved", "stampede"];

  it("is not imported by anything in src/ui or src/screens", () => {
    const files = [
      ...walk(join(ROOT, "src", "ui")),
      ...walk(join(ROOT, "src", "screens")),
    ];
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const imports = [...src.matchAll(/import\s+\{([^}]*)\}\s+from\s+["'][^"']*floor\.js["']/g)];
      for (const m of imports) {
        for (const name of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0])) {
          if (SCORING.includes(name)) offenders.push(`${file}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("puts no per-player count on the wire beyond the ledger itself", () => {
    // `why: "floor"` is the entire vocabulary a phone is given.
    expect(WAIT_TEXT.floor).not.toMatch(/\d/);
  });
});

describe("both routers learned the same word", () => {
  it("forwards a swallowed-tap report, with ownership from the router", () => {
    for (const rel of ["server/host.mjs", "src/net/rtcRelay.js"]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/"tap"/);
      // The character must come from the router's own record of the
      // client, never from the message — same rule as an intent.
      expect(src, rel).toMatch(/asPc:\s*(me\.pcId|c\.pcId)/);
    }
  });
});
