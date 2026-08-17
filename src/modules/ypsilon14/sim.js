/* ============================================================
   YPSILON 14 — THE BASE, THINKING

   Everything in here runs on `onTick`, which the engine calls
   every time the clock moves. Two simulations share it:

   THE THING has four drives, checked in priority order:
     mend   — wounded, and the pod is the only place that fixes it
     feed   — hunger climbs about a point per ten minutes
     dry    — it will not cross standing water unless desperate
     quiet  — noise is how it sees; noise is bait and blindness

   THE CREW have somewhere to be and someone they care about.
   They work their post, drift to their haunt, and when they get
   frightened they stop being alone — which is the whole game,
   because a base where nobody is alone is a base where the thing
   comes looking for the players instead.

   No line in this file is random for its own sake. Every roll is
   the thing or a person choosing between things they want.
   ============================================================ */

/* Where you can get to from where, as the thing travels. */
const ADJ = {
  db2: ["work"],
  work: ["db2", "quarters", "vents", "entrance", "db1"],
  quarters: ["work", "mess", "wash", "vents"],
  mess: ["quarters", "vents"],
  wash: ["quarters", "vents"],
  vents: ["work", "quarters", "mess", "wash"],
  entrance: ["work", "tunnel", "ante"],
  tunnel: ["entrance", "depths", "ante"],
  depths: ["tunnel"],
  ante: ["tunnel", "entrance"],
  db1: ["work"],
};

const VACUUM = ["entrance", "tunnel", "depths", "ante"];
const CREW_ROOMS = ["work", "quarters", "mess", "wash"];
const STEP = 10;                  // the simulation's heartbeat, in minutes
const SUIT_AIR = 180;             // minutes of suit air in a tank, worked hard

/* ---------------- small helpers ---------------- */
/** The engine's seeded stream, so a saved session replays identically. */
const R = (api) => (typeof api.rng === "function" ? api.rng() : Math.random());

const F = (api, k, d = 0) => {
  const v = api.world().flags[k];
  return v === undefined ? d : v;
};
const setF = (api, k, v) => api.flag(k, v);
const bump = (api, k, n, lo = -999, hi = 999) =>
  setF(api, k, Math.max(lo, Math.min(hi, F(api, k, 0) + n)));

/** Everyone alive and present, by room. */
function npcsAt(api, room) {
  const w = api.world();
  return Object.keys(w.npcs).filter(
    (id) => w.npcs[id].alive && !w.npcs[id].taken && w.npcs[id].loc === room && id !== "prince"
  );
}
function crewRoom(api) { return api.world().room; }
function livingCrew(api) {
  const w = api.world();
  return Object.keys(w.npcs).filter(
    (id) => w.npcs[id].alive && !w.npcs[id].taken && !api.mod.npcs[id].static && id !== "prince"
  );
}

/** Breadth-first: the next room to step into, heading for `goal`. */
function stepToward(from, goal, blocked = []) {
  if (from === goal) return from;
  const seen = new Set([from]);
  let edge = (ADJ[from] || []).filter((r) => !blocked.includes(r)).map((r) => [r, r]);
  edge.forEach(([r]) => seen.add(r));
  let guard = 0;
  while (edge.length && guard++ < 40) {
    const next = [];
    for (const [room, first] of edge) {
      if (room === goal) return first;
      for (const n of ADJ[room] || []) {
        if (seen.has(n) || blocked.includes(n)) continue;
        seen.add(n);
        next.push([n, first]);
      }
    }
    edge = next;
  }
  return null;
}

/** Rooms the thing will not enter unless it has stopped caring. */
function wetRooms(api) {
  const w = api.world();
  const wet = [];
  if (w.flags.showers) wet.push("wash");
  for (const r of Object.keys(ADJ)) if ((w.flags[`wet:${r}`] || 0) > w.clock) wet.push(r);
  return [...new Set(wet)];
}

/* ============================================================
   THE THING
   ============================================================ */

