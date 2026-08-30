// @vitest-environment jsdom
/* ============================================================
   THE WARDEN'S PHONE.

   Two things are worth testing here and they are not the ones a
   component test usually reaches for.

   The first is that this surface has NO SECOND AUTHORITY. It
   renders inside the host tab and calls the same `warden.*`
   functions the desk deck calls, and the way that stops being
   true is somebody adding a local copy of some state "just for
   the phone". So the tests assert on the spies, not on the
   pixels: every control's job is to be the same call.

   The second is the swap. Each deck hides the chrome the other
   one would have offered the swap from — `wphone` is
   `position: fixed; inset: 0` and covers HostBar entirely — so a
   missing door on either side is a Warden with no way back, on
   the device least able to work around it.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import WardenPhone from "../src/screens/WardenPhone.jsx";
import WardenSurface from "../src/screens/WardenSurface.jsx";
import { HANDHELD_QUERY } from "../src/ui/useHandheld.js";

/* ---------------- harness ---------------- */

const warden = () => ({
  say: vi.fn(), note: vi.fn(), npcSay: vi.fn(), adjust: vi.fn(), ask: vi.fn(),
  hold: vi.fn(), breather: vi.fn(), countdown: vi.fn(), undo: vi.fn(),
  canUndo: false, undoLabel: null,
});

const game = (over = {}) => ({
  mod: {
    rooms: { dock: { name: "LANDING BAY" }, hold: { name: "HOLD" } },
    npcs: { cham: { name: "CHAM" } },
    npcOrder: ["cham"],
    threats: {},
  },
  w: { room: "dock", countdowns: {}, tempo: {}, npcs: { cham: { loc: "dock", alive: true } } },
  crew: [{ id: "pc1", name: "RILEY", alive: true, health: 20, maxHealth: 20, stress: 2, room: "dock" }],
  warden: warden(),
  pending: null,
  combat: null,
  ...over,
});

/** matchMedia does not exist in jsdom, which is itself the desk
    case — see the probe in useHandheld.js. Tests that want the
    handheld branch say so. */
function withMedia(matches) {
  window.matchMedia = (q) => ({
    media: q,
    matches: q === HANDHELD_QUERY ? matches : false,
    addEventListener() {}, removeEventListener() {},
  });
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); delete window.matchMedia; });

/* ---------------- the surface ---------------- */

describe("the one-hand deck", () => {
  it("keeps the room on screen, because it is what a Warden loses first", () => {
    render(<WardenPhone g={game()} net={null} />);
    expect(screen.getByText("LANDING BAY")).toBeTruthy();
  });

  it("says so when nothing is waiting, rather than showing an empty box", () => {
    render(<WardenPhone g={game()} net={null} />);
    expect(screen.getByText(/Nothing is waiting on you/)).toBeTruthy();
  });

  it("shows four entries and COUNTS the rest", () => {
    /* The mouth lives below this list. A list that grows until it
       fills the screen is a list that eats the thing a Warden uses
       forty times an evening. */
    const g = game({
      crew: [1, 2, 3, 4, 5, 6].map((n) => ({
        id: `pc${n}`, name: `PC${n}`, alive: true, health: 1, maxHealth: 20, stress: 2, room: "dock",
      })),
    });
    render(<WardenPhone g={g} net={null} />);
    expect(screen.getAllByText(/^PC\d$/)).toHaveLength(4);
    expect(screen.getByText(/and 2 more/)).toBeTruthy();
  });

  it("renders the safety card and NOTHING ELSE", () => {
    const g = game({ crew: [{ id: "pc1", name: "RILEY", alive: true, health: 1, maxHealth: 20, stress: 19, room: "dock" }] });
    render(<WardenPhone g={g} net={{ safetyCall: { level: "stop", at: 1 }, claims: {}, lastActed: {}, inbox: [] }} />);
    expect(screen.getByText("STOP THIS")).toBeTruthy();
    expect(screen.queryByText("RILEY")).toBeNull();
  });
});

/* ---------------- the mouth ---------------- */

