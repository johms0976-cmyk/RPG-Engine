import { describe, it, expect } from "vitest";
import {
  makeRuling, commitRuling, retireRuling, rulingsFor, roomAddendum,
  thingAnswer, rulingNouns, wardenLedger, rulingsMarkdown, upgradeWorld,
  SCOPE, RULING_ERRORS, MAX_RULING,
} from "../src/engine/ruling.js";

const W0 = { room: "bay", rulings: [] };
const put = (w, spec) => {
  const { ruling, error } = makeRuling(spec);
  if (error) throw new Error(error);
  return commitRuling(w, ruling);
};

describe("making a ruling", () => {
  it("stores the human's sentence verbatim and invents nothing", () => {
    const { ruling } = makeRuling({ text: "It is on four wing-nuts and one is missing.", room: "bay" });
    expect(ruling.text).toBe("It is on four wing-nuts and one is missing.");
    expect(ruling.scope).toBe(SCOPE.ROOM);
  });

  it("refuses an empty one", () => {
    expect(makeRuling({ text: "   ", room: "bay" }).error).toBe(RULING_ERRORS.EMPTY);
  });

  it("refuses one too long to read out", () => {
    expect(makeRuling({ text: "x".repeat(MAX_RULING + 1), room: "bay" }).error).toBe(RULING_ERRORS.LONG);
  });

  it("insists a ruling about one thing names the thing", () => {
    expect(makeRuling({ text: "It comes down.", scope: SCOPE.THING, room: "bay" }).error)
      .toBe(RULING_ERRORS.NO_SUBJECT);
  });

  it("lets a standing fact have no room", () => {
    expect(makeRuling({ text: "Nothing on this rock has a working radio.", scope: SCOPE.WORLD }).ruling)
      .toBeTruthy();
  });

  it("never mutates the world it is committed to", () => {
    const before = { ...W0, rulings: [] };
    const after = put(before, { text: "A fact.", room: "bay" });
    expect(before.rulings).toHaveLength(0);
    expect(after.rulings).toHaveLength(1);
  });
});

describe("a ruling stays true", () => {
  it("comes back on the room it was made in", () => {
    const w = put(W0, { text: "The ceiling panel is loose.", room: "bay" });
    expect(roomAddendum(w, "bay")).toEqual(["The ceiling panel is loose."]);
  });

  it("does not leak into a room it was not made in", () => {
    const w = put(W0, { text: "The ceiling panel is loose.", room: "bay" });
    expect(roomAddendum(w, "galley")).toEqual([]);
  });

  it("answers a look addressed at the thing by name", () => {
    const w = put(W0, {
      text: "Four wing-nuts, one missing.", scope: SCOPE.THING,
      subject: "ceiling panel", room: "bay",
    });
    expect(thingAnswer(w, "bay", "ceiling panel").text).toBe("Four wing-nuts, one missing.");
  });

  it("matches the name loosely, because two people type it", () => {
    const w = put(W0, {
      text: "Four wing-nuts.", scope: SCOPE.THING, subject: "Ceiling Panel", room: "bay",
    });
    expect(thingAnswer(w, "bay", "the ceiling panel")).toBeTruthy();
    expect(thingAnswer(w, "bay", "panel")).toBeTruthy();
    expect(thingAnswer(w, "bay", "airlock")).toBeNull();
  });

  it("prefers the most recent thing said about it", () => {
    let w = put(W0, { text: "It is loose.", scope: SCOPE.THING, subject: "panel", room: "bay" });
    w = put(w, { text: "It is off, and there is a duct behind it.", scope: SCOPE.THING, subject: "panel", room: "bay" });
    expect(thingAnswer(w, "bay", "panel").text).toMatch(/duct behind it/);
  });

  it("hands the parser a noun it did not have", () => {
    const w = put(W0, {
      text: "Four wing-nuts.", scope: SCOPE.THING, subject: "ceiling panel", room: "bay",
    });
    expect(rulingNouns(w, "bay")).toEqual(["ceiling panel"]);
    expect(rulingNouns(w, "galley")).toEqual([]);
  });
});