function thinkMonster(api) {
  const w = api.world();
  const it = w.threats.it;
  if (it.dead) return;

  const clock = w.clock;
  const desperate = !!w.flags.pod_dead;
  bump(api, "it_hunger", desperate ? 2 : 1, 0, 40);

  /* --- mend: a wounded thing goes home, and nothing else matters --- */
  if (it.dmg > 0 || it.retreatUntil >= clock) {
    if (it.loc !== "ante") {
      const next = stepToward(it.loc || "vents", "ante", []);
      if (next) api.setThreat("it", { loc: next });
      return;
    }
    if (desperate) {
      // The pod is dead. It waits in an empty room for a mend that is
      // not coming, and it gets hungrier, and then it stops waiting.
      if (it.retreatUntil < clock) api.setThreat("it", { retreat: 0 });
      return;
    }
    api.setThreat("it", { heal: 10 });
    if (api.world().threats.it.dmg <= 0) api.setThreat("it", { retreat: 0 });
    return;
  }

  /* --- bait: a tape playing in an empty room is a person, to it --- */
  const decoy = w.flags.decoy_room;
  if (decoy && (w.flags.decoy_until || 0) > clock && it.loc !== decoy) {
    const next = stepToward(it.loc || "vents", decoy, []);
    if (next) { api.setThreat("it", { loc: next }); return; }
  }

  /* --- feed --- */
  const hunger = F(api, "it_hunger", 0);
  const blocked = desperate ? [] : [...wetRooms(api), "db1"];
  const here = it.loc || "vents";

  if (hunger >= 6) {
    const prey = choosePrey(api, blocked, desperate);
    if (prey && prey !== here) {
      const next = stepToward(here, prey, blocked);
      if (next) { api.setThreat("it", { loc: next }); }
    }
    tryToTake(api);
    return;
  }

  /* --- patrol: it prefers the ducting and it prefers to be near people --- */
  const options = (ADJ[here] || []).filter((r) => !blocked.includes(r));
  if (!options.length) return;
  const scored = options.map((r) => {
    let s = 1;
    if (r === "vents") s += 3;
    if (CREW_ROOMS.includes(r)) s += npcsAt(api, r).length;
    if (r === crewRoom(api)) s += 1;
    if (VACUUM.includes(r)) s -= 2;
    return [r, Math.max(0.2, s)];
  });
  const total = scored.reduce((a, [, s]) => a + s, 0);
  let pick = R(api) * total;
  for (const [r, s] of scored) { pick -= s; if (pick <= 0) { api.setThreat("it", { loc: r }); break; } }
}

