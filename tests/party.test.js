/* ============================================================
   The two structural changes, tested without a DOM.

   Both are pure-function layers on purpose — engine/party.js and
   the ledger half of engine/tempo.js — precisely so that the
   rules about who hears what and what a round costs can be
   reasoned about here rather than by clicking six phones.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  roomOf, pcsIn, othersHere, isAlone, occupiedRooms, isSplit,
  majorityRoom, audienceFor, exitsFor,
} from "../src/engine/party.js";
import {
  makeScene, sceneCharge, sceneCost, sceneSettle, sceneSpent, sceneNext,
} from "../src/engine/tempo.js";
import { visibleFeed, addressedTo, redactCombat, VIEW } from "../src/engine/secrets.js";
import { pushHistory, popHistory, historyLabel, HISTORY_LIMIT } from "../src/engine/history.js";
import { stem, topicScore, npcReply } from "../src/engine/oracle.js";
import { timeoutFor, medianOf, INTENT_TIMEOUT_MIN, INTENT_TIMEOUT_MAX } from "../src/net/useIntentGate.js";
import { loreIndex, searchLore, flattenLore } from "../src/engine/lore.js";

const pc = (id, room, extra = {}) => ({ id, name: id.toUpperCase(), room, alive: true, ...extra });
const W = { room: "mess" };

describe("where everybody is", () => {
  it("falls back to the party's room for a character that has none", () => {
    expect(roomOf({ id: "a" }, { room: "work" })).toBe("work");
    expect(roomOf({ id: "a", room: "vents" }, { room: "work" })).toBe("vents");
  });

  it("knows who is standing in a room, and who is on their own", () => {
    const crew = [pc("a", "mess"), pc("b", "mess"), pc("c", "vents")];
    expect(pcsIn(crew, "mess", W).map((c) => c.id)).toEqual(["a", "b"]);
    expect(othersHere(crew, crew[0], W).map((c) => c.id)).toEqual(["b"]);
    expect(isAlone(crew, crew[2], W)).toBe(true);
    expect(isAlone(crew, crew[0], W)).toBe(false);
  });

  it("does not count the dead as being anywhere", () => {
    const crew = [pc("a", "vents"), pc("b", "vents", { alive: false })];
    expect(isAlone(crew, crew[0], W)).toBe(true);
    expect(occupiedRooms(crew, W)).toEqual(["vents"]);
  });

  it("derives w.room as where most of the crew is", () => {
    const crew = [pc("a", "mess"), pc("b", "mess"), pc("c", "vents")];
    expect(majorityRoom(crew, { room: "vents" })).toBe("mess");
  });

  it("breaks a tie towards where the party already was, so the sim does not flicker", () => {
    const crew = [pc("a", "mess"), pc("b", "vents")];
    expect(majorityRoom(crew, { room: "vents" })).toBe("vents");
    expect(majorityRoom(crew, { room: "mess" })).toBe("mess");
  });

  it("only filters exits by the hidden flags the world has set", () => {
    const mod = {
      rooms: {
        mess: { exits: [{ to: "work" }, { to: "vents", hidden: "found_vents" }] },
        vents: { exits: [] },
      },
    };
    const w = { room: "mess", flags: {} };
    expect(exitsFor(mod, w, pc("a", "mess"))).toHaveLength(1);
    expect(exitsFor(mod, { ...w, flags: { found_vents: true } }, pc("a", "mess"))).toHaveLength(2);
    expect(exitsFor(mod, w, pc("a", "vents"))).toHaveLength(0);
  });
});

describe("who hears what", () => {
  it("says nothing to anybody in particular while the party is together", () => {
    const crew = [pc("a", "mess"), pc("b", "mess")];
    expect(isSplit(crew, W)).toBe(false);
    // null is the engine's word for "say it out loud", which is the
    // behaviour every existing session depends on.
    expect(audienceFor(crew, W, "mess")).toBeNull();
  });

  it("addresses the room once the party has come apart", () => {
    const crew = [pc("a", "mess"), pc("b", "mess"), pc("c", "vents")];
    expect(isSplit(crew, W)).toBe(true);
    expect(audienceFor(crew, W, "mess")).toEqual(["a", "b"]);
    expect(audienceFor(crew, W, "vents")).toEqual(["c"]);
    expect(audienceFor(crew, W, "wash")).toEqual([]);
  });

  it("delivers an addressed line to everyone named on it and nobody else", () => {
    const feed = [
      { id: 1, text: "public" },
      { id: 2, text: "the vents", to: ["c"] },
      { id: 3, text: "the mess", to: ["a", "b"] },
      { id: 4, text: "one person", to: "a" },
    ];
    expect(addressedTo(feed[1], "c")).toBe(true);
    expect(addressedTo(feed[1], "a")).toBe(false);
    expect(visibleFeed(feed, VIEW.PLAYER, "a").map((l) => l.id)).toEqual([1, 3, 4]);
    expect(visibleFeed(feed, VIEW.PLAYER, "c").map((l) => l.id)).toEqual([1, 2]);
    // The desk hears everything, in one feed, in order. That is the
    // whole reason splitting the party is survivable for the Warden.
    expect(visibleFeed(feed, VIEW.WARDEN, null)).toHaveLength(4);
  });

  it("keeps an unseen thing out of the players' initiative order", () => {
    const mod = {
      items: { irgoggles: { ir: true } },
      threats: { it: { unseen: true, seenWith: "ir", combatLabel: "SOMETHING YOU CANNOT SEE" } },
    };
    const combat = {
      enemies: [{ uid: "it#0", threatId: "it", name: "IT", hits: 2, maxHits: 3, combat: 70 }],
    };
    const blind = redactCombat(combat, mod, [{ id: "a", items: [] }]);
    expect(blind.enemies[0].name).toBe("SOMETHING YOU CANNOT SEE");
    expect(blind.enemies[0].hidden).toBe(true);
    // The tally is the tell: knowing it is on two of three is knowing
    // there is a three, which is knowing what it is.
    expect(blind.enemies[0].hits).toBe(0);

    const seen = redactCombat(combat, mod, [{ id: "a", items: ["irgoggles"] }]);
    expect(seen.enemies[0].name).toBe("IT");
    expect(seen.enemies[0].hits).toBe(2);
  });
});

describe("what a round costs", () => {
  const crew = [pc("a", "mess"), pc("b", "mess"), pc("c", "mess")];

  it("starts with an empty ledger", () => {
    expect(sceneCost(makeScene(crew))).toBe(0);
  });

  it("sums a single player's own actions", () => {
    let s = makeScene(crew);
    s = sceneCharge(s, "a", 10);
    s = sceneCharge(s, "a", 5);
    expect(sceneSpent({ scene: s }, "a")).toBe(15);
    expect(sceneCost(s)).toBe(15);
  });

  it("charges the longest thing anybody did, not the sum of them", () => {
    let s = makeScene(crew);
    s = sceneCharge(s, "a", 10);
    s = sceneCharge(s, "b", 10);
    s = sceneCharge(s, "c", 15);
    // Six players each searching a ten-minute feature used to cost the
    // fiction sixty minutes for one table round. This is the fix.
    expect(sceneCost(s)).toBe(15);
  });

  it("clears the ledger when the round settles, and forgives nothing", () => {
    let s = makeScene(crew);
    s = sceneCharge(s, "a", 20);
    const { scene, mins } = sceneSettle(s);
    expect(mins).toBe(20);
    expect(sceneCost(scene)).toBe(0);
    expect(sceneSpent({ scene }, "a")).toBe(0);
  });

  it("keeps the ledger while the spotlight moves inside a round", () => {
    let s = makeScene(crew);
    s = sceneCharge(s, "a", 10);
    s = sceneNext(s);
    expect(s.round).toBe(1);
    expect(sceneCost(s)).toBe(10);
  });

  it("signals a new round by its number, which is what triggers the charge", () => {
    let s = makeScene(crew);
    s = sceneNext(sceneNext(sceneNext(s)));
    expect(s.round).toBe(2);
  });

  it("survives being asked about a scene that is not running", () => {
    expect(sceneCost(null)).toBe(0);
    expect(sceneSpent(null, "a")).toBe(0);
    expect(sceneSettle(null).mins).toBe(0);
    expect(sceneCharge(null, "a", 5)).toBeNull();
  });
});

describe("the step back", () => {
  it("returns the most recent point and keeps the rest", () => {
    let h = pushHistory([], { w: { clock: 1 }, crew: [], label: "one" });
    h = pushHistory(h, { w: { clock: 2 }, crew: [], label: "two" });
    expect(historyLabel(h)).toBe("two");
    const { entry, stack } = popHistory(h);
    expect(entry.w.clock).toBe(2);
    expect(historyLabel(stack)).toBe("one");
  });

  it("is bounded, because this is a crash mat and not version control", () => {
    let h = [];
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      h = pushHistory(h, { w: { clock: i }, crew: [], label: `n${i}` });
    }
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(historyLabel(h)).toBe(`n${HISTORY_LIMIT + 9}`);
  });

  it("does nothing when there is nothing to take back", () => {
    expect(popHistory([]).entry).toBeNull();
    expect(historyLabel([])).toBeNull();
  });
});

describe("what an NPC heard you ask", () => {
  it("stems rather than truncating, so water is not watch", () => {
    expect(stem("waters")).toBe("water");
    expect(stem("watching")).toBe("watch");
    expect(stem("water")).not.toBe(stem("watch"));
    expect(stem("silence")).not.toBe(stem("silent"));
  });

  it("scores an exact word above a stemmed one", () => {
    const exact = topicScore(["water"], "nobody drinks the water any more");
    const stemmed = topicScore(["watered"], "nobody drinks the water any more");
    expect(exact).toBeGreaterThan(stemmed);
    expect(stemmed).toBeGreaterThan(0);
  });

  it("deflects rather than answering a long script's first line by accident", () => {
    // Ten entries, none of them about the asteroid's orbital period.
    const npc = {
      name: "SONYA",
      knows: Array.from({ length: 10 }, (_, i) => `Line ${i} about pallets and rotas.`),
      deflections: ["\"I wouldn't know about that.\""],
    };
    // rng high enough that the "offer the next fact anyway" branch
    // does not fire, so we are testing the match, not the coin flip.
    const r = npcReply(npc, "what is the orbital eccentricity", { told: [] }, () => 0.9, {});
    expect(r.topic).toBeNull();
    expect(r.deflected).toBe(true);
  });

  it("still answers when the question is actually about something they know", () => {
    const npc = {
      name: "SONYA",
      knows: ["The pallets are staged by the inner lock.", "Mike went missing the night before last."],
    };
    const r = npcReply(npc, "tell me about mike", { told: [] }, () => 0.9, {});
    expect(r.topic).toBe(1);
  });

  it("lets a module declare the words a player would actually use", () => {
    const npc = {
      name: "RIE",
      knows: ["I stopped going down there after what I heard.", "The rota is nobody's problem but mine."],
      topics: [["vents", "ducting"], []],
    };
    const r = npcReply(npc, "what about the vents", { told: [] }, () => 0.9, {});
    expect(r.topic).toBe(0);
  });
});

describe("how long to wait when nothing comes back", () => {
  it("uses the fallback before there is anything to measure", () => {
    expect(medianOf([])).toBeNull();
    expect(timeoutFor([], 3500)).toBe(3500);
  });

  it("scales to the wire the table is actually on", () => {
    expect(timeoutFor([500, 500, 500])).toBe(2000);
  });

  it("is floored and capped, so neither a fast LAN nor one bad sample strands anybody", () => {
    expect(timeoutFor([10, 10, 10])).toBe(INTENT_TIMEOUT_MIN);
    expect(timeoutFor([9000, 9000, 9000])).toBe(INTENT_TIMEOUT_MAX);
  });

  it("takes the median, so one phone waking from sleep does not move the estimate", () => {
    expect(medianOf([400, 400, 400, 400, 9000])).toBe(400);
  });
});

describe("looking something up mid-scene", () => {
  const mod = {
    npcOrder: ["sonya"],
    npcs: { sonya: { name: "SONYA", brief: "Team leader.", knows: ["Nobody has touched the showers in weeks."] } },
    warden: { setting: "A mining base with a thing in the vents.", constraints: ["Never let it become a character."] },
    lore: { job: { summary: "Six pallets, four hours, sign here." }, water: { secret: "It will not cross standing water." } },
  };

  it("flattens a nested tree into things with a path and a body", () => {
    const flat = flattenLore({ a: { b: "hello" } });
    expect(flat).toHaveLength(1);
    expect(flat[0].id).toBe("a.b");
    expect(flat[0].body).toBe("hello");
  });

  it("indexes the module's prep, its Warden material and each NPC's script", () => {
    const entries = loreIndex(mod);
    expect(searchLore(entries, "pallets").length).toBeGreaterThan(0);
    expect(searchLore(entries, "showers").length).toBeGreaterThan(0);
    expect(searchLore(entries, "character").length).toBeGreaterThan(0);
  });

  it("requires every term, because a matcher that guesses is worse than nothing", () => {
    const entries = loreIndex(mod);
    expect(searchLore(entries, "standing water")).toHaveLength(1);
    expect(searchLore(entries, "standing pallets")).toHaveLength(0);
    expect(searchLore(entries, "")).toHaveLength(0);
  });
});
