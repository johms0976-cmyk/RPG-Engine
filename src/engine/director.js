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

import { atmosphere, consultOracle, guessOdds, pickFresh } from "./oracle.js";
import { tempoOf, sceneHolder } from "./tempo.js";
import { floorMove, mostStarved } from "./floor.js";
import { pacingOf, soonestClock, DEFAULT_RATE } from "./pacing.js";
/* The module's own predicate language, reused rather than reinvented.
   A director entry's `when` is the same string a room action's `when`
   is, which means a module author learns one thing and the guard
   rails they already know apply here too. */
import { test as condition } from "./effects.js";

/** The rungs, in order. Exported so the ladder can be asserted
    rather than described. */
export const LADDER = [
  "safety", "pending", "combat", "aftermath", "ending", "scripted",
  "roll", "npc", "floor", "pressure", "pacing", "atmosphere", "silence",
];

/** How long after a failed roll the director will still narrate the
    consequence. Past this the table has moved on and a late line is
    an interruption rather than a reaction. */
export const AFTERMATH_MS = 45 * 1000;

/** Real silence from one NPC before they are allowed to open their
    own mouth. Long: an NPC who speaks unprompted every ninety
    seconds is not a person, they are a kiosk. */
export const NPC_QUIET_MS = 240 * 1000;

/** And how long between any two unprompted NPC lines, table-wide. */
export const NPC_GAP_MS = 300 * 1000;

/** How many times a rung may be waved away before the director
    stops offering it for the rest of the session. Three is a
    judgement, not a measurement: twice is a coincidence, four is
    too many wasted glances. */
export const VETO_LIMIT = 3;

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

/** A non-repeating draw from a module-authored pool. The same
    function the atmosphere pools use, so a module author's `onFail`
    list behaves exactly like their `look` list rather than nearly
    like it. `memory` is the world's own oracle memory, mutated in
    place — which is how `atmosphere` has always worked. */
const pickFrom = (pool, rng, memory, key) => pickFresh(pool, rng, memory, key);

/** Of these characters, the one the floor ledger has had least of.
    Falls back to the first, because a table with no ledger yet is a
    table where anybody is a fair answer. */
function leastServed(pool, w) {
  if (!pool || !pool.length) return null;
  const starved = mostStarved(w, pool);
  if (starved) {
    const match = pool.find((c) => c.id === (starved.pcId || starved.id || starved));
    if (match) return match;
  }
  return pool[0];
}

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

  /* THE FOURTH CHECK, and the one the other three did not need.

     A director that can call for a roll can also *fail* somebody,
     and a failure fires consequence. With a person behind the
     screen the fairness of that is a person's problem; here it has
     to be a rule, and the rule is: a called roll must be able to
     say out loud why it is being called.

     `reason` is not decoration. It is the sentence the player reads
     on the prompt, and requiring it means the director can never
     spring a test for a danger the table was never shown. A module
     author who cannot write the reason has not yet earned the roll. */
  if (move.kind === "callRoll" && !String(move.reason || "").trim()) return null;

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
export function rungScripted({ mod, w, crew, now, lastMoveAt }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.escalate) || !d.escalate.length) return null;
  /* WHERE THE STAGE LIVES, AND WHY IT MOVED.

     This used to read `w.directorStage`, which nothing anywhere in
     the engine wrote. Entry 0 therefore qualified, fired, re-
     qualified on the next tick and fired again — forever. It was
     invisible only because no shipped module had an `escalate`
     list to expose it.

     A module flag is the right home. `flag` is already on the
     Warden API, already saved, already restored, already visible in
     the Warden's own state dump — so an escalation ladder that has
     advanced looks like every other piece of module progress rather
     than a private counter somebody has to remember to persist. */
  const stage = Number((w.flags && w.flags.directorStage) || 0);
  if (stage >= d.escalate.length) return null;
  const entry = d.escalate[stage];
  if (!entry) return null;

  /* Due by the clock, by a condition, or by both. A module author
     writes whichever they actually mean; an entry that declares
     neither is never due, which is deliberate — a beat with no
     trigger is a bug in the module, and firing it immediately would
     hide that. */
  const hasClock = entry.atClock != null;
  const hasWhen = entry.when != null;
  if (!hasClock && !hasWhen) return null;
  if (hasClock && (w.clock || 0) < entry.atClock) return null;
  if (hasWhen && !condition(entry.when, {
    world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null,
  })) return null;

  return {
    kind: "escalate", rung: "scripted", stage,
    /* The number the applier must write back. Carried on the Move so
       the executor never has to recompute it, and so a replayed feed
       shows exactly which rung of the ladder was climbed when. */
    nextStage: stage + 1,
    label: entry.label || null,
    effects: entry.effects || entry,
  };
}

