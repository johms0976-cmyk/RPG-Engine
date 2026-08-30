/* ============================================================
   TABLE ANALYTICS — what the module did at a real table.

   The backlog entry asked for three things: which rooms stall,
   which gates get brute-forced, which endings nobody reaches. It
   turned out to be much cheaper than its score, because almost
   all of the reading was already being done somewhere else and
   nothing was joining it up:

     `coverage.js`   what the module declares, and what it leaves
                     empty. Static — it never sees a table.
     `misses.js`     what players said that the module had no
                     answer for. One session.
     `dossier.js`    which flags fired, who was told what.
     `campaign.js`   which endings a table has reached, over
                     however many evenings.

   This is the join, and it is arithmetic over data already being
   collected. One new field was needed and it is named where it
   was added: rolls now record `tags` and `why`, which the feed
   line has always printed and the log has never kept.

   ------------------------------------------------------------
   THE ONE MEASURE I COULD NOT HONESTLY BUILD

   "Which rooms stall" wants time-in-room, and nothing in this
   engine records it. The feed stamps every line with the clock
   but not with the room; `w.visited` is a set of booleans with no
   timing on it. Deriving it would mean attributing feed lines to
   rooms by inference, which would be wrong exactly when the party
   is split — which is when a Warden most wants the answer.

   Rather than ship a number that is wrong under conditions
   nobody would think to check, this reports what the data
   actually supports: which rooms were never reached, and which
   were reached and then had nothing in them touched. The second
   is arguably the better question anyway. A room the crew walked
   into and walked straight out of is a room that did not hold
   them, and that is what "stalls" was reaching for from the
   other side.

   Instrumenting time-in-room properly is a small change to
   `doMove` and a field on the world. It is not in this release
   because a measurement added late and never validated against a
   real table is how a report starts lying.

   ------------------------------------------------------------
   IT REPORTS. IT DOES NOT GRADE.

   Same posture as `coverage.js`, and the same reason. There is
   no score here, no "health", no traffic lights, and no sentence
   containing the word "should". A module where nobody found the
   third ending is not a worse module — it may be a module with
   an ending that costs something to reach, which is the point of
   having one. The author is the person who knows.
   ============================================================ */

import { coverage } from "./coverage.js";
import { backlog } from "./misses.js";

/** Rolls a table made against a locked door, grouped by the door.
    `why` is the gate's own label, which is why it had to start
    being logged — the stat name cannot tell two doors apart. */
function doorwork(rollLog = []) {
  const by = new Map();
  for (const r of rollLog) {
    if (!r || !Array.isArray(r.tags) || !r.tags.includes("door")) continue;
    const key = r.why || "an unnamed lock";
    if (!by.has(key)) by.set(key, { label: key, rolls: 0, failed: 0, opened: false, who: new Set() });
    const e = by.get(key);
    e.rolls += 1;
    if (r.success) e.opened = true; else e.failed += 1;
    if (r.who) e.who.add(r.who);
  }
  return [...by.values()]
    .map((e) => ({ ...e, who: [...e.who] }))
    .sort((a, b) => b.rolls - a.rolls);
}

/**
 * One evening, read back.
 *
 * @param {object} mod   the module that was played
 * @param {object} w     the world it finished in
 * @param {Array}  feed  the session's feed, for the miss backlog
 */
export function sessionReport(mod, w, feed = []) {
  const cov = coverage(mod);
  const visited = (w && w.visited) || {};
  const searched = (w && w.searched) || {};
  const flags = (w && w.flags) || {};
  const npcState = (w && w.npcs) || {};

  const rooms = Object.entries(mod.rooms || {}).map(([id, r]) => {
    const features = Object.keys(r.features || {});
    const touched = features.filter((k) => searched[`${id}:${k}`]);
    return {
      id,
      name: r.name || id,
      reached: !!visited[id],
      features: features.length,
      touched: touched.length,
      /* Walked into and walked straight out of. Not a fault — see the
         header — but the thing an author most wants to know and has
         never been able to. */
      passedThrough: !!visited[id] && features.length > 0 && touched.length === 0,
    };
  });

  const gates = doorwork((w && w.rollLog) || []);

  const cast = Object.entries(mod.npcs || {}).map(([id, n]) => {
    const st = npcState[id] || {};
    const total = (n.knows || []).length;
    const told = (st.told || []).length;
    return {
      id,
      name: n.name || id,
      met: !!st.met,
      lines: total,
      told: Math.min(told, total),
      /* Everything they were written to say and never got to. */
      unheard: Math.max(0, total - told),
    };
  });

  const handouts = Object.entries(mod.handouts || {}).map(([id, ho]) => ({
    id,
    label: ho.label || id,
    opened: !!(w && w.handouts && w.handouts[id]),
  }));

  return {
    modId: mod.id,
    modTitle: mod.title,
    ending: (w && w.ended) || null,
    minutes: (w && w.clock) || 0,
    rooms,
    gates,
    cast,
    handouts,
    flags: Object.entries(flags).filter(([, v]) => !!v).map(([k]) => k),
    /* Declared but never reached in play. `coverage.js` already
       answers the static half of this — rooms no exit reaches — and
       the two are worth reading together: a room unreachable by
       declaration AND unvisited is a room, and a room reachable by
       declaration and unvisited is an evening. */
    unreachable: cov.unreachableRooms,
    misses: backlog(feed),
  };
}

