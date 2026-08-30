/* ============================================================
   TABLE ANALYTICS.

   The backlog asked for three things and the tests are organised
   around them: which rooms stall, which gates get brute-forced,
   which endings nobody reaches.

   The first of those is the one this file does NOT answer, and
   there is a test for that too — because a report that quietly
   omits a measurement is worse than one that says it cannot make
   it. See the header of engine/analytics.js.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { sessionReport, sessionDigest, tableReport } from "../src/engine/analytics.js";
import { defineModule } from "../src/engine/defineModule.js";

const mod = defineModule({
  id: "pack", title: "A COLD START", start: "hold",
  npcs: { cham: { name: "CHAM", start: "hold", knows: ["One.", "Two.", "Three."] } },
  handouts: { log: { label: "SHIFT REPORT", text: "…" } },
  endings: {
    out: { title: "AWAY", good: true, text: "…" },
    lost: { title: "STILL THERE", text: "…" },
  },
  rooms: {
    hold: {
      name: "CARGO HOLD", look: "Crates.",
      exits: [
        { to: "bridge", label: "Pressure door", gate: { flag: "bridge_open", roll: { stat: "strength", label: "THE DOOR" } } },
        { to: "@out", label: "Go" },
      ],
      features: { panel: { name: "Panel", d: "…" }, crates: { name: "Crates", d: "…" } },
    },
    bridge: {
      name: "BRIDGE", look: "Consoles.",
      exits: [{ to: "hold", label: "Back" }],
      features: { chair: { name: "Chair", d: "…" } },
    },
    vent: { name: "VENT", look: "Narrow.", exits: [{ to: "hold", label: "Down" }], features: {} },
  },
});

const door = (success, why = "THE DOOR") => ({
  clock: 10, who: "RILEY", label: "Strength", value: 60, target: 40,
  success, tags: ["door"], why,
});

const world = (over = {}) => ({
  visited: { hold: true },
  searched: {},
  flags: {},
  npcs: { cham: { met: false, told: [] } },
  handouts: {},
  rollLog: [],
  clock: 120,
  ended: null,
  ...over,
});

describe("one evening", () => {
  it("says which rooms were never reached", () => {
    const r = sessionReport(mod, world(), []);
    expect(r.rooms.find((x) => x.id === "hold").reached).toBe(true);
    expect(r.rooms.find((x) => x.id === "vent").reached).toBe(false);
  });

  it("says which were walked into and walked straight out of", () => {
    /* The question "which rooms stall" was reaching for, from the
       side the data actually supports. */
    const r = sessionReport(mod, world({ visited: { hold: true, bridge: true } }), []);
    expect(r.rooms.find((x) => x.id === "hold").passedThrough).toBe(true);
    expect(r.rooms.find((x) => x.id === "vent").passedThrough).toBe(false);
  });

  it("reports the minutes the party spent in each room", () => {
    /* Recorded by `commitW` rather than derived from the feed. 2.20.0
       shipped without this and said why; 2.21.0 instruments it. */
    const r = sessionReport(mod, world({
      roomTime: { hold: 40, bridge: 5 }, room: "vent", roomSince: 100, clock: 130,
      visited: { hold: true, bridge: true, vent: true },
    }), []);
    expect(r.rooms.find((x) => x.id === "hold").minutes).toBe(40);
    expect(r.rooms.find((x) => x.id === "bridge").minutes).toBe(5);
  });

  it("counts the room the session ENDED in, which was never left", () => {
    /* Without this the last room of every evening reads as zero
       minutes — wrong, and wrong in a way that looks like a finding. */
    const r = sessionReport(mod, world({
      roomTime: { hold: 40 }, room: "bridge", roomSince: 100, clock: 175,
      visited: { hold: true, bridge: true },
    }), []);
    expect(r.rooms.find((x) => x.id === "bridge").minutes).toBe(75);
  });

  it("marks a room the party sat in without touching anything", () => {
    const r = sessionReport(mod, world({
      roomTime: { hold: 45 }, room: "hold", roomSince: 45, clock: 45,
      visited: { hold: true },
    }), []);
    expect(r.rooms.find((x) => x.id === "hold").stalled).toBe(true);
  });

  it("does not mark a room they were busy in", () => {
    /* `stalled` is not a verdict. A long room where things were
       happening is a scene. */
    const r = sessionReport(mod, world({
      roomTime: { hold: 45 }, room: "hold", roomSince: 45, clock: 45,
      visited: { hold: true }, searched: { "hold:panel": true },
    }), []);
    expect(r.rooms.find((x) => x.id === "hold").stalled).toBe(false);
  });

  it("does not mark a quick room", () => {
    const r = sessionReport(mod, world({
      roomTime: { hold: 5 }, room: "vent", roomSince: 5, clock: 5, visited: { hold: true },
    }), []);
    expect(r.rooms.find((x) => x.id === "hold").stalled).toBe(false);
  });

  it("counts what a room offered against what was touched", () => {
    const r = sessionReport(mod, world({ searched: { "hold:panel": true } }), []);
    const hold = r.rooms.find((x) => x.id === "hold");
    expect(hold.features).toBe(2);
    expect(hold.touched).toBe(1);
    expect(hold.passedThrough).toBe(false);
  });
});

