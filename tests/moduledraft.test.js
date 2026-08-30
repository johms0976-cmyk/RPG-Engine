/* ============================================================
   A MODULE BEING WRITTEN.

   The thing worth testing is not that a field can be set. It is
   that the editor cannot produce a module the shelf refuses, and
   that the one operation with teeth — renaming a room — follows
   every reference rather than the obvious one.

   A rename that leaves a dangling exit is the exact failure that
   makes an author stop trusting an editor: it breaks something in
   a place they were not looking, and they find out three rooms
   into a session.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  blankDraft, draftFrom, compile, slug, freeRoomId,
  addRoom, setRoom, removeRoom, renameRoom,
  link, setExit, removeExit, addEnding, removeEnding,
  setRoomJson, toEnvelope, roomIds,
} from "../src/engine/moduleDraft.js";
import { readPortableModule } from "../src/engine/portableModule.js";
import { toPortable } from "../src/engine/portableModule.js";
import ypsilon from "../src/modules/ypsilon14/index.js";

/* A draft with somewhere to go and something to point at it. */
function peopled() {
  let raw = blankDraft({ title: "THE HOLD" });
  raw = addRoom(raw, "CORRIDOR").raw;
  raw = link(raw, "start", "corridor");
  raw.npcs = { cham: { name: "CHAM", start: "corridor", knows: {} } };
  raw.threats = { thing: { name: "IT", start: "corridor", retreatTo: "start", combat: 40 } };
  raw.restSpots = ["corridor"];
  raw.rooms.start.features = {
    hatch: {
      name: "The hatch",
      d: "It is open.",
      effects: [{ moveTo: "corridor" }, { npc: { id: "cham", loc: "corridor" } }],
    },
  };
  return raw;
}

describe("the smallest thing that is a module", () => {
  it("loads", () => {
    const out = compile(blankDraft());
    expect(out.ok).toBe(true);
    expect(out.problems).toEqual([]);
  });

  it("is one room, not three", () => {
    /* The template ships three because it is demonstrating gates. A
       new author's first act should be adding a room, not deleting
       two they did not write. */
    expect(roomIds(blankDraft())).toHaveLength(1);
  });

  it("takes its id from the title", () => {
    expect(blankDraft({ title: "The Thing In The Hold" }).id).toBe("the-thing-in-the-hold");
  });
});

describe("ids", () => {
  it("survives anything typed at it", () => {
    expect(slug("  A COLD START!! ")).toBe("a-cold-start");
    expect(slug("")).toBe("untitled");
    expect(slug("···")).toBe("untitled");
  });

  it("does not hand out one that is taken", () => {
    const raw = blankDraft();
    expect(freeRoomId(raw, "start")).toBe("start-2");
  });
});

describe("what the engine will say about it", () => {
  it("is the engine's own opinion and not a second one", () => {
    /* No editor-specific linting. What is on screen while you type
       is what the library card will say. */
    const raw = blankDraft();
    raw.start = "nowhere";
    const out = compile(raw);
    expect(out.ok).toBe(false);
    expect(out.problems.join(" ")).toMatch(/start room "nowhere"/);
  });

  it("reports coverage separately, because none of it is wrong", () => {
    const out = compile(blankDraft());
    expect(Array.isArray(out.coverage)).toBe(true);
    expect(out.problems).toEqual([]);
  });

  it("refuses rather than throws on rubbish", () => {
    expect(compile(null).ok).toBe(false);
    expect(compile({}).ok).toBe(false);
    expect(compile({ id: "x", title: "X", rooms: "not an object" }).ok).toBe(false);
  });

  it("never lets the editor make a file the shelf would refuse", () => {
    /* The round trip is the guarantee. Everything the editor
       produces goes back through the reader the shelf uses. */
    const raw = peopled();
    const read = readPortableModule(JSON.parse(toEnvelope(raw)));
    expect(read.ok).toBe(true);
    expect(read.mod.problems).toEqual([]);
  });
});

