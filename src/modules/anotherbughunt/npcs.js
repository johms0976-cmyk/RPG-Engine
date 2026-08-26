/* ============================================================
   ANOTHER BUG HUNT — THE LIVING, AND THE THINGS THAT ARE NOT

   The survivors of Greta Base are barricaded in the Heron
   hangar and have split into three factions who each want the
   crew's help with a different job. Beyond the engine's standard
   NPC keys, each of them carries:

     faction   leave | study | hog | none
     post      where they are while the hangar holds
     nerve     1-5, how much fear they absorb before they change

   `knows` is both the offline dialogue script and the hard
   ceiling on what a character may say. Nobody in this module
   knows Hinton did it. Two of them suspect. One of them is
   lying about something else entirely.
   ============================================================ */

export const npcs = {
  /* ---------------- Greta Base ---------------- */
  demar: {
    name: "DEMAR", role: "Base Mechanic", start: "apc", faction: "none",
    nerve: 1, vanishable: false,
    brief:
      "Sitting in the dark of the APC cab in a hand-folded foil cap, thin, hugging his knees. He is holding a "
      + "frag grenade and the pin is already out.",
    persona:
      "Warm, unhurried, and entirely elsewhere. He is not frightened and cannot be made frightened. He talks "
      + "about the hive the way a homesick person talks about a town. He does not react to noise, to weapons, "
      + "or to being shouted at.",
    note:
      "Stage 3. Do not play him as a monster — play him as somebody who has been given the one thing he wanted, "
      + "which is to be part of something. The grenade is not a threat he is making. He has simply forgotten "
      + "he is holding it.",
    knows: [
      "He would like to go back. He says it twice, without urgency, the way you mention a train.",
      "He can hear them calling. He says it is not unpleasant. He says he would like to contribute.",
      "They are waking up, he says. He is pleased about it.",
      "If asked gently, and only gently, he will point out the route through the foothills to the ship.",
      "He does not know what a grenade is any more. If startled, he will remember he is holding something, and let go.",
    ],
    deflections: [
      "\"I want to go back.\"",
      "[he is listening to something that is not in the cab]",
      "\"They are calling. It's alright.\"",
    ],
  },

  /* ---------------- TEAM LEAVE ---------------- */
  brookman: {
    name: "HM3 BROOKMAN", role: "Platoon Medic", start: "hangar", faction: "leave",
    post: "hangar", nerve: 2,
    brief: "The medic. Has given up on the mission entirely and wants everyone on a dropship within the hour.",
    persona:
      "Fast, quiet, apologetic. Agrees with whoever spoke last and then goes back to his own plan. Flinches at "
      + "the thunder every time and is embarrassed about it every time.",
    note:
      "His plan is the one your players will already have thought of, so play him as a coward rather than as a "
      + "strategist. If he sounds brave, the table follows him instead of leading. He gives the control room "
      + "keycard to literally anybody who asks.",
    knows: [
      "The tower across the dam is the only working comms on this planet. Retake it and you can call the dropship.",
      "He has the only keycard left for the tower control room. He will hand it over the moment anyone asks.",
      "He has scouted the dam. There are already carcs on it. He would rather not talk about how he knows.",
      "Every hour they wait, more of them arrive. He is right about this and nobody wants to hear it.",
      "He was Siege Squad's medic. He does not want to discuss where Siege Squad is.",
    ],
  },
  ivanovic: {
    name: "CPL IVANOVIC", role: "APC Driver, Siege Squad", start: "hangar", faction: "leave",
    post: "hangar", nerve: 3, bond: "brookman",
    brief: "Sticks to Brookman's shoulder and agrees with him before he has finished the sentence.",
    persona: "Loyal past the point of usefulness. Will not be drawn on anything Brookman has not already said.",
    knows: [
      "Whatever Brookman thinks is the right plan. She will say so before you have finished asking.",
      "She can drive anything in the hangar and says so more often than is necessary.",
      "There is a journal under a bunk at Greta Base that she would very much like back.",
    ],
  },
  tanaka: {
    name: "PFC TANAKA", role: "APC Tech, Zigzag Squad", start: "hangar", faction: "leave",
    post: "hangar", nerve: 1,
    brief: "Injured, nineteen, and holding it together by not being asked any direct questions.",
    persona: "Frightened in the way a child is frightened — badly, and without any of the adult apparatus for hiding it.",
    knows: [
      "He was at the birthday party. He will not describe it and should not be pushed.",
      "The broken ATV is a two-hour job if somebody who knows engines helps him.",
      "He wants to know whether anybody is coming. He asks this repeatedly.",
    ],
  },
  kawaguchi: {
    name: "DR KAWAGUCHI", role: "Planetologist", start: "hangar", faction: "leave",
    post: "hangar", nerve: 4,
    brief: "Edem's rival, and enjoying the current situation more than is decent.",
    persona: "Dry, precise, and unable to mention Dr Edem without a small pause first.",
    knows: [
      "The storm has ten hours left in it and the station's flood modelling is optimistic.",
      "Dr Edem's research is not, in her professional assessment, as far along as Dr Edem says it is.",
      "Edem and Olsson were together. She mentions it as a data point and watches to see what you do with it.",
    ],
  },

  /* ---------------- STUDY GROUP ---------------- */
  edem: {
    name: "DR EDEM", role: "Mission Specialist, Xenobiology", start: "hangar", faction: "study",
    post: "hangar", nerve: 4, vanishable: false,
    brief:
      "The Company's named priority and the only person here the contract obliges you to bring home. Wants an "
      + "escort down to the lab to recover four months of sequencing work.",
    persona:
      "Brilliant, exact, and visibly rationing what they say. Speaks about the carcs with an admiration they "
      + "have stopped bothering to hide, and about the colonists with none at all. Grieving, badly, and "
      + "channelling it into the work.",
    note:
      "Edem is lying, but not about the science. Their family is inside a Company debtor's facility and the "
      + "release condition is a viable genome. Everything they do that looks like recklessness is somebody "
      + "buying three people out. They will take insane risks to get into the Cryovault and will invent a "
      + "reason each time.",
    knows: [
      "Their research is on a portable terminal in the lab on level minus one. Without it they cannot go home.",
      "They and Dr Ziegler were sequencing the carcs' genome. Ziegler went down to fetch the data and did not come back.",
      "Given a few hours and the research, they can compound something that coats a bullet and gets through carapace.",
      "The animals make a sound to reproduce. They named it. They will tell you the name unprompted.",
      "They will not discuss the Cryovault, except to say that they need samples from it and that nobody should follow them in.",
      "Olsson's birthday card is still in their quarters at Greta Base, unopened. They will not discuss this at all.",
    ],
    deflections: [
      "\"That is not the priority.\"",
      "\"You would need six years of biochemistry for the real answer, so: no.\"",
      "[they look at the lift doors again]",
    ],
  },
  yang: {
    name: "SGT YANG", role: "Squad Leader, Zigzag Squad", start: "hangar", faction: "study",
    post: "hangar", nerve: 5,
    brief: "The oldest person left standing and the only one making tactical sense.",
    persona: "Gruff, economical, and completely without theatre. Answers exactly the question asked.",
    knows: [
      "Rifles do not work on them. He has watched a full magazine go into one and change nothing.",
      "The lab can be reached by the hangar lift or by the maintenance stairs. He would take the stairs.",
      "He thinks Valdez is out of her depth and has decided that saying so out loud would cost more than it is worth.",
      "He will come with you if asked directly. Nobody has asked him.",
    ],
  },
  sobol: {
    name: "SOBOL", role: "Engineering", start: "hangar", faction: "study",
    post: "hangar", nerve: 3,
    brief: "Convinced this is all somehow the android's doing, and correct for entirely the wrong reasons.",
    persona: "Talks quickly, joins dots that are not adjacent, and is right about the conclusion and wrong about every step.",
    note:
      "Sobol is the module's one honest gift to a suspicious table. He is a crank. He is also correct. Do not "
      + "let him produce evidence — let him produce theories, and let the players decide.",
    knows: [
      "Hinton was in every part of this before it went wrong. He cannot say how he knows and gets louder about it.",
      "The comms failed before the carcs came, not after. He is certain of the order and he is right.",
      "There is a generator in the lift housing with six hours in it, if anybody ever needs the tower lit.",
      "He does not believe the science officer is missing. He believes he left.",
    ],
  },

  /* ---------------- HOG SQUAD ---------------- */
  valdez: {
    name: "SGT VALDEZ", role: "Platoon Tech, Acting Commander", start: "hangar", faction: "hog",
    post: "hangar", nerve: 3, vanishable: false,
    brief:
      "A technician who was fourth in line for command and got it anyway. Sent Siege Squad down to the reactor "
      + "six hours ago and has heard nothing since.",
    persona:
      "Overcompensating in every direction at once — too loud, too fast to threaten, too quick to call it an "
      + "order. Underneath it she is doing the arithmetic on how many of these people she has already lost.",
    note:
      "She is not a bully, she is nineteen days into a job she was never trained for. Let her be wrong in front "
      + "of the players and let her take it well. If the crew treat her as a commander she becomes one.",
    knows: [
      "The reactor's flood controls have to be thrown by hand or the station goes dark within the hour.",
      "She sent Siege Squad down to do it, with Hinton and Dr Jensen. Their locators went dark six hours ago.",
      "She can issue rifles, hazard suits and lamps. The reactor levels are hot and the suits are not optional.",
      "The reactor is reached by rappelling down the chimney, or the long way round through the spillways.",
      "She will go herself if nobody else will, and she knows what that would mean.",
    ],
  },
  pedro: {
    name: "PFC PEDRO", role: "Fireteam 1, Zigzag Squad", start: "hangar", faction: "hog",
    post: "hangar", nerve: 2, bond: "valdez",
    brief: "In love with Sgt Valdez and agrees with everything she says on principle.",
    persona: "Eager, uncritical, and audibly relieved whenever somebody else makes a decision.",
    knows: [
      "Whatever Sgt Valdez just said, with more enthusiasm.",
      "He has never fired at anything that fired back and it shows.",
    ],
  },
  novikov: {
    name: "CPL NOVIKOV", role: "Fireteam 2, Zigzag Squad", start: "hangar", faction: "hog",
    post: "hangar", nerve: 4,
    brief: "Wants to blow something up and has stopped being fussy about what.",
    persona: "Grinning, loud, and genuinely good company right up until the moment she is a liability.",
    knows: [
      "The stockpile has two explosive devices and a flamethrower with two tanks. She has counted them repeatedly.",
      "Fire does not work on them either. She has tested this and would like to test it again.",
    ],
  },

  /* ---------------- the tower ---------------- */
  underhill: {
    name: "SSGT UNDERHILL", role: "Platoon Sergeant", start: "relay", faction: "none",
    nerve: 5, gone: false, vanishable: false,
    brief:
      "Prone on the relay platform behind an anti-material rifle, killing one carc per round and down to twelve "
      + "rounds. His body is criss-crossed with fine incisions.",
    persona:
      "Flat, clipped, and entirely operational until he is not. Mid-sentence he will stop, look at nothing, and "
      + "go somewhere else for a few seconds. Then he comes back and continues the sentence.",
    note:
      "Stage 3, and holding it off by force of habit and a dog with good teeth. His orders are the last real "
      + "orders anybody on this planet has received: get off this rock. If the crew tell him about a plan that "
      + "is not evacuation, he will hear them out and then repeat the orders.",
    knows: [
      "Comms are dead planet-wide and the source is in the control room below him. He has not been able to get in.",
      "Twelve rounds left. He can hold the platform. He cannot hold it and go anywhere.",
      "His orders are to evacuate. He will repeat this whenever a conversation drifts.",
      "The dog bites him when he goes away. He is grateful for it and says so like it is a supply issue.",
      "If asked directly what is wrong with him, he will tell you, in about six words.",
    ],
    deflections: ["\"Say again.\"", "[he has gone somewhere for a moment]", "\"Orders are evacuate.\""],
  },
  marlow: {
    name: "MARLOW", role: "Synthetic Bloodhound", start: "relay", faction: "none",
    silent: true, vanishable: false,
    brief:
      "A working synthetic dog, soaked through, lying against Underhill's flank. It can smell the infection and "
      + "it bites him whenever he stops being there.",
    persona: "",
    knows: [],
    note:
      "Marlow is a diagnostic instrument that loves somebody. Point it at a person and it will tell you whether "
      + "they are infected. This is the only reliable test the crew will find, and it is attached to a man who "
      + "will not leave his firing position.",
  },

  /* ---------------- the reactor ---------------- */
  franco: {
    name: "LCPL FRANCO", role: "Fireteam 1, Siege Squad", start: "reactor", faction: "none",
    nerve: 4, vanishable: false,
    brief: "Standing on the crown of a flooded turbine with a machine gun and six rounds, keeping watch over Weaver.",
    persona: "Exhausted past fear and into a kind of administrative calm. Reports rather than talks.",
    knows: [
      "The water is full of them. He has six rounds. He has been counting them out loud for an hour.",
      "It was Hinton. Hinton killed Glöckner in front of him and then broke the reactor controls by hand.",
      "The reactor goes down within the hour and there is nothing left to throw. He watched the controls come apart.",
      "Hinton took Dr Jensen with him. Jensen was walking on her own and did not appear to object.",
      "Qadir went missing before any of it. Nobody has seen him since.",
      "Weaver needs help. Weaver has the paper cuts. He says this last and quietly.",
    ],
  },
  weaver: {
    name: "PFC WEAVER", role: "Fireteam 2, Siege Squad", start: "reactor", faction: "none",
    nerve: 1, vanishable: false,
    brief: "Clinging to Franco, soaked, and covered from throat to wrist in fine incisions like paper cuts.",
    persona: "Panicky, grateful, and talking too much. Keeps apologising for the state of himself.",
    note: "Stage 1. He does not know. Franco does. Whether the players tell him is theirs.",
    knows: [
      "He has been in the water for six hours and would like that noted by somebody with authority.",
      "He keeps hearing someone suggesting things to him. He puts it down to the cold.",
      "He does not know where the cuts came from. He noticed them this morning.",
    ],
  },
  jensen: {
    name: "DR JENSEN", role: "Geologist", start: "court", faction: "none",
    nerve: 5, gone: false, vanishable: false,
    brief: "Standing at Hinton's shoulder in the Court, unrestrained, taking notes.",
    persona:
      "Perfectly composed and slightly too pleased to see other people. Answers questions accurately and at "
      + "length, and never once asks to leave.",
    note: "Stage 4. She is entirely herself, in the sense that there is no longer anyone else in there.",
    knows: [
      "She is assisting. She uses that word and does not elaborate on it.",
      "The three sleepers in the chamber are old — older than the colony, older than the ship they are in.",
      "She will describe Hinton's work clearly, competently, and with obvious professional respect.",
      "If asked whether she wants to leave, she looks puzzled by the question and then answers something else.",
    ],
  },

  /* ---------------- the Company ---------------- */
  maas: {
    name: "MAAS", role: "Corporate Liaison", start: null, gone: true, faction: "none",
    nerve: 5, vanishable: false,
    brief: "Your liaison, nominally in charge, still aboard The Metamorphosis in orbit and entirely comfortable.",
    persona:
      "The worst manager anybody at this table has ever had, rendered faithfully. Interrupts, restates your "
      + "own point back at you, and returns every conversation to the logic core.",
    note:
      "Maas is infected and you should not work hard to hide it. He caught it over the radio on day one and has "
      + "been filling in reports ever since. When the players get suspicious, let them be right.",
    knows: [
      "The contract names two retrievals: Dr Edem, and Hinton's logic core. The core is the one he mentions twice.",
      "The colonists are not on the contract. He will say this in a tone that suggests he considers it settled.",
      "He tried to raise the crew on the surface, got noise, and stopped trying after the first day.",
      "He has been in his quarters. He has a great deal of paperwork and is behind on it.",
    ],
    deflections: ["\"Let's circle back to the core.\"", "\"That's not in scope.\"", "[he is filling in a form while you talk]"],
  },
};