describe("gates", () => {
  it("counts the rolls a table spent on one lock", () => {
    /* The reason `tags` and `why` started being logged. The roll's
       `label` is the stat — "Strength (Athletics)" — which cannot
       tell two doors apart. */
    const r = sessionReport(mod, world({
      rollLog: [door(false), door(false), door(false), door(true)],
    }), []);
    expect(r.gates).toHaveLength(1);
    expect(r.gates[0]).toMatchObject({ label: "THE DOOR", rolls: 4, failed: 3, opened: true });
  });

  it("separates two locks that use the same stat", () => {
    const r = sessionReport(mod, world({
      rollLog: [door(false, "THE DOOR"), door(true, "THE HATCH")],
    }), []);
    expect(r.gates.map((g) => g.label).sort()).toEqual(["THE DOOR", "THE HATCH"]);
  });

  it("records a lock that was never opened", () => {
    const r = sessionReport(mod, world({ rollLog: [door(false), door(false)] }), []);
    expect(r.gates[0].opened).toBe(false);
  });

  it("ignores rolls that were not against a door", () => {
    const r = sessionReport(mod, world({
      rollLog: [{ ...door(true), tags: ["search"] }, { ...door(true), tags: undefined }],
    }), []);
    expect(r.gates).toEqual([]);
  });
});

describe("the cast", () => {
  it("counts what an NPC was written to say against what they got to say", () => {
    const r = sessionReport(mod, world({ npcs: { cham: { met: true, told: [0] } } }), []);
    expect(r.cast[0]).toMatchObject({ met: true, lines: 3, told: 1, unheard: 2 });
  });

  it("does not report more told than written", () => {
    /* `told` can carry both indices and text, so a naive length is
       capable of exceeding the list it came from. */
    const r = sessionReport(mod, world({ npcs: { cham: { met: true, told: [0, 1, 2, 3, 4] } } }), []);
    expect(r.cast[0].unheard).toBe(0);
    expect(r.cast[0].told).toBe(3);
  });
});

describe("the digest", () => {
  const report = sessionReport(mod, world({
    ended: "out",
    searched: { "hold:panel": true },
    rollLog: [door(false), door(true)],
    npcs: { cham: { met: true, told: [0] } },
  }), []);

  it("is counts and ids, and carries NO prose", () => {
    /* A campaign file gets pasted into chat windows. The miss
       backlog is verbatim things humans typed and stays in the
       session it came from. */
    const d = sessionDigest(report);
    const text = JSON.stringify(d);
    expect(typeof d.misses).toBe("number");
    expect(text).not.toContain("Crates");
    expect(text).not.toContain("RILEY");
  });

  it("keeps enough to answer the questions across sessions", () => {
    const d = sessionDigest(report);
    expect(d.ending).toBe("out");
    expect(d.rooms.find((r) => r.id === "hold")).toMatchObject({ reached: true, touched: 1 });
    expect(d.gates[0]).toMatchObject({ label: "THE DOOR", rolls: 2, opened: true });
  });

  it("survives having nothing to digest", () => {
    expect(sessionDigest(null)).toBeNull();
  });
});

