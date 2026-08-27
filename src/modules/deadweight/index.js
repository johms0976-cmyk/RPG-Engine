/* ============================================================
   DEAD WEIGHT — ninety minutes, one sitting, two hulls.

   ------------------------------------------------------------
   WHY THIS EXISTS, WHICH IS NOT "A SECOND MODULE"

   The shelf had one playable module and it declares
   `length: "One session · 3–4 hours"`. That is a fine thing to
   own and it is the wrong thing to own ONLY. A four-hour module
   is a thing a group of friends SCHEDULES; ninety minutes is a
   thing they DO. The difference decides whether the engine gets
   played twice.

   So the constraint came first and everything below was written
   to fit inside it, rather than a scenario being written and then
   trimmed. Concretely:

     · NINE rooms, not twenty-six. A crew of five can see all of
       this once.
     · ONE threat, and it can be seen. See `threats.sleeper`.
     · ONE countdown, running from minute zero, and it is the
       whole clock. There is no second timer to track.
     · THREE endings, all of them reachable in the time, and none
       of them requiring the crew to have found everything.
     · The opening is a cold open. There is no arrival, no
       introductions, no shopping. The first thing that happens
       has already happened.

   ------------------------------------------------------------
   WHY TWO HULLS

   This module exists at a version where the director can finally
   follow a split party (`focusRoom` and `audienceFor`), and it is
   built to exercise that rather than to tolerate it. The tug and
   the derelict are ninety metres apart down an umbilical that
   takes real minutes to crawl. A crew of five WILL split, because
   the burn needs somebody on the tug and the answer is on the
   other ship, and the module is arranged so that being in the
   wrong hull at the wrong minute is the interesting problem
   rather than a punishment.

   That is also why the two hulls each have their own terminal,
   their own light, and their own way of being frightening. Three
   people alone on the Amaranth should not be waiting for the
   other three to finish having the scene.

   ------------------------------------------------------------
   WHAT THE CREW MAY LEARN, AND WHAT THEY MAY NOT

   The rule the whole repository runs on: nothing tells the crew
   something they have not earned. The hopper's manifest, the
   Amaranth's log and Halloran are three independent routes to the
   same fact, and none of them states it. The fact is that the
   cargo is not ore. Every one of those three routes gets a person
   most of the way and stops.
   ============================================================ */
import { defineModule } from "../../engine/defineModule.js";
import { director } from "./director.js";