/** The loneliest warm thing on the base. */
function choosePrey(api, blocked, desperate) {
  const rooms = Object.keys(ADJ).filter((r) => !blocked.includes(r));
  let best = null, bestScore = -1;
  for (const r of rooms) {
    const n = npcsAt(api, r).length;
    const pcs = crewRoom(api) === r ? 1 : 0;
    if (!n && !pcs) continue;
    let score = 0;
    if (n === 1 && !pcs) score = 10;            // alone: ideal
    else if (n === 2 && !pcs) score = 4;        // a pair: workable
    else if (pcs && !n) score = 6;              // the visitors, by themselves
    else if (n >= 3) score = desperate ? 3 : 0; // a crowd: not worth it
    else score = 2;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore > 0 ? best : null;
}

/** If it is standing in a room with something it can eat, it eats. */
function tryToTake(api) {
  const w = api.world();
  const it = w.threats.it;
  const room = it.loc;
  if (!room || it.dead) return;

  const here = npcsAt(api, room);
  const players = crewRoom(api) === room;
  const hunger = F(api, "it_hunger", 0);
  const desperate = !!w.flags.pod_dead;

  /* Nobody but the players. It has been waiting for this. */
  if (players && !here.length) {
    if (hunger >= 8 || desperate) {
      api.say("horror", "The dust on the floor moves in a long, wide sweep, from the doorway towards you, and does not stop.");
      api.startCombat("it", { surprise: true });
    }
    return;
  }

  /* Somebody alone, and nobody watching. This is how the other nine went. */
  if (!players && here.length === 1 && hunger >= 6) return takeThem(api, here[0], room, false);

  /* Somebody alone with the players standing right there. It is quick,
     and it is quiet, and it leaves before anyone finishes turning round. */
  if (players && here.length && hunger >= 9) return takeThem(api, here[0], room, true);

  /* A pair, and it is starving. */
  if (!players && here.length === 2 && (hunger >= 12 || desperate)) return takeThem(api, here[0], room, false);
}

function takeThem(api, id, room, witnessed) {
  api.vanish({
    id,
    text: "A radio call goes unanswered somewhere on the base. {name} is not where {name} should be. No blood. No body. No airlock log.",
    witnessText:
      "{name} is speaking, and then {name} is not. There is a sound like a bath emptying, very fast, and a smell of " +
      "hot copper, and a wet drag across the deck plate towards the ducting. Where {name} was standing there is nothing " +
      "at all — no mark, no blood, not even the tools they were holding.",
    stress: 1, witnessStress: 2,
  });
  setF(api, "it_hunger", 0);
  api.setThreat("it", { loc: witnessed ? "vents" : room, retreat: witnessed ? 40 : 20 });
}

/* ============================================================
   THE CREW
   ============================================================ */

function thinkCrew(api) {
  const w = api.world();
  const fear = F(api, "crew_fear", 0);
  const mustered = !!w.flags.muster;

  for (const id of livingCrew(api)) {
    const def = api.mod.npcs[id];
    const st = w.npcs[id];
    if (!st.loc) continue;

    /* A muster is an order, and these are people who follow orders. */
    if (mustered) {
      if (st.loc !== "mess") {
        const next = stepToward(st.loc, "mess", []);
        if (next) api.setNpc(id, { loc: next });
      }
      continue;
    }

    if (R(api) > 0.35) continue;

    /* Frightened people stop being alone. This is the mechanism the
       players can see working, and the one they can break. */
    if (fear >= 2 && npcsAt(api, st.loc).length === 1) {
      const target = pickCompany(api, id);
      if (target) {
        const next = stepToward(st.loc, target, []);
        if (next) { api.setNpc(id, { loc: next }); continue; }
      }
    }

    const want = wantsToBe(api, id, def, fear);
    if (want && want !== st.loc) {
      const next = stepToward(st.loc, want, []);
      if (next) api.setNpc(id, { loc: next });
    }
  }
}

function pickCompany(api, id) {
  const w = api.world();
  const def = api.mod.npcs[id];
  if (def.bond && w.npcs[def.bond] && w.npcs[def.bond].alive && !w.npcs[def.bond].taken && w.npcs[def.bond].loc)
    return w.npcs[def.bond].loc;
  const rooms = CREW_ROOMS.map((r) => [r, npcsAt(api, r).length]).filter(([r, n]) => n > 0 && r !== w.npcs[id].loc);
  rooms.sort((a, b) => b[1] - a[1]);
  return rooms.length ? rooms[0][0] : null;
}

function wantsToBe(api, id, def, fear) {
  const w = api.world();
  const hour = Math.floor((w.clock / 60) % 24);
  if (id === "rie" && fear >= 3) return "vents";
  if (id === "morgan" && fear >= 2) return w.npcs.prince && w.npcs.prince.loc ? w.npcs.prince.loc : def.haunt;
  if (id === "dana" && (!w.npcs.kantaro.alive || w.npcs.kantaro.taken)) return "entrance";
  if (fear >= 3) return "mess";
  return hour >= 8 && hour < 20 ? (def.post || def.haunt) : (def.haunt || def.post);
}

/** Something happened. The base finds out about it. */
function raiseFear(api, n, why) {
  const before = F(api, "crew_fear", 0);
  bump(api, "crew_fear", n, 0, 4);
  const after = F(api, "crew_fear", 0);
  if (after === before) return;

  const w = api.world();
  const sonya = w.npcs.sonya.alive && !w.npcs.sonya.taken;

  if (after >= 3 && !w.flags.muster) {
    if (sonya) {
      api.flag("muster", true);
      api.say("npc", "SONYA, over every speaker in the base: \"All hands to the mess. Now. Nobody works alone, nobody goes below, nobody argues. Move.\"", { npc: "sonya" });
      api.say("system", "The crew are gathering in the Mess [4]. Together, they are hard to pick off. That is going to be a problem for somebody.");
    } else {
      api.say("horror", "There is shouting somewhere down the corridor, and it is not organised shouting. Nobody is in charge of these people now.");
    }
  }
  if (after >= 4 && !w.flags.evac_demand) {
    api.flag("evac_demand", true);
    api.say("npc", "ROSA: \"We are done. Ten of us, your ship, right now. You can explain the manifest to the Company from orbit.\"", { npc: "rosa" });
  }
  if (why && after > before) api.say("system", `The crew are frightened — ${why}.`);
}

/* ============================================================
   KANTARO
   The module's clock, made of a person.
   ============================================================ */
function tickKantaro(api) {
  const w = api.world();
  const k = w.npcs.kantaro;
  if (!k.alive || k.taken) return;
  const stage = F(api, "kantaro_stage", 0);
  const clock = w.clock;

  if (!F(api, "kantaro_melt_at", 0)) {
    setF(api, "kantaro_melt_at", clock + 120 + Math.floor(R(api) * 20) * 60);
  }
  const meltAt = F(api, "kantaro_melt_at", 0);
  const withPlayers = k.loc === w.room;

  if (stage === 0 && clock > 45 && withPlayers) {
    setF(api, "kantaro_stage", 1);
    api.say("npc", "KANTARO is sweating through his overalls in a room that is fifteen degrees. He has moved his chair twice, and both times it was further from the tap.", { npc: "kantaro" });
    return;
  }
  if (stage <= 1 && clock >= meltAt - 60 && withPlayers) {
    setF(api, "kantaro_stage", 2);
    api.say("horror", "KANTARO picks up a loaded pallet strap one-handed, notices you noticing, and puts it down again badly. His forearm, where there was a month-old cut this morning, is smooth.");
    api.stress(1, "you saw what he did with that arm");
    return;
  }
  if (stage <= 2 && clock >= meltAt) {
    setF(api, "kantaro_stage", 3);
    setF(api, "kantaro_melt_end", clock + 90);
    const where = k.loc;
    if (where === w.room) {
      api.say("horror",
        "KANTARO says he doesn't feel — and stops. He looks at his hand. His hand is running. It comes off the bone in a slow yellow sheet and goes on coming, and he is still trying to finish the sentence.");
      api.stress(2, "he was standing right there");
      api.rollNow({ kind: "save", name: "sanity", why: "he was still trying to finish the sentence" });
    } else {
      api.say("horror", "Someone is screaming in another compartment. It goes on for much longer than a scream should, and it changes texture halfway through.");
      api.stress(1, "whatever that was");
    }
    api.flag("kantaro_melting", true);
    raiseFear(api, 2, "one of their own came apart in front of them");
    return;
  }
  if (stage === 3 && clock >= F(api, "kantaro_melt_end", 0)) {
    setF(api, "kantaro_stage", 4);
    api.setNpc("kantaro", { alive: false, loc: null });
    api.flag("kantaro_dead", true);
    api.say("horror", "What is left of Kantaro finds the drain, and goes into it, and is briefly the only thing moving in the room.");
    if (w.npcs.dana.alive && !w.npcs.dana.taken) {
      api.npcSay("dana", "\"He was on shift. He was on shift with me nine days ago and I let him — \" She does not finish it, and she does not stay in the room.", "npc");
      api.setNpc("dana", { loc: "work", mood: 4 });
    }
  }
}

/* ============================================================
   TUTORIAL BEATS
   Fired once each, when the thing they teach actually happens.
   ============================================================ */
const TEACH = [
  ["move", (api) => Object.keys(api.world().visited).length >= 2,
    "TIME is the resource here, not hit points. Every move, search and conversation costs minutes, and there are things on this base that only happen when the clock reaches them. Watch the clock in the corner more than you watch your Health."],
  ["search", (api) => Object.keys(api.world().searched).length >= 1,
    "Anything marked THOROUGH takes a proper search and an Intellect Check — but a second attempt always finds it. Failing a roll in Mothership usually costs time, not the answer."],
  ["stress", (api) => api.pc() && api.pc().stress >= 2,
    "STRESS is the real enemy. It never goes down on its own — only rest, drugs and safety shift it — and every failed roll adds more. When you are told to make a Panic Check, you roll 2d10 against your Stress and you want to roll HIGH."],
  ["talk", (api) => Object.values(api.world().npcs).some((n) => n.met),
    "The crew know things and will tell you if you ask about the right subject. They do not know there is a creature. Nothing you learn from them is a lie, but a lot of it is wrong."],
  ["hurt", (api) => api.pc() && api.pc().health < api.pc().maxHealth,
    "Health does not come back by itself. The medbay in the Workspace [2] is worth a stop, and resting is a real action with a real cost in minutes."],
  ["dark", (api) => VACUUM.includes(api.world().room),
    "You are in vacuum on suit air. The suit is +7% Armor and Disadvantage on Speed. If the air runs out down here, nothing else you have learned will matter."],
];

function teach(api) {
  if (api.world().flags.tutorial_off) return;
  for (const [id, when, text] of TEACH) {
    if (api.world().flags[`taught:${id}`]) continue;
    let ok = false;
    try { ok = when(api); } catch { ok = false; }
    if (!ok) continue;
    api.flag(`taught:${id}`, true);
    api.say("warden", `▌ ${text}`);
    return;                        // one lesson at a time
  }
}

/* ============================================================
   TELLS — how you know without seeing
   ============================================================ */
const NEAR_TELLS = [
  "Something moves in the ducting on the far side of the bulkhead, unhurried, and stops when you stop.",
  "There is a smell of hot copper and standing water that was not here a minute ago.",
  "A vaccsuit hook swings on the wall. Nothing is touching it.",
  "The dust on the deck plate has been swept into one long, wide track that goes under a door nobody uses.",
  "Your own breathing comes back to you off a surface that should not be that close.",
];

function tells(api) {
  const w = api.world();
  const it = w.threats.it;
  if (it.dead || !it.loc) return;
  const room = w.room;

  if (it.loc === room) {
    if ((w.flags.tell_at || 0) > w.clock) return;
    api.flag("tell_at", w.clock + 20);
    if (api.pc() && api.pc().items.includes("irgoggles") && w.flags.wearing_ir) {
      api.say("horror", "Through the goggles: a fuzzy, not-quite-humanoid shape, two metres away, colder than the wall behind it. It has been in here as long as you have.");
      api.stress(1, "it is right there");
    } else {
      api.say("horror", NEAR_TELLS[Math.floor(R(api) * NEAR_TELLS.length)]);
    }
    return;
  }

  if ((ADJ[room] || []).includes(it.loc) && R(api) < 0.3) {
    if ((w.flags.tell_at || 0) > w.clock) return;
    api.flag("tell_at", w.clock + 30);
    api.say("warden", NEAR_TELLS[Math.floor(R(api) * NEAR_TELLS.length)]);
  }
}

/** The cat is a better instrument than anything in the toolkit. */
function princeReacts(api, room) {
  const w = api.world();
  const p = w.npcs.prince;
  if (!p.alive || !w.flags.prince_follows) return;
  const it = w.threats.it;

  if (!it.dead && it.loc === room) {
    api.say("horror", "Prince stops dead in the doorway, flattens, and will not come in. He is looking at a point in the middle of the room at about chest height, and he is not blinking.");
    api.setNpc("prince", { loc: w.npcs.prince.loc });
    api.stress(1, "the cat will not come in");
    return;
  }
  api.setNpc("prince", { loc: room });
  if (!it.dead && (ADJ[room] || []).includes(it.loc)) {
    api.say("warden", "Prince has stopped walking and is watching one particular wall with his ears flat.");
  }
}

/* ---------------- suit air ---------------- */
function tickAir(api, mins) {
  const w = api.world();
  const inVacuum = VACUUM.includes(w.room);
  if (!inVacuum) {
    if (F(api, "air_used", 0) > 0 && !VACUUM.includes(w.room)) setF(api, "air_used", 0);
    return;
  }
  const used = F(api, "air_used", 0) + mins;
  setF(api, "air_used", used);
  const left = SUIT_AIR - used;
  if (left <= 0) {
    api.say("horror", "The suit tone goes flat. There is nothing coming through the regulator but the taste of your own breath.");
    api.hurt("2d10", "no air");
    setF(api, "air_used", SUIT_AIR - 5);
    return;
  }
  for (const mark of [90, 45, 20, 10]) {
    if (left <= mark && !w.flags[`air:${mark}`]) {
      api.flag(`air:${mark}`, true);
      api.say(mark <= 20 ? "alarm" : "system", `SUIT · ${mark} minutes of air remaining. The elevator back up takes ten of them.`);
      if (mark <= 20) api.stress(1, "the suit is counting down");
      break;
    }
  }
}

/* ============================================================
   THE HOOKS THE ENGINE CALLS
   ============================================================ */
export const simHooks = {
  onTick(api, { mins, clock }) {
    if (api.ended()) return;
    tickAir(api, mins);
    teach(api);

    const acc = F(api, "sim_acc", 0) + mins;
    const steps = Math.floor(acc / STEP);
    setF(api, "sim_acc", acc - steps * STEP);
    for (let i = 0; i < Math.min(steps, 6); i++) {
      if (api.ended()) return;
      tickKantaro(api);
      thinkMonster(api);
      thinkCrew(api);
    }
    if (steps > 0) tells(api);

    // The decoy runs out of tape eventually.
    if (api.world().flags.decoy_room && (api.world().flags.decoy_until || 0) <= clock) {
      api.flag("decoy_room", null);
    }
  },

  onEnterRoom(api, { room }) {
    princeReacts(api, room);
    const w = api.world();
    const it = w.threats.it;
    if (!it.dead && it.loc === room && w.flags.showers && room === "wash") {
      // It would not have stayed. Move it before the ambush check sees it.
      api.setThreat("it", { loc: "vents" });
      api.say("good", "The pipes bang. Something leaves this room very fast, through the ceiling, and does not come back.");
      api.flag("knows_water", true);
    }
  },

  onVanish(api, { id, name, witnessed }) {
    const w = api.world();
    raiseFear(api, witnessed ? 2 : 1, witnessed ? "they watched it happen" : `${name} is not answering`);
    if (id === "sonya") {
      api.flag("muster", false);
      raiseFear(api, 1, "the only person holding this together is gone");
    }
    const here = npcsAt(api, w.room);
    if (here.length && witnessed) {
      const who = here[0];
      api.npcSay(who, "\"Where — no. No, they were right — they were RIGHT THERE.\"");
    }
  },

  onUnconscious(api) {
    api.advance(60);
    api.say("system", "You come round on the deck with a headache and an hour missing.");
    api.vanish({ text: "{name} was calling your name a while ago, and has stopped." });
  },
};

export { raiseFear, npcsAt, livingCrew, ADJ, VACUUM, CREW_ROOMS, stepToward, F, setF, bump };
