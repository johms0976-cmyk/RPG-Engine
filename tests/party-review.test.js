/**
 * @vitest-environment jsdom
 *
 * jsdom for one reason: `campaign.js` keeps the record in
 * localStorage, exactly as `locker.js` and `storage.js` do, and
 * the default environment here is node. Everything else in this
 * file is pure and would run in either.
 */
/* ============================================================
   2.14.0 — the corrections, the record, and the second module.

   Four subjects, one file, because they are one drop and the
   thing worth asserting about most of them is the same thing:
   THE UNCHANGED CASE. A quorum that has not been reached must
   change nothing. A table with no campaign must record nothing.
   An NPC with nothing on their mind must recite in exactly the
   order they always did.

   That last one is the load-bearing assertion in this file. F13
   reorders authored lines, which is the kind of change that
   silently alters every existing module, so the tie-break is
   pinned here rather than left to be discovered.
   ============================================================ */
import { describe, it, expect, beforeEach } from "vitest";
import {
  noteObjection, emptyObjections, OBJECTION_WINDOW_MS, OBJECTION_QUORUM,
} from "../src/engine/objection.js";
import { pickKnown, mindWords, rungNpc } from "../src/engine/director.js";
import {
  createCampaign, recordSession, getCampaign, listCampaigns, forgetCampaign,
  campaignSummary, campaignLine, exportCampaign, importCampaign,
  setActiveCampaign, activeCampaignId,
} from "../src/engine/campaign.js";
import deadweight from "../src/modules/deadweight/index.js";
import MODULES from "../src/modules/index.js";

/* ============================================================
   F6 — "NOT THAT"
   ============================================================ */
describe("the table waving off a line nobody was addressed by", () => {
  const T = 1_000_000;

  it("does nothing at all on one person's say-so", () => {
    const r = noteObjection(emptyObjections(), "pc1", T);
    expect(r.carried).toBe(false);
    expect(r.n).toBe(1);
  });

  it("carries when a second, different person agrees", () => {
    const one = noteObjection(emptyObjections(), "pc1", T);
    const two = noteObjection(one.next, "pc2", T + 4000);
    expect(two.carried).toBe(true);
    expect(two.n).toBe(OBJECTION_QUORUM);
  });

  it("does not let one irritated player retire a rung by tapping twice", () => {
    const one = noteObjection(emptyObjections(), "pc1", T);
    const again = noteObjection(one.next, "pc1", T + 1000);
    expect(again.carried).toBe(false);
    expect(again.n).toBe(1);
    /* And a third time, and a fourth. Their opinion has not
       doubled by being repeated. */
    const third = noteObjection(again.next, "pc1", T + 2000);
    expect(third.carried).toBe(false);
  });

  it("will not combine two objections to two different lines", () => {
    const one = noteObjection(emptyObjections(), "pc1", T);
    const late = noteObjection(one.next, "pc2", T + OBJECTION_WINDOW_MS + 1);
    expect(late.carried).toBe(false);
    /* The stale one is discarded rather than kept: this is now
       pc2 objecting alone, not pc1 and pc2 objecting together. */
    expect(late.n).toBe(1);
  });

  it("clears after carrying, so a third tap cannot cascade", () => {
    const one = noteObjection(emptyObjections(), "pc1", T);
    const two = noteObjection(one.next, "pc2", T + 1000);
    expect(two.carried).toBe(true);
    const three = noteObjection(two.next, "pc3", T + 2000);
    expect(three.carried).toBe(false);
    expect(three.n).toBe(1);
  });

  it("ignores a tap from a phone holding no character", () => {
    const r = noteObjection(emptyObjections(), null, T);
    expect(r.carried).toBe(false);
    expect(r.n).toBe(0);
  });

  it("survives a ledger it has never seen before", () => {
    /* A resumed session, a restored save, or a shape from an
       older version. Must not throw and must not carry. */
    const r = noteObjection(undefined, "pc1", T);
    expect(r.carried).toBe(false);
    const junk = noteObjection({ at: T, who: "not an array" }, "pc1", T);
    expect(junk.carried).toBe(false);
  });

  it("is declared on the wire before it can travel", async () => {
    const proto = await import("../src/net/protocol.js");
    expect(proto.C_NOTTHAT).toBe("notthat");
  });

  it("is reachable from the only screens a wardenless table has", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/net/ClientShell.jsx", "utf8"));
    /* INV-9: a capability whose only switch is on the Warden deck
       does not exist for the configuration that most needs it. */
    expect(src).toContain('t: "notthat"');
    expect(src).toContain("Not that");
  });

  it("finally sends the personal dispute the host has always handled", async () => {
    const fs = await import("node:fs");
    const shell = fs.readFileSync("src/net/ClientShell.jsx", "utf8");
    const spot = fs.readFileSync("src/ui/Spotlight.jsx", "utf8");
    /* C_DISPUTE existed from 2.7.0 with a relay case and a host
       handler and no sender anywhere in the application. */
    expect(shell).toContain('t: "dispute"');
    expect(spot).toContain("onNotMe");
  });
});

