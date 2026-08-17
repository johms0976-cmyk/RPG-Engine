/* ============================================================
   WORLD — generic runtime state. Shape is the same for every
   module; only the contents differ.
   ============================================================ */
import { evalDice } from "./dice.js";
import { seedFrom } from "./oracle.js";

export const WORLD_VERSION = 2;

export function createWorld(mod, seed) {
  const s = seed != null ? seed : seedFrom(`${mod.id}:${Date.now()}`);
  return {
    v: WORLD_VERSION,
    moduleId: mod.id,
    seed: s,
    rngCalls: 0,
    oracleMemory: {},
    room: mod.start,
    visited: { [mod.start]: true },
    clock: 0,
    day: 0,
    session: 1,
    flags: {},
    searched: {},
    taken: {},
    npcs: Object.fromEntries(
      Object.entries(mod.npcs).map(([id, n]) => [
        id, { loc: n.start ?? null, alive: !n.gone, taken: false, met: false, chat: [], told: [] },
      ])
    ),
    threats: Object.fromEntries(
      Object.entries(mod.threats).map(([id, t]) => [
        id, { loc: t.start ?? null, hits: 0, dmg: 0, retreatUntil: -1, distracted: 0, dead: false },
      ])
    ),
    clocks: Object.fromEntries(
      (mod.clocks || []).map((c) => [c.id, { next: evalDice(c.start ?? 0), on: c.autostart !== false }])
    ),
    countdowns: {},
    rollLog: [],
    clues: [],
    marks: [],
    ended: null,
  };
}

export const roomOf = (mod, w) => mod.rooms[w.room];

export const npcsIn = (mod, w, roomId = w.room) =>
  mod.npcOrder.filter(
    (id) => w.npcs[id] && w.npcs[id].alive && !w.npcs[id].taken && w.npcs[id].loc === roomId
  );

export const threatIn = (mod, w, roomId = w.room) =>
  Object.keys(w.threats).find(
    (id) => w.threats[id].loc === roomId && !w.threats[id].dead && w.threats[id].retreatUntil < w.clock
  ) || null;

export const carriedWeapons = (mod, pc) =>
  pc ? pc.items.filter((i) => mod.items[i] && mod.items[i].tag === "WPN") : [];

export const hasTag = (mod, pc, tag) =>
  !!pc && pc.items.some((i) => mod.items[i] && mod.items[i][tag]);

/** Exits the player can currently see. */
export const visibleExits = (mod, w) =>
  (roomOf(mod, w).exits || []).filter((e) => !e.hidden || w.flags[e.hidden]);

export const dayOf = (w) => Math.floor(w.clock / 1440);
