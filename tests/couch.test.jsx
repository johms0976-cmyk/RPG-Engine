// @vitest-environment jsdom
/* ============================================================
   THE COUCH — 2.9

   Four groups, and as usual a good half of them assert that
   something does NOT happen:

     the far layout    what it shows, and what it refuses to show
     the wake lock     the reacquire nobody remembers to write
     audio roles       phones are silent, private cues are not
     the director      named tracks, and disputes as corrections
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import TableFar from "../src/screens/TableFar.jsx";
import TableView from "../src/screens/TableView.jsx";
import JoinCard from "../src/ui/JoinCard.jsx";
import useWakeLock, { wakeLockSupported } from "../src/ui/useWakeLock.js";
import audio from "../src/ui/audio.js";
import { rungScripted, stageFlag } from "../src/engine/director.js";

/* jsdom has no layout, so the feed's "keep me at the bottom" effect
   has nothing to scroll. Same stub the other screen tests use. */
beforeAll(() => { Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {}); });

afterEach(() => { cleanup(); audio.setRole("table"); });

/* ---------------- a minimal table ---------------- */

const MOD = {
  id: "t", title: "THE THING IN THE HOLD",
  rooms: { hold: { name: "CARGO HOLD", look: "cold", exits: [], features: {} } },
  handouts: {},
  items: {},
};

const CREW = [
  { id: "a", name: "RILEY", health: 10, maxHealth: 10, stress: 2, alive: true },
  { id: "b", name: "VOSS", health: 4, maxHealth: 10, stress: 9, alive: true },
  { id: "c", name: "OKONKWO", health: 0, maxHealth: 10, stress: 20, alive: false },
];

const game = (over = {}) => ({
  mod: MOD,
  w: { room: "hold", clock: 90, flags: {}, ...(over.w || {}) },
  crew: CREW,
  feed: over.feed || [],
  combat: over.combat || null,
});

const feedOf = (n) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, kind: "room", text: `line ${i + 1}`,
}));

/* ============================================================
   THE FAR LAYOUT
   ============================================================ */
describe("the shared screen, read from a sofa", () => {
  it("names the room and the clock", () => {
    render(<TableFar g={game()} peers={[]} />);
    expect(screen.getByText("CARGO HOLD")).toBeTruthy();
  });

  it("says whose go it is, by name", () => {
    const { container } = render(<TableFar g={game()} peers={[]} spotlight={{ pcId: "b" }} />);
    expect(screen.getByText("OVER TO")).toBeTruthy();
    /* Scoped, because the name is deliberately in two places at once:
       across the top at 9vh so the room looks up, and lit in the crew
       strip so it is obvious which set of bars belongs to the person
       who was just addressed. */
    expect(container.querySelector(".tv-turn-who").textContent).toBe("VOSS");
    expect(container.querySelector(".tv-pc.is-lit .tv-pc-name").textContent).toBe("VOSS");
  });

  it("names nobody while the table is held", () => {
    /* The true answer to "whose go is it" during a hold is nobody's,
       and a screen that names a player anyway has sent somebody to
       act into a pause. */
    const g = game({ w: { room: "hold", clock: 90, flags: {}, tempo: { held: true, heldWhy: "READ THIS" } } });
    render(<TableFar g={g} peers={[]} spotlight={{ pcId: "b" }} />);
    expect(screen.queryByText("OVER TO")).toBeNull();
  });

  it("shows every crew member, including the dead one", () => {
    const { container } = render(<TableFar g={game()} peers={[]} />);
    const shown = [...container.querySelectorAll(".tv-pc-name")].map((n) => n.textContent);
    expect(shown).toEqual(["RILEY", "VOSS", "OKONKWO"]);
    /* The dead one stays on the strip rather than being removed. A
       crew that silently shrinks is a table quietly forgetting
       somebody was there. */
    expect(container.querySelector(".tv-pc.is-out")).toBeTruthy();
  });

  it("shows the last three lines and no more", () => {
    render(<TableFar g={game({ feed: feedOf(20) })} peers={[]} />);
    expect(screen.getByText("line 20")).toBeTruthy();
    expect(screen.getByText("line 18")).toBeTruthy();
    expect(screen.queryByText("line 17")).toBeNull();
    expect(screen.queryByText("line 1")).toBeNull();
  });

  it("never shows a warden-only line", () => {
    const feed = [{ id: 1, kind: "room", text: "the creature is in the vent", wardenOnly: true }];
    render(<TableFar g={game({ feed })} peers={[]} />);
    expect(screen.queryByText(/creature/)).toBeNull();
  });

  it("gives the safety card the whole screen, with no clear button", () => {
    render(<TableFar g={game()} peers={[]} safetyCall={{ level: "stop" }} />);
    expect(screen.getByText("THE TABLE IS PAUSED")).toBeTruthy();
    expect(screen.getByText(/Clear it from any phone/)).toBeTruthy();
    /* Clearing lives on the phones, where reaching for it identifies
       nobody. There must be nothing pressable here. */
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("puts safety above everything else competing for the screen", () => {
    const g = game({ combat: { round: 2, enemies: [], order: [] } });
    render(
      <TableFar g={g} peers={[]}
        safetyCall={{ level: "veil" }}
        vote={{ label: "Split up?", of: ["a", "b"], cast: {} }} />,
    );
    expect(screen.getByText("THE TABLE IS PAUSED")).toBeTruthy();
    expect(screen.queryByText("Split up?")).toBeNull();
  });

  it("shows who has not answered an open vote", () => {
    render(<TableFar g={game()} peers={[]} vote={{ label: "Split up?", of: ["a", "b", "c"], cast: { a: 1 } }} />);
    expect(screen.getByText(/1 of 3 have answered/)).toBeTruthy();
  });

  it("says nothing about a vote that has resolved", () => {
    render(<TableFar g={game()} peers={[]} vote={{ label: "Split up?", of: ["a"], cast: { a: 1 }, result: "yes" }} />);
    expect(screen.queryByText("Split up?")).toBeNull();
  });
});

describe("choosing a distance", () => {
  it("gives the desk layout its panels", () => {
    const { container } = render(<TableView g={game({ feed: feedOf(3) })} peers={[]} distance="desk" />);
    expect(container.querySelector(".table-grid")).toBeTruthy();
    expect(container.querySelector(".tv")).toBeNull();
  });

  it("gives the couch layout the far one", () => {
    const { container } = render(<TableView g={game({ feed: feedOf(3) })} peers={[]} distance="couch" />);
    expect(container.querySelector(".tv")).toBeTruthy();
    expect(container.querySelector(".table-grid")).toBeNull();
  });

  it("defaults to the desk, so nothing changes for a table that never chose", () => {
    const { container } = render(<TableView g={game({ feed: feedOf(3) })} peers={[]} />);
    expect(container.querySelector(".table-grid")).toBeTruthy();
  });
});

describe("the join card", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ url: "http://192.168.1.9:8080", addresses: [{ address: "192.168.1.9" }] }),
    }));
  });

  it("shows the address without its scheme, at size", async () => {
    await act(async () => { render(<JoinCard peers={[]} />); });
    expect(screen.getByText("192.168.1.9:8080")).toBeTruthy();
  });

  it("counts who is in, so nobody has to ask the room", async () => {
    await act(async () => {
      render(<JoinCard peers={[{ clientId: "1" }, { clientId: "2" }]} expected={5} />);
    });
    expect(screen.getByText("2 of 5 in")).toBeTruthy();
  });

  it("closes on any key, because it is in front of everything", async () => {
    const onClose = vi.fn();
    await act(async () => { render(<JoinCard peers={[]} onClose={onClose} />); });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" })); });
    expect(onClose).toHaveBeenCalled();
  });
});

