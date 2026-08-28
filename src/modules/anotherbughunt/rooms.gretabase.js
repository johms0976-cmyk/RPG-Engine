/* ============================================================
   SCENARIO 1 — GRETA BASE

   A prefab colony with the lights out, in a storm, containing
   nine corpses, one man who is no longer a man, and the single
   most important object in the module: a frozen flask of
   hydrofluoric acid in the hand of a marine who worked out what
   kills them and then sat down in a freezer to make sure
   somebody found it.

   The crew are meant to leave here having learned three things:
   guns do not work, the sound is how it spreads, and acid is
   the answer. Everything else in the base is texture for those
   three facts.
   ============================================================ */

export const gretabase = {
  lz: {
    n: 1, name: "LANDING ZONE", tags: ["OUTSIDE", "RAIN", "MUD"],
    look:
      "The dropship lifts out of it the moment your boots are clear and the noise goes with it. What is left is "
      + "rain — not weather so much as a standing condition — and a modular prefab base three hundred metres off, "
      + "strangled in vine growth that has gone tumorous around the joins. No lights. No answer on any channel. "
      + "The mud takes you to the shin and does not want to give anything back.",
    onFirstEnter: [
      { say: "Nothing here is responding to hailing, and the rain is eating your scans. You are going to have to walk up and knock.", tone: "system" },
      { save: "fear", why: "the base is dark and it should not be", onFail: [{ stress: 1, why: "nobody came out to meet you" }] },
    ],
    exits: [
      { to: "airlock", label: "Follow the tread tracks → Airlock [2]", mins: 10 },
      { to: "garage", label: "Take the fork around the back → Garage [10]", mins: 15 },
      { to: "hangar", label: "Rough trail west → Heron Station", mins: 60, hidden: "knows_heron" },
      { to: "hangar", label: "Rough trail west by APC → Heron Station", mins: 20, needs: "flag:apc", hidden: "knows_heron" },
      { to: "thrusters", label: "Faint trail north → the foothills", mins: 360, hidden: "knows_mountain" },
      { to: "thrusters", label: "Faint trail north by APC → the foothills", mins: 45, needs: "flag:apc", hidden: "knows_mountain" },
    ],
    features: {
      tracks: {
        name: "Deep tread tracks",
        d: "Heavy vehicle, repeatedly, in and out of the main airlock. The most recent set goes in and does not come out again.",
      },
      fork: {
        name: "A fork in the trail",
        d: "Churned mud leading around the flank of the base to a set of industrial roll-up doors at the back.",
      },
      vines: {
        name: "The vine growth",
        d: "It has gone into every seam and seal on the building's windward face. Under the growth the panels are pitted, as though something has been sprayed across them and left to work.",
        deep: true, skills: ["Botany"], mins: 10,
      },
    },
  },

  airlock: {
    n: 2, name: "AIRLOCK", tags: ["INSIDE"],
    look:
      "Rust has got into the frame of the outer door and made a meal of it. Inside: a bare chamber, mud tracked "
      + "across the floor in both directions, and storage lockers down both walls. The inner door will not cycle "
      + "while the outer one is open, which is the only rule this building is still enforcing.",
    exits: [
      { to: "lz", label: "Back out → Landing Zone [1]", mins: 5 },
      {
        to: "commissary", label: "Cycle the inner door → Commissary [3]", mins: 5,
        gate: {
          flag: "airlock_open",
          routes: [
            { when: "has:crowbar", time: 15, noise: "levering steel", text: "You get the bar into the seam and walk the door open by hand, a centimetre at a time." },
            { when: "tag:cuts", time: 20, noise: "a cutting torch", text: "You cut the lock out of it. The steel goes cherry-red and the rain coming in behind you turns to steam." },
          ],
          roll: {
            label: "KEYCARD READER", stat: "intellect", skills: ["Computers", "Hacking"], tags: ["door", "electronic"], time: 15,
            passText: "The reader takes a badge it has no business accepting and the bolts go back.",
            failText: "Dead. It is not locked so much as no longer participating.",
          },
        },
      },
    ],
    features: {
      lockers: {
        name: "Storage lockers",
        d: "Mostly cleared out in a hurry. What is left: one hazard suit, two rifle magazines, and a rosary, in the same locker, arranged neatly.",
        gives: ["hazardsuit", "rosary"], mins: 10,
      },
      dents: {
        name: "Damage to the locker doors",
        d: "Deep indentations along the row, at chest height, in a rhythm — something worked its way down the line trying each one. The last door has four parallel gouges through the steel, wider apart than a hand.",
        setsFlag: "seen_gouges",
        effects: [{ save: "fear", onFail: [{ stress: 1, why: "you put your fingers in the gouges" }] }],
      },
    },
  },

  commissary: {
    n: 3, name: "COMMISSARY", tags: ["INSIDE", "DARK"],
    look:
      "The mess and rec room, ransacked. Lights flickering on whatever the emergency bus can still manage. There "
      + "is a birthday banner sagging from the ceiling with a name on it, an upturned table with cake trodden flat "
      + "across the floor, and a great deal of broken glass. There are also bullet casings, bullet holes, blood at "
      + "spatter height on two walls, and gouges through the furniture that were not made by anything with hands.",
    onFirstEnter: [
      { save: "fear", why: "what is on the floor of the mess", onFail: [{ stress: 2, why: "the head, and where the head is not" }] },
      { say: "Rain is coming through the ceiling in three places. When you look up, the holes are bullet holes.", tone: "horror" },
    ],
    exits: [
      { to: "airlock", label: "Back → Airlock [2]", mins: 5 },
      { to: "pantry", label: "Through the kitchenette → Pantry [4]", mins: 5 },
      { to: "habitat", label: "Shift the barricade → Crew Habitat [6]", mins: 10 },
      { to: "command", label: "Main corridor → Command Center [9]", mins: 5 },
    ],
    features: {
      banner: {
        name: "Birthday banner",
        d: "HAPPY BIRTHDAY OLSSON, in letters somebody cut out by hand. One end has come away and it hangs down into the room at head height.",
      },
      table: {
        name: "The upturned table",
        d: "A human arm is under the edge of it. Beneath the table itself is a body in fatigues with no head and a hole through the neck the width of a dinner plate. Fine incisions cover every centimetre of exposed skin, like paper cuts, hundreds of them.",
        setsFlag: "seen_papercuts",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "the cuts are on every part of him" }] }],
      },
      chest: {
        name: "The headless body's chest",
        d: "Hollow. Not damaged — emptied, from the inside, by something that grew to a size and then left.",
        deep: true, skills: ["Pathology", "First Aid"], mins: 10,
        setsFlag: "knows_eruption",
        effects: [
          { say: "Whatever was in him was not put there. It was made there, and it came out through the front of him when it was ready.", tone: "horror" },
          { stress: 1, why: "it grew in him" },
        ],
      },
      tags: {
        name: "Dog tags",
        d: "LCPL XAVIER. He was the first. Nobody here knew that at the time, including him.",
      },
      barricade: {
        name: "Makeshift barricade",
        d: "A couch, a table and four chairs jammed against the door through to the crew quarters. Built from this side, in a hurry, by people who then did not go through it.",
      },
      thud: {
        name: "Listen",
        d: "Under the rain: a thud. Regular, a few seconds apart, patient, coming up through the floor from the back of the base. It has the rhythm of work rather than the rhythm of an animal.",
        mins: 10, setsFlag: "heard_digging",
      },
    },
  },

  pantry: {
    n: 4, name: "PANTRY", tags: ["INSIDE", "DARK"],
    look:
      "Every shelf stripped bare, and the contents stacked on the floor in large deliberate piles of ration packs. "
      + "Not looted. Sorted. In the far corner a marine is slumped against the base of the shelving, and has been "
      + "for some time.",
    exits: [
      { to: "commissary", label: "Back → Commissary [3]", mins: 5 },
      {
        to: "freezer", label: "Walk-in freezer door → Freezer [5]", mins: 5,
        gate: {
          flag: "freezer_open",
          routes: [{ when: "has:crowbar", time: 10, text: "The bar goes into the gasket and the seal lets go with a crack and a wash of cold." },
            { when: "tag:cuts", time: 15, noise: "a cutting torch", text: "You cut the latch off. Frost blooms instantly across the cut." }],
          roll: { label: "FREEZER LATCH", stat: "strength", tags: ["door", "force"], time: 10,
            passText: "It comes open in one heave and the cold falls out of it onto your boots.",
            failText: "Iced solid in the frame. It does not move." },
        },
      },
    ],
    features: {
      marine: {
        name: "The slumped marine",
        d: "Emaciated to the point of caricature, in a room stacked knee-deep with food. Fine incisions criss-cross what is visible of him.",
        setsFlag: "seen_papercuts",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "he was sitting in the food" }] }],
      },
      cause: {
        name: "How he died",
        d: "Starvation. In a pantry. He had been sorting the ration packs into piles for some time before he stopped, and he never opened one.",
        deep: true, skills: ["Pathology", "First Aid"], mins: 15,
        setsFlag: "knows_drone",
        effects: [{ say: "He was not trapped and he was not restrained. He was busy.", tone: "horror" }, { stress: 1, why: "he was busy" }],
      },
      tags2: { name: "Dog tags", d: "2NDLT LANGE. The pilot." },
      piles: {
        name: "The sorted piles",
        d: "Ration packs, by type, in stacks of nine, with the labels facing outward. It is the neatest thing in the building.",
      },
    },
  },

  freezer: {
    n: 5, name: "WALK-IN FREEZER", tags: ["INSIDE", "COLD", "VENT"],
    look:
      "Around forty below and empty, except for a marine sitting against the back wall with the frost grown over "
      + "him, and a discarded medical case on the floor beside him. He is wearing a cap folded out of ration foil. "
      + "He shut himself in here and he did not do it to hide.",
    onFirstEnter: [{ say: "Your breath goes solid in front of your face. Whatever is wrong with this colony, it is not wrong in here.", tone: "system" }],
    exits: [
      { to: "pantry", label: "Back out → Pantry [4]", mins: 5 },
      { to: "ducts", label: "Ceiling vent → Ducting", mins: 10 },
    ],
    features: {
      resnick: {
        name: "The frozen marine",
        d: "LCPL RESNICK, by the tags. Both hands are closed around a plastic vacuum tumbler and have been for months. He is not holding it the way you hold a drink. He is holding it the way you hold a message.",
      },
      foil: {
        name: "The foil cap",
        d: "Hand-folded, several layers, done carefully. He had worked out that whatever was coming for the others arrived over the air. He was right about the mechanism and wrong about everything he could do with it.",
        gives: ["tinfoilhat"], setsFlag: "knows_airborne",
      },
      tumbler: {
        name: "The vacuum tumbler",
        d: "Frozen solid. What is in it is not a drink — it is hydrofluoric acid, decanted from a lab and put somewhere it would keep, in the hands of a man who then made sure he would be found holding it.",
        gives: ["tumbler"], setsFlag: "knows_acid", mins: 10,
        effects: [
          { say: "You have to take it out of his hands. Two of his fingers come away with it.", tone: "horror" },
          { save: "fear", onFail: [{ stress: 1, why: "his fingers snapped off" }] },
          { say: "▌ He worked out what kills them. This is the whole answer, and it cost him everything he had to leave it where you would look.", tone: "warden" },
        ],
      },
      medcase: {
        name: "Discarded medical case",
        d: "Cold-walled, and it hisses when you crack the seal. Inside: twenty-five litres of frozen chemotherapeutic agents, written up on the manifest for radiation exposure.",
        gives: ["chemo"], mins: 10,
      },
    },
  },

  habitat: {
    n: 6, name: "CREW HABITAT", tags: ["INSIDE", "DARK", "QUARTERS"],
    look:
      "The living block: showers, three sets of barracks, and two private cabins, strung off one spine of "
      + "corridor. Somebody has written COMMS OFF across the entrance hatch in paint, at a size meant to be "
      + "obeyed rather than read. The thud from the back of the base comes up through the deck here, steady, "
      + "and nobody has been in these rooms for months.",
    exits: [
      { to: "commissary", label: "Back → Commissary [3]", mins: 5 },
      { to: "armory", label: "Corridor → Armory [7]", mins: 5 },
      { to: "command", label: "Corridor → Command Center [9]", mins: 5 },
    ],
    features: {
      graffiti: {
        name: "COMMS OFF",
        d: "Painted across the hatch and then painted over the paint, twice, by different hands. The last coat is fresh enough to still smell.",
        setsFlag: "knows_comms_warning",
      },
      showers: { name: "A. Showers and heads", d: "Untouched, which is somehow worse. In the cistern of the second toilet, taped above the water line: a stimpak.", gives: ["stimpak"], deep: true, mins: 10 },
      enlisted: {
        name: "B. Enlisted barracks",
        d: "Twelve bunks turned over, posters, and the ambient smell of a room where twelve people lived hard. A thorough search turns up two frag grenades, a butterfly knife, eight packets of cigarettes, and a small journal under the fourth bunk.",
        deep: true, skills: ["Scavenging"], mins: 15, gives: ["fraggrenades", "boneknife", "journal"],
      },
      officers: {
        name: "C. Officers' barracks",
        d: "Five bunks, desks, and a duty roster still pinned up. Clipped to the roster is a Company list headed ESSENTIAL PERSONNEL. It has two entries: Dr Edem, and Hinton — logic core only.",
        setsFlag: "knows_essential",
        effects: [{ say: "Somebody on this base read that list months ago and understood exactly what it meant about the other seventeen names.", tone: "warden" }],
      },
      kaplan: {
        name: "D. 2ndLt Kaplan's cabin",
        d: "Tidy, in the way of somebody who kept one thing under control while everything else went. In the desk: a photograph of Kaplan with a partner and two small children, and a pre-landing planetary survey of Samsa VI.",
        gives: ["survey"], mins: 10,
      },
      drawer: {
        name: "Kaplan's cam-locked drawer",
        d: "Forced open, it holds a revolver with twelve rounds and the personal locator tracker issued to the colony's synthetic — still live, still holding a fix.",
        deep: true, skills: ["Scavenging"], mins: 15, gives: ["revolver", "tracker"],
      },
      research: {
        name: "E. Research barracks",
        d: "Five bunks, a games console, a marijuana plant somebody kept alive against the odds, a battered paperback, and a body pillow with an anime character on it. People lived here and were embarrassing and are now dead.",
      },
      edemroom: {
        name: "F. Dr Edem's cabin",
        d: "Weather charts pinned three deep, all of them showing the same front rolling in. On the desk, a birthday card addressed to Olsson, still sealed. Written on the flap, in Edem's hand: thanks for always listening — hopefully they'll let me leave after this one.",
        setsFlag: "knows_edem_olsson",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "the card is still sealed" }] }],
      },
    },
  },

  armory: {
    n: 7, name: "ARMORY", tags: ["INSIDE", "DARK"],
    look:
      "A hardened cage with the blast door torn off its mountings and thrown aside. Every locker stands open and "
      + "empty. In the middle of the floor is what appears to be a single mass of melted metal about the size of a "
      + "car, which was, until fairly recently, the colony's entire weapons stock.",
    exits: [{ to: "habitat", label: "Back → Crew Habitat [6]", mins: 5 }],
    features: {
      slag: {
        name: "The mass of metal",
        d: "Not melted. Bonded — every barrel, receiver and magazine in the colony fused into one another by something that went on afterwards and set hard.",
        deep: true, skills: ["Chemistry", "Xenobiology"], mins: 15,
        setsFlag: "knows_webbing",
        effects: [
          { say: "It is an adhesive, laid down wet and cured, and it has bonded the metal at a molecular level. Something did this deliberately and it did it first.", tone: "horror" },
          { stress: 1, why: "it disarmed them before it started" },
        ],
      },
      door: { name: "The blast door", d: "Industrial, rated against small-arms fire, and taken off its hinges from the outside." },
    },
  },

  medbay: {
    n: 8, name: "MEDBAY — OBSERVATION LAB", tags: ["INSIDE", "DARK", "VENT", "TERMINAL"],
    look:
      "The outer half of the medical section: a bank of powered-down terminals facing a glass wall, drifts of "
      + "loose paperwork, and a log book left open on the bench. Through the glass is the operating theatre, and "
      + "the operating theatre is a wreck.",
    exits: [
      { to: "command", label: "Corridor → Command Center [9]", mins: 5 },
      { to: "habitat", label: "Corridor → Crew Habitat [6]", mins: 5 },
      { to: "ducts", label: "Ceiling vent → Ducting", mins: 10 },
      {
        to: "theatre", label: "Sealed door → Operating Theatre", mins: 5,
        gate: {
          flag: "theatre_open",
          routes: [{ when: "has:edemcard", text: "The card is Edem's and the door knows it." },
            { when: "tag:cuts", time: 20, noise: "a cutting torch", text: "You take the lock out of the frame." }],
          roll: { label: "MEDICAL LOCK", stat: "intellect", skills: ["Hacking", "Computers"], tags: ["door", "electronic"], time: 20,
            passText: "You talk the lock into believing you are a doctor.",
            failText: "It is keyed to one badge on this colony and you are not carrying it." },
        },
      },
    ],
    features: {
      log: {
        name: "The log book",
        d: "The observation lab's running record. The last month of it is Dr Edem's, and it stops being a log somewhere around the point they name the thing they have found.",
        gives: ["logbook"], mins: 10,
      },
      paperwork: {
        name: "Loose paperwork",
        d: "Sequencing runs, mostly, annotated in two hands — one careful and one very fast. The fast one is doing the actual work and is never named on any page.",
        deep: true, skills: ["Xenobiology", "Computers"], mins: 15, setsFlag: "knows_hinton_work",
        effects: [{ say: "Whoever the second hand belongs to solved this months before the first hand understood it. They are not credited anywhere in the file.", tone: "warden" }],
      },
      glass: { name: "The glass wall", d: "Intact, and filmed on the theatre side with something that has dried in streaks." },
    },
  },

  theatre: {
    n: 8, name: "OPERATING THEATRE", tags: ["INSIDE", "DARK", "VENT"], onMap: false,
    look:
      "Everything in here has been either broken or glued. The medpod is open and ruined. The bio-printer beside "
      + "it has been fused to its own bench. Down the far wall, four containment tubes stand completely untouched, "
      + "each with a jointed thing curled inside it, and each one lit.",
    onFirstEnter: [{ save: "fear", why: "the tubes are lit and the rest of the room is dark", onFail: [{ stress: 1, why: "something kept the tubes running" }] }],
    exits: [
      { to: "medbay", label: "Back → Observation Lab", mins: 5 },
      { to: "ducts", label: "Vent behind the surgical bed → Ducting", mins: 10 },
    ],
    features: {
      medpod: { name: "Litkovich MedPod", d: "Smashed through the canopy. Repairable, given ten hours and a toolkit — it would put a Wound back into somebody per week spent inside." },
      printer: { name: "Sato T3 Bio-Printer", d: "Bonded to the bench by the same adhesive as the armory. The stem cell cartridges beside it are empty and were emptied properly, by someone who knew the machine." },
      lead: {
        name: "Lead container",
        d: "Shielded, heavy, and stencilled with a hazard class that means what it says. Hydrofluoric acid, four decent throws of it.",
        gives: ["acidcan"], setsFlag: "knows_acid",
      },
      tubes: {
        name: "Four containment tubes",
        d: "Larval carcinids, alive, and untouched by everything that happened in this room. Whatever came through here went out of its way not to damage them.",
        gives: ["larva"], setsFlag: "knows_specimens", mins: 15,
        effects: [{ say: "▌ These are the samples on your contract. They are also, though nobody has told you yet, a key.", tone: "warden" }],
      },
      bed: {
        name: "Upturned surgical bed",
        d: "And beside it on the tile, a metre of black jointed limb, severed cleanly, lying where it was dropped.",
      },
      limb: {
        name: "The severed limb",
        d: "Cold, heavy, and articulated. It thrashes the instant it is touched — hard, once, and then goes still again.",
        effects: [
          { save: "body", why: "it is still working", onFail: [{ damage: "1d10", why: "the limb came up off the tile" }, { stress: 1, why: "it is still working" }] },
          { give: ["carclimb"] },
        ],
      },
    },
  },

  command: {
    n: 9, name: "COMMAND CENTER", tags: ["INSIDE", "DARK", "TERMINAL"],
    devices: ["comms"],
    look:
      "The colony's nervous system, and the only room in the building the Company would have cared about. A "
      + "marine is slumped across the main console with a single entry wound through the temple. One hand still "
      + "holds a revolver. The other holds a sheet of paper. The comms stack behind them has been beaten apart.",
    onFirstEnter: [{ save: "fear", why: "how the officer chose to finish", onFail: [{ stress: 1, why: "he did it facing the door" }] }],
    exits: [
      { to: "commissary", label: "Corridor → Commissary [3]", mins: 5 },
      { to: "habitat", label: "Corridor → Crew Habitat [6]", mins: 5 },
      { to: "medbay", label: "Corridor → Medbay [8]", mins: 5 },
    ],
    features: {
      officer: {
        name: "The officer at the console",
        d: "2NDLT KAPLAN, by the tags — the commander you were sent here to rendezvous with. Five rounds still in the revolver. Fine incisions cover the hands, the throat, the face.",
        gives: ["revolver"], setsFlag: "knows_kaplan_dead",
        effects: [{ save: "sanity", onFail: [{ stress: 2, why: "he had five rounds left and used one" }] }],
      },
      paper: {
        name: "The sheet of paper",
        d: "The mission organisation chart, annotated to death in ballpoint. He was holding it when he decided.",
        gives: ["orgchart"],
      },
      stack: {
        name: "The communications stack",
        d: "Beaten in with something heavy and then, apparently, beaten some more. Repairable, but it is hours of work and not minutes.",
        device: "comms",
      },
    },
  },

  garage: {
    n: 10, name: "GARAGE AND UTILITIES", tags: ["INSIDE", "DARK", "VENT", "WATER"],
    look:
      "Muddy tracks converge on industrial roll-up doors, barricaded from the inside with stacked gym weights. "
      + "Within: an armoured personnel carrier on one side, and on the other a hole in the floor of the garage "
      + "some four metres across, going down. Standing in the water at the bottom of it, working, is the source "
      + "of the thud.",
    onFirstEnter: [
      { say: "It has its back to you. It is the size of a car, it is jointed in too many places, and it is digging — steadily, without pause, the way a machine digs.", tone: "horror" },
      { save: "fear", why: "you have found what has been making the noise", onFail: [{ stress: 2, why: "the size of it" }] },
      { threat: { id: "abara", loc: "garage" } },
      { say: "▌ It has not noticed you. That is a resource and it is spending itself.", tone: "warden" },
    ],
    exits: [
      { to: "lz", label: "Out the roll-up doors → Landing Zone [1]", mins: 10 },
      { to: "apc", label: "Climb into the APC", mins: 5 },
      { to: "ducts", label: "Vent behind the tool bench → Ducting", mins: 10 },
    ],
    features: {
      mud: {
        name: "Piles of mud outside",
        d: "Not mud. A body in fatigues, face down, worked into the ground by the rain until it stopped being a shape anyone would look at twice. Tags: PFC OLSSON. It was his birthday.",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "it was his birthday" }] }],
      },
      hole: {
        name: "The dirt hole",
        d: "Four metres across, going down at an angle, standing in half a metre of water. The digging is methodical and it has been going on for a very long time.",
      },
      digger: {
        name: "The thing in the hole",
        d: "Tags hang from a hook of shell where the vest strap has fused into it: SGT ABARA. Across the front of it, still buckled, is a squad leader's bandolier with five frag grenades in the loops.",
        setsFlag: "seen_bandolier",
      },
      powerline: {
        name: "Fallen power line",
        d: "Come down out of the ceiling and lying across the lip of the hole, a metre from the water. Dead, currently, along with everything else in this building.",
        setsFlag: "seen_powerline",
      },
      bench: {
        name: "Tool bench",
        d: "Assorted tools, a crowbar, a flashlight, a patch kit, a hand welder, and a nail gun with a box of a thousand shots.",
        gives: ["crowbar", "flashlight", "handwelder", "nailgun", "toolkit"], mins: 10,
      },
      fuel: { name: "Six barrels of fuel", d: "For the backup generator. Full, and sitting where a stray round would find them." },
      generator: {
        name: "Backup generator",
        d: "Offline. It would take a few minutes to bring back, and it would put power through every circuit in the building — including whatever is currently lying on the floor.",
        device: "generator",
      },
    },
  },

  apc: {
    n: 10, name: "INSIDE THE APC", tags: ["INSIDE", "DARK"], onMap: false,
    look:
      "The cab is dry and smells of somebody who has been in here for weeks. The controls are live and in working "
      + "order. The navigation set is showing a route west to the terraforming station. And sitting in the "
      + "footwell, in a foil cap, hugging his knees, is a man holding a frag grenade with the pin already out.",
    onFirstEnter: [
      { save: "fear", why: "the pin is out", onFail: [{ stress: 2, why: "you can see the lever under his thumb" }] },
      { say: "▌ He is not threatening anybody. He has forgotten he is holding it. Startle him and he will remember.", tone: "warden" },
      { npc: { id: "demar", loc: "apc" } },
    ],
    exits: [{ to: "garage", label: "Get back out → Garage [10]", mins: 5 }],
    features: {
      nav: {
        name: "The navigation set",
        d: "A plotted route west, twenty minutes' drive, ending at the Heron Terraforming Station. Somebody laid it in months ago and never drove it.",
        setsFlag: "knows_heron",
      },
      controls: {
        name: "The controls",
        d: "Fuelled, charged, and willing. Whoever parked it did so properly, which given everything else in this colony is remarkable.",
        setsFlag: "apc",
        effects: [{ say: "You have a vehicle. On this planet, in this weather, that is the difference between an hour and twenty minutes, and between four hours and forty-five.", tone: "good" }],
      },
      dose: {
        name: "Dose Demar", when: "npc:demar and has:cytotoxin",
        d: "He is Stage 3 and he does not want to be anywhere else. He will not resist and he will not consent, and there is no version of this where somebody is not deciding for him.",
        mins: 15, effects: [{ run: "doseDemar" }],
      },
      grenade: {
        name: "The grenade",
        d: "An M-series frag, lever held down by a thumb that has not moved in some time. Taking it out of his hand is a question of persuading him, or of being very fast, or of accepting what happens.",
        effects: [{ run: "takeGrenade" }],
      },
    },
  },

  ducts: {
    n: 0, name: "THE DUCTING", tags: ["VENT", "CRAWLSPACE", "DARK"], onMap: false,
    look:
      "Service ducting, wide enough to crawl and not much more, carrying the whole building's smell at once: rain, "
      + "cold storage, antiseptic, diesel. Sections of it have been forced from the inside and re-formed, and the "
      + "dust on the floor of the run has been swept flat by something dragging its own weight through repeatedly.",
    exits: [
      { to: "freezer", label: "Drop into the Freezer [5]", mins: 10 },
      { to: "medbay", label: "Drop into the Observation Lab [8]", mins: 10 },
      { to: "theatre", label: "Drop into the Operating Theatre", mins: 10, hidden: "theatre_open" },
      { to: "garage", label: "Drop into the Garage [10]", mins: 10 },
    ],
    features: {
      sweep: {
        name: "The swept dust",
        d: "No handprints. No boot prints. Only the wide, patient sweep of a body going everywhere in this building that a body was not supposed to be able to go.",
      },
      cache: {
        name: "Search the run",
        d: "Wedged behind a bracket where somebody hid it from somebody else: a vial of laboratory hydrofluoric acid, and a note that says nothing except a room number.",
        deep: true, skills: ["Scavenging"], mins: 15, gives: ["acidvial"], setsFlag: "knows_acid",
      },
    },
  },
};