describe("renaming a room", () => {
  it("follows the exit that pointed at it", () => {
    const out = renameRoom(peopled(), "corridor", "spine");
    expect(out.rooms.spine).toBeTruthy();
    expect(out.rooms.corridor).toBeUndefined();
    expect(out.rooms.start.exits[0].to).toBe("spine");
  });

  it("follows the start room", () => {
    const out = renameRoom(peopled(), "start", "hold");
    expect(out.start).toBe("hold");
    expect(out.rooms.corridor.exits[0].to).toBe("hold");
  });

  it("follows an NPC and a threat, including where it retreats to", () => {
    const out = renameRoom(renameRoom(peopled(), "corridor", "spine"), "start", "hold");
    expect(out.npcs.cham.start).toBe("spine");
    expect(out.threats.thing.start).toBe("spine");
    expect(out.threats.thing.retreatTo).toBe("hold");
  });

  it("follows a moveTo BURIED IN AN EFFECT", () => {
    /* The one nobody can see from any screen. A `moveTo` four levels
       inside a gate's routes is still a room reference. */
    const out = renameRoom(peopled(), "corridor", "spine");
    expect(out.rooms.start.features.hatch.effects[0].moveTo).toBe("spine");
  });

  it("follows a room reference wearing a different key", () => {
    const out = renameRoom(peopled(), "corridor", "spine");
    expect(out.rooms.start.features.hatch.effects[1].npc.loc).toBe("spine");
  });

  it("follows a rest spot", () => {
    expect(renameRoom(peopled(), "corridor", "spine").restSpots).toEqual(["spine"]);
  });

  it("leaves the module loading cleanly afterwards", () => {
    /* The whole point. A rename that produces problems is a rename
       that broke something in a place the author was not looking. */
    const out = compile(renameRoom(peopled(), "corridor", "spine"));
    expect(out.problems).toEqual([]);
  });

  it("keeps the room where it was in the list", () => {
    const before = roomIds(peopled());
    const after = roomIds(renameRoom(peopled(), "start", "hold"));
    expect(after).toEqual(["hold", before[1]]);
  });

  it("REFUSES to merge two rooms", () => {
    /* Merging is a thing an author might want and never a thing they
       meant by typing in an id field. */
    const raw = peopled();
    expect(renameRoom(raw, "corridor", "start")).toEqual(raw);
  });

  it("refuses an empty or unchanged name", () => {
    const raw = peopled();
    expect(renameRoom(raw, "corridor", "   ")).toEqual(raw);
    expect(renameRoom(raw, "corridor", "corridor")).toEqual(raw);
  });

  it("tidies what was typed rather than storing it", () => {
    expect(renameRoom(peopled(), "corridor", "The Long Spine").rooms["the-long-spine"]).toBeTruthy();
  });
});

describe("removing a room", () => {
  it("takes the exits that led there with it", () => {
    const out = removeRoom(peopled(), "corridor");
    expect(out.rooms.start.exits).toEqual([]);
    expect(compile(out).problems).toEqual([]);
  });

  it("drops a moveTo that now points nowhere", () => {
    const out = removeRoom(peopled(), "corridor");
    expect(out.rooms.start.features.hatch.effects[0].moveTo).toBeUndefined();
  });

  it("moves the start room rather than leaving the module broken", () => {
    const out = removeRoom(peopled(), "start");
    expect(out.start).toBe("corridor");
    expect(compile(out).problems).toEqual([]);
  });

  it("will not remove the last one", () => {
    const raw = blankDraft();
    expect(removeRoom(raw, "start")).toEqual(raw);
  });
});

describe("joining rooms", () => {
  it("goes both ways, because the default must not strand anybody", () => {
    let raw = blankDraft();
    raw = addRoom(raw, "VENT").raw;
    raw = link(raw, "start", "vent");
    expect(raw.rooms.start.exits[0].to).toBe("vent");
    expect(raw.rooms.vent.exits[0].to).toBe("start");
  });

  it("goes one way when that is the choice", () => {
    let raw = blankDraft();
    raw = addRoom(raw, "VENT").raw;
    raw = link(raw, "start", "vent", { back: false });
    expect(raw.rooms.vent.exits).toEqual([]);
  });

  it("never reverses an ending, because there is nothing to come back from", () => {
    let raw = addEnding(blankDraft(), "OUT").raw;
    raw = link(raw, "start", "@out");
    expect(raw.rooms.start.exits[0].to).toBe("@out");
    expect(compile(raw).problems).toEqual([]);
  });

  it("does not make the same door twice", () => {
    let raw = addRoom(blankDraft(), "VENT").raw;
    raw = link(raw, "start", "vent");
    raw = link(raw, "start", "vent");
    expect(raw.rooms.start.exits).toHaveLength(1);
  });

  it("refuses to lead somewhere that is not there", () => {
    const raw = blankDraft();
    expect(link(raw, "start", "nowhere")).toEqual(raw);
  });
});

