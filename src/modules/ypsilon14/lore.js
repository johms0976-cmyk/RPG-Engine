/* ============================================================
   YPSILON 14 — THE DOSSIER

   Everything a table will ask about, in one place, so the Warden
   never has to invent under pressure and never has to contradict
   themselves in session four of a campaign.

   Three columns for every person and every institution:

     public   — anyone on the base will tell you this
     private  — they will tell you if they like you, or if you ask
                the right question, or once they are frightened
     secret   — they will not tell you. You find it, or you never do.

   The engine reads `lore` only to display it in the Warden's
   screen. Nothing here is mechanical. Change any of it freely.
   ============================================================ */

export const lore = {
  /* ---------------------------------------------------------
     THE JOB THE PLAYERS ARE ACTUALLY ON
     --------------------------------------------------------- */
  job: {
    title: "CARGO RUN — YPSILON 14 TO GRETA BASE",
    employer: "The Company",
    summary:
      "Your ship is under Company charter, running for Samsa IV, where Greta Base stopped answering eleven days ago. " +
      "Ypsilon 14 is a fuel-and-freight stop on the way: sign for six pallets of consumables and medical stock, " +
      "load them, undock, and carry on. The stop is scheduled for four hours.",
    whyThisCrew:
      "Most of the ship is still in cryo. The Company does not thaw a full complement for a cargo transfer. " +
      "The players are the ones woken up to do the lifting, which is also why nobody senior is available to " +
      "make a decision for them, and why nobody is going to arrive to help.",
    theStakes:
      "The pallets are the only medical stock inside four weeks of Samsa IV. If they do not arrive, the next " +
      "module opens with a Greta Base that has no supplies — which the Warden should absolutely let happen if " +
      "the crew leave in a hurry, or blow the base with the cargo still on it.",
    handoff:
      "What carries into ANOTHER BUG HUNT: how many pallets were loaded, how many Ypsilon crew were taken off " +
      "alive, whether anyone is infected, whether the specimen case left the rock, and whether the Company was " +
      "told the truth.",
  },

  /* ---------------------------------------------------------
     THE COMPANY
     --------------------------------------------------------- */
  company: {
    public:
      "The Company owns the ship, the charter, the cryopods, the pallets, and the debt on the players' contracts. " +
      "It operates mining, shipping, research and security across the arm, and it is old enough that nobody " +
      "remembers what it originally sold.",
    private:
      "Ypsilon 14 is a marginal site. The ore ran thin two years ago and the base is kept open on a rolling " +
      "review that nobody has renewed and nobody has cancelled. The miners know they are being quietly wound down " +
      "and have been arguing about severance for a year.",
    secret:
      "Giovanni was not sent to assess the ore. A survey scan eighteen months ago logged a mass in the rock with a " +
      "regular internal structure, filed under a geology code and forgotten. Someone in the Company found the file. " +
      "Giovanni was sent to open it. Recovery of biological material takes precedence over the site, the crew, and " +
      "any ship that happens to be docked. That instruction is in his case, and the case is Company-sealed.",
    ifPlayersAskTheCompany:
      "Comms to Company traffic control run about forty minutes each way from here. Anything the players report " +
      "gets a receipt and no instructions. If they report a biological hazard, the receipt is unusually prompt.",
  },

  /* ---------------------------------------------------------
     THE CAMPAIGN, AS THE CREW WOULD KNOW IT
     --------------------------------------------------------- */
  campaign: {
    samsa: {
      public:
        "Samsa IV. A hot, wet, unfinished colony world about nine days out. Greta Base is the main settlement — " +
        "agricultural, a few hundred people, Company-run.",
      private:
        "Greta went quiet eleven days ago, mid-sentence, in a routine logistics burst. No distress call, no " +
        "evacuation traffic, no debris. The Company is describing it as a comms fault and has chartered exactly " +
        "one ship to go and look, which tells you what it actually thinks.",
      secret:
        "Nothing in this module answers what happened at Greta. Ypsilon 14 is not connected to it. The point of " +
        "the resemblance — a base that stopped answering, a thing nobody logged — is that the crew will arrive at " +
        "Samsa IV having already learned, in their bodies, that the Company's paperwork does not describe reality.",
    },
    whatYpsilonTeaches:
      "This is the tutorial. It teaches five things and each one is a load-bearing habit later: the clock costs " +
      "you more than the dice; the monster is a problem to be solved, not fought; the NPCs are people with " +
      "opinions and legs; Stress compounds and Panic is the real enemy; and the Company is not your ally.",
  },

  /* ---------------------------------------------------------
     THE BASE
     --------------------------------------------------------- */
  base: {
    public:
      "Ypsilon 14 is a metals operation on a rock about the size of a small town, in a lane nobody has any other " +
      "reason to be in. Eleven souls: ten crew and a cat. Automated drills work the seams; the crew maintain, " +
      "sort, and load. A cargo ship comes once a month. The next one is due in a fortnight.",
    private:
      "The base is nineteen years old and has been resurfaced twice. Everything is on its second service life. " +
      "The crew have been here between four months and six years, and they have run out of things to say to each " +
      "other. The rota is a serious document because it is the only structure anyone has.",
    secret:
      "Nine weeks ago a drill head broke into a cavity that was not on any survey: smooth black rock in arches " +
      "and whorls, and a pod set into the wall with something asleep in it. Sonya logged a strange yellow residue " +
      "and filed it. The Company answered by sending Giovanni. He cut the pod open on his eleventh day. It has " +
      "been awake and hungry for twenty-two days.",
    layoutNote:
      "Four pressurised compartments (workspace, quarters, mess, washrooms) share a vent system a person can " +
      "crawl through and something larger can move through faster. The mine below the workspace is vacuum: " +
      "vaccsuits past the mine entrance, and suit air is a clock the players will forget they are on.",
    timeline: [
      "Nine weeks ago — the drills open the cavity. Sonya logs yellow residue. The Company is informed.",
      "Five weeks ago — the research vessel Heracles docks in Bay 1. Dr Ethan Giovanni, geologist, Company.",
      "Three and a half weeks ago — Giovanni cuts the pod. It wakes. He does not report this.",
      "Three weeks ago — the thing begins moving in the vents at night. Jerome stops sleeping properly.",
      "Nine days ago — Kantaro takes goo on bare skin in the depths. He stops washing.",
      "Six days ago — Giovanni infects himself, deliberately, and records the log while it happens.",
      "Two days ago — Mike Voss, already infected, tears the shower out of the wall and cannot explain why.",
      "Yesterday — Giovanni comes up out of the mine carrying nothing and does not leave his ship again.",
      "Last night — Mike takes a laser cutter into the depths, burns SILENCE into the rock, and is eaten.",
      "This morning — the players dock at Bay 2 for a four-hour cargo transfer.",
    ],
  },

  /* ---------------------------------------------------------
     THE THING
     --------------------------------------------------------- */
  monster: {
    whatItIs:
      "A predator built for a long voyage between stars, held in stasis in a pod grown for the purpose, packed in " +
      "a repair medium that keeps it whole. It is not a demon and not a curse. It is an animal a very long way " +
      "from home, with a body that does not interact with light the way bodies do.",
    whatItWants: [
      "To eat. It has been awake twenty-two days on a rock with eleven warm things on it and it is rationing.",
      "To be whole. Wounds send it back to the pod and the goo, which is the one place it must go.",
      "To be dry. Water is the only thing on this base that frightens it.",
      "To be undisturbed. Sound is how it sees, so noise is both bait and blindness. It prefers a quiet base.",
    ],
    howItHunts:
      "It hunts by echolocation and it prefers isolated prey. It will follow a single person through the ducting " +
      "for an hour before deciding. Groups of three or more it watches and leaves alone. It takes people whole " +
      "and quietly, which is why there is no blood and no body — the victim goes into a digestive tract nobody " +
      "can see, in pieces, over about a minute.",
    itsMistake:
      "It carved nothing into the rock. Mike did that, in the last hour he was himself, as a warning and as a " +
      "request. The thing does not communicate and cannot be reasoned with. Do not let it become a character.",
    warden:
      "Never show it. Show the dust, the cat, the swinging vaccsuit hook, the radio that goes quiet mid-word, the " +
      "smell of hot copper and standing water. Infrared is the only sight anyone gets, and even that is a shape.",
  },

  /* ---------------------------------------------------------
     THE GOO
     --------------------------------------------------------- */
  goo: {
    public: "A thick yellow substance in the deep workings. Sonya reported it. Nothing came of the report.",
    private:
      "It heals. Anyone who takes it on skin finds their old injuries closing inside an hour and their strength " +
      "improving, and stops being able to bear the thought of water.",
    secret:
      "It is not a disease and it is not healing anybody. It is the pod's repair medium: it takes a body apart and " +
      "rebuilds it into something more useful to its owner. The strength is the rebuild. The aversion to water is " +
      "the rebuild. The melting, some hours later, is the rebuild finishing.",
    course:
      "Contact → aversion to water within minutes → wounds closed and unnatural strength within the hour → " +
      "between two and twenty hours later the body gives up its shape, a tenth of the person at a time, over " +
      "roughly an hour and a half. There is no cure on this base. Burning it works. Freezing it works. Drowning " +
      "it works. None of that helps a person who already has it inside them.",
  },

  /* ---------------------------------------------------------
     THE CAST
     --------------------------------------------------------- */
  cast: {
    sonya: {
      full: "SONYA IVERS · Team Leader · six years on Ypsilon, four as leader",
      public: "Runs the base. Signs for cargo. Wants the transfer done and the players gone on schedule.",
      private:
        "She has been fighting the Company about the site review for a year and believes she is about to lose ten " +
        "people their jobs. She filed the report on the yellow residue and got a research vessel instead of an " +
        "answer, which she has taken personally.",
      secret:
        "She has already written the letter that closes the site and has not sent it. She believes Mike walked out " +
        "of an airlock and that the missing log is a maintenance fault, because the alternative is that something " +
        "on her base took him and she did not notice.",
      willAdmit: "The residue report. Mike's odd behaviour. That Giovanni's clearance is above hers.",
      underPressure: "Becomes more precise, not less. Starts giving orders to the players, and they are good orders.",
      ifShownEvidence: "Believes it faster than anyone else on the base, and immediately calls everyone to the mess.",
      ifTaken: "The muster falls apart. Rosa tries to take over and Dana refuses her. Crew fear jumps.",
    },
    giovanni: {
      full: "DR ETHAN GIOVANNI · Geologist (nominal) · Company, five weeks aboard",
      public: "Company man, above the miners' pay grade, in and out of the mine with scanners for a month.",
      private:
        "Xenobiology, not geology. Sent to open something the Company found in an eighteen-month-old survey file. " +
        "Charming, incurious about people, and the only person here who understood what he was looking at.",
      secret:
        "He infected himself on purpose six days ago, believing he could document the process. He has been dead " +
        "for about thirty hours. What stands in the lab has his shape and his smile and no interior. It is not " +
        "possessed; it is a body being disassembled slowly enough to still be standing.",
      willAdmit: "Nothing useful. Pleasantries, delivered a half-second late, that never answer the question asked.",
      underPressure: "Agrees with everything. Will not discuss water. Lunges if anyone gets within reach.",
      onHisBody: "Infrared goggles on a cord. The sample case, sealed, warm, with his orders inside it.",
    },
    kantaro: {
      full: "KANTARO OYELARAN · Loader · fourteen months",
      public: "Big, quiet, hasn't washed in a few days, which people have started to mention.",
      private: "Seeing Dana. Neither of them has told anyone, and both of them think it is a secret.",
      secret:
        "He took goo on bare skin in the depths nine days ago and told nobody. He feels tremendous. He has stopped " +
        "being able to look at the water fountain. He has between two and twenty hours left and no idea.",
      willAdmit: "That the water has been out. It has not. That he feels better than ever. That is true.",
      underPressure: "Angry, then frightened, then very strong, and none of that helps him.",
      wardenNote:
        "Kantaro is the module's clock made flesh. If the players work him out early they can quarantine him and " +
        "spare the crew the scene. If they do not, he comes apart in front of whoever is standing nearest, and " +
        "that is the moment the base stops being a workplace.",
    },
    dana: {
      full: "DANA REYES · Head Driller · five years",
      public: "Stoic, professional, sullen. Answers questions with facts.",
      private: "Seeing Kantaro. Has noticed he is wrong and has decided not to look at it too closely.",
      secret: "She has not gone below the tunnel in three weeks because she heard something down there and ran.",
      willAdmit: "Drill cycles, shift records, that Kantaro is off. Not that she is frightened.",
      underPressure: "Goes and gets Kantaro. If he is dead, she goes into the mine alone, and she does not come back.",
    },
    jerome: {
      full: "JEROME ASANTE · Assistant Driller · two years",
      public: "Tall, playful, tells jokes that have been getting faster and worse for three weeks.",
      private: "Has not slept properly since something started moving in the ceiling above his bunk.",
      secret: "The handgun under his pillow is not licensed and he has been waiting for a reason to hold it.",
      willAdmit: "The ceiling. That he thinks Mike did something stupid and died of it.",
      underPressure: "Arms himself, and then fires at a noise in a corridor with people in it.",
      wardenNote: "If the players take the handgun early, they have quietly prevented a friendly-fire death.",
    },
    ashraf: {
      full: "ASHRAF BILAL · Breaker · four months, the newest aboard",
      public: "Short, eager, agrees with whoever spoke last.",
      private: "Desperate to be useful and to be liked, and will volunteer for anything to get either.",
      secret: "Nothing. He is exactly what he appears to be, which is what makes him dangerous to be around.",
      willAdmit: "Everything he knows, immediately, including things he was told in confidence.",
      underPressure: "Volunteers. If a player sends him somewhere alone, he goes, and the odds are bad.",
      wardenNote: "The lesson is not 'gotcha'. Let the players hear him agree cheerfully. Let them decide.",
    },
    morgan: {
      full: "MORGAN ELLERY · Loader · three years",
      public: "Warm, chatty, nervous. Brought the cat aboard against regulations and will fight about it.",
      private: "The chat is a coping strategy and he knows it. Has a snack cache and a Stimpak in his bunk.",
      secret: "He has watched Prince refuse to enter the workspace for two weeks and has not told anyone, because " +
        "saying it out loud would make it real.",
      willAdmit: "Everything about the cat. Eventually, what the cat has been doing.",
      underPressure: "Will not evacuate without Prince. Will go back for Prince. This is not negotiable.",
    },
    rie: {
      full: "RIE TANAKA · Putter · eleven months",
      public: "Small, sarcastic, impish. Deflects, then tells you something true on the way out.",
      private: "Supplies the crew with narcotics from an obliging cargo captain, and keeps the surplus in the ceiling.",
      secret: "Saw Giovanni come up out of the mine carrying nothing, six days after he went down carrying a case. " +
        "Has not mentioned it because she was somewhere she should not have been at the time.",
      willAdmit: "The vents move at night. It is probably the pumps. It is not the pumps.",
      underPressure: "Hides, competently, in the one part of the base the thing uses as a corridor.",
    },
    rosa: {
      full: "ROSA MBEKI · Mining Engineer · four years",
      public: "Blunt, efficient, assumes she is running any conversation and is usually right.",
      private: "Doing both engineering jobs since Mike vanished and is furious about the workload, not the man.",
      secret: "She is convinced the Company sent Giovanni to close the site and has been quietly documenting " +
        "everything for a tribunal. Her notes are better evidence than anything else on the base.",
      willAdmit: "The rota, the workload, her tribunal theory, at length.",
      underPressure: "Takes charge of the evacuation and will physically fight anyone arming a self-destruct " +
        "while her people are still inside.",
    },
    mike: {
      full: "MIKE VOSS · Mining Engineer · six years · unaccounted for",
      public: "Vanished the night before last. No blood, no body, no airlock log.",
      private: "Quiet, liked, last name on the garden rota, and had been strange for a couple of weeks.",
      secret:
        "Infected in the depths. Tore the shower out because he could not be near the water. Recorded a tape " +
        "asking to be fixed and threw it into the ducting. Took a laser cutter down into the depths, burned " +
        "SILENCE into the wall as a warning to the next person, and was eaten inside his own vaccsuit.",
      wardenNote: "Mike is the module's ghost and its best writing. Everything the players find is him trying.",
    },
    prince: {
      full: "PRINCE · the base's cat · aboard illegally for three years",
      public: "Hates baths. Hates the workspace lately. Watches corners.",
      secret: "He can see it perfectly well and has been managing around it for three weeks.",
      wardenNote:
        "Prince is the module's best instrument. He will not enter a room the thing is in, he stares at it, and " +
        "he will follow anyone with treats. A player who works this out has effectively built a monster detector " +
        "out of a cat, and should be rewarded lavishly for it.",
    },
  },

  /* ---------------------------------------------------------
     THINGS TABLES ACTUALLY ASK
     --------------------------------------------------------- */
  faq: [
    ["Can we call for help?",
      "Yes, and it changes nothing in the time you have. Company traffic control is forty minutes each way and " +
      "will send a receipt. The next scheduled ship is in a fortnight."],
    ["Can we just leave?",
      "Yes, at any time. If the thing is alive and undealt with, it comes aboard with you — it has been listening " +
      "to your docking clamps all day. That is the FOLLOWED ending and it is a real, earned outcome, not a punishment."],
    ["Can we take the crew with us?",
      "Yes. It is the best thing they can do and it is a real logistical problem: ten people, cryo capacity for a " +
      "handful, and Morgan will not leave without the cat."],
    ["Can the goo be cured?", "Not here. Not with what is on this base. Anyone who says otherwise is guessing."],
    ["What happens if we blow the base?",
      "Thirty minutes, and everything on the rock is gone: the thing, the pod, the goo, the cargo, and anybody " +
      "still inside. The Company will want to know where its specimen went."],
    ["Is Giovanni saveable?", "No. He has been dead for a day and a half. There is nothing in there to save."],
    ["Can we kill it?",
      "Yes. Three hits, or forty damage. The difficulty is that it defends with Advantage while unseen, it breaks " +
      "off the moment it is hurt, and it heals at the pod. Killing it means denying it the pod first."],
    ["Where is it right now?",
      "Somewhere specific. The engine tracks it. Check the Warden screen rather than guessing, and let the tells " +
      "do the work: dust, the cat, a radio call unanswered, a smell of hot copper and standing water."],
  ],
};

export default lore;
