/* ============================================================
   THE VOTE, TESTED.

   The load-bearing block is ABSTAINING. Everything else here is
   bookkeeping; the reason this primitive exists rather than a
   `Math.max` over a tally is that "two people tapped yes" must
   not be able to end a five-person evening over the heads of
   three who were still reading.

   The other one worth reading is the last block. It asserts a
   thing the code does not do and must never start doing: there is
   no vote topic that can lift a safety card.
   ============================================================ */

import { describe, it, expect } from "vitest";
import {
  VOTE_TOPICS, VOTE_MS, openVote, castVote, tallyOf, abstaining,
  decided, expired, closeVote, voteLine,
} from "../src/engine/vote.js";

const NOW = 1_700_000_000_000;
const FIVE = ["a", "b", "c", "d", "e"];

describe("opening one", () => {
  it("fixes the electorate at the moment the question was asked", () => {
    /* So that somebody joining halfway through cannot change what a
       majority is under the people already deciding. */
    const v = openVote("callit", { of: FIVE, at: NOW });
    expect(v.of).toEqual(FIVE);
  });

  it("refuses a topic nobody declared", () => {
    expect(openVote("dissolve-parliament", { of: FIVE })).toBe(null);
  });

  it("refuses an empty table", () => {
    expect(openVote("callit", { of: [] })).toBe(null);
  });

  it("de-duplicates, so one phone is one vote", () => {
    const v = openVote("callit", { of: ["a", "a", "b"] });
    expect(v.of).toEqual(["a", "b"]);
  });

  it("carries no identity on a safety-derived question", () => {
    /* A veil vote is opened by the system, not by a person. If it
       carried `by` it would name the one phone that raised the card. */
    const v = openVote("veil", { of: FIVE, at: NOW });
    expect(v.by).toBe(null);
  });
});

describe("casting", () => {
  const base = () => openVote("callit", { of: FIVE, at: NOW });

  it("records an answer", () => {
    expect(tallyOf(castVote(base(), "a", "yes"))).toMatchObject({ yes: 1, no: 0 });
  });

  it("lets somebody change their mind rather than living in the world they mis-tapped", () => {
    let v = castVote(base(), "a", "yes");
    v = castVote(v, "a", "no");
    expect(tallyOf(v)).toMatchObject({ yes: 0, no: 1 });
  });

  it("ignores a phone that is not at this table", () => {
    expect(tallyOf(castVote(base(), "stranger", "yes")).yes).toBe(0);
  });

  it("ignores an option that does not exist", () => {
    expect(tallyOf(castVote(base(), "a", "maybe")).yes).toBe(0);
  });

  it("never mutates the vote it was handed", () => {
    const v = base();
    castVote(v, "a", "yes");
    expect(Object.keys(v.cast)).toHaveLength(0);
  });

  it("is closed once a result is in", () => {
    const done = closeVote(
      FIVE.slice(0, 3).reduce((v, id) => castVote(v, id, "yes"), base()), NOW,
    );
    expect(tallyOf(castVote(done, "d", "no")).no).toBe(0);
  });
});

/* ============================================================
   THE BLOCK THAT MATTERS
   ============================================================ */
describe("abstaining is an answer", () => {
  const base = () => openVote("callit", { of: FIVE, at: NOW });

  it("does not let two quick players call the evening", () => {
    let v = castVote(base(), "a", "yes");
    v = castVote(v, "b", "yes");
    expect(decided(v)).toBe(null);
  });

  it("counts against everybody entitled to vote, not everybody who did", () => {
    let v = castVote(base(), "a", "yes");
    v = castVote(v, "b", "yes");
    /* 2–0 is not a landslide, it is three people who have not
       answered yet. */
    expect(abstaining(v)).toBe(3);
  });

  it("passes on a real majority", () => {
    const v = FIVE.slice(0, 3).reduce((acc, id) => castVote(acc, id, "yes"), base());
    expect(decided(v)).toBe("yes");
  });

  it("needs both of two, because two people do not need a ballot but do need to agree", () => {
    const pair = openVote("callit", { of: ["a", "b"], at: NOW });
    expect(decided(castVote(pair, "a", "yes"))).toBe(null);
    expect(decided(castVote(castVote(pair, "a", "yes"), "b", "yes"))).toBe("yes");
  });
});

describe("running out of time", () => {
  const base = () => openVote("callit", { of: FIVE, at: NOW });

  it("is not expired while it is open", () => {
    expect(expired(base(), NOW + 1000)).toBe(false);
  });

  it("expires rather than passing on the answers it happened to get", () => {
    let v = castVote(base(), "a", "yes");
    v = closeVote(v, NOW + VOTE_MS + 1);
    expect(v.result).toMatchObject({ choice: "no", why: "expired" });
  });

  it("takes the conservative fallback on everything except a safety topic", () => {
    for (const [id, t] of Object.entries(VOTE_TOPICS)) {
      if (id === "veil") continue;
      expect(t.fallback).toBe("no");
    }
  });

  it("protects the person who asked, when the topic is the card", () => {
    /* The one asymmetry, and it is deliberate: everywhere else
       silence means "no change", and here it means "skip it". */
    expect(VOTE_TOPICS.veil.fallback).toBe("skip");
    const v = closeVote(openVote("veil", { of: FIVE, at: NOW }), NOW + VOTE_MS + 1);
    expect(v.result.choice).toBe("skip");
  });

  it("does not re-close a closed vote", () => {
    const first = closeVote(
      FIVE.slice(0, 3).reduce((v, id) => castVote(v, id, "yes"), base()), NOW,
    );
    expect(closeVote(first, NOW + VOTE_MS + 99).result.why).toBe("decided");
  });
});

describe("the line it leaves in the feed", () => {
  it("says nothing until it has landed", () => {
    expect(voteLine(openVote("callit", { of: FIVE, at: NOW }))).toBe(null);
  });

  it("reports the counts, so the table can see what it agreed to", () => {
    const v = closeVote(
      FIVE.slice(0, 3).reduce((acc, id) => castVote(acc, id, "yes"), openVote("callit", { of: FIVE, at: NOW })),
      NOW,
    );
    expect(voteLine(v)).toContain("3");
  });

  it("is honest about a vote nobody answered", () => {
    const v = closeVote(openVote("breather", { of: FIVE, at: NOW }), NOW + VOTE_MS + 1);
    expect(voteLine(v)).toMatch(/nothing/i);
  });
});

/* ============================================================
   WHAT IS NOT A VOTE
   ============================================================ */
describe("the safety card is not a vote and must never become one", () => {
  it("has no topic that could lift it", () => {
    /* `veil` asks what to do about the *beat*. Nothing here asks
       whether the pause should have happened, because a table that
       can outvote a stop card has a card that is worse than useless:
       it now publishes both that there was one and that the table
       overruled it. */
    const topics = Object.keys(VOTE_TOPICS);
    expect(topics).not.toContain("stop");
    expect(topics).not.toContain("resume");
    expect(topics).not.toContain("clearsafety");
  });

  it("offers only a question about the fiction, on the one safety-adjacent topic", () => {
    expect(VOTE_TOPICS.veil.options.map((o) => o.id).sort()).toEqual(["continue", "skip"]);
  });
});