describe("exits and endings", () => {
  it("edits and removes a door", () => {
    let raw = link(addRoom(blankDraft(), "VENT").raw, "start", "vent");
    raw = setExit(raw, "start", 0, { label: "Crawlway", mins: 5 });
    expect(raw.rooms.start.exits[0]).toMatchObject({ to: "vent", label: "Crawlway", mins: 5 });
    raw = removeExit(raw, "start", 0);
    expect(raw.rooms.start.exits).toEqual([]);
  });

  it("takes the exits with it when an ending goes", () => {
    let raw = addEnding(blankDraft(), "OUT").raw;
    raw = link(raw, "start", "@out");
    raw = removeEnding(raw, "out");
    expect(raw.rooms.start.exits).toEqual([]);
    expect(compile(raw).problems).toEqual([]);
  });
});

describe("the raw escape hatch", () => {
  it("takes a whole room as typed JSON", () => {
    const out = setRoomJson(blankDraft(), "start", JSON.stringify({
      name: "CARGO HOLD", look: "Crates.", exits: [], features: {},
    }));
    expect(out.ok).toBe(true);
    expect(out.raw.rooms.start.name).toBe("CARGO HOLD");
  });

  it("says what is wrong with it rather than swallowing it", () => {
    expect(setRoomJson(blankDraft(), "start", "{ nope").ok).toBe(false);
    expect(setRoomJson(blankDraft(), "start", "[1,2]").error).toMatch(/JSON object/);
  });
});

describe("opening something that already exists", () => {
  it("REFUSES a bundled module that runs JavaScript, and says why", () => {
    /* The honest answer, and not the one the roadmap implied. Both
       shipped modules carry `hooks` — Ypsilon has thirty-one — and a
       portable module cannot. `toPortable` says what was lost; this
       says the same thing at the door, with the real reason rather
       than a dangling-reference error the author cannot act on. */
    const { json, lost } = toPortable(ypsilon);
    expect(lost.join(" ")).toMatch(/hooks:/);
    const out = draftFrom(json);
    expect(out.ok).toBe(false);
    expect(out.detail.join(" ")).toMatch(/cannot carry hooks/);
  });

  it("opens one that does not", () => {
    /* Which is every module written IN the editor, and every .mship
       file the shelf will accept — the format cannot carry hooks, so
       anything it loaded can be reopened. */
    const out = draftFrom(toEnvelope(peopled()));
    expect(out.ok).toBe(true);
    expect(roomIds(out.raw)).toEqual(["start", "corridor"]);
  });

  it("does NOT adopt the engine's defaults as the author's choices", () => {
    /* Opening a module and saving it untouched must not turn every
       default — the auto map, the derived director, the standard
       subtitle — into something the author explicitly declared. */
    const out = draftFrom(toEnvelope(blankDraft()));
    expect(out.ok).toBe(true);
    expect(out.raw.map).toBeUndefined();
    expect(out.raw.director).toBeUndefined();
    expect(out.raw.subtitle).toBeUndefined();
  });

  it("refuses a save, which is the file most likely to be handed to it", () => {
    const out = draftFrom(JSON.stringify({ kind: "rpg-engine-save", v: 1 }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/not a module/);
  });
});

describe("editing does not mutate", () => {
  it("leaves the draft it was handed alone", () => {
    /* React state. An operation that mutates in place renders
       nothing, which reads as the editor ignoring you. */
    const before = peopled();
    const snapshot = JSON.stringify(before);
    renameRoom(before, "corridor", "spine");
    removeRoom(before, "corridor");
    setRoom(before, "start", { look: "changed" });
    link(before, "corridor", "start");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