/* ============================================================
   F13 — WHAT IS ON AN NPC'S MIND
   ============================================================ */
describe("which of their own lines an NPC volunteers", () => {
  const knows = [
    "The generator has been running rough since Tuesday.",
    "Nobody has been down to the flooded sub-level in a month.",
    "I do not like the look of that cargo.",
  ];

  it("recites in authored order when nothing matches", () => {
    /* THE LOAD-BEARING ONE. No signal means byte-identical
       behaviour to `findIndex`, which is what makes this safe to
       add to modules written before it existed. */
    expect(pickKnown(knows, new Set(), new Set())).toBe(0);
    expect(pickKnown(knows, new Set([0]), new Set())).toBe(1);
    expect(pickKnown(knows, new Set([0, 1]), new Set())).toBe(2);
  });

  it("returns -1 when everything has been told", () => {
    expect(pickKnown(knows, new Set([0, 1, 2]), new Set())).toBe(-1);
  });

  it("prefers the line about where everybody is standing", () => {
    expect(pickKnown(knows, new Set(), new Set(["flooded", "sub"]))).toBe(1);
  });

  it("still skips lines already told, however apt they are", () => {
    expect(pickKnown(knows, new Set([1]), new Set(["flooded"]))).toBe(0);
  });

  it("breaks ties to the lowest index rather than to chance", () => {
    const both = ["cargo in the hold", "cargo in the hold"];
    expect(pickKnown(both, new Set(), new Set(["cargo"]))).toBe(0);
  });

  it("reads the room, the flags and the clue board, and nothing else", () => {
    const mod = { rooms: { hold: { name: "COLD HOLD", tags: ["DARK"] } } };
    const w = {
      room: "hold",
      flags: { hatch_open: true, power: "cut", nothing: false },
      clues: [
        { text: "Score marks in the deck plate" },
        { text: "A name nobody will say", secret: true },
      ],
    };
    const words = mindWords({ mod, w, focus: "hold" });
    expect(words.has("cold")).toBe(true);
    expect(words.has("dark")).toBe(true);
    expect(words.has("hatch")).toBe(true);
    expect(words.has("plate")).toBe(true);
    /* A false flag has not happened. A secret clue is one
       player's, for the same reason rungCallback excludes them. */
    expect(words.has("nothing")).toBe(false);
    expect(words.has("nobody")).toBe(false);
  });

  it("never puts a word in an NPC's mouth", () => {
    /* INV-6. Whatever the weighting picks, the text is an entry
       from the authored array and is identical to it. */
    const mod = {
      rooms: { hold: { name: "COLD HOLD", tags: [] } },
      npcs: { ed: { name: "ED", knows } },
    };
    const w = {
      room: "hold", flags: {}, clues: [],
      npcs: { ed: { loc: "hold", alive: true, met: true, told: [] } },
    };
    const m = rungNpc({ mod, w, now: 9e6, lastNpcAt: 0, npcSpokeAt: {} });
    expect(m).toBeTruthy();
    expect(knows).toContain(m.text);
  });
});

