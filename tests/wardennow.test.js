/* ============================================================
   WHAT THE WARDEN IS BEING WAITED ON FOR.

   The value being tested is not the list. It is the *ordering*,
   and one exclusion: the safety card returns alone, and a phone
   deck that ever renders it as the top of a list of table
   management has quietly turned a pause somebody asked for into
   one more item to get through.

   The rest is arithmetic over state the host already holds, and
   the reason to test it is that every entry has a legitimate
   configuration in which its input is missing — a local table has
   no waiting map, an unhosted one has no whispers, a session that
   has not begun has no crew. This renders while somebody is
   mid-sentence. It may not throw on any of them.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { wardenNow, TONE, QUIET_MS } from "../src/engine/wardenNow.js";

const pc = (over = {}) => ({
  id: "pc1", name: "RILEY", alive: true, health: 20, maxHealth: 20,
  stress: 2, room: "dock", ...over,
});

const game = (over = {}) => ({
  mod: { rooms: { dock: { name: "DOCK" }, hold: { name: "HOLD" } }, npcs: {} },
  w: { room: "dock", countdowns: {}, tempo: {} },
  crew: [pc()],
  pending: null,
  combat: null,
  ...over,
});

const ids = (list) => list.map((i) => i.id);

describe("nothing to report", () => {
  it("says nothing about a quiet table", () => {
    expect(wardenNow({ g: game() })).toEqual([]);
  });

  it("survives every missing input", () => {
    expect(wardenNow()).toEqual([]);
    expect(wardenNow({})).toEqual([]);
    expect(wardenNow({ g: null })).toEqual([]);
    expect(wardenNow({ g: { w: null } })).toEqual([]);
    /* A session that exists but has not started. `crew` is absent
       rather than empty on the first render after `begin`. */
    expect(wardenNow({ g: { w: { tempo: {} } } })).toEqual([]);
  });
});

