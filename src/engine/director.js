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
      2  PENDING     a roll is on somebody's screen. Wait, then say
                     their name, then carry on without them.
      3  COMBAT      the fight owns the turn order. Wait.
      4  AFTERMATH   somebody just failed. Say what it cost.
      5  ENDING      one of the module's own endings is true.
      6  LASTCALL    the table said when it finishes, and it has.
      7  SCRIPTED    the module has a beat due — a countdown at
                     zero, an armed sequence, a stage change.
      8  LISTEN      somebody said a thing the author wrote a
                     listener for.
      9  ATTACK      it comes through the door.
     10  ROLL        the module wants this one tested.
     11  NPC         somebody in the room opens their own mouth.
     12  FLOOR       Part B's policy. Somebody has not spoken.
     13  BREATHER    three cruel things in eight minutes. Let up.
     14  PRESSURE    the threat has somewhere to be.
     15  PACING      the evening is drifting or running away.
     16  CALLBACK    the smell is the same one from the airlock.
     17  ATMOSPHERE  the room, said again, differently.
     18  SILENCE     the common answer, and it must stay common.

   This list is prose and prose rots. `RUNGS`, below, is the one
   that runs — if the two ever disagree, that one is right and
   `tests/director3.test.js` will say so.

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
/* WHERE EVERYBODY ACTUALLY IS.
   `party.js` exists because one `w.room` field is correct for one
   player and quietly wrong for six. This file was written before it
   and never revisited: every room-aware rung read `w.room` — the
   *majority* room — so with three in the ducting and three in the
   mess, the empty chair narrated the mess to all six and the three
   in the ducting got nothing at all. See `focusRoom`. */
import { occupiedRooms, pcsIn, roomOf } from "./party.js";
import { tempoOf, sceneHolder } from "./tempo.js";
import { floorMove, mostStarved } from "./floor.js";
import { pacingOf, soonestClock, DEFAULT_RATE } from "./pacing.js";
/* The module's own predicate language, reused rather than reinvented.
   A director entry's `when` is the same string a room action's `when`
   is, which means a module author learns one thing and the guard
   rails they already know apply here too. */
import { test as condition } from "./effects.js";

/* The rungs, in order, are declared ONCE — as `RUNGS`, immediately
   above `directorPlan`, where the loop that walks them lives. `LADDER`
   is derived from it and re-exported at the bottom of this file.

   It used to be a hand-written array up here, and it drifted: two
   rungs — `lastCall` and `listen` — were added to the loop in 2.10.0
   and never to the list. The header comment below still described
   nine rungs while seventeen were running. Nothing caught it, because
   `tests/director3.test.js` only ever asserted LADDER's entries
   against each other and never against the code.

   A list that is meant to make the ladder assertable rather than
   described is worse than useless once it can disagree with the
   ladder, because it is read as authoritative. So it is no longer
   written down twice. See RUNGS. */

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

/* ---------------- the pending prompt ----------------

   How long the ladder will hold behind one unanswered roll before it
   says the player's name, and how long before it gives up and carries
   on without them.

   The old behaviour was to wait forever: `rungPending` returned
   `wait` while anything was pending, so a player who put their phone
   down and went to the kitchen stopped the entire table — not just
   their own turn, but atmosphere, pacing, the floor, everything. A
   person behind the screen waits about a minute and a half, says the
   name, and then gets on with it. */
export const PENDING_PATIENCE_MS = 90 * 1000;
export const PENDING_GIVEUP_MS = 210 * 1000;

/* ---------------- the breather ----------------

   THE RATCHET, AND WHY IT HAD TO BE BROKEN.

   Read the ladder as a whole and every rung on it makes things
   worse: `scripted` escalates, `attack` sets a threat on somebody,
   `roll` tests them, `aftermath` narrates the failure, `pressure`
   moves the creature. Nothing anywhere lets up.

   That is not what a Warden does and it is not what horror is. A
   monotone ratchet stops being frightening at about minute forty,
   which is precisely when a session should be at its worst — the
   table has stopped being able to tell the difference between a bad
   moment and the ambient level, so nothing lands.

   The machinery already existed and the director could not reach
   it. `tempo.breather` is real state and `VOTE_TOPICS.breather`
   lets *players* ask for five minutes. What was missing was the
   director noticing it had just been cruel three times running.

   Note the asymmetry at the bottom of `directorPlan`: a breather
   the director called ends by itself, and a breather a *person*
   called never does. Somebody who put the game down did so for a
   reason, and software that decides the reason has expired is
   software nobody should hand a table to. */
export const BREATHER_WINDOW_MS = 8 * 60 * 1000;
export const BREATHER_HARSH_COUNT = 3;
export const BREATHER_MS = 4 * 60 * 1000;
export const BREATHER_GAP_MS = 25 * 60 * 1000;

