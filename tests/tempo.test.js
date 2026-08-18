import { describe, it, expect } from "vitest";
import {
  tempoOf, makeScene, sceneHolder, sceneNext, scenePass, sceneReconcile,
  scenePosition, scenePredecessor, tempoVerdict, buildRecap,
  reorderInitiative, holdInitiative, dropFromInitiative, insertIntoInitiative,
} from "../src/engine/tempo.js";
import { duressOf, DURESS, duressRose } from "../src/engine/duress.js";
import { dossierFor, declaredFlags } from "../src/engine/dossier.js";
import { decideIntent, waitingRoom, isWait, waitReason } from "../src/net/protocol.js";
import { addLink, dropLink, linkExists, linkState, pruneLinks } from "../src/engine/board.js";

const crew = [
  { id: "a", name: "Ada", alive: true },
  { id: "b", name: "Boyd", alive: true },
  { id: "c", name: "Chi", alive: true },
];

describe("tempo defaults", () => {
  it("reads a world that predates tempo without exploding", () => {
    expect(tempoOf(undefined).held).toBe(false);
    expect(tempoOf({}).scene).toBe(null);
    expect(tempoOf({ tempo: { held: true } }).rateMs).toBe(0);
  });
});

describe("scene turns", () => {
  it("builds an order from the living", () => {
    const s = makeScene([...crew, { id: "d", name: "Dov", alive: false }]);
    expect(s.order).toEqual(["a", "b", "c"]);
  });

  it("wraps into a new round", () => {
    let s = makeScene(crew);
    s = sceneNext(sceneNext(sceneNext(s)));
    expect(s.idx).toBe(0);
    expect(s.round).toBe(2);
  });

  it("holding drops you to the end without ending the round", () => {
    const s = scenePass(makeScene(crew), "a");
    expect(s.order).toEqual(["b", "c", "a"]);
    expect(sceneHolder({ scene: s })).toBe("b");
  });

  it("keeps whoever is acting acting when the crew changes", () => {
    let s = makeScene(crew);
    s = sceneNext(s);                       // Boyd has it
    const next = sceneReconcile(s, [crew[1], crew[2]]);
    expect(sceneHolder({ scene: next })).toBe("b");
  });

  it("knows how far away your go is, and who you follow", () => {
    const t = { scene: makeScene(crew) };
    expect(scenePosition(t, "a")).toBe(0);
    expect(scenePosition(t, "c")).toBe(2);
    expect(scenePosition(t, "zz")).toBe(-1);
    expect(scenePredecessor(t, "b")).toBe("a");
    expect(scenePredecessor(t, "a")).toBe("c");
  });
});

describe("the brakes", () => {
  const held = { tempo: { held: true } };

  it("holds everything while the table is held", () => {
    expect(tempoVerdict({ w: held, action: "doSearch", pcId: "a" })).toEqual({ wait: "held" });
  });

  it("never holds answering a prompt or writing on the board", () => {
    expect(tempoVerdict({ w: held, action: "resolvePending", pcId: "a" })).toBe(null);
    expect(tempoVerdict({ w: held, action: "pinClue", pcId: "a" })).toBe(null);
    expect(tempoVerdict({ w: held, action: "acceptTrade", pcId: "a" })).toBe(null);
  });

  it("holds everyone but the person with the room", () => {
    const w = { tempo: { scene: makeScene(crew) } };
    expect(tempoVerdict({ w, action: "doSearch", pcId: "a" })).toBe(null);
    expect(tempoVerdict({ w, action: "doSearch", pcId: "b" })).toEqual({ wait: "scene" });
  });

  it("rate limits per player, and only for the length of the limit", () => {
    const w = { tempo: { rateMs: 5000 } };
    const now = 100000;
    expect(tempoVerdict({ w, action: "doSearch", pcId: "a", now, lastActed: { a: now - 1000 } }))
      .toEqual({ wait: "rate" });
    expect(tempoVerdict({ w, action: "doSearch", pcId: "a", now, lastActed: { a: now - 9000 } }))
      .toBe(null);
    // Somebody else's cooldown is not yours.
    expect(tempoVerdict({ w, action: "doSearch", pcId: "b", now, lastActed: { a: now } })).toBe(null);
  });

  it("a break outranks a scene round", () => {
    const w = { tempo: { breather: { since: 1 }, scene: makeScene(crew) } };
    expect(tempoVerdict({ w, action: "doSearch", pcId: "a" })).toEqual({ wait: "breather" });
  });
});

