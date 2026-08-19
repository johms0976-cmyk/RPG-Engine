/* ============================================================
   YPSILON 14 — THE BASE

   Eleven locations. Four of them share a vent system a person can
   crawl through and something larger uses as a corridor. Four of
   them are vacuum, and suit air is a clock.

   Every consequence here is data. The engine reads `effects`.
   ============================================================ */

/* Touching the goo has to be tempting, or nobody will ever be
   caught by it. It closes your wounds. It makes you strong. It
   is also, quietly, the end of you. */
const GOO_TOUCH = {
  id: "goo", label: "Put a hand into the yellow goo", kind: "accent",
  when: "!condition:INFECTED",
  effects: [
    { say: "You put a hand into it. It is warm, and it is much more interested in you than you are in it.", tone: "you" },
    { time: 5 },
    {
      save: "body", why: "contact with the goo",
      onPass: [{ say: "It slides off your glove and back down the wall like it was never interested.", tone: "good" }],
      onFail: [
        { stress: 1, why: "contact" },
        { say: "It goes through the glove. It doesn't burn. It's warm, and then it isn't there, and your hand feels better than it has in years.", tone: "horror" },
        { track: "infection" },
      ],
    },
  ],
};

/* Fire and cold both work on it. This is the play that stops the
   thing healing, and it should be findable. */
const GOO_BURN = {
  id: "burngoo", label: "Burn the goo out", kind: "danger",
  when: "tag:burns and !flag:pod_dead",
  effects: [{ run: "burnGoo" }],
};