/* ---------------- the callback ----------------

   The single most recognisable thing a person behind the screen
   does: *the smell is the same one from the airlock.* Every other
   rung reads the present tick and nothing reaches backwards, so the
   empty chair has the memory of a goldfish and the table feels it
   without being able to name it.

   Nothing is composed. The line is a clue the crew pinned to their
   own board — their words, already public, already on a shared
   screen — and the only thing the engine adds is a fixed label. */
export const CALLBACK_MIN_AGE_MS = 12 * 60 * 1000;
export const CALLBACK_GAP_MS = 20 * 60 * 1000;

/** The one piece of language in this file, and it is a label rather
    than a claim: everything after it is the crew's own text, and the
    words before it are true by construction because `rungCallback`
    filters resolved clues out. */
export const CALLBACK_PREFIX = "Still open:";

/** And the one for a player who has left a prompt open. Addressed
    to them alone, through the same spotlight route every other
    addressed Move uses — it is a sentence about the table, not a
    sentence about the fiction, which is the line this engine draws
    between what a policy may say and what only an author may. */
export const NUDGE_TEXT = "The table is waiting on your roll.";

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

/* ============================================================
   WHICH ROOM IS THIS TICK ABOUT

   A person behind the screen splits their attention between groups
   by hand, and does it badly, and everybody forgives them because
   they can see it happening. A policy function cannot be forgiven
   in the same way, because a table cannot see it happening — the
   two people in the washroom simply receive nothing and conclude
   the game has forgotten them, which it had.

   So attention rotates, on the same principle the floor ledger
   uses for people: the room served longest ago goes next. Not
   random — a referee who is random is a referee nobody can learn
   to read, and that argument applies to *where* it looks as much
   as to *what* it says.

   THE UNSPLIT CASE IS UNCHANGED, deliberately and by construction:
   one occupied room returns `w.room` and every rung behaves
   exactly as it did before this existed. `audienceFor` makes the
   same promise on the delivery side — a null audience is a public
   line — so a table that never splits cannot tell this was added.
   ============================================================ */
export function focusRoom(w, crew, roomServedAt = {}) {
  const rooms = occupiedRooms(crew || [], w);
  /* Nobody placed yet, or everybody together. `w.room` is the
     answer it has always been. */
  if (rooms.length <= 1) return (w && w.room) || rooms[0] || null;

  let best = null;
  let bestAt = Infinity;
  for (const id of rooms) {
    const at = roomServedAt[id] || 0;
    /* Ties go to the majority room, so a split that has only just
       happened starts where the table's attention already was
       rather than jumping to the two people who walked out. */
    if (at < bestAt || (at === bestAt && id === w.room)) { bestAt = at; best = id; }
  }
  return best;
}

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

  /* THE FIFTH CHECK — setting a threat on people.

     Starting a fight is the loudest thing on the ladder and the one
     with the least room for a mistake, so it is guarded harder than
     everything else:

       · the threat must already exist in the world's own state. A
         director that can spawn is a director that can put a
         creature in a corridor the module never said it was in.
       · a threat the module declared `unseen` is never sprung. The
         whole point of `unseen` is that it may be *moved* but never
         *narrated*, and an ambush out of nothing is the purest form
         of narrating it.
       · if the threat tracks a location it has to be in the room the
         crew is standing in.
       · and, exactly as for a called roll, it must be able to say
         why. A fight the table could not have seen coming is the
         thing a bad Warden does and the thing a policy function
         would do constantly if nobody wrote this down. */
  if (move.kind === "combat") {
    const t = (w && w.threats && w.threats[move.threatId]) || null;
    const decl = (mod && mod.threats && mod.threats[move.threatId]) || null;
    if (!t || t.dead) return null;
    if (decl && decl.unseen) return null;
    /* Against the Move's OWN room rather than the party's derived
       one: an ambush in the washroom is legitimate precisely when
       the majority is somewhere else. */
    if (t.loc && t.loc !== (move.room || (w && w.room))) return null;
    if (!String(move.reason || "").trim()) return null;
  }

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

/** 2 — SOMEBODY HAS A PROMPT ON THEIR SCREEN, AND MAY HAVE LEFT.
 *
 * Three states rather than one, because "wait" alone meant "wait
 * forever" and the table paid for it.
 *
 *   under 90s   wait. This is a person reading a prompt, and
 *               hurrying them is the one thing pacing.js refuses to
 *               do for very good reasons.
 *   90s-210s    say their name, once. `warden.nudge` is the
 *               existing call and it addresses one player without
 *               resolving anything on their behalf.
 *   past 210s   stand down and let the ladder continue. The prompt
 *               stays on their phone and stays theirs — nothing is
 *               cancelled, nothing is auto-rolled, nothing is
 *               decided for somebody who is not in the room. The
 *               table simply stops being held hostage by it.
 *
 * What this deliberately does NOT do is answer the prompt. A
 * director that can roll on your behalf when you are slow is a
 * director that has taken your character off you, and no amount of
 * pacing is worth that.
 */
