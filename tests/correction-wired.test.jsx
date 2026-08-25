// @vitest-environment jsdom
/* ============================================================
   THE CORRECTION, WITH HANDS.

   `tests/party-review.test.js` tests the quorum arithmetic.
   This is the half that would catch the failure that arithmetic
   cannot see, and it is the SAME failure three features in this
   repository have already shipped with:

     · `sessionEndsAt` — rung, plan parameter, hook parameter,
       four green assertions, and no producer.
     · `floor.on` — a complete scoring file whose only switch was
       on a screen wardenless mode locks away.
     · `C_DISPUTE` — a protocol message, a relay case, a host
       handler and a ledger waiting for it, and NO SENDER
       ANYWHERE IN THE APPLICATION for three versions.

   Every one of those passed its unit tests. So the assertions
   below deliberately go through the hook, and then through the
   source, because a hook test cannot see an argument its own
   caller forgot and no test at all can see a button that was
   never drawn.

   See docs/INVARIANTS.md, INV-10.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";

import { useDirector, DIRECTOR_TICK_MS } from "../src/net/useDirector.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";
import { OBJECTION_VETOES } from "../src/engine/objection.js";
import { VETO_LIMIT } from "../src/engine/director.js";

const MOD = {
  id: "t",
  title: "T",
  rooms: {
    bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} },
  },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: {},
  npcs: {},
  endings: {},
};

function fakeGame() {
  const said = [];
  return {
    said,
    mod: MOD,
    w: {
      room: "bay", clock: 0, visited: { bay: true },
      threats: {}, countdowns: {}, flags: {}, oracleMemory: {},
      floor: { ...DEFAULT_FLOOR },
    },
    crew: [{ id: "riley", name: "RILEY", alive: true, room: "bay" }],
    feed: [],
    combat: null,
    pending: null,
    warden: { say: (text, tone) => said.push({ text, tone }), scene: () => {}, flag: () => {} },
    api: { sayIn: (room, tone, text) => said.push({ room, text, tone }) },
    say: (tone, text) => said.push({ text, tone }),
    runEffects: () => {},
    whisperTo: () => {},
    floorNote: () => {},
  };
}

describe("a table-level objection reaches the ladder", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  /** Run the director until it has taken a Move, then hand it a
      carried objection and report the ledger. */
  const runWith = (objection) => {
    const g = fakeGame();
    const { result, rerender } = renderHook(
      ({ obj }) => useDirector({ g, mod: MOD, enabled: true, auto: true, objection: obj }),
      { initialProps: { obj: null } },
    );
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 20); });
    rerender({ obj: objection() });
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS); });
    return result.current;
  };

  it("counts against whatever was last said, addressed or not", () => {
    /* THE WHOLE POINT. An atmosphere line carries no pcId, so
       nothing about it could ever reach the ledger before. */
    const r = runWith(() => ({ at: Date.now(), n: 2 }));
    const total = Object.values(r.objections || {}).reduce((a, b) => a + b, 0);
    expect(total).toBe(OBJECTION_VETOES);
  });

  it("ignores one that arrives long after the line it is about", () => {
    const r = runWith(() => ({ at: Date.now() - 10 * 60 * 1000, n: 2 }));
    expect(Object.keys(r.objections || {})).toHaveLength(0);
  });

  it("ignores the same objection twice", () => {
    const g = fakeGame();
    const { result, rerender } = renderHook(
      ({ obj }) => useDirector({ g, mod: MOD, enabled: true, auto: true, objection: obj }),
      { initialProps: { obj: null } },
    );
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 20); });
    /* Stamped now, next to the Move it is about. The same object
       is then handed over twice, which is what a re-render does. */
    const at = Date.now();
    rerender({ obj: { at, n: 2 } });
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS); });
    rerender({ obj: { at, n: 2 } });
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS); });
    const total = Object.values(result.current.objections || {}).reduce((a, b) => a + b, 0);
    expect(total).toBe(OBJECTION_VETOES);
  });

  it("changes nothing when the table never objects", () => {
    /* The load-bearing case, as ever. A table that says nothing
       gets a byte-identical ladder. */
    const g = fakeGame();
    const { result } = renderHook(() => useDirector({ g, mod: MOD, enabled: true, auto: true }));
    act(() => { vi.advanceTimersByTime(DIRECTOR_TICK_MS * 40); });
    expect(Object.keys(result.current.objections || {})).toHaveLength(0);
  });

  it("retires a rung in fewer waves than a lone player's disputes would", () => {
    /* Three carried objections against six personal disputes.
       Two people agreeing about a line said to both of them is
       stronger evidence than one person waving off one moment. */
    expect(VETO_LIMIT / OBJECTION_VETOES).toBeLessThan(6);
  });
});