/* ============================================================
   F7 — THE CAMPAIGN RECORD
   ============================================================ */
describe("the record a table accumulates between evenings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const evening = (over) => ({
    sessionId: "deadweight:cut:88",
    modId: "deadweight",
    modTitle: "DEAD WEIGHT",
    ending: "cut",
    endingTitle: "YOU CUT IT LOOSE",
    good: true,
    minutes: 88,
    survivors: ["RASK", "VOSS"],
    lost: ["PIKE"],
    ...over,
  });

  it("does not exist until somebody names one", () => {
    expect(listCampaigns()).toEqual([]);
    expect(activeCampaignId()).toBe(null);
  });

  it("writes an evening down once, however many times it is asked to", () => {
    const c = createCampaign("The Tarsis Run");
    recordSession(c.id, evening());
    recordSession(c.id, evening());
    recordSession(c.id, evening());
    /* The ending screen re-renders whenever somebody copies their
       card, and an effect that appended would append every time. */
    expect(getCampaign(c.id).sessions).toHaveLength(1);
  });

  it("marks the dead rather than deleting them", () => {
    const c = createCampaign("The Tarsis Run");
    recordSession(c.id, evening());
    const after = getCampaign(c.id);
    const pike = after.crew.find((p) => p.name === "PIKE");
    expect(pike).toBeTruthy();
    expect(pike.alive).toBe(false);
    /* A campaign that quietly deletes the dead cannot tell you
       what it cost. */
    const s = campaignSummary(after);
    expect(s.standing).toBe(2);
    expect(s.lost).toBe(1);
    expect(campaignLine(after)).toContain("1 lost");
  });

  it("carries a returning character across evenings without duplicating them", () => {
    const c = createCampaign("The Tarsis Run");
    recordSession(c.id, evening());
    recordSession(c.id, evening({ sessionId: "ypsilon14:escape:200", modId: "ypsilon14" }));
    const after = getCampaign(c.id);
    expect(after.sessions).toHaveLength(2);
    expect(after.crew.filter((p) => p.name === "RASK")).toHaveLength(1);
    expect(campaignSummary(after).modules).toBe(2);
  });

  it("goes out as text and comes back under a fresh id", () => {
    const c = createCampaign("The Tarsis Run");
    recordSession(c.id, evening());
    const text = exportCampaign(c.id);
    const back = importCampaign(text);
    expect(back.ok).toBe(true);
    /* Never overwriting the original, because that is the one
       failure here that loses an evening nobody can get back. */
    expect(back.campaign.id).not.toBe(c.id);
    expect(back.campaign.sessions).toHaveLength(1);
    expect(getCampaign(c.id)).toBeTruthy();
  });

  it("refuses a file that is not one", () => {
    expect(importCampaign("hello").ok).toBe(false);
    expect(importCampaign('{"name":"x"}').ok).toBe(false);
  });

  it("forgets the selection along with the campaign", () => {
    const c = createCampaign("Briefly");
    setActiveCampaign(c.id);
    forgetCampaign(c.id);
    expect(getCampaign(c.id)).toBe(null);
    expect(activeCampaignId()).toBe(null);
  });

  it("is a ledger and not a rule", async () => {
    /* Nothing in the engine may consult it to decide anything.
       A session inside a campaign must play identically to a
       session outside one. */
    const fs = await import("node:fs");
    for (const f of ["src/engine/director.js", "src/engine/floor.js",
      "src/engine/useGame.js", "src/engine/effects.js", "src/net/useDirector.js"]) {
      expect(fs.readFileSync(f, "utf8")).not.toContain("campaign.js");
    }
  });
});