export function rungPending({ pending, now, pendingSince, lastNudgeAt }) {
  if (!pending) return null;
  const waited = pendingSince ? now - pendingSince : 0;
  if (waited < PENDING_PATIENCE_MS) return { kind: "wait", rung: "pending" };
  if (waited >= PENDING_GIVEUP_MS) return null;
  // One nudge per prompt: a second is nagging, and nagging a player
  // who is simply thinking is worse than the wait ever was.
  if (lastNudgeAt && lastNudgeAt >= pendingSince) return { kind: "wait", rung: "pending" };
  const pcId = (pending.req && pending.req.pcId) || pending.pcId || null;
  return { kind: "nudge", rung: "pending", pcId, since: pendingSince, text: NUDGE_TEXT };
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
/** The world flag holding a track's position on its ladder.

    The default track keeps the bare `directorStage` key it has
    always had, so a save written before named tracks existed
    restores to the same place rather than silently starting the
    module's escalations again from the top. */
export function stageFlag(track) {
  return track ? `directorStage:${track}` : "directorStage";
}

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
     than a private counter somebody has to remember to persist.

     ------------------------------------------------------------
     WHY THERE IS NOW MORE THAN ONE OF THEM

     One integer per module means one ladder per module, and a
     module with two live threads — the creature AND the company
     coming to collect — could only ever climb one of them. The
     other's beats sat behind it in the same list waiting for it to
     finish, which is not what an author who wrote two threads
     meant, and there was no way for them to find that out.

     An entry may now declare a `track`. Entries with no track share
     the default one, so every module written before this reads
     exactly as it did — a single list, a single counter, same flag
     key, same saves.

     Tracks are offered in the order they first appear in the list,
     and ONE beat fires per tick regardless of how many are due.
     Two escalations landing in the same second is not two threads
     tightening, it is a mess. */
  const tracks = [];
  const byTrack = new Map();
  for (const entry of d.escalate) {
    if (!entry) continue;
    const key = entry.track ? String(entry.track) : "";
    if (!byTrack.has(key)) { byTrack.set(key, []); tracks.push(key); }
    byTrack.get(key).push(entry);
  }

  for (const track of tracks) {
    const list = byTrack.get(track);
    const flagKey = stageFlag(track);
    const stage = Number((w.flags && w.flags[flagKey]) || 0);
    if (stage >= list.length) continue;
    const entry = list[stage];
    if (!entry) continue;

    /* Due by the clock, by a condition, or by both. A module author
       writes whichever they actually mean; an entry that declares
       neither is never due, which is deliberate — a beat with no
       trigger is a bug in the module, and firing it immediately would
       hide that. */
    const hasClock = entry.atClock != null;
    const hasWhen = entry.when != null;
    if (!hasClock && !hasWhen) continue;
    if (hasClock && (w.clock || 0) < entry.atClock) continue;
    if (hasWhen && !condition(entry.when, {
      world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null,
    })) continue;

    return {
      kind: "escalate", rung: "scripted", stage,
      /* Which counter the applier must write, and what to write in
         it. Both travel on the Move so the executor never recomputes
         anything and a replayed feed shows exactly which rung of
         which ladder was climbed when. */
      track: track || null,
      stageFlag: flagKey,
      nextStage: stage + 1,
      label: entry.label || null,
      effects: entry.effects || entry,
    };
  }
  return null;
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
export function rungAftermath({ mod, w, crew, feed, rng, now, lastAftermathAt, focus }) {
  const d = (mod && mod.director) || null;
  const last = [...(feed || [])].reverse().find((l) => l && l.extra && l.extra.roll);
  if (!last) return null;
  const r = last.extra.roll;
  if (!r.failed) return null;
  // Already spoken to, or too old to be a reaction.
  if (lastAftermathAt && lastAftermathAt >= last.id) return null;
  if (last.at && now - last.at > AFTERMATH_MS) return null;

  /* Where the failure happened, not where most people are. A roll
     that went wrong in the washroom is answered in the washroom —
     and if the roller cannot be resolved, the room this tick is
     already about. */
  const roller = r.pcId ? (crew || []).find((c) => c.id === r.pcId) : null;
  const where = (roller && roomOf(roller, w)) || focus || w.room;
  const room = (mod.rooms || {})[where] || {};
  const pool = (Array.isArray(room.onFail) && room.onFail.length ? room.onFail : null)
    || (d && Array.isArray(d.onFail) && d.onFail.length ? d.onFail : null);
  if (!pool) return null;

  const text = pickFrom(pool, rng || Math.random, w.oracleMemory || {}, "onFail");
  if (!text) return null;
  return {
    kind: "describe", rung: "aftermath", room: where, text, speaks: true,
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
export function rungCallRoll({ mod, w, crew, focus }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.rolls) || !d.rolls.length) return null;
  const fired = (w.flags && w.flags.directorRolls) || {};
  const where = focus || w.room;
  const here = pcsIn(crew || [], where, w).filter((c) => c.alive !== false);
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
      room: where,
      stat: r.stat || "sanity", save: r.save !== false,
      reason: r.reason || "", mode: r.mode || null,
    };
  }
  return null;
}

