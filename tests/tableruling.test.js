/* ============================================================
   TABLE RULINGS — the threshold, asserted without a table.

   `tableRuling.js` is pure for the same reason `objection.js` is:
   the whole of the quorum behaviour should be provable without a
   host, a socket or a rendered tree, because that is the part
   that must not drift.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  propose, second, lapse, emptyProposals,
  PROPOSAL_WINDOW_MS, PROPOSAL_QUORUM, PROPOSAL_ERRORS, PROPOSAL_NOTED,
} from "../src/engine/tableRuling.js";
import { SCOPE, commitRuling } from "../src/engine/ruling.js";
import { roomAddendum, rulingNouns, thingAnswer } from "../src/engine/ruling.js";

const T0 = 1_000_000;
const spec = (over = {}) => ({
  text: "The ceiling panel comes down on four wing-nuts. One is missing.",
  scope: SCOPE.ROOM,
  room: "work",
  by: "pc1",
  ...over,
});

describe("proposing", () => {
  it("does not make anything true on its own", () => {
    const r = propose(emptyProposals(), spec(), T0);
    expect(r.error).toBeNull();
    expect(r.next.open).toBeTruthy();
    /* The gap between saying and being is the entire file. */
    expect(r.next.open.ruling.text).toContain("wing-nuts");
    expect(r.said).toBe(PROPOSAL_NOTED);
  });

  it("stores the human's sentence verbatim — INV-1", () => {
    const text = "  The grille is painted over and the paint is fresh.  ";
    const r = propose(emptyProposals(), spec({ text }), T0);
    // Trimmed, and otherwise untouched. Nothing rewrote it.
    expect(r.next.open.ruling.text).toBe(text.trim());
  });

  it("refuses a ruling about a thing with no thing named", () => {
    const r = propose(emptyProposals(), spec({ scope: SCOPE.THING, subject: "" }), T0);
    expect(r.error).toBeTruthy();
    expect(r.next.open).toBeFalsy();
  });

  it("refuses an empty sentence", () => {
    expect(propose(emptyProposals(), spec({ text: "   " }), T0).error).toBeTruthy();
  });

  it("cannot be made private, whatever the caller passes", () => {
    const r = propose(emptyProposals(), { ...spec(), told: ["pc1", "pc2"] }, T0);
    /* A table cannot keep a secret from itself. `told` is not a
       parameter and must not survive being passed anyway. */
    expect(r.next.open.ruling.told).toBeNull();
  });

  it("replaces an unseconded proposal rather than queueing it", () => {
    const a = propose(emptyProposals(), spec({ text: "The hatch is welded." }), T0);
    const b = propose(a.next, spec({ text: "The panel is loose." }), T0 + 1000);
    expect(b.next.open.ruling.text).toBe("The panel is loose.");
    // Reported, not dropped silently.
    expect(b.replaced).toBe("The hatch is welded.");
  });
});

describe("the second voice", () => {
  it("takes two different people", () => {
    const p = propose(emptyProposals(), spec({ by: "pc1" }), T0);
    const s = second(p.next, "pc2", T0 + 5000);
    expect(s.carried).toBe(true);
    expect(s.ruling.by).toBe("table");
    expect(PROPOSAL_QUORUM).toBe(2);
  });

  it("REFUSES A PROPOSER SECONDING THEMSELVES — this is the whole mechanism", () => {
    const p = propose(emptyProposals(), spec({ by: "pc1" }), T0);
    const s = second(p.next, "pc1", T0 + 5000);
    expect(s.carried).toBe(false);
    expect(s.error).toBe(PROPOSAL_ERRORS.OWN);
    /* Without this, one player makes anything true by tapping
       twice and the file has no purpose. */
    expect(s.next.open).toBeTruthy();
  });

  it("lapses after the window rather than carrying late", () => {
    const p = propose(emptyProposals(), spec(), T0);
    const s = second(p.next, "pc2", T0 + PROPOSAL_WINDOW_MS + 1);
    expect(s.carried).toBe(false);
    expect(s.error).toBe(PROPOSAL_ERRORS.GONE);
    expect(s.next.open).toBeFalsy();
  });

  it("clears on carry, so a third tap cannot cascade", () => {
    const p = propose(emptyProposals(), spec(), T0);
    const s = second(p.next, "pc2", T0 + 1000);
    expect(s.next.open).toBeFalsy();
    expect(second(s.next, "pc3", T0 + 2000).carried).toBe(false);
  });

  it("says so when there is nothing open", () => {
    expect(second(emptyProposals(), "pc2", T0).error).toBe(PROPOSAL_ERRORS.NONE);
  });
});

describe("a carried ruling behaves like the Warden's own", () => {
  it("reaches the room description, so the room stops contradicting the table", () => {
    const p = propose(emptyProposals(), spec({ room: "work" }), T0);
    const s = second(p.next, "pc2", T0 + 1000);
    const w = commitRuling({ rulings: [] }, s.ruling);

    const lines = roomAddendum(w, "work");
    expect(lines.join(" ")).toContain("wing-nuts");
  });

  it("becomes a noun the parser can match, so the table can act on it", () => {
    const p = propose(
      emptyProposals(),
      spec({ scope: SCOPE.THING, subject: "ceiling panel", room: "work" }),
      T0,
    );
    const s = second(p.next, "pc2", T0 + 1000);
    const w = commitRuling({ rulings: [] }, s.ruling);

    expect(rulingNouns(w, "work")).toContain("ceiling panel");
    expect(thingAnswer(w, "work", "ceiling panel")).toBeTruthy();
  });

  it("is public — every phone sees it", () => {
    const p = propose(emptyProposals(), spec(), T0);
    const s = second(p.next, "pc2", T0 + 1000);
    const w = commitRuling({ rulings: [] }, s.ruling);
    for (const viewer of ["pc1", "pc2", "pc3", "pc9"]) {
      expect(roomAddendum(w, "work", { viewerPcId: viewer }).length).toBe(1);
    }
  });
});

describe("lapsing", () => {
  it("clears a stale proposal and keeps a fresh one", () => {
    const p = propose(emptyProposals(), spec(), T0);
    expect(lapse(p.next, T0 + 1000).open).toBeTruthy();
    expect(lapse(p.next, T0 + PROPOSAL_WINDOW_MS + 1).open).toBeFalsy();
  });

  it("survives a junk ledger", () => {
    expect(lapse(null, T0)).toEqual(emptyProposals());
    expect(second(undefined, "pc1", T0).carried).toBe(false);
    expect(propose(null, spec(), T0).error).toBeNull();
  });
});
