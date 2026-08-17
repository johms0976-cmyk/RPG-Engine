/* ============================================================
   YPSILON 14 — THE BASE
   Every consequence here is data. The engine reads `effects`.
   ============================================================ */

const GOO_TOUCH = {
  id: "goo",
  label: "Touch the yellow goo",
  kind: "accent",
  when: "!condition:INFECTED",
  effects: [
    { say: "You put a hand into it.", tone: "you" },
    { time: 5 },
    {
      save: "body",
      onPass: [{ say: "It slides off your glove and back down the wall like it was never interested.", tone: "good" }],
      onFail: [
        { stress: 1, why: "contact" },
        { say: "It goes through the glove. It doesn't burn. It's warm, and then it isn't there, and your hand feels better than it has in years.", tone: "horror" },
        { track: "infection" },
      ],
    },
  ],
};

export const rooms = {
  db2: {
    n: 1, name: "DOCKING BAY 2", tags: ["AIRLOCK"],
    look: "Your ship is clamped to the collar behind you, still ticking as it cools. The bay is cold and mostly empty — cargo netting, a stack of ore crates strapped to the deck, a smell of rock dust and machine oil. The inner airlock cycles open onto the base proper.",
    exits: [
      { to: "work", label: "Airlock → Workspace [2]", mins: 5 },
      {
        to: "@followed", label: "Board your ship and leave", mins: 5,
        confirm: "Your ship is warm and waiting. Leaving now ends the job. Choose it again to undock.",
        effects: [
          { when: "slain:it", then: [{ end: "win" }] },
          { when: "flag:destruct_armed", then: [{ end: "escape" }] },
        ],
      },
    ],
    features: {
      crates: { name: "Ore crates", d: "Sealed, stencilled, and lighter than they should be. Whatever the pickup schedule says, nobody has filled these in a while." },
      collar: { name: "Docking collar", d: "The seal is good. The manual release is behind a smashed cover — somebody has already broken it once and then repaired it badly." },
    },
  },

  work: {
    n: 2, name: "WORKSPACE", tags: ["VENT", "TERMINAL", "MEDBAY"],
    look: "Work boots clang and echo. Heavy, sturdy, well-used gear stowed in cubbies — overalls, flashlights, short-range radios, handheld mining tools. Nine vaccsuits hang on ten wall hooks. A massive generator idles in one corner beside an industrial vent, next to a terminal quietly bleeding lines of data. In the opposite corner, white plastic sheeting and sterile lighting mark out a semi-permanent medbay. The floor opens on a yawning pit — a mechanised drill and pump system punching down into the dark of the mine shaft.",
    exits: [
      { to: "db2", label: "Airlock → Docking Bay 2 [1]", mins: 5 },
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      {
        to: "entrance", label: "Freight elevator → Mine Entrance [6]", mins: 10,
        needs: "tag:vacc", needsHint: "vaccsuit required",
        needsText: "Beyond this point there is no atmosphere. You need a vaccsuit, and you are not wearing one. Nine of them hang on hooks here in the Workspace.",
      },
      {
        to: "db1", label: "Airlock → Docking Bay 1 [10]", mins: 5,
        gate: {
          flag: "db1_open",
          routes: [
            { when: "flag:knows_code", text: "You key 0389 into the pad. The bolts withdraw. The Heracles lets you in." },
            { when: "tag:cuts", time: 20, noise: "twenty minutes of cutting tool against a pressure door", text: "You cut the lock out of the door. It takes a long time and it is not quiet." },
          ],
          roll: {
            label: "KEYPAD", stat: "intellect", skills: ["Computers", "Hacking"], time: 15,
            bonusIf: [{ when: "has:lockpicks", bonus: 10 }],
            passText: "four digits, third attempt", failText: "the pad locks you out for a while",
          },
        },
      },
      { to: "vents", label: "Climb into the industrial vent", mins: 5 },
    ],
    features: {
      cubbies: { name: "Cubbies", d: "Overalls stiff with rock dust, flashlights, short-range radios, ten handheld mining tools' worth of empty foam cutouts — and one cutout that is empty for a different reason. A handheld laser cutter is missing." },
      hooks: { name: "Vaccsuit hooks", d: "Ten hooks. Nine suits. The tenth tag reads M. VOSS.", gives: ["vaccsuit"] },
      terminal: { name: "Workspace computer terminal", d: "Base operations. Showers on and off. Airlock locks. Docking authorisation. And, greyed out behind a keycard prompt, the self-destruct sequence.", device: "terminal" },
      schedule: { name: "Pickup schedule", d: "The research ship Heracles docked in Bay 1 nearly five weeks ago. Your ship is listed as a recent arrival. The next cargo run is due in a fortnight." },
      generator: { name: "Generator", d: "Enormous, patient, warm. The industrial vent beside it is wide enough to climb into." },
      medbay: { name: "Medbay", d: "White plastic and sterile light. The most basic supplies only — bandages, sealant, a hand scanner. Nobody has restocked it in a month.", effects: [{ heal: "1d10" }] },
      pit: { name: "The pit", d: "The drill assembly and pump go straight down into the shaft. The freight elevator carries miners to the mine entrance. Ten creaking minutes each way." },
    },
  },

  quarters: {
    n: 3, name: "QUARTERS", tags: ["VENT", "BUNKS"],
    look: "Ten small individual rooms off a narrow spine of corridor. Simple bunks, personal clutter, the particular smell of people living too close together for too long. The ceiling tiles are the cheap kind — they lift out with a fingernail.",
    exits: [
      { to: "work", label: "Corridor → Workspace [2]", mins: 5 },
      { to: "mess", label: "Corridor → Mess [4]", mins: 5 },
      { to: "wash", label: "Corridor → Washrooms [5]", mins: 5 },
      { to: "vents", label: "Lift a ceiling tile into the crawlspace", mins: 5 },
    ],
    features: {
      tiles: { name: "Ceiling tiles", d: "They lift out easily. Above is a crawlspace full of wiring and pipe runs, with access to the vents." },
      b1: { name: "1 — Sonya's bunk", d: "A lanyard hangs on a wall hook with a KEY CARD on it. There's a boombox and a stack of cassettes she sometimes brings into the workspace.", gives: ["keycard", "boombox", "tape1"] },
      b2: { name: "2 — Ashraf's bunk", d: "Cheap plastic gachapon toys lined up by size. A small potted cactus. A set of dice." },
      b3: { name: "3 — Dana's bunk", d: "Small corner, immaculate. A religious symbol on the wall and a family photo turned face-down." },
      b4: { name: "4 — Jerome's bunk", d: "A cute bedspread, incongruous. Under the pillow: a handgun with a full clip.", gives: ["handgun"] },
      b5: { name: "5 — Kantaro's bunk", d: "Dana's clothes mixed in with Kantaro's laundry. Discarded tissues beside the bed, stained with something thick and yellow that has not dried.", gives: ["gootissue"] },
      b6: { name: "6 — Morgan's bunk", d: "A cache of snacks hidden badly behind a ceiling tile, along with a Stimpak.", gives: ["stimpak"] },
      b7: { name: "7 — Rie's bunk", d: "Narcotics, supplied by an obliging cargo ship captain. Rie will share if you're interested — there's more behind the ceiling tiles." },
      b8: { name: "8 — Rosa's bunk", d: "Pin-up posters and a musky smell. Nothing hidden. Rosa doesn't hide things." },
      b9: { name: "9 — Mike's old bunk", d: "Cleaned out. A thorough search finds a cache behind a ceiling tile: an empty squirt bottle used for misting the plants, a revolver, and some ammunition.", gives: ["squirtbottle", "revolver", "ammo"], deep: true },
      b10: { name: "10 — Unused", d: "Unused for a long time. The bed is more of a couch now. A games console, and a small portable cassette player-recorder.", gives: ["recorder"] },
    },
  },

  mess: {
    n: 4, name: "MESS", tags: ["VENT", "GALLEY"],
    look: "The communal eating area. An automated kitchen unit restocked by the cargo ships each month hums against one wall. Someone has made a cardboard box into a bed. Beside it, food and water bowls. A hydroponic garden runs along the far wall, plumbed into the vents.",
    exits: [
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      { to: "vents", label: "Climb into the garden's vent duct", mins: 5 },
    ],
    onFirstEnter: [{
      when: "npc:prince",
      then: [{ say: "Prince is sitting on top of the kitchen unit, absolutely still, watching a corner of the room where there is nothing.", tone: "horror" }],
    }],
    features: {
      kitchen: { name: "Automated kitchen unit", d: "It will make you something hot in ninety seconds and it does not care how you're feeling. There is water on tap." },
      catbox: { name: "Cardboard box", d: "Prince's bed. Shredded at one corner. The food bowl is full; the water bowl has been drunk down." },
      table: { name: "The table", d: "A cassette from Sonya's collection has been left out on the table — blue, a scratched handwritten label.", gives: ["tape1"] },
      garden: { name: "Hydroponic garden", d: "Fresh salad greens under grow lamps, plumbed straight into the vents. The plants are visibly beginning to wilt. Nobody has misted them in days." },
      rota: { name: "The rota", d: "A chore rota pinned to the wall. One crew member is tasked with the garden's upkeep each month. Mike is the last name on the list." },
    },
    actions: [{
      id: "pet", label: "Pet the cat", when: "here:prince",
      effects: [{ time: 5 }, { say: "Prince permits it. Prince is looking past you at something two metres to your left, and has not blinked in some time.", tone: "search" }],
    }],
  },

  wash: {
    n: 5, name: "WASHROOMS", tags: ["VENT", "WATER"],
    look: "Showers and toilets in a row of cubicles. The tile is cold. Everything drips. One shower is roped off with tape.",
    exits: [
      { to: "quarters", label: "Corridor → Quarters [3]", mins: 5 },
      { to: "vents", label: "Pull down the ceiling extractor and climb up", mins: 5 },
    ],
    features: {
      showers: { name: "Showers", d: "They run hot and hard. Base operations can switch them on and off from the workspace terminal. Standing water pools around the drains." },
      broken: { name: "The broken shower", d: "Out of order. According to the others, Mike broke it accidentally, the night before he disappeared. The fittings aren't broken so much as torn off the wall." },
      extractor: { name: "Ceiling extractor", d: "A large, clunky unit that filters steam out into the vents. It looks like it could be pulled down easily. It is heavy with condensate.", gives: ["extractor"] },
    },
  },

  entrance: {
    n: 6, name: "MINE ENTRANCE", tags: ["VACCSUIT REQUIRED"],
    look: "The elevator grinds to a stop. Vaccsuits are needed beyond this point — the pressure door behind you is the last one that holds. Automated drills work the rock from within, chewing metals out and pumping them up to be sorted in the workspace above. The noise is enormous and completely silent through your helmet, felt through the soles of your boots.",
    exits: [
      { to: "work", label: "Freight elevator → Workspace [2]", mins: 10 },
      { to: "tunnel", label: "Down the shaft → Mine Tunnel [7]", mins: 10 },
      { to: "ante", label: "Airlock → Mine Antechamber [9]", mins: 10, hidden: "ante_found" },
    ],
    features: {
      drills: { name: "Automated drills", d: "Blind machines doing patient violence to the rock. Their scheduled cycles have not been adjusted since the last shift was logged." },
      pumps: { name: "Pump housing", d: "Slurry and ore go up. Something has scraped a long, wide groove in the dust beside the housing, heading down-shaft." },
    },
  },

  tunnel: {
    n: 7, name: "MINE TUNNEL", tags: ["VACCSUIT REQUIRED"],
    look: "The shaft narrows. Thin veins of ore thread the black rock walls, mostly excavated already, leaving the walls scalloped and strange. Further down, the tunnel gives up on light entirely and continues into the Mine Depths.",
    exits: [
      { to: "entrance", label: "Up the shaft → Mine Entrance [6]", mins: 10 },
      { to: "depths", label: "Deeper → Mine Depths [8]", mins: 10 },
      { to: "ante", label: "Squeeze through the crack → Mine Antechamber [9]", mins: 10, hidden: "ante_found" },
    ],
    features: {
      veins: { name: "Thin veins of ore", d: "Worked out. Whoever mined this section did it carefully, and a long time ago." },
      walls: { name: "The wall", d: "Time spent searching with enough light finds it: a crack in the wall, large enough for a person to squeeze through. It opens into something that was never dug.", setsFlag: "ante_found", deep: true },
    },
  },

  depths: {
    n: 8, name: "MINE DEPTHS", tags: ["VACCSUIT REQUIRED"],
    look: "Your lamps make a small room out of a very large dark. A splash of yellow — thick, slow, and wrong — has run down the natural cave wall and pooled. An empty vaccsuit lies slumped in a heap nearby, as though the person inside simply stopped being there. Scorched into the rock in letters half a metre tall is the word SILENCE.",
    exits: [{ to: "tunnel", label: "Up → Mine Tunnel [7]", mins: 10 }],
    features: {
      goo: { name: "The yellow splash", d: "It moves. Not quickly — the way something moves when it is repairing itself and has all the time it needs." },
      suit: { name: "Empty vaccsuit", d: "No blood. No body. No damage to the suit at all. The nameplate has been scraped off, but the fit is a big man's. The internal log ends mid-shift." },
      silence: { name: "SILENCE", d: "Cut into the rock with a handheld laser cutter, at a height a person would have to reach up to. The tool lies discarded a few metres away, still warm.", gives: ["minelaser"] },
    },
    actions: [GOO_TOUCH],
  },

  ante: {
    n: 9, name: "MINE ANTECHAMBER", tags: ["VACCSUIT REQUIRED", "THE POD"],
    look: "Natural, smooth black space rock forms a cavern of arches and whorls — a shape that was made, not mined. Set into the wall, split by a long vertical gash, is an empty fleshy pod, leaking embryonic pus. The yellow goo is thickest here, in the chamber where it originates. A small workstation of scientific equipment has been set up nearby, incongruously neat.",
    exits: [
      { to: "tunnel", label: "Back through the crack → Mine Tunnel [7]", mins: 10 },
      { to: "entrance", label: "Airlock → Mine Entrance [6]", mins: 10 },
    ],
    features: {
      pod: {
        name: "The pod",
        d: "Empty. Fleshy. Warm. It was holding something in stasis for an interstellar voyage, and the mining broke the seal. Whatever was inside has been awake for a while now.",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "you understood what you were looking at" }] }],
      },
      goo2: { name: "The yellow goo", d: "It is thick here, running down the walls in slow sheets. This is where it comes from — and where it goes back to." },
      workstation: { name: "Workstation", d: "Scientific equipment, carefully set up and carefully abandoned. A scanner relays readings continuously to the Heracles in Docking Bay 1." },
      paper: { name: "Scrap of paper", d: "On the desk, in pencil: 0389.", gives: ["scrappaper"], setsFlag: "knows_code" },
    },
    actions: [GOO_TOUCH],
  },

  db1: {
    n: 10, name: "DOCKING BAY 1 — THE HERACLES", tags: ["KEYPAD"],
    look: "The research ship Heracles has been docked here for nearly four weeks. Inside it is sleek, white, and clean, with all the usual amenities. The washroom has been violently destroyed — fittings torn out, the mirror shattered, deep pry-marks from a crowbar. Everything else is untouched.",
    exits: [{ to: "work", label: "Airlock → Workspace [2]", mins: 5 }],
    features: {
      washroom: {
        name: "The destroyed washroom",
        d: "Taps, shower head, and the water lines behind them, ripped out of the wall with a crowbar. Somebody wanted the water gone. Not the room — the water.",
        effects: [
          { flag: "knows_water" },
          { save: "sanity", onFail: [{ stress: 1, why: "you understood what you were looking at" }] },
        ],
      },
      lab: { name: "Science lab", d: "Small and tidy. A cassette recorder sits on the bench for taking notes, with a labelled white cassette still in it.", gives: ["tape3", "recorder"] },
      microscope: {
        name: "Microscope",
        d: "A specimen of the yellow goo is mounted on the stage, prepared properly, waiting for someone to come back and look at it.",
        effects: [{ run: "examineGoo" }],
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
    n: 0, name: "THE VENTS", tags: ["CRAWLSPACE"], onMap: false,
    look: "Cramped ducting, warm in places and freezing in others, carrying the smell of the whole base at once: hydroponic damp, hot metal, soap, somebody's cigarettes. You can move between any vented compartment from in here. The dust on the duct floor has been disturbed in long, wide sweeps.",
    exits: [
      { to: "work", label: "Drop into Workspace [2]", mins: 10 },
      { to: "quarters", label: "Drop into Quarters [3]", mins: 10 },
      { to: "mess", label: "Drop into Mess [4]", mins: 10 },
      { to: "wash", label: "Drop into Washrooms [5]", mins: 10 },
    ],
    features: {
      dust: { name: "Disturbed dust", d: "Something the size of a person, or larger, moves through here regularly. There are no handprints. There are no footprints either — just the sweep of a body being dragged, or dragging itself." },
      tape: { name: "Discarded cassette", d: "A yellow cassette, unmarked, thrown into the ducting the way you throw away something you don't want to hear again.", gives: ["tape2"] },
      panel: { name: "Emergency control panel", d: "Set into the duct wall — a full-function twin of the workspace terminal, put here for the day the workspace is unreachable.", device: "terminal" },
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