/** 4c — IT COMES THROUGH THE DOOR.
 *
 * The last thing on the list of what players would name if you
 * asked them what a Warden does, and the one the ladder could not
 * do at all.
 *
 * Worth being exact about what was and was not missing, because
 * this is smaller than it looks. Combat already **self-drives**:
 * `runTurnsUntilPlayer` in useGame walks the initiative order and
 * resolves every enemy turn on its own timer, so the empty chair
 * was always fine *inside* a fight. And a fight could already
 * *start* without a Warden — `effects.js` calls `api.startCombat`
 * and a module's sim does.
 *
 * What had no home was the *judgement*: the decision that now is
 * the moment. That decision is not derivable and this rung does not
 * make it. A module author writes the candidates, with a `when` and
 * a `reason`, and the director only picks the moment among the
 * moments they allowed. `safeMove`'s fifth check refuses the rest.
 */
export function rungAttack({ mod, w, crew, focus }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.attacks) || !d.attacks.length) return null;
  if (w.ended) return null;
  const fired = (w.flags && w.flags.directorAttacks) || {};
  const ctx = { world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null };

  for (const a of d.attacks) {
    if (!a || !a.threatId || !a.when) continue;
    const key = a.id || a.threatId;
    if (a.once !== false && fired[key]) continue;
    /* An attack pinned to a room fires in THAT room, whoever is
       standing in it — which is the whole point of pinning it. An
       unpinned one fires wherever the director is looking. */
    const where = a.room || focus || w.room;
    if (a.room && !occupiedRooms(crew || [], w).includes(a.room)) continue;
    if (!condition(a.when, ctx)) continue;
    /* Somebody has to be here to be attacked. A fight started in a
       room the crew has split away from is a fight nobody is in. */
    const here = pcsIn(crew || [], where, w).filter((c) => c.alive !== false);
    if (!here.length) continue;

    return {
      kind: "combat", rung: "attack", id: key, threatId: a.threatId,
      room: where, surprise: !!a.surprise,
      count: a.count || null, distance: a.distance || null,
      reason: a.reason || "",
    };
  }
  return null;
}

/* ============================================================
   WHAT IS ON THEIR MIND — the words the table is currently near.

   Used only to *order* an NPC's authored lines. It reads the room
   they are standing in, the flags the crew has set, and the clues
   the crew has pinned, and returns a bag of lowercase words. It
   composes nothing and it cannot: every sentence that reaches a
   player is still an untold entry from the module author's own
   `knows` array, verbatim. INV-6 is untouched by this file.

   Deliberately dumb. Substring matching on a small word bag beats
   anything cleverer here for the same reason `safeMove` is five
   crude checks: a weighting that is wrong picks a slightly less
   apt authored line, and a weighting nobody can predict is a
   weighting nobody can debug.
   ============================================================ */
export function mindWords({ mod, w, focus }) {
  const out = new Set();
  const add = (s) => {
    for (const word of String(s || "").toLowerCase().split(/[^a-z0-9]+/)) {
      /* Four letters or more. Shorter tokens ("the", "it", "vent"
         is fine, "a" is not) match everything and would flatten the
         score back to index order with extra steps. */
      if (word.length >= 4) out.add(word);
    }
  };

  const room = (mod.rooms || {})[focus || w.room];
  if (room) { add(room.name); for (const t of room.tags || []) add(t); }

  /* A flag is a thing that has happened. Names and string values
     both, because modules use each: `saw_scratches` is the fact and
     `{ power: "cut" }` is the fact. */
  for (const [k, v] of Object.entries(w.flags || {})) {
    if (v === false || v == null) continue;
    add(k);
    if (typeof v === "string") add(v);
  }

  /* And what the table itself wrote down. A pinned clue is the
     strongest possible signal for what a room is currently about,
     for the same reason `rungCallback` prefers them. Secret clues
     are one player's and are excluded here as they are there. */
  for (const c of w.clues || []) {
    if (!c || c.secret) continue;
    add(c.text || c.label || "");
  }

  return out;
}

/** Which untold line is most nearly about the present moment.
 *
 * Returns an index into `knows`, or -1 when everything has been
 * told. Ties break to the LOWEST index, which is what makes this
 * safe to add: an NPC standing somewhere nothing matches recites
 * in exactly the authored order it always did, so no existing
 * module changes behaviour and no existing test moves.
 */
