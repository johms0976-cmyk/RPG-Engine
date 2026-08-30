/* ============================================================
   THE MISSES — the listener backlog nobody has to write.

   Every sentence that fell through to the oracle is a sentence
   the module had no answer for. The record was already being
   kept; nobody was reading it.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  missesFrom, backlog, backlogMarkdown, keywords,
} from "../src/engine/misses.js";

const miss = (text, room = "work") => ({
  id: 1, kind: "system", text: "[oracle · unlikely · rolled 40 vs 25]",
  room, extra: { miss: text },
});

describe("finding them", () => {
  it("reads the sentence off the oracle marker", () => {
    const got = missesFrom([miss("I crawl into the vents")]);
    expect(got).toHaveLength(1);
    expect(got[0].text).toBe("I crawl into the vents");
    expect(got[0].room).toBe("work");
  });

  it("ignores ordinary feed lines", () => {
    const feed = [
      { kind: "warden", text: "The lights flicker." },
      { kind: "you", text: "look" },
      miss("I weld the hatch shut"),
    ];
    expect(missesFrom(feed)).toHaveLength(1);
  });

  it("survives a feed full of junk", () => {
    expect(missesFrom(null)).toEqual([]);
    expect(missesFrom([null, undefined, {}, { extra: {} }])).toEqual([]);
    expect(missesFrom([{ extra: { miss: 42 } }])).toEqual([]);
  });
});

describe("keywords", () => {
  it("keeps what somebody was trying to do", () => {
    expect(keywords("I crawl into the vents")).toEqual(["crawl", "vents"]);
  });

  it("drops the words that would put everything in one bucket", () => {
    /* Grouping on "the" or "we" gives one group containing every
       sentence, which is the same as no grouping at all. */
    expect(keywords("we should just try to get the thing")).not.toContain("the");
    expect(keywords("we should just try to get the thing")).not.toContain("try");
  });
});

describe("the backlog", () => {
  const feed = [
    miss("I crawl into the vents"),
    miss("can we get into the vents"),
    miss("look inside the vents", "medbay"),
    miss("I weld the hatch shut"),
  ];

  it("groups by what the sentences were about, commonest first", () => {
    const got = backlog(feed);
    expect(got[0].word).toBe("vents");
    expect(got[0].n).toBe(3);
  });

  it("COUNTS EACH SENTENCE ONCE", () => {
    /* "I crawl into the vents" has two content words. Listing it
       under both makes a backlog of four sentences look like a
       backlog of seven, and an author cannot tell how much work
       is actually in front of them. */
    const total = backlog(feed).reduce((n, g) => n + g.n, 0);
    expect(total).toBe(4);
  });

  it("keeps the one-offs, at the bottom", () => {
    /* The sentence a single playtester tried is sometimes the best
       idea anybody had, so it is listed rather than thresholded
       away — just beneath the things several people tried.

       Which of its content words names the group is decided
       alphabetically among equals: "I weld the hatch shut" lands
       under `hatch`, not `weld`. Arbitrary, deliberately
       deterministic, and it does not matter — the author is
       reading the sentence, not the heading. */
    const words = backlog(feed).map((g) => g.word);
    expect(words).toContain("hatch");
    expect(words.indexOf("hatch")).toBeGreaterThan(words.indexOf("vents"));
    const hatch = backlog(feed).find((g) => g.word === "hatch");
    expect(hatch.items[0].text).toBe("I weld the hatch shut");
  });

  it("keeps the room, so an author knows where to put the listener", () => {
    const vents = backlog(feed).find((g) => g.word === "vents");
    expect(vents.items.map((m) => m.room)).toContain("medbay");
  });
});

describe("the report", () => {
  it("says nothing happened when nothing did", () => {
    expect(backlogMarkdown([])).toContain("Nothing fell through");
  });

  it("quotes the sentences verbatim — INV-1", () => {
    const text = "I pump the section full of coolant and wait";
    expect(backlogMarkdown([miss(text)])).toContain(text);
  });

  it("points at how to fix it without doing it", () => {
    /* This file sits on a list of things players wanted to do.
       Turning those into listener text automatically would be the
       engine writing the module's content. It stays a report. */
    const md = backlogMarkdown([miss("I crawl into the vents")]);
    expect(md).toContain("listenerPack.js");
    expect(md).not.toContain("effects:");
  });
});

describe("it is wired to the moment of the miss", () => {
  it("useGame records the sentence on the oracle line", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "../src/engine/useGame.js"), "utf8");
    /* Without this, `missesFrom` reads an empty feed forever and
       the whole file is decoration. An earlier draft tried to walk
       backwards to the player's echoed line — which is never
       written, because a typed sentence resolves and the feed
       records only the result. */
    expect(src).toContain("{ miss: String(text || \"\").trim() }");
  });
});