/** 4a — SOMEBODY JUST FAILED, AND NOBODY SAID ANYTHING.
 *
 * The mechanical consequence of a bad roll always lands; the
 * *sentence* about it does not. "You get the hatch open, and the
 * smell tells you what is on the other side" is the half a player
 * remembers, and it is the half that vanishes with the chair.
 *
 * Module-authored, from a per-room or module-wide pool, chosen with
 * the same freshness rule the atmosphere pools use. Nothing is
 * composed: a room with no `onFail` pool simply gets silence, which
 * is exactly what it gets today.
 */
export function rungAftermath({ mod, w, feed, rng, now, lastAftermathAt }) {
  const d = (mod && mod.director) || null;
  const last = [...(feed || [])].reverse().find((l) => l && l.extra && l.extra.roll);
  if (!last) return null;
  const r = last.extra.roll;
  if (!r.failed) return null;
  // Already spoken to, or too old to be a reaction.
  if (lastAftermathAt && lastAftermathAt >= last.id) return null;
  if (last.at && now - last.at > AFTERMATH_MS) return null;

  const room = (mod.rooms || {})[w.room] || {};
  const pool = (Array.isArray(room.onFail) && room.onFail.length ? room.onFail : null)
    || (d && Array.isArray(d.onFail) && d.onFail.length ? d.onFail : null);
  if (!pool) return null;

  const text = pickFrom(pool, rng || Math.random, w.oracleMemory || {}, "onFail");
  if (!text) return null;
  return {
    kind: "describe", rung: "aftermath", room: w.room, text, speaks: true,
    /* So the executor knows which line it has answered and does not
       answer the same failure twice. */
    answered: last.id,
  };
}

/** 4b — THE MODULE SAYS THIS IS OVER.
 *
 * `endings` are declared by every module and, with a Warden, are
 * reached because a person decided the evening had arrived
 * somewhere. With the chair empty nobody calls time, and a table
 * that has won simply carries on searching cupboards.
 *
 * The conditions are the module's, not the director's — this only
 * notices that one of them is now true.
 */
export function rungEnding({ mod, w, crew }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.endings) || !d.endings.length) return null;
  if (w.ended) return null;
  const ctx = { world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null };
  for (const e of d.endings) {
    if (!e || !e.id || !e.when) continue;
    if (!(mod.endings || {})[e.id]) continue;
    if (!condition(e.when, ctx)) continue;
    return { kind: "end", rung: "ending", ending: e.id, why: e.why || null };
  }
  return null;
}

/** 5a — A ROLL, CALLED.
 *
 * The most frequent thing a Warden does and the one thing the
 * director could not do at all. Entries are module-authored and
 * carry their own `when`; the director picks the target and routes
 * it, and `safeMove` refuses any of them that cannot say why.
 */
export function rungCallRoll({ mod, w, crew }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.rolls) || !d.rolls.length) return null;
  const fired = (w.flags && w.flags.directorRolls) || {};
  const here = (crew || []).filter((c) => c.alive !== false && (!c.room || c.room === w.room));
  if (!here.length) return null;

  for (const r of d.rolls) {
    if (!r || !r.id) continue;
    if (r.once !== false && fired[r.id]) continue;
    if (r.when && !condition(r.when, {
      world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null,
    })) continue;

    /* Who. A named class if the module asked for one, otherwise the
       person whose character is standing in the room and who the
       floor ledger has least of — the roll is also a reason to look
       at somebody, and there is no sense wasting it on the player
       who has spoken most. */
    const pool = r.cls ? here.filter((c) => c.cls === r.cls) : here;
    const target = leastServed(pool.length ? pool : here, w);
    if (!target) continue;

    return {
      kind: "callRoll", rung: "roll", id: r.id, pcId: target.id,
      stat: r.stat || "sanity", save: r.save !== false,
      reason: r.reason || "", mode: r.mode || null,
    };
  }
  return null;
}