export function pickKnown(knows, told, words) {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < knows.length; i++) {
    if (told.has(i)) continue;
    const text = String(knows[i] || "").toLowerCase();
    let score = 0;
    for (const word of words) if (text.includes(word)) score += 1;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
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
 *
 * WHICH untold entry is a separate question from whether one may
 * be said, and it used to be answered `findIndex` — the first one
 * nobody had heard. Correct, safe, and not how a person talks: an
 * NPC who volunteers something volunteers what is on their mind,
 * not item 0 and then item 1. `pickKnown` weights the untold lines
 * against the room, the flags and the clue board, and falls back
 * to authored order the moment nothing matches.
 */
export function rungNpc({ mod, w, now, lastNpcAt, npcSpokeAt = {}, focus }) {
  if (lastNpcAt && now - lastNpcAt < NPC_GAP_MS) return null;
  const ids = Object.keys(mod.npcs || {});
  for (const id of ids) {
    const state = (w.npcs || {})[id];
    const decl = mod.npcs[id];
    if (!state || !decl) continue;
    if (!state.alive || state.taken || decl.gone) continue;
    // In the room, and known to the crew. A stranger who volunteers
    // something before anyone has met them is a cutscene.
    if (state.loc !== (focus || w.room)) continue;
    if (!state.met) continue;
    if (npcSpokeAt[id] && now - npcSpokeAt[id] < NPC_QUIET_MS) continue;

    const knows = decl.knows || [];
    if (!knows.length) continue;
    const told = new Set(state.told || []);
    const idx = pickKnown(knows, told, mindWords({ mod, w, focus }));
    if (idx < 0) continue;

    return {
      kind: "npcSay", rung: "npc", npcId: id, index: idx,
      room: focus || w.room,
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

/** 6a — LET THEM PUT IT DOWN.
 *
 * The only rung on the ladder that makes the evening easier, and
 * the reason it exists is at the top of this file under "the
 * ratchet".
 *
 * It fires on a count of *harsh* moves in a window rather than on a
 * mood reading, because the count is a thing the executor already
 * knows for certain and a mood is a thing this file would have to
 * guess. Three screws turned in eight minutes is not a judgement
 * call; it is arithmetic, and it is reliably the point at which a
 * table needs to be allowed to breathe out.
 *
 * It sits above `pressure` on purpose. If the room has gone quiet
 * shortly after three bad things, that quiet is a table reeling and
 * not a table bored, and answering it by moving the creature is
 * exactly the wrong read.
 */
export function rungBreather({ w, now, harshAt = [], lastBreatherAt = 0 }) {
  const t = tempoOf(w);
  if (t.held || t.breather) return null;
  if (lastBreatherAt && now - lastBreatherAt < BREATHER_GAP_MS) return null;
  const recent = (harshAt || []).filter((at) => at && now - at <= BREATHER_WINDOW_MS);
  if (recent.length < BREATHER_HARSH_COUNT) return null;
  return { kind: "breather", rung: "breather", ms: BREATHER_MS, after: recent.length };
}

/** 7b — THE THING FROM EARLIER.
 *
 * `look.js` established the pattern this obeys: select from what
 * the crew has already earned, never compose. A pinned clue is the
 * strongest possible version of that — it is not module content the
 * table might not have reached, it is a sentence somebody at the
 * table wrote down themselves, on a board every phone can already
 * see.
 *
 * Three filters, and each one is load-bearing:
 *
 *   · `secret` clues are excluded. A secret clue is one player's,
 *     and the same argument as `becauseOf.to` in `safeMove`
 *     applies — this is the shared screen.
 *   · `resolved` clues are excluded, which is what makes
 *     CALLBACK_PREFIX true rather than decorative.
 *   · nothing under twelve minutes old, because reminding a table
 *     of something they said four minutes ago is not a callback,
 *     it is a transcript.
 */
export function rungCallback({ w, now, lastLineAt, lastCallbackAt = 0, calledBack = {}, focus }) {
  if (lastLineAt && now - lastLineAt < ATMOSPHERE_QUIET_MS) return null;
  if (lastCallbackAt && now - lastCallbackAt < CALLBACK_GAP_MS) return null;

  const pool = (w.clues || []).filter((c) => c
    && !c.secret && !c.resolved
    && String(c.text || "").trim()
    && !calledBack[c.id]
    && c.at && now - c.at >= CALLBACK_MIN_AGE_MS);
  if (!pool.length) return null;

  // The oldest thing still hanging over the table.
  const clue = pool.reduce((a, b) => (a.at <= b.at ? a : b));
  return {
    kind: "callback", rung: "callback", clueId: clue.id,
    text: clue.text, room: focus || w.room, speaks: true,
  };
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
export function rungAtmosphere({ mod, w, rng, now, lastLineAt, lastAtmosphereAt, focus }) {
  if (lastLineAt && now - lastLineAt < ATMOSPHERE_QUIET_MS) return null;
  if (lastAtmosphereAt && now - lastAtmosphereAt < ATMOSPHERE_GAP_MS) return null;
  const room = mod.rooms[focus || w.room];
  if (!room) return null;
  const text = atmosphere(mod, room, rng || Math.random, w.oracleMemory || {});
  if (!text) return null;
  return { kind: "describe", rung: "atmosphere", room: focus || w.room, text, speaks: true };
}

/* ============================================================
   THE LADDER ITSELF — declared once.

   Name and function together, in the order they are walked. This is
   the only place the order exists: `directorPlan` iterates this,
   `LADDER` is derived from it, and there is therefore no second
   copy to fall out of step with the first.

   That is not tidiness. The previous arrangement had a hand-written
   `LADDER` at the top of the file and a separate `rungs` array
   inside `directorPlan`, and by 2.11.0 they disagreed by two entries
   — `lastCall` and `listen` both ran and neither was listed. The
   drift was invisible because the tests asserted `LADDER` against
   itself. `tests/director3.test.js` now asserts it against `RUNGS`,
   which is only meaningful because there is one of them.

   `rungLastCall` sits high because it is a fact about the room
   rather than a move in the fiction, and `rungListen` sits just
   under the scripted beats because answering what somebody just
   said should beat filling a silence — but never beat safety, a
   pending prompt, or a fight already in progress.
   ============================================================ */
export const RUNGS = [
  ["safety", rungSafety],
  ["pending", rungPending],
  ["combat", rungCombat],
  ["aftermath", rungAftermath],
  ["ending", rungEnding],
  ["lastCall", rungLastCall],
  ["scripted", rungScripted],
  ["listen", rungListen],
  ["attack", rungAttack],
  ["roll", rungCallRoll],
  ["npc", rungNpc],
  ["floor", rungFloor],
  ["breather", rungBreather],
  ["pressure", rungPressure],
  ["pacing", rungPacing],
  ["callback", rungCallback],
  ["atmosphere", rungAtmosphere],
];

/** The rung names in order, with the answer that is not a rung on
    the end. Derived, so it cannot drift. */
export const LADDER = [...RUNGS.map(([name]) => name), "silence"];

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
  /* When the prompt now on somebody's screen first appeared, and
     whether their name has already been said once about it. See
     `rungPending` — the ladder used to hold behind this forever. */
  pendingSince = 0, lastNudgeAt = 0,
  /* When the director last did something that made the evening
     worse, most recent last. `rungBreather` counts them; nothing
     else reads them. Passed in rather than derived from the feed
     because "harsh" is a property of the Move the executor took,
     not of the sentence that ended up in the log. */
  harshAt = [], lastBreatherAt = 0,
  /* Callbacks: when the last one was, and which clues have already
     been used for one. A clue is worth reaching for once. */
  lastCallbackAt = 0, calledBack = {},
  /* C.1 — feed ids already answered. A phrase is worth answering
     once, for the same reason a clue is worth reaching for once. */
  heard = {},
  /* C.3 — a wall-clock ms timestamp the table declared, and whether
     last call has already been announced. Both absent by default:
     no table gets steered who did not ask. */
  sessionEndsAt = 0, lastCallAt = 0,
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
  /* When each occupied room was last the subject of a Move. The
     rotation ledger `focusRoom` reads — same shape and same idea as
     the floor ledger, and for the same reason: attention is a
     finite thing being shared out, and sharing it out by luck is
     indistinguishable from not sharing it out. */
  roomServedAt = {},
}) {
  if (!mod || !w) return null;
  if (w.ended) return null;

  const t = tempoOf(w);
  // A held table is somebody's explicit instruction and the director
  // obeys it exactly as a phone does. There is no timer on it and
  // there must never be one.
  if (t.held) return { kind: "wait", rung: "safety" };

  /* THE ASYMMETRY, AND IT IS THE POINT.

     A breather the director called ends by itself, because otherwise
     the empty chair can stop the game and has no way to start it
     again — nobody is holding the button.

     A breather a *person* called never ends by itself. Somebody put
     the game down for a reason, the reason is theirs, and software
     that decides it has expired is software that has overruled the
     one instruction it was given. `by` is stamped by whoever set it;
     absent means a person, because everything that existed before
     this rung did was a person. */
  if (t.breather) {
    const mine = t.breather.by === "director";
    const over = now - (t.breather.since || 0) >= (t.breather.ms || BREATHER_MS);
    if (mine && over) return { kind: "resume", rung: "breather" };
    return { kind: "wait", rung: "safety" };
  }

  /* Which room this tick is about, decided once and handed to every
     rung, so two rungs on the same tick can never disagree about
     where the director is looking. */
  const focus = focusRoom(w, crew, roomServedAt);

  const args = {
    focus,
    mod, w, crew, feed, combat, pending, safetyCall, startedAt, rng, now,
    lastMoveAt, lastAtmosphereAt, lastActedAt, lastLineAt,
    lastAftermathAt, lastNpcAt, npcSpokeAt,
    pendingSince, lastNudgeAt, harshAt, lastBreatherAt,
    lastCallbackAt, calledBack,
    heard, sessionEndsAt, lastCallAt,
  };

  /* AFTER LAST CALL.

     Not a shorter ladder, a narrower one. What is dropped is
     everything whose job is to OPEN something: a new conversation,
     a revisited clue, a fresh thread from something somebody said.
     What stays is everything that closes — the module's own
     escalations, the declared ending, a fight already coming.

     So the table does not get railroaded and does not get cut off.
     It gets no new rope. */
  const OPENERS = new Set([rungListen, rungNpc, rungCallback, rungPressure]);
  const closing = !!(w.flags && w.flags.lastCall);

  for (const [, rung] of RUNGS) {
    if (closing && OPENERS.has(rung)) continue;
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
    const safe = safeMove(move, { w, mod, crew, focus });
    if (safe) return safe;
    /* Dropped, and the ladder continues. A leaky atmosphere line is
       not a reason to say nothing at all — it is a reason to say
       something else. */
  }

  return null;
}

/* ============================================================
   C.1 — THE RUNG THAT HEARS THE ROOM

   Every other rung on this ladder is triggered by STATE: a clock,
   a flag, a pending prompt, a stretch of silence. Not one of them
   is triggered by a thing somebody said.

   That is backwards. At a real table most Warden moves are
   answers — somebody says "I don't trust the engineer" and the
   Warden, who was not planning anything of the kind, has the
   engineer do something. Sixteen rungs of impeccable state
   machinery still produce a director that has never once
   responded to a sentence, and a table feels that immediately as
   "it isn't really listening". No number of additional rungs
   closes it, because the gap is not in the ladder, it is in what
   the ladder is allowed to look at.

   ------------------------------------------------------------
   HOW THIS STAYS INSIDE INV-6

   It composes nothing. A `listener` is a module author declaring
   a phrase set and, next to it, a Move THEY WROTE. The engine
   matches words and fires prose that already existed — exactly
   what `escalate` does, with the trigger being a player's mouth
   instead of a clock.

   What it must never become is a keyword-to-generated-sentence
   path. If the author has not written the line, there is no line.

   ------------------------------------------------------------
   WHAT IT LISTENS TO

   Only text a player actually typed: what they asked the
   situation (`look`), and what they chose to tell the table
   (`share`). Never narration, never the director's own lines —
   a director that could trigger on its own output would loop,
   and a director triggering on room description would be
   responding to itself.

   Only recent text, and only text it has not already answered.
   `heard` carries the feed ids already used, for the same reason
   `calledBack` exists: a phrase is worth answering once. */
export function rungListen({ mod, w, crew, feed = [], now, lastMoveAt, heard = {} }) {
  const d = (mod && mod.director) || null;
  if (!d || !Array.isArray(d.listeners) || !d.listeners.length) return null;
  /* Not on top of something else. A director answering a sentence
     three seconds after it spoke sounds like interruption. */
  if (now - lastMoveAt < 20 * 1000) return null;

  /* The last handful of player-typed lines, newest first, so the
     most recent thing said wins over something said ten minutes
     ago that also matched. */
  const said = [];
  for (let i = feed.length - 1; i >= 0 && said.length < 8; i--) {
    const l = feed[i];
    if (!l || heard[l.id]) continue;
    if (l.kind !== "look" && l.kind !== "share") continue;
    if (!l.text) continue;
    said.push(l);
  }
  if (!said.length) return null;

  for (const line of said) {
    const hay = String(line.text).toLowerCase();
    for (const entry of d.listeners) {
      if (!entry || !Array.isArray(entry.phrases) || !entry.phrases.length) continue;
      /* Substring, deliberately, not a word boundary or a regex.
         An author writing "engineer" wants to catch "engineers"
         and "the engineer's", and an author who wants precision
         writes a longer phrase. A regex here would be a module
         format nobody can validate. */
      const hit = entry.phrases.some((ph) => ph && hay.includes(String(ph).toLowerCase()));
      if (!hit) continue;
      if (entry.when && !condition(entry.when, {
        world: w, crew: crew || [], items: (mod && mod.items) || {}, pc: null,
      })) continue;
      /* Once each, unless the author says otherwise. A listener
         that fires every time somebody says a common word is a
         parrot, and a table works that out fast. */
      return {
        kind: "listen", rung: "listen",
        heardId: line.id,
        listener: entry.id || null,
        repeat: entry.repeat === true,
        label: entry.label || null,
        effects: entry.effects || null,
      };
    }
  }
  return null;
}

/* ============================================================
   C.3 — THE RUNG THAT KNOWS WHAT TIME IT IS

   "We have been at this two hours and there is no end in sight"
   is a real failure of a weeknight table and there was no
   mechanism for it anywhere. Every other rung is trying to make
   the evening more interesting; this is the only one whose job is
   to make it finish.

   ------------------------------------------------------------
   THE TWO HONEST PARTS

   It steers only toward endings THE MODULE DECLARED. It cannot
   invent one, cannot shortcut to one, and cannot make one happen
   — all it does is stop offering the rungs that open new threads,
   so the ones already open are what the table finishes on.

   And it says so. A single line, once, naming the fact that the
   session has a declared length and it has been reached. A
   director quietly railroading toward an ending because a clock
   said so is precisely what nobody signed up for; the same
   behaviour announced is a table being told the time, which is
   what a Warden glancing at their watch has always done.

   `sessionEndsAt` is a wall-clock ms timestamp, set by the table,
   absent by default. No table gets steered who did not ask. */
export function rungLastCall({ w, now, sessionEndsAt = 0, lastCallAt = 0 }) {
  if (!sessionEndsAt || now < sessionEndsAt) return null;
  if (lastCallAt) return null; // said once, and only once
  return {
    kind: "lastCall", rung: "lastCall",
    /* Written by the applier, read by every rung below. Nothing
       here ends anything. */
    flag: "lastCall",
  };
}

/* ============================================================
   C.5 — WHICH MOVES MAKE THE EVENING WORSE

   This was four strings in `useDirector`:

     new Set(["escalate", "combat", "callRoll", "pressure"])

   plus a special case for `describe` when it came from the
   aftermath rung. Three things were wrong with that and only one
   of them was the strings.

   FIRST, it lived in the executor, a file away from the rungs that
   emit the Moves. Adding a rung did not require anybody to decide
   whether it was harsh — `listen` and `lastCall` both shipped in
   2.10.0 and both defaulted to "not harsh" because nobody was
   asked. That default may even be right. Nobody chose it.

   SECOND, the special case proves the shape was wrong. If
   harshness were really a property of the kind, `describe` would
   not need a rung check pinned to it. It is a property of the
   MOVE — of what that rung does at that moment — and the four
   strings were an approximation that had already sprung one leak.

   THIRD, and worst: a kind nobody listed was silently neutral. A
   missing entry and a deliberate "no" looked identical, so the
   table's rest from being screwed with quietly stopped counting
   things nobody had thought about.

   So it is a table, it lives next to the rungs, it is exhaustive
   over every kind `directorPlan` can emit, and there is a test
   asserting that — a new rung whose kind is not listed here fails
   the suite rather than defaulting to harmless.

   The judgements are unchanged from 2.8.0 for every kind that
   already had one. This is a change of shape, not of behaviour,
   and it should be: the right time to retune these is after a
   table has played four hours on the couch layout, not now.
   ============================================================ */
export const MOVE_HARSH = {
  /* Screws turned, dice demanded, teeth shown. */
  escalate: true,
  combat: true,
  callRoll: true,
  pressure: true,
  /* A failure narrated back at somebody. The old special case,
     now just an entry. */
  describe: ({ rung }) => rung === "aftermath",

  /* Neutral or kind. Describing a room, passing the floor, reading
     a clock — a table does not need a rest from any of it. */
  nudge: false,
  npcSay: false,
  startScene: false,
  breather: false,
  callback: false,
  clock: false,
  end: false,
  /* Answering something somebody said. If this ever feels harsh it
     is because the module author wrote a harsh listener, and the
     honest fix is there rather than here. */
  listen: false,
  /* Telling the room the time. The announcement is the kind half
     of that rung. */
  lastCall: false,

  /* Decisions to do nothing. There is nothing in them to be harsh
     with. */
  wait: false,
  halt: false,
  resume: false,
};

/** Did this Move make the evening worse for the people at the
    table? `rungBreather` counts these; nothing else reads them.

    An unlisted kind returns false and is caught by the suite
    rather than here — throwing at a table mid-session because
    somebody added a rung would be a worse failure than the one it
    is guarding against. */
export function isHarshMove(m) {
  if (!m) return false;
  const rule = MOVE_HARSH[m.kind];
  return typeof rule === "function" ? !!rule(m) : !!rule;
}

/** Is this Move one the table would notice? Used by the assisted
    strip to sort suggestions worth a Warden's glance from the
    bookkeeping ones. */
export const isSpoken = (move) => !!(move && (move.speaks || move.kind === "describe"
  || move.kind === "clock" || move.kind === "escalate"
  /* Called rolls and endings are the two loudest things the director
     can do, and both must be visible to a Warden before they land. */
  || move.kind === "callRoll" || move.kind === "npcSay" || move.kind === "end"
  /* Starting a fight, reaching back to something the crew pinned,
     and stopping the game for five minutes are all things the whole
     table experiences. A Warden must see each of them coming. */
  || move.kind === "combat" || move.kind === "callback"
  || move.kind === "breather"));

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
    case "combat": {
      const t = mod && mod.threats && mod.threats[move.threatId];
      return t ? `${t.name} attacks` : "It attacks";
    }
    case "callback": return "Bring up something they pinned earlier";
    case "breather": return "Give them five minutes";
    case "resume": return "Pick it back up";
    case "nudge": {
      const pc = (crew || []).find((c) => c.id === move.pcId);
      return pc ? `${pc.name} still has a prompt open` : "Somebody still has a prompt open";
    }
    case "halt": return "Somebody pressed the card";
    default: return null;
  }
}
