import { describe, it, expect } from "vitest";
import { decideIntent, pendingOwner, packSnapshot, PLAYER_ACTIONS } from "../src/net/protocol.js";

const turnOf = (id) => () => ({ side: "pc", id, name: id });
const base = (over = {}) => ({
  crew: [{ id: "pc1", alive: true }, { id: "pc2", alive: true }],
  activeId: "pc1", pending: null, combat: null, ...over,
});
const job = (over = {}) => ({ action: "doSearch", args: [], asPc: "pc1", clientId: "A", ...over });
const claims = { pc1: "A", pc2: "B" };
const call = (game, j = job(), c = claims, ct = () => null) =>
  decideIntent({ game, job: j, claims: c, currentTurn: ct });

describe("who is allowed to act", () => {
  it("runs an owned action for the active character", () => {
    expect(call(base())).toBe("run");
  });

  it("makes the actor active first, rather than acting as someone else", () => {
    expect(call(base({ activeId: "pc2" }))).toBe("activate");
  });

  it("rejects an action aimed at a character you do not own", () => {
    expect(call(base(), job({ asPc: "pc2" }))).toEqual({ deny: "not-yours" });
  });

  it("rejects any function not on the allowlist", () => {
    expect(call(base(), job({ action: "setHouseRules" }))).toEqual({ deny: "unknown-action" });
    expect(call(base(), job({ action: "begin" }))).toEqual({ deny: "unknown-action" });
  });

  it("will not let a dead character act", () => {
    const dead = base();
    dead.crew[0].alive = false;
    expect(call(dead)).toEqual({ deny: "dead" });
  });

  it("refuses before a session exists", () => {
    expect(call({ crew: [] })).toEqual({ deny: "no-session" });
  });
});

describe("combat turn order", () => {
  const inCombat = (whose) => base({ combat: { round: 1 }, activeId: "pc1" });

  it("lets the character whose turn it is act", () => {
    expect(call(inCombat(), job(), claims, turnOf("pc1"))).toBe("run");
  });

  it("blocks a character acting out of turn", () => {
    expect(call(inCombat(), job(), claims, turnOf("pc2"))).toEqual({ deny: "not-your-turn" });
  });

  it("blocks everyone while an enemy is acting", () => {
    expect(call(inCombat(), job(), claims, () => ({ side: "enemy", id: "e1" })))
      .toEqual({ deny: "not-your-turn" });
  });

  it("still allows the out-of-turn actions, so a prompt never deadlocks", () => {
    const verdict = call(inCombat(), job({ action: "resolvePending" }), claims, turnOf("pc2"));
    expect(verdict).toBe("run");
  });
});

describe("pending prompts", () => {
  it("addresses a roll to the character it was raised for", () => {
    expect(pendingOwner({ kind: "roll", req: { pcId: "pc2" } })).toBe("pc2");
    expect(pendingOwner({ kind: "optStress", pcId: "pc1" })).toBe("pc1");
    expect(pendingOwner(null)).toBe(null);
  });

  it("holds other players while somebody else is being asked to roll", () => {
    const g = base({ pending: { kind: "roll", req: { pcId: "pc2" } } });
    expect(call(g)).toBe("wait");
  });

  it("does not hold the player who was actually asked", () => {
    const g = base({ pending: { kind: "roll", req: { pcId: "pc1" } } });
    expect(call(g)).toBe("run");
  });
});

describe("snapshots", () => {
  it("sends an id instead of the module, and trims the feed", () => {
    const g = {
      w: { room: "a" }, crew: [], activeId: null, combat: null, pending: null,
      resting: null, levelUp: null, shopping: null, lastRoll: null, houseRules: {},
      feed: Array.from({ length: 400 }, (_, i) => ({ id: i })),
    };
    const snap = packSnapshot({ seq: 3, phase: "play", mod: { id: "ypsilon14", rooms: {} }, g, claims: {}, roster: [] });
    expect(snap.modId).toBe("ypsilon14");
    expect(snap.mod).toBeUndefined();
    expect(snap.state.feed).toHaveLength(120);
    expect(snap.state.feed[119].id).toBe(399);
  });

  it("carries no state before a session starts", () => {
    expect(packSnapshot({ seq: 1, phase: "title", mod: { id: "x" }, g: null, claims: {}, roster: [] }).state).toBe(null);
  });
});

describe("the allowlist", () => {
  it("exposes play actions but never engine or session control", () => {
    for (const a of ["doMove", "attackWith", "resolvePending", "endPcTurn"]) {
      expect(PLAYER_ACTIONS.has(a)).toBe(true);
    }
    for (const a of ["begin", "setHouseRules", "setPending", "api", "act"]) {
      expect(PLAYER_ACTIONS.has(a)).toBe(false);
    }
  });
});
