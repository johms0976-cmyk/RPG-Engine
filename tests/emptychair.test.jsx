// @vitest-environment jsdom
/* ============================================================
   THE CARD, AND THE HANDS.

   Two things this covers, and they are the two that WARDENLESS.md
   promised in bold and `main` did not do:

     · a card actually holds the table, on every phone, and comes
       down from any of them
     · the executor routes every Move kind the ladder can produce,
       rather than dropping two of them into `default:`

   The second was the nastier bug of the pair, because it was not
   a no-op. `rungPressure` emitted a Move, the switch fell through,
   and the ladder had nonetheless *spent* rung 6 — so a real
   pressure beat suppressed the atmosphere line that would have run
   instead, and the table got silence exactly where it should have
   got the creature.
   ============================================================ */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act, fireEvent } from "@testing-library/react";

import { useDirector, DIRECTOR_TICK_MS } from "../src/net/useDirector.js";
import { packSnapshot } from "../src/net/protocol.js";
import { WhoseGo, SafetyBanner, TableVote, AskRoom } from "../src/net/TableControls.jsx";
import { openVote, castVote } from "../src/engine/vote.js";
import { DEFAULT_FLOOR } from "../src/engine/floor.js";

const NOW = 1_700_000_000_000;

const MOD = {
  id: "t", title: "T",
  rooms: { bay: { name: "BAY", look: "cold", tags: ["cold"], exits: [], features: {} } },
  flavour: { cold: ["Something ticks as it cools.", "Your breath shows."] },
  threats: { it: { name: "IT" } },
  npcs: { sonya: { name: "SONYA", knows: ["The pumps have been odd."] } },
  endings: { sealed: { title: "SEALED", text: "…" } },
};

/** A game stub that records everything it was asked to do, including
    the calls the old executor never made. */
function fakeGame(patch = {}) {
  const said = [];
  const effects = [];
  const flags = [];
  const asked = [];
  const npcSaid = [];
  return {
    said, effects, flags, asked, npcSaid,
    mod: MOD,
    w: {
      room: "bay", clock: 0, visited: { bay: true },
      threats: { it: { loc: "bay" } }, countdowns: {}, flags: {}, oracleMemory: {},
      npcs: { sonya: { alive: true, loc: "bay", met: true, told: [] } },
      floor: { ...DEFAULT_FLOOR },
      ...(patch.w || {}),
    },
    crew: [{ id: "riley", name: "RILEY", alive: true }],
    feed: [],
    combat: null,
    pending: null,
    warden: {
      say: (text, tone) => said.push({ text, tone }),
      scene: () => {},
      flag: (name, value) => flags.push({ name, value }),
      ask: (pcId, req) => asked.push({ pcId, ...req }),
      npcSay: (npcId, text) => npcSaid.push({ npcId, text }),
      hold: () => {},
      recap: () => {},
    },
    runEffects: (list) => effects.push(list),
    whisperTo: () => {},
    floorNote: () => {},
    ...patch,
  };
}

/* ============================================================
   THE EXECUTOR
   ============================================================ */
describe("every Move the ladder can produce has a route", () => {
  it("advances the stage after an escalation, which is what nothing used to do", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => {
      result.current.take({ kind: "escalate", effects: [{ say: "x" }], nextStage: 1 });
    });
    expect(game.effects).toHaveLength(1);
    /* The fix. Without this write, `rungScripted` reads 0 forever and
       entry 0 fires on every tick for the rest of the session. */
    expect(game.flags).toContainEqual({ name: "directorStage", value: 1 });
  });

  it("runs a pressure beat instead of silently dropping it", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => {
      result.current.take({ kind: "pressure", run: "threatDrive" });
    });
    /* Through the module's own applier and the module's own hook. The
       director does not decide where anything goes. */
    expect(game.effects).toContainEqual([{ run: "threatDrive" }]);
  });

  it("calls a roll on the named player, carrying the reason", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => {
      result.current.take({
        kind: "callRoll", id: "r1", pcId: "riley", stat: "fear", save: true,
        reason: "You saw what it did.",
      });
    });
    expect(game.asked[0]).toMatchObject({ pcId: "riley", kind: "save", name: "fear" });
    expect(game.asked[0].reason).toBe("You saw what it did.");
    // And remembers, so a once-only roll is once.
    expect(game.flags.some((f) => f.name === "directorRolls")).toBe(true);
  });

  it("routes an NPC's own line through the module's NPC voice", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => {
      result.current.take({ kind: "npcSay", npcId: "sonya", text: "The pumps have been odd." });
    });
    expect(game.npcSaid[0]).toMatchObject({ npcId: "sonya" });
  });

  it("ends only through the module's own ending effect", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => { result.current.take({ kind: "end", ending: "sealed" }); });
    expect(game.effects).toContainEqual([{ end: "sealed" }]);
  });
});

describe("the veto ladder, in the hook", () => {
  it("counts a dismissal against the rung it came from", () => {
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => { result.current.dismiss({ kind: "describe", rung: "atmosphere" }); });
    act(() => { result.current.dismiss({ kind: "describe", rung: "atmosphere" }); });
    expect(result.current.vetoes.atmosphere).toBe(2);
  });

  it("does not count a suggestion that merely went unanswered", () => {
    /* Ignoring is not refusing. A strip that punished a Warden for
       being busy would quietly delete its own best rungs on exactly
       the nights the table was going well. */
    const game = fakeGame();
    const { result } = renderHook(() => useDirector({ g: game, mod: MOD, enabled: false }));
    act(() => { result.current.dismiss(null); });
    expect(Object.keys(result.current.vetoes)).toHaveLength(0);
  });
});

