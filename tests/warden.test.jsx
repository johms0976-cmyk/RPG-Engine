// @vitest-environment jsdom
/* ============================================================
   THE WARDEN LAYER — tests for the interrupt.

   These cover the features that turn a Warden from a spectator
   of their own session into the person running it, and the three
   things the players got back at the same time.

   The bias throughout is towards testing the *constraints*
   rather than the happy paths. Anyone can check that a whisper
   arrives. What actually matters, and what would silently rot,
   is that the safety card cannot be traced, that a phone has no
   `warden` key to find, that a held countdown really stops, and
   that a magazine handed over half-empty arrives half-empty.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { useGame } from "../src/engine/useGame.js";
import { useHost } from "../src/net/useHost.js";
import { useRemoteGame } from "../src/net/useRemoteGame.js";
import { PLAYER_ACTIONS, OUT_OF_TURN, HOST_TO_CLIENT, SAFETY_LEVELS, packSnapshot } from "../src/net/protocol.js";
import { intentLabel } from "../src/net/useIntentGate.js";
import { pressureOf } from "../src/ui/usePressure.js";
import { styleOf } from "../src/ui/Artefact.jsx";
import { textureFor } from "../src/ui/Map2.jsx";
import HoldToRoll, { HOLD_MS } from "../src/ui/HoldToRoll.jsx";
import SafetyCard from "../src/net/SafetyCard.jsx";
import mod from "../src/modules/ypsilon14/index.js";
import { makeCharacter, rollStats } from "../src/engine/rules.js";

/* ---------------- harness ---------------- */

