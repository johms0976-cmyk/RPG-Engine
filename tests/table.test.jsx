// @vitest-environment jsdom
/* ============================================================
   TABLE — the host/player handshake.

   Everything here is about a phone knowing what it is waiting
   for. The bugs these cover all looked identical from the sofa:
   you press a button and nothing happens, so you press it again.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";

import { useIntentGate, intentLabel } from "../src/net/useIntentGate.js";
import { blockedBy, HOST_TO_CLIENT, PLAYER_ACTIONS, packSnapshot } from "../src/net/protocol.js";
import { OfferStatus } from "../src/net/ClientShell.jsx";
import Lobby from "../src/screens/Lobby.jsx";
import Join from "../src/screens/Join.jsx";

/* Approvals validates whatever it is handed, so a submission in these
   tests has to be a real character file rather than a stub. */
const OFFERED = {
  kind: "mothership-character",
  pc: {
    id: "x", name: "VOSS", cls: "marine", level: 0,
    stats: { strength: 35, speed: 35, intellect: 35, combat: 40 },
    saves: { sanity: 20, fear: 40, body: 25, armor: 30 },
    skills: ["Military Training"], items: [], conditions: [], buffs: [],
    health: 20, maxHealth: 20, stress: 2, credits: 0,
  },
  history: { sessions: 0, panics: 0, witnessed: [] },
};

const MOD = {
  id: "test", title: "TEST", items: {}, loadouts: {}, rooms: {},
  crewSize: { min: 2, max: 4, suggested: 3 },
};

/* ============================================================ */

describe("one intent at a time", () => {
  it("lets the first intent through", () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => { result.current.send({ t: "intent", action: "doSearch" }); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
  });

  /* The whole point. Four taps on Search while the table is blocked
     used to queue four searches on the host and run them all at once
     the moment somebody else finished rolling. */
  it("swallows the rest until the world moves", () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => {
      result.current.send({ t: "intent", action: "doSearch" });
      result.current.send({ t: "intent", action: "doSearch" });
      result.current.send({ t: "intent", action: "doSearch" });
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.ignored).toBe(2);
  });

  it("re-opens when a new snapshot arrives", () => {
    const send = vi.fn(() => true);
    let seq = 1;
    const { result, rerender } = renderHook(() => useIntentGate(send, seq));
    act(() => { result.current.send({ t: "intent", action: "doSearch" }); });
    expect(result.current.busy).toBe(true);
    seq = 2; rerender();
    expect(result.current.busy).toBe(false);
    act(() => { result.current.send({ t: "intent", action: "doMove" }); });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("re-opens when the host refuses, rather than waiting out the clock", () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => { result.current.send({ t: "intent", action: "doSearch" }); });
    act(() => { result.current.clear(); });
    expect(result.current.busy).toBe(false);
  });

  it("gives up rather than stranding the player if nothing comes back", () => {
    vi.useFakeTimers();
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => { result.current.send({ t: "intent", action: "doSearch" }); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.busy).toBe(false);
    vi.useRealTimers();
  });

  it("does not gate anything that isn't an intent", () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => {
      result.current.send({ t: "claim", pcId: "pc1" });
      result.current.send({ t: "submit", character: {} });
      result.current.send({ t: "hello" });
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.current.busy).toBe(false);
  });

  it("does not hold the gate shut if the socket refused the write", () => {
    const send = vi.fn(() => false);   // socket not open
    const { result } = renderHook(() => useIntentGate(send, 1));
    act(() => { result.current.send({ t: "intent", action: "doSearch" }); });
    expect(result.current.busy).toBe(false);
  });

  it("names every player action in words a player would use", () => {
    for (const a of PLAYER_ACTIONS) {
      expect(intentLabel(a)).not.toBe("Working");   // i.e. it has a real label
    }
  });
});

/* ============================================================ */

describe("who the table is waiting on", () => {
  const state = (pending) => ({
    pending, crew: [{ id: "pc1", name: "RILEY" }, { id: "pc2", name: "ANA" }],
  });

  it("names the player everyone else is stalled behind", () => {
    expect(blockedBy(state({ kind: "roll", req: { pcId: "pc2" } }), "pc1")).toBe("ANA");
  });

  it("says nothing when the roll is your own", () => {
    expect(blockedBy(state({ kind: "roll", req: { pcId: "pc1" } }), "pc1")).toBe(null);
  });

  it("says nothing when nobody is rolling", () => {
    expect(blockedBy(state(null), "pc1")).toBe(null);
    expect(blockedBy(null, "pc1")).toBe(null);
  });

  it("copes with a roll owned by somebody not in the crew list", () => {
    expect(blockedBy(state({ kind: "roll", req: { pcId: "ghost" } }), "pc1")).toBe("another player");
  });
});

/* ============================================================ */