/* ============================================================
   THE CARD, ON EVERY PHONE
   ============================================================ */
describe("the card reaches the people who need to see it", () => {
  it("is on the snapshot, so it is not only on the host's screen", () => {
    const snap = packSnapshot({
      seq: 1, phase: "play", mod: MOD, g: null, claims: {}, roster: [],
      safetyCall: { level: "stop", at: NOW },
    });
    expect(snap.safetyCall).toEqual({ level: "stop", at: NOW });
  });

  it("carries the level and the moment and nothing else", () => {
    /* There has never been an identity here — the relay strips it
       before the host is told — and this asserts that nothing has
       crept back in on the way out. */
    const snap = packSnapshot({
      seq: 1, phase: "play", mod: MOD, g: null, claims: {}, roster: [],
      safetyCall: { level: "veil", at: NOW, clientId: "a", name: "Ana" },
    });
    expect(Object.keys(snap.safetyCall).sort()).toEqual(["at", "level"]);
  });

  it("is null when nobody has played one", () => {
    const snap = packSnapshot({ seq: 1, phase: "play", mod: MOD, g: null, claims: {}, roster: [] });
    expect(snap.safetyCall).toBe(null);
  });

  it("offers a clear on every phone, not just the host", () => {
    const onClear = vi.fn();
    render(<SafetyBanner call={{ level: "stop", at: NOW }} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClear).toHaveBeenCalled();
  });

  it("names no one", () => {
    render(<SafetyBanner call={{ level: "stop", at: NOW }} onClear={() => {}} />);
    const text = document.body.textContent;
    expect(text).toMatch(/stop card/i);
    /* No name, no character, no pronoun that could narrow it. It tells
       the table not to go looking, which is the most a banner can do. */
    expect(text).not.toMatch(/Ana|RILEY|player \d/i);
    expect(text).toMatch(/don't ask who/i);
  });

  it("does not count down at anybody", () => {
    /* Nothing here resumes on a timer. The table comes back when a
       human says it does. */
    render(<SafetyBanner call={{ level: "check", at: NOW }} onClear={() => {}} />);
    expect(document.body.textContent).not.toMatch(/\d+\s*s(econds)?\b/);
  });
});

/* ============================================================
   THE BALLOT
   ============================================================ */
describe("the vote, on a phone", () => {
  it("shows how many have not answered, because that is what makes silence a no", () => {
    const v = castVote(openVote("callit", { of: ["a", "b", "c"], at: Date.now() }), "a", "yes");
    render(<TableVote vote={v} mine="yes" onCast={() => {}} />);
    expect(document.body.textContent).toMatch(/2 of 3/);
  });

  it("reports a vote nobody answered as exactly that", () => {
    const v = {
      ...openVote("breather", { of: ["a", "b"], at: Date.now() }),
      result: { choice: "no", why: "expired", at: Date.now() },
    };
    render(<TableVote vote={v} onCast={() => {}} />);
    expect(document.body.textContent).toMatch(/nobody answered/i);
  });

  it("is on the snapshot, so every phone can read the same tally", () => {
    const v = openVote("callit", { of: ["a"], at: NOW });
    const snap = packSnapshot({
      seq: 1, phase: "play", mod: MOD, g: null, claims: {}, roster: [], vote: v,
    });
    expect(snap.vote.of).toEqual(["a"]);
  });
});

/* ============================================================
   WHOSE GO IS IT
   ============================================================ */
describe("whose go it is", () => {
  const crew = [{ id: "riley", name: "RILEY" }, { id: "dana", name: "DANA" }];

  it("tells you when it is yours, as an invitation rather than a status", () => {
    render(<WhoseGo waiting={{ riley: { state: "acting" } }} pcId="riley" crew={crew} />);
    expect(document.body.textContent).toMatch(/your go/i);
  });

  it("names who the table is on, when it is not you", () => {
    render(<WhoseGo waiting={{ dana: { state: "acting" } }} pcId="riley" crew={crew} />);
    expect(document.body.textContent).toMatch(/DANA/);
  });

  it("stays out of the way when another strip is already saying it", () => {
    /* Being blocked behind somebody's roll is already reported. Two
       strips saying overlapping things is worse than one saying
       less. */
    const { container } = render(
      <WhoseGo waiting={{ riley: { state: "blocked", by: "dana" } }} pcId="riley" crew={crew} />,
    );
    expect(container.textContent).toBe("");
  });

  it("says nothing at all when nobody is acting", () => {
    const { container } = render(
      <WhoseGo waiting={{ riley: { state: "held" } }} pcId="riley" crew={crew} />,
    );
    expect(container.textContent).toBe("");
  });
});

/* ============================================================
   ASKING THE ROOM
   ============================================================ */
describe("asking the situation something", () => {
  it("opens to the questions a player actually asks", () => {
    render(<AskRoom onAsk={() => {}} />);
    fireEvent.click(screen.getByText("Ask the room"));
    expect(document.body.textContent).toMatch(/What do I see/i);
  });

  it("sends the question", () => {
    const onAsk = vi.fn();
    render(<AskRoom onAsk={onAsk} />);
    fireEvent.click(screen.getByText("Ask the room"));
    fireEvent.click(screen.getByText("Ways out?"));
    expect(onAsk).toHaveBeenCalledWith("Ways out?");
  });
});
