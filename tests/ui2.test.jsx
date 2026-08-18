// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RollTheatre from "../src/ui/RollTheatre.jsx";
import Feed2, { classify } from "../src/ui/Feed2.jsx";
import ClueBoard from "../src/ui/ClueBoard.jsx";
import Approvals from "../src/screens/Approvals.jsx";
import CreatorPhone from "../src/screens/CreatorPhone.jsx";
import { dreadLevel } from "../src/screens/PhoneShell.jsx";
import { makeClue } from "../src/engine/board.js";
import { exportCharacter } from "../src/engine/portable.js";
import { makeCharacter } from "../src/engine/rules.js";

const MOD = {
  id: "test", items: { crowbar: { n: "Crowbar" } },
  loadouts: { excavation: { name: "Excavation", items: ["crowbar"] } },
  rooms: {}, crewSize: { min: 1, max: 6, suggested: 1 },
};

describe("roll theatre", () => {
  const roll = (o) => ({ value: 34, target: 45, margin: 11, success: true, critHit: false, critFail: false, mode: "none", who: "LILITH", label: "Speed", all: [], ...o });

  it("shows the number, the target and the verdict", () => {
    render(<RollTheatre roll={roll()} />);
    expect(screen.getByText("34")).toBeTruthy();
    expect(screen.getByText(/needs 45 or under/)).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
  });

  it("pads a single digit, because a d100 shows two", () => {
    render(<RollTheatre roll={roll({ value: 7, success: true, margin: 38 })} />);
    expect(screen.getByText("07")).toBeTruthy();
  });

  it("calls a critical by its matching digits", () => {
    render(<RollTheatre roll={roll({ value: 33, critHit: true })} />);
    expect(screen.getByText("Critical success")).toBeTruthy();
    expect(screen.getByText(/Matching digits/)).toBeTruthy();
  });

  it("names a critical failure as such", () => {
    render(<RollTheatre roll={roll({ value: 77, success: false, critFail: true })} />);
    expect(screen.getByText("Critical failure")).toBeTruthy();
  });

  it("shows both dice when rolled with advantage", () => {
    render(<RollTheatre roll={roll({ mode: "advantage", all: [{ value: 12 }, { value: 61 }] })} />);
    expect(screen.getByText(/Advantage/)).toBeTruthy();
    expect(screen.getByText(/12 \/ 61/)).toBeTruthy();
  });

  it("clears itself after the hold", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<RollTheatre roll={roll()} onDone={done} holdMs={1000} />);
    vi.advanceTimersByTime(1100);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("renders nothing without a roll", () => {
    const { container } = render(<RollTheatre roll={null} />);
    expect(container.firstChild).toBe(null);
  });
});

describe("the split feed", () => {
  it("tells fiction, mechanics, panic and whispers apart", () => {
    expect(classify({ kind: "room" })).toBe("say");
    expect(classify({ kind: "npc" })).toBe("say");
    expect(classify({ kind: "rollgood" })).toBe("mech");
    expect(classify({ kind: "item" })).toBe("mech");
    expect(classify({ kind: "panic" })).toBe("panic");
    expect(classify({ kind: "room", to: "pc1" })).toBe("whisper");
  });

  it("gives each register its own class", () => {
    const { container } = render(<Feed2 feed={[
      { id: 1, kind: "room", text: "The corridor is dark." },
      { id: 2, kind: "rollgood", text: "CHECK · 34" },
      { id: 3, kind: "panic", text: "PANICS" },
    ]} autoScroll={false} />);
    expect(container.querySelector(".feed2-say")).toBeTruthy();
    expect(container.querySelector(".feed2-mech")).toBeTruthy();
    expect(container.querySelector(".feed2-panic")).toBeTruthy();
  });

  it("marks a phantom line so it can be styled apart", () => {
    const { container } = render(<Feed2 feed={[{ id: -1, kind: "room", text: "x", phantom: true }]} autoScroll={false} />);
    expect(container.querySelector(".feed2-phantom")).toBeTruthy();
  });

  it("says so when nothing has happened", () => {
    render(<Feed2 feed={[]} />);
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
  });
});

