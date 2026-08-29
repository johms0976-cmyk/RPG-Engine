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
    /* WALL-CLOCK, NOT FICTION-CLOCK.

       `clock` is the fiction's time and always has been. This is
       the other one: when the table actually sat down. The engine
       had every number needed to notice that a Warden was three
       real hours in with three fiction-hours still to spend, and
       could not, because it did not know what time it was. See
       engine/pacing.js — nothing reads this but the Warden's own
       screen, and nothing acts on it. */
    startedAt: Date.now(),
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
    /* Facts this table added that the module did not ship. See
       engine/ruling.js — kept here rather than merged into `mod`
       because the module object is shared between tables and a
       ruling is not, and because a ruling can be taken back. */
    rulings: [],
    clues: [],
    marks: [],
    /* Handouts that have been opened, keyed by id: { id, first, by }.
       A handout the crew has read is a prop they still own — this is
       what lets a phone hand it back later instead of making the
       player scroll the log for it. */
    handouts: {},
    /* A handout the Warden has put in the middle of the table, shown
       on the shared screen and on every phone at once. */
    tableHandout: null,
    /* Who a handout on the table is *for*. Absent or null means
       everyone; an array of pcIds means those people and nobody else,
       which is how two players end up knowing something the table
       does not. See tempo/props on the Warden deck. */
    handoutTargets: {},
    /* Threads drawn between pinned clues — the conspiracy board.
       [{ id, a, b, note }], where a and b are clue ids. */
    clueLinks: [],
    /* Offers of an object from one hand to another, waiting to be
       taken. giveItem used to be one tap and done, which is how the
       vibe check ends up with the wrong person mid-firefight. */
    trades: [],
    /* The brakes. See engine/tempo.js — held, scene turns, the pinned
       situation line, the breather and the optional rate limit all
       live here so they travel in every snapshot and survive a save. */
    tempo: {
      held: false, heldWhy: null, scene: null, situation: null,
      breather: null, rateMs: 0, lastRecapAt: 0,
    },
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