export default defineModule({
  id: "deadweight",
  title: "DEAD WEIGHT",
  subtitle: "MOTHERSHIP · SCI-FI HORROR RPG",
  byline: "A ninety-minute module for 3–6 players.",
  blurb:
    "You are forty hours into a tow you should not have taken, and the thing on the end of the "
    + "cable has started to move on its own.",
  length: "Ninety minutes · one sitting",
  contentWarning:
    "Confined spaces, suffocation, cold, and a body in a box. No harm to children and no sexual content.",

  /* Written for five. Three works and is tighter; six works and
     the umbilical becomes a queue, which is the correct kind of
     problem for this module to have. */
  crewSize: { min: 3, max: 6, suggested: 5 },

  pitch: [
    "The salvage tug CORVID is towing the ore hopper AMARANTH to a breaker's yard at Tarsis.",
    "Forty hours in, the tow telemetry says the hopper's mass is redistributing. Cargo does not do that.",
    "The burn to Tarsis starts in ninety minutes. After it starts you cannot cut the cable.",
  ],

  theme: { accent: "#C9A227" },

  /* ------------------------------------------------------------
     ATMOSPHERE

     Without this the module drew entirely on the engine's generic
     `any` pool, two lines of which assume a hand torch and a vaccsuit
     — which is wrong on a lit tug bridge with the crew in
     shirtsleeves, and was the most common thing a quiet table heard.
     Module pools are pushed ahead of the engine's, so these are what
     comes up first and the generic six are the long tail.

     One rule for all of it: these describe two ships that are eleven
     days and forty hours into being neglected. None of them says
     anything is wrong. The module says that.
     ------------------------------------------------------------ */
  flavour: {
    any: [
      "The tow load comes through the deck as a note rather than a sound.",
      "Somewhere aft, the drive idles at the pitch it has held since Kepler.",
      "Forty hours of the same recycled air, and you have stopped noticing it.",
      "A panel light cycles amber, amber, amber.",
    ],
    TERMINAL: [
      "The telemetry plate refreshes, four minutes late, and shows the same thing.",
      "A dialogue box has been waiting for an answer since the night shift.",
    ],
    DARK: [
      "Your breath is visible for the first time, and then it is not.",
      "The cold in here is not the temperature. It is the surfaces.",
    ],
    VENT: [
      "The tube flexes under you, takes your weight, and gives it back.",
      "Ninety metres of corrugation carries every sound you make to both ends.",
    ],
  },

  /* ---- gear beyond the standard PSG kit ---- */
  items: {
    cutter: {
      n: "Cable Cutter",
      d: "A shaped charge on a collar clamp. One use, and the tow is somebody else's problem.",
      found: true,
    },
    torch: { n: "Hand Torch", d: "Wide beam, forty minutes of it left.", found: true },
    manifest: {
      n: "Hopper Manifest",
      d: "A printed lading sheet, stamped four times by four different offices.",
      handout: "manifest",
      found: true,
    },
    keycard: {
      n: "Amaranth Master Card",
      d: "Halloran's. It opens the cold hold, which is the only door on that ship that is locked.",
      found: true,
    },
    coolantrod: {
      n: "Coolant Rod",
      d: "Cold enough to burn. The cold hold has a rack of them and is missing three.",
      found: true,
    },
  },

  handouts: {
    manifest: {
      label: "▶ LADING — AMARANTH, HOLD 1",
      /* Fair, and unhelpful, and the most useful thing on the
         ship. It does not say what the cargo is. It says what the
         cargo needed, and a person who thinks about that gets
         there on their own. */
      text:
        "ORE, NICKEL-IRON, UNREFINED — 41 TONNES. Consignor: illegible. Consignee: illegible. "
        + "STOWAGE NOTE: HOLD 1 TO BE MAINTAINED AT OR BELOW MINUS SIXTY CELSIUS FOR THE DURATION "
        + "OF CARRIAGE. HOLD 1 NOT TO BE OPENED IN TRANSIT.",
      effects: [{ flag: "read_manifest" }],
    },
    amaranthlog: {
      label: "▶ AMARANTH — DECK LOG, LAST FOUR ENTRIES",
      text:
        "D+11 Hold 1 holding at minus sixty-two. Nothing to report.\n"
        + "D+14 Refrigeration fault, hold 1. Ran to minus forty for nine hours before we caught it. "
        + "Logged for the yard.\n"
        + "D+14 Kerrigan says he heard the load shift. Told him it is forty-one tonnes and it does not shift.\n"
        + "D+15 ",
      effects: [{ flag: "read_log" }, { stress: 1, why: "the last entry stops mid-date" }],
    },
  },

  start: "bridge",

  /* ------------------------------------------------------------
     THE SHIP, AND THE OTHER SHIP

     Read the `mins` on the exits: everything inside a hull is
     one or two minutes, and the umbilical is EIGHT each way. That
     single number is the module. It is what makes splitting a
     decision rather than a habit, it is what makes the countdown
     bite, and it is why nobody can be in both places when it
     matters.
     ------------------------------------------------------------ */
  rooms: {
    /* ---------------- CORVID, the tug ---------------- */
    bridge: {
      n: 1, name: "CORVID — BRIDGE", tags: ["TERMINAL"],
      look:
        "Two seats, one of them yours. The tow telemetry is up on the centre plate and has been "
        + "amber for nine hours. Through the forward glass the Amaranth hangs where it has hung "
        + "since Kepler Station, ninety metres back and slightly, persistently, off-axis.",
      exits: [
        { to: "galley", label: "Aft → Galley [2]", mins: 1 },
        { to: "enginebay", label: "Down → Engine Bay [3]", mins: 2 },
        { to: "airlock", label: "Aft → Airlock [4]", mins: 2 },
      ],
      features: {
        telemetry: {
          name: "Tow telemetry",
          d:
            "Mass distribution across the hopper, sampled every four minutes. For thirty-nine hours "
            + "it was a flat line. For the last hour it has been a slow wave, moving from the stern "
            + "of hold one toward the bow, and then back.",
          setsFlag: "saw_telemetry",
        },
        cablefeed: {
          name: "Cable camera",
          d:
            "A fisheye at the towing collar. Ninety metres of cable, dead straight, and the "
            + "Amaranth's nose past the end of it. Nothing moves. It is a still photograph that "
            + "happens to be live.",
        },
        burnplot: {
          name: "The burn plot",
          d:
            "Tarsis in eleven days at forty-one tonnes of tow. Nine days at nothing. The number "
            + "the yard pays on is the forty-one.",
          deep: true, setsFlag: "knows_the_money",
        },
      },
    },

    galley: {
      n: 2, name: "CORVID — GALLEY", tags: [],
      look:
        "Four seats bolted round a table with a lip on it. Somebody's cards are still dealt out "
        + "for a game that got interrupted forty hours ago and has not been picked up since.",
      exits: [
        { to: "bridge", label: "Forward → Bridge [1]", mins: 1 },
        { to: "enginebay", label: "Down → Engine Bay [3]", mins: 2 },
      ],
      features: {
        cards: {
          name: "The interrupted game",
          d: "Somebody was going to win. It is not clear who and nobody has wanted to sit down and find out.",
        },
        lockerbay: {
          name: "Gear lockers",
          d: "Torches, a spare suit, and the collar charge in its own yellow box.",
          gives: ["torch", "cutter"],
        },
      },
    },

    enginebay: {
      n: 3, name: "CORVID — ENGINE BAY", tags: ["DARK"],
      look:
        "Hot, loud, and low enough that everybody stoops. The main drive is warm and idle and has "
        + "been counting down to the burn since Kepler.",
      exits: [
        { to: "bridge", label: "Up → Bridge [1]", mins: 2 },
        { to: "galley", label: "Up → Galley [2]", mins: 2 },
      ],
      features: {
        drive: {
          name: "The drive",
          d:
            "Primed, sequenced, and locked to the plot on the bridge. Starting it early is a bridge "
            + "job. Stopping it once it has started is not a job at all.",
        },
        collar: {
          name: "Tow collar mount",
          d:
            "Where the cable comes aboard. The charge in the galley locker clamps here. Cutting is a "
            + "thirty-second job and an irreversible one.",
          deep: true,
        },
      },
    },

    airlock: {
      n: 4, name: "CORVID — AIRLOCK", tags: [],
      look:
        "A three-person lock with the inner door standing open. The umbilical runs out of the outer "
        + "hatch and away into the dark, lit at intervals by its own strip lights, most of which work.",
      exits: [
        { to: "bridge", label: "Forward → Bridge [1]", mins: 2 },
        {
          to: "umbilical",
          label: "Out → The Umbilical [5]",
          mins: 2,
        },
      ],
      features: {
        suits: {
          name: "Suit rack",
          d: "Four suits, three of them yours. The fourth is a size nobody aboard wears.",
          setsFlag: "saw_fourth_suit",
        },
      },
    },

    /* ---------------- the ninety metres between ---------------- */
    umbilical: {
      n: 5, name: "THE UMBILICAL", tags: ["DARK", "VENT"],
      look:
        "A corrugated tube ninety metres long and just wide enough to pass another person if you "
        + "both turn side-on. It flexes. Everything you can hear is either you or the tube.",
      exits: [
        { to: "airlock", label: "Back → Corvid Airlock [4]", mins: 8 },
        { to: "amaranthlock", label: "On → Amaranth Lock [6]", mins: 8 },
      ],
      features: {
        strip: {
          name: "The strip lights",
          d:
            "Two out of every three. The dark stretches are about six metres each and there are four "
            + "of them.",
        },
        cable: {
          name: "The tow cable",
          d:
            "Running parallel to the tube, close enough to touch through the wall. It is under load "
            + "and it hums, and the note of the hum has changed at least once while you have been in here.",
          deep: true, setsFlag: "heard_the_cable",
        },
      },
    },

    /* ---------------- AMARANTH, the hopper ---------------- */
    amaranthlock: {
      n: 6, name: "AMARANTH — LOCK", tags: [],
      look:
        "Cold. The Amaranth has been on standby power for eleven days and everything in here is "
        + "the temperature of the outside. Your breath goes ahead of you.",
      exits: [
        /* Stepping into the tube, not crawling its length — the crawl
           is the eight minutes on the umbilical's own exits. This was
           eight as well, which made the trip home sixteen minutes
           against ten going out. */
        { to: "umbilical", label: "Back → The Umbilical [5]", mins: 2 },
        { to: "hopperdeck", label: "In → Hopper Deck [7]", mins: 2 },
        { to: "amaranthbridge", label: "Up → Amaranth Bridge [9]", mins: 2 },
      ],
      features: {
        boots: {
          name: "Bootprints",
          d:
            "Frost on the deck plate, and a set of prints through it going inward. One set. Nothing "
            + "coming back out.",
          setsFlag: "saw_prints",
        },
      },
    },

    hopperdeck: {
      n: 7, name: "AMARANTH — HOPPER DECK", tags: ["TERMINAL"],
      look:
        "A gantry over the top of hold one, forty metres of it, with the hold hatches beneath your "
        + "boots. The lading office is a glass box at the far end with its light still on.",
      exits: [
        { to: "amaranthlock", label: "Back → Lock [6]", mins: 2 },
        {
          to: "coldhold",
          label: "Down → Cold Hold [8]",
          mins: 2,
          gate: {
            flag: "hold_open",
            routes: [
              { when: "has:keycard", text: "Halloran's card takes the lock off the hatch. It has not been opened in eleven days and it does not want to be." },
            ],
            roll: {
              label: "HOLD HATCH", stat: "strength",
              passText: "the hatch comes up on frozen hinges",
              failText: "it does not move, and your hands are numb before you stop trying",
            },
          },
        },
      ],
      features: {
        office: {
          name: "The lading office",
          d: "A desk, a terminal, and a lading sheet under a magnet.",
          gives: ["manifest"],
        },
        hatches: {
          name: "The hold hatches",
          d:
            "Frost on every one of them except the third, which is clear, and warm enough to have "
            + "run a little water down the seam.",
          deep: true, setsFlag: "saw_warm_hatch",
        },
        fridgepanel: {
          name: "Refrigeration panel",
          d:
            "Hold one is running at minus eleven. It is set to minus sixty. The fault light has been "
            + "on so long the lens has gone yellow.",
          setsFlag: "knows_warm",
        },
      },
    },

    coldhold: {
      n: 8, name: "AMARANTH — COLD HOLD", tags: ["DARK"],
      look:
        "Forty-one tonnes of nickel-iron in a space built for sixty. It is stacked to the port side "
        + "and it is stacked badly, and the space it has been shoved out of is empty and is not the "
        + "shape of anything that was ever loaded here.",
      exits: [{ to: "hopperdeck", label: "Up → Hopper Deck [7]", mins: 2 }],
      features: {
        rodrack: {
          name: "Coolant rack",
          d: "Twelve slots. Nine rods. The three empty slots are not next to each other.",
          gives: ["coolantrod"],
        },
        thespace: {
          name: "The empty space",
          d:
            "Three metres by two, cleared to the deck. The ore around the edge of it has been pushed, "
            + "not lifted — there are score marks in the plate where it went.",
          deep: true, setsFlag: "saw_the_space",
          effects: [{ save: "fear", onFail: [{ stress: 1, why: "you work out how much force that took" }] }],
        },
        kerrigan: {
          name: "A body",
          d:
            "Against the far bulkhead, in a suit, sitting down. Eleven days at minus sixty has kept "
            + "him exactly as he was. His card is gone from his belt and his torch is still on.",
          effects: [
            { flag: "found_kerrigan" },
            { save: "sanity", onFail: [{ stress: 2, why: "he was sitting down when it happened" }] },
          ],
        },
      },
    },

    amaranthbridge: {
      n: 9, name: "AMARANTH — BRIDGE", tags: ["TERMINAL"],
      look:
        "Standby power and one working plate. Two seats, both empty, both pushed back. Somebody left "
        + "this room quickly and nobody came back to tidy it.",
      exits: [{ to: "amaranthlock", label: "Down → Lock [6]", mins: 2 }],
      features: {
        decklog: {
          name: "The deck log",
          d: "Open on the plate, at the last page anybody wrote.",
          gives: [], handout: "amaranthlog",
        },
        cryobunk: {
          name: "Emergency bunk",
          d:
            "A one-person cold bunk against the aft wall, sealed, running, and eleven days into a "
            + "cycle rated for four. There is somebody in it.",
          setsFlag: "found_halloran",
          deep: true,
        },
      },
    },
  },

  npcs: {
    /* Aboard the tug, and therefore reachable by whichever half of
       the crew stayed. That is the point of him: a split party
       should have somebody to talk to on BOTH sides of the
       umbilical, or one half is just waiting. */
    pike: {
      name: "SOLA PIKE", role: "Corvid Engineer", start: "enginebay",
      brief: "Took the contract. Regrets it in a way she will not say out loud.",
      persona: "Answers the question you asked and not the one you meant. Does not speculate.",
      /* Ordered as an author orders things — general first. The
         director no longer reads them in that order: `pickKnown`
         weights them against the room, the flags and the clue
         board, so Pike volunteers the burn line when the burn is
         the thing and the cable line when somebody has been down
         the umbilical. Every sentence below is still hers,
         verbatim, and there is no path from a keyword to a
         generated one. */
      knows: [
        "We took this tow at Kepler because it paid on tonnage and nobody asked what the tonnage was.",
        "Once the drive lights for the burn we are committed. You cannot cut a cable under load, it will come back through the collar and take the stern off.",
        "The tow cable has changed note twice since yesterday. That means the load moved. Forty-one tonnes of ore does not move.",
        "There was a fourth suit on the rack when we docked at Kepler. I did not put it there and I have not asked.",
        "Hold one is a refrigerated hold on a ship carrying rock. I noticed. I decided not to have noticed.",
        "If you open that hatch, close it again before the burn. Whatever the yard finds is the yard's problem, and only if it is still cold.",
      ],
    },

    /* Asleep, on the other ship, and behind a flag. She is not a
       source of answers; she is what happens if the crew spends
       time they do not have. Waking her costs eight minutes each
       way and she is worth it exactly once. */
    halloran: {
      name: "ESTHER HALLORAN", role: "Amaranth, Master", start: "amaranthbridge",
      brief: "Eleven days into a four-day emergency bunk. Should not be alive and is.",
      persona: "Very cold, very slow, and completely certain about the one thing she says.",
      gone: true,
      knows: [
        "Kerrigan went down to hold one to reseat the coolant rods. I heard the hatch. I did not hear it again.",
        "The refrigeration failed on day fourteen and we ran warm for nine hours. That was the mistake. Everything after it is just the consequence.",
        "It is not ore. It was never all ore. There are forty-one tonnes on the manifest and there are thirty-eight tonnes of rock in that hold.",
        "Do not take it to Tarsis. Tarsis is a breaker's yard, they cut hulls open in an atmosphere, with people standing in it.",
      ],
    },
  },

  threats: {
    /* IT HAS A BODY, AND THAT IS A DESIGN DECISION.

       Ypsilon 14's threat is `unseen: true`, and its director
       block correctly ships an EMPTY `attacks` array, because
       `safeMove` refuses to start a fight with a threat the module
       declared unseen — an invisible thing may be moved and must
       never be narrated.

       This one can be seen coming. It is cold, it is slow, it is
       forty metres away down a gantry, and a crew that is looking
       at it has time to decide what to do. So this module DOES
       fill in `attacks`, and between the two of them the engine's
       two positions on that rung are both demonstrated in shipped
       content rather than only in tests. */
    sleeper: {
      name: "THE PASSENGER", combat: 45, speed: 25, maxHits: 4,
      d: "Long, pale, and unhurried. It has been cold for a very long time and it is not cold now.",
      attacks: [
        { name: "Take hold", dmg: "2d10", text: "It closes the distance without appearing to hurry and simply takes hold of you." },
        { name: "Cold", dmg: "1d10", text: "Where it touches you, the suit frosts from the inside." },
      ],
      onSlain: [
        { say: "It stops. It does not fall over, because it was never really standing.", tone: "good" },
        { flag: "sleeper_dead" },
      ],
    },
  },

  /* ------------------------------------------------------------
     THE CLOCK, WHICH IS THE MODULE

     One countdown, started at minute zero by `onStart`, ninety
     minutes long, and the crew is told the number from the first
     sentence. There is no second timer.

     `rungLastCall` handles the OTHER clock — the one the people
     in the room are on — and the two are deliberately independent.
     A table that told the lobby it finishes at ten o'clock gets
     steered toward an ending whatever the burn plot says.
     ------------------------------------------------------------ */
  onStart: [
    {
      countdown: {
        id: "burn", minutes: 90, full: 90,
        label: "BURN TO TARSIS",
        tick: "BURN TO TARSIS · {left} minutes. After ignition the cable cannot be cut.",
        onZero: [{ run: "ignition" }],
      },
    },
  ],

  clocks: [],

  endings: {
    cut: {
      title: "YOU CUT IT LOOSE", good: true,
      text:
        "The charge fires, the collar opens, and ninety metres of cable goes slack and then away. "
        + "The Amaranth keeps the vector it had. In nine days you make Tarsis with an empty hook and "
        + "a story nobody pays for, and in some number of years the hopper makes something else.",
    },
    burned: {
      title: "YOU BROUGHT IT IN",
      text:
        "Eleven days to Tarsis with forty-one tonnes on the hook, and the yard pays on tonnage, and "
        + "they cut hulls open in an atmosphere with people standing in it. You were paid. It is a "
        + "matter of record that you were told.",
    },
    frozen: {
      title: "YOU PUT IT BACK IN THE COLD", good: true,
      text:
        "Rods reseated, hatch closed, hold one back down through minus forty and still falling when "
        + "you leave it. It is not dead. It is exactly as dead as it was at Kepler, and the difference "
        + "between those two things is the only thing you sold at Tarsis.",
    },
    lost: {
      title: "THE CORVID MADE TARSIS EMPTY",
      text: "The tug arrives on schedule. The umbilical is still attached at one end.",
    },
  },

  intro: [
    "Forty hours out of Kepler Station, under tow, on a contract that paid on tonnage.",
    "The tow telemetry has been amber since the middle of the night shift.",
    "The burn to Tarsis lights in ninety minutes, and after that the cable stays on.",
  ],

  talkPrompts: [
    "What is actually in that hold?",
    "Can we still cut the cable?",
    "What happens if we are late for the burn?",
  ],

  /* ------------------------------------------------------------
     HOOKS — the module's own verbs, named by the director block
     and by the countdown. Everything here changes state and says
     something the author wrote; nothing composes.
     ------------------------------------------------------------ */
  hooks: {
    /* Called by `director.pressure`. The threat's own drive, such
       as it is: cold, slow, and toward warmth. It is deliberately
       stupid compared to Ypsilon 14's `thinkMonster`, because a
       ninety-minute module cannot afford a threat with a
       simulation behind it that nobody will see the output of. */
    prowl: (api) => {
      const w = api.world();
      const t = (w.threats || {}).sleeper;
      if (!t || t.dead) return;
      if (!w.flags.hold_open) {
        api.say("horror", "Something moves in the deck under the gantry, and stops.");
        return;
      }
      const path = { coldhold: "hopperdeck", hopperdeck: "amaranthlock", amaranthlock: "umbilical", umbilical: "airlock" };
      const next = path[t.loc] || "coldhold";
      api.setThreat("sleeper", { loc: next });
      api.say("horror", "Somewhere ahead of you, in the dark, something that was one place is now one place nearer.");
    },

    ignition: (api) => {
      const w = api.world();
      api.flag("burn_lit", true);
      api.say(
        "horror",
        "The drive lights. Ninety metres of cable comes up hard against the collar and stays there, "
        + "and the decision about the Amaranth stops being yours.",
      );
      if (w.flags.cable_cut) return;
      api.endGame("burned");
    },

    /* The one mechanical route to the good-and-difficult ending.
       Deliberately fiddly: three rods, two of them on the far
       ship, in the room the threat is in. */
    reseat: (api) => {
      const w = api.world();
      const n = (w.flags.rods_seated || 0) + 1;
      api.flag("rods_seated", n);
      if (n < 3) {
        api.say("system", `Rod ${n} of three seated. The hold reads minus fourteen and falling.`);
        return;
      }
      api.flag("hold_cold", true);
      api.say("good", "Third rod home. The hold takes the cold back the way a room takes silence back.");
    },
  },

  /* `itemUse` maps an item id straight to an effect LIST — there
     is no wrapper object and no `label`. Getting that wrong is
     silent: the keys are dropped and the item does nothing, which
     is exactly the class of mistake `defineModule`'s warnings
     exist to catch, and it caught this one. */
  itemUse: {
    coolantrod: [
      {
        when: "room:coldhold",
        then: [{ run: "reseat" }, { take: ["coolantrod"] }],
        else: [{ say: "The rack is in the cold hold. Seating a rod anywhere else does nothing at all.", tone: "system" }],
      },
    ],
    cutter: [
      {
        when: "room:enginebay",
        then: [
          {
            when: "flag:burn_lit",
            then: [{
              say:
                "The cable is under load. Cutting it now would bring ninety metres of it back through "
                + "the collar at speed, and Pike has already told you what that does.",
              tone: "warden",
            }],
            else: [
              { flag: "cable_cut" },
              { say: "The collar opens. The cable goes, and takes the contract with it.", tone: "good" },
              { end: "cut" },
            ],
          },
        ],
        else: [{ say: "The collar is in the engine bay. The charge clamps to the collar and nowhere else.", tone: "system" }],
      },
    ],
  },

  warden: {
    setting:
      "The salvage tug CORVID, forty hours out of Kepler Station, towing the ore hopper AMARANTH to "
      + "a breaker's yard at Tarsis. Ninety minutes to the burn. The cargo is not all ore.",
    constraints: [
      "The crew may cut the cable at any point before ignition, and that is a real ending, not a failure.",
      "The Passenger is cold and slow. It should be seen before it is fought, every time.",
      "Halloran is worth eight minutes each way and should be allowed to be worth it.",
    ],
  },

  director,
});