describe("clue board", () => {
  it("lists what is pinned and how much is open", () => {
    render(<ClueBoard clues={[makeClue({ text: "Door code 4471", kind: "code" })]} />);
    expect(screen.getByText("Door code 4471")).toBeTruthy();
    expect(screen.getByText(/1 open/)).toBeTruthy();
  });

  it("pins what you type", () => {
    const onPin = vi.fn();
    render(<ClueBoard clues={[]} onPin={onPin} />);
    fireEvent.change(screen.getByPlaceholderText(/Door code/), { target: { value: "Voss is lying" } });
    fireEvent.click(screen.getByText("Pin"));
    expect(onPin).toHaveBeenCalledWith("Voss is lying", "fact", { secret: false });
  });

  it("will not pin nothing", () => {
    const onPin = vi.fn();
    render(<ClueBoard clues={[]} onPin={onPin} />);
    fireEvent.click(screen.getByText("Pin"));
    expect(onPin).not.toHaveBeenCalled();
  });

  it("offers a Warden-only pin only to the Warden", () => {
    const { rerender } = render(<ClueBoard clues={[]} />);
    expect(screen.queryByText("Public")).toBe(null);
    rerender(<ClueBoard clues={[]} isWarden />);
    expect(screen.getByText("Public")).toBeTruthy();
  });

  it("hides a Warden-only clue from a player", () => {
    const clues = [makeClue({ text: "the reactor is the point", secret: true })];
    render(<ClueBoard clues={clues} />);
    expect(screen.queryByText("the reactor is the point")).toBe(null);
  });
});

describe("the approval queue", () => {
  const offer = (mutate) => {
    const pc = makeCharacter({
      name: "ABEL", cls: "android",
      stats: { strength: 30, speed: 30, intellect: 40, combat: 30 },
      skills: ["Computers", "Mathematics", "Linguistics", "Rimwise", "Art"],
      loadout: "excavation",
    }, MOD);
    const file = exportCharacter(pc, { moduleId: "test" });
    if (mutate) mutate(file.pc);
    return [{ id: "1", clientId: "A", from: "Ana", character: file }];
  };

  it("says nothing is waiting when nothing is", () => {
    render(<Approvals queue={[]} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText(/Nothing waiting/)).toBeTruthy();
  });

  it("shows a clean character as legal", () => {
    render(<Approvals queue={offer()} mod={MOD} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText("ABEL")).toBeTruthy();
    expect(screen.getByText(/Legal/)).toBeTruthy();
    expect(screen.getByText("Let them in")).toBeTruthy();
  });

  it("shows what is wrong with an edited one, and still lets the Warden decide", () => {
    render(<Approvals queue={offer((pc) => { pc.stats.combat = 85; pc.maxHealth = 999; })}
      mod={MOD} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getAllByText(/impossible/).length).toBeGreaterThan(0);
    expect(screen.getByText("Let them in anyway")).toBeTruthy();
  });

  it("hands the entry back on a decision", () => {
    const onAccept = vi.fn();
    const q = offer();
    render(<Approvals queue={q} mod={MOD} onAccept={onAccept} onReject={() => {}} />);
    fireEvent.click(screen.getByText("Let them in"));
    expect(onAccept).toHaveBeenCalledWith(q[0]);
  });
});