/* ============================================================
   F5 — THE NINETY-MINUTE MODULE
   ============================================================ */
describe("DEAD WEIGHT", () => {
  it("is on the shelf", () => {
    expect(MODULES.map((m) => m.id)).toContain("deadweight");
  });

  it("loads without a single validation problem", () => {
    expect(deadweight.problems || []).toEqual([]);
    expect(deadweight.warnings || []).toEqual([]);
  });

  it("is a module a table can finish on a weeknight", () => {
    expect(deadweight.length).toContain("Ninety minutes");
    expect(Object.keys(deadweight.rooms)).toHaveLength(9);
    /* One countdown, ninety minutes, running from minute zero.
       There is no second timer to track. */
    const cd = (deadweight.onStart || []).find((e) => e.countdown);
    expect(cd.countdown.minutes).toBe(90);
  });

  it("declares a crew size the engine will not turn people away from", () => {
    expect(deadweight.crewSize.max).toBeGreaterThanOrEqual(5);
    expect(deadweight.crewSize.min).toBeLessThanOrEqual(3);
  });

  it("is built for a party that splits", () => {
    /* Ninety metres each way. That single number is what makes
       splitting a decision rather than a habit, and it is the
       reason this module exists at a version where the director
       can finally follow a split party. */
    const out = deadweight.rooms.umbilical.exits;
    expect(out.every((e) => e.mins >= 8)).toBe(true);
    /* Somebody to talk to on BOTH sides of it, or one half of the
       table is just waiting. */
    const hulls = new Set(Object.values(deadweight.npcs).map((n) => n.start));
    expect(hulls.size).toBeGreaterThan(1);
  });

  it("fills in the attacks Ypsilon 14 deliberately leaves empty", () => {
    /* The two shipped modules now demonstrate both halves of the
       unseen-threat rule in content rather than only in tests. */
    expect(deadweight.threats.sleeper.unseen).toBeFalsy();
    expect(deadweight.director.attacks.length).toBeGreaterThan(0);
    for (const a of deadweight.director.attacks) {
      expect(deadweight.threats[a.threatId]).toBeTruthy();
      expect(a.when).toBeTruthy();
    }
  });

  it("gives the empty chair something to hear", () => {
    /* The gap that shipped as a mechanism without content in
       2.10.0. A module with no listeners is a module the director
       never once answers. */
    expect(deadweight.director.listeners.length).toBeGreaterThanOrEqual(8);
    for (const l of deadweight.director.listeners) {
      expect(l.phrases.length).toBeGreaterThan(0);
      expect(l.effects.length).toBeGreaterThan(0);
    }
  });

  it("can say why, out loud, for every roll it calls", () => {
    /* safeMove drops a called roll with no reason, so an entry
       without one is a rung that quietly never fires. */
    for (const r of deadweight.director.rolls) {
      expect(String(r.reason || "").trim().length).toBeGreaterThan(20);
    }
  });

  it("names only endings it actually declares", () => {
    for (const e of deadweight.director.endings) {
      expect(deadweight.endings[e.id]).toBeTruthy();
    }
  });
});

/* ============================================================
   F11 — THE VALIDATOR SURVIVES BAD INPUT
   ============================================================ */
describe("defineModule, handed a mistake", () => {
  it("complains instead of taking the application down with it", async () => {
    const { defineModule } = await import("../src/engine/defineModule.js");
    /* `give: "torch"` instead of `give: ["torch"]` used to throw a
       TypeError from inside the validator, at import time, which
       is precisely backwards. */
    expect(() => defineModule({
      id: "broken", title: "BROKEN", start: "a",
      rooms: { a: { name: "A", look: "x", features: { f: { name: "F", d: "d", effects: [{ give: "nosuchitem" }] } } } },
    })).not.toThrow();
  });
});
