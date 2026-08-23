/** @vitest-environment jsdom */
/* ============================================================
   DYING IS AN INTERRUPTION, NOT AN ENDING.

   The failure these cover is not a crash and never was. A player
   whose character died got a beautiful card telling them so, one
   button that closed it, and then a phone with nothing on it for
   the rest of the evening — while `Contractors` and `hirelings.js`,
   the whole subsystem for bringing a new body to the table, sat on
   the Warden's screen where no player could reach them.

   With a Warden it was recoverable by a person leaning over. With
   the chair empty there is nobody to lean over, so the mode that
   needed it most had no route at all.
   ============================================================ */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DeathTakeover, { deathFrom } from "../src/ui/DeathTakeover.jsx";
import Ending from "../src/screens/Ending.jsx";
import { defineModule } from "../src/engine/defineModule.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

const dead = { survived: false, save: 30, roll: 78, name: "Riley", why: null };
const down = { survived: true, save: 30, roll: 12, name: "Riley", why: null };

describe("the takeover card offers a way back in", () => {
  it("shows the door when the character is actually dead", () => {
    render(<DeathTakeover event={dead} onDismiss={() => {}} onNewCharacter={() => {}} />);
    expect(screen.getByRole("button", { name: /take a new body/i })).toBeTruthy();
  });

  it("and takes the player to it", () => {
    const go = vi.fn();
    render(<DeathTakeover event={dead} onDismiss={() => {}} onNewCharacter={go} />);
    fireEvent.click(screen.getByRole("button", { name: /take a new body/i }));
    expect(go).toHaveBeenCalled();
  });

  it("never offers it for somebody who is merely unconscious", () => {
    /* Going down at 0 Health is not death — the Warden has already
       rolled, secretly, for when you come back. Offering a new body
       here would be the engine telling a player something the Warden
       is deliberately keeping from them. */
    render(<DeathTakeover event={down} onDismiss={() => {}} onNewCharacter={() => {}} />);
    expect(screen.queryByRole("button", { name: /take a new body/i })).toBe(null);
    expect(screen.getByRole("button", { name: /understood/i })).toBeTruthy();
  });

  it("lets somebody sit with it instead, without closing the door", () => {
    /* Dismissing is not declining. The strip in ClientShell keeps the
       offer up for as long as it is true — see the test below. */
    const dismiss = vi.fn();
    render(<DeathTakeover event={dead} onDismiss={dismiss} onNewCharacter={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /sit this one out/i }));
    expect(dismiss).toHaveBeenCalled();
  });

  it("falls back to the old single button when no route was passed", () => {
    render(<DeathTakeover event={dead} onDismiss={() => {}} />);
    expect(screen.getByRole("button", { name: /understood/i })).toBeTruthy();
  });

  it("shows the module's own line about where the next person comes from", () => {
    render(<DeathTakeover event={dead} onDismiss={() => {}} onNewCharacter={() => {}}
      arrival="Nine people live on this rock." />);
    expect(screen.getByText(/nine people live on this rock/i)).toBeTruthy();
  });

  it("and says nothing at all when the module has nothing to say", () => {
    /* Where the next person comes from is a fact about the fiction,
       which makes it the module's to state and not the engine's to
       invent. INV-6, applied to a screen rather than an NPC. */
    const { container } = render(
      <DeathTakeover event={dead} onDismiss={() => {}} onNewCharacter={() => {}} />
    );
    expect(container.querySelector(".deathover-arrival")).toBe(null);
  });
});

describe("the module may say where the next person comes from", () => {
  it("survives the trip through defineModule", () => {
    const mod = defineModule({
      id: "t", title: "T", rooms: { a: { name: "A" } }, start: "a",
      replacement: { arrival: "Somebody is about to attach themselves to your crew." },
    });
    expect(mod.replacement.arrival).toMatch(/attach themselves/);
  });

  it("is null when unwritten, rather than an empty object to test for", () => {
    const mod = defineModule({ id: "t", title: "T", rooms: { a: { name: "A" } }, start: "a" });
    expect(mod.replacement).toBe(null);
  });

  it("and the shipped module has one", () => {
    expect(ypsilon.replacement).toBeTruthy();
    expect(ypsilon.replacement.arrival).toMatch(/nine people/i);
  });

  it("which does not name anybody", () => {
    /* Ypsilon 14 has nine candidates sitting in npcs.js and the
       module deliberately picks none of them. Who it turns out to be
       is the best part and it belongs to the table. */
    const names = ["chip", "priya", "giovanni", "kantaro", "prince"];
    const text = ypsilon.replacement.arrival.toLowerCase();
    for (const n of names) expect(text.includes(n)).toBe(false);
  });
});

describe("the record of the evening, on the phone that lived it", () => {
  const mod = defineModule({
    id: "t", title: "T", rooms: { a: { name: "A" } }, start: "a",
    endings: { out: { title: "OUT", text: "You left." } },
  });
  const w = { ended: "out", clock: 120, rolls: [], clues: [], flags: {} };
  const crew = [{
    id: "riley", name: "Riley", cls: "marine", level: 0, alive: true,
    health: 8, maxHealth: 20, stress: 4, resolve: 0, xp: 2, conditions: [],
  }];
  const feed = [{ id: 1, kind: "room", text: "The bay is cold.", clock: 0 }];

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  it("offers a copy rather than a download on a handset", () => {
    /* A downloaded .md on a phone lands somewhere the person will
       never find again. Copying puts it straight into the message
       they were about to send. */
    render(<Ending mod={mod} w={w} crew={crew} feed={feed} phone onLibrary={() => {}} />);
    expect(screen.getByRole("button", { name: /copy what happened tonight/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /export the session transcript/i })).toBe(null);
  });

  it("keeps the file export on the machine that has a file system", () => {
    render(<Ending mod={mod} w={w} crew={crew} feed={feed} onLibrary={() => {}} />);
    expect(screen.getByRole("button", { name: /export the session transcript/i })).toBeTruthy();
  });

  it("copies the transcript when asked", () => {
    render(<Ending mod={mod} w={w} crew={crew} feed={feed} phone onLibrary={() => {}} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /copy what happened tonight/i }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const text = navigator.clipboard.writeText.mock.calls[0][0];
    expect(text).toContain("The bay is cold.");
  });

  it("tells the reader whose evening this is", () => {
    /* The snapshot was redacted host-side, so a player's feed holds
       what they were told and not what they were not. Six people
       take away six different and individually honest accounts, and
       none contains anybody else's secrets — which is worth saying
       out loud on the screen rather than only in a comment. */
    render(<Ending mod={mod} w={w} crew={crew} feed={feed} phone onLibrary={() => {}} />);
    expect(screen.getByText(/everyone else's copy is different/i)).toBeTruthy();
  });

  it("hides 'run it again', which a phone has never been able to do", () => {
    render(<Ending mod={mod} w={w} crew={crew} feed={feed} phone onLibrary={() => {}} />);
    expect(screen.queryByRole("button", { name: /run it again/i })).toBe(null);
  });
});

describe("deathFrom is unchanged and still first-person only", () => {
  const line = { id: 9, extra: { death: { pcId: "riley", survived: false } } };
  it("returns the event for the handset holding that character", () => {
    expect(deathFrom(line, "riley").survived).toBe(false);
  });
  it("and nothing for anybody watching it happen", () => {
    expect(deathFrom(line, "avery")).toBe(null);
  });
});
