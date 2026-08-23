/* ============================================================
   THE HAUNTING OF YPSILON 14
   Module by D. G. Chapman, Tuesday Knight Games.

   Built as a play aid for your own copy of the one-shot. All
   descriptive text here is rewritten, not reproduced. Buy the
   original: it is four dollars and it is better than most things
   that cost forty.

   Configured here as the TUTORIAL module for a campaign that
   continues on Samsa IV. See lore.js for everything the table
   will ask you and the module never says out loud.
   ============================================================ */
import { defineModule } from "../../engine/defineModule.js";
import { rooms, map } from "./rooms.js";
import { npcs, npcOrder, threats } from "./npcs.js";
import { items, handouts } from "./items.js";
import { tables } from "./tables.js";
import { lore } from "./lore.js";
import { prefetchTapes } from "./audio.js";
import { OPENING, openingProgress, openingLive } from "./opening.js";
import { simHooks, raiseFear, npcsAt, livingCrew, VACUUM } from "./sim.js";
/* WHAT THE EMPTY CHAIR MAY DO HERE. Kept in its own file because it
   is a different kind of content from rooms and items — it is a set
   of judgements about pacing this specific module, and it is the
   difference between a director that describes and one that turns a
   screw. See director.js for the rule it obeys. */
import { director } from "./director.js";

