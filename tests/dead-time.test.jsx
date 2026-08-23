// @vitest-environment jsdom
/* ============================================================
   THE TABLE ANSWERS BACK — 2.10

   B.3 reacting, B.4 offering help, C.1 the director hearing the
   room, C.3 the clock, A.7 the phone that dies.

   As usual, most of these assert a refusal.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  REACTIONS, reactionById, canReact, liveReactions,
  REACT_COOLDOWN_MS, REACT_VISIBLE_MS,
} from "../src/engine/reactions.js";
import { rungListen, rungLastCall, directorPlan } from "../src/engine/director.js";
import { PLAYER_ACTIONS, OUT_OF_TURN } from "../src/net/protocol.js";
import { TEMPO_FREE } from "../src/engine/tempo.js";
import { intentLabel } from "../src/net/useIntentGate.js";
import { ReactBar, AssistOffer } from "../src/ui/ReactBar.jsx";
import TableFar from "../src/screens/TableFar.jsx";

beforeAll(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});
afterEach(cleanup);

/* ============================================================
   B.3 — REACTING
   ============================================================ */
describe("the vocabulary is closed", () => {
  it("offers six, which is a thumb-sized grid", () => {
    expect(REACTIONS).toHaveLength(6);
  });

  it("DROPS AN ID THAT IS NOT ON THE LIST", () => {
    /* A phone sending something not in this set has been tampered
       with, and the right answer to that is silence — not a
       coerced fallback, which would let arbitrary input pick a
       reaction. */
    expect(reactionById("flinch")).toBeTruthy();
    expect(reactionById("nuke the site from orbit")).toBe(null);
    expect(reactionById("")).toBe(null);
    expect(reactionById(null)).toBe(null);
  });

  it("puts no words in anybody's mouth", () => {
    /* INV-6. Every one is a body in a chair — no dialogue, no claim
       about the world, nothing that asserts a fact somebody would
       have to adjudicate. A quotation mark here would mean the
       engine had written a line for a player. */
    for (const r of REACTIONS) {
      expect(r.says).not.toMatch(/["']/);
      expect(r.says).not.toMatch(/\bI\b/);
    }
  });
});

describe("how often somebody may wince", () => {
  it("lets a first reaction straight through", () => {
    expect(canReact(0, 1000)).toBe(true);
    expect(canReact(undefined, 1000)).toBe(true);
  });

  it("holds a second one inside the cooldown", () => {
    const t = 100000;
    expect(canReact(t, t + 1000)).toBe(false);
    expect(canReact(t, t + REACT_COOLDOWN_MS - 1)).toBe(false);
  });

  it("opens again on the boundary", () => {
    const t = 100000;
    expect(canReact(t, t + REACT_COOLDOWN_MS)).toBe(true);
  });
});

describe("reactions surface and go", () => {
  const at = (ms) => ({ id: `x${ms}`, by: "a", byName: "RILEY", kind: "flinch", says: "flinches", at: ms });

  it("shows a fresh one", () => {
    expect(liveReactions([at(1000)], 1500)).toHaveLength(1);
  });

  it("DROPS ONE THAT HAS BEEN UP LONG ENOUGH", () => {
    /* They are not in the feed and must not accumulate on screen
       either: a reaction is the shape of a room at a moment, and a
       room at a moment is not a record. */
    expect(liveReactions([at(1000)], 1000 + REACT_VISIBLE_MS)).toHaveLength(0);
  });

  it("keeps the order it was given", () => {
    const live = liveReactions([at(1000), at(1200)], 1300);
    expect(live.map((r) => r.at)).toEqual([1000, 1200]);
  });
});

describe("reacting is not a turn", () => {
  it("is a named player action, so the routers will pass it", () => {
    expect(PLAYER_ACTIONS.has("react")).toBe(true);
    expect(PLAYER_ACTIONS.has("offerAssist")).toBe(true);
    expect(PLAYER_ACTIONS.has("withdrawAssist")).toBe(true);
  });

  it("fires mid-firefight, which is the entire point", () => {
    /* Four people not shooting is exactly when there is nothing to
       do. Holding this until the shooting stopped would leave the
       dead time it was written for completely intact. */
    expect(OUT_OF_TURN.has("react")).toBe(true);
    expect(OUT_OF_TURN.has("offerAssist")).toBe(true);
  });

  it("passes every tempo brake", () => {
    /* A brake that held a reaction would be the software deciding
       when somebody may wince. */
    expect(TEMPO_FREE.has("react")).toBe(true);
    expect(TEMPO_FREE.has("offerAssist")).toBe(true);
    expect(TEMPO_FREE.has("withdrawAssist")).toBe(true);
  });

  it("reads as something a person does, not something a system processes", () => {
    for (const a of ["react", "offerAssist", "withdrawAssist"]) {
      expect(intentLabel(a)).not.toBe("Working");
    }
  });
});

describe("the react bar", () => {
  it("sends the id, with no confirmation step", () => {
    /* A modal on a reflex is a contradiction: the whole value is
       that it costs nothing. */
    const onReact = vi.fn();
    render(<ReactBar onReact={onReact} />);
    fireEvent.click(screen.getByText("Flinch"));
    expect(onReact).toHaveBeenCalledWith("flinch");
  });

  it("says why the buttons are dead rather than just deadening them", () => {
    render(<ReactBar onReact={() => {}} cooling />);
    expect(screen.getByText(/Give it a moment/)).toBeTruthy();
  });
});

/* ============================================================
   B.4 — OFFERING TO HELP
   ============================================================ */
describe("I'm helping her", () => {
  const CREW = [
    { id: "a", name: "RILEY", alive: true },
    { id: "b", name: "VOSS", alive: true },
    { id: "c", name: "OKONKWO", alive: false },
  ];

  it("offers the other living crew, not yourself", () => {
    render(<AssistOffer crew={CREW} me="a" onOffer={() => {}} onWithdraw={() => {}} />);
    expect(screen.getByText("Help VOSS")).toBeTruthy();
    expect(screen.queryByText("Help RILEY")).toBeNull();
  });

  it("does not offer to help a corpse", () => {
    render(<AssistOffer crew={CREW} me="a" onOffer={() => {}} onWithdraw={() => {}} />);
    expect(screen.queryByText("Help OKONKWO")).toBeNull();
  });

  it("REMOVES THE BUTTON WHEN IT IS SPENT, RATHER THAN REFUSING THE TAP", () => {
    /* A player who taps a live-looking button and gets nothing
       learns not to trust the screen — the same failure this
       codebase has already fixed twice elsewhere. */
    render(<AssistOffer crew={CREW} me="a" spent onOffer={() => {}} onWithdraw={() => {}} />);
    expect(screen.queryByText("Help VOSS")).toBeNull();
    expect(screen.getByText(/already helped someone today/)).toBeTruthy();
  });

  it("lets an untaken offer be withdrawn for free", () => {
    const onWithdraw = vi.fn();
    render(
      <AssistOffer crew={CREW} me="a" offered={{ by: "a", to: "b", toName: "VOSS" }}
        onOffer={() => {}} onWithdraw={onWithdraw} />,
    );
    fireEvent.click(screen.getByText("Never mind"));
    expect(onWithdraw).toHaveBeenCalled();
  });

  it("shows nothing at all when there is nobody to help", () => {
    const { container } = render(
      <AssistOffer crew={[{ id: "a", name: "RILEY", alive: true }]} me="a"
        onOffer={() => {}} onWithdraw={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("the offer reaches the shared screen", () => {
  const MOD = { id: "t", title: "T", rooms: { h: { name: "HOLD", exits: [], features: {} } }, handouts: {}, items: {} };
  const g = {
    mod: MOD, w: { room: "h", clock: 10, flags: {} },
    crew: [{ id: "a", name: "RILEY", health: 5, maxHealth: 10, stress: 1, alive: true }],
    feed: [], combat: null,
  };

  it("names both people, before any roll", () => {
    /* The placement IS the feature. An assist picked off a menu by
       the person rolling is a modifier; an offer the room can see
       is two people in a scene together. */
    render(<TableFar g={g} peers={[]} assistOffers={[{ by: "a", byName: "RILEY", to: "b", toName: "VOSS" }]} />);
    expect(screen.getByText("RILEY is helping VOSS")).toBeTruthy();
  });

  it("shows a live reaction and not a stale one", () => {
    const now = Date.now();
    render(
      <TableFar g={g} peers={[]} reactions={[
        { id: "r1", by: "a", byName: "RILEY", says: "flinches", at: now },
        { id: "r2", by: "b", byName: "VOSS", says: "stares", at: now - REACT_VISIBLE_MS - 1 },
      ]} />,
    );
    expect(screen.getByText("flinches")).toBeTruthy();
    expect(screen.queryByText("stares")).toBeNull();
  });
});

/* ============================================================
   C.1 — THE DIRECTOR HEARS THE ROOM
   ============================================================ */
describe("listening", () => {
  const base = {
    w: { room: "h", clock: 10, flags: {} }, crew: [], now: 1000000, lastMoveAt: 0,
  };
  const withListeners = (listeners) => ({
    id: "t", rooms: {}, items: {}, director: { listeners },
  });
  const said = (kind, text, id = 1) => [{ id, kind, text }];

  it("fires an author's own line on a phrase somebody typed", () => {
    const mod = withListeners([{ id: "eng", phrases: ["engineer"], label: "The engineer looks up." }]);
    const m = rungListen({ ...base, mod, feed: said("look", "I don't trust the engineer") });
    expect(m.kind).toBe("listen");
    expect(m.label).toBe("The engineer looks up.");
  });

  it("matches inside a word, so an author writing one noun catches its plural", () => {
    const mod = withListeners([{ id: "eng", phrases: ["engineer"], label: "x" }]);
    expect(rungListen({ ...base, mod, feed: said("look", "what about the engineers") })).toBeTruthy();
  });

  it("NEVER TRIGGERS ON NARRATION, ONLY ON WHAT A PLAYER TYPED", () => {
    /* A director that could fire on room description would be
       responding to itself, and one that could fire on its own
       output would loop. */
    const mod = withListeners([{ id: "eng", phrases: ["engineer"], label: "x" }]);
    for (const kind of ["room", "system", "npc", "warden", "whisper"]) {
      expect(rungListen({ ...base, mod, feed: said(kind, "the engineer is here") })).toBe(null);
    }
    expect(rungListen({ ...base, mod, feed: said("share", "the engineer lied") })).toBeTruthy();
  });

  it("answers a phrase once", () => {
    const mod = withListeners([{ id: "eng", phrases: ["engineer"], label: "x" }]);
    const feed = said("look", "the engineer", 7);
    expect(rungListen({ ...base, mod, feed })).toBeTruthy();
    expect(rungListen({ ...base, mod, feed, heard: { 7: true } })).toBe(null);
  });

  it("does not interrupt a move it just made", () => {
    /* Answering three seconds after speaking sounds like
       interruption, not attention. */
    const mod = withListeners([{ id: "eng", phrases: ["engineer"], label: "x" }]);
    const feed = said("look", "the engineer");
    expect(rungListen({ ...base, mod, feed, lastMoveAt: base.now - 3000 })).toBe(null);
  });

  it("stays quiet for a module that declared none", () => {
    const mod = { id: "t", rooms: {}, items: {}, director: {} };
    expect(rungListen({ ...base, mod, feed: said("look", "anything at all") })).toBe(null);
  });

  it("honours a listener's own condition", () => {
    const mod = withListeners([{ id: "e", phrases: ["door"], when: { flag: "openedIt" }, label: "x" }]);
    expect(rungListen({ ...base, mod, feed: said("look", "the door") })).toBe(null);
  });

  it("prefers the most recent thing said", () => {
    const mod = withListeners([
      { id: "a", phrases: ["reactor"], label: "REACTOR" },
      { id: "b", phrases: ["airlock"], label: "AIRLOCK" },
    ]);
    const feed = [
      { id: 1, kind: "look", text: "check the reactor" },
      { id: 2, kind: "look", text: "check the airlock" },
    ];
    expect(rungListen({ ...base, mod, feed }).label).toBe("AIRLOCK");
  });
});

/* ============================================================
   C.3 — THE CLOCK
   ============================================================ */
describe("last call", () => {
  const w = { room: "h", clock: 10, flags: {} };

  it("says nothing to a table that never declared a length", () => {
    /* Absent by default, and no table gets steered who did not
       ask. */
    expect(rungLastCall({ w, now: 9e12, sessionEndsAt: 0 })).toBe(null);
  });

  it("says nothing before the time", () => {
    expect(rungLastCall({ w, now: 1000, sessionEndsAt: 2000 })).toBe(null);
  });

  it("says it at the time", () => {
    const m = rungLastCall({ w, now: 2000, sessionEndsAt: 2000 });
    expect(m.kind).toBe("lastCall");
  });

  it("SAYS IT EXACTLY ONCE", () => {
    /* The announcement is the honest half of this rung — a director
       quietly steering because a clock said so is what nobody
       signed up for. Said twice it is nagging. */
    expect(rungLastCall({ w, now: 5000, sessionEndsAt: 2000, lastCallAt: 3000 })).toBe(null);
  });
});

describe("after last call the ladder is narrower, not shorter", () => {
  const mod = {
    id: "t", title: "T",
    rooms: { h: { name: "HOLD", exits: [], features: {} } },
    handouts: {}, items: {},
    director: { listeners: [{ id: "e", phrases: ["engineer"], label: "The engineer looks up." }] },
  };
  const feed = [{ id: 1, kind: "look", text: "the engineer" }];

  it("still answers the room before last call", () => {
    const m = directorPlan({
      mod, w: { room: "h", clock: 10, flags: {} }, crew: [], feed,
      now: 1000000, lastMoveAt: 0, startedAt: 0,
    });
    expect(m && m.rung).toBe("listen");
  });

  it("STOPS OPENING NEW THREADS ONCE THE FLAG IS SET", () => {
    /* Not a shorter ladder — a narrower one. What is dropped is
       everything whose job is to open something. The table gets no
       new rope, and is neither railroaded nor cut off. */
    const m = directorPlan({
      mod, w: { room: "h", clock: 10, flags: { lastCall: true } }, crew: [], feed,
      now: 1000000, lastMoveAt: 0, startedAt: 0,
    });
    expect(m && m.rung).not.toBe("listen");
  });
});
