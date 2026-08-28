/* ============================================================
   SCENARIO 3 — THE MOTHERSHIP
   SCENARIO 4 — THE METAMORPHOSIS

   A century-old carcinid vessel upended in the foothills with
   three sleeping nobles inside it and one android trying very
   hard to become a fourth.

   Three ways in, and they are genuinely three ways rather than
   one way with decoration:

     [A] THRUSTERS   puzzle route. Nothing here is a fight.
     [B] AIRLOCK     the short way, and the one that kills you.
     [C] CRACK       the body route. Wet, blind, and quiet.

   Every chamber is pitch black unless stated. Comms do not work
   unless the Signal has been stopped. Nothing on this ship is
   built — it is grown, and the doors open for anything that
   smells like family, which is why a severed limb or a larval
   specimen is worth more here than a rifle.
   ============================================================ */

export const mothership = {
  /* ---------------- approach ---------------- */
  thrusters: {
    n: 0, name: "[A] THE MAIN THRUSTERS", tags: ["OUTSIDE", "DARK", "CARC"],
    look:
      "Half a day's scramble through the foothills and then it is simply there, filling the valley: a bulbous "
      + "burnt cigar of a thing, three hundred metres of it, driven into the crags at an angle and left. The "
      + "thruster bells sit eighteen metres above the scree, cold, and big enough to walk into.",
    onFirstEnter: [
      { say: "Take a moment with this. Nobody in your crew has seen an alien ship before, because until roughly ninety seconds ago there were none to see.", tone: "warden" },
      { save: "fear", why: "the scale of it", onFail: [{ stress: 2, why: "you cannot see all of it at once" }] },
      { flag: "reached_ship" },
    ],
    exits: [
      { to: "lz", label: "Back down the trail → Greta Base", mins: 360 },
      { to: "lz", label: "Back by vehicle → Greta Base", mins: 45, needs: "flag:apc" },
      { to: "a1", label: "Into the thruster bell → [A1]", mins: 20 },
      { to: "mothairlock", label: "Around the hull → the Airlock [B]", mins: 30, hidden: "seen_hull" },
      { to: "crack", label: "Up the flank → the Dorsal Crack [C]", mins: 40, hidden: "seen_hull" },
    ],
    features: {
      hull: {
        name: "Walk the hull",
        d: "Two more ways in, if you are prepared to spend the time: a grown airlock budding from a pod on the mountain side, and high up on the spine a crack with heat-shimmer coming out of it.",
        mins: 30, setsFlag: "seen_hull",
      },
      bullets: {
        name: "Bullet holes below the thruster",
        d: "Somebody stood here and emptied a magazine into the hull. The rounds did nothing, but they left residue: a chemotherapy agent, and several other things far more aggressive than that.",
        deep: true, skills: ["Chemistry", "Pathology"], mins: 15, setsFlag: "knows_doxo",
        effects: [{ say: "Somebody worked out that a thing built like a cancer might be killed like one, and came up here alone to try it.", tone: "warden" }],
      },
      qadir: {
        name: "A marine's corpse",
        d: "Just inside the bell, face bashed in against the deck. Tags: CPL QADIR. He got further than anybody and nobody ever knew.",
        effects: [{ save: "sanity", onFail: [{ stress: 1, why: "he came all this way on his own" }] }],
      },
    },
  },

  mothairlock: {
    n: 0, name: "[B] THE AIRLOCK", tags: ["INSIDE", "DARK", "CARC"],
    look:
      "A sphincter of muscle and shell nine metres across, budding from a pod on the mountain flank and ringed "
      + "with antenna-like whiskers that turn, very slightly, as you approach.",
    exits: [
      { to: "thrusters", label: "Back around the hull → [A]", mins: 30 },
      {
        to: "b1", label: "Through the airlock → [B1]", mins: 10,
        gate: {
          flag: "moth_b_open",
          routes: [
            { when: "tag:carc", text: "The whiskers find what you are carrying, read it as family, and the whole aperture relaxes open." },
          ],
          roll: { label: "FORCE THE APERTURE", stat: "strength", mode: "disadvantage", tags: ["force"], time: 30,
            passText: "It gives, eventually, and closes behind you like something swallowing.",
            failText: "It is a hundred points of damage to destroy and considerably more to argue with." },
        },
      },
    ],
    features: {
      whiskers: {
        name: "The whiskers",
        d: "Each about a metre, moving independently, sampling the air. They are not looking at you. They are smelling you, and you smell wrong.",
        setsFlag: "knows_pheromone",
        effects: [{ say: "▌ Carry carcinid matter — a limb, a larva — and every grown door on this ship opens without a roll.", tone: "warden" }],
      },
    },
  },

  crack: {
    n: 0, name: "[C] THE DORSAL CRACK", tags: ["OUTSIDE", "DARK"],
    look:
      "High on the spine, a wound in the hull with heat coming out of it — the ship's own atmosphere, leaking "
      + "into the rain and going up as shimmer. Below the lip is a twelve-metre drop into unlit nothing.",
    exits: [
      { to: "thrusters", label: "Back down the flank → [A]", mins: 40 },
      { to: "c1", label: "Down into the wound → [C1]", mins: 15 },
    ],
    features: {
      shimmer: {
        name: "The heat shimmer",
        d: "Warm, humid, and faintly sweet. The ship is pressurised and has been for a century, which means something in there has been maintaining it.",
        deep: true, skills: ["Jury-Rigging", "Mechanical Repair"], mins: 10, setsFlag: "knows_atmosphere",
      },
    },
  },

  /* ---------------- ROUTE A — the puzzle route ---------------- */
  a1: {
    n: 0, name: "[A1] THE ORRERY", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "An unlit chamber thirty metres across, every surface the texture of cooled lava. A black sphere four "
      + "metres wide hangs between two enormous cylinders, one from the ceiling and one from the floor. At the "
      + "base of each cylinder is a perforated ring. Set into the floor is a circle of eight large buttons.",
    exits: [
      { to: "thrusters", label: "Back out the thruster tunnel → [A]", mins: 20 },
      { to: "a2", label: "Climb the veins to the hatch → [A2]", mins: 15, needs: "flag:a1_hatch", needsHint: "the hatch is shut" },
    ],
    features: {
      rings: {
        name: "The perforated rings",
        d: "Each turns like the dial of a rotary telephone and each needs two people to move it. The ceiling ring rolls the sphere one way; the floor ring rolls it the other. As it turns, a pinhole in its surface throws a hard bright point of light around the walls.",
        setsFlag: "seen_rings", mins: 15,
      },
      buttons: {
        name: "The ring of eight buttons",
        d: "Set flush into the floor in a circle six metres across. Pressing one does nothing at all. Pressing all eight at once would need most of a crew.",
        effects: [{ run: "orrery" }],
      },
      veins: {
        name: "The veins",
        d: "Thick vessels lace the chamber's interior, and between them are holds — regular, spaced, and exactly the wrong distance apart for a human hand. They lead up to a small hatch.",
        setsFlag: "seen_veins",
      },
      hatch: {
        name: "The hatch",
        d: "Grown shut. It opens for carcinid pheromone, or for anybody who has brought a piece of one with them, or for two people and a crowbar and a great deal of swearing.",
        effects: [{ run: "a1Hatch" }],
      },
      screen: {
        name: "Search the vein wall",
        d: "A small screen grown into the wall, wired into the vessels: a live feed of an enormous circular chamber somewhere below, containing three colossal upright shapes draped in something like gossamer.",
        deep: true, mins: 15, setsFlag: "seen_nobles",
        effects: [
          { save: "sanity", why: "you have seen what is downstairs", onFail: [{ stress: 2, why: "the scale of the three of them" }] },
          { say: "▌ The players now know there are three of something enormous, asleep, in this ship. Let that sit.", tone: "warden" },
        ],
      },
    },
  },

  a2: {
    n: 0, name: "[A2] THE CHASM", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "The floor stops. Beyond it is a canyon through the ship's interior with no visible way across. Near the "
      + "edge, bulging out of the wall, is a large tumour with a mouth-like opening in it, held permanently "
      + "slightly ajar.",
    exits: [
      { to: "a1", label: "Back → [A1]", mins: 15 },
      { to: "a3", label: "Across the cartilage bridge → [A3]", mins: 10, needs: "flag:bridge_up", needsHint: "nothing is holding the bridge" },
    ],
    features: {
      tumour: {
        name: "The tumour",
        d: "Warm, and it opens fractionally wider when anything organic comes near it. Feed it, and something happens.",
        effects: [{ run: "feedTumour" }],
      },
      bridge: {
        name: "The bridge", when: "flag:bridge_up",
        d: "Ten metres of hardened cartilage, extruded across the gap and holding. It is holding because something is being digested to keep it that way, and when that finishes, it will stop.",
      },
      grate: {
        name: "A grate at the bottom",
        d: "Down in the canyon floor, a grating just wide enough for one person in a vaccsuit. Below it is a large chamber full of a gas that, for reasons nobody here will ever establish, does not come up through the grate.",
        setsFlag: "seen_grate",
      },
    },
  },

  a3: {
    n: 0, name: "[A3] THE GAS CHAMBER", tags: ["INSIDE", "DARK", "CARC", "HAZARD"], onMap: false,
    look:
      "A wide low space filled to shoulder height with something heavier than air that moves like liquid when "
      + "disturbed. Fleshy calcified tendrils as thick as a forearm criss-cross the room at every angle.",
    onFirstEnter: [{ run: "gasCheck" }],
    exits: [
      { to: "a2", label: "Back → [A2]", mins: 10 },
      { to: "a4", label: "Onward through the tendrils → [A4]", mins: 15 },
    ],
    features: {
      tendrils: {
        name: "The tendrils",
        d: "Calcified, rooted at both ends, and warm. They run through the gas in every direction and they are, structurally, the only handholds in the room.",
      },
      gas: {
        name: "The gas",
        d: "It does not go through the grate above and it does not rise. Whatever it is for, this room is doing it on purpose.",
        deep: true, skills: ["Chemistry"], mins: 15,
      },
    },
  },

  a4: {
    n: 0, name: "[A4] THE GALLERY", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A throat-like tunnel two hundred metres long, bisected end to end by a slow river of black liquid. The "
      + "walls are pocked with small chambers at head height, hundreds of them, and every chamber has something "
      + "in it.",
    onFirstEnter: [
      { say: "The chambers hold human body parts, grafted into the wall of the ship. Every one of them is alive. The faces work through agony and something that is unmistakably not agony, and back again.", tone: "horror" },
      { save: "sanity", mode: "disadvantage", why: "the gallery", onFail: [{ stress: 3, why: "they are all still alive" }, { panic: true }] },
    ],
    exits: [
      { to: "a3", label: "Back → [A3]", mins: 15 },
      { to: "a5", label: "Along the gallery → [A5]", mins: 20 },
      { to: "tunnels", label: "Down the metallic web → the bore tunnels", mins: 60, hidden: "seen_web" },
    ],
    features: {
      chambers: {
        name: "The chambers",
        d: "Arms, torsos, faces, spliced through with carcinid fibre and sustained by it. They are not colonists. They do not match anybody on the org chart, and the tissue is older than the colony.",
        deep: true, skills: ["Pathology", "Xenobiology"], mins: 20, setsFlag: "knows_gallery",
        effects: [{ say: "These people have been here a very long time. This ship has done this before, somewhere else, to somebody else.", tone: "horror" }, { stress: 2, why: "you are not the first" }],
      },
      web: {
        name: "The metallic web",
        d: "At the far end, a lattice descending into the floor of the ship and continuing, by the feel of the air, for several miles underground.",
        setsFlag: "seen_web",
      },
    },
  },

  a5: {
    n: 0, name: "[A5] THE POLYP TOWER", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A ribbed tower rising out of the deck. Two thirds of the way up it, a warty polyp pulses with yellow "
      + "light, and a three-metre carcinid limb protrudes from the side of it — rusted-looking, but it can be "
      + "articulated. In the floor before it sits a metallic nodule the size of a beach ball.",
    exits: [
      { to: "a4", label: "Back → [A4]", mins: 20 },
      { to: "court", label: "Down the web → the Court [D]", mins: 30, hidden: "a5_open" },
    ],
    features: {
      polyp: {
        name: "The polyp and the limb",
        d: "The limb moves when it is moved and stays where it is put. The polyp brightens when the limb is articulated, which is either a response or a coincidence, and this ship does not do coincidences.",
      },
      nodule: {
        name: "The metallic nodule",
        d: "Beach-ball sized, seated in the deck in front of the polyp, and plainly one half of something.",
        effects: [{ run: "polypNodule" }],
      },
      second: {
        name: "Search the tower base",
        d: "A second nodule, identical, half-buried at the foot of the ribbing. Connected to the first, a section of the wall peels back.",
        deep: true, skills: ["Scavenging"], mins: 20, setsFlag: "found_second_nodule",
      },
      pool: {
        name: "The revealed chamber", when: "flag:a5_open",
        d: "A pool of glowing saline, harmless to the touch. Floating in it: a rifle-sized black tube on an umbilical, joined to a swollen sac that can be worn like a vest. The trigger sits on top of the tube, in a place no human hand would put it.",
        gives: ["webgun"], mins: 15,
      },
    },
  },

  /* ---------------- ROUTE B — the short way ---------------- */
  b1: {
    n: 0, name: "[B1] DIM CORRIDOR", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A wide passage lined on both sides with upright shapes — statuary, at first glance, arranged with what "
      + "looks a great deal like ceremony. Somewhere ahead of you, a dim cacophony of scuttling shells.",
    onFirstEnter: [
      { say: "Four of the shapes in this corridor are not statues. They have been waiting long enough to have gone completely still.", tone: "horror" },
      { fight: "carc", count: 2, surprise: true, distance: 8 },
    ],
    exits: [
      { to: "mothairlock", label: "Back → the Airlock [B]", mins: 10 },
      { to: "b2", label: "Onward → the Armoury [B2]", mins: 10 },
      { to: "b3", label: "Side passage → the Narrow Walkway [B3]", mins: 10 },
    ],
    features: {
      statues: { name: "The statues", d: "Carcinids, dead a very long time and mineralised where they stood. They are arranged facing inward, and they are not all the same species." },
    },
  },

  b2: {
    n: 0, name: "[B2] THE ARMOURY", tags: ["INSIDE", "DARK", "CARC", "HAZARD"], onMap: false,
    look:
      "A chamber ringed with articulated arms, dozens of them, folded against the walls at rest. Each one "
      + "terminates in something bladed. They are not weapons in racks. They are the racks.",
    onFirstEnter: [
      { say: "▌ This room can end a crew in one round. Telegraph it hard. If they want to leave now, let them, and do not make them roll for it.", tone: "warden" },
      { run: "armoryEmbrace" },
    ],
    exits: [
      { to: "b1", label: "Back → [B1]", mins: 10 },
      { to: "b3", label: "Onward → the Narrow Walkway [B3]", mins: 10 },
    ],
    features: {
      arms: {
        name: "The arms",
        d: "They respond to a body entering the chamber by embracing it. The embrace is not hostile in any sense the ship would recognise. It is fitting a component.",
      },
    },
  },

  b3: {
    n: 0, name: "[B3] THE NARROW WALKWAY", tags: ["INSIDE", "DARK", "CARC", "EXPOSED"], onMap: false,
    look:
      "A span of shell one pace wide, crossing a chasm. Sixty metres below, hundreds of carcinids move over one "
      + "another in a slow continuous wave, and the sound of it comes up the shaft like surf.",
    onFirstEnter: [
      { save: "fear", why: "how many of them there are", onFail: [{ stress: 2, why: "you can see the whole nest" }] },
      { say: "▌ Balancing on this takes concentration. Anything that breaks it — running, a fight, a shove — is a Body Save at disadvantage against a sixty-metre fall into that.", tone: "warden" },
      { flag: "on_the_span" },
    ],
    exits: [
      { to: "b1", label: "Back → [B1]", mins: 10 },
      { to: "b4", label: "Onward → the Pit [B4]", mins: 10 },
      { to: "court", label: "Down to the Court [D]", mins: 20 },
    ],
    features: {
      below: {
        name: "Look down",
        d: "A crawling wave of chitin, layered several bodies deep, going nowhere in particular. None of them are looking up. If any of them do, the span is one pace wide.",
      },
    },
  },

  b4: {
    n: 0, name: "[B4] THE PIT", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A deep bowl in the ship's floor, and the smell that comes out of it is rot on an industrial scale. Two "
      + "carcinids lie at the bottom, dying slowly and without any apparent care from anything else on this ship.",
    onFirstEnter: [
      { save: "body", why: "the smell", onFail: [{ say: "You retch, loudly, for a full round, and everything on this deck now knows where you are.", tone: "horror" }, { noise: "somebody being violently sick" }] },
      { say: "Three spindly things come down from the ceiling on strands of fibre, unhurried, one after another.", tone: "horror" },
      { fight: "carc", count: 3, distance: 15 },
    ],
    exits: [
      { to: "b3", label: "Back → [B3]", mins: 10 },
      { to: "b5", label: "Onward → the Triple Airlock [B5]", mins: 10 },
    ],
    features: {
      dying: {
        name: "The two dying carcs",
        d: "Nothing has fed them and nothing has finished them. They are simply being allowed to stop. Whatever this species is, it is not sentimental about its own.",
        deep: true, skills: ["Xenobiology"], mins: 15, gives: ["carclimb"],
      },
    },
  },

  b5: {
    n: 0, name: "[B5] THE TRIPLE AIRLOCK", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "Three grown apertures in series, each one closing before the next opens. The air changes twice on the way "
      + "through. Beyond the third, something very large is breathing at an unhurried rate.",
    exits: [
      { to: "b4", label: "Back → [B4]", mins: 10 },
      { to: "court", label: "Through into the Court [D]", mins: 10 },
    ],
    features: {},
  },

  /* ---------------- ROUTE C — the body route ---------------- */
  c1: {
    n: 0, name: "[C1] THE WOUND", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "The crack descends into a small rough-walled chamber with no exits at all. The walls are spongy, wrinkled, "
      + "and coated in a thin film of milk-white fluid. Put a hand against them and they are not warm the way a "
      + "room is warm.",
    exits: [
      { to: "crack", label: "Climb back out → [C]", mins: 15 },
      { to: "c2", label: "Down the flooded chute → [C2]", mins: 15, needs: "flag:c1_cut", needsHint: "there is no way on" },
    ],
    features: {
      walls: {
        name: "The walls",
        d: "They yield to a blade almost eagerly. Behind them, in the floor, is a fluid-filled chute going down — a twenty-metre swim, and no way to know what is at the bottom until you are there.",
        effects: [{ flag: "c1_cut" }, { say: "The wall opens and does not bleed. Below is a column of warm fluid going down into the dark.", tone: "horror" }],
      },
    },
  },

  c2: {
    n: 0, name: "[C2] THE BELLOWS", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "Rings of muscle at either end of a long chamber suck and blow humid air through it on a slow cycle. From "
      + "the ceiling billow dozens of immense sheets of sticky membrane, and the whole room moves with the "
      + "breathing.",
    exits: [
      { to: "c1", label: "Back up the chute → [C1]", mins: 15 },
      { to: "c3", label: "Onward and down → [C3]", mins: 15 },
    ],
    features: {
      membranes: {
        name: "The membranes",
        d: "Sticky, vast, and hanging in layers. Something about the air passing over them is doing work for the whole ship.",
        deep: true, skills: ["Xenobiology"], mins: 15, setsFlag: "knows_bellows",
        effects: [{ say: "▌ Destroy these — fire, explosive, cutter — and every carcinid aboard gets slower and takes [-] on everything. This is the single best thing a crew can do on this ship and almost nobody finds it.", tone: "warden" }],
      },
      burn: {
        name: "Destroy the membranes", when: "flag:knows_bellows and !flag:bellows_dead",
        d: "It needs fire, an explosion, or a cutter, and it needs all of them gone rather than most.",
        mins: 20, effects: [{ run: "burnBellows" }],
      },
    },
  },

  c3: {
    n: 0, name: "[C3] THE GULLET", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A shaft going straight down. Thirty metres in, the walls become carpeted in delicate whisker-hairs a foot "
      + "long, and below that the passage closes into a ring of muscle that is currently shut.",
    exits: [
      { to: "c2", label: "Back up → [C2]", mins: 15 },
      { to: "c4", label: "Through the peeled wall → [C4]", mins: 10, hidden: "c3_side" },
      { to: "c5", label: "Through the sphincter → [C5]", mins: 10, needs: "flag:c3_open", needsHint: "it is closed" },
    ],
    features: {
      whiskers: {
        name: "The whisker-hairs",
        d: "They respond to contact. Brush all of them and the ring below opens — after five full minutes of everybody holding absolutely still. Stimulate exactly one, and a section of the wall peels back instead.",
        effects: [{ run: "whiskers" }],
      },
    },
  },

  c4: {
    n: 0, name: "[C4] THE FOG CAVITY", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "A cavity gnawed out of the ship's own superstructure, floored in low rolling fog with pools of clear "
      + "plasma standing in it. In the middle is a squat tube of bone-ceramic with eight small fleshy nodules "
      + "along the top of it.",
    exits: [{ to: "c3", label: "Back → [C3]", mins: 10 }],
    features: {
      nodules: {
        name: "The nodules",
        d: "Squeeze one and it produces a short burst of fibre that dries hard in seconds. Each is spent after a single squeeze and refills in about ten minutes.",
        effects: [{ say: "The fibre comes out wet, lands, and is rigid inside four seconds. This is how a colony's weapons became one lump of metal.", tone: "system" }, { flag: "knows_fibre" }],
      },
      tube: {
        name: "Dig out the tube",
        d: "An hour's work to free it from the deck, or half that with enough people pulling. Twenty-two kilos. Given four hours in a working lab, the colonists could turn what it makes into ammunition.",
        deep: true, skills: ["Scavenging", "Asteroid Mining"], mins: 60, gives: ["fibretube"],
      },
      plasma: { name: "The pools of plasma", d: "Clear, still, and body temperature. Nothing in them. Nothing living in them, at least." },
    },
  },

  c5: {
    n: 0, name: "[C5] THE RAMP", tags: ["INSIDE", "DARK", "CARC"], onMap: false,
    look:
      "The ribbed corridor turns hard upward at a steep angle. Regular ridges of tough rubbery material run "
      + "across it in repeating patterns, like the roof of a dog's mouth, and every surface is coated in "
      + "something with the consistency of saliva.",
    exits: [
      { to: "c3", label: "Back down → [C3]", mins: 10 },
      { to: "court", label: "Up the ramp → the Court [D]", mins: 10 },
    ],
    features: {
      coating: {
        name: "The coating",
        d: "It is tacky rather than slick. Once it has hold of something it begins to harden and dry, and it works faster on fabric than on shell.",
      },
    },
  },

  /* ---------------- [D] THE COURT ---------------- */
  court: {
    n: 0, name: "[D] THE COURT", tags: ["INSIDE", "CARC"],
    look:
      "A circular chamber on a scale that does not make sense inside a ship. Three shapes stand at the far side "
      + "of it, draped in gossamer shrouds, each of them taller than the hangar you left this morning. Two are "
      + "entirely still. The third has changed position since the screen showed it. Carcinids move about the "
      + "floor in unhurried numbers, and among them, at a bench of grown equipment, works an android in colony "
      + "coveralls. There is a woman beside him, taking notes.",
    onFirstEnter: [
      { save: "fear", mode: "disadvantage", why: "the three of them", onFail: [{ stress: 3, why: "one of them has moved" }] },
      { npc: { id: "jensen", loc: "court" } },
      { say: "The carcs notice you. They do not attack. Several of them close in around your crew and escort you — there is no other word for it — to an audience.", tone: "horror" },
      /* HINTON, PRESENT AND ATTACKABLE.

         The `hinton` and `retinue` threats existed with full stat
         lines and were never placed anywhere, so a crew who decided
         to shoot the android had nothing to shoot — and his logic
         core, one of the two things the Company actually sent them
         for, was granted only by his `onSlain` and was therefore
         unobtainable. Both are placed with `ambushes: false`: they
         are in the room, they do not start a fight, and the crew
         choose. */
      { threat: { id: "hinton", loc: "court" } },
      { threat: { id: "retinue", loc: "court" } },
      { run: "meetHinton" },
      { flag: "met_hinton" },
    ],
    exits: [
      { to: "b5", label: "Back through the airlocks → [B5]", mins: 10 },
      { to: "tunnels", label: "Out through the bore tunnels → Heron Station", mins: 60 },
    ],
    /* Leaving is a decision, not an ending. It used to be an
       `@escape` exit, so declining the fight — the wise answer, and
       the one the module's own notes recommend — rolled the credits
       with scenario four unplayed. It now walks them back into the
       bore tunnels and leaves `escape` for a crew who go home with
       nothing. */
    actions: [
      {
        id: "leavecourt", label: "Leave, and mean it", kind: "accent",
        when: "!flag:left_court",
        effects: [{ run: "leaveCourt" }],
      },
    ],
    features: {
      hinton: {
        name: "Hinton",
        d: "A contemplative synthetic in a colony jumpsuit, doing careful work. He is entirely willing to talk, and entirely willing to let you go if you are polite about it. He does not regard you as significant, and he is not performing that.",
        effects: [{ run: "talkHinton" }],
      },
      nobles: {
        name: "The three sleepers",
        d: "Nobles. Older than the colony, older than the ship, and the reason for every single thing that has happened on this planet. One of them is closer to waking than the other two.",
        setsFlag: "seen_nobles",
        effects: [{ save: "sanity", why: "attending to one of them properly", onFail: [{ stress: 3, why: "it is aware of you" }] }],
      },
      bench: {
        name: "Hinton's bench",
        d: "Grown apparatus, human tools, and three months of work towards a single objective: getting a synthetic consciousness into a hive that has no interface for one.",
        deep: true, skills: ["Computers", "Xenobiology"], mins: 20, setsFlag: "knows_hinton_plan",
      },
      beacon: {
        name: "The Company distress beacon",
        d: "Salvaged, rewired, and pointed outward rather than inward. It has already sent. Whatever heard it is roughly ten years away, and it is not the Company.",
        setsFlag: "knows_beacon",
        effects: [{ save: "sanity", onFail: [{ stress: 2, why: "it has already sent" }] }],
      },
    },
  },

  /* ---------------- SCENARIO 4 — back on the ship ---------------- */
  metamorphosis: {
    n: 0, name: "THE METAMORPHOSIS", tags: ["SHIP", "INSIDE"],
    look:
      "Your own ship, in orbit, warm and lit and smelling of nothing in particular. The pilots are in the "
      + "cockpit and have been for three months. Everything aboard is exactly as you left it, which after Samsa "
      + "VI is its own kind of wrong.",
    onFirstEnter: [
      { say: "Anders says the liaison has mostly been in his quarters watching videos. Benfield says he tried to raise you once, got a noise like a drill going through a wall, and stopped trying.", tone: "npc" },
      { flag: "aboard_ship" },
    ],
    exits: [],
    /* NOT AN EXIT ANY MORE.

       `doMove` runs an ending exit's effects and then calls
       `endGame` whatever they did, so `breakOrbit` started the Maas
       fight and the credits rolled over the top of it in the same
       instant. As a room action the hook owns the decision: it runs
       the fight the first time and picks the departure ending the
       second, which is also how the module finally reaches four of
       its eight endings. */
    actions: [
      {
        id: "breakorbit", label: "Break orbit", kind: "accent",
        effects: [{ run: "breakOrbit" }],
      },
    ],
    features: {
      maas: {
        name: "Maas's quarters",
        d: "He is sitting in the chair with a stylus, filling in reports. He has filled in a great many of them. The stack beside him is the same form, over and over, and the handwriting deteriorates down the pile until the last few are not writing at all.",
        effects: [{ run: "findMaas" }],
      },
      pilots: {
        name: "Anders and Benfield",
        d: "Bored, alive, and entirely unaware. They have been flying holding patterns and playing cards for three months and would like to know when they are going home.",
      },
      sensors: {
        name: "The sensor board",
        d: "Clean. Nothing in the system but you, the planet, and the weather on it.",
      },
    },
  },
};