/**
 * The small, storable version. One of these per session goes into the
 * campaign record so that questions spanning several evenings can be
 * answered without keeping six worlds around.
 *
 * Deliberately counts and ids only. No prose, no player names, no
 * typed sentences — the miss backlog stays in the session it came
 * from, because it is verbatim things humans said and a campaign
 * file gets pasted into chat windows.
 */
export function sessionDigest(report) {
  if (!report) return null;
  return {
    v: 1,
    modId: report.modId,
    ending: report.ending,
    minutes: report.minutes,
    rooms: report.rooms.map((r) => ({
      id: r.id, reached: r.reached, touched: r.touched, features: r.features,
    })),
    gates: report.gates.map((g) => ({
      label: g.label, rolls: g.rolls, failed: g.failed, opened: g.opened,
    })),
    cast: report.cast.map((c) => ({ id: c.id, met: c.met, told: c.told, lines: c.lines })),
    handouts: report.handouts.map((h) => ({ id: h.id, opened: h.opened })),
    misses: report.misses.length,
  };
}

/**
 * Several evenings of the same module, added up.
 *
 * @param {object} mod       the module
 * @param {Array}  digests   `sessionDigest` output, oldest first
 */
export function tableReport(mod, digests = []) {
  const mine = digests.filter((d) => d && d.modId === mod.id);
  const n = mine.length;

  const roomSeen = new Map();
  const gateWork = new Map();
  const castMet = new Map();
  const handoutSeen = new Map();
  const endings = new Map();
  let minutes = 0;
  let misses = 0;

  for (const d of mine) {
    minutes += d.minutes || 0;
    misses += d.misses || 0;
    if (d.ending) endings.set(d.ending, (endings.get(d.ending) || 0) + 1);
    for (const r of d.rooms || []) {
      const e = roomSeen.get(r.id) || { reached: 0, touchedIn: 0 };
      if (r.reached) e.reached += 1;
      if (r.touched > 0) e.touchedIn += 1;
      roomSeen.set(r.id, e);
    }
    for (const g of d.gates || []) {
      const e = gateWork.get(g.label) || { rolls: 0, failed: 0, opened: 0, sessions: 0 };
      e.rolls += g.rolls; e.failed += g.failed; e.sessions += 1;
      if (g.opened) e.opened += 1;
      gateWork.set(g.label, e);
    }
    for (const c of d.cast || []) {
      const e = castMet.get(c.id) || { met: 0, told: 0, lines: c.lines || 0 };
      if (c.met) e.met += 1;
      e.told = Math.max(e.told, c.told || 0);
      castMet.set(c.id, e);
    }
    for (const ho of d.handouts || []) {
      const e = handoutSeen.get(ho.id) || { opened: 0 };
      if (ho.opened) e.opened += 1;
      handoutSeen.set(ho.id, e);
    }
  }

  return {
    modId: mod.id,
    modTitle: mod.title,
    sessions: n,
    minutes,
    misses,

    rooms: Object.entries(mod.rooms || {}).map(([id, r]) => {
      const e = roomSeen.get(id) || { reached: 0, touchedIn: 0 };
      return {
        id, name: r.name || id,
        reached: e.reached,
        touchedIn: e.touchedIn,
        /* Never, across every evening this table has played. The
           strongest signal in the whole report and the one that costs
           an author the most when nobody tells them. */
        never: n > 0 && e.reached === 0,
      };
    }),

    gates: [...gateWork.entries()]
      .map(([label, e]) => ({ label, ...e, perSession: e.sessions ? e.rolls / e.sessions : 0 }))
      .sort((a, b) => b.rolls - a.rolls),

    cast: Object.entries(mod.npcs || {}).map(([id, npc]) => {
      const e = castMet.get(id) || { met: 0, told: 0, lines: (npc.knows || []).length };
      return {
        id, name: npc.name || id,
        met: e.met,
        lines: (npc.knows || []).length,
        best: e.told,
        never: n > 0 && e.met === 0,
      };
    }),

    handouts: Object.entries(mod.handouts || {}).map(([id, ho]) => {
      const e = handoutSeen.get(id) || { opened: 0 };
      return { id, label: ho.label || id, opened: e.opened, never: n > 0 && e.opened === 0 };
    }),

    /* THE THIRD THING THE BACKLOG ASKED FOR. Every declared ending,
       with how many times this table has reached it — which is zero
       for most of them in most campaigns, and that is a fact about
       the evenings rather than a fault in the module. */
    endings: Object.entries(mod.endings || {}).map(([id, e]) => ({
      id,
      title: e.title || id,
      good: !!e.good,
      reached: endings.get(id) || 0,
      never: n > 0 && !endings.has(id),
    })),
  };
}

export default sessionReport;
