// @vitest-environment jsdom
/* ============================================================
   FEEDBACK — the two halves of "nothing seems to be happening".

   Desk side: an intent arrived and sat in the queue because
   nothing had re-rendered the Warden's screen, so the action only
   ran when the Warden happened to click something. The test for
   that is deliberately hostile: deliver an intent and then touch
   nothing at all. If the drain still needs a render to notice,
   the assertion fails.

   Sofa side: the world moved and the only evidence was three new
   lines in a scrolling log. useOutcome grades feed additions into
   a receipt that fades or a card that has to be dismissed.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { useOutcome, CONSEQUENCE_KINDS } from "../src/net/useOutcome.js";
import { useHost } from "../src/net/useHost.js";
import OutcomeSheet from "../src/ui/OutcomeSheet.jsx";
import PlayerStatus from "../src/net/PlayerStatus.jsx";

/* ============================================================
   A WebSocket that never touches the network and hands the test
   a way to deliver a message from "the relay".
   ============================================================ */
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

beforeEach(() => {
  sockets = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A minimum viable useGame for the host to dispatch against. */
function fakeGame(over = {}) {
  return {
    crew: [{ id: "pc1", name: "RILEY", alive: true }],
    activeId: "pc1",
    pending: null,
    combat: null,
    w: {}, feed: [],
    setActiveId: vi.fn(),
    doSearch: vi.fn(),
    ...over,
  };
}

/* ============================================================ */

describe("the Warden's screen does not need touching", () => {
  it("runs an intent that arrives with nothing else rendering", async () => {
    const g = fakeGame();
    const { rerender } = renderHook(
      ({ game }) => useHost({ g: game, mod: { id: "m" }, phase: "play", enabled: true }),
      { initialProps: { game: g } },
    );

    // Let the socket open and the host announce itself.
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    const ws = sockets[0];
    expect(ws).toBeTruthy();

    // The relay tells the host who is connected, which is what makes
    // pc1 claimable by this client.
    await act(async () => {
      ws.deliver({ t: "peers", peers: [{ clientId: "c1", name: "Sam", pcId: "pc1" }] });
      await vi.advanceTimersByTimeAsync(5);
    });

    // An intent arrives. Crucially, `rerender` is NOT called afterwards —
    // this is exactly the situation the old code stalled in.
    await act(async () => {
      ws.deliver({ t: "intent", action: "doSearch", args: ["showers"], asPc: "pc1", clientId: "c1" });
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(g.doSearch).toHaveBeenCalledWith("showers");
    // Silence the unused-variable lint on rerender without pretending to use it.
    expect(typeof rerender).toBe("function");
  });

  it("drains a backlog rather than one per outside render", async () => {
    const g = fakeGame();
    renderHook(() => useHost({ g, mod: { id: "m" }, phase: "play", enabled: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    const ws = sockets[0];

    await act(async () => {
      ws.deliver({ t: "peers", peers: [{ clientId: "c1", name: "Sam", pcId: "pc1" }] });
      await vi.advanceTimersByTimeAsync(5);
    });

    await act(async () => {
      for (const what of ["showers", "lockers", "drain"]) {
        ws.deliver({ t: "intent", action: "doSearch", args: [what], asPc: "pc1", clientId: "c1" });
      }
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(g.doSearch).toHaveBeenCalledTimes(3);
  });

  it("holds an intent while another player is mid-roll, then releases it", async () => {
    const blocked = fakeGame({
      crew: [{ id: "pc1", name: "RILEY", alive: true }, { id: "pc2", name: "ANA", alive: true }],
      pending: { kind: "roll", req: { pcId: "pc2" } },
    });

    const { rerender } = renderHook(
      ({ game }) => useHost({ g: game, mod: { id: "m" }, phase: "play", enabled: true }),
      { initialProps: { game: blocked } },
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    const ws = sockets[0];

    await act(async () => {
      ws.deliver({ t: "peers", peers: [{ clientId: "c1", name: "Sam", pcId: "pc1" }] });
      await vi.advanceTimersByTimeAsync(5);
    });

    await act(async () => {
      ws.deliver({ t: "intent", action: "doSearch", args: ["showers"], asPc: "pc1", clientId: "c1" });
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(blocked.doSearch).not.toHaveBeenCalled();
    // Held, not thrown away: no denial was sent for it.
    expect(ws.sent.some((m) => m.t === "denied")).toBe(false);

    // Ana finishes her save.
    const free = { ...blocked, pending: null };
    await act(async () => {
      rerender({ game: free });
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(free.doSearch).toHaveBeenCalledWith("showers");
  });
});

/* ============================================================ */

describe("outcome grading", () => {
  const line = (id, kind, text = "…") => ({ id, kind, text });

  it("treats the feed it starts with as history, not news", () => {
    const { result } = renderHook(() => useOutcome([line(1, "room"), line(2, "you")], { live: true }));
    expect(result.current.outcome).toBe(null);
  });

  it("gives an ordinary action a receipt that fades", () => {
    const { result, rerender } = renderHook(
      ({ feed }) => useOutcome(feed, { live: true }),
      { initialProps: { feed: [line(1, "room")] } },
    );
    act(() => { rerender({ feed: [line(1, "room"), line(2, "search", "Nothing but mould.")] }); });

    expect(result.current.outcome.hold).toBe(false);
    expect(result.current.outcome.lines).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.outcome).toBe(null);
  });

  it("holds the player on damage, and does not clear on its own", () => {
    const { result, rerender } = renderHook(
      ({ feed }) => useOutcome(feed, { live: true }),
      { initialProps: { feed: [line(1, "room")] } },
    );
    act(() => { rerender({ feed: [line(1, "room"), line(2, "dmg", "You take 6.")] }); });

    expect(result.current.outcome.hold).toBe(true);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(result.current.outcome.hold).toBe(true);

    act(() => { result.current.dismiss(); });
    expect(result.current.outcome).toBe(null);
  });

  it("one card covers everything that arrived together", () => {
    const { result, rerender } = renderHook(
      ({ feed }) => useOutcome(feed, { live: true }),
      { initialProps: { feed: [line(1, "room")] } },
    );
    act(() => {
      rerender({
        feed: [line(1, "room"), line(2, "search", "You lift the grate."),
          line(3, "horror", "Something is looking back."), line(4, "stress", "+2 Stress")],
      });
    });
    expect(result.current.outcome.lines).toHaveLength(3);
    expect(result.current.outcome.hold).toBe(true);
  });

  it("ignores engine bookkeeping", () => {
    const { result, rerender } = renderHook(
      ({ feed }) => useOutcome(feed, { live: true }),
      { initialProps: { feed: [line(1, "room")] } },
    );
    act(() => { rerender({ feed: [line(1, "room"), line(2, "system", "clock +10m")] }); });
    expect(result.current.outcome).toBe(null);
  });

  it("raises a whisper as a card of its own", () => {
    const { result } = renderHook(() => useOutcome([line(1, "room")], { live: true }));
    act(() => { result.current.raise({ id: "w1", kind: "whisper", text: "The locker was already open." }); });
    expect(result.current.outcome.hold).toBe(true);
    expect(result.current.outcome.lines[0].text).toMatch(/already open/);
  });

  it("counts a whisper as something worth stopping for", () => {
    expect(CONSEQUENCE_KINDS.has("whisper")).toBe(true);
    expect(CONSEQUENCE_KINDS.has("search")).toBe(false);
  });
});

/* ============================================================ */

describe("what the player sees", () => {
  it("a consequence is a dialog with a way out", () => {
    const onDismiss = vi.fn();
    render(
      <OutcomeSheet
        outcome={{ id: 1, at: Date.now(), hold: true, lines: [{ id: 2, kind: "dmg", text: "You take 6." }] }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByText("Carry on"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("a receipt is not a dialog and traps nothing", () => {
    render(
      <OutcomeSheet
        outcome={{ id: 1, at: Date.now(), hold: false, lines: [{ id: 2, kind: "search", text: "Nothing." }] }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByRole("alertdialog")).toBe(null);
    expect(screen.getByText("Nothing.")).toBeTruthy();
  });

  it("the status strip says whose turn it is", () => {
    const g = {
      pc: { id: "pc1", name: "RILEY", cls: "marine", health: 12, maxHealth: 20, stress: 3 },
      mod: { rooms: { bay: { name: "CARGO BAY" } } },
      w: { room: "bay" },
      combat: { round: 2, order: [{ side: "pc", id: "pc1", name: "RILEY" }], turn: 0, actors: { pc1: { actions: 2 } } },
    };
    const { container } = render(<PlayerStatus g={g} waitingOn={null} />);
    // Whatever combat.js decides, the strip must resolve to a state and
    // never render a bare "undefined" at the player.
    expect(container.querySelector(".pstatus").dataset.state).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined/);
    expect(container.textContent).toMatch(/RILEY/);
  });

  it("out of combat the strip names the room", () => {
    const g = {
      pc: { id: "pc1", name: "RILEY", cls: "marine", health: 20, maxHealth: 20, stress: 0 },
      mod: { rooms: { bay: { name: "CARGO BAY" } } },
      w: { room: "bay" },
      combat: null,
    };
    const { container } = render(<PlayerStatus g={g} waitingOn={null} />);
    expect(container.textContent).toMatch(/CARGO BAY/);
    expect(container.querySelector(".pstatus").dataset.state).toBe("calm");
  });
});
