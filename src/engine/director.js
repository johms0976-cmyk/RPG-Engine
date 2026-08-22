/* ============================================================
   THE DIRECTOR — the loop a Warden was.

   Every decision a Warden makes at a screen-based table was
   already available to the software. `parseCommand` reads the
   room. `consultOracle` answers the unparseable. `atmosphere`
   assembles from pools. `npcReply` speaks within a `knows` list.
   `tempo.js` conducts. `pacing.js` notices the evening slipping.
   `floor.js` notices who has not spoken. The Warden was never
   supplying the knowledge. They were supplying the *loop*: read
   the state, decide whether now is a moment, pick the smallest
   thing that would help.

   This is that loop, written down.

   ------------------------------------------------------------
   WHAT IT IS NOT

   Not a model. There is no generation here and there cannot be:
   a Move names a thing the engine already does, and every word
   that reaches a player was written by a module author or by the
   person at the table. `tests/offline.test.js` fails the build if
   that stops being true, and `directorPlan` is a pure function
   over plain data precisely so that it stays checkable.

   Not an improviser. A Warden rewards the clever idea the module
   never anticipated. This cannot, and pretending otherwise would
   be the dishonest version of this feature. What it does instead
   is answer with the oracle and a complication, and the fiction
   does not update. That is a real loss and it is written in the
   docs rather than hidden.

   ------------------------------------------------------------
   THE LADDER, NOT THE TABLE

   Selection is a strict priority ladder, declared once, tested.
   It is deliberately not a weighted random choice: a referee who
   is random is a referee nobody can learn to read, and learning
   to read the referee is most of what a player does.

   Read top to bottom; the first rung that has something to say
   wins, and if none of them do the answer is silence.

     1  SAFETY      somebody pressed the card. Nothing else runs.
     2  PENDING     a roll is on somebody's screen. Wait.
     3  COMBAT      the fight owns the turn order. Wait.
     4  SCRIPTED    the module has a beat due — a countdown at
                    zero, an armed sequence, a stage change.
     5  FLOOR       Part B's policy. Somebody has not spoken.
     6  PRESSURE    the threat has somewhere to be.
     7  PACING      the evening is drifting or running away.
     8  ATMOSPHERE  the room, said again, differently.
     9  SILENCE     the common answer, and it must stay common.

   ------------------------------------------------------------
   THE THING THAT WILL BITE

   THE DIRECTOR READS UNREDACTED STATE AND EVERYTHING IT SAYS
   GOES ON A SCREEN EVERYONE CAN SEE.

   A Warden knows which of the things they know are secret,
   because they are a person. A policy function does not. If it
   picks an atmosphere line keyed to a threat in the ducting, or
   names a room nobody has entered, or reacts to something one
   player was told privately, it has published a secret to the
   shared screen — and unlike a leaked snapshot, nothing will
   ever throw an error about it.

   So every Move goes through `safeMove` before it is spoken, and
   a Move that does not survive is DROPPED rather than rewritten.
   Same argument as the relay filtering peer whispers: what is
   never composed cannot leak, and a rewrite is a promise.
   ============================================================ */

import { atmosphere, consultOracle, guessOdds } from "./oracle.js";
import { tempoOf, sceneHolder } from "./tempo.js";
import { floorMove } from "./floor.js";
import { pacingOf, soonestClock, DEFAULT_RATE } from "./pacing.js";

/** The rungs, in order. Exported so the ladder can be asserted
    rather than described. */
export const LADDER = [
  "safety", "pending", "combat", "scripted", "floor", "pressure",
  "pacing", "atmosphere", "silence",
];

/** How long a room has to be quiet before the director will say
    something about it. Two minutes of real time: long enough that a
    table mid-conversation is never talked over, short enough that a
    stalled table is not left staring. */
export const ATMOSPHERE_QUIET_MS = 120 * 1000;

/** And how long between two atmosphere lines, at minimum. The pools
    are finite and non-repeating; spending them in the first ten
    minutes leaves nothing for the hour that needs them. */
export const ATMOSPHERE_GAP_MS = 180 * 1000;

/** Real seconds of nothing at all before the director will push the
    threat rather than merely describe the room. */
export const PRESSURE_STALL_MS = 300 * 1000;