describe("decideIntent honours the brakes", () => {
  const game = (over = {}) => ({
    crew: [{ id: "a", alive: true }, { id: "b", alive: true }],
    activeId: "a", pending: null, combat: null, w: {}, ...over,
  });
  const job = { action: "doSearch", asPc: "a", clientId: "c1" };
  const claims = { a: "c1", b: "c2" };
  const turnOf = () => null;

  it("still runs when nothing is on", () => {
    expect(decideIntent({ game: game(), job, claims, currentTurn: turnOf })).toBe("run");
  });

  it("holds when the Warden holds", () => {
    const v = decideIntent({
      game: game({ w: { tempo: { held: true } } }), job, claims, currentTurn: turnOf,
    });
    expect(isWait(v)).toBe(true);
    expect(waitReason(v)).toBe("held");
  });

  it("keeps the legacy bare wait for a pending roll", () => {
    const v = decideIntent({
      game: game({ pending: { kind: "roll", req: { pcId: "b" } } }),
      job, claims, currentTurn: turnOf,
    });
    expect(v).toBe("wait");
    expect(waitReason(v)).toBe("roll");
  });

  it("refuses before it holds — a dead character is not a queue", () => {
    const v = decideIntent({
      game: game({ crew: [{ id: "a", alive: false }], w: { tempo: { held: true } } }),
      job, claims, currentTurn: turnOf,
    });
    expect(v).toEqual({ deny: "dead" });
  });
});

describe("the waiting room", () => {
  it("names who is blocked behind whose roll", () => {
    const out = waitingRoom({
      game: { crew, w: {}, pending: { kind: "roll", req: { pcId: "a" } }, combat: null },
      claims: {}, currentTurn: () => null,
    });
    expect(out.a.state).toBe("rolling");
    expect(out.b).toEqual(expect.objectContaining({ state: "blocked", by: "a" }));
  });

  it("calls a long silence idle", () => {
    const now = 10 * 60 * 1000;
    const out = waitingRoom({
      game: { crew, w: {}, pending: null, combat: null },
      claims: {}, currentTurn: () => null,
      lastActed: { a: now - 5 * 60 * 1000, b: now - 1000 },
      now,
    });
    expect(out.a.state).toBe("idle");
    expect(out.b.state).toBe("open");
  });
});

describe("duress", () => {
  const pc = (over = {}) => ({
    id: "a", name: "Ada", alive: true, health: 10, maxHealth: 10,
    stress: 2, conditions: [], ...over,
  });

  it("is clear when nothing is wrong", () => {
    expect(duressOf({ pc: pc(), combat: null, w: {}, mod: { rooms: {} } }).level).toBe(DURESS.CLEAR);
  });

  it("rises with injury", () => {
    expect(duressOf({ pc: pc({ health: 4 }), w: {}, mod: { rooms: {} } }).level).toBe(DURESS.PRESSED);
    expect(duressOf({ pc: pc({ health: 2 }), w: {}, mod: { rooms: {} } }).level).toBe(DURESS.CRITICAL);
  });

  it("treats being held as critical whatever your health", () => {
    const combat = {
      enemies: [{ uid: "e1", name: "It", dead: false, grabbed: "a", distance: 1 }],
      actors: {},
    };
    const d = duressOf({ pc: pc(), combat, w: {}, mod: { rooms: {} } });
    expect(d.level).toBe(DURESS.CRITICAL);
    expect(d.tags).toContain("HELD");
  });

  it("counts a nearly-expired countdown even in an empty room", () => {
    const d = duressOf({ pc: pc(), w: { countdowns: { reactor: { left: 2 } } }, mod: { rooms: {} } });
    expect(d.level).toBe(DURESS.CRITICAL);
  });

  it("ignores a countdown the Warden is holding", () => {
    const d = duressOf({ pc: pc(), w: { countdowns: { reactor: { left: 1, paused: true } } }, mod: { rooms: {} } });
    expect(d.level).toBe(DURESS.CLEAR);
  });

  it("only announces itself on the way up", () => {
    const low = { level: DURESS.EXPOSED };
    const high = { level: DURESS.CRITICAL };
    expect(duressRose(low, high)).toBe(true);
    expect(duressRose(high, high)).toBe(false);
    expect(duressRose(high, low)).toBe(false);
    // Getting mildly worse is not worth a buzz.
    expect(duressRose(null, { level: DURESS.EXPOSED })).toBe(false);
  });

  it("says nothing at all about the dead", () => {
    expect(duressOf({ pc: pc({ alive: false, health: 0 }), w: {}, mod: { rooms: {} } }).level)
      .toBe(DURESS.CLEAR);
  });
});

