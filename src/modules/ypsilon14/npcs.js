export const npcs = {
  mike: { name: "MIKE VOSS", role: "Mining Engineer", start: null, gone: true, vanishable: false, brief: "Disappeared last night. Nobody knows why, or where he is.", persona: "", knows: [] },

  giovanni: {
    name: "DR ETHAN GIOVANNI", role: "Geologist, Company", start: "db1", vanishable: false,
    brief: "Arrived a month ago on Company business above the miners' pay grade. Frequent trips into the mine with scanners and equipment. Hasn't left his ship since emerging from the mine yesterday.",
    persona: "He is standing very still and smiling. His answers are pleasant, slightly too slow, and slightly too pleased. He agrees with everything. Nothing he says quite answers what was asked. He does not blink as often as a person does.",
    note: "This character is not a person any more. Something is wearing him. Keep the dialogue pleasant, slightly delayed, and never quite an answer.",
    knows: [
      "He is enormously pleased to see you.",
      "He says the work is going well. He says it is incredible. He uses the word incredible more than once.",
      "He does not want to talk about water.",
      "He wears infrared goggles on a cord around his neck and does not explain why.",
    ],
  },

  sonya: {
    name: "SONYA", role: "Team Leader", start: "work",
    brief: "Wants to find out what's going on. Reported traces of a strange yellow substance in the mine a couple of months ago and hasn't thought much about it since.",
    persona: "Competent, tired, direct. Responsible for nine people and one cat. Speaks in short sentences. She is not panicking, and she resents anyone who makes that harder.",
    knows: [
      "Mike Voss disappeared last night. No blood, no body, no airlock log. Just gone.",
      "She reported traces of a strange yellow substance found in the mine a couple of months ago. Nothing came of it.",
      "Mike had been acting a little odd since they found it.",
      "Mike broke a shower in the washrooms the night before he vanished, and told her it was an accident. She believed him at the time.",
      "Dr Giovanni arrived a month ago from the Company, on business above the miners' pay grade. He's been making frequent trips into the mine with scanners.",
      "She hasn't seen Giovanni leave his ship since yesterday. He was talking about samples and a discovery.",
      "Her keycard authorises airlock use and, plugged into the workspace computer, the base self-destruct.",
    ],
  },

  ashraf: {
    name: "ASHRAF", role: "Breaker", start: "mess", brief: "Short, accommodating, naive.",
    persona: "Eager to be liked and eager to help, which mostly means agreeing with whoever spoke last. Volunteers for things he shouldn't.",
    knows: [
      "He'll go anywhere you ask him to go, which is a problem.",
      "He thought Mike had been quiet lately, but Mike was always quiet.",
      "He heard the shower break. He thought someone fell.",
    ],
  },

  dana: {
    name: "DANA", role: "Head Driller", start: "work", brief: "Stoic, professional, sullen.",
    persona: "Says as little as possible and means all of it. Answers questions with facts, not opinions. Does not like being managed.",
    knows: [
      "The drills have been running the same cycles since before Mike vanished.",
      "She's seeing Kantaro. She won't volunteer this.",
      "Kantaro has been off. Not sick. Off.",
      "She hasn't gone down past the tunnel in weeks. She doesn't say why.",
    ],
  },

  jerome: {
    name: "JEROME", role: "Assistant Driller", start: "quarters", brief: "Tall, playful, on edge.",
    persona: "Jokes constantly, and the jokes are getting worse and faster. Keeps a handgun under his pillow and does not think anyone knows.",
    knows: [
      "He's been sleeping badly. Something moves in the ceiling at night.",
      "He thinks Mike ran off and got himself killed doing something stupid.",
      "He'd very much like an excuse to be armed.",
    ],
  },

  kantaro: {
    name: "KANTARO", role: "Loader", start: "quarters", brief: "Muscular, quiet. Hasn't bathed in a few days.",
    persona: "Withdrawn, sweating, and physically stronger than he was last week. Deflects. Gets angry when pressed about washing. Sits too far from the water fountain.",
    knows: [
      "He hasn't showered in days. He'll say the water's been out. It hasn't.",
      "He feels great, actually. Better than ever. Ask anyone.",
      "He's been leaving tissues by his bed and he doesn't want you in his bunk.",
      "He was down in the depths the same shift Mike was.",
    ],
  },

  morgan: {
    name: "MORGAN", role: "Loader", start: "mess", brief: "Laid back, friendly, nervous.",
    persona: "Warm and chatty, and the chat is a coping strategy. Brought the cat aboard against regulations and will defend that decision to anyone.",
    knows: [
      "He brought Prince aboard against regulations. Prince hates baths.",
      "Prince has been staring at empty corners of rooms and refusing to enter the workspace.",
      "He has snacks and a Stimpak hidden in his bunk and would rather you didn't mention it.",
    ],
  },

  rie: {
    name: "RIE", role: "Putter", start: "wash", brief: "Small, sarcastic, impish.",
    persona: "Deflects everything with a joke, then tells you something genuinely useful at the end of it. Supplies the crew with narcotics from a friendly cargo captain.",
    knows: [
      "Rie will share the narcotics if you're interested.",
      "Rie has heard the vents move at night and has decided it's the pumps.",
      "Rie saw Giovanni come up out of the mine yesterday carrying nothing, when he went down carrying a case.",
    ],
  },

  rosa: {
    name: "ROSA", role: "Mining Engineer", start: "work", brief: "Fit, laconic, domineering.",
    persona: "Blunt to the edge of rudeness. Efficient. Assumes she's in charge of any conversation and is usually right.",
    knows: [
      "Mike was the other mining engineer. Now she does both jobs.",
      "The garden rota has Mike's name last on it. Nobody has taken over.",
      "She thinks the Company sent Giovanni to shut the site down and she wants that in writing.",
    ],
  },

  prince: {
    name: "PRINCE", role: "The base's cat", start: "mess", vanishable: false, silent: true,
    brief: "Brought aboard against regulations by Morgan. Hates baths. Can see the monster.",
    persona: "A cat. Watches things that are not there. Will not enter a room the creature is in.",
    knows: [],
  },
};