describe("saying something", () => {
  const speak = (g, text) => {
    render(<WardenPhone g={g} net={null} />);
    fireEvent.change(screen.getByLabelText("Say something"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Say" }));
  };

  it("goes through warden.say and clears the field", () => {
    const g = game();
    speak(g, "The light in the corridor is out.");
    expect(g.warden.say).toHaveBeenCalledWith("The light in the corridor is out.");
    expect(screen.getByLabelText("Say something").value).toBe("");
  });

  it("goes through warden.npcSay when the voice is somebody in the room", () => {
    const g = game();
    render(<WardenPhone g={g} net={null} />);
    fireEvent.change(screen.getByLabelText("Who is speaking"), { target: { value: "cham" } });
    fireEvent.change(screen.getByLabelText("Say something"), { target: { value: "Don't." } });
    fireEvent.click(screen.getByRole("button", { name: "Say" }));
    expect(g.warden.npcSay).toHaveBeenCalledWith("cham", "Don't.");
    expect(g.warden.say).not.toHaveBeenCalled();
  });

  it("will not say nothing", () => {
    const g = game();
    speak(g, "   ");
    expect(g.warden.say).not.toHaveBeenCalled();
  });

  it("offers only the people actually standing here", () => {
    /* An NPC two rooms away in the voice picker is how a Warden
       says a line as somebody who is not present. */
    const g = game({ w: { room: "dock", countdowns: {}, tempo: {}, npcs: { cham: { loc: "hold", alive: true } } } });
    render(<WardenPhone g={g} net={null} />);
    expect(screen.queryByRole("option", { name: "CHAM" })).toBeNull();
  });
});

/* ---------------- the brake ---------------- */

describe("the brake", () => {
  it("is a tab, not a lever inside one", () => {
    /* The desk deck binds this to Shift+Space and puts it on the
       bar, on the argument that a pause you have to open a drawer
       to reach is a pause you do not take. There is no keyboard
       here, so it has to be a control you can hit without looking. */
    const g = game();
    render(<WardenPhone g={g} net={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Hold" }));
    expect(g.warden.hold).toHaveBeenCalled();
  });

  it("says Resume once the table is held", () => {
    const g = game({ w: { room: "dock", countdowns: {}, tempo: { held: true }, npcs: {} } });
    render(<WardenPhone g={g} net={null} />);
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });
});

/* ---------------- the drawers ---------------- */

describe("the crew drawer", () => {
  const open = (g) => {
    render(<WardenPhone g={g} net={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Crew" }));
    fireEvent.click(screen.getByRole("button", { name: /RILEY/ }));
  };

  it("moves Health through warden.adjust", () => {
    const g = game();
    open(g);
    fireEvent.click(screen.getByRole("button", { name: "Health -1" }));
    expect(g.warden.adjust).toHaveBeenCalledWith("pc1", { health: -1 });
  });

  it("calls for a roll on one player's phone", () => {
    const g = game();
    open(g);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(g.warden.ask).toHaveBeenCalledWith("pc1", { kind: "save", name: "fear" });
  });
});

describe("the table drawer", () => {
  it("says there is nobody to whisper to rather than offering an empty picker", () => {
    render(<WardenPhone g={game()} net={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByText(/No phones are connected/)).toBeTruthy();
  });

  it("whispers to the phone holding that character", () => {
    const net = {
      claims: { pc1: "c_abc" }, lastActed: {}, safetyCall: null,
      inbox: [], whisper: vi.fn(), markRead: vi.fn(),
    };
    render(<WardenPhone g={game()} net={net} />);
    fireEvent.click(screen.getByRole("tab", { name: "Table" }));
    fireEvent.change(screen.getByLabelText("Say it to"), { target: { value: "pc1" } });
    fireEvent.change(screen.getByLabelText("Only they see this"), { target: { value: "The panel is warm." } });
    fireEvent.click(screen.getByRole("button", { name: "Whisper" }));
    /* Addressed by SOCKET, not by character — the character is how
       the Warden picks, the client is how it travels. */
    expect(net.whisper).toHaveBeenCalledWith("c_abc", "The panel is warm.");
  });

  it("marks what the players sent as read when it is opened", () => {
    const net = {
      claims: {}, lastActed: {}, safetyCall: null, whisper: vi.fn(), markRead: vi.fn(),
      inbox: [{ id: "m1", pcId: "pc1", text: "I pocket the keycard.", unread: true }],
    };
    render(<WardenPhone g={game()} net={net} />);
    /* The badge is part of the label — one unread makes it "Table 1". */
    fireEvent.click(screen.getByRole("tab", { name: /^Table/ }));
    expect(net.markRead).toHaveBeenCalledWith("m1");
  });
});

/* ---------------- which deck ---------------- */

describe("choosing a surface", () => {
  it("gives a laptop the desk deck", () => {
    withMedia(false);
    render(<WardenSurface g={game()} net={null} />);
    expect(screen.queryByRole("region", { name: "Warden" })).toBeNull();
  });

  it("gives a handset the one-hand deck", () => {
    withMedia(true);
    render(<WardenSurface g={game()} net={null} />);
    expect(screen.getByRole("region", { name: "Warden" })).toBeTruthy();
  });

  it("carries a door back to the desk", () => {
    withMedia(true);
    render(<WardenSurface g={game()} net={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Desk deck" }));
    expect(screen.queryByRole("region", { name: "Warden" })).toBeNull();
  });

  it("and a door back from it, on a device that would have had one", () => {
    /* Without this the only way out of the desk deck on a phone is
       a control the desk deck does not have room for. */
    withMedia(true);
    render(<WardenSurface g={game()} net={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Desk deck" }));
    fireEvent.click(screen.getByRole("button", { name: "One-hand deck" }));
    expect(screen.getByRole("region", { name: "Warden" })).toBeTruthy();
  });

  it("never offers a laptop a layout its screen does not want", () => {
    withMedia(false);
    render(<WardenSurface g={game()} net={null} />);
    expect(screen.queryByRole("button", { name: "One-hand deck" })).toBeNull();
  });

  it("remembers the choice, because furniture does not change weekly", () => {
    withMedia(true);
    const { unmount } = render(<WardenSurface g={game()} net={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Desk deck" }));
    unmount();
    render(<WardenSurface g={game()} net={null} />);
    expect(screen.queryByRole("region", { name: "Warden" })).toBeNull();
  });
});