describe("initiative editing", () => {
  const combat = () => ({
    round: 1, turnIndex: 1,
    order: [{ side: "pc", id: "a" }, { side: "pc", id: "b" }, { side: "enemy", id: "e1" }],
  });

  it("keeps the acting actor acting when somebody else moves", () => {
    const next = reorderInitiative(combat(), 2, 0);
    expect(next.order[next.turnIndex].id).toBe("b");
  });

  it("follows the actor when they are the one moved", () => {
    const next = reorderInitiative(combat(), 1, 2);
    expect(next.order[next.turnIndex].id).toBe("b");
    expect(next.turnIndex).toBe(2);
  });

  it("holding drops you to the end of the round", () => {
    const next = holdInitiative(combat(), 0);
    expect(next.order.map((o) => o.id)).toEqual(["b", "e1", "a"]);
  });

  it("dropping somebody does not strand the pointer", () => {
    const next = dropFromInitiative(combat(), 1);
    expect(next.order).toHaveLength(2);
    expect(next.turnIndex).toBeLessThan(next.order.length);
  });

  it("inserts a new threat after whoever is acting", () => {
    const next = insertIntoInitiative(combat(), { side: "enemy", id: "e2" });
    expect(next.order[2].id).toBe("e2");
    expect(next.order[next.turnIndex].id).toBe("b");
  });
});

describe("recap", () => {
  const mod = { title: "Ypsilon 14", rooms: { mess: { name: "Mess" } }, handouts: { t1: { label: "BLUE TAPE" } } };

  it("never returns nothing", () => {
    const r = buildRecap({ feed: [], crew: [], mod, w: {} });
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it("reports only what the feed actually recorded", () => {
    const feed = [
      { id: 1, kind: "room", room: "mess", text: "The mess." },
      { id: 2, kind: "handout", handout: "t1", text: "..." },
      { id: 3, kind: "panic", pcId: "a", text: "..." },
      { id: 4, kind: "wardennote", wardenOnly: true, text: "secret" },
    ];
    const r = buildRecap({ feed, crew, mod, w: {} });
    const all = r.lines.join(" ");
    expect(all).toContain("Mess");
    expect(all).toContain("BLUE TAPE");
    expect(all).toContain("Ada");
    expect(all).not.toContain("secret");
  });

  it("only covers what is new since the last one", () => {
    const feed = [
      { id: 1, kind: "room", room: "mess" },
      { id: 2, kind: "beat", text: "— AFTER THE AIRLOCK —" },
    ];
    const r = buildRecap({ feed, crew: [], mod, w: {}, sinceId: 1 });
    expect(r.lines.join(" ")).toContain("AIRLOCK");
    expect(r.lines.join(" ")).not.toContain("Mess");
  });
});

describe("clue threads", () => {
  const clues = [{ id: "c1", resolved: false }, { id: "c2", resolved: false }];

  it("will not draw the same thread twice, either way round", () => {
    let links = addLink([], "c1", "c2");
    links = addLink(links, "c2", "c1");
    expect(links).toHaveLength(1);
    expect(linkExists(links, "c1", "c2")).toBe(true);
  });

  it("refuses to link a clue to itself", () => {
    expect(addLink([], "c1", "c1")).toHaveLength(0);
  });

  it("dims once both ends are resolved", () => {
    const link = addLink([], "c1", "c2")[0];
    expect(linkState(link, clues)).toBe("live");
    expect(linkState(link, clues.map((c) => ({ ...c, resolved: true })))).toBe("spent");
  });

  it("prunes threads to clues that have gone", () => {
    const links = addLink([], "c1", "c2");
    expect(pruneLinks(links, [clues[0]])).toHaveLength(0);
    expect(dropLink(links, links[0].id)).toHaveLength(0);
  });
});

describe("dossier", () => {
  const mod = {
    title: "T",
    rooms: { r1: { name: "Lab", features: { vat: { name: "Vat", effects: [{ flag: "saw_vat" }] } } } },
    handouts: {}, devices: {}, actions: [], clocks: [],
    npcs: { s: { name: "Sonya", knows: ["one", "two"] } },
    npcOrder: ["s"], endings: { win: { title: "OUT", good: true } },
    warden: { setting: "brief", constraints: ["a rule"] },
  };

  it("finds the flags a module can set, and where", () => {
    const flags = declaredFlags(mod);
    expect(flags.map((f) => f.id)).toContain("saw_vat");
    expect(flags[0].where[0]).toContain("Lab");
  });

  it("ticks secrets off as they fire, unfired first", () => {
    const d = dossierFor(mod, { flags: { saw_vat: true }, npcs: {}, clocks: {}, countdowns: {} });
    expect(d.secrets[0].fired).toBe(true);
    expect(d.counts.secretsFired).toBe(1);
  });

  it("strikes through what an NPC has already said", () => {
    const d = dossierFor(mod, { flags: {}, npcs: { s: { alive: true, told: [0] } }, clocks: {}, countdowns: {} });
    expect(d.cast[0].knows[0].told).toBe(true);
    expect(d.cast[0].left).toBe(1);
  });

  it("survives being asked before a session exists", () => {
    expect(() => dossierFor(mod, undefined)).not.toThrow();
  });
});