/* ============================================================
   THE GUARD
   ============================================================ */

/** Rooms the crew has actually been in. Anything else is a place
    the director must not name. */
const seenRooms = (w) => new Set(Object.keys((w && w.visited) || {}));

/**
 * Would saying this leak something?
 *
 * Three checks, and they are deliberately crude. A crude guard that
 * drops a good line occasionally is a much better trade than a
 * clever one that lets a bad line through once a session, because
 * the failure is silent and the table will never know it happened.
 *
 *   · a Move about a room nobody has entered
 *   · a Move about a threat the crew cannot see
 *   · a Move whose justification traces to a private feed line
 *
 * Returns the Move, or null.
 */
export function safeMove(move, { w, mod, crew } = {}) {
  if (!move) return null;
  if (move.kind === "silence") return null;

  if (move.room && !seenRooms(w).has(move.room)) return null;

  if (move.threatId) {
    const t = (w && w.threats && w.threats[move.threatId]) || null;
    const decl = (mod && mod.threats && mod.threats[move.threatId]) || null;
    // An unseen thing may be *moved*, but never *narrated* — that is
    // the whole reason `unseen` exists on a threat.
    if (move.speaks && (!t || (decl && decl.unseen))) return null;
  }

  /* A Move justified by a private line is the subtlest of the three
     and the only one that could turn one player's secret into public
     knowledge without anybody typing it. If the director wants to
     react to something, it has to be something the table saw. */
  if (move.becauseOf && move.becauseOf.to != null) return null;

  /* Nothing addressed to a single player may be spoken aloud. A
     whisper Move is not "said" — it is routed by useGame and
     redacted host-side, so it is exempt by construction and is the
     only Move that carries `to`. */
  if (move.to != null && move.kind !== "whisper") return null;

  return move;
}

/* ============================================================
   THE RUNGS

   Each returns a Move or null, and each is exported so a table's
   worth of behaviour can be tested one rung at a time rather than
   through the whole ladder.
   ============================================================ */

/** 1 — nothing runs while the card is up. */
export function rungSafety({ safetyCall }) {
  if (!safetyCall) return null;
  return { kind: "halt", rung: "safety", why: safetyCall.level || "check" };
}

/** 2 — somebody has a prompt on their screen. */
export function rungPending({ pending }) {
  return pending ? { kind: "wait", rung: "pending" } : null;
}

/** 3 — the fight owns the order, and combat.js already conducts it. */
export function rungCombat({ combat }) {
  return combat ? { kind: "wait", rung: "combat" } : null;
}

/** 4 — the module has something due. Countdowns at zero and armed
    sequences are already fired by useGame's own tick; what this rung
    exists for is the *narrative* beat a module declares, so a module
    author can say "when they have been in here ten minutes, this
    happens" without writing a hook. */
export function rungScripted({ mod, w, now, lastMoveAt }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.escalate) || !d.escalate.length) return null;
  const stage = Number(w.directorStage || 0);
  if (stage >= d.escalate.length) return null;
  const entry = d.escalate[stage];
  const dueAt = entry && entry.atClock != null ? entry.atClock : null;
  if (dueAt == null || (w.clock || 0) < dueAt) return null;
  return { kind: "escalate", rung: "scripted", stage, effects: entry.effects || entry };
}

/** 5 — Part B, unchanged and reused rather than reimplemented. */
export function rungFloor({ w, crew, now, lastMoveAt }) {
  const m = floorMove({ w, crew, now, lastMoveAt });
  if (!m) return null;
  if (m.kind === "spotlight") return { ...m, rung: "floor" };
  return { kind: "startScene", rung: "floor" };
}

/** 6 — the creature has somewhere to be. The director does not
    decide *where*: modules own their threats' drives, and this only
    asks the module to take its turn. */
export function rungPressure({ mod, w, now, lastActedAt }) {
  const d = (mod && mod.director) || null;
  if (!d || !d.pressure) return null;
  if (!lastActedAt || now - lastActedAt < PRESSURE_STALL_MS) return null;
  return { kind: "pressure", rung: "pressure", run: d.pressure };
}