describe("a ruling can be taken back without being erased", () => {
  it("stops being true", () => {
    const w = put(W0, { text: "The door is welded.", room: "bay" });
    const id = w.rulings[0].id;
    const after = retireRuling(w, id, "the module already said otherwise");
    expect(roomAddendum(after, "bay")).toEqual([]);
  });

  it("stays on the Warden's own ledger, because the table heard it", () => {
    const w = put(W0, { text: "The door is welded.", room: "bay" });
    const after = retireRuling(w, w.rulings[0].id);
    expect(wardenLedger(after)).toHaveLength(1);
    expect(wardenLedger(after)[0].retired).toBe(true);
  });
});

describe("the redaction trap", () => {
  const secret = () => put(W0, {
    text: "You and only you notice the second set of prints.",
    room: "bay", told: ["pc1"],
  });

  it("shows a private ruling to the person it was told to", () => {
    expect(rulingsFor(secret(), { viewerPcId: "pc1" })).toHaveLength(1);
  });

  it("hides it from everybody else", () => {
    expect(rulingsFor(secret(), { viewerPcId: "pc2" })).toHaveLength(0);
  });

  it("hides it from the shared table screen, which is the one that bites", () => {
    // The table view has no viewer. A private ruling on it is a secret
    // published to the whole room.
    expect(rulingsFor(secret(), { viewerPcId: null })).toHaveLength(0);
    expect(roomAddendum(secret(), "bay", { viewerPcId: null })).toEqual([]);
  });

  it("shows it to the Warden, who is allowed to know", () => {
    expect(rulingsFor(secret(), { isWarden: true })).toHaveLength(1);
  });

  it("keeps a public ruling public", () => {
    const w = put(W0, { text: "The lights are out in here.", room: "bay" });
    expect(rulingsFor(w, { viewerPcId: null })).toHaveLength(1);
    expect(rulingsFor(w, { viewerPcId: "pc9" })).toHaveLength(1);
  });
});

describe("the record", () => {
  it("gathers rulings into their own section of the transcript", () => {
    const w = put(W0, { text: "The ceiling panel is loose.", room: "bay" });
    const md = rulingsMarkdown(w, { isWarden: true });
    expect(md).toMatch(/Rulings made at the table/);
    expect(md).toMatch(/ceiling panel is loose/);
  });

  it("keeps a private ruling out of a transcript built for somebody else", () => {
    const w = put(W0, { text: "Only you saw it.", room: "bay", told: ["pc1"] });
    expect(rulingsMarkdown(w, { viewerPcId: "pc2" })).toBe("");
    expect(rulingsMarkdown(w, { viewerPcId: "pc1" })).toMatch(/Only you saw it/);
  });

  it("shows the Warden what was taken back", () => {
    const w = retireRuling(put(W0, { text: "Welded.", room: "bay" }), null);
    const w2 = retireRuling(put(W0, { text: "Welded.", room: "bay" }), undefined);
    expect(rulingsMarkdown(w, { isWarden: true })).toBeDefined();
    expect(rulingsMarkdown(w2, { isWarden: true })).toBeDefined();
  });

  it("says nothing at all when nothing was ruled", () => {
    expect(rulingsMarkdown(W0, { isWarden: true })).toBe("");
  });
});

describe("old saves", () => {
  it("survive a world written before this existed", () => {
    const ancient = { room: "bay" };
    expect(roomAddendum(ancient, "bay")).toEqual([]);
    expect(rulingNouns(ancient, "bay")).toEqual([]);
    expect(wardenLedger(ancient)).toEqual([]);
    expect(upgradeWorld(ancient).rulings).toEqual([]);
  });

  it("leaves an already-upgraded world alone", () => {
    const w = { room: "bay", rulings: [{ id: "x" }] };
    expect(upgradeWorld(w)).toBe(w);
  });
});