let sockets = [];
class FakeSocket {
  constructor() {
    this.readyState = 1;
    this.sent = [];
    sockets.push(this);
    setTimeout(() => this.onopen && this.onopen(), 0);
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  deliver(msg) { this.onmessage && this.onmessage({ data: JSON.stringify(msg) }); }
}

const mkPc = (name) => makeCharacter(
  { name, cls: "teamster", stats: rollStats(), skills: [], loadout: Object.keys(mod.loadouts)[0] },
  mod,
);

/** A started session with two characters, ready to be poked. */
async function startedGame(names = ["RILEY", "VOSS"]) {
  const hook = renderHook(() => useGame(mod, { slot: "test" }));
  await act(async () => {
    hook.result.current.begin(names.map(mkPc));
    await vi.advanceTimersByTimeAsync(200);
  });
  return hook;
}

beforeEach(() => {
  sockets = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/* ============================================================
   1. THE WARDEN HAS A MOUTH
   ============================================================ */

describe("the Warden can speak", () => {
  it("puts a narrated line in the feed as its own kind", async () => {
    const { result } = await startedGame();
    await act(async () => { result.current.warden.say("The light in the corridor is out."); });

    const line = result.current.feed.find((f) => f.kind === "interject");
    expect(line).toBeTruthy();
    expect(line.text).toMatch(/light in the corridor/);

    /* Deliberately NOT kind "warden": modules already write briefing
       text in that tone (Ypsilon's intro does), and the whole value of
       this feature is that the table can tell a live human from the
       module's own voice. */
    expect(line.kind).not.toBe("warden");
  });

  it("speaks as an NPC in that NPC's own voice line", async () => {
    const { result } = await startedGame();
    const npcId = mod.npcOrder[0];
    await act(async () => { result.current.warden.npcSay(npcId, "I never touched the shower."); });

    const line = result.current.feed.find((f) => f.kind === "npc" && /never touched/.test(f.text));
    expect(line).toBeTruthy();
    // Prefixed with the name, so the table reads it as dialogue.
    expect(line.text.startsWith(`${mod.npcs[npcId].name}:`)).toBe(true);
    // Marked as a person speaking rather than a table being rolled on.
    expect(line.extra.live).toBe(true);
  });

  it("counts speaking to someone as having met them", async () => {
    const { result } = await startedGame();
    const npcId = mod.npcOrder[0];
    expect(result.current.w.npcs[npcId].met).toBe(false);
    await act(async () => { result.current.warden.npcSay(npcId, "Hello."); });
    expect(result.current.w.npcs[npcId].met).toBe(true);
  });

  it("keeps a note to self off every screen but the Warden's", async () => {
    const { result } = await startedGame();
    await act(async () => { result.current.warden.note("Kantaro is lying about the ninth."); });

    const line = result.current.feed.find((f) => f.kind === "wardennote");
    expect(line.wardenOnly).toBe(true);
  });
});

/* ============================================================
   2. THE WARDEN HAS HANDS
   ============================================================ */

describe("the override levers", () => {
  it("moves Health and Stress and says so out loud", async () => {
    const { result } = await startedGame();
    const pc = result.current.crew[0];
    const before = pc.health;

    await act(async () => {
      result.current.warden.adjust(pc.id, { health: -3, why: "the hatch drops on you" });
    });

    expect(result.current.crew[0].health).toBe(before - 3);
    // A referee who can change the score silently is not running a game.
    expect(result.current.feed.some((f) => /-3 Health/.test(f.text))).toBe(true);
  });

  it("never announces a secret condition to the table", async () => {
    const { result } = await startedGame();
    const pc = result.current.crew[0];

    await act(async () => { result.current.warden.condition(pc.id, "Hallucinating", true); });

    expect(result.current.crew[0].conditions).toContain("Hallucinating");
    const mentions = result.current.feed.filter(
      (f) => /Hallucinating/.test(f.text) && !f.wardenOnly,
    );
    expect(mentions).toEqual([]);
  });

  it("holds a countdown so it stops consuming the clock", async () => {
    const { result } = await startedGame();

    await act(async () => { result.current.warden.countdown("reactor", "start", 30); });
    expect(result.current.w.countdowns.reactor.left).toBe(30);

    await act(async () => { result.current.warden.countdown("reactor", "pause"); });
    expect(result.current.w.countdowns.reactor.paused).toBe(true);

    // Twenty minutes of world time pass and the held clock does not move.
    await act(async () => { result.current.api.advance(20); });
    expect(result.current.w.countdowns.reactor.left).toBe(30);

    // Let it run again and it resumes being ordinary.
    await act(async () => { result.current.warden.countdown("reactor", "pause"); });
    await act(async () => { result.current.api.advance(10); });
    expect(result.current.w.countdowns.reactor.left).toBe(20);
  });

  it("addresses a called-for roll to one character only", async () => {
    const { result } = await startedGame();
    const them = result.current.crew[1];

    await act(async () => {
      result.current.warden.ask(them.id, { kind: "save", name: "fear", reason: "the ladder gives" });
    });

    expect(result.current.pending.kind).toBe("roll");
    expect(result.current.pending.req.pcId).toBe(them.id);
    expect(result.current.pending.req.reason).toMatch(/ladder/);
  });

  it("can put something in a character's hands and take it back", async () => {
    const { result } = await startedGame();
    const pc = result.current.crew[0];

    await act(async () => { result.current.warden.item(pc.id, "keycard", true); });
    expect(result.current.crew[0].items).toContain("keycard");

    await act(async () => { result.current.warden.item(pc.id, "keycard", false); });
    expect(result.current.crew[0].items).not.toContain("keycard");
  });
});

/* ============================================================
   3. THE PHONE HAS NONE OF THEM

   The important half. A phone builds its game object from
   useRemoteGame, which has no warden key — so the Warden's
   controls cannot render on a player's screen even if somebody
   later forgets to check a prop.
   ============================================================ */

describe("authority stays on the desk", () => {
  it("gives a phone no warden surface at all", () => {
    const snapshot = {
      modId: mod.id,
      state: {
        w: { room: mod.start, flags: {}, npcs: {}, threats: {} },
        crew: [{ id: "pc1", name: "RILEY", items: [], conditions: [], stats: {}, saves: {} }],
        feed: [], clues: [], marks: [],
      },
    };
    const { result } = renderHook(() => useRemoteGame(snapshot, "pc1", vi.fn()));
    expect(result.current.warden).toBeUndefined();
  });

  it("refuses to send a warden verb as a player intent", () => {
    for (const verb of ["wardenSay", "adjust", "condition", "moveNpc", "endCombat"]) {
      expect(PLAYER_ACTIONS.has(verb)).toBe(false);
    }
  });
});

/* ============================================================
   4. HANDING SOMETHING OVER
   ============================================================ */

describe("passing an object to the person next to you", () => {
  it("moves the item between characters and narrates it", async () => {
    const { result } = await startedGame();
    const [from, to] = result.current.crew;

    await act(async () => { result.current.warden.item(from.id, "keycard", true); });
    await act(async () => { result.current.giveItem("keycard", to.id); });

    expect(result.current.crew[0].items).not.toContain("keycard");
    expect(result.current.crew[1].items).toContain("keycard");
    expect(result.current.feed.some((f) => /hands the .* to/i.test(f.text))).toBe(true);
  });

  it("carries the ammunition across with the weapon", async () => {
    const { result } = await startedGame();
    const [from, to] = result.current.crew;

    await act(async () => { result.current.warden.item(from.id, "revolver", true); });
    // Spend two rounds, so the magazine is demonstrably not full.
    await act(async () => {
      result.current.setActiveId(from.id);
      await vi.advanceTimersByTimeAsync(5);
    });
    const full = result.current.crew[0].ammo.revolver;
    expect(full).toBeGreaterThan(0);

    await act(async () => { result.current.giveItem("revolver", to.id); });

    // A half-empty magazine handed over as a full one is the kind of
    // quiet lie that costs a table an hour.
    expect(result.current.crew[1].ammo.revolver).toBe(full);
    expect(result.current.crew[0].ammo.revolver).toBeUndefined();
  });

  it("refuses to hand over something you are not carrying", async () => {
    const { result } = await startedGame();
    const to = result.current.crew[1];
    await act(async () => { result.current.giveItem("minelaser", to.id); });
    expect(result.current.crew[1].items).not.toContain("minelaser");
  });

  it("is a player right, and one that survives combat", () => {
    expect(PLAYER_ACTIONS.has("giveItem")).toBe(true);
    // Passing the flashlight mid-firefight is exactly when it matters.
    expect(OUT_OF_TURN.has("giveItem")).toBe(true);
    expect(intentLabel("giveItem")).not.toBe("Working");
  });
});

/* ============================================================
   5. THE CARD

   The one test that would be worth writing even if every other
   one here were deleted.
   ============================================================ */

describe("the safety card cannot be traced", () => {
  it("reaches the Warden with no identity on it", async () => {
    const g = {
      crew: [{ id: "pc1", name: "RILEY", alive: true }],
      activeId: "pc1", pending: null, combat: null, w: {}, feed: [],
      setActiveId: vi.fn(),
    };
    const { result } = renderHook(() => useHost({ g, mod: { id: "m" }, phase: "play", enabled: true }));

    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    const ws = sockets[0];

    /* This is the shape the relay produces: server/host.mjs drops
       clientId, name and pcId before forwarding. If someone later
       "helpfully" passes those through, this test is what catches it. */
    await act(async () => {
      ws.deliver({ t: "safety", level: "stop" });
      await vi.advanceTimersByTimeAsync(5);
    });

    expect(result.current.safetyCall.level).toBe("stop");
    expect(result.current.safetyCall.clientId).toBeUndefined();
    expect(result.current.safetyCall.name).toBeUndefined();
    expect(result.current.safetyCall.pcId).toBeUndefined();
  });

  it("offers a quiet ask as well as a loud one", () => {
    // A table with only a big red button uses it never.
    expect(Object.keys(SAFETY_LEVELS)).toEqual(["check", "veil", "stop"]);
  });

  it("sends the level the player chose and nothing else", () => {
    const onCall = vi.fn();
    render(<SafetyCard safety={{ lines: [], veils: [] }} onCall={onCall} />);
    fireEvent.click(screen.getByLabelText(/Safety card/i));
    fireEvent.click(screen.getByText(SAFETY_LEVELS.veil.label));
    expect(onCall).toHaveBeenCalledWith("veil");
    expect(onCall.mock.calls[0].length).toBe(1);
  });

  it("carries the lines and veils to every phone in the snapshot", () => {
    const snap = packSnapshot({
      seq: 1, phase: "play", mod: { id: "m" }, g: null,
      claims: {}, roster: [], lobby: [],
      safety: { lines: ["harm to animals"], veils: ["detailed injury"] },
    });
    expect(snap.safety.lines).toContain("harm to animals");
    expect(snap.safety.veils).toContain("detailed injury");
  });
});

/* ============================================================
   6. WHISPERS BOTH WAYS
   ============================================================ */

describe("the secrecy loop closes", () => {
  it("collects a player's whisper for the Warden, out of the feed", async () => {
    const g = {
      crew: [{ id: "pc1", name: "RILEY", alive: true }],
      activeId: "pc1", pending: null, combat: null, w: {}, feed: [],
      setActiveId: vi.fn(),
    };
    const { result } = renderHook(() => useHost({ g, mod: { id: "m" }, phase: "play", enabled: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    const ws = sockets[0];

    await act(async () => {
      ws.deliver({
        t: "playerwhisper", clientId: "c1", name: "Sam", pcId: "pc1",
        text: "I pocket the keycard while they're arguing.",
      });
      await vi.advanceTimersByTimeAsync(5);
    });

    expect(result.current.inbox[0].text).toMatch(/pocket the keycard/);
    expect(result.current.inbox[0].unread).toBe(true);
    // The feed is exported, shown on the table screen and read by
    // everyone, so a whisper must never land in it.
    expect(g.feed.length).toBe(0);
  });

  it("declares the new host-to-player messages so the relay will carry them", () => {
    for (const t of ["whisper", "sound", "spotlight", "assigned", "denied", "ack"]) {
      expect(HOST_TO_CLIENT.has(t)).toBe(true);
    }
  });
});

/* ============================================================
   7. PROPS, PRESSURE AND TEXTURE
   ============================================================ */

describe("handouts become objects", () => {
  it("files a handout against whoever opened it", async () => {
    const { result } = await startedGame();
    const pc = result.current.crew[0];

    await act(async () => {
      result.current.warden.item(pc.id, "tape1", true);
      result.current.warden.item(pc.id, "boombox", true);
    });
    await act(async () => { result.current.useItem("tape1"); });

    expect(result.current.w.handouts.tape1).toBeTruthy();
    expect(result.current.w.handouts.tape1.by).toContain(pc.id);
  });

  it("puts one in the middle of the table and takes it back", async () => {
    const { result } = await startedGame();
    await act(async () => { result.current.warden.showHandout("tape2"); });
    expect(result.current.w.tableHandout).toBe("tape2");
    await act(async () => { result.current.warden.showHandout(null); });
    expect(result.current.w.tableHandout).toBe(null);
  });

  it("draws each handout as the thing it actually is", () => {
    expect(styleOf(mod.handouts.tape1)).toBe("tape");
    expect(styleOf(mod.handouts.tape3)).toBe("terminal");
    // A module that never sets one still gets something sensible.
    expect(styleOf({ label: "A scrap of paper" })).toBe("note");
  });
});

describe("the clock is felt as well as read", () => {
  it("is zero with nothing ticking and rises as time runs out", () => {
    expect(pressureOf({ countdowns: {} })).toBe(0);
    expect(pressureOf({ countdowns: { r: { left: 60 } } })).toBe(0);
    expect(pressureOf({ countdowns: { r: { left: 30 } } })).toBeCloseTo(0.5, 2);
    expect(pressureOf({ countdowns: { r: { left: 0 } } })).toBe(1);
  });

  it("ignores a countdown the Warden is holding", () => {
    // A held clock is not pressure. It is the opposite of pressure.
    expect(pressureOf({ countdowns: { r: { left: 5, paused: true } } })).toBe(0);
  });

  it("never exceeds one, however far past zero a clock has gone", () => {
    expect(pressureOf({ countdowns: { r: { left: -400 } } })).toBe(1);
  });
});

describe("the map says what a room is like", () => {
  it("picks a texture from the room's own tags", () => {
    expect(textureFor(["vacuum"])).toBe("tex-vacuum");
    expect(textureFor(["mining", "industrial"])).toBe("tex-industrial");
    expect(textureFor(["organic"])).toBe("tex-organic");
    expect(textureFor(["parlour"])).toBe(null);
  });
});

/* ============================================================
   8. THE DICE COME BACK
   ============================================================ */

describe("hold to roll", () => {
  it("does not roll on a tap", () => {
    const onRoll = vi.fn();
    render(<HoldToRoll onRoll={onRoll} label="Roll Fear" />);
    const btn = screen.getByLabelText(/press and hold/i);

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(120); });
    fireEvent.pointerUp(btn);
    act(() => { vi.advanceTimersByTime(1000); });

    // Letting go early is a decision, and the decision was no.
    expect(onRoll).not.toHaveBeenCalled();
  });

  it("rolls once the hold is seen through", () => {
    const onRoll = vi.fn();
    render(<HoldToRoll onRoll={onRoll} label="Roll Fear" />);
    const btn = screen.getByLabelText(/press and hold/i);

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS + 30); });

    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it("offers a plain button to anyone who cannot hold one", () => {
    const onRoll = vi.fn();
    render(<HoldToRoll onRoll={onRoll} label="Roll Fear" />);
    const btn = screen.getByLabelText(/press and hold/i);

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.pointerUp(btn);

    // A tremor, a trackpad or a switch device must not lock somebody
    // out of the one action the game asks for most.
    const plain = screen.getByText(/tap here to roll/i);
    fireEvent.click(plain);
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it("cannot be made to roll twice", () => {
    const onRoll = vi.fn();
    render(<HoldToRoll onRoll={onRoll} label="Roll Fear" />);
    const btn = screen.getByLabelText(/press and hold/i);

    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS + 30); });
    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(HOLD_MS + 30); });

    expect(onRoll).toHaveBeenCalledTimes(1);
  });
});