/** 5b — AN NPC OPENS THEIR OWN MOUTH.
 *
 * `npcReply` is good and it is entirely reactive: nobody on this
 * base ever says anything unless a player taps them first. A
 * Warden's most characteristic move is the opposite — somebody
 * walking in and interrupting.
 *
 * Nothing is invented. The line is an untold entry from that NPC's
 * own `knows` list, which is the same hard limit `npcReply`
 * obeys — INV-6 holds by construction rather than by care.
 */
export function rungNpc({ mod, w, now, lastNpcAt, npcSpokeAt = {} }) {
  if (lastNpcAt && now - lastNpcAt < NPC_GAP_MS) return null;
  const ids = Object.keys(mod.npcs || {});
  for (const id of ids) {
    const state = (w.npcs || {})[id];
    const decl = mod.npcs[id];
    if (!state || !decl) continue;
    if (!state.alive || state.taken || decl.gone) continue;
    // In the room, and known to the crew. A stranger who volunteers
    // something before anyone has met them is a cutscene.
    if (state.loc !== w.room) continue;
    if (!state.met) continue;
    if (npcSpokeAt[id] && now - npcSpokeAt[id] < NPC_QUIET_MS) continue;

    const knows = decl.knows || [];
    if (!knows.length) continue;
    const told = new Set(state.told || []);
    const idx = knows.findIndex((_, i) => !told.has(i));
    if (idx < 0) continue;

    return {
      kind: "npcSay", rung: "npc", npcId: id, index: idx,
      text: knows[idx], speaks: true,
    };
  }
  return null;
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
  lastAftermathAt = 0, lastNpcAt = 0, npcSpokeAt = {},
  /* WHAT THE TABLE HAS ALREADY SAID NO TO.

     A rung -> count of vetoes, accumulated over the session by
     whoever is dismissing suggestions. Past VETO_LIMIT the rung
     stops being offered at all.

     This is the only memory in an otherwise stateless function and
     it is deliberately passed in rather than held: the point of
     `directorPlan` being pure is that a session's decisions can be
     replayed from a feed, and a hidden counter would make the same
     feed produce two different evenings. */
  vetoes = {},
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
    lastAftermathAt, lastNpcAt, npcSpokeAt,
  };

  const rungs = [rungSafety, rungPending, rungCombat, rungAftermath, rungEnding,
    rungScripted, rungCallRoll, rungNpc, rungFloor,
    rungPressure, rungPacing, rungAtmosphere];

  for (const rung of rungs) {
    const move = rung(args);
    if (!move) continue;
    /* Waved away too often. The rung is skipped and the ladder
       continues, so a table that hates being nudged about the clock
       still gets everything else. Safety and the three `wait` rungs
       are unvetoable by construction — they are checked before this
       line, and none of them is a suggestion. */
    if (move.rung && (vetoes[move.rung] || 0) >= VETO_LIMIT
      && move.kind !== "wait" && move.kind !== "halt") continue;
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
  || move.kind === "clock" || move.kind === "escalate"
  /* Called rolls and endings are the two loudest things the director
     can do, and both must be visible to a Warden before they land. */
  || move.kind === "callRoll" || move.kind === "npcSay" || move.kind === "end"));

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
    case "escalate": return move.label ? `Beat due: ${move.label}` : "The module has a beat due";
    case "callRoll": {
      const pc = (crew || []).find((c) => c.id === move.pcId);
      return `Ask ${pc ? pc.name : "somebody"} for a ${String(move.stat).toUpperCase()} ${move.save ? "save" : "check"}`;
    }
    case "npcSay": {
      const n = mod && mod.npcs && mod.npcs[move.npcId];
      return n ? `${n.name} says something unprompted` : "Somebody speaks up";
    }
    case "end": return "The module says this is over";
    case "pressure": return "Move the threat";
    case "halt": return "Somebody pressed the card";
    default: return null;
  }
}
