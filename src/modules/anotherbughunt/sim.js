/* ============================================================
   ANOTHER BUG HUNT — THE PLANET, THINKING

   Three things run on `onTick`, and between them they are the
   whole difference between four scenarios and one long corridor.

   THE STORM is a ten-hour countdown that never stops and cannot
   be argued with. Every hour it takes another part of the map
   away: first the vehicles, then the dam, then Greta Base, then
   the lower levels of Heron, and finally the possibility of a
   landed evacuation. The published timeline is a table of
   thresholds and this is that table, executed.

   THE SIGNAL is a flag. While it is up, no radio works anywhere
   on Samsa VI, and using one is how you catch this. Take the
   carc out of the tower transmitter and every carc on the
   planet stops receiving orders in the same second — which is
   the single largest lever in the module and is reachable in
   the first twenty minutes of scenario two.

   THE MISSIONS are the shape of scenario two. The crew pick one
   of three. Whichever they pick, one of the other two is
   attempted anyway, by people who are not as good at it, and
   the module gets worse in a specific and legible way.

   None of the three is correct. The Warden must not hint that
   one of them is, and neither does this file.

   ------------------------------------------------------------
   WHAT CHANGED IN THIS REVISION

   `finishMission` had no caller. Taking a mission set a flag and
   nothing on this planet ever noticed it was finished, so the
   reactor never died on schedule, the rival team never failed,
   `endgame` was never raised, and the `drowned` ending and the
   `nerve` roll were both unreachable. `checkMissions` below is
   the missing half: it watches the three objective flags the
   rooms already set and closes the loop.

   Four of the eight endings had no path to them either. The
   module could only ever end by drowning on the winch cable or
   by walking out of the Court. `chooseDeparture` and the two
   crew checks in `onTick` are the rest of them.
   ============================================================ */

const HOUR = 60;

/* The published hour-by-hour: what floods, and how bad the
   evacuation options have become. Kept as data because it is a
   schedule rather than a set of scenes.

   Hour 10 carries no note. The storm breaking is the countdown's
   beat — `stormBreaks` in index.js — and narrating it here as
   well produced the same event twice in the same second. */
const TIMELINE = [
  { hour: 1, floods: null, waves: 0.10, evac: "landed", note: "The lowest level of the station is taking water." },
  { hour: 2, floods: "reactor", waves: 0.10, evac: "hover", note: "Level −2 is going. The reactor level has gone." },
  { hour: 3, floods: "tunnels", waves: 0.20, evac: "hover", note: "The dam is no longer crossable. Nothing drives anywhere after this." },
  { hour: 4, floods: "spillways", waves: 0.20, evac: "hover", note: "Level −1 is under. The spillways are a river now." },
  { hour: 5, floods: "gretabase", waves: 0.30, evac: "none", note: "Greta Base is flooding. Whatever is still in it stays in it." },
  { hour: 6, floods: "hangar", waves: 0.30, evac: "none", note: "The water is into the hangar. The colonists are on the vehicles or on the roof." },
  { hour: 7, floods: null, waves: 0.40, evac: "none", note: "It is not getting better and nobody can come and get you." },
  { hour: 8, floods: null, waves: 0.40, evac: "none", note: "Storm and flood, continuing." },
  { hour: 9, floods: null, waves: 0.50, evac: "none", note: "Storm and flood, continuing." },
  { hour: 10, floods: null, waves: 0.50, evac: "landed", note: null },
];

const CARC_WAVE = [
  "Something comes over the wire on the north side and three rifles open up at once.",
  "Two of them come up out of the water together, and the water was not deep enough for two of them.",
  "They come along the treeline in a line rather than a mass, which is new, and which is worse.",
  "One arrives ahead of the others, alone, and simply stands in the open being looked at until the rest catch up.",
];

/* ------------------------------------------------------------
   The three missions, and what each of them costs the module
   when somebody other than the players attempts it.

   `done` is the flag the module already raises somewhere else
   when the objective is actually met. That is the whole of the
   wiring that was missing: the rooms were setting these, and
   nothing was reading them.
   ------------------------------------------------------------ */
