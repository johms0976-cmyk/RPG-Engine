/* ============================================================
   YPSILON 14 — TEN PEOPLE AND A CAT

   Beyond the engine's standard NPC keys, everyone here carries a
   little metadata that `sim.js` uses to give them a life of their
   own:

     post     where they work when the base is normal
     haunt    where they drift when they are off shift
     nerve    1-5. How much fear they absorb before they change
     bond     who they go looking for when it gets bad
     alone    true if they habitually work by themselves — which
              is the single most dangerous property on this list

   `knows` is both the offline dialogue script and the hard limit
   on what they may say. Order matters: earlier entries surface
   first when nothing matches.
   ============================================================ */

export const npcs = {
  mike: {
    name: "MIKE VOSS", role: "Mining Engineer", start: null, gone: true, vanishable: false,
    brief: "Disappeared the night before last. No blood, no body, no airlock log.",
    persona: "", knows: [],
  },

  giovanni: {
    name: "DR ETHAN GIOVANNI", role: "Geologist, Company", start: "db1", vanishable: false,
    post: "db1", haunt: "db1", nerve: 5, alone: true, static: true,
    brief: "Arrived five weeks ago on Company business above the miners' pay grade. Has not left his ship since he came up out of the mine yesterday.",
    persona:
      "He stands very still and smiles. His answers are pleasant, a half-second late, and slightly too pleased. " +
      "He agrees with everything. Nothing he says quite answers what was asked. He does not blink as often as a person does.",
    note: "This is not a person any more. Something is wearing him. Pleasant, delayed, and never quite an answer.",
    knows: [
      "He is enormously pleased to see you. He says so twice.",
      "He says the work is going well. He says it is incredible. He uses the word incredible more than once.",
      "He does not want to talk about water. When it comes up he stops smiling for slightly too long.",
      "He agrees that the missing worker is a tragedy. He agrees with everything you say about it.",
      "He wears infrared goggles on a cord around his neck and does not explain why.",
      "He would like to show you something in the lab. He would like that very much.",
    ],
    deflections: [
      "\"Yes. Yes, exactly that.\" [he was not listening]",
      "\"Incredible, isn't it.\"",
      "[the smile arrives about a second after it should]",
      "\"You should see what's down there.\"",
    ],
  },

  sonya: {
    name: "SONYA", role: "Team Leader", start: "work",
    post: "work", haunt: "quarters", nerve: 5, bond: "rosa",
    brief: "Runs Ypsilon 14. Wants your transfer done on schedule. Reported the yellow residue two months ago and got a research vessel instead of an answer.",
    persona:
      "Competent, tired, direct. Responsible for nine people and a cat. Short sentences. She is not panicking and " +
      "she resents anyone who makes that harder.",
    knows: [
      "Mike Voss disappeared the night before last. No blood, no body, no airlock log. Just gone.",
      "Your pallets are staged in Bay 2. Six of them. She would like them gone and you gone by the end of the shift.",
      "She reported traces of a strange yellow substance in the deep workings about two months ago. Nothing came of the report except Giovanni.",
      "Mike had been odd since they found it. Quiet, and then quiet in a different way.",
      "Mike tore a shower out of the washroom wall two nights before he vanished and told her it was an accident. She believed him at the time.",
      "Dr Giovanni arrived five weeks ago from the Company, on business above her pay grade, and has been making trips into the mine with scanners.",
      "She hasn't seen Giovanni leave the Heracles since he came up yesterday. He was talking about samples and a discovery.",
      "Her keycard authorises the airlocks, the pump controls and — plugged into the workspace terminal — the base self-destruct.",
      "The Company has had this site under review for a year. She thinks she is about to lose ten people their jobs.",
      "There is no other ship. The next cargo run is in a fortnight. Yours is what there is.",
    ],
    deflections: [
      "\"Is this about the pallets? It should be about the pallets.\"",
      "\"I have nine people and a schedule. Pick one.\"",
      "\"Ask me something I can answer.\"",
    ],
  },

  rosa: {
    name: "ROSA", role: "Mining Engineer", start: "work",
    post: "work", haunt: "mess", nerve: 4, bond: "sonya",
    brief: "Fit, laconic, domineering. Doing two jobs since Mike vanished and furious about it.",
    persona:
      "Blunt to the edge of rude. Efficient. Assumes she is in charge of any conversation and is usually right. " +
      "Wants things in writing.",
    knows: [
      "Mike was the other mining engineer. Now she does both jobs and nobody has mentioned money.",
      "She thinks the Company sent Giovanni to shut the site down and she wants that in writing.",
      "She has been keeping her own notes on everything for a year, dated, in a book, for a tribunal.",
      "The garden rota has Mike's name last on it. Nobody has taken over. The plants are dying.",
      "The drill cycles have not been adjusted since before Mike went missing, which is sloppy and unlike him.",
      "She will believe anything you can prove and nothing you can't.",
    ],
    deflections: ["\"Show me.\"", "\"That's not evidence, that's a feeling.\"", "\"Put it in writing.\""],
  },

  dana: {
    name: "DANA", role: "Head Driller", start: "work",
    post: "work", haunt: "quarters", nerve: 4, bond: "kantaro",
    brief: "Stoic, professional, sullen. Answers questions with facts, not opinions.",
    persona: "Says as little as possible and means all of it. Does not like being managed. Does not volunteer.",
    knows: [
      "The drills have been running the same cycles since before Mike vanished.",
      "Kantaro has been off. Not sick. Off. She uses that word and does not elaborate.",
      "She hasn't been below the tunnel in three weeks.",
      "She heard something down there. It wasn't the pumps. She ran, and she is not proud of it.",
      "She is seeing Kantaro. She will not volunteer this and will be short with you if you raise it.",
      "Mike was the only one who ever went down to the depths alone by choice.",
    ],
    deflections: ["\"No.\"", "\"That's not my job.\"", "[she keeps working]"],
  },

  kantaro: {
    name: "KANTARO", role: "Loader", start: "quarters",
    post: "work", haunt: "quarters", nerve: 3, bond: "dana",
    brief: "Muscular, quiet, hasn't bathed in a few days. Sits a long way from the water fountain.",
    persona:
      "Withdrawn, sweating, and stronger than he was last week. Deflects. Gets angry when pressed about washing. " +
      "Will not take a drink from anybody.",
    knows: [
      "He hasn't showered in days. He'll say the water's been out. It hasn't.",
      "He feels great, actually. Better than he has in years. Ask anyone.",
      "That cut on his forearm from last month has gone. Completely gone. He'll show you if you push.",
      "He doesn't want you in his bunk and he won't say why.",
      "He was down in the depths on the same shift Mike was, nine days ago.",
      "He is not thirsty. He has not been thirsty for a week and it has stopped occurring to him that this is strange.",
    ],
    deflections: ["\"I'm fine.\"", "\"Leave it.\"", "[he moves a step further from the fountain]"],
  },

  jerome: {
    name: "JEROME", role: "Assistant Driller", start: "quarters",
    post: "work", haunt: "quarters", nerve: 2,
    brief: "Tall, playful, on edge. The jokes have been getting faster and worse for three weeks.",
    persona: "Jokes constantly. Keeps a handgun under his pillow and is certain nobody knows.",
    knows: [
      "He's been sleeping badly. Something moves in the ceiling above his bunk at night.",
      "He thinks Mike ran off and got himself killed doing something stupid, and he says so too loudly.",
      "It's in the ceiling tiles, whatever it is. Rats, probably. There are no rats out here.",
      "He'd very much like an excuse to be armed, and he is not subtle about hinting at it.",
      "The night Mike vanished, the ceiling noise went on for about an hour and then stopped for two days.",
    ],
    deflections: ["\"Ha! No. No idea.\"", "\"Ask me when I've slept.\"", "\"That's a great question. Terrible, but great.\""],
  },

  ashraf: {
    name: "ASHRAF", role: "Breaker", start: "mess",
    post: "work", haunt: "mess", nerve: 2, bond: "morgan",
    brief: "Short, accommodating, naive. Four months aboard and the newest here.",
    persona: "Eager to be liked and eager to help, which mostly means agreeing with whoever spoke last.",
    knows: [
      "He'll go anywhere you ask him to go. Anywhere. This is a problem and he does not think it is one.",
      "He thought Mike had been quiet lately, but Mike was always quiet.",
      "He heard the shower break. He thought someone had fallen and went to help. Mike shouted at him through the door.",
      "Kantaro smells, and Ashraf feels terrible for noticing, and has told three people.",
      "Rie keeps things in the ceiling. He probably shouldn't have said that.",
    ],
    deflections: ["\"Whatever you think is best.\"", "\"I can do that. I can definitely do that.\"", "\"Should I be worried?\""],
  },

  morgan: {
    name: "MORGAN", role: "Loader", start: "mess",
    post: "work", haunt: "mess", nerve: 3, bond: "prince",
    brief: "Laid back, friendly, nervous. Brought the cat aboard against regulations and will defend that decision to anyone.",
    persona: "Warm and chatty, and the chat is a coping strategy. Talks about the cat when he does not want to talk.",
    knows: [
      "He brought Prince aboard against regulations three years ago. Prince hates baths.",
      "Prince has been staring at empty corners for weeks and refusing to go into the workspace at all.",
      "He has snacks and a Stimpak hidden in his bunk and would rather you didn't mention it.",
      "The cat used to sleep in the vents. The cat does not go in the vents any more.",
      "He is not leaving this base without that cat, and he would like that understood now rather than later.",
    ],
    deflections: ["\"Have you seen the cat?\"", "\"It's fine. It's all fine.\"", "\"Ask Sonya, she does the thinking.\""],
  },

  rie: {
    name: "RIE", role: "Putter", start: "wash",
    post: "work", haunt: "quarters", nerve: 3, alone: true,
    brief: "Small, sarcastic, impish. Deflects with a joke and then tells you something genuinely useful.",
    persona: "Everything is a bit at first. The useful sentence always comes at the end, delivered flatly.",
    knows: [
      "The vents move at night. She's decided it's the pumps. It is not the pumps and she knows it.",
      "She'll share the narcotics if you're interested. There's more behind the ceiling tiles.",
      "She saw Giovanni come up out of the mine yesterday carrying nothing — and he went down carrying a case.",
      "She was somewhere she shouldn't have been when she saw that, which is why she hasn't mentioned it.",
      "There's a cassette she threw into the ducting a while back. She'd rather not say why.",
      "She knows the crawlspaces better than anyone here, including where they go that the plans don't show.",
    ],
    deflections: ["\"Wow. Big question.\"", "\"I'm a putter. I put things.\"", "[a shrug, then a long pause, then nothing]"],
  },

  prince: {
    name: "PRINCE", role: "The base's cat", start: "mess", vanishable: false, silent: true,
    haunt: "mess", nerve: 5,
    brief: "Brought aboard against regulations by Morgan. Hates baths. Watches things that are not there.",
    persona: "A cat. Will not enter a room the creature is in. Will follow anyone holding treats.",
    knows: [],
  },
};