describe("offering a character", () => {
  it("shows what you sent and gives you nothing to send twice", () => {
    render(<OfferStatus offer={{ state: "pending", pc: { name: "RILEY", cls: "teamster", skills: ["Zero-G"] } }}
      onWithdraw={() => {}} onAgain={() => {}} />);
    expect(screen.getByText("RILEY")).toBeTruthy();
    expect(screen.queryByText("Offer to the Warden")).toBe(null);
  });

  it("says the Warden has it once they acknowledge", () => {
    render(<OfferStatus offer={{ state: "received", pc: { name: "RILEY", cls: "teamster" } }}
      onWithdraw={() => {}} onAgain={() => {}} />);
    expect(screen.getByText(/they'll wave you in/i)).toBeTruthy();
  });

  it("lets you take it back", () => {
    const onWithdraw = vi.fn();
    render(<OfferStatus offer={{ state: "pending", pc: { name: "RILEY" } }}
      onWithdraw={onWithdraw} onAgain={() => {}} />);
    fireEvent.click(screen.getByText(/take it back/i).closest("button"));
    expect(onWithdraw).toHaveBeenCalled();
  });

  it("explains a rejection instead of dropping you back in the builder", () => {
    const onAgain = vi.fn();
    render(<OfferStatus offer={{ state: "rejected", pc: { name: "RILEY" } }}
      onWithdraw={() => {}} onAgain={onAgain} />);
    expect(screen.getByText(/usually that means/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Build another").closest("button"));
    expect(onAgain).toHaveBeenCalled();
  });
});

/* ============================================================ */

describe("the join screen before a session exists", () => {
  const base = {
    peers: [], myName: "Sam", status: "open",
    onName: () => {}, onClaim: () => {}, onBuild: () => {}, onLocker: () => {},
  };

  it("tells a player to get building once the table is gathering", () => {
    render(<Join {...base} phase="lobby" snapshot={{ state: null, lobby: [] }} />);
    expect(screen.getByText(/build a character now/i)).toBeTruthy();
  });

  it("does not tell them to wait for a session that is being assembled", () => {
    render(<Join {...base} phase="title" snapshot={{ state: null, lobby: [] }} />);
    expect(screen.getByText(/hasn't opened the table yet/i)).toBeTruthy();
  });

  it("shows who is already in, so the wait has a shape", () => {
    render(<Join {...base} phase="lobby"
      snapshot={{ state: null, lobby: [{ id: "a", name: "RILEY" }, { id: "b", name: "ANA" }] }} />);
    expect(screen.getByText(/RILEY · ANA/)).toBeTruthy();
  });

  it("tells an approved player they are in, rather than offering to build again", () => {
    render(<Join {...base} phase="lobby" myPcId="a"
      snapshot={{ state: null, lobby: [{ id: "a", name: "RILEY" }, { id: "b", name: "ANA" }] }} />);
    expect(screen.getByText("You're in")).toBeTruthy();
    expect(screen.queryByText("Build a character")).toBe(null);
    expect(screen.getByText(/With you: ANA/)).toBeTruthy();
  });

  it("locks every character while a claim is in the air", () => {
    const snapshot = { state: { crew: [{ id: "pc1", name: "RILEY" }, { id: "pc2", name: "ANA" }] } };
    render(<Join {...base} snapshot={snapshot} claiming="pc1" />);
    expect(screen.getByText("claiming…")).toBeTruthy();
    expect(screen.getByText("ANA").closest("button").disabled).toBe(true);
  });
});

/* ============================================================ */

describe("the lobby", () => {
  const base = {
    mod: MOD, onAccept: () => {}, onReject: () => {}, onDrop: () => {},
    onBegin: () => {}, onBack: () => {},
  };

  it("will not start below the module's minimum crew", () => {
    render(<Lobby {...base} roster={[{ id: "a", name: "RILEY", cls: "teamster" }]} />);
    const btn = screen.getByText(/Need 1 more character/).closest("button");
    expect(btn.disabled).toBe(true);
  });

  it("starts once there are enough", () => {
    const onBegin = vi.fn();
    render(<Lobby {...base} onBegin={onBegin}
      roster={[{ id: "a", name: "RILEY", cls: "teamster" }, { id: "b", name: "ANA", cls: "marine" }]} />);
    const btn = screen.getByText(/Begin with 2 characters/).closest("button");
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onBegin).toHaveBeenCalled();
  });

  it("says what each connected phone is doing", () => {
    render(<Lobby {...base}
      peers={[
        { clientId: "A", name: "Sam" },
        { clientId: "B", name: "Jo" },
        { clientId: "C", name: "Kit", pcId: "a" },
      ]}
      submissions={[{ id: "s1", clientId: "B", from: "Jo", character: OFFERED }]}
      roster={[{ id: "a", name: "RILEY", cls: "teamster" }]} />);
    expect(screen.getByText("building…")).toBeTruthy();
    expect(screen.getByText("waiting on you")).toBeTruthy();
    expect(screen.getAllByText("RILEY").length).toBeGreaterThan(0);
  });

  it("warns when the table is full rather than silently over-filling it", () => {
    const roster = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), cls: "teamster" }));
    render(<Lobby {...base} roster={roster} />);
    expect(screen.getByText(/table is full at 4/i)).toBeTruthy();
  });

  it("lets the Warden drop someone they let in by mistake", () => {
    const onDrop = vi.fn();
    render(<Lobby {...base} onDrop={onDrop} roster={[{ id: "a", name: "RILEY", cls: "teamster" }]} />);
    fireEvent.click(screen.getByText("Remove").closest("button"));
    expect(onDrop).toHaveBeenCalledWith("a");
  });
});

/* ============================================================ */

describe("what travels", () => {
  it("carries the assembling roster so a waiting phone has something to look at", () => {
    const snap = packSnapshot({
      seq: 1, phase: "lobby", mod: MOD, g: null, claims: {}, roster: [],
      lobby: [{ id: "a", name: "RILEY", cls: "teamster", stats: { strength: 40 }, secret: "x" }],
    });
    expect(snap.lobby).toEqual([{ id: "a", name: "RILEY", cls: "teamster" }]);
    // Names and classes only — a character sheet is not the lobby's business.
    expect(snap.lobby[0].stats).toBeUndefined();
    expect(snap.lobby[0].secret).toBeUndefined();
  });

  it("declares every host-to-one-phone message so the relay can route it", () => {
    for (const t of ["denied", "whisper", "ack", "assigned"]) {
      expect(HOST_TO_CLIENT.has(t)).toBe(true);
    }
    expect(HOST_TO_CLIENT.has("snapshot")).toBe(false);
  });
});