describe("and the app actually hands it over", () => {
  /* THE GAP THAT LET THE OTHER THREE SHIP, CLOSED FOR THIS ONE.

     Crude source reading, in the same spirit as
     `tests/offline.test.js` grepping for `fetch`. Every
     sophisticated test above passes `objection` into the hook by
     hand — which is precisely what the four green assertions on
     `rungLastCall` did while `App.jsx` passed it nothing. */

  it("passes the host's carried objections into the director", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("objection: net.lastObjection");
  });

  it("publishes them from the host", () => {
    const host = readFileSync("src/net/useHost.js", "utf8");
    expect(host).toContain("lastObjection");
    expect(host).toContain('msg.t === "notthat"');
  });

  it("forwards them through the relay with an identity to count on", () => {
    const relay = readFileSync("src/net/rtcRelay.js", "utf8");
    expect(relay).toContain('case "notthat"');
    /* The pcId travels so two taps from one phone are not two
       people. It goes no further than the host. */
    expect(relay).toMatch(/case "notthat":[\s\S]{0,200}asPc/);
  });

  it("never puts a name on the record", () => {
    const host = readFileSync("src/net/useHost.js", "utf8");
    /* What is published is a count and a timestamp. Same
       reasoning as C_SAFETY and as rule 1 of the floor: a
       correction that identifies its author is a correction
       people stop making. */
    expect(host).toMatch(/setLastObjection\(\{\s*at:[^}]*n:\s*2\s*\}\)/);
    expect(host).not.toMatch(/setLastObjection\(\{[^}]*pcId/);
  });

  it("draws a button for both halves of the correction", () => {
    const shell = readFileSync("src/net/ClientShell.jsx", "utf8");
    const spot = readFileSync("src/ui/Spotlight.jsx", "utf8");
    expect(shell).toContain('t: "notthat"');
    expect(shell).toContain('t: "dispute"');
    /* INV-9: absent when there is nobody to hear it, rather than
       greyed out. A disabled control is one devtools attribute
       away from being pressed, which is the argument
       tests/wardenless.test.jsx makes about the deck switcher. */
    expect(spot).toContain("onNotMe");
    expect(spot).toMatch(/\{onNotMe && \(/);
    expect(spot).not.toMatch(/<button[^>]*disabled/);
  });
});

describe("the campaign record stays out of the way", () => {
  it("is read at exactly one place and never by the engine", () => {
    /* INV: a ledger, not a rule. A session inside a campaign must
       play identically to a session outside one, or nobody at the
       table can reason about why tonight is different. */
    const app = readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("campaign.js");
    for (const f of ["src/engine/director.js", "src/engine/useGame.js",
      "src/engine/effects.js", "src/engine/floor.js", "src/net/useDirector.js",
      "src/net/useHost.js"]) {
      expect(readFileSync(f, "utf8")).not.toContain("campaign.js");
    }
  });

  it("does not record from a player's copy of the ending", () => {
    /* Six phones each writing the same evening into six local
       campaigns is six different half-true records. The shared
       screen keeps the book. */
    const ending = readFileSync("src/screens/Ending.jsx", "utf8");
    expect(ending).toMatch(/if \(phone \|\| !campaignId\) return;/);
  });
});