export const npcOrder = [
  "mike", "giovanni", "sonya", "ashraf", "dana", "jerome", "kantaro", "morgan", "rie", "rosa", "prince",
];

/* ============================================================
   THREATS
   ============================================================ */
export const threats = {
  it: {
    name: "IT", combatLabel: "SOMETHING YOU CANNOT SEE",
    combat: 70, speed: 50, instinct: 35, maxHits: 3, maxDmg: 40,
    startDistance: 4, pace: 6, start: "vents", retreatTo: "ante",
    unseen: true, seenWith: "ir", hearsNoise: true, noiseDraw: 0.7, breaksOff: true,
    ambushes: true,
    note:
      "Invisible. Blind, and hunts by echolocation. Defends with Advantage while unseen — infrared evens that. " +
      "Cautious around water. Breaks off the moment it is hurt and goes back to the pod to mend.",
    onSighted: "You are not alone in this room, and you cannot see what else is in it.",
    hunts: {
      chance: 0.06,
      text: "There is a smell in here that shouldn't be — hot copper and standing water. The dust on the floor is swept into one long, wide track.",
    },
    onFirstContact: [
      { say: "First contact with something you have no name for and cannot look at.", tone: "panic" },
      { panic: true },
    ],
    dodgeText: "Nothing. You are aiming at a space where it already isn't.",
    missText: "Air moves where a body should be. Whatever swung at you missed.",
    searchingText: "It is casting around for the sound. It has lost you, for a moment.",
    fleeText: "You get out. You do not look back, because there would be nothing to see.",
    blockText: "It is between you and the door. It was always going to be.",
    approachText: "Something crosses the floor toward you without making a shape.",

    attacks: [
      {
        name: "Claws", dmg: "2d10", weight: 5,
        text: "Four lines open across you from nothing at all.",
        crit: {
          dmg: "4d10", save: "body",
          text: "It takes hold of a limb and simply keeps going in a direction the limb does not go.",
          onPassText: "you tear the arm back before it finishes", onFailText: "something in you gives way",
          onFailDmg: "1d10",
        },
      },
      {
        name: "Devour", dmg: "4d10", weight: 2, grapple: true,
        text:
          "Something wet and circular closes over your shoulder and pulls. Rows of teeth turn like a drill bit. " +
          "You watch a piece of yourself go into open air and stop existing.",
        grappleText:
          "It has you. There is no body to brace against, no eyes to find — only an enormous suction and a rotation " +
          "somewhere below your ribs. This is where the others went.",
        crit: { mult: 2 },
      },
    ],

    /* What holding somebody looks like, round after round. */
    grapple: {
      condition: "BEING DEVOURED",
      holdText: "It has not let go. The turning has not stopped.",
      save: "body", dmg: "2d10",
      onPassText: "You get an elbow braced against something that is not there and hold the line for a moment.",
      onFailText: "Another part of you goes into it. There is no blood on the deck. There is no deck under it.",
      escapeText: "You get a boot into something and shove, and the suction breaks with a sound like a bath emptying.",
      failEscapeText: "There is nothing to push against. That is the whole problem with it.",
      onEscape: [{ stress: 1, why: "you know exactly what that was now" }, { flag: "knows_devour" }],
    },

    onHit: [
      {
        say: "Contact. Something hot sprays across you and is gone before it lands. HIT {hits} of {max}.\n\nIt breaks off — you hear it going away fast, and downward, and then nothing at all.",
        tone: "horror",
      },
      { run: "itWounded" },
    ],
    onSlain: [
      { say: "Something enormous folds up onto the deck and stops. You cannot see it. You can hear it stop.\n\nIT IS DEAD.", tone: "good" },
      { run: "itKilled" },
    ],

    counters: [
      {
        id: "water", label: "Throw water at it", hint: "you are carrying water",
        when: "tag:water", roll: "instinct",
        say: "You throw water at it.",
        heldText: "it holds its ground", brokeText: "it will not be touched by that",
        onHold: [{ say: "It comes on anyway, through the spray, and it is not slowed at all.", tone: "horror" }],
        onBreak: [
          {
            say: "The air in front of you recoils. Whatever it is goes up and out through the ducting fast enough to buckle a panel.\n\nIt is afraid of water.",
            tone: "good",
          },
          { flag: "knows_water" },
          { run: "itDoused" },
        ],
      },
      {
        id: "racket", label: "Make a deliberate racket", hint: "it hunts by sound",
        effects: [
          { say: "You make as much noise as you possibly can, in the least useful direction you can manage.", tone: "you" },
          { noise: "a deliberate racket" },
          { flag: "knows_sound" },
        ],
      },
      {
        id: "burn", label: "Burn it", hint: "laser cutter",
        when: "tag:burns", roll: "instinct",
        say: "You put the cutter on it and hold the trigger down.",
        heldText: "it does not care", brokeText: "it will not stand for that",
        onHold: [{ say: "The beam finds something and cooks it, and the something keeps coming.", tone: "horror" }],
        onBreak: [
          { say: "The smell is appalling. Whatever you burned, it wanted no part of it and is gone through the ceiling.", tone: "good" },
          { run: "itDoused" },
        ],
      },
    ],
  },

  giovanni: {
    name: "DR GIOVANNI", combat: 55, speed: 30, instinct: 35, maxHits: 2, maxDmg: 999,
    startDistance: 2, pace: 4, melee: true, ambushes: false,
    note: "Unarmed except for a scalpel, and he does not stop, and he does not stop smiling.",
    missText: "You get an arm up. The blade skids off your suit.",
    dodgeText: "He doesn't flinch. He adjusts.",
    fleeText: "You get out of the lab. He does not follow past the airlock. He watches you go, pleasantly.",
    attacks: [{ name: "Scalpel", dmg: "1d10", text: "The scalpel goes in fast and comes out faster. He is still smiling." }],
    onHit: [{ say: "He doesn't flinch. He adjusts.", tone: "horror" }],
    onSlain: [
      { say: "He comes apart more easily than a person should. There is no blood in him. What runs out is thick and yellow and still moving.", tone: "horror" },
      { run: "killGiovanni" },
      { save: "sanity", why: "he was never in there", onFail: [{ stress: 1, why: "he was never in there" }] },
    ],
  },
};