describe("several evenings", () => {
  const digests = [
    sessionDigest(sessionReport(mod, world({ ended: "out", visited: { hold: true, bridge: true } }), [])),
    sessionDigest(sessionReport(mod, world({ ended: "out", visited: { hold: true } }), [])),
    sessionDigest(sessionReport(mod, world({
      ended: null, visited: { hold: true }, rollLog: [door(false), door(false), door(false)],
    }), [])),
  ];

  it("averages time over the evenings that got there, not over all of them", () => {
    /* A room reached once and dwelt in for an hour is not a
       twenty-minute room because two other sessions missed it. */
    const one = sessionDigest(sessionReport(mod, world({
      roomTime: { bridge: 60 }, room: "hold", roomSince: 60, clock: 60,
      visited: { hold: true, bridge: true },
    }), []));
    const two = sessionDigest(sessionReport(mod, world({ visited: { hold: true } }), []));
    const t = tableReport(mod, [one, two]);
    const bridge = t.rooms.find((r) => r.id === "bridge");
    expect(bridge.reached).toBe(1);
    expect(bridge.minutes).toBe(60);
    expect(bridge.perVisit).toBe(60);
  });

  it("names the rooms nobody has EVER reached", () => {
    /* The strongest signal in the report and the one that costs an
       author most when nobody tells them. */
    const t = tableReport(mod, digests);
    expect(t.rooms.find((r) => r.id === "vent").never).toBe(true);
    expect(t.rooms.find((r) => r.id === "hold").never).toBe(false);
    expect(t.rooms.find((r) => r.id === "bridge").reached).toBe(1);
  });

  it("names the endings nobody reaches", () => {
    const t = tableReport(mod, digests);
    expect(t.endings.find((e) => e.id === "out")).toMatchObject({ reached: 2, never: false });
    expect(t.endings.find((e) => e.id === "lost")).toMatchObject({ reached: 0, never: true });
  });

  it("adds up the work spent on a lock", () => {
    const t = tableReport(mod, digests);
    expect(t.gates[0]).toMatchObject({ label: "THE DOOR", rolls: 3, failed: 3, opened: 0 });
  });

  it("ignores evenings spent on a different module", () => {
    const other = { ...digests[0], modId: "somethingelse" };
    expect(tableReport(mod, [...digests, other]).sessions).toBe(3);
  });

  it("claims nothing about a table that has not played yet", () => {
    /* `never` on zero sessions would mark every room, every ending
       and every NPC as neglected on the strength of no evidence at
       all — a report that is loudest when it knows least. */
    const t = tableReport(mod, []);
    expect(t.sessions).toBe(0);
    expect(t.rooms.every((r) => r.never === false)).toBe(true);
    expect(t.endings.every((e) => e.never === false)).toBe(true);
  });

  it("survives rubbish in the record", () => {
    expect(() => tableReport(mod, [null, undefined, {}, { modId: "pack" }])).not.toThrow();
  });
});

describe("what it will not do", () => {
  it("grades nothing", () => {
    /* No score, no health, no traffic lights. A module where nobody
       found the third ending is not a worse module — it may be a
       module with an ending that costs something to reach. */
    const t = tableReport(mod, [sessionDigest(sessionReport(mod, world(), []))]);
    const text = JSON.stringify(t).toLowerCase();
    for (const word of ["score", "grade", "rating", "health", "should"]) {
      expect(text).not.toContain(word);
    }
  });
});