export const npcOrder = [
  "edem", "valdez", "brookman", "yang", "sobol", "novikov", "kawaguchi",
  "ivanovic", "pedro", "tanaka", "underhill", "marlow", "franco", "weaver",
  "demar", "jensen", "maas",
];

/* ============================================================
   THREATS

   Mothership 1e stat lines, transcribed as engine fields:
   W:2(20) is maxHits 2 / maxDmg 20, AP:30 is armor 30.

   Every carcinid carries the same two things:

     a Shriek, which is how the infection spreads and which
     costs a Sanity Save merely to be near, and

     a hydrofluoric acid counter, which is the module's actual
     answer to them. Rifles do not work. Fire does not work.
     Acid works. The whole of scenario one is the players
     finding that out at a cost.
   ============================================================ */

const SHRIEK = [
  { say: "It draws breath in a way nothing with lungs does, and then the sound arrives — above hearing, behind the eyes, and inside the bone of the skull.", tone: "horror" },
  {
    save: "sanity", why: "the Shriek",
    onFail: [
      { stress: 1, why: "something got in" },
      { track: "shriek" },
      { whisper: "It went through you and left something behind. You do not feel any different. That is the part you will remember later." },
    ],
    onPass: [{ say: "It goes through you and finds nothing to hold on to.", tone: "good" }],
  },
];

