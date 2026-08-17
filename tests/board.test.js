import { describe, it, expect } from "vitest";
import {
  makeClue, addClue, resolveClue, dropClue, visibleClues, isDuplicateClue,
  makeMark, addMark, dropMark, canRemoveMark, marksIn, markSummary,
} from "../src/engine/board.js";

describe("the clue board", () => {
  it("keeps open clues above resolved ones, newest first", () => {
    let c = [];
    c = addClue(c, makeClue({ text: "old", clock: 10 }));
    c = addClue(c, makeClue({ text: "new", clock: 90 }));
    c = addClue(c, makeClue({ text: "done", clock: 50 }));
    c = resolveClue(c, c[2].id);
    const order = visibleClues(c, false).map((x) => x.text);
    expect(order).toEqual(["new", "old", "done"]);
  });

  it("hides Warden-only clues from players", () => {
    const c = [makeClue({ text: "public" }), makeClue({ text: "hidden", secret: true })];
    expect(visibleClues(c, false)).toHaveLength(1);
    expect(visibleClues(c, true)).toHaveLength(2);
  });

  it("spots a re-pinned clue however it was typed", () => {
    const c = [makeClue({ text: "Door code 4471" })];
    expect(isDuplicateClue(c, "door code 4471")).toBe(true);
    expect(isDuplicateClue(c, "DOOR-CODE 4471!")).toBe(true);
    expect(isDuplicateClue(c, "Door code 1174")).toBe(false);
  });

  it("caps runaway text and falls back to a real kind", () => {
    const c = makeClue({ text: "x".repeat(500), kind: "nonsense" });
    expect(c.text.length).toBe(240);
    expect(c.kind).toBe("fact");
  });

  it("removes a clue without touching the others", () => {
    const a = makeClue({ text: "a" }), b = makeClue({ text: "b" });
    expect(dropClue([a, b], a.id)).toEqual([b]);
  });
});

describe("map marks", () => {
  it("collects marks by room", () => {
    const m = [
      makeMark({ room: "bridge", kind: "danger" }),
      makeMark({ room: "hold", kind: "safe" }),
      makeMark({ room: "bridge", kind: "note" }),
    ];
    expect(marksIn(m, "bridge")).toHaveLength(2);
  });

  it("lets the loudest mark speak for the room", () => {
    const m = [
      makeMark({ room: "bridge", kind: "note" }),
      makeMark({ room: "bridge", kind: "danger" }),
      makeMark({ room: "bridge", kind: "safe" }),
    ];
    const s = markSummary(m);
    expect(s.bridge.kind).toBe("danger");
    expect(s.bridge.count).toBe(3);
  });

  it("lets you rub out your own and not somebody else's", () => {
    const mine = makeMark({ room: "a", by: "pc1" });
    expect(canRemoveMark(mine, { pcId: "pc1" })).toBe(true);
    expect(canRemoveMark(mine, { pcId: "pc2" })).toBe(false);
    expect(canRemoveMark(mine, { pcId: "pc2", isWarden: true })).toBe(true);
  });

  it("keeps mark text short enough to sit on a map", () => {
    expect(makeMark({ room: "a", text: "y".repeat(200) }).text.length).toBe(60);
  });

  it("gives every mark its own id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeMark({ room: "a" }).id));
    expect(ids.size).toBe(50);
  });
});