export const rooms = {
  db2: {
    n: 1, name: "DOCKING BAY 2", tags: ["AIRLOCK"],
    look:
      "Your ship is clamped to the collar behind you, still ticking as it cools. The bay is cold and mostly empty — " +
      "cargo netting, a stack of ore crates strapped to the deck, rock dust and machine oil. Six pallets are staged " +
      "under the light by the inner lock, shrink-wrapped and stencilled GRETA BASE / SAMSA IV. The inner airlock " +
      "cycles open onto the base proper.",
    exits: [
      { to: "work", label: "Airlock → Workspace [2]", mins: 5 },
      {
        to: "@followed", label: "Board your ship and leave", mins: 5,
        confirm: "Your ship is warm and waiting. Leaving now ends the job, whatever state it is in. Choose it again to undock.",
        effects: [{ run: "leaving" }],
      },
    ],
    features: {
      pallets: {
        name: "The six pallets",
        d: "Consumables and medical stock, consigned to Greta Base on Samsa IV. The manifest is taped to the first one, waiting for a countersignature.",
        gives: ["manifest"],
      },
      crates: {
        name: "Ore crates",
        d: "Sealed, stencilled, and lighter than they should be. Whatever the pickup schedule says, nobody has filled these in a while.",
      },
      collar: {
        name: "Docking collar",
        d: "The seal is good. The manual release is behind a smashed cover — somebody broke it once and then repaired it badly, in a hurry, at some point in the last month.",
      },
    },
    actions: [
      {
        id: "load", label: "Load a pallet aboard", kind: "solid",
        when: "!flag:cargo_done",
        effects: [{ run: "loadPallet" }],
      },
    ],
  },

  work: {
    n: 2, name: "WORKSPACE", tags: ["VENT", "TERMINAL", "MEDBAY"],
    devices: ["terminal"],
    look:
      "Work boots clang and echo. Heavy, well-used gear stowed in cubbies — overalls, flashlights, short-range radios, " +
      "handheld mining tools. Nine vaccsuits hang on ten wall hooks. A massive generator idles in one corner beside an " +
      "industrial vent, next to a terminal quietly bleeding lines of data. Opposite, white plastic sheeting and sterile " +
      "lighting mark out a semi-permanent medbay. The floor opens on a yawning pit — a mechanised drill and pump " +
      "assembly punching down into the dark of the mine shaft.",
    exits: [
      { to: "db2", label: "Airlock → Docking Bay 2 [1]", mins: 5 },
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      {
        to: "entrance", label: "Freight elevator → Mine Entrance [6]", mins: 10,
        needs: "tag:vacc", needsHint: "vaccsuit required",
        needsText: "Beyond this point there is no atmosphere and you are not wearing a suit. Nine of them hang on hooks here.",
      },
      {
        to: "db1", label: "Airlock → Docking Bay 1 [10]", mins: 5,
        gate: {
          flag: "db1_open",
          routes: [
            { when: "flag:knows_code", text: "You key 0389 into the pad. The bolts withdraw. The Heracles lets you in." },
            {
              when: "tag:cuts", time: 20, noise: "twenty minutes of cutting tool against a pressure door",
              text: "You cut the lock out of the door. It takes a long time and it is not quiet.",
            },
          ],
          roll: {
            label: "KEYPAD", stat: "intellect", skills: ["Computers", "Hacking"], time: 15,
            tags: ["door", "electronic"],
            bonusIf: [{ when: "has:lockpicks", bonus: 10 }],
            passText: "Four digits, third attempt. The bolts withdraw.",
            failText: "The pad locks you out for a while and logs the attempt.",
          },
        },
      },
      { to: "vents", label: "Climb into the industrial vent", mins: 5 },
    ],
    features: {
      cubbies: {
        name: "Cubbies",
        d: "Overalls stiff with rock dust, flashlights, short-range radios, and foam cutouts for ten handheld mining tools. One cutout is empty for a different reason than the others: a laser cutter is missing.",
        gives: ["flashlight", "radio"],
      },
      hooks: { name: "Vaccsuit hooks", d: "Ten hooks. Nine suits. The tenth tag reads M. VOSS.", gives: ["vaccsuit", "o2tank"] },
      terminal: {
        name: "Workspace computer terminal",
        d: "Base operations. Showers on and off. Airlock locks. Pump and drill control. Docking authorisation. And, greyed out behind a keycard prompt, the self-destruct sequence.",
        device: "terminal",
      },
      schedule: {
        name: "Pickup schedule",
        d: "The research vessel Heracles docked in Bay 1 thirty-four days ago. Your ship is listed as a recent arrival with a four-hour turnaround. The next cargo run after you is in a fortnight.",
      },
      generator: { name: "Generator", d: "Enormous, patient, warm. The industrial vent beside it is wide enough to climb into, and something has." },
      medbay: {
        name: "Medbay",
        d: "White plastic and sterile light. The most basic supplies only — bandages, sealant, a hand scanner, a tap. Nobody has restocked it in a month.",
        effects: [{ heal: "1d10" }],
      },
      pit: {
        name: "The pit and the pump assembly",
        d: "The drill and slurry pump go straight down into the shaft. The freight elevator carries miners to the mine entrance and back — ten creaking minutes each way. The pump can be run in either direction from the terminal, which is a thing worth remembering.",
      },
    },
  },

  quarters: {
    n: 3, name: "QUARTERS", tags: ["VENT", "QUARTERS"],
    look:
      "Ten small rooms off a narrow spine of corridor. Simple bunks, personal clutter, and the particular smell of " +
      "people living too close together for too long. The ceiling tiles are the cheap kind — they lift out with a fingernail.",
    exits: [
      { to: "work", label: "Corridor → Workspace [2]", mins: 5 },
      { to: "mess", label: "Corridor → Mess [4]", mins: 5 },
      { to: "wash", label: "Corridor → Washrooms [5]", mins: 5 },
      { to: "vents", label: "Lift a ceiling tile into the crawlspace", mins: 5 },
    ],
    features: {
      tiles: { name: "Ceiling tiles", d: "They lift out easily. Above is a crawlspace of wiring and pipe runs, with access to the vents. The dust up there has been disturbed in long, wide sweeps." },
      b1: { name: "1 — Sonya's bunk", d: "A lanyard on a wall hook with a keycard on it. A boombox and a stack of cassettes she sometimes brings into the workspace.", gives: ["keycard", "boombox", "tape1"] },
      b2: { name: "2 — Ashraf's bunk", d: "Cheap plastic gachapon toys lined up by size. A small potted cactus. A set of dice, still in the shrink wrap." },
      b3: { name: "3 — Dana's bunk", d: "Small corner, immaculate. A religious symbol on the wall, and a family photo turned face-down." },
      b4: { name: "4 — Jerome's bunk", d: "A cute bedspread, incongruous. Under the pillow: a handgun with a full clip and a box of loose rounds.", gives: ["handgun", "ammo"] },
      b5: { name: "5 — Kantaro's bunk", d: "Dana's clothes mixed in with Kantaro's laundry. Discarded tissues beside the bed, stained with something thick and yellow that has not dried and is not still.", gives: ["gootissue"] },
      b6: { name: "6 — Morgan's bunk", d: "A cache of snacks badly hidden behind a ceiling tile, a Stimpak, and a bag of cat treats.", gives: ["stimpak", "cattreats"] },
      b7: { name: "7 — Rie's bunk", d: "Narcotics, supplied by an obliging cargo captain. Rie will share if you're interested — there's more behind the ceiling tiles.", gives: ["painpills"] },
      b8: { name: "8 — Rosa's bunk", d: "Pin-up posters, a musky smell, and a hardbacked notebook full of dated entries in a very clear hand. Nothing is hidden. Rosa doesn't hide things." },
      b9: {
        name: "9 — Mike's old bunk", deep: true, skills: ["Scavenging"],
        d: "Cleaned out. A thorough search turns up a cache behind a ceiling tile: an empty squirt bottle used for misting the plants, a revolver, and a handful of rounds.",
        gives: ["squirtbottle", "revolver", "ammo"],
      },
      b10: { name: "10 — Unused", d: "Unused for a long time. The bed is more of a couch now. A games console, and a small portable cassette player-recorder.", gives: ["recorder"] },
    },
  },

  mess: {
    n: 4, name: "MESS", tags: ["VENT", "GALLEY", "WATER"],
    look:
      "The communal eating area. An automated kitchen unit, restocked by the cargo ships each month, hums against one " +
      "wall beside a water tap. Someone has made a cardboard box into a bed; beside it, food and water bowls. A " +
      "hydroponic garden runs along the far wall, plumbed into the vents.",
    exits: [
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      { to: "vents", label: "Climb into the garden's vent duct", mins: 5 },
    ],
    onFirstEnter: [{
      when: "npc:prince",
      then: [{ say: "Prince is on top of the kitchen unit, absolutely still, watching a corner of the room where there is nothing.", tone: "horror" }],
    }],
    features: {
      kitchen: { name: "Automated kitchen unit", d: "Something hot in ninety seconds, and it does not care how you are feeling. There is water on tap." },
      catbox: { name: "Cardboard box", d: "Prince's bed, shredded at one corner. The food bowl is full. The water bowl has been drunk down to nothing." },
      table: { name: "The table", d: "A cassette from Sonya's collection has been left out — blue, a scratched handwritten label.", gives: ["tape1"] },
      garden: { name: "Hydroponic garden", d: "Salad greens under grow lamps, plumbed straight into the vents. The plants are visibly wilting. Nobody has misted them in days.", gives: ["jerrycan"] },
      rota: { name: "The rota", d: "A chore rota pinned to the wall. One crew member has the garden each month. Mike is the last name on the list, and nobody has written the next one." },
    },
    actions: [
      {
        id: "pet", label: "Pet the cat", when: "here:prince",
        effects: [{ run: "petCat" }],
      },
    ],
  },

  wash: {
    n: 5, name: "WASHROOMS", tags: ["VENT", "WATER"],
    look: "Showers and toilets in a row of cubicles. The tile is cold. Everything drips. One shower is roped off with tape.",
    exits: [
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      { to: "vents", label: "Pull down the ceiling extractor and climb up", mins: 5 },
    ],
    features: {
      showers: { name: "Showers", d: "They run hot and hard, and base operations can turn them on and off from the workspace terminal. When they run, water stands on the floor for an hour afterwards." },
      broken: {
        name: "The broken shower",
        d: "Out of order. According to the others, Mike broke it accidentally the night before last. The fittings are not broken so much as torn off the wall, and the water line behind them has been pulled out to the elbow.",
        effects: [{ flag: "saw_broken" }],
      },
      extractor: {
        name: "Ceiling extractor",
        d: "A large, clunky unit that filters steam out into the vents. It looks like it could be pulled down easily. It is heavy with condensate and it slops when you move it.",
        gives: ["extractor"],
      },
    },
  },

  entrance: {
    n: 6, name: "MINE ENTRANCE", tags: ["VACUUM", "MINE"],
    look:
      "The elevator grinds to a stop. The pressure door behind you is the last one that holds. Automated drills work " +
      "the rock from within, chewing metal out and pumping it up to be sorted in the workspace above. The noise is " +
      "enormous and completely silent through your helmet, felt through the soles of your boots.",
    exits: [
      { to: "work", label: "Freight elevator → Workspace [2]", mins: 10 },
      { to: "tunnel", label: "Down the shaft → Mine Tunnel [7]", mins: 10 },
      { to: "ante", label: "Airlock → Mine Antechamber [9]", mins: 10, hidden: "ante_found" },
    ],
    features: {
      drills: { name: "Automated drills", d: "Blind machines doing patient violence to the rock. Their scheduled cycles have not been adjusted since the last shift Mike logged." },
      pumps: { name: "Pump housing", d: "Slurry and ore go up. Something has scraped a long, wide groove through the dust beside the housing, heading down-shaft, and nothing with feet made it." },
    },
  },

  tunnel: {
    n: 7, name: "MINE TUNNEL", tags: ["VACUUM", "MINE", "DARK"],
    look:
      "The shaft narrows. Thin veins of ore thread the black rock, mostly excavated already, leaving the walls " +
      "scalloped and strange. Further down, the tunnel gives up on light entirely and continues into the depths.",
    exits: [
      { to: "entrance", label: "Up the shaft → Mine Entrance [6]", mins: 10 },
      { to: "depths", label: "Deeper → Mine Depths [8]", mins: 10 },
      { to: "ante", label: "Squeeze through the crack → Mine Antechamber [9]", mins: 10, hidden: "ante_found" },
    ],
    features: {
      veins: { name: "Thin veins of ore", d: "Worked out. Whoever mined this section did it carefully, and a long time ago." },
      walls: {
        name: "The wall", deep: true, skills: ["Asteroid Mining", "Geology"],
        d: "Time spent searching, with enough light, finds it: a crack large enough for a person to squeeze through. It opens into something that was never dug.",
        setsFlag: "ante_found",
      },
      /* ============================================================
         SILENCE, ONE ROOM EARLIER.

         The word carved into the rock is the module's thesis, and
         it was at the bottom of the deepest optional room on the
         map — past a ten-minute descent, in vacuum, on suit air,
         behind a thorough search. Most tables never saw it, which
         means most tables never got the one instruction the module
         is actually giving them.

         This does not move it. The carving stays where Mike made
         it. What is here is the *reflection* of it: the tunnel
         curves, and the light from a lamp catches the letters two
         hundred metres further down, backwards and upside down in
         a wet patch of the wall. You cannot read it from here. You
         can tell that somebody wrote something very large, in a
         place nobody was ever supposed to be, and that is the
         hook — it makes going deeper a decision rather than a
         completionist sweep.
         ============================================================ */
      scorch: {
        name: "Scorch marks on the rock", mins: 5,
        d:
          "Low on the wall, where the tunnel bends, the black rock has been burned pale in a long stripe — the " +
          "backscatter of a cutting laser used at full power somewhere further down. It is fresh enough to still " +
          "smell faintly of hot stone. Whoever did it was not cutting ore: there is no ore in this section, and " +
          "they were working at head height on a flat face.",
        effects: [
          { flag: "saw_scorch" },
          { say: "Somebody came down here in the last two days with a mining laser and wrote on the wall.", tone: "warden" },
        ],
      },
    },
  },

  depths: {
    n: 8, name: "MINE DEPTHS", tags: ["VACUUM", "MINE", "DARK"],
    look:
      "Your lamps make a small room out of a very large dark. A splash of yellow — thick, slow, and wrong — has run " +
      "down the natural cave wall and pooled. An empty vaccsuit lies slumped nearby, as though the person inside " +
      "simply stopped being there. Scorched into the rock in letters half a metre tall is the word SILENCE.",
    exits: [{ to: "tunnel", label: "Up → Mine Tunnel [7]", mins: 10 }],
    features: {
      goo: { name: "The yellow splash", d: "It moves. Not quickly — the way something moves when it is repairing itself and has all the time it needs." },
      suit: {
        name: "Empty vaccsuit",
        d: "No blood. No body. No damage to the suit at all — the seals are intact and the helmet is still latched. The nameplate has been scraped off, but the fit is a big man's. The internal log ends mid-shift, and the last forty seconds of audio are a man breathing very fast and not screaming.",
        effects: [{ flag: "saw_suit" }, { save: "sanity", why: "the seals are intact", onFail: [{ stress: 1, why: "the seals are intact" }] }],
      },
      silence: {
        name: "SILENCE",
        d: "Cut into the rock with a handheld laser cutter, at a height a person would have to reach up to. The tool lies discarded a few metres away, still faintly warm. Whoever wrote it was not warning the rock.",
        gives: ["minelaser"], setsFlag: "knows_sound",
      },
    },
    actions: [GOO_TOUCH, GOO_BURN],
  },

  ante: {
    n: 9, name: "MINE ANTECHAMBER", tags: ["VACUUM", "MINE", "THE POD"],
    look:
      "Natural, smooth black rock forms a cavern of arches and whorls — a shape that was made, not mined. Set into " +
      "the wall, split by a long vertical gash, is an empty fleshy pod leaking embryonic pus. The yellow goo is " +
      "thickest here, in the chamber where it originates. A small workstation of scientific equipment stands nearby, " +
      "incongruously neat.",
    exits: [
      { to: "tunnel", label: "Back through the crack → Mine Tunnel [7]", mins: 10 },
      { to: "entrance", label: "Airlock → Mine Entrance [6]", mins: 10 },
    ],
    features: {
      pod: {
        name: "The pod",
        d: "Empty. Fleshy. Warm, in a chamber that is not. It held something in stasis for a voyage between stars, and the drills broke the seal. Whatever was inside has been awake for about three weeks.",
        effects: [{ flag: "saw_pod" }, { save: "sanity", why: "you understood what you were looking at", onFail: [{ stress: 1, why: "you understood what you were looking at" }] }],
      },
      goo2: { name: "The yellow goo", d: "Thick here, running down the walls in slow sheets and draining back into the pod. This is where it comes from, and where it goes back to, and what it is for." },
      workstation: { name: "Workstation", d: "Scientific equipment, carefully set up and carefully abandoned. A scanner relays readings continuously to the Heracles in Docking Bay 1." },
      paper: { name: "Scrap of paper", d: "On the desk, in pencil, in a very tidy hand: 0389.", gives: ["scrappaper"], setsFlag: "knows_code" },
    },
    actions: [GOO_TOUCH, GOO_BURN],
  },

  db1: {
    n: 10, name: "DOCKING BAY 1 — THE HERACLES", tags: ["AIRLOCK", "KEYPAD"],
    look:
      "The research vessel Heracles has been docked here for five weeks. Inside it is sleek, white, and clean, with " +
      "all the usual amenities. The washroom has been violently destroyed — fittings torn out, mirror shattered, deep " +
      "pry-marks from a crowbar. Everything else is untouched.",
    exits: [{ to: "work", label: "Airlock → Workspace [2]", mins: 5 }],
    features: {
      washroom: {
        name: "The destroyed washroom",
        d: "Taps, shower head, and the water lines behind them, ripped out of the wall with a crowbar and then bent, so they could not be reconnected. Somebody did not want the room gone. Somebody wanted the water gone.",
        effects: [
          { flag: "knows_water" },
          { save: "sanity", why: "you understood what you were looking at", onFail: [{ stress: 1, why: "you understood what you were looking at" }] },
        ],
      },
      lab: { name: "Science lab", d: "Small and tidy. A cassette recorder sits on the bench for taking notes, with a labelled white cassette still in it.", gives: ["tape3", "recorder"] },
      microscope: {
        name: "Microscope",
        d: "A specimen of the yellow goo is mounted on the stage, prepared properly, waiting for someone to come back and look at it.",
        gives: ["gooslide"],
        effects: [{ run: "examineGoo" }],
      },
      case: {
        name: "Sealed sample case",
        d: "Lead-lined, Company-sealed, keyed to a thumb. It is warm to the touch, and the seal log says it was last opened six days ago. Whatever the Company sent him here to do is written on the inside of the lid.",
        gives: ["giovannicase"], setsFlag: "knows_company",
      },
      giovanni: {
        name: "Dr Giovanni",
        d: "He is standing at the far end of the lab. Silent. Smiling.",
        when: "!dead:giovanni",
        effects: [{ run: "giovanniEncounter" }],
      },
    },
  },

  vents: {
    n: 0, name: "THE VENTS", tags: ["VENT", "CRAWLSPACE", "DARK"], onMap: false,
    devices: ["terminal"],
    look:
      "Cramped ducting, warm in places and freezing in others, carrying the smell of the whole base at once: " +
      "hydroponic damp, hot metal, soap, somebody's cigarettes. From in here you can reach any vented compartment. " +
      "The dust on the duct floor has been disturbed in long, wide sweeps, and none of them are handprints.",
    exits: [
      { to: "work", label: "Drop into Workspace [2]", mins: 10 },
      { to: "quarters", label: "Drop into Quarters [3]", mins: 10 },
      { to: "mess", label: "Drop into Mess [4]", mins: 10 },
      { to: "wash", label: "Drop into Washrooms [5]", mins: 10 },
    ],
    features: {
      dust: { name: "Disturbed dust", d: "Something the size of a person, or larger, moves through here regularly. There are no handprints and no footprints — only the sweep of a body dragging itself, going everywhere, going back over its own tracks." },
      tape: { name: "Discarded cassette", d: "A yellow cassette, unmarked, thrown into the ducting the way you throw away something you cannot bear to hear again.", gives: ["tape2"] },
      panel: { name: "Emergency control panel", d: "Set into the duct wall — a full-function twin of the workspace terminal, put here for the day the workspace could not be reached.", device: "terminal" },
    },
  },
};

/* Hand-drawn map. Delete this and defineModule lays one out automatically. */
export const map = {
  width: 360, height: 302, BW: 104, BH: 46,
  pos: {
    db1: [8, 14], db2: [128, 14], mess: [248, 14],
    work: [128, 76], quarters: [248, 76],
    entrance: [128, 138], wash: [248, 138],
    tunnel: [128, 200], depths: [8, 200], ante: [248, 200],
  },
  links: [
    { p: "M180,60 V76", kind: "airlock" },
    { p: "M60,60 V99 H128", kind: "locked" },
    { p: "M232,99 H248", kind: "hall" },
    { p: "M300,60 V76", kind: "hall" },
    { p: "M300,122 V138", kind: "hall" },
    { p: "M180,122 V138", kind: "shaft" },
    { p: "M180,184 V200", kind: "hall" },
    { p: "M128,223 H112", kind: "hall" },
    { p: "M232,223 H248", kind: "crack" },
    { p: "M300,200 V161 H232", kind: "airlock" },
  ],
  extras: [{ room: "vents", x: 8, y: 266, w: 344, h: 30, label: "THE VENTS", note: "CRAWLSPACE — REACHABLE FROM 2 · 3 · 4 · 5" }],
};