/** 7 — the evening. `pacing.js` computes it; this decides whether it
    is worth a beat. Only ever a recap or a nudge toward the clock,
    never "hurry up", which is the thing pacing.js refuses to say for
    exactly the right reasons. */
export function rungPacing({ mod, w, now, startedAt }) {
  const rate = (mod && mod.director && mod.director.rate) || DEFAULT_RATE;
  const p = pacingOf({ startedAt, clock: w.clock, now, rate });
  if (!p || p.state !== "drifting") return null;
  const soon = soonestClock(w);
  if (!soon) return null;
  return { kind: "clock", rung: "pacing", countdown: soon.label, left: soon.left };
}

/** 8 — the room, said again, differently. The rung that runs most,
    and the one most likely to become wallpaper if it runs too often. */
export function rungAtmosphere({ mod, w, rng, now, lastLineAt, lastAtmosphereAt }) {
  if (lastLineAt && now - lastLineAt < ATMOSPHERE_QUIET_MS) return null;
  if (lastAtmosphereAt && now - lastAtmosphereAt < ATMOSPHERE_GAP_MS) return null;
  const room = mod.rooms[w.room];
  if (!room) return null;
  const text = atmosphere(mod, room, rng || Math.random, w.oracleMemory || {});
  if (!text) return null;
  return { kind: "describe", rung: "atmosphere", room: w.room, text, speaks: true };
}

/* ============================================================
   THE PLAN
   ============================================================ */

/**
 * One Move, or null for silence.
 *
 * Everything it needs arrives as arguments. It reads no refs, holds
 * no state between calls, and touches no clock it was not handed —
 * which is what makes a whole session's worth of decisions
 * replayable from a feed when one of them turns out to be wrong.
 */
export function directorPlan({
  mod, w, crew, feed = [], combat = null, pending = null,
  safetyCall = null, startedAt = 0, rng = Math.random,
  now = Date.now(), lastMoveAt = 0, lastAtmosphereAt = 0,
  lastActedAt = 0, lastLineAt = 0,
}) {
  if (!mod || !w) return null;
  if (w.ended) return null;

  const t = tempoOf(w);
  // A held table, a declared break, and a scene belonging to somebody
  // are all somebody's explicit instruction. The director obeys them
  // exactly as a phone does.
  if (t.held || t.breather) return { kind: "wait", rung: "safety" };

  const args = {
    mod, w, crew, feed, combat, pending, safetyCall, startedAt, rng, now,
    lastMoveAt, lastAtmosphereAt, lastActedAt, lastLineAt,
  };

  const rungs = [rungSafety, rungPending, rungCombat, rungScripted, rungFloor,
    rungPressure, rungPacing, rungAtmosphere];

  for (const rung of rungs) {
    const move = rung(args);
    if (!move) continue;
    /* `wait` and `halt` are decisions to do nothing, not things to
       say, so they skip the guard — there is nothing in them to
       leak. Everything else is checked before it can be spoken. */
    if (move.kind === "wait" || move.kind === "halt") return move;
    const safe = safeMove(move, { w, mod, crew });
    if (safe) return safe;
    /* Dropped, and the ladder continues. A leaky atmosphere line is
       not a reason to say nothing at all — it is a reason to say
       something else. */
  }

  return null;
}

/** Is this Move one the table would notice? Used by the assisted
    strip to sort suggestions worth a Warden's glance from the
    bookkeeping ones. */
export const isSpoken = (move) => !!(move && (move.speaks || move.kind === "describe"
  || move.kind === "clock" || move.kind === "escalate"));

/** One line of plain English for the Warden's suggestion strip.
    Templates over the Move's own fields — there is no generation
    here, and a Move with nothing to say produces nothing. */
export function moveLabel(move, { mod, crew } = {}) {
  if (!move) return null;
  switch (move.kind) {
    case "describe": return "Say something about the room";
    case "startScene": return "Go round the room";
    case "spotlight": {
      const pc = (crew || []).find((c) => c.id === move.pcId);
      return pc ? `Look at ${pc.name}` : "Look at somebody";
    }
    case "clock": return `Remind them: ${move.countdown}, ${move.left}m`;
    case "escalate": return "The module has a beat due";
    case "pressure": return "Move the threat";
    case "halt": return "Somebody pressed the card";
    default: return null;
  }
}