export default defineModule({
  id: "ypsilon14",
  title: "THE HAUNTING OF YPSILON 14",
  subtitle: "MOTHERSHIP · SCI-FI HORROR RPG · ONE SHOT · TUTORIAL",
  byline: "Module by D. G. Chapman, Tuesday Knight Games. Rules: Mothership 1e.",
  length: "One session · 3–4 hours",
  blurb: "A four-hour cargo stop on a mining base with ten crew, one cat, and one worker nobody can account for.",
  pitch: [
    "You are nine days out from Samsa IV, where Greta Base stopped answering eleven days ago and the Company would " +
    "like someone to go and look. Most of your ship is still in cryo. You were thawed to do the lifting.",
    "Ypsilon 14 is the fuel-and-freight stop on the way: six pallets of consumables and medical stock, four hours, " +
    "sign here. On the approach you learn that one of the miners disappeared the night before last. No blood, no " +
    "body, no record of the airlock opening. Just gone.",
    "That is not the only unexplainable thing that has been happening at Ypsilon 14. What is the alien material at " +
    "the heart of this asteroid? Who, if anyone, can be trusted? And can you get the cargo, the crew and yourselves " +
    "off this rock before you also stop being accounted for?",
  ],
  contentWarning:
    "Body horror, disappearance, isolation, and the deaths of people you have spoken to. One scene involves a " +
    "corpse behaving as though it is not one; another involves a living person coming apart in front of you.",
  crewSize: { min: 1, max: 6, suggested: 4 },

  /* WHERE THE NEXT PERSON COMES FROM.

     Ypsilon 14 has an unusually good answer to this and it has been
     sitting in npcs.js the whole time: there are nine people living
     on the rock, all of them frightened, several of them with a very
     good reason to want off it on the next ship out.

     Read as the sentence a player sees on their own phone while they
     build the replacement, immediately after being told their last
     character is dead. Deliberately does not name anybody — who it
     turns out to be is the table's to decide, and a module that
     assigned it would be taking the best part away from them. */
  replacement: {
    arrival:
      "There are nine people living on this rock and every one of them has now worked out "
      + "that the ship in the dock is the only way off it. Somebody is about to attach "
      + "themselves to your crew. Decide with the table who.",
  },

  theme: { accent: "#F5C518" },

  /* ---- sensory pools, keyed to room tags ---- */
  flavour: {
    any: [
      "The base breathes through its ducting, in and out, on a cycle you have started to notice.",
      "Rock dust has got into everything, including the seals.",
      "Somewhere a long way below, a drill changes note and settles.",
    ],
    VENT: ["The grille above you is warm, and the air coming through it is warmer."],
    MINE: ["The rock here is the temperature of a hand."],
    WATER: ["Everything in here drips, patiently, onto tile."],
    QUARTERS: ["Nine bunks are lived in. The tenth has been stripped, and the eleventh never was."],
    CRAWLSPACE: ["The duct carries a sound from somewhere else in the base and then stops carrying it."],
  },

  items, handouts, rooms, npcs, npcOrder, threats, tables, map, lore,
  /* The guided first fifteen minutes. Published on the module rather
     than imported by the deck, so the Warden's screen shows a
     walkthrough for any module that ships one and nothing at all for
     the ones that do not. See opening.js. */
  opening: { steps: OPENING, progress: openingProgress, live: openingLive },
  start: "db2",

  shops: {
    cargo: {
      name: "YOUR SHIP'S HOLD", blurb: "What you brought, and what the charter says you may sign out.",
      markup: 1,
      stock: ["firstaid", "painpills", "stimpak", "automed", "flashlight", "radio", "o2tank", "rebreather",
        "crowbar", "boneknife", "flaregun", "campinggear", "waterfilter", "irgoggles", "bioscanner"],
    },
  },

  /* Fired once, as the docking clamps take hold. */
  onStart: [
    /* Pull the cassettes down now, while the table is still reading
       the intro and the network is doing nothing. Fetched at the
       moment a tape is *found*, they arrived over the Warden's wifi
       in the middle of the module's best scene — see audio.js. */
    (api) => { prefetchTapes(); void api; },
    {
      countdown: {
        id: "transfer", minutes: 240, full: 240,
        label: "CARGO TRANSFER",
        tick: "CARGO TRANSFER · {left} minutes of the scheduled stop remaining.",
        onZero: [{ run: "windowClosed" }],
      },
    },
  ],

  intro: [
    "YPSILON 14. A rock the size of a small town, mined for metals, crewed by ten people and a cat, in a lane " +
    "nobody has any other reason to be in. You are nine days out from Samsa IV with most of your crew still in " +
    "cryo. You were thawed for a four-hour cargo transfer, and the docking clamps have just taken hold.",
    { tone: "npc", text: "SONYA: You're early. Bay two's yours, pallets are staged by the inner lock. I'll open up from the workspace — give me a minute." },
    { tone: "system", text: "On the approach you learned that one of the workers disappeared the night before last. No blood. No body. No record of the airlock opening. Just gone." },
    { tone: "warden", text: "▌ THE JOB: load six pallets in Docking Bay 2 and undock. That is all anyone is asking of you. Everything else that happens today is optional, and every minute of it costs somebody something." },
    { tone: "alarm", text: "CARGO TRANSFER · scheduled stop: four hours. The clock on your screen is that window. Six pallets is twenty minutes each, so the job itself is half of it." },
    { tone: "warden", text: "▌ HOW THIS WORKS: move, look, talk, and use what you are carrying. You will only be asked for a roll when failing would cost you something. If a character dies, there are more of you asleep on the ship." },
  ],

  talkPrompts: [
    "What happened to Mike?",
    "What is that yellow stuff in the mine?",
    "Has anything felt wrong lately?",
    "Who is Dr Giovanni and what is he doing here?",
    "Is Kantaro all right?",
    "Where is the cat?",
  ],

  /* ---------------- actions available anywhere ---------------- */
  actions: [
    {
      id: "listen", label: "Stop and listen",
      effects: [{ time: 30 }, { run: "listen" }],
    },
    {
      id: "fill", label: "Fill the squirt bottle", kind: "solid",
      when: "has:squirtbottle and tag:fillable",
      effects: [{ run: "fillBottle" }],
    },
    {
      id: "radiocheck", label: "Radio check — call the roll", when: "has:radio",
      effects: [{ time: 10 }, { table: "radio" }],
    },
    {
      id: "warn", label: "Warn them, and show them what you have", kind: "accent",
      when: "flag:evidence and !flag:warned",
      effects: [{ run: "warnCrew" }],
    },
    {
      id: "record", label: "Record a decoy tape", when: "tag:records and !has:tape4",
      effects: [{ run: "recordDecoy" }],
    },
  ],

  /* ---------------- the terminal, and its twin in the vents ---------------- */
  devices: {
    terminal: {
      title: "Workspace Computer Terminal", icons: "BASE OPS", label: "Use the terminal",
      status: (w, pc) => [
        "YPSILON 14 · OPERATIONS",
        `SHOWERS: ${w.flags.showers ? "RUNNING" : "OFF"} · AIRLOCKS: ${w.flags.airlocks_locked ? "LOCKED" : "RELEASED"}`,
        `SLURRY PUMP: ${w.flags.pump_reversed ? "REVERSED — FLOODING LOWER WORKINGS" : "NORMAL"}`,
        `AUTH: ${pc.items.includes("keycard") ? "TEAM LEADER KEYCARD PRESENT" : "CREW LEVEL — SOME FUNCTIONS LOCKED"}`,
      ],
      actions: [
        {
          id: "showers",
          label: (w) => (w.flags.showers ? "Shut the washroom showers off" : "Turn the washroom showers on"),
          effects: [{ run: "toggleShowers" }],
        },
        {
          id: "pump", kind: "accent",
          label: (w) => (w.flags.pump_reversed ? "Return the slurry pump to normal" : "Reverse the slurry pump into the lower workings"),
          needs: "has:keycard",
          needsText: "BASE OPS · PUMP CONTROL LOCKED. Team leader authorisation required.",
          mins: 10,
          effects: [{ run: "floodMine" }],
        },
        {
          id: "airlocks",
          label: (w) => (w.flags.airlocks_locked ? "Release the airlocks" : "Lock the airlocks"),
          effects: [{ run: "toggleAirlocks" }],
        },
        { id: "manifest", label: "Pull the crew manifest", effects: [{ run: "manifest" }] },
        { id: "comms", label: "Send a report to Company traffic control", mins: 15, effects: [{ run: "callCompany" }] },
        {
          id: "selfdestruct", kind: "accent",
          label: (w) => (w.flags.destruct_armed ? "Abort the self-destruct sequence" : "Initiate the base self-destruct sequence"),
          needs: "has:keycard",
          needsText: "BASE OPS · SEQUENCE LOCKED. Team leader authorisation required. Insert keycard.",
          effects: [{ run: "selfDestruct" }],
        },
      ],
    },
  },

  /* ---------------- items that behave specially here ---------------- */
  itemUse: {
    irgoggles: [{ run: "wearGoggles" }],
    fullbottle: [{ run: "throwWater" }],
    extractor: [{ run: "throwWater" }],
    jerrycan: [{ run: "throwWater" }],
    cattreats: [{ run: "offerTreats" }],
    giovannicase: [{ run: "openCase" }],
    gooslide: [{ run: "examineGoo" }],
    gootissue: [{ run: "examineGoo" }],
  },

  /* ---------------- the goo, once it is in you ---------------- */
  tracks: {
    infection: {
      condition: "INFECTED — yellow goo",
      stages: [
        /* EVERY STAGE IS NOW TWO EVENTS.

           The arc — aversion to water, then euphoric healing, then
           the body giving up its shape — was always the module's
           best horror and was entirely private. Stage 1 is "you are
           not thirsty"; stage 2 is "your wounds have closed and you
           feel extraordinary". Both are pleasant, both are invisible
           to the other five players, and so the infection was a
           timer rather than the paranoia engine the module wants.

           So each stage keeps its private text and gains an
           *outside view*: what the crew standing next to you
           actually sees. Riley refusing water at the mess. Riley's
           week-old cut being gone. The infected player still does
           not know they are infected — nothing here tells them —
           but the table now has something to notice, argue about,
           and be wrong about. That is the whole difference between
           a countdown and a horror game. */
        {
          after: 15,
          effects: [
            { say: "You are not thirsty. You cannot remember deciding not to be thirsty. The thought of the showers is faintly, physically unpleasant.", tone: "horror" },
            { sayOthers: "{name} takes the water bottle when it is handed over, holds it, and gives it back full. They do it without appearing to notice they have done it.", tone: "warden" },
            { flag: "player_infected" },
          ],
        },
        {
          after: 60,
          effects: [
            { say: "Your wounds have closed — all of them, including the old ones. You feel extraordinary. You have not wanted a drink of water in over an hour.", tone: "good" },
            { sayOthers: "{name} is moving like nothing has happened to them today. The cut on their forearm from this morning is not there. Not scabbed, not dressed — not there.", tone: "horror" },
            { heal: "3d10" },
            { buff: { source: "the goo, working", hours: 24, grants: [{ kind: "stat", name: "strength", bonus: 15 }, { tags: ["lift", "force", "melee"], adv: true }] } },
          ],
        },
        {
          after: "120+2d10*60",
          effects: [
            { say: "Your hands are wrong. They are the wrong shape, and they are warm, and they are running.", tone: "horror" },
            { sayOthers: "{name} is looking at their own hands and the hands are going. It comes off the bone in a slow yellow sheet, and {name} is still talking.", tone: "horror" },
            { stress: 2, why: "your hands are running" },
            { stressCrew: 2, why: "you watched it start" },
            { damage: "1d10", why: "you are becoming the goo" },
          ],
          repeat: { every: 10, effects: [{ damage: "1d10", why: "you are becoming the goo" }] },
        },
      ],
    },
  },

  /* ============================================================
     THE CLOCK THE BASE RUNS ON

     The pitch is "four hours, sign here", and until now the only
     thing that marked the window was `shiftbell` firing at minute
     240 — after it had already closed. Everything else in the
     module is priced in minutes against a deadline the players
     could not see: six pallets at twenty minutes each is two
     hours of the four, and nobody knew that while they were
     deciding whether to go and look at the cat.

     So the cargo window is a real countdown, started at minute
     zero by the intro, and it is on every phone as a bar getting
     shorter (see ui/Clocks.jsx). It does not end the game when it
     runs out — the Company is not going to blow the ship up — it
     lands as what it actually is: the charter is blown, somebody
     will have to explain it, and the crew's own clock is now
     running against them rather than for them.

     That turns every twenty-minute pallet into a decision instead
     of a button, which is the whole point.
     ============================================================ */
  /* The nine-rung ladder's content for this module. Absent, the
     director can only pace and describe — see the header of
     ./director.js. */
  director,

  clocks: [
    {
      id: "shiftbell", start: 240, every: 480,
      effects: [{ say: "A shift bell sounds somewhere, from a rota nobody is keeping any more.", tone: "system" }],
    },
  ],

  endings: {
    win: {
      title: "IT IS DEAD", good: true,
      text: "You undock with a dead thing cooling on the deck behind you and a list of names to explain. The Company will want the specimen. You have opinions about that, and nine days to Samsa IV to have them in.",
    },
    escape: {
      title: "YOU GOT OFF THE ROCK", good: true,
      text: "You clear the collar with minutes to spare. Behind you the asteroid opens like a struck match, and every reason anyone had to come back here goes with it — the pod, the goo, the thing, and the paperwork.",
    },
    quarantine: {
      title: "YOU LEFT IT SEALED", good: true,
      text: "Airlocks locked, base dark, a warning on every Company channel and a rock that answers nothing. It is still down there, in the quiet it always wanted. Somebody will come and open it. It will not be you.",
    },
    followed: {
      title: "IT CAME WITH YOU",
      text: "You seal up, undock, and put the rock behind you. Two hours into the burn your dust log records a mass it cannot account for, moving quietly between compartments, towards the cryo bay where the rest of your crew are asleep and cannot hear anything at all.",
    },
    melted: {
      title: "YOU WERE NOT THE ONE WHO CAME BACK",
      text: "The goo finishes what it started somewhere over the ninth day. What arrives at Samsa IV is wearing your face and does not answer questions about water.",
    },
    dead: { title: "YOU DIED", text: "You bleed out on the deck plate of a rock nobody will visit for a fortnight." },
    coma: { title: "YOU DID NOT WAKE UP", text: "You do not wake up. Not here, not on this rock, not in time." },
    insane: { title: "YOU ARE NOT COMING BACK", text: "Whatever is left of you will not be making any more decisions. The Warden has your sheet now." },
    boom: { title: "YOU WERE STILL INSIDE", text: "The sequence completes while you are still inside it. Ypsilon 14 becomes a very brief light, and then nothing at all." },
  },

  debrief: (w, pc, mod) => {
    const taken = mod.npcOrder.filter((n) => w.npcs[n].taken).map((n) => mod.npcs[n].name);
    const alive = mod.npcOrder.filter(
      (n) => w.npcs[n].alive && !w.npcs[n].taken && !mod.npcs[n].gone && n !== "giovanni"
    ).map((n) => mod.npcs[n].name);
    const cargo = w.flags.cargo || 0;
    return [
      `Cargo loaded for Greta Base: ${cargo} of 6 pallets${cargo === 6 ? " — the manifest is clean" : cargo ? " — the manifest is short" : " — nothing was loaded"}`,
      `Still standing: ${alive.length ? alive.join(", ") : "nobody"}`,
      `Unaccounted for: ${["MIKE VOSS", ...taken].join(", ")}`,
      `Understood the goo: ${w.flags.knows_goo ? "yes" : "no"} · Learned it fears water: ${w.flags.knows_water ? "yes" : "no"} · Learned it hunts by sound: ${w.flags.knows_sound ? "yes" : "no"}`,
      `The pod: ${w.flags.pod_dead ? "destroyed — it had nowhere left to mend" : "intact"} · The Company: ${w.flags.told_company ? "was told something" : "was told nothing"}`,
      w.flags.player_infected ? "One of you is carrying it off this rock inside your own skin." : "",
    ].filter(Boolean);
  },

  xp: (w) =>
    10 +
    (w.flags["slain:it"] ? 3 : 0) +
    (w.flags.knows_goo ? 2 : 0) +
    (w.flags.knows_water ? 1 : 0) +
    (w.flags.knows_sound ? 1 : 0) +
    (w.flags.pod_dead ? 2 : 0) +
    Math.floor((w.flags.cargo || 0) / 2),

  /* ---------------- the Warden's own screen ---------------- */
  warden: {
    setting:
      "Ypsilon 14 is a remote asteroid mining base: ten crew, one cat, a four-hour cargo stop. Mike Voss vanished " +
      "the night before last — no blood, no body, no airlock log. Nine weeks ago the drills opened a cavity that " +
      "was never surveyed, containing a stasis pod. Giovanni, Company, cut it open. An invisible predator has been " +
      "loose for three weeks. It is blind and hunts by echolocation; noise confuses it. It will not cross water. " +
      "Wounded, it must return to the pod in the Mine Antechamber, where the yellow goo mends it. The goo also " +
      "infects: aversion to water, then unnatural strength and healing, then hours later the body gives up its " +
      "shape. Kantaro is nine days into that. Giovanni has been dead for thirty hours and is still standing up.",
    voice:
      "Flat, specific, and physical. Report what instruments and senses register. Never say 'you feel' — describe " +
      "what is there and let them feel it. Silence is a tool: let a description end early.",
    constraints: [
      "Nothing the players do reveals the creature to the naked eye. Infrared, dust, sound, water and the cat can imply it.",
      "The crew do NOT know there is an alien. They know Mike is missing. Never let them work it out on the players' behalf.",
      "Never let the creature become a character. It does not taunt, plan revenge, or communicate. It is hungry and it is careful.",
      "Ask for a roll only when failure costs something. Time is the usual cost.",
      "Mike wrote SILENCE. The creature writes nothing.",
    ],
    npcNote:
      "Everyone has a public answer, a private answer and a secret — see the dossier. Frightened people stop being " +
      "alone, which makes the players the loneliest things on the base.",
  },

  tutorial: {
    for: "First-time Mothership players and first-time Wardens.",
    teaches: [
      "The clock costs more than the dice.",
      "The monster is a problem to be solved, not a hit-point pool to be emptied.",
      "Stress compounds, and Panic is the thing that actually kills you.",
      "The NPCs are people with legs and opinions, and protecting them costs you something.",
      "The Company is not on your side.",
    ],
    leadsInto: "ANOTHER BUG HUNT · Greta Base, Samsa IV — nine days out.",
  },

  /* ============================================================
     HOOKS — the last five per cent, in code because it is shorter
     ============================================================ */
  hooks: {
    ...simHooks,

    /* ---- what the director is allowed to ask for ---- */

    /* Rung 6. Five real minutes of a table doing nothing at all, and
       the creature gets a turn it would otherwise have had to wait
       for a player action to earn.

       It runs the module's own drive rather than moving anything
       itself — `thinkMonster` knows about hunger, water, decoy
       tapes, the pod and the route home to mend, and none of that
       belongs in a director. What this hook adds is only the
       *permission* to take a step, plus the quiet tell that
       something did.

       Deliberately silent when the crew are nowhere near it. A
       pressure beat the table cannot perceive is a pressure beat
       that only exists in the log. */
    directorPressure(api) {
      const w = api.world();
      const it = w.threats.it;
      if (!it || it.dead) return;
      api.run("onTick", { mins: 5, clock: w.clock });
      const now = api.world();
      const here = rooms[now.room] || {};
      const near = now.threats.it.loc
        && (now.threats.it.loc === now.room
          || (here.exits || []).some((e) => e && e.to === now.threats.it.loc));
      if (near) {
        api.rollTable("quiet");
      }
    },

    /* Rung 4, beat 4. The crew's own nerve, moved by one, through
       the module's existing machinery — muster, Sonya's announcement
       and everything downstream of it. The director does not get its
       own copy of that logic. */
    raiseFearBeat(api) {
      raiseFear(api, 1, "the visitors have been here a long time and nobody has said why");
    },

    /* ---- the window ---- */
    windowClosed(api) {
      const w = api.world();
      api.flag("overstayed", true);
      api.say("alarm",
        "CARGO TRANSFER · SCHEDULED WINDOW CLOSED. Your charter said four hours. Traffic control will have logged " +
        "the overrun before you notice it, and the Company reads those.");
      const done = w.flags.cargo_done;
      api.say("warden", done
        ? "▌ The job is aboard, so this costs you money and an explanation rather than the module. Everything from here is your own idea, and the base knows you are still on it."
        : "▌ The pallets are not aboard and the window has gone. Whatever you do next, you are doing it late, and the crew have noticed that the visitors are not leaving.");
      api.stress(1, "you are overdue and somebody is counting");
      /* Not an ending. The Company does not blow the ship up for a
         late transfer — it takes it out of your pay and remembers.
         What changes is that the crew stop reading you as a delivery
         and start reading you as people who stayed. */
      raiseFear(api, 1, "the visitors' ship has missed its window and nobody has said why");
    },

    /* ---- the job ---- */
    loadPallet(api) {
      const w = api.world();
      const n = (w.flags.cargo || 0) + 1;
      api.advance(20);
      api.flag("cargo", n);
      if (n >= 6) {
        api.flag("cargo_done", true);
        api.say("good", "The sixth pallet goes up the ramp and the netting comes down over it. That is the job. Everything you do from here is your own idea.");
        api.awardXp(2);
      } else {
        api.say("item", `Pallet ${n} of 6 aboard. Twenty minutes gone. ${6 - n} to go.`);
      }
      if (n === 1) api.say("warden", "▌ Every pallet is twenty minutes. Six pallets is two hours. Decide now whether the cargo or the crew is the thing you came here for, because you cannot have all of both.");
    },

    /* ---- perception ---- */
    listen(api) {
      const w = api.world();
      const it = w.threats.it;
      if (!it.dead && it.loc === w.room) {
        api.say("horror", "Half an hour of pumps and drills, and under it, very close, something breathing that is trying not to.");
        api.stress(1, "it is in here");
        return;
      }
      api.rollTable("quiet");
      if (!it.dead && it.loc && (["work", "quarters", "mess", "wash", "vents"].includes(it.loc)))
        api.say("warden", "And, a long way off through the ducting, a wet click. Then another. Regular, like something taking a bearing.");
    },

    wearGoggles(api) {
      const w = api.world();
      const on = !w.flags.wearing_ir;
      api.advance(5);
      api.flag("wearing_ir", on);
      if (!on) { api.say("system", "You push the goggles up onto your forehead."); return; }
      api.say("search", "You pull the goggles on. The world goes to grades of grey and heat.");
      if (w.room === "db1")
        api.say("horror", "Three-toed footprints cover every surface of this ship except the science lab and the ruined washroom. Hundreds of them, old and fresh, on the deck, the walls, the ceiling.");
      else if (!w.threats.it.dead && w.threats.it.loc === w.room) {
        api.say("horror", "There is a fuzzy, not-quite-humanoid shape standing about two metres from you. It is not warm enough to be alive. It is close enough to touch.");
        api.stress(1, "close enough to touch");
      } else api.say("system", "Old heat traces on the floor, going through doorways nobody uses.");
    },

    /* ---- water, in anger ---- */
    throwWater(api) {
      const w = api.world();
      api.advance(1);
      if (!w.threats.it.dead && w.threats.it.loc === w.room) {
        api.say("good", "The air in front of you recoils. Whatever it is goes up and out through the ducting fast enough to buckle a panel.\n\nIt is afraid of water.");
        api.flag("knows_water", true);
        api.setThreat("it", { loc: "vents", retreat: 30 });
        api.awardXp(1);
        return;
      }
      api.say("you", "You throw water across an empty room. It runs into the drain, and the room is wet for a while.");
      api.flag(`wet:${w.room}`, w.clock + 60);
    },

    fillBottle(api) {
      api.advance(5);
      api.take(["squirtbottle"]);
      api.give(["fullbottle"]);
      api.say("item", "Half a litre and a trigger. It is worth more than the revolver and it will take you a while to believe that.");
    },

    /* ---- sound, in anger ---- */
    recordDecoy(api) {
      api.advance(20);
      api.give(["tape4"]);
      api.say("item", "Twenty minutes of you banging on ducting, shouting, and dragging a crate around, on a tape you can leave anywhere.");
      api.flag("knows_sound", true);
    },

    playDecoy(api) {
      const w = api.world();
      api.advance(5);
      api.flag("decoy_room", w.room);
      api.flag("decoy_until", w.clock + 90);
      api.say("good", "You set the tape running and leave the room. For the next hour and a half, this compartment is the loudest thing on Ypsilon 14, and it is not where you are.");
      api.awardXp(1);
    },

    /* ---- the cat ---- */
    petCat(api) {
      const w = api.world();
      api.advance(5);
      const n = (w.flags.cat_petted || 0) + 1;
      api.flag("cat_petted", n);
      api.say("search", "Prince permits it. Prince is looking past you at something two metres to your left, and has not blinked in some time.");
      if (n >= 2 && !w.flags.prince_follows) {
        api.flag("prince_follows", true);
        api.say("good", "When you leave, Prince comes with you. He walks ahead, stops at each doorway, and looks in before you do.");
        api.say("warden", "▌ The cat can see it. He will not enter a room it is in. You have just acquired the best instrument on this base.");
        api.awardXp(1);
      }
    },

    offerTreats(api) {
      const w = api.world();
      api.advance(5);
      if (w.npcs.prince.loc !== w.room) { api.say("system", "You shake the bag in an empty room. Somewhere, a cat declines to be seen."); return; }
      api.flag("prince_follows", true);
      api.say("good", "Prince is a professional. Prince follows the bag, and therefore follows you, and stops at each doorway to look in before you do.");
    },

    /* ---- the science ---- */
    examineGoo(api) {
      const r = api.rollNow({
        kind: "stat", name: "intellect",
        skill: ["Xenobiology", "Genetics", "Biology", "Pathology"],
        tags: ["science", "diagnose", "medical"],
        why: "the specimen",
      });
      api.advance(20);
      if (!r.success) { api.say("system", "The slide is beautiful and completely opaque to you. There is more here if someone else looks."); return; }
      api.flag("knows_goo", true);
      api.flag("evidence", true);
      api.awardXp(2);
      api.say("good",
        "You get it, more or less. It is not a disease and it is not medicine. It is a repair medium — it takes a " +
        "body apart and rebuilds it into something that suits its owner better. It closes wounds because it is " +
        "already rewriting the tissue, and then it finishes the job. Whatever made it left it here to keep " +
        "something else alive between stars.");
      api.say("warden", "▌ Which means two things. The thing in the vents can mend itself, but only where the goo is. And anyone on this base who has stopped drinking water has hours, not days.");
    },

    openCase(api) {
      api.advance(10);
      api.flag("knows_company", true);
      api.flag("evidence", true);
      api.say("search",
        "The seal gives on the third try. Inside: sample vials, six of them, five full. A field log. And the order " +
        "that sent him, on Company letterhead: recover viable biological material from the surveyed anomaly. " +
        "Priority over site operations. Priority over personnel. Priority over any vessel in dock.");
      api.rollNow({ kind: "save", name: "sanity", why: "priority over any vessel in dock" });
      api.say("warden", "▌ Keep this. It is the only thing on this rock the Company will want more than the specimen, and it is the only leverage you will have on Samsa IV.");
    },

    /* ---- Giovanni ---- */
    giovanniEncounter(api) {
      const w = api.world();
      if (w.threats.giovanni.dead) { api.say("system", "What is left of Dr Giovanni is on the lab floor, slowly losing its shape."); return; }
      api.say("horror",
        "Dr Ethan Giovanni stands at the end of the bench, silent, smiling. Slowly his mouth widens, further than a " +
        "mouth goes, and yellow goo dribbles out and leaks from his throat like albumen. He lunges for you, " +
        "grinning wide and crying yellow.");
      api.rollNow({ kind: "save", name: "sanity", why: "that is not a person" });
      api.give(["irgoggles"]);
      api.say("item", "Infrared goggles hang on a cord around his neck.");
      api.startCombat("giovanni", { surprise: false });
    },

    killGiovanni(api) {
      api.flag("giovanni_dead", true);
      api.flag("evidence", true);
      api.setThreat("giovanni", { dead: true });
      api.say("warden", "▌ Nothing you could have done. He infected himself six days ago on purpose and he has been dead for a day and a half.");
    },

    /* ---- the thing ---- */
    itWounded(api) {
      const w = api.world();
      api.setThreat("it", { loc: w.flags.pod_dead ? "vents" : "ante", retreat: 60 });
      if (w.flags.pod_dead) {
        api.say("horror", "It goes upward this time, into the ducting, not down. There is nowhere below for it to go any more, and it knows that better than you do.");
      } else if (w.flags.knows_goo) {
        api.say("warden", "▌ It has gone to the goo. In an hour it will be whole again — everything except the hits you have already put into it. If you want it dead, the pod has to go first.");
      }
    },

    itKilled(api) {
      api.flag("it_dead", true);
      api.awardXp(3);
      api.say("warden", "▌ Three hits or forty damage. You did it the hard way, and you did it. Get the pallets, get the crew, and get off this rock.");
    },

    itDoused(api) {
      const w = api.world();
      api.setThreat("it", { loc: "vents", retreat: 30 });
      api.flag(`wet:${w.room}`, w.clock + 60);
    },

    burnGoo(api) {
      const w = api.world();
      api.advance(30);
      const pod = (w.flags.pod ?? 100) - 50;
      api.flag("pod", pod);
      if (pod > 0) {
        api.say("dmg", "The cutter goes through it and it closes behind the beam, more slowly each time. Half of it is carbon now. Half of it is not.");
        api.say("system", "Another session with the cutter would finish this.");
        return;
      }
      api.flag("pod_dead", true);
      api.flag("evidence", true);
      api.awardXp(3);
      api.say("good",
        "The last of it goes up in a smell you will be tasting for a week, and the pod collapses in on its own gash " +
        "like a lung. Whatever is loose in this base has just lost the only place it could go to be mended.");
      api.say("warden", "▌ It will find out within the hour. After that it stops being careful, and careful was the only thing keeping it off you.");
      api.stress(-1, "you have done something that will actually work");
    },

    /* ---- base operations ---- */
    toggleShowers(api) {
      const w = api.world();
      const on = !w.flags.showers;
      api.flag("showers", on);
      api.say("system", `BASE OPS · Washroom showers ${on ? "RUNNING" : "OFF"}.${on ? " Water is standing on the floor down there now, and will be for an hour after they stop." : ""}`);
      if (on) {
        api.flag("wet:wash", w.clock + 120);
        if (!w.threats.it.dead && w.threats.it.loc === "wash") {
          api.setThreat("it", { loc: "vents", retreat: 20 });
          api.flag("knows_water", true);
          api.say("horror", "Somewhere below, the pipes bang once, hard, and something leaves the washrooms very fast.");
        }
      }
    },

    floodMine(api) {
      const w = api.world();
      const on = !w.flags.pump_reversed;
      api.flag("pump_reversed", on);
      if (!on) { api.say("system", "BASE OPS · Slurry pump returned to normal operation."); return; }
      api.say("alarm", "BASE OPS · PUMP REVERSED. Grey water and slurry begin discharging into the lower workings. Estimated fill of the deep chambers: forty minutes.");
      api.advance(40);
      api.flag("pod", 0);
      api.flag("pod_dead", true);
      api.flag("evidence", true);
      api.awardXp(3);
      api.say("good",
        "Forty minutes of the base's dirty water goes down the shaft and into a chamber that has never been wet. " +
        "The goo comes off the walls in sheets and dissolves into grey. The pod fills, and softens, and stops being " +
        "a pod. Nothing down there is going to mend anything again.");
      api.say("warden", "▌ You have just taken away the one thing it needs, using a pump, from another deck, without ever being in the room. That is how this module is meant to be beaten.");
      raiseFear(api, 1, "the base is doing things nobody ordered");
    },

    toggleAirlocks(api) {
      const locked = !api.world().flags.airlocks_locked;
      api.flag("airlocks_locked", locked);
      api.say("system", `BASE OPS · Airlocks ${locked ? "LOCKED" : "RELEASED"}.`);
    },

    manifest(api) {
      const w = api.world(); const mod = api.mod;
      const crew = mod.npcOrder
        .filter((n) => !["prince", "mike", "giovanni"].includes(n))
        .map((n) => `${mod.npcs[n].name}${w.npcs[n].taken ? " (UNACCOUNTED)" : w.npcs[n].alive ? "" : " (DECEASED)"}`)
        .join(", ");
      api.advance(5);
      api.say("system", `BASE OPS · Crew manifest: VOSS (UNACCOUNTED), ${crew}. Visiting: Dr E Giovanni, research vessel Heracles, Bay 1, docked 34 days.`);
    },

    callCompany(api) {
      const w = api.world();
      api.flag("told_company", true);
      api.say("system",
        "BASE OPS · Message logged for Company traffic control. Round trip to the nearest relay is about eighty " +
        "minutes. Nobody is coming. The next scheduled vessel is in fourteen days.");
      if (w.flags.knows_goo || w.flags.knows_company) {
        api.say("alarm", "COMPANY TRAFFIC CONTROL · RECEIPT — 22 minutes. Hazard acknowledged. Preserve all biological material. Do not destroy the site. Await instruction.");
        api.stress(1, "they answered that quickly");
        api.say("warden", "▌ Twenty-two minutes. Somebody was already listening to this channel.");
      } else {
        api.say("system", "COMPANY TRAFFIC CONTROL · RECEIPT. No instructions attached.");
      }
    },

    selfDestruct(api) {
      const w = api.world();
      if (w.flags.destruct_armed) {
        api.flag("destruct_armed", false);
        api.stopCountdown("selfdestruct");
        api.say("system", "BASE OPS · Sequence aborted.");
        return;
      }
      api.flag("destruct_armed", true);
      api.countdown({
        id: "selfdestruct", minutes: 30,
        tick: "SELF-DESTRUCT · {left} minutes remaining.",
        onZero: [{ end: "boom" }],
      });
      api.say("alarm",
        "BASE OPS · CHARGE SEQUENCE ARMED. THIRTY MINUTES. All personnel to docking. This announcement will not be " +
        "repeated.\n\nEvery light in the base turns the same colour.");
      api.stress(1, "you just did that");
      raiseFear(api, 2, "somebody armed the charges");
      const left = livingCrew(api).length;
      if (left) api.say("warden", `▌ There are still ${left} people on this base who are not you. They have thirty minutes and one working airlock.`);
    },

    /* ---- the crew ---- */
    warnCrew(api) {
      const w = api.world();
      const here = npcsAt(api, w.room);
      api.advance(15);
      api.flag("warned", true);
      if (!here.length) { api.say("system", "You explain it, at length, to an empty compartment."); return; }
      const believable = w.flags.knows_goo || w.flags.heard_tape2 || w.flags.heard_tape3 || w.flags.pod_dead;
      if (!believable) {
        api.say("npc", `${api.mod.npcs[here[0]].name} listens to all of it, and then asks whether you have been down in the mine without a suit.`);
        return;
      }
      api.say("good", "They look at the evidence. They look at each other. Nobody laughs.");
      api.awardXp(2);
      raiseFear(api, 3, "the visitors brought proof");
      api.say("warden",
        "▌ You have just made this base much safer for ten people and much more dangerous for you. Nobody will be " +
        "alone from now on — which means the loneliest warm things on Ypsilon 14 are the ones who came in on your ship.");
    },

    /* ---- leaving ---- */
    leaving(api) {
      const w = api.world();
      const survivors = livingCrew(api).length;
      const infected = (api.crew() || []).some((c) => (c.conditions || []).some((x) => x.startsWith("INFECTED")));

      if (w.flags.destruct_armed) { api.endGame("escape"); return; }
      if (w.threats.it.dead) { api.endGame(infected ? "melted" : "win"); return; }
      if (infected) { api.endGame("melted"); return; }
      if (w.flags.airlocks_locked && w.flags.told_company && survivors === 0) { api.endGame("quarantine"); return; }
      api.endGame("followed");
    },
  },
});
