/* ============================================================
   SCENARIO 2 — HERON TERRAFORMING STATION

   Eleven survivors barricaded in a hangar, split into three
   factions who each want a different job done first:

     TEAM LEAVE   cross the dam, retake the tower, call evac
     STUDY GROUP  go down to the lab, recover Edem's research
     HOG SQUAD    get down to the reactor, find Siege Squad

   The crew pick one. After the first, the reactor dies and the
   station goes dark; whichever mission they did not pick was
   attempted anyway, by people who did not come back. After the
   second, the water is in the building.

   None of the three missions is the right one. That is the
   design, and the module is explicit that the Warden must not
   hint otherwise.
   ============================================================ */

export const heron = {
  hangar: {
    n: 1, name: "THE HANGAR", tags: ["INSIDE", "SAFE", "TERMINAL"],
    look:
      "Sandbagged to the roofline and lit by whatever the station can still spare. Eleven people live in here now, "
      + "and they have arranged themselves so that every door has a firing angle on it. Three all-terrain vehicles "
      + "are parked nose-out along the north wall. One of them is in pieces. Beyond the wire, past the sound of the "
      + "rain, something moves along the treeline and does not come closer.",
    onFirstEnter: [
      { say: "Two ATVs come out to meet you with a boombox strapped to the roll cage, playing something orchestral and enormous, and the carcs in the treeline pull back from the noise of it.", tone: "npc" },
      { say: "▌ Every one of these people wants something from you. Every minute you spend deciding, the water comes up and more of them arrive outside.", tone: "warden" },
      { flag: "reached_heron" },
    ],
    exits: [
      { to: "lz", label: "Rough trail east → Greta Base", mins: 60 },
      { to: "lz", label: "Rough trail east by ATV → Greta Base", mins: 20, needs: "flag:atv" },
      { to: "dam", label: "Out to the dam wall [2]", mins: 10 },
      { to: "lab", label: "Elevator down to level −01 → the Lab [6]", mins: 5 },
      { to: "chimney", label: "Down the chimney shaft [11]", mins: 15, needs: "flag:ropes", needsHint: "ropes required", needsText: "Sixty metres straight down into the dark, and nothing to hold on to." },
      /* THE JOKE STOPS BEING ONE. The raft is stowed in the tower
         locker by somebody who thought it was funny, and the module
         says outright that it is about to stop being funny — and
         then nothing anywhere could ever use it. Three places can
         now, and all three are places the storm has already made. */
      { to: "dam", label: "Launch the raft off the hangar floor → the Dam [2]", mins: 15, needs: "has:raft", hidden: "flooded_hangar", effects: [{ run: "raftCross" }] },
    ],
    features: {
      atvs: {
        name: "Three Valkyrie ATVs",
        d: "Ninety miles an hour, three seats, and a machine gun on the front of each. Two run. The third is stripped across the floor beside it and is a couple of hours' work for anybody who knows engines.",
        setsFlag: "atv",
      },
      broken: {
        name: "The stripped ATV",
        d: "Everything is here, it is simply in the wrong order. A competent mechanic could have it running inside the hour, or spend all night on it.",
        deep: true, skills: ["Mechanical Repair", "Rimwise"], mins: 60,
        effects: [
          { test: "speed", skill: ["Mechanical Repair"], tags: ["repair"],
            onPass: [{ say: "It turns over on the third attempt and stays turning.", tone: "good" }, { flag: "third_atv" }],
            onFail: [{ say: "It turns over, runs for nine seconds, and dies with a noise that means several more hours.", tone: "warden" }, { time: 240 }] },
        ],
      },
      stockpile: {
        name: "The stockpile",
        d: "Four machine guns with thirty belts, twelve pulse rifles with forty-eight magazines, thirty-two frags, two demolition charges, and a flamethrower with two tanks. It is a great deal of ordnance and it has not worked once.",
        /* The GPMG was fully statted in items.js and granted by
           nothing anywhere. It is four metres away from the crew in
           a room the module describes as full of them, and it is
           useless against carapace — which is the point. Let them
           carry it and find that out. */
        gives: ["pulserifle", "fraggrenades", "gpmg"], mins: 10,
      },
      generator: {
        name: "Portable generator and fuel",
        d: "A petrol set and a few drums. Enough to run lab equipment and terminals for about a day, if somebody carries it where it is needed.",
        gives: ["portablegen"], setsFlag: "has_generator",
      },
      ropes: {
        name: "Climbing gear",
        d: "Two rope sets and harnesses, racked by the chimney hatch. Four people can go down at a time.",
        gives: ["campinggear"], setsFlag: "ropes",
      },
    },
  },

  dam: {
    n: 2, name: "THE DAM WALL", tags: ["OUTSIDE", "RAIN", "EXPOSED"],
    look:
      "Ten metres wide, sixty metres of nothing on the left, and on the right a lake that is a hand's width from "
      + "coming over the top. The rain arrives sideways. The only light is whatever you brought with you, and it "
      + "reaches about nine metres before the weather eats it.",
    onFirstEnter: [
      { say: "▌ Two minutes across by vehicle. Seven on foot. There is a catwalk above the wall that takes fifteen and cannot be seen from below.", tone: "warden" },
      { run: "damCrossing" },
    ],
    exits: [
      { to: "hangar", label: "Back → the Hangar [1]", mins: 10 },
      { to: "lift", label: "Across the wall → the Lift [3]", mins: 7 },
      { to: "lift", label: "Across by ATV → the Lift [3]", mins: 2, needs: "flag:atv" },
      { to: "lift", label: "Along the catwalk above → the Lift [3]", mins: 15, hidden: "seen_catwalk" },
    ],
    features: {
      catwalk: {
        name: "Look up",
        d: "A maintenance catwalk runs the whole length of the dam, reached by a ladder at this end. Wide enough for two people, or for one carc. The railings are solid enough to cross behind, if nobody hurries.",
        setsFlag: "seen_catwalk",
      },
      lake: { name: "The lake", d: "Level with the lip and rising while you look at it. When it goes over, it goes over everything downstream of here." },
      wreck: {
        name: "The crashed ATV", when: "flag:dam_crash",
        d: "On its side against the parapet with the headlights still burning out into the rain. Two people were thrown clear of it. One of them is not moving. The other is breathing.",
        effects: [{ run: "damCasualties" }],
      },
    },
  },

  lift: {
    n: 3, name: "THE LIFT", tags: ["OUTSIDE", "RAIN"],
    look:
      "The tower goes up into weather you cannot see the top of. The service lift sits at the bottom of its cage, "
      + "dead. Two ladders run up the girders either side, and the rain has made both of them a bad idea. "
      + "A maintenance closet is padlocked shut against the base of the structure.",
    exits: [
      { to: "dam", label: "Back → the Dam [2]", mins: 7 },
      { to: "control", label: "Climb the cage ladders → the Control Room [4]", mins: 20 },
      { to: "control", label: "Take the lift → the Control Room [4]", mins: 3, needs: "flag:lift_fixed" },
    ],
    features: {
      lift: {
        name: "The service lift",
        d: "Not broken so much as unmaintained past the point of function. A quick job for somebody who knows the type, under a great deal of falling water.",
        deep: true, skills: ["Mechanical Repair", "Jury-Rigging"], mins: 15,
        effects: [
          { test: "speed", skill: ["Mechanical Repair"], mode: "disadvantage", tags: ["repair"],
            onPass: [{ say: "The cage shudders, thinks about it, and starts to climb.", tone: "good" }, { flag: "lift_fixed" }],
            onFail: [{ say: "It lifts a metre and drops back onto its stops hard enough to be felt through the boots.", tone: "warden" }, { time: 20 }] },
        ],
      },
      ladders: { name: "The cage ladders", d: "Twenty minutes of climbing in a storm. The carcs, when they come, will not use the ladders. They will use the girders." },
      closet: {
        name: "Maintenance closet",
        d: "Padlocked, and nobody left alive has the key. The lock itself is old and would come off with one good pull. Inside: cable, tools, and a small backup generator with six hours of fuel in it — enough to light the entire tower.",
        gives: ["toolkit", "portablegen"], setsFlag: "has_generator", mins: 10,
      },
    },
  },

  control: {
    n: 4, name: "THE CONTROL ROOM", tags: ["INSIDE", "TERMINAL"],
    look:
      "Squat, industrial, and locked from the inside. A catwalk runs around the outside of it and a short ladder "
      + "goes up from there to the dish. Within, past the door, is the reason no radio on this planet has worked "
      + "for three months — and it is alive, and it has been surgically attached to the transmitter.",
    exits: [
      { to: "lift", label: "Back down → the Lift [3]", mins: 20 },
      { to: "relay", label: "Ladder up → the Orbital Relay [5]", mins: 5 },
    ],
    features: {
      door: {
        name: "The control room door",
        d: "Locked from within. Brookman has the only card that opens it and will hand it to anyone who asks him.",
        /* THE KEYCARD THAT DID NOT EXIST.

           `controlcard` was declared in items.js, described in three
           places, and granted by nothing anywhere in the module — no
           feature, no threat, no shop. Nobody can ask an NPC for an
           item; the engine has no mechanism for it. So the single
           largest lever in the module sat behind an object that could
           not be obtained, and the only reason a table ever got in was
           a second bug (features ignoring `when`) letting them press
           "cut it out of the controls" through a shut door.

           Asking Brookman is still the clean way in and now actually
           hands the card over. Cutting is the loud way in. */
        effects: [
          { when: "has:controlcard",
            then: [{ say: "The card works first time. Inside, something turns its head towards the door.", tone: "horror" }, { flag: "control_open" }],
            else: [{
              when: "npc:brookman",
              then: [
                { say: "Brookman gave this up without an argument, the way he gives up everything. It works first time.", tone: "system" },
                { give: ["controlcard"] },
                { say: "Inside, something turns its head towards the door.", tone: "horror" },
                { flag: "control_open" },
              ],
              else: [{
                when: "tag:cuts",
                then: [
                  { time: 25 }, { noise: "a cutting torch on a tower in a storm" },
                  { say: "You take the lock out of the frame. It costs you twenty-five minutes and every carc within a mile now knows where the tower is.", tone: "warden" },
                  { flag: "control_open" },
                ],
                else: [{ say: "Sealed. Somebody on the other side of the dam is carrying the answer to this in a breast pocket — and there is a cutter in the maintenance closet at the bottom.", tone: "system" }],
              }],
            }] },
        ],
      },
      carc: {
        name: "The thing on the console", when: "flag:control_open",
        d: "A carcinid, grafted into the transmitter housing at four points, cabled directly into the broadcast stage. It is not restrained. It has been made part of the equipment, and it is still awake.",
        setsFlag: "seen_signal",
        effects: [
          { save: "sanity", why: "somebody did this on purpose, with tools", onFail: [{ stress: 2, why: "it is still awake" }] },
          { say: "▌ This is the Signal. Everything that has happened on this planet since the comms died comes out of this room.", tone: "warden" },
        ],
      },
      remove: {
        name: "Cut it out of the controls", when: "flag:seen_signal and !flag:signal_down",
        d: "A minute's work with anything sharp, and every carc on Samsa VI stops receiving orders at the same moment.",
        mins: 5,
        effects: [{
          when: "flag:control_open and flag:seen_signal and !flag:signal_down",
          then: [{ run: "killSignal" }],
          else: [{ say: "Not from out here. The door is shut and whatever is on the other side of it has not been looked at yet.", tone: "system" }],
        }],
      },
      locker: {
        name: "Emergency locker",
        d: "Bandages, five stimpaks, a flashlight, and an inflatable raft that somebody stowed here as a joke and which is about to stop being one.",
        gives: ["stimpak", "flashlight", "raft"], mins: 10,
      },
    },
  },

  relay: {
    n: 5, name: "THE ORBITAL RELAY", tags: ["OUTSIDE", "RAIN", "EXPOSED"],
    look:
      "The roof of the tower, and a dish big enough to park a vehicle in. Guardrails run the perimeter. Prone at "
      + "the north rail with an anti-material rifle braced on a folded jacket is a marine, soaked through, and "
      + "beside him a working dog that is not a dog. As you arrive he fires once, over the rail, and something "
      + "sixty metres below stops climbing.",
    onFirstEnter: [
      { say: "\"Twelve left,\" he says, without turning round. \"Then it's whatever you brought.\"", tone: "npc" },
      { npc: { id: "underhill", loc: "relay" } },
      { npc: { id: "marlow", loc: "relay" } },
      { flag: "met_underhill" },
    ],
    exits: [{ to: "control", label: "Back down → the Control Room [4]", mins: 5 }],
    features: {
      array: {
        name: "The dish alignment",
        d: "Out of true, and a round's work to reset by hand. Resetting it does nothing at all on its own — the transmitter below has to stop broadcasting first.",
        mins: 5, effects: [{ run: "resetArray" }],
      },
      rifle: {
        name: "The anti-material rifle",
        d: "A Wilbur Mk-II, and it does what the colonists' rifles cannot: it kills one of them per round. Twelve rounds left. Two-handed, heavy, and useless unless you are prone.",
      },
      /* `amr` was statted and had no `gives` anywhere, so the only
         weapon on the planet that reliably kills a carc could not be
         picked up under any circumstances — including after the man
         holding it stopped being able to. He will not hand it over
         while he is alive and firing. He is not always either. */
      takerifle: {
        name: "Take the Wilbur", when: "!npc:underhill",
        d: "It is still braced on the folded jacket where he left it, pointed north, with rounds in it. Somebody has to pick it up and it is going to be one of you.",
        gives: ["amr"], setsFlag: "amr_free", mins: 5,
        effects: [{ save: "sanity", why: "picking up a dead man's rifle while it is still warm", onFail: [{ stress: 1, why: "he was still holding it" }] }],
      },
      dose: {
        name: "Dose Underhill", when: "npc:underhill and has:cytotoxin",
        d: "He is Stage 3 and holding it off with habit and a dog. He will let you do it. He will not ask you to.",
        mins: 15, effects: [{ run: "doseUnderhill" }],
      },
      marlow: {
        name: "The dog",
        d: "Synthetic, soaked, and lying against the marine's flank with its head up. It can smell the infection. It bites him — hard, on the thigh — whenever he stops being present, and it has evidently been doing so for days.",
        setsFlag: "knows_dog",
        effects: [{ say: "▌ Point it at a person and it will tell you whether they are infected. It is the only reliable test on this planet, and it will not leave that man.", tone: "warden" }],
      },
      cuts: {
        name: "The marine's arms",
        d: "Fine incisions, throat to wrist, in their hundreds. He knows. He has known for some time and he has arranged his affairs around it.",
        setsFlag: "knows_underhill_infected",
      },
    },
  },

  lab: {
    n: 6, name: "THE LAB", tags: ["INSIDE", "DARK", "TERMINAL"],
    look:
      "Level minus one: geoanalysis, chemistry, environmental control. Quiet, and abandoned mid-task — chairs "
      + "pushed back, a coffee gone to mould, an unfinished calculation on a bench. A status terminal is beeping "
      + "steadily to itself in the corner and has been for hours.",
    exits: [
      { to: "hangar", label: "Elevator up → the Hangar [1]", mins: 5 },
      { to: "stairs", label: "Hatch → maintenance stairs [13]", mins: 10 },
      {
        to: "clean", label: "Decontamination airlock → the Clean Room [7]", mins: 5,
        gate: {
          flag: "clean_open",
          routes: [{ when: "has:edemcard", text: "Edem's card, and Edem's expression while you use it." },
            { when: "npc:edem", text: "Edem steps past you, badges through without discussion, and holds the inner door." }],
          roll: { label: "DECON AIRLOCK", stat: "strength", tags: ["door", "force"], time: 20,
            passText: "Two of you get it far enough apart to slide through.",
            failText: "Industrial, powered, and currently neither." },
        },
      },
    ],
    features: {
      bench: {
        name: "The unfinished calculation",
        d: "Dosage arithmetic for a compound that has not been used on people in several hundred years, worked three ways and abandoned partway through the fourth.",
        gives: ["doxonote"], mins: 10,
      },
      status: {
        name: "Hydroreactor status terminal",
        d: "COOLING SYSTEM OVERLOADED. ENGAGE FLOOD CONTROLS MANUALLY TO PREVENT SHUTDOWN. It has been saying so for hours and there is nobody left on the distribution list.",
        setsFlag: "knows_reactor_warning",
      },
      research: {
        name: "Loose research", deep: true, skills: ["Xenobiology"], mins: 15,
        d: "Sequencing runs on a genome that does not organise itself the way anything from Earth does. Two hands again — the careful one and the fast one.",
      },
    },
  },

  clean: {
    n: 7, name: "THE CLEAN ROOM", tags: ["INSIDE", "DARK"],
    look:
      "Split by a glass partition into an observation side and a working lab. On the lab side, behind the glass, "
      + "something very large has its back to you and is doing careful work with what used to be hands. On the "
      + "bench nearest the door: vials of hydrofluoric acid, a portable computer terminal, and a chemical "
      + "synthesis rig too heavy to lift.",
    onFirstEnter: [
      { say: "It takes about a minute for it to notice you are there. Then it turns round, unhurried, the way somebody does when they are interrupted, and works its way through three words.", tone: "horror" },
      { save: "fear", why: "it nearly manages the sentence", onFail: [{ stress: 2, why: "you understood him" }] },
      { threat: { id: "ziegler", loc: "clean" } },
    ],
    exits: [
      { to: "lab", label: "Back through decon → the Lab [6]", mins: 5 },
      { to: "tumblers", label: "Vent behind the algae canisters → the Tumblers [9]", mins: 10 },
      {
        to: "cryo", label: "Sealed door → the Cryovault [8]", mins: 5,
        gate: {
          flag: "cryo_open",
          routes: [{ when: "has:edemcard", text: "Edem's card. Edem watches you use it." },
            { when: "npc:edem", text: "Edem is through the door before the question has finished being asked." }],
          roll: { label: "VAULT DOOR", stat: "intellect", skills: ["Hacking"], tags: ["door", "electronic"], time: 25,
            passText: "The vault decides you are staff.", failText: "One badge on this station opens it and Edem is wearing it." },
        },
      },
    ],
    features: {
      terminal: {
        name: "Portable computer terminal",
        d: "Edem's. Four months of sequencing, and the only thing on this planet the Company has actually asked for besides a body and a logic core.",
        gives: ["edemterminal"], setsFlag: "have_research",
      },
      vials: { name: "Vials of hydrofluoric acid", d: "Lab stock, properly stoppered, several of them. Somebody on this station knew.", gives: ["acidvial"], setsFlag: "knows_acid" },
      synth: {
        name: "Chemical synthesis rig",
        d: "Bolted down and hungry for power. Given Edem's research and a working generator, this is where ammunition gets coated with something that goes through carapace.",
        device: "synth",
      },
      canisters: {
        name: "Stack of algae canisters",
        d: "Terraformer feedstock, stacked chest-high. Behind them, a ventilation run has been forced open from the far side.",
        setsFlag: "seen_cleanvent",
      },
    },
  },

  cryo: {
    n: 8, name: "THE CRYOVAULT", tags: ["INSIDE", "COLD", "DARK"],
    look:
      "Six glass cylinders, each with a developing carcinid larva suspended in it, each lit from beneath. Five of "
      + "them are intact. The sixth is broken outward, and there is a trail of fluid across the floor leading to a "
      + "ventilation grille that has been forced open from this side.",
    onFirstEnter: [
      { say: "The fifth cylinder does not hold a carcinid. It holds something that is partly a carcinid and partly a person, and it has been developing for some time.", tone: "horror" },
      { save: "sanity", why: "the fifth cylinder", onFail: [{ stress: 2, why: "you can see whose face it started as" }] },
    ],
    exits: [
      { to: "clean", label: "Back → the Clean Room [7]", mins: 5 },
      { to: "tumblers", label: "Through the forced grille → the Tumblers [9]", mins: 10 },
    ],
    features: {
      cylinders: {
        name: "The intact cylinders",
        d: "Five larvae, developing on schedule, in a facility whose entire staff is dead. Something has been maintaining them.",
        gives: ["larva"], setsFlag: "knows_specimens",
      },
      hybrid: {
        name: "The fifth cylinder",
        d: "Carcinid below the ribs and, above them, something that has not entirely finished stopping being human. It is not distressed. Whatever it is doing in there, it is doing it comfortably.",
        deep: true, skills: ["Xenobiology", "Pathology"], mins: 15, setsFlag: "knows_hybrid",
        effects: [{ say: "This did not happen to somebody. Somebody arranged for this to happen, with equipment, over weeks.", tone: "horror" }, { stress: 1, why: "the equipment is all facing the right way" }],
      },
      broken: {
        name: "The broken cylinder",
        d: "Broken outward. Whatever developed in it got itself out, crossed this floor, and went into the ducting. Recently enough that the fluid has not dried.",
      },
      edemtake: {
        name: "What Dr Edem takes", when: "here:edem",
        d: "Edem does not go to the cylinders. Edem goes to a drawer under the third one, takes out a small unmarked datastick, and puts it away without comment.",
        gives: ["datastick"], setsFlag: "saw_edem_take",
      },
    },
  },

  tumblers: {
    n: 9, name: "THE TUMBLERS", tags: ["INSIDE", "DARK", "LOUD"],
    look:
      "Vast rotating drums grinding rock and biomass into slurry, and the noise of them is total — it is not "
      + "possible to hear a scream in here, and everybody in this room knows it. A utility ladder runs up the wall "
      + "to the control walkway above.",
    onFirstEnter: [
      { say: "▌ Nobody can hear anybody in here. Shouted warnings do not arrive. Neither does a Shriek.", tone: "warden" },
      { flag: "in_the_noise" },
    ],
    exits: [
      { to: "clean", label: "Vent → the Clean Room [7]", mins: 10 },
      { to: "cryo", label: "Grille → the Cryovault [8]", mins: 10 },
      { to: "walkway", label: "Utility ladder up → the Walkway [10]", mins: 10 },
    ],
    features: {
      drums: { name: "The tumblers", d: "Turning at a speed that does not look fast until you work out how big they are. There is no guard rail on the working side and there never was." },
      trail: {
        name: "The trail of fluid",
        d: "It comes out of the grille, crosses the floor, and stops at the lip of the nearest drum. It does not continue on the other side.",
        setsFlag: "knows_escapee",
      },
    },
  },

  walkway: {
    n: 10, name: "THE WALKWAY", tags: ["INSIDE", "TERMINAL"],
    look:
      "A spartan catwalk over the drums, with the floor controls for this level at the far end. From up here the "
      + "whole level is visible and the noise is merely enormous rather than absolute.",
    devices: ["floor"],
    exits: [
      { to: "tumblers", label: "Ladder down → the Tumblers [9]", mins: 10 },
      { to: "stairs", label: "Hatch → maintenance stairs [13]", mins: 10 },
    ],
    features: {
      panel: {
        name: "Floor control platform",
        d: "Door override, decontamination cycle, and a live camera feed of the clean room. Keyed to a medical badge.",
        device: "floor",
      },
      camera: {
        name: "The camera feed",
        d: "The clean room, from above and behind. Whatever is in there has not moved from the bench in some time, and the thing it is working on is laid out with a great deal of care.",
      },
    },
  },

  chimney: {
    n: 11, name: "THE CHIMNEY", tags: ["INSIDE", "DARK", "SHAFT"],
    look:
      "A sixty-metre drop into sheer black. Four can rappel at a time on two ropes. Thirty metres down the walls "
      + "change — first a hardened resin sprayed across the concrete, then, past that, cocoons. Dozens of them, "
      + "attached to the shaft wall, and several are open.",
    onFirstEnter: [
      { save: "fear", why: "what is attached to the walls of the shaft", onFail: [{ stress: 2, why: "some of them are open" }] },
      { run: "chimneyHatch" },
    ],
    exits: [
      { to: "hangar", label: "Climb back up → the Hangar [1]", mins: 30 },
      { to: "reactor", label: "Airlock at the bottom → the Hydroreactor [14]", mins: 10 },
    ],
    features: {
      cocoons: {
        name: "The cocoons",
        d: "Resin, layered and translucent, each about the size of a person curled up. The open ones are open from the inside. The closed ones are warm.",
        setsFlag: "seen_cocoons",
      },
      resin: {
        name: "The sprayed resin",
        d: "Laid down wet over the concrete and cured hard — the same material that welded a colony's worth of weapons into a single lump.",
      },
    },
  },

  spillways: {
    n: 12, name: "THE SPILLWAYS", tags: ["INSIDE", "WATER", "LOUD"],
    look:
      "A flood tunnel with a torrent going through the middle of it, flanked by narrow maintenance walkways. "
      + "Anything that goes into that water goes under and does not come up. On the far side, in the mouth of a "
      + "drainage tunnel, something is caught against a grate.",
    onFirstEnter: [{ say: "▌ Falling in is not a damage roll. It is a drowning, and the module means it.", tone: "warden" }],
    exits: [
      { to: "stairs", label: "Down → the Stairs [13]", mins: 10 },
      { to: "tunnels", label: "Rusted red door at the far end → the Tunnels [15]", mins: 10 },
      { to: "tunnels", label: "Ride the torrent across on the raft → the Tunnels [15]", mins: 5, needs: "has:raft", effects: [{ run: "raftCross" }] },
    ],
    features: {
      body: {
        name: "The body against the grate",
        d: "Mangled past recognition and jammed into the bars by the current. Tags: PFC GLÖCKNER. Still slung across the back: a rocket launcher with one missile in it and SOME PIG scratched down the tube.",
        gives: ["lat90"], mins: 15,
        effects: [
          { save: "body", why: "crossing to the grate", onFail: [{ damage: "1d10", why: "the current took your legs out" }, { stress: 1, why: "you nearly went under" }] },
          { save: "sanity", onFail: [{ stress: 1, why: "what the grate did to him" }] },
        ],
      },
      water: { name: "The water", d: "Rising, and rising faster than it was an hour ago. Whatever the reactor is supposed to do about this, it is not currently doing it." },
    },
  },

  stairs: {
    n: 13, name: "THE STAIRS", tags: ["INSIDE", "DARK", "CRAMPED"],
    look:
      "A maintenance stairwell, industrial, unlit, and narrow enough that two people cannot pass. Upward it goes "
      + "to the spillways. Downward it descends half a storey and then into black water that is higher than it was.",
    exits: [
      { to: "spillways", label: "Up → the Spillways [12]", mins: 10 },
      { to: "lab", label: "Hatch → the Lab [6]", mins: 10 },
      { to: "walkway", label: "Hatch → the Walkway [10]", mins: 10 },
      { to: "reactor", label: "Swim down to the jammed hatch → the Hydroreactor [14]", mins: 10 },
    ],
    features: {
      water: {
        name: "The rising water",
        d: "Cold, black, and about twenty seconds' swim to the bottom, where there is a hatch that has jammed in its frame. Longer than that if the pumps stop, and the pumps are going to stop.",
      },
    },
  },

  reactor: {
    n: 14, name: "THE HYDROREACTOR", tags: ["INSIDE", "WATER", "RADIATION"],
    look:
      "An industrial complex the size of a cathedral, flooded almost to the roof. What is left above the surface "
      + "is the crown of an enormous turbine, and huddled on top of it are two marines: one standing watch with a "
      + "machine gun, the other clinging to his leg. Neither of them has slept.",
    onFirstEnter: [
      { say: "\"Six rounds,\" the standing one calls down, over the water. \"Six. I've been counting them out loud so I don't lose the number.\"", tone: "npc" },
      { npc: { id: "franco", loc: "reactor" } },
      { npc: { id: "weaver", loc: "reactor" } },
      { flag: "found_siege" },
    ],
    exits: [
      { to: "chimney", label: "Catwalk and airlock → the Chimney [11]", mins: 10 },
      { to: "stairs", label: "Swim up → the Stairs [13]", mins: 10 },
      { to: "tunnels", label: "Through the organic gash → the Tunnels [15]", mins: 20, hidden: "seen_gash" },
      { to: "tunnels", label: "Paddle across to the gash → the Tunnels [15]", mins: 10, needs: "has:raft", hidden: "seen_gash", effects: [{ run: "raftCross" }] },
    ],
    features: {
      controls: {
        name: "The flood controls",
        d: "Destroyed beyond any argument — not shorted, not flooded. Taken apart by hand, deliberately, by somebody who knew exactly which parts mattered.",
        setsFlag: "knows_sabotage",
        effects: [{ say: "▌ This was not the storm and it was not the carcs. Somebody came down here with hands and did this.", tone: "warden" }],
      },
      gash: {
        name: "A large organic gash",
        d: "Below the waterline, in the side of the complex: an opening in the structure that was not cut or blasted. It was grown, or eaten, and it leads somewhere with smooth bored walls.",
        setsFlag: "seen_gash", deep: true, mins: 15,
      },
      water: { name: "The water", d: "Warm, and moving in ways the current does not account for. Franco will not talk about how many of them are down there." },
      dose: {
        name: "Dose Weaver", when: "npc:weaver and has:cytotoxin",
        d: "Stage 1, and he does not know. Franco does. Whether anybody explains what is in the syringe before it goes in is a decision somebody at this table has to make out loud.",
        mins: 15, effects: [{ run: "doseWeaver" }],
      },
    },
  },

  tunnels: {
    n: 15, name: "THE TUNNELS", tags: ["UNDERGROUND", "DARK", "CARC"],
    look:
      "A bore three metres across with walls smoothed by something that ate its way through rather than cutting. "
      + "The moment you are inside, the opening behind you closes — tissue drawing itself shut, unhurried, with "
      + "the sound of a wound healing at speed. The air here is breathable, and it is not the planet's.",
    onFirstEnter: [
      { save: "fear", why: "the way out sealed itself behind you", onFail: [{ stress: 2, why: "it closed on its own" }] },
      { say: "The radiation counter, which has been screaming since the reactor, falls away to nothing over about a minute.", tone: "system" },
      { flag: "in_tunnels" },
    ],
    exits: [
      { to: "reactor", label: "Back the way you came → the Hydroreactor [14]", mins: 20 },
      { to: "spillways", label: "Rusted red door → the Spillways [12]", mins: 10 },
      { to: "court", label: "Follow the bore — several miles", mins: 60 },
    ],
    features: {
      walls: {
        name: "The bore walls",
        d: "No tool marks. Concentric striations instead, the signature of something with a mouth working in shifts over a very long time.",
        deep: true, skills: ["Geology", "Asteroid Mining"], mins: 15, setsFlag: "knows_bore",
      },
      air: { name: "The air", d: "Warm, humid, faintly sweet, and pressurised. Somebody or something is maintaining an atmosphere down here, and it is not for you." },
    },
  },
};