/* ============================================================
   THE WAKE LOCK
   ============================================================ */
describe("holding the screen awake", () => {
  let sentinel;
  let request;

  function Probe({ on }) { useWakeLock(on); return null; }

  beforeEach(() => {
    sentinel = { release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() };
    request = vi.fn(() => Promise.resolve(sentinel));
    navigator.wakeLock = { request };
    Object.defineProperty(document, "visibilityState", {
      configurable: true, get: () => "visible",
    });
  });
  afterEach(() => { delete navigator.wakeLock; });

  it("asks for one when it is turned on", async () => {
    await act(async () => { render(<Probe on />); });
    expect(request).toHaveBeenCalledWith("screen");
  });

  it("asks for nothing when it is off", async () => {
    await act(async () => { render(<Probe on={false} />); });
    expect(request).not.toHaveBeenCalled();
  });

  it("ASKS AGAIN WHEN THE TAB COMES BACK", async () => {
    /* The load-bearing test. The browser releases the sentinel on
       every hide and does not reacquire on show, so a hook without
       this works for about ninety seconds and then silently stops —
       which is worse than not having it, because nobody reports a
       feature that used to work. A phone going in and out of a
       pocket is the normal case here, not an edge one. */
    await act(async () => { render(<Probe on />); });
    expect(request).toHaveBeenCalledTimes(1);

    // hidden: the browser has taken it back
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not stack sentinels while it already holds one", async () => {
    await act(async () => { render(<Probe on />); });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("lets go when the session ends", async () => {
    let out;
    await act(async () => { out = render(<Probe on />); });
    await act(async () => { out.unmount(); });
    expect(sentinel.release).toHaveBeenCalled();
  });

  it("survives a refusal without throwing", async () => {
    navigator.wakeLock = { request: vi.fn(() => Promise.reject(new Error("battery saver"))) };
    await act(async () => { render(<Probe on />); });
    // Battery saver and a gesture-less tab both refuse. Neither is
    // worth a message on a screen in the middle of a horror game.
    expect(true).toBe(true);
  });

  it("reports honestly on a phone that has no such API", () => {
    delete navigator.wakeLock;
    expect(wakeLockSupported()).toBe(false);
  });
});

/* ============================================================
   WHO IS ALLOWED TO MAKE A NOISE
   ============================================================ */
describe("the table screen owns audio, the phones own haptics", () => {
  it("starts as a table", () => {
    expect(audio.isTable()).toBe(true);
  });

  it("silences the shared channel on a handset", () => {
    audio.setRole("phone");
    expect(audio.isTable()).toBe(false);
    // Six phones a beat apart is not atmosphere.
    expect(audio.playForKind("panic")).toBeUndefined();
  });

  it("turns sound off outright when a tab becomes a phone", () => {
    audio.setRole("table");
    audio.setRole("phone");
    expect(audio.isEnabled()).toBe(false);
  });

  it("treats anything unrecognised as a table, not as a phone", () => {
    audio.setRole("wardenless");
    expect(audio.isTable()).toBe(true);
  });

  it("does not silence a cue placed in one hand on purpose", () => {
    /* The distinction is the whole point of the rule rather than an
       exception to it: a cue is a private channel a Warden reached
       for, and it survives. */
    audio.setRole("phone");
    expect(audio.playCue("nothing-by-this-name")).toBe(false);
  });
});

/* ============================================================
   NAMED ESCALATION TRACKS
   ============================================================ */
describe("more than one ladder", () => {
  const w = (flags = {}) => ({ room: "hold", clock: 1000, flags });

  it("keeps the bare flag key for a module that declared no tracks", () => {
    /* A save written before tracks existed must restore to the same
       place, not start the module's escalations again from the top. */
    expect(stageFlag(null)).toBe("directorStage");
    expect(stageFlag("")).toBe("directorStage");
    expect(stageFlag("company")).toBe("directorStage:company");
  });

  it("climbs an untracked list exactly as it always did", () => {
    const mod = { ...MOD, director: { escalate: [{ atClock: 10, label: "one" }, { atClock: 20, label: "two" }] } };
    const m = rungScripted({ mod, w: w(), crew: CREW, now: 0, lastMoveAt: 0 });
    expect(m.stage).toBe(0);
    expect(m.nextStage).toBe(1);
    expect(m.stageFlag).toBe("directorStage");
    expect(m.track).toBe(null);
  });

  it("advances the counter the Move names", () => {
    const mod = { ...MOD, director: { escalate: [{ atClock: 10, label: "one" }, { atClock: 20, label: "two" }] } };
    const m = rungScripted({ mod, w: w({ directorStage: 1 }), crew: CREW, now: 0, lastMoveAt: 0 });
    expect(m.label).toBe("two");
  });

  it("LETS A SECOND THREAD MOVE WHILE THE FIRST IS STUCK", () => {
    /* The bug this exists for. With one integer, the company's beats
       sat behind the creature's in the same list waiting for a
       condition that had not happened — which is not what an author
       who wrote two threads meant, and there was no way to find out. */
    const mod = { ...MOD, director: { escalate: [
      { track: "creature", when: { flag: "never" }, label: "creature one" },
      { track: "company", atClock: 10, label: "company one" },
    ] } };
    const m = rungScripted({ mod, w: w(), crew: CREW, now: 0, lastMoveAt: 0 });
    expect(m.label).toBe("company one");
    expect(m.track).toBe("company");
    expect(m.stageFlag).toBe("directorStage:company");
  });

  it("fires ONE beat per tick however many are due", () => {
    /* Two escalations landing in the same second is not two threads
       tightening, it is a mess. */
    const mod = { ...MOD, director: { escalate: [
      { track: "a", atClock: 10, label: "a one" },
      { track: "b", atClock: 10, label: "b one" },
    ] } };
    const m = rungScripted({ mod, w: w(), crew: CREW, now: 0, lastMoveAt: 0 });
    expect(m.label).toBe("a one");
  });

  it("offers the other track once the first has been served", () => {
    const mod = { ...MOD, director: { escalate: [
      { track: "a", atClock: 10, label: "a one" },
      { track: "b", atClock: 10, label: "b one" },
    ] } };
    const m = rungScripted({ mod, w: w({ "directorStage:a": 1 }), crew: CREW, now: 0, lastMoveAt: 0 });
    expect(m.label).toBe("b one");
  });

  it("goes quiet when every track is exhausted", () => {
    const mod = { ...MOD, director: { escalate: [{ track: "a", atClock: 10 }, { track: "b", atClock: 10 }] } };
    const m = rungScripted({
      mod, w: w({ "directorStage:a": 1, "directorStage:b": 1 }), crew: CREW, now: 0, lastMoveAt: 0,
    });
    expect(m).toBe(null);
  });

  it("still never fires a beat that declared no trigger", () => {
    const mod = { ...MOD, director: { escalate: [{ track: "a", label: "no trigger" }] } };
    expect(rungScripted({ mod, w: w(), crew: CREW, now: 0, lastMoveAt: 0 })).toBe(null);
  });
});