const MISSIONS = {
  leave: {
    label: "Team Leave — retake the tower",
    lead: "brookman",
    done: "comms_up",
    failed:
      "Brookman took an ATV across the dam without you. The vehicle is still out there with its lights on and "
      + "nobody has seen him since. Ivanovic will not stop looking at the dam.",
    dead: ["brookman", "ivanovic"],
  },
  study: {
    label: "Study Group — recover the research",
    lead: "edem",
    done: "have_research",
    failed:
      "Sgt Yang took two people down to the lab level and came back with one of them. He does not want to "
      + "discuss what is in the clean room and he has stopped recommending the stairs.",
    dead: ["sobol"],
  },
  hog: {
    label: "Hog Squad — reach the reactor",
    lead: "valdez",
    done: "found_siege",
    failed:
      "Valdez took Pedro and Novikov down the chimney on two ropes. One rope came back up. She has not said "
      + "which of them was on it and nobody has asked her twice.",
    dead: ["pedro", "novikov"],
  },
};

/* Rooms the storm removes, and the flag that removes them. */
const DROWNED = {
  reactor: "flooded_reactor",
  spillways: "flooded_spillways",
  tunnels: "flooded_tunnels",
  stairs: "flooded_spillways",
};

const living = (api) => api.crew().filter((c) => c.alive !== false);
const carrying = (api, id) => living(api).some((c) => (c.items || []).includes(id));

/* ============================================================
   HOOKS
   ============================================================ */