describe("building a character on a phone", () => {
  const next = () => fireEvent.click(screen.getByText("Next").closest("button"));
  const tap = (label) => fireEvent.click(screen.getByText(label).closest("button"));
  const pointsLeft = () => Number(document.querySelector(".wiz-points .n").dataset.points);

  it("will not leave the name step without a name", () => {
    render(<CreatorPhone mod={MOD} onOffer={() => {}} />);
    expect(screen.getByText("Not yet").closest("button").disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "ANA" } });
    expect(screen.getByText("Next").closest("button").disabled).toBe(false);
  });

  it("carries the player's name in as a starting point", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    expect(screen.getByLabelText("Name").value).toBe("ANA");
  });

  /* The skill step is the one that has been broken before: it listed the
     three tier *names* instead of the skills inside them, so there was
     nothing on screen to spend a point on. Naming a real skill here is
     what stops that coming back. */
  it("offers real skills to spend points on", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    next(); next(); next();               // name -> stats -> class -> skills
    expect(screen.getByText("Rimwise")).toBeTruthy();
    expect(screen.getByText("Hacking")).toBeTruthy();
    expect(screen.queryByText("trained · 1 point · +10%")).toBeTruthy();
  });

  it("will not pass the skill step with points unspent", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    next(); next(); next();
    expect(screen.getByText("Not yet").closest("button").disabled).toBe(true);
    expect(screen.getByText(/1 more class skill/)).toBeTruthy();
    tap("Piloting");
    expect(screen.getByText(/4 skill points/)).toBeTruthy();
  });

  it("counts spent points down and lets a skill be taken back", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    next(); next(); next();
    tap("Piloting");                       // the free class pick
    tap("Rimwise");                        // 1 point
    expect(pointsLeft()).toBe(3);
    tap("Rimwise");                        // and back off again
    expect(pointsLeft()).toBe(4);
  });

  it("offers a legal character once every step is done", () => {
    const onOffer = vi.fn();
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={onOffer} />);
    next(); next(); next();
    // Teamster: 4 points, plus 1 free pick from Heavy Machinery / Piloting.
    tap("Piloting");
    for (const s of ["Rimwise", "Athletics", "Art", "Chemistry"]) tap(s);
    next();                                // -> loadout
    tap("Excavation");
    next();                                // -> review
    fireEvent.click(screen.getByText("Offer to the Warden").closest("button"));
    expect(onOffer).toHaveBeenCalled();
    const file = onOffer.mock.calls[0][0];
    expect(file.kind).toBe("mothership-character");
    expect(file.pc.skills).toEqual(
      expect.arrayContaining(["Zero-G", "Mechanical Repair", "Piloting", "Rimwise"]),
    );
  });

  it("drops skills that depended on one you take back", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    next(); next(); next();
    tap("Piloting");
    tap("Computers");                      // 1 point, trained
    tap("Hacking");                        // 2 points, needs Computers
    expect(pointsLeft()).toBe(1);
    tap("Computers");                      // pulls the rug out from Hacking
    expect(pointsLeft()).toBe(4);
  });

  it("lets you step back through the crumb rail but not skip ahead", () => {
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} />);
    next();
    expect(screen.getByText("Name").closest("button").disabled).toBe(false);
    expect(screen.getByText("Kit").closest("button").disabled).toBe(true);
    fireEvent.click(screen.getByText("Name").closest("button"));
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("cancels out of the first step rather than going nowhere", () => {
    const onBack = vi.fn();
    render(<CreatorPhone mod={MOD} playerName="Ana" onOffer={() => {}} onBack={onBack} />);
    fireEvent.click(screen.getByText("Cancel").closest("button"));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("dread", () => {
  it("stays quiet while Stress is survivable, then climbs", () => {
    expect(dreadLevel(0)).toBe(0);
    expect(dreadLevel(2)).toBe(0);
    expect(dreadLevel(4)).toBe(1);
    expect(dreadLevel(7)).toBe(2);
    expect(dreadLevel(10)).toBe(3);
    expect(dreadLevel(14)).toBe(4);
    expect(dreadLevel(19)).toBe(5);
  });
});

describe("image hotspot maps", () => {
  const FLOOR = {
    id: "f1", name: "Floor 1",
    image: { src: "/maps/deep-f1.webp", w: 2000, h: 1400 },
    hotspots: { reactor: { x: 410, y: 880, w: 220, h: 160 }, bridge: { x: 100, y: 100, w: 200, h: 150 } },
  };
  const IMOD = { rooms: { reactor: { name: "Reactor" }, bridge: { name: "Bridge" } } };
  const IW = { room: "bridge", visited: { bridge: true }, searched: {}, flags: {} };

  it("renders the authored art rather than redrawing the deck", async () => {
    const { default: ImageMap } = await import("../src/ui/ImageMap.jsx");
    const { container } = render(<ImageMap mod={IMOD} w={IW} floor={FLOOR} wardenView />);
    const image = container.querySelector("image");
    expect(image.getAttribute("href")).toBe("/maps/deep-f1.webp");
    expect(container.querySelector("svg").getAttribute("viewBox")).toBe("0 0 2000 1400");
  });

  it("draws nothing at all when the floor has no art", async () => {
    const { default: ImageMap, hasImage } = await import("../src/ui/ImageMap.jsx");
    expect(hasImage({ id: "x" })).toBe(false);
    const { container } = render(<ImageMap mod={IMOD} w={IW} floor={{ id: "x" }} />);
    expect(container.firstChild).toBe(null);
  });

  it("marks the room the crew is standing in", async () => {
    const { default: ImageMap } = await import("../src/ui/ImageMap.jsx");
    const { container } = render(<ImageMap mod={IMOD} w={IW} floor={FLOOR} wardenView />);
    expect(container.querySelector('rect[stroke="#F5C518"]')).toBeTruthy();
  });

  it("paints a mark glyph over a flagged room", async () => {
    const { default: ImageMap } = await import("../src/ui/ImageMap.jsx");
    const { makeMark } = await import("../src/engine/board.js");
    const { container } = render(
      <ImageMap mod={IMOD} w={IW} floor={FLOOR} wardenView marks={[makeMark({ room: "reactor", kind: "danger" })]} />
    );
    expect(container.querySelector('text[fill="#E24B4A"]')).toBeTruthy();
  });
});
