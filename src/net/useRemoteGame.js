/* ============================================================
   useRemoteGame — a useGame-shaped object backed by the network.

   The trick that keeps this small: Play.jsx only ever touches the
   object it is handed. So if we build something with the same keys
   — state fields read from the host's snapshot, action functions
   replaced by intent senders — the existing play screen works on a
   phone with no changes at all.

   "The same keys" has to include `api`, which is the part that used
   to be an empty object. Play.jsx calls api.ctx() while it is still
   deciding which buttons to draw, so an empty api is not a feature
   that quietly does nothing — it is a crash before first paint.

   What api.ctx() returns here is deliberately the *redacted* world:
   the phone tests `when` clauses against what the host chose to
   send it, which means a predicate about an unseen threat reads
   false on the phone and true on the Warden's screen. That is the
   correct answer for both. Anything with real consequences is still
   re-tested host-side before it runs.

   What stays local: the module (compiled into every client, looked
   up by id rather than shipped), and the two purely cosmetic modals
   (talking, device) which are opened by your own tap and shouldn't
   pop up on everyone else's phone.
   ============================================================ */
import { useMemo, useState, useCallback } from "react";
import MODULES from "../modules/index.js";
import { PLAYER_ACTIONS, pendingOwner } from "./protocol.js";
import { possibleAssists, possibleTherapists, findPc } from "../engine/crew.js";
import { dayOf } from "../engine/world.js";

/** A world object that predicates can be run against without checking
    every key first. Redaction strips some of these, and `test` reaches
    into w.flags / w.npcs / w.threats without guarding, so a missing one
    is a TypeError rather than a false. */
function safeWorld(w, extra) {
  return {
    clock: 0, room: null,
    flags: {}, visited: {}, npcs: {}, threats: {}, meters: {},
    countdowns: {}, clocks: {}, rooms: {},
    ...(w || {}),
    ...extra,
  };
}

export function useRemoteGame(snapshot, myPcId, send) {
  const [talking, setTalking] = useState(null);
  const [device, setDevice] = useState(null);

  const mod = useMemo(
    () => MODULES.find((m) => m.id === (snapshot && snapshot.modId)) || null,
    [snapshot && snapshot.modId],
  );

  const fire = useCallback((action, args) => {
    if (!PLAYER_ACTIONS.has(action)) return;
    send({ t: "intent", action, args, asPc: myPcId });
  }, [send, myPcId]);

  return useMemo(() => {
    const s = snapshot && snapshot.state;
    if (!mod || !s) return null;

    const me = findPc(s.crew, myPcId);
    // A prompt aimed at another player is not shown here — they answer it
    // on their own phone and everyone sees the result in the feed.
    const owner = pendingOwner(s.pending);
    const myPending = s.pending && (!owner || owner === myPcId) ? s.pending : null;
    const day = dayOf(s.w);

    const w = safeWorld(s.w, { clues: s.clues || [], marks: s.marks || [] });
    const crew = s.crew || [];
    const items = mod.items || {};
    const houseRules = s.houseRules || {};

    const send_ = {};
    for (const name of PLAYER_ACTIONS) send_[name] = (...args) => fire(name, args);

    /* The read-only half of the engine api. Every mutating member is a
       no-op rather than a missing key: a phone that tries to narrate or
       hand out an item should do nothing, not throw. Authority is the
       host's, and this object exists so the shared UI can *ask
       questions* about the world without caring which side it is on. */
    const noop = () => {};
    const api = {
      mod, items, houseRules,
      world: () => w,
      pc: () => me,
      crew: () => crew,
      rng: Math.random,
      ctx: () => ({ world: w, pc: me, crew, items, mod, houseRules }),
      ended: () => !!w.ended,
      say: noop, flag: noop, give: noop, take: noop, stress: noop, stressCrew: noop,
      meter: noop, heal: noop, hurt: noop, panic: noop, addCondition: noop, addBuff: noop,
      advance: noop, noise: noop, vanish: noop, run: noop, setThreat: noop, setNpc: noop,
      npcSay: noop, startTrack: noop, awardXp: noop, countdown: noop, stopCountdown: noop,
      offerRest: noop, ask: noop, startCombat: noop, endGame: noop, moveTo: noop,
      rollTable: () => null,
      rollNow: () => ({ success: false }),
      effects: noop,
    };

    return {
      ...send_,
      mod,
      items,
      w,
      clues: s.clues || [],
      marks: s.marks || [],
      // Invented by distort() for a hallucinating player, and marked so
      // nothing built on it can be load-bearing.
      phantomExit: s.phantomExit || null,
      crew,
      // The phone is always looking at its own character, whatever the
      // host's activeId happens to be at this instant.
      pc: me,
      activeId: myPcId,
      feed: s.feed || [],
      pending: myPending,
      combat: s.combat,
      resting: s.resting && s.resting.pcId && s.resting.pcId !== myPcId ? null : s.resting,
      levelUp: s.levelUp && s.levelUp.pcId && s.levelUp.pcId !== myPcId ? null : s.levelUp,
      shopping: s.shopping,
      lastRoll: s.lastRoll,
      houseRules,
      talking, setTalking,
      device, setDevice,
      // Switching character is the host's business; a phone owns one PC.
      setActiveId: () => {},
      setResting: () => {}, setLevelUp: () => {}, setShopping: () => {},
      setPending: () => {}, setHouseRules: () => {},
      possibleAssists: (target) => possibleAssists(crew, target || me, day),
      possibleTherapists: (target) => possibleTherapists(crew, target, day),
      /* Play.jsx hands `act` the effects array it pulled off a room or
         module action. Both sides import the same module file, so that
         array is the *same object* the host has, and matching on it
         recovers the action's id — which is all that travels. Effects
         themselves never go over the wire in either direction. */
      act: (effects) => {
        const here = mod.rooms[w.room] || {};
        const a = (mod.actions || []).concat(here.actions || [])
          .find((x) => x && x.effects === effects);
        if (a && a.id) fire("runAction", [a.id]);
      },
      runAction: (id) => fire("runAction", [id]),
      api,
    };
  }, [snapshot, mod, myPcId, fire, talking, device]);
}