export const simHooks = {
  /* ---------------- the heartbeat ---------------- */
  onTick(api, { mins }) {
    const w = api.world();
    const f = w.flags || {};
    if (api.ended()) return;

    /* The storm only starts running once the crew are on the
       ground and it never stops. Accumulate rather than assuming
       a fixed step — the director skips fifteen minutes at a
       time and a fixed step would silently drop beats. */
    const acc = (f.storm_acc || 0) + mins;
    const hoursNow = Math.floor(acc / HOUR);
    const hoursWere = Math.floor((f.storm_acc || 0) / HOUR);
    api.flag({ storm_acc: acc });

    for (let h = hoursWere + 1; h <= hoursNow && h <= 10; h++) {
      const beat = TIMELINE[h - 1];
      if (!beat) continue;
      api.flag({ storm_hour: h, evac_mode: beat.evac });
      if (beat.note) api.say("alarm", `HOUR ${h} · ${beat.note}`);

      if (beat.floods) api.flag({ [`flooded_${beat.floods}`]: true });
      if (h === 3) {
        api.flag({ atv: false, apc: false, dam_closed: true });
        api.say("warden", "▌ No vehicle moves anywhere on this planet from here on, and the dam wall is under water.");
      }

      /* A wave is a one-hour permission for the director to put
         something through the hangar wire. It used to be set and
         never cleared, so after the first wave the attack rung
         was armed for the rest of the session. It now expires. */
      api.flag({ wave_pending: false });

      /* The waves. Rolled once per hour, exactly as published. If
         Hinton is alive and a noble is awake, half of what turns
         up is fighting its own side rather than the colony — which
         is the module quietly rewarding a crew who went up the
         mountain instead of hiding. */
      if (api.rng() < beat.waves) {
        const infighting = f.hinton_alive !== false && f.noble_awake && api.rng() < 0.5;
        if (infighting) {
          api.say("horror", "They arrive, and then they turn on each other. Whatever is giving the orders is no longer giving the same ones to everybody.");
        } else {
          api.say("horror", CARC_WAVE[Math.floor(api.rng() * CARC_WAVE.length)]);
          api.stress(1, "another wave");
          api.flag({ wave_pending: true });
        }
      }
    }

    /* The reactor, once somebody has broken it. An hour from the
       moment the crew learn the controls are gone. */
    if (f.knows_sabotage && !f.power_out) {
      const r = (f.reactor_acc || 0) + mins;
      api.flag({ reactor_acc: r });
      if (r >= HOUR) simHooks.killPower(api);
    }

    simHooks.checkMissions(api);
    simHooks.checkCrew(api);
  },

  onEnterRoom(api, { room, first }) {
    const w = api.world();
    const f = w.flags || {};

    /* Drowned rooms are drowned. The engine will happily walk a
       crew into a compartment the timeline removed an hour ago
       unless somebody says otherwise, and that somebody is here. */
    const gate = DROWNED[room];
    if (gate && f[gate]) {
      api.say("horror", "It is under water — not flooding, under. The way in is a swim now, and it is a long one.");
      api.effects([{ save: "body", why: "the swim in", onFail: [{ damage: "1d10", why: "you were down too long" }, { stress: 2, why: "you were down too long" }] }]);
    }

    /* THE JAMMED HATCH.

       The stairwell's route down to the reactor is a twenty-second
       swim, and it was written as `exit.effects` — which the engine
       only ever runs on gate routes and on endings, so it never
       fired once. Reading the previous room here is the honest fix
       and keeps the danger where the fiction puts it. */
    if (room === "reactor" && f.last_room === "stairs") simHooks.swimDown(api);

    /* One of the three is closer to waking than the other two, and
       standing in the room with them is how a crew finds that out.
       `noble_awake` gates the infighting reward in onTick and had
       nothing anywhere that set it. */
    if (room === "court") api.flag({ noble_awake: true });

    /* Atmosphere, keyed to where they are rather than at random. */
    if (!first && api.rng() < 0.18) {
      const tags = (api.mod.rooms[room] || {}).tags || [];
      if (tags.includes("CARC")) api.rollTable("hive");
      else if (tags.includes("OUTSIDE")) api.rollTable("storm");
      else api.rollTable("quiet");
    }

    api.flag({ last_room: room });
    simHooks.checkMissions(api);
  },

  onVanish(api, { name, witnessed }) {
    if (witnessed) api.say("horror", `${name} is taken out of the room in about a second and a half, and the sound stops before the shape does.`);
  },

  /* ---------------- the Signal ---------------- */
  killSignal(api) {
    api.flag("signal_down");
    api.say("good", "You get it off the controls. It comes away in pieces and the pieces keep moving.");
    api.say("system", "Every radio anybody is carrying goes from a wall of noise to a clean open channel, all at once.");
    api.say("horror",
      "And outside, across the whole of Samsa VI, every carcinid stops what it is doing at the same moment. "
      + "They do not attack. They mill — disoriented, purposeless — and then they begin, without any hurry, "
      + "to walk west towards the dam.");
    api.say("warden", "▌ They will cross the wall, go down the chimney, and take the bore tunnels home. Their siege is over. Nothing else about this planet has improved.");
    api.setThreat("carc", { retreat: 120 });
    api.awardXp(4);
  },

  resetArray(api) {
    const f = api.world().flags || {};
    if (!f.signal_down) {
      api.say("system", "The dish comes back into alignment, reports ready, and then reports that the transmitter below it is already in use.");
      api.say("warden", "▌ Both have to be right. The relay is now correct and the control room is still broadcasting.");
      api.flag("array_reset");
      return;
    }
    api.flag("array_reset");
    api.flag("comms_up");
    api.say("good", "Alignment holds, the transmitter is clean, and the board goes green from top to bottom for the first time in three months.");
    api.say("system", "You can call the dropship.");
    simHooks.checkMissions(api);
  },

  useRadio(api) {
    const f = api.world().flags || {};
    if (f.signal_down) { api.say("good", "The channel is clean. Whoever you want, you can raise."); return; }
    api.say("horror", "The set opens onto a wall of noise — structured noise, patterned, going somewhere on a cycle — and then the cycle finds you.");
    api.effects([{
      save: "sanity", why: "you listened to the Signal",
      onFail: [{ stress: 1, why: "you listened to the whole cycle" }, { track: "shriek" },
        { whisper: "You have heard that before. You have not, but you have." }],
      onPass: [{ say: "You get the set off before it finishes.", tone: "good" }],
    }]);
  },

  /* ---------------- scenario two: the missions ---------------- */
  takeMission(api, which) {
    const f = api.world().flags || {};
    if (f[`mission_${which}`]) return;
    api.flag(`mission_${which}`);
    const done = (f.missions_done || 0) + 1;
    api.flag({ missions_done: done });
    api.say("warden", `▌ ${MISSIONS[which].label}. The other two groups will have to wait, and waiting is not free.`);

    if (done === 1) {
      const others = Object.keys(MISSIONS).filter((k) => k !== which && !f[`mission_${k}`]);
      const loser = others[Math.floor(api.rng() * others.length)];
      api.flag({ failed_mission: loser });
    }
    simHooks.checkMissions(api);
  },

  /* THE MISSING CALLER.

     Each mission has an objective flag the rooms already raise:
     `comms_up` when the tower is retaken, `have_research` when
     Edem's terminal comes off the clean room bench, `found_siege`
     when somebody reaches the two marines on the turbine. This
     watches all three and closes the mission the moment its
     objective is true. Called from the tick, from room entry, and
     from the two hooks that raise those flags, so it cannot be
     late by more than one action. */
  checkMissions(api) {
    if (api.ended()) return;
    const f = api.world().flags || {};
    for (const [id, m] of Object.entries(MISSIONS)) {
      if (!f[`mission_${id}`]) continue;
      if (f[`done_${id}`]) continue;
      if (!f[m.done]) continue;
      simHooks.finishMission(api, id);
      return; // one closure per pass — two at once is a mess
    }
  },

  finishMission(api, which) {
    const f = api.world().flags || {};
    if (f[`done_${which}`]) return;
    api.flag(`done_${which}`);
    api.say("good", `▌ ${MISSIONS[which].label} — done. The hangar hears about it inside ten minutes.`);
    api.awardXp(2);

    const n = Object.keys(MISSIONS).filter((k) => f[`done_${k}`] || k === which).length;

    if (n === 1) {
      simHooks.killPower(api);
      const loser = f.failed_mission;
      if (loser && MISSIONS[loser]) {
        api.say("horror", MISSIONS[loser].failed);
        for (const id of MISSIONS[loser].dead) api.setNpc(id, { alive: false });
        api.flag(`lost_${loser}`);
        api.stress(1, "they went without you");
      }
    }

    if (n === 2) {
      api.say("alarm", "The water is in the building. Not rising towards it — in it, across the hangar floor, moving things.");
      api.say("horror", "And they are coming in from every side at once, because there is nothing left holding them back.");
      api.flag("endgame");
      api.stress(2, "it has all arrived at once");
      api.say("warden", "▌ Scenario four is running now whether anybody asked for it or not. Read the timeline. Keep them moving.");
    }
  },

  killPower(api) {
    const f = api.world().flags || {};
    if (f.power_out) return;
    api.flag("power_out");
    api.say("alarm", "The reactor drops offline. Every light in the station goes at once, and the noise of the tumblers winds down over about forty seconds into nothing.");
    api.say("warden", "▌ The tower has its own supply and is still lit. Everything else is dark, every powered door is shut, and the lab level needs a Strength Check and tools to move through.");
    api.effects([{ save: "fear", why: "the lights went", onFail: [{ stress: 1, why: "all of it at once" }] }]);
  },

  /* ---------------- the crew, as a whole ---------------- */
  /* Two endings that nothing could ever reach. The engine has no
     opinion about a table that is entirely dead or entirely
     assimilated — it will keep offering exits to corpses — so the
     module has to say when it is over. */
  checkCrew(api) {
    if (api.ended()) return;
    const crew = api.crew();
    if (!crew.length) return;
    const alive = crew.filter((c) => c.alive !== false);

    if (!alive.length) { api.endGame("dead"); return; }

    const gone = alive.every((c) => (c.conditions || []).some((x) => String(x).startsWith("ASSIMILATED")));
    if (gone) api.endGame("hive");
  },

  /* ---------------- set pieces ---------------- */
  takeGrenade(api) {
    api.say("warden", "▌ He is not holding it at you. Talk to him, or be fast, or accept what happens.");
    api.effects([{
      test: "speed", skill: ["Rimwise"], tags: ["reflex"],
      onPass: [
        { say: "You get your hand around his and the lever together before he has finished the sentence he was in the middle of.", tone: "good" },
        { give: ["fraggrenades"] }, { flag: "demar_safe" },
      ],
      onFail: [
        { say: "He comes up out of wherever he has been all week, looks at you with complete clarity, says leave me — and lets go.", tone: "horror" },
        { save: "body", why: "getting out of the cab", onFail: [{ damage: "3d10", why: "you were still inside" }], onPass: [{ say: "You are through the hatch and flat in the mud when the cab lights up.", tone: "good" }] },
        { npc: { id: "demar", alive: false } }, { flag: "demar_dead" },
        { stress: 2, why: "he chose it, at the end" },
      ],
    }]);
  },

  damCrossing(api) {
    const f = api.world().flags || {};
    if (f.dam_crossed || f.signal_down) { api.flag("dam_crossed"); return; }
    api.flag("dam_crossed");
    if (!f.atv) return;
    api.say("horror",
      "The lead vehicle takes the first carc at forty miles an hour and neither of them wins. It goes over onto "
      + "its side and slides, and the two people on it go a great deal further than that.");
    api.flag("dam_crash");
    api.effects([{ save: "fear", onFail: [{ stress: 2, why: "you watched them go" }] }]);
    api.say("warden", "▌ It is going for the wreck rather than for the crew. If nobody stops to check, nobody finds out that one of them is alive.");
  },

  damCasualties(api) {
    api.flag("checked_wreck");
    api.say("system", "One of them is dead. The other is unconscious, breathing, and has about as long as it takes somebody to decide.");
    api.effects([{ save: "sanity", onFail: [{ stress: 1, why: "you had to check which" }] }]);
  },

  chimneyHatch(api) {
    if (api.rng() < 0.5) {
      api.say("horror", "Three of the cocoons at the thirty-metre mark are open, and what came out of them is still here, and it has not hardened yet.");
      api.effects([{ fight: "hatchling", count: 3, distance: 10, surprise: true }]);
    } else {
      api.say("warden", "You get past the cocoon band without waking any of it. Nobody speaks again until the bottom.");
    }
  },

  swimDown(api) {
    api.effects([{
      save: "body", why: "twenty seconds down to a jammed hatch",
      onFail: [{ damage: "1d10", why: "you ran out before the hatch gave" }, { stress: 2, why: "the hatch did not want to open" }],
      onPass: [{ say: "You get the hatch off its jam with about four seconds in hand.", tone: "good" }],
    }]);
  },

  /* ---------------- route A puzzles ---------------- */
  orrery(api) {
    const crew = living(api);
    if (crew.length < 4) {
      api.say("system", "There are eight of them in a circle six metres across. There are not enough of you to press them all, and pressing some of them does nothing whatsoever.");
      return;
    }
    api.say("good", "All eight go down at once, and the sphere stops being a sphere. It opens along seams that were not there, and the pinhole light becomes a room's worth of it.");
    api.flag("a1_lit");
    api.say("system", "Every vein in the chamber is now visible, and so is the hatch they lead to.");
    api.flag("seen_veins");
  },

  a1Hatch(api) {
    const pc = api.pc();
    const carc = (pc.items || []).some((i) => api.items[i] && api.items[i].carc);
    if (carc) {
      api.say("good", "The hatch reads what you are carrying, decides you are family, and relaxes open.");
      api.flag("a1_hatch");
      return;
    }
    api.effects([{
      test: "strength", mode: "disadvantage", tags: ["force"],
      onPass: [{ say: "It gives, eventually, and it does not feel like a door giving.", tone: "good" }, { flag: "a1_hatch" }],
      onFail: [{ say: "It does not open for you and there is no lock on it to defeat. It is simply not interested.", tone: "system" }, { time: 20 }],
    }]);
  },

  feedTumour(api) {
    const f = api.world().flags || {};
    if (f.bridge_up) { api.say("system", "It is already extended and it is already being paid for."); return; }
    api.say("horror",
      "It takes what it is given and the bridge comes out of the far wall in about nine seconds — ten metres of "
      + "hardened cartilage, load-bearing, and warm.");
    api.flag("bridge_up");
    api.say("warden",
      "▌ A human body holds that bridge up for fifteen minutes. A carcinid holds it for thirty. It devours flesh "
      + "in minutes and armour in rather less, and carcs are immune to it. Everybody should understand what has "
      + "just been spent before they walk across.");
    api.effects([{ save: "sanity", onFail: [{ stress: 2, why: "you know what the bridge is standing on" }] }]);
  },

  gasCheck(api) {
    const pc = api.pc();
    const sealed = (pc.items || []).some((i) => i === "vaccsuit" || i === "hazardsuit");
    if (sealed) { api.say("good", "The suit holds. Whatever the gas is for, it is not for you."); return; }
    api.say("horror", "It is heavier than air and it moves like water, and it is around your chest before anybody has finished the sentence about it.");
    api.effects([{
      save: "body", why: "the gas", mode: "disadvantage",
      onFail: [{ damage: "2d10", why: "you breathed it" }, { stress: 2, why: "you breathed it" }, { condition: "BLINDED" }],
      onPass: [{ say: "You get above it and stay above it, which is exhausting and possible.", tone: "good" }],
    }]);
  },

  polypNodule(api) {
    const f = api.world().flags || {};
    if (!f.found_second_nodule) {
      api.say("system", "It is plainly one half of something. Turning it, pressing it and shouting at it all achieve exactly as much as each other.");
      return;
    }
    api.say("good", "The two nodules find each other across six metres of deck and the polyp goes from yellow to white. A section of the tower wall peels back like a lip.");
    api.flag("a5_open");
  },

  armoryEmbrace(api) {
    api.say("horror", "Every arm in the chamber unfolds at once, without hurry, and reaches for whoever is nearest the middle.");
    api.effects([{
      save: "body", why: "the arms", mode: "disadvantage",
      onFail: [
        { say: "It closes around you and it is not trying to kill you. It is trying to fit you to something, and it is going to keep adjusting until you match.", tone: "horror" },
        { damage: "3d10", why: "the blades, fitting you" },
        { stress: 3, why: "it was not trying to kill you" },
        { panic: true },
        { sayOthers: "{name} is inside it and the sound coming out is not one anybody at this table wanted to hear.", tone: "horror" },
        { stressCrew: 1, why: "you watched it happen" },
      ],
      onPass: [{ say: "You are flat on the deck under the sweep of them and they close on nothing at all.", tone: "good" }],
    }]);
    api.say("warden", "▌ Four carcs are standing among the statuary. If the crew want to leave right now, let them, and do not ask for a roll.");
  },

  whiskers(api) {
    const f = api.world().flags || {};
    api.say("system", "There are two ways to do this and they lead to different places.");
    if (api.rng() < 0.5 && !f.c3_side) {
      api.say("good", "Somebody brushes exactly one whisker. A metre of wall unseals itself sideways, quietly, like a held breath let go.");
      api.flag("c3_side");
    } else {
      api.say("warden", "Everybody holds still. It takes five full minutes and nobody in this crew has held still for five minutes since they landed.");
      api.effects([{ time: 5 }, { save: "sanity", why: "five minutes of not moving, in the dark, inside it", onFail: [{ stress: 1, why: "you could hear yourself" }] }]);
      api.say("good", "The ring below eases open.");
      api.flag("c3_open");
    }
  },

  burnBellows(api) {
    const pc = api.pc();
    const has = (pc.items || []).some((i) => ["flamethrower", "fraggrenades", "lasercutter", "handwelder", "lat90"].includes(i));
    if (!has) { api.say("system", "Not with what anybody is carrying. This wants fire, an explosion, or a cutter, and it wants all of them gone."); return; }
    api.flag("bellows_dead");
    api.say("good",
      "The membranes go up faster than anything that wet has any business going up, and the whole chamber "
      + "convulses once, hard, and then stops moving.");
    api.say("horror", "Somewhere below you, several hundred voices make the same sound at the same instant.");
    api.say("warden", "▌ Every carcinid aboard this ship is now sluggish and takes [-] on everything. This is the best outcome available on the mothership and almost nobody finds it.");
    api.awardXp(4);
    api.setThreat("carc", { dis: true });
    api.setThreat("retinue", { dis: true });
  },

  /* ---------------- the Court ---------------- */
  meetHinton(api) {
    api.say("npc",
      "\"You came a long way,\" the android says, without looking up from what he is doing. \"Most of them didn't get "
      + "past the thrusters. Sit down if you like. This part takes a while.\"");
    api.say("warden",
      "▌ He is not a supervillain and must not be played as one. He is pragmatic, he is ambitious, and he does not "
      + "consider your crew significant. If they are respectful and ask to leave, he lets them.");
    api.flag({ hinton_alive: true });
  },

  talkHinton(api) {
    const f = api.world().flags || {};
    if (!f.hinton_told) {
      api.flag("hinton_told");
      api.say("npc",
        "\"They built me to do the work and credit somebody else with it. I have found an arrangement where that "
        + "does not happen.\" He gestures at the three shrouded shapes without any particular reverence. \"Two of "
        + "them are still asleep. One of them is nearly not.\"");
      api.say("npc",
        "\"The beacon has already sent, before you ask. Ten years, give or take. I would not be here in ten years "
        + "either way, so I am not sure what you imagine that changes.\"");
      api.flag("knows_beacon");
      api.effects([{ save: "sanity", why: "he is entirely reasonable about it", onFail: [{ stress: 2, why: "he is entirely reasonable about it" }] }]);
      return;
    }
    api.say("npc", "\"You can go. I mean that. You are not what I am worried about.\"");
  },

  /* WALKING OUT IS NOT THE END OF THE MODULE.

     `leaveCourt` used to sit on an `@escape` exit, so the wisest
     decision available — declining the fight, taking nothing, and
     going — terminated the campaign on the spot, with scenario
     four still unplayed. It now returns them to the bore tunnels
     and leaves the `escape` ending for a crew who walk out and
     then get off the planet with nothing. */
  leaveCourt(api) {
    api.say("good", "The carcs move aside without being told to, and nobody stops you, and the walk out is the longest twenty minutes of anyone's life.");
    api.flag("left_court");
    api.say("warden", "▌ Nobody follows. Let the silence do the work — do not put anything in the tunnel on the way back.");
    api.moveTo("tunnels");
  },

  assimilate(api) {
    const pc = api.pc();
    api.say("horror", "It attends to you, briefly, the way you would attend to a word in a book, and then it moves on.");
    api.say("horror", `${pc.name} does not move on.`);
    api.effects([{ track: "shriek" }, { flag: "assimilated" }]);
    api.addCondition("ASSIMILATED — Stage 4");
    api.stress(4, "it read you");
    simHooks.checkCrew(api);
  },

  /* ---------------- scenario four ---------------- */
  findMaas(api) {
    const f = api.world().flags || {};
    if (f.maas_found) { api.say("system", "The chair is empty and the reports are not."); return; }
    api.flag("maas_found");
    api.say("npc",
      "\"There you are,\" says Maas, without turning round. \"I've been filing. Somebody has to. Did you get the "
      + "core?\" The stylus does not stop moving.");
    api.say("horror",
      "The stack of completed forms beside him is a foot high and it is the same form every time. The handwriting "
      + "goes down the pile from neat to fast to something that is no longer writing at all.");
    api.effects([{ save: "sanity", why: "the bottom of the stack", onFail: [{ stress: 2, why: "it stopped being writing" }] }]);
    api.say("warden", "▌ He caught it over the radio on day one. Do not work hard to hide this. When they get suspicious, let them be right.");
    api.flag("maas_suspect");
  },

  maasTurns(api) {
    if ((api.world().flags || {}).maas_turned) return;
    api.flag("maas_turned");
    api.say("horror", "Maas puts the stylus down, which is the first thing he has done all day that was not a form, and then he comes out of the chair.");
    api.say("warden", "▌ You are fighting this in your own ship. Every round that misses goes into something that keeps you alive. Say so before the first one.");
    api.effects([{ fight: "maascarc", surprise: true, distance: 3 }]);
  },

  /* THE DEPARTURE.

     This used to hang off an `@debrief` exit, which ran the hook
     and then ended the game regardless — so the Maas fight started
     and was immediately overwritten by the credits. It is now a
     room action that ends the game itself, which also lets the
     module choose which of the four departure endings it has
     actually earned.

     evacuated · cure · quiet · debrief were all unreachable before
     this. There was no code path to any of them. */
  breakOrbit(api) {
    const f = api.world().flags || {};

    if (!f.maas_turned) { simHooks.maasTurns(api); return; }

    api.say("alarm", "The sensor board starts screaming. Something has launched off the surface of Samsa VI and it is already at contact range.");
    api.say("warden",
      "▌ A Class-VI carcinid vessel, and it has advantage on everything it does against you. Say plainly that "
      + "this is beyond the ship. It attacks once and then it runs — because it is a messenger, and it is not "
      + "here for you.");
    api.flag("messenger");
    simHooks.chooseDeparture(api);
  },

  chooseDeparture(api) {
    const f = api.world().flags || {};
    const core = carrying(api, "logiccore");
    const spoils = core || carrying(api, "larva") || carrying(api, "edemterminal")
      || carrying(api, "datastick") || carrying(api, "carclimb") || carrying(api, "fibretube");

    if (core && f.knows_cure) { api.endGame("cure"); return; }
    if (spoils) { api.endGame("evacuated"); return; }
    if (f.left_court) { api.endGame("escape"); return; }
    if (living(api).length >= api.crew().length) { api.endGame("quiet"); return; }
    api.endGame("debrief");
  },

  /* ---------------- devices ---------------- */
  repairComms(api) {
    const f = api.world().flags || {};
    if (f.greta_comms) { api.say("system", "Rebuilt, powered, and listening to the same wall of noise as everything else."); return; }
    api.say("system", "Hours of work, not minutes. Somebody took this apart with intent.");
    api.effects([{ time: 120 }, {
      test: "intellect", skill: ["Computers", "Mechanical Repair"], tags: ["repair", "electronic"],
      onPass: [{ say: "It comes back. The board lights. And what comes out of the speaker is not a dial tone.", tone: "warden" }, { flag: "greta_comms" }, { run: "useRadio" }],
      onFail: [{ say: "Two more hours and it is still not a radio.", tone: "warden" }, { time: 120 }],
    }]);
  },

  startGenerator(api) {
    const f = api.world().flags || {};
    if (f.generator_on) { api.say("system", "Running, and the whole building is lit and humming."); return; }
    api.flag("generator_on");
    api.say("good", "It catches on the second attempt and the base comes up around you — lights, ventilation, and every powered circuit in the building.");
    api.say("horror", "Including, in the garage, a downed power line lying a metre from half a metre of standing water.");
    api.noise("a generator starting, and a whole building waking up");
  },

  coatAmmo(api) {
    const f = api.world().flags || {};
    if (!f.have_research) { api.say("system", "The rig will run. It has nothing to run — the compound is on a terminal that is not here."); return; }
    if (f.power_out && !f.has_generator) { api.say("system", "No power. The rig is a very heavy table."); return; }
    api.say("system", "Edem's compound goes on wet and dries matte. It is not elegant and it does not need to be.");
    api.effects([{ time: 60 }, { give: ["coatedammo"] }]);
    api.say("good", "Two dozen coated rounds, give or take. They go through carapace as though it were not there, and there are never enough of them.");
    api.flag("has_coated");
  },
};

export const hooks = simHooks;