describe("the card", () => {
  it("comes back ALONE, not first", () => {
    /* Everything below would otherwise produce four entries. */
    const out = wardenNow({
      g: game({
        pending: { kind: "roll", req: { pcId: "pc1" } },
        crew: [pc({ health: 2, stress: 18 })],
        w: { room: "dock", countdowns: { reactor: { left: 1 } }, tempo: { held: true } },
      }),
      safetyCall: { level: "stop", at: 1 },
      unread: 3,
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("safety");
    expect(out[0].tone).toBe(TONE.STOP);
  });

  it("names nobody", () => {
    const [card] = wardenNow({ g: game(), safetyCall: { level: "veil", at: 1 } });
    expect(card.pcId).toBeUndefined();
    expect(`${card.title} ${card.note}`).not.toMatch(/RILEY|pc1/);
  });

  it("falls back to a level it does not recognise", () => {
    /* A snapshot from a future protocol, or a corrupted one. The
       card still stops the table; it does not vanish. */
    const [card] = wardenNow({ g: game(), safetyCall: { level: "nonsense" } });
    expect(card.id).toBe("safety");
  });
});

describe("the ordering", () => {
  it("puts the stopped table above the hurt character", () => {
    const out = wardenNow({
      g: game({
        pending: { kind: "roll", req: { pcId: "pc1" } },
        crew: [pc({ health: 2 })],
      }),
    });
    expect(ids(out)).toEqual(["pending", "hurt-pc1"]);
  });

  it("puts a brake the Warden forgot above whose go it is", () => {
    const out = wardenNow({
      g: game({
        w: { room: "dock", countdowns: {}, tempo: { held: true } },
        combat: { round: 2, turnIndex: 0, order: [{ side: "pc", id: "pc1", name: "RILEY" }] },
      }),
    });
    expect(ids(out)).toEqual(["brake-held", "turn"]);
  });

  it("puts a split party and unread whispers last", () => {
    const out = wardenNow({
      g: game({
        crew: [pc(), pc({ id: "pc2", name: "VOSS", room: "hold", health: 3 })],
      }),
      unread: 2,
    });
    expect(ids(out)).toEqual(["hurt-pc2", "split", "unread"]);
  });
});

describe("who is stuck", () => {
  it("says the whole table is queued behind an unanswered roll", () => {
    const [item] = wardenNow({
      g: game({ pending: { kind: "roll", req: { pcId: "pc1" } } }),
    });
    expect(item.title).toContain("RILEY");
    expect(item.pcId).toBe("pc1");
    expect(item.tone).toBe(TONE.STOP);
  });

  it("reads an opt-in Stress prompt, which owns its player differently", () => {
    /* `pendingOwner` in protocol.js reads `pcId` for optStress and
       `req.pcId` for a roll. Getting one of the two wrong is silent:
       the entry still renders, it just stops naming anybody. */
    const [item] = wardenNow({
      g: game({ pending: { kind: "optStress", amount: 2, pcId: "pc1" } }),
    });
    expect(item.pcId).toBe("pc1");
    expect(item.title).toContain("RILEY");
  });

  it("distinguishes a breather from a hold", () => {
    const held = wardenNow({ g: game({ w: { tempo: { held: true }, countdowns: {} } }) });
    const rest = wardenNow({ g: game({ w: { tempo: { breather: { since: 1 } }, countdowns: {} } }) });
    expect(held[0].id).toBe("brake-held");
    expect(rest[0].id).toBe("brake-breather");
  });
});

describe("a character in trouble", () => {
  it("counts a third of Health as hurt and 15 Stress as strung", () => {
    const out = wardenNow({ g: game({ crew: [pc({ health: 6, maxHealth: 20, stress: 15 })] }) });
    expect(out[0].note).toBe("Health 6/20 · Stress 15");
  });

  it("says nothing about somebody merely scratched", () => {
    expect(wardenNow({ g: game({ crew: [pc({ health: 14, stress: 9 })] }) })).toEqual([]);
  });

  it("says nothing about the dead", () => {
    /* They are on the ending screen and in the feed. An entry that
       stays lit for somebody who is not coming back is an entry a
       Warden learns to scroll past. */
    const out = wardenNow({ g: game({ crew: [pc({ alive: false, health: 0 })] }) });
    expect(out).toEqual([]);
  });
});

describe("clocks", () => {
  it("only raises one about to land", () => {
    const out = wardenNow({
      g: game({ w: { countdowns: { reactor: { left: 2 }, tide: { left: 40 } }, tempo: {} } }),
    });
    expect(ids(out)).toEqual(["cd-reactor"]);
  });

  it("says nothing about a held one", () => {
    const out = wardenNow({
      g: game({ w: { countdowns: { reactor: { left: 1, paused: true } }, tempo: {} } }),
    });
    expect(out).toEqual([]);
  });
});

describe("somebody who has gone quiet", () => {
  it("needs the host's own timings and not a guess", () => {
    /* A player who has never acted has no `since`. On a table that
       started ninety seconds ago that is everybody, and reporting
       them would make the first entry of every session wrong. */
    const out = wardenNow({ g: game(), waiting: { pc1: { state: "open", since: null } } });
    expect(out).toEqual([]);
  });

  it("reports one who has, in minutes", () => {
    const out = wardenNow({
      g: game(),
      waiting: { pc1: { state: "open", since: QUIET_MS + 60000 } },
    });
    expect(out[0].id).toBe("quiet-pc1");
    expect(out[0].title).toMatch(/RILEY — \d+m/);
    expect(out[0].tone).toBe(TONE.NOTE);
  });

  it("separates waiting on the table from waiting on themselves", () => {
    const held = wardenNow({
      g: game(), waiting: { pc1: { state: "held", why: "scene", since: QUIET_MS } },
    });
    const open = wardenNow({
      g: game(), waiting: { pc1: { state: "open", since: QUIET_MS } },
    });
    expect(held[0].note).toMatch(/not on themselves/);
    expect(open[0].note).toMatch(/Nothing is stopping them/);
  });

  it("says nothing about a character who is out", () => {
    const out = wardenNow({
      g: game(), waiting: { pc1: { state: "out", since: QUIET_MS * 4 } },
    });
    expect(out).toEqual([]);
  });
});