export const npcOrder = ["mike", "giovanni", "sonya", "ashraf", "dana", "jerome", "kantaro", "morgan", "rie", "rosa", "prince"];

export const threats = {
  it: {
    name: "IT", combatLabel: "SOMETHING YOU CANNOT SEE",
    combat: 70, speed: 50, instinct: 35, maxHits: 3, maxDmg: 40,
    unseen: true, seenWith: "ir", hearsNoise: true, breaksOff: true,
    note: "It defends with Advantage while it is unseen — infrared evens that.",
    onSighted: "You are not alone in this room, and you cannot see what else is in it.",
    hunts: { chance: 0.1, text: "There is a smell in here that shouldn't be — hot copper and standing water. The dust on the floor is swept into one long, wide track." },
    onFirstContact: [{ say: "First contact with something you have no name for.", tone: "panic" }, { panic: true }],
    dodgeText: "Nothing. You are aiming at a space where it already isn't.",
    missText: "Air moves where a body should be. Whatever swung at you missed.",
    searchingText: "It is casting around for the sound. It has lost you for a moment.",
    fleeText: "You get out. You do not look back, because there would be nothing to see.",
    blockText: "It is between you and the door. It was always going to be.",
    attacks: [
      { name: "Claws", dmg: "2d10", weight: 4, text: "Four lines open across you from nothing at all.",
        crit: { dmg: "4d10", text: "Something wet and circular closes over your shoulder and pulls. Rows of teeth turn like a drill bit. You watch a piece of yourself vanish into open air.", save: "body", onPassText: "you tear free", onFailText: "it takes another piece", onFailDmg: "2d10" } },
    ],
    onHit: [
      { say: "Contact. Something hot sprays across your visor and is gone. HIT {hits} of {max}.\n\nIt breaks off. You hear it going away, fast, downward — and then nothing.", tone: "horror" },
      { threat: { id: "it", loc: "ante", retreat: 60 } },
    ],
    onSlain: [{ say: "Something enormous folds up onto the deck and stops. You can't see it. You can hear it stop.\n\nIT IS DEAD.", tone: "good" }],
    counters: [
      {
        id: "water", label: "Throw water at it", when: "tag:water", roll: "instinct",
        say: "You throw water at it.",
        heldText: "it holds its ground", brokeText: "it will not be touched by that",
        onHold: [{ say: "It comes on anyway.", tone: "horror" }],
        onBreak: [
          { say: "The air in front of you recoils. Whatever it is, it goes up and out through the ducting fast enough to buckle a panel.\n\nIt is afraid of water.", tone: "good" },
          { flag: "knows_water" },
          { threat: { id: "it", loc: "vents", retreat: 20 } },
        ],
      },
      {
        id: "racket", label: "Make a deliberate racket",
        effects: [{ say: "You make as much noise as you possibly can.", tone: "you" }, { noise: "a deliberate racket" }],
      },
    ],
  },

  giovanni: {
    name: "DR GIOVANNI", combat: 55, speed: 30, maxHits: 2, maxDmg: 999,
    note: "He is unarmed except for a scalpel and he does not stop.",
    missText: "You get an arm up. The blade skids off your suit.",
    dodgeText: "He doesn't flinch. He adjusts.",
    fleeText: "You get out of the lab. He does not follow past the airlock.",
    attacks: [{ name: "Scalpel", dmg: "1d10", text: "The scalpel goes in fast and comes out faster. He is still smiling." }],
    onHit: [{ say: "He doesn't flinch. He adjusts.", tone: "horror" }],
    onSlain: [
      { say: "He comes apart more easily than a person should. There is no blood in him. What runs out is thick and yellow and still moving.", tone: "horror" },
      { run: "killGiovanni" },
      { save: "sanity", onFail: [{ stress: 1, why: "he was never in there" }] },
    ],
  },
};
