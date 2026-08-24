// @vitest-environment jsdom
/* ============================================================
   THE FIRST TEN MINUTES AND THE LAST ONE — 2.11

   B.1 rolling a character, B.2 verbs before the parser,
   B.5 the end card, C.5 the harshness table.
   ============================================================ */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { randomDraft, randomName, randomPicks, randomSkills } from "../src/engine/randomDraft.js";
import { CLASSES, SKILL_COST, skillTier, canTakeSkill, makeCharacter } from "../src/engine/rules.js";
import { verbsFor } from "../src/ui/QuickVerbs.jsx";
import QuickVerbs from "../src/ui/QuickVerbs.jsx";
import { endCard, endCardText, lastLineAbout } from "../src/engine/endcard.js";
import { MOVE_HARSH, isHarshMove } from "../src/engine/director.js";

afterEach(cleanup);

/* ============================================================
   B.1 — ROLL ME ONE
   ============================================================ */
const MOD = {
  id: "t", title: "T",
  loadouts: { a: { name: "A", items: [] }, b: { name: "B", items: [] } },
  items: {}, meters: {},
};

describe("a whole character, now", () => {
  it("fills every field the wizard holds", () => {
    const d = randomDraft(MOD);
    expect(d.name).toBeTruthy();
    expect(CLASSES[d.cls]).toBeTruthy();
    expect(d.stats).toBeTruthy();
    expect(Array.isArray(d.picks)).toBe(true);
    expect(Array.isArray(d.spent)).toBe(true);
    expect(d.loadout).toBeTruthy();
    expect(d.trinket).toBeTruthy();
  });

  it("SPENDS THE SKILL POINTS TO ZERO, EVERY TIME", () => {
    /* The one that matters. The wizard blocks on "you still have N
       skill points to spend", so a random build that strands points
       produces a character the wizard will not let you submit —
       worse than no button at all. Skills have prerequisites and
       tiered costs, so a greedy walk really can strand them; this
       asserts the retry actually works rather than usually working. */
    for (let i = 0; i < 200; i++) {
      const d = randomDraft(MOD);
      const cls = CLASSES[d.cls];
      const used = d.spent.reduce((a, s) => a + (SKILL_COST[skillTier(s)] || 0), 0);
      expect(used).toBe(cls.points);
    }
  });

  it("only ever takes a skill the character qualifies for", () => {
    for (let i = 0; i < 100; i++) {
      const d = randomDraft(MOD);
      const cls = CLASSES[d.cls];
      const have = [...cls.fixedSkills];
      for (const p of d.picks) have.push(p);
      const running = [...have];
      for (const s of d.spent) {
        expect(canTakeSkill({ skills: running }, s).ok).toBe(true);
        running.push(s);
      }
    }
  });

  it("takes exactly the class's own pick-one-of, with no repeats", () => {
    for (const cls of Object.values(CLASSES)) {
      if (!cls.pick) {
        expect(randomPicks(cls)).toEqual([]);
        continue;
      }
      const picks = randomPicks(cls);
      expect(picks).toHaveLength(cls.pick.count);
      expect(new Set(picks).size).toBe(picks.length);
      for (const p of picks) expect(cls.pick.from).toContain(p);
    }
  });

  it("never takes the same skill twice", () => {
    for (let i = 0; i < 100; i++) {
      const d = randomDraft(MOD);
      const all = [...CLASSES[d.cls].fixedSkills, ...d.picks, ...d.spent];
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("produces a character the engine will actually build", () => {
    /* End to end: if `makeCharacter` throws or returns something
       hollow, the button produces a broken sheet at the table. */
    for (let i = 0; i < 20; i++) {
      const d = randomDraft(MOD);
      const pc = makeCharacter({
        name: d.name, cls: d.cls, stats: d.stats,
        skills: [...new Set([...CLASSES[d.cls].fixedSkills, ...d.picks, ...d.spent])],
        loadout: d.loadout, trinket: d.trinket, patch: d.patch,
      }, MOD);
      expect(pc.name).toBe(d.name);
      expect(pc.maxHealth).toBeGreaterThan(0);
    }
  });

  it("leaves the loadout for the wizard to ask about when a module has none", () => {
    expect(randomDraft({ id: "x", loadouts: {}, items: {}, meters: {} }).loadout).toBe(null);
  });

  it("takes its randomness as an argument", () => {
    /* Nothing in that file reads the global, which is what lets the
       test above assert about 200 builds instead of one lucky one. */
    const rng = () => 0;
    expect(randomName(rng)).toBe(randomName(rng));
  });

  it("does not usually produce the same name twice running", () => {
    const names = new Set(Array.from({ length: 40 }, () => randomName()));
    expect(names.size).toBeGreaterThan(10);
  });
});

/* ============================================================
   B.2 — VERBS BEFORE THE PARSER
   ============================================================ */
describe("what can I even do here", () => {
  const room = { name: "HOLD", features: { crates: {}, panel: {} } };
  const exits = [{ to: "vent", label: "vent" }];
  const npcs = [{ id: "sonya", name: "Sonya" }];

  it("always offers the one verb that is never wrong", () => {
    const v = verbsFor({ room: { name: "X", features: {} }, exits: [], npcs: [] });
    expect(v[0].cmd).toBe("look");
  });

  it("names the thing rather than the verb", () => {
    /* "Search the crates" is a sentence somebody can copy into the
       box next time. "Search" teaches nothing. */
    const v = verbsFor({ room, exits, npcs });
    expect(v.some((x) => x.cmd === "search crates")).toBe(true);
  });

  it("puts people before doors", () => {
    const v = verbsFor({ room: { name: "X", features: {} }, exits, npcs });
    const talk = v.findIndex((x) => x.id.startsWith("talk:"));
    const go = v.findIndex((x) => x.id.startsWith("go:"));
    expect(talk).toBeLessThan(go);
  });

  it("NEVER OFFERS MORE THAN FIVE", () => {
    /* A grid of fifteen re-creates the problem this was written for
       at a different size. */
    const many = { name: "X", features: { a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {} } };
    expect(verbsFor({ room: many, exits, npcs })).toHaveLength(5);
  });

  it("STEPS BACK IN A FIGHT", () => {
    /* Offering "search the crates" while something is eating the
       crew reads as the game not knowing what is happening.
       TurnActions owns combat properly. */
    const v = verbsFor({ room, exits, npcs, combat: { round: 1 }, myTurn: false });
    expect(v).toHaveLength(0);
  });

  it("offers exactly one thing on your go in a fight", () => {
    const v = verbsFor({ room, exits, npcs, combat: { round: 1 }, myTurn: true });
    expect(v.map((x) => x.cmd)).toEqual(["attack"]);
  });

  it("sends the same string the parser would get from the box", () => {
    /* One code path. A verb that produced a different result from
       typing it would be two games. */
    const onVerb = vi.fn();
    render(<QuickVerbs room={room} exits={[]} npcs={[]} onVerb={onVerb} />);
    fireEvent.click(screen.getByText("Look around"));
    expect(onVerb).toHaveBeenCalledWith("look");
  });

  it("goes quiet rather than rendering an empty strip", () => {
    const { container } = render(
      <QuickVerbs room={room} exits={[]} npcs={[]} combat={{ round: 1 }} myTurn={false} onVerb={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });
});

/* ============================================================
   B.5 — THE END CARD
   ============================================================ */
describe("the message they are about to send", () => {
  const mod = { title: "YPSILON 14", endings: { out: { title: "YOU GOT OUT" } } };
  const w = { ended: "out", clock: 240 };
  const crew = [
    { id: "a", name: "RILEY", cls: "teamster", alive: true },
    { id: "b", name: "VOSS", cls: "scientist", alive: false },
  ];
  const feed = [
    { id: 1, kind: "room", text: "The door will not open." },
    { id: 2, kind: "room", text: "VOSS goes under and does not come back up." },
    { id: 3, kind: "system", text: "Day 2 begins." },
  ];

  it("says who you were and what happened", () => {
    const c = endCard({ mod, w, crew, feed, pcId: "b" });
    expect(c.name).toBe("VOSS");
    expect(c.survived).toBe(false);
  });

  it("distinguishes walking away from not", () => {
    expect(endCard({ mod, w, crew, feed, pcId: "a" }).survived).toBe(true);
  });

  it("LIFTS THE LINE VERBATIM OR HAS NONE", () => {
    /* INV-6 on the one artefact a player shows people who were not
       there. A card that invented this would be lying about
       somebody's evening. */
    const c = endCard({ mod, w, crew, feed, pcId: "b" });
    expect(c.line).toBe("VOSS goes under and does not come back up.");
  });

  it("has no line rather than a made-up one", () => {
    const c = endCard({ mod, w, crew, feed: [{ id: 1, kind: "room", text: "nothing happens" }], pcId: "a" });
    expect(c.line).toBe(null);
  });

  it("never quotes a warden-only line", () => {
    const secret = [{ id: 1, kind: "room", wardenOnly: true, text: "RILEY is the traitor" }];
    expect(lastLineAbout(secret, "RILEY")).toBe(null);
  });

  it("does not treat bookkeeping as a memory", () => {
    const sys = [{ id: 1, kind: "system", text: "RILEY takes 2 damage" }];
    expect(lastLineAbout(sys, "RILEY")).toBe(null);
  });

  it("prefers the last thing said about you", () => {
    const two = [
      { id: 1, kind: "room", text: "RILEY opens the hatch." },
      { id: 2, kind: "room", text: "RILEY is bleeding." },
    ];
    expect(lastLineAbout(two, "RILEY")).toBe("RILEY is bleeding.");
  });

  it("is short enough to actually send", () => {
    /* It competes with a person typing one sentence themselves and
       loses that competition at any length. */
    const text = endCardText(endCard({ mod, w, crew, feed, pcId: "b" }));
    expect(text.length).toBeLessThan(200);
    expect(text).toContain("VOSS");
  });

  it("returns nothing for a phone holding no character", () => {
    expect(endCard({ mod, w, crew, feed, pcId: "nobody" })).toBe(null);
    expect(endCardText(null)).toBe("");
  });
});

/* ============================================================
   C.5 — THE HARSHNESS TABLE
   ============================================================ */
describe("which moves make the evening worse", () => {
  it("keeps every judgement the four strings made", () => {
    for (const kind of ["escalate", "combat", "callRoll", "pressure"]) {
      expect(isHarshMove({ kind })).toBe(true);
    }
  });

  it("keeps the aftermath special case, now as an entry", () => {
    expect(isHarshMove({ kind: "describe", rung: "aftermath" })).toBe(true);
    expect(isHarshMove({ kind: "describe", rung: "atmosphere" })).toBe(false);
  });

  it("counts a decision to do nothing as harmless", () => {
    for (const kind of ["wait", "halt", "resume"]) {
      expect(isHarshMove({ kind })).toBe(false);
    }
  });

  it("survives being handed nothing", () => {
    expect(isHarshMove(null)).toBe(false);
    expect(isHarshMove({})).toBe(false);
  });

  it("IS EXHAUSTIVE OVER EVERY KIND THE LADDER CAN EMIT", () => {
    /* THE POINT OF C.5. A missing entry and a deliberate "no" used
       to look identical, which is how `listen` and `lastCall` both
       shipped in 2.10.0 defaulting to harmless without anybody
       deciding. Now a new rung whose kind is not in the table fails
       here instead.

       Read out of the source because there is no runtime registry
       of rungs to ask — the alternative is a hand-kept list in the
       test, which is the same problem one file further away. */
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/engine/director.js"), "utf8");
    const emitted = new Set([...src.matchAll(/\bkind:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]));
    expect(emitted.size).toBeGreaterThan(10);
    const missing = [...emitted].filter((k) => !(k in MOVE_HARSH));
    expect(missing).toEqual([]);
  });
});