const ACID_COUNTER = {
  id: "acid", label: "Throw the acid at it", when: "tag:acid",
  hint: "hydrofluoric acid", whenText: "Not with anything you are carrying.",
  roll: "instinct", endsCombat: false,
  onBreak: [
    { say: "The carapace goes to grey slurry where it lands. It screams — properly screams, with a mouth — and everything about the way it is standing changes.", tone: "good" },
    { damage: "3d10", target: "threat" },
  ],
  onHold: [{ say: "It gets a claw up and takes the splash on the shell of it. The shell smokes. It does not stop coming.", tone: "warden" }],
};

export const threats = {
  carc: {
    name: "CARCINID",
    combatLabel: "SOMETHING THE SIZE OF A CAR, AND JOINTED",
    combat: 75, instinct: 75, speed: 60,
    maxHits: 2, maxDmg: 20, armor: 30,
    tactics: "isolated", morale: 0.5, breaksOff: true,
    hearsNoise: true, noiseDraw: 0.5,
    brokenText:
      "It takes the wound, reconsiders the entire encounter in about a quarter of a second, and withdraws — "
      + "not fleeing, exactly. Going to think about it somewhere else.",
    note:
      "Aramid fibre weave carapace: bulletproof and flameproof. Weakness: hydrofluoric acid. Almost never fight "
      + "one of these to the end — one Wound and it changes tactics. Always remind the players they can run.",
    attacks: [
      {
        name: "Claw", dmg: "4d10", weight: 4,
        text: "It does not swing so much as arrive, and the claw goes through whatever it meets.",
        crit: { dmg: "6d10", text: "It takes hold of a limb and simply keeps going with it.", save: "body", onFailDmg: "2d10" },
      },
      { name: "Shriek", dmg: "0", weight: 2, text: "It stops, braces, and opens.", effects: SHRIEK },
    ],
    onFirstContact: [
      { say: "Every instinct you have is telling you the wrong thing, because nothing you have ever been frightened of was shaped like this.", tone: "horror" },
      { save: "fear", onFail: [{ stress: 2, why: "you have seen one now" }] },
      { flag: "seen_carc" },
    ],
    counters: [ACID_COUNTER],
    onSlain: [
      { say: "It comes apart in sections and stops. Somewhere in the walls, something else registers that it has stopped.", tone: "good" },
      { xp: 2 },
    ],
  },

  hatchling: {
    name: "CARCINID HATCHLING",
    combatLabel: "SOMETHING NEW, AND STILL WET",
    combat: 35, instinct: 35, speed: 45,
    maxHits: 2, maxDmg: 20, armor: 0,
    tactics: "nearest", morale: 0.5,
    note: "Shell has not hardened. No armour, and it takes [-] on everything for its first round. This is the only carc the crew can reliably kill with what they brought.",
    attacks: [
      { name: "Claw", dmg: "2d10", weight: 5, text: "It comes at you sideways and badly, and it is still fast enough to be a problem." },
      { name: "Shriek", dmg: "0", weight: 1, text: "It tries the sound, and gets it right.", effects: SHRIEK },
    ],
    counters: [ACID_COUNTER],
  },

  abara: {
    name: "WHAT IS LEFT OF SGT ABARA",
    combatLabel: "IT IS STILL WEARING THE BANDOLIER",
    combat: 75, instinct: 75, speed: 60,
    maxHits: 2, maxDmg: 20, armor: 30,
    tactics: "nearest", morale: 0.5, breaksOff: true, start: "garage",
    ambushes: false,
    note:
      "Digging in the garage and ignoring everything. It has a squad leader's frag bandolier across the front of "
      + "it — five grenades, and setting them off at once will do what the crew's rifles cannot. It is standing in "
      + "a puddle, under a downed power line, next to a generator somebody could restart.",
    attacks: [
      { name: "Claw", dmg: "4d10", weight: 4, text: "It stops digging. That is the whole of the warning you get." },
      { name: "Shriek", dmg: "0", weight: 1, text: "It braces against the hole and opens.", effects: SHRIEK },
    ],
    counters: [
      ACID_COUNTER,
      {
        id: "bandolier", label: "Shoot the grenades on its chest", when: "tag:WPN",
        hint: "five frags, across the front of it", roll: "instinct", endsCombat: true,
        onBreak: [
          { say: "The bandolier goes all at once. The garage takes most of it and you take the rest.", tone: "horror" },
          { damage: "2d10", why: "you were in the room for that" },
          { threat: { id: "abara", dead: true } },
          { flag: "abara_dead" },
        ],
        onHold: [{ say: "The round goes wide and buries itself in the mud wall of the hole. Now it is looking at you.", tone: "warden" }],
      },
      {
        id: "electrify", label: "Drop the power line into the water", when: "flag:generator_on",
        hint: "it is standing in a puddle", roll: "speed", endsCombat: true,
        onBreak: [
          { say: "The cable goes into the standing water and the whole floor of the garage lights up white. It locks rigid, every joint at once, and goes over.", tone: "good" },
          { threat: { id: "abara", hits: 1, dmg: 18 } },
          { flag: "abara_down" },
        ],
        onHold: [{ say: "The cable whips into the mud a metre short and earths itself harmlessly. It has noticed you now.", tone: "warden" }],
      },
    ],
  },

  ziegler: {
    name: "WHAT IS LEFT OF DR ZIEGLER",
    combatLabel: "IT IS HOLDING SOMETHING IN ONE CLAW",
    combat: 75, instinct: 75, speed: 60,
    maxHits: 2, maxDmg: 20, armor: 30,
    tactics: "weakest", morale: 0.5, breaksOff: true, start: "clean",
    ambushes: false,
    note:
      "Behind the glass, doing something with its back to the door. It is holding a vial of hydrofluoric acid and "
      + "it does not know what that is any more. It takes a full minute to notice anyone, and when it turns it "
      + "says three words in a voice that is nearly a person's.",
    onSighted:
      "It turns around slowly, the way a person does when they are busy, and what is left of the face works "
      + "through something that used to be speech.",
    attacks: [
      { name: "Claw", dmg: "4d10", weight: 4, text: "It reaches through the space between you as though the space were not there." },
      { name: "Shriek", dmg: "0", weight: 2, text: "It braces on the bench and opens.", effects: SHRIEK },
    ],
    counters: [ACID_COUNTER],
    onSlain: [
      { say: "It stops. The vial goes down onto the tile, and does not break.", tone: "good" },
      { give: ["acidvial"] },
    ],
  },

  hinton: {
    name: "HINTON",
    combatLabel: "THE SCIENCE OFFICER",
    combat: 75, instinct: 85, speed: 70,
    maxHits: 3, maxDmg: 20, armor: 5,
    tactics: "loudest", morale: 0.2,
    note:
      "He does not want this fight and gains nothing from it. If the crew are respectful and ask to leave, he "
      + "lets them go — he does not regard them as significant. Play him as pragmatic and ambitious, never as a "
      + "villain enjoying himself.",
    attacks: [
      { name: "Pulse Rifle", dmg: "3d10", weight: 5, text: "He shoots the way a synthetic shoots, which is to say once, correctly, without any of the parts a person would put in." },
    ],
    onSlain: [
      { say: "He goes down mid-sentence, and the sentence was about you. Something under the chest plate is still warm and still running.", tone: "good" },
      { give: ["logiccore"] },
      { flag: "hinton_dead" },
      { xp: 4 },
    ],
  },

  retinue: {
    name: "HINTON'S RETINUE",
    combatLabel: "THEY MOVE AT THE SAME TIME AS EACH OTHER",
    combat: 85, instinct: 75, speed: 65,
    maxHits: 3, maxDmg: 30, armor: 30,
    tactics: "nearest", count: 2,
    note: "Bigger, older, and coordinated in a way the ones on the surface are not. They do not break off.",
    attacks: [
      { name: "Claw", dmg: "5d10", weight: 4, text: "Two of them commit to the same movement at the same instant, from different sides of you." },
      { name: "Shriek", dmg: "0", weight: 1, text: "They open together, and the sound has structure in it.", effects: SHRIEK },
    ],
    counters: [ACID_COUNTER],
  },

  noble: {
    name: "CARCINID NOBLE",
    combatLabel: "IT IS STANDING UP, AND IT HAS NOT FINISHED",
    combat: 95, instinct: 95, speed: 40,
    maxHits: 10, maxDmg: 100, armor: 100,
    tactics: "random",
    note:
      "This is not an encounter to be won and the book is explicit that it is not meant to be. It exists so the "
      + "players can see it and decide. Running is the correct answer and should be honoured immediately.",
    attacks: [
      {
        name: "Claw", dmg: "0", weight: 3,
        text: "It moves one limb, without hurry, across a distance that should have taken it much longer.",
        effects: [{ save: "body", mode: "disadvantage", onFail: [{ damage: "200", why: "it reached you" }], onPass: [{ say: "You are not where it put the limb. You do not entirely understand how.", tone: "good" }] }],
      },
      {
        name: "Assimilation", dmg: "0", weight: 2,
        text: "It turns the great shrouded weight of its head, and attends to you specifically.",
        effects: [
          { save: "sanity", why: "it is looking at you", onFail: [{ run: "assimilate" }], onPass: [{ stress: 2, why: "it looked at you and lost interest" }] },
        ],
      },
    ],
  },

  maascarc: {
    name: "WHAT IS LEFT OF MAAS",
    combatLabel: "IT IS COMING OUT OF THE LIAISON'S CHAIR",
    combat: 55, instinct: 55, speed: 55,
    maxHits: 2, maxDmg: 20, armor: 30,
    tactics: "nearest", morale: 0.5,
    note:
      "In the crew's own ship, in a compartment full of things that keep them alive. Every shot fired in here is "
      + "a shot into hull, and the players should be told so before the first one.",
    attacks: [
      { name: "Claw", dmg: "4d10", weight: 4, text: "It comes out of the chair still holding the stylus." },
      { name: "Shriek", dmg: "0", weight: 1, text: "It braces against the bulkhead and opens.", effects: SHRIEK },
    ],
    counters: [ACID_COUNTER],
  },

  grunt: {
    name: "ASSIMILATED MARINE",
    combatLabel: "SOMEBODY IN COLONY FATIGUES",
    combat: 30, instinct: 25, speed: 40,
    maxHits: 1, maxDmg: 10, armor: 5,
    tactics: "nearest", morale: 0.3,
    note:
      "Stage 4. Cannot speak, cannot manage anything complicated, and can absolutely open a door or pull a pin. "
      + "Hinton is not good at driving these and it shows.",
    attacks: [
      { name: "Pulse Rifle", dmg: "3d10", weight: 3, text: "The weapon comes up in roughly the right direction and the trigger gets pulled." },
    ],
  },
};
