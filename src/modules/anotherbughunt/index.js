/* ============================================================
   ANOTHER BUG HUNT
   Module by D. G. Chapman, Luke Gearing, Alan Gerding, Tyler
   Kimball and Sean McCoy, published by Tuesday Knight Games.

   Built as a play aid for your own copy of the book. All
   descriptive text here is newly written for this engine, not
   reproduced. The scenario's plot, characters, locations and
   creatures belong to their authors. Buy the book — it is the
   introductory adventure for Mothership 1e and it is very good.

   Four interconnected scenarios, three to six hours each:

     1  DISTRESS SIGNALS  Greta Base. Learn what kills them.
     2  HERON STATION     Eleven survivors, three missions,
                          and a storm that eats the map.
     3  THE MOTHERSHIP    Three routes into an alien ship and
                          an android who will not fight you.
     4  METAMORPHOSIS     Get off the planet.

   Configured to run as a campaign. See lore.js for everything
   the table will ask about and the module never says.
   ============================================================ */
import { defineModule } from "../../engine/defineModule.js";
import { rooms, map } from "./rooms.js";
import { npcs, npcOrder, threats } from "./npcs.js";
import { items, handouts } from "./items.js";
import { tables } from "./tables.js";
import { lore } from "./lore.js";
import { simHooks } from "./sim.js";
import { director } from "./director.js";

export default defineModule({
  id: "anotherbughunt",
  /* Which system this was written for. Every module here has always
     been a Mothership one; saying so is what lets the engine refuse
     to load it into a ruleset where its loadouts and skills would
     silently resolve to nothing. See docs/RULESETS.md. */
  ruleset: "mothership1e",
  title: "ANOTHER BUG HUNT",
  subtitle: "MOTHERSHIP · SCI-FI HORROR RPG · CAMPAIGN · FOUR SCENARIOS",
  byline: "Module by D. G. Chapman, Luke Gearing, Alan Gerding, Tyler Kimball & Sean McCoy — Tuesday Knight Games. Rules: Mothership 1e.",
  length: "Four sessions · 3–6 hours each",
  blurb:
    "A terraforming colony went quiet six months ago. The Company would like somebody to go and look, and has "
    + "been careful to specify which two things are worth bringing back.",
  pitch: [
    "Greta Base has not answered a hail in six months. The Company has hired your crew to land on Samsa VI, "
    + "rendezvous with the marine commander, get the terraformer and the satellite relay working again, and — if "
    + "all else fails — evacuate the mission specialist and the colony's synthetic science officer. Or at minimum, "
    + "the synthetic's logic core.",
    "The contract is unusually specific about those last two names, and unusually quiet about the other seventeen.",
    "You come down through a tropical storm into thick mud and lush jungle, and the base ahead of you sits dark "
    + "and silent with vine growth strangling the seams. Nothing responds. The rain is eating your scans.",
    "There is something on this planet that guns do not work on. Somebody here worked out what does, and died "
    + "making sure you would find it.",
  ],
  contentWarning:
    "Arachnophobia — the carcinids draw on insects, spiders and crabs. Body horror: amputation, rot, organ "
    + "removal, and things erupting from inside people. Mind control and loss of agency, including psychic "
    + "intrusion written to resemble real psychiatric experience. Violence, corpses, and one suicide by firearm "
    + "discovered in situ. Claustrophobia, drowning, and confinement.",
  crewSize: { min: 2, max: 6, suggested: 4 },

  replacement: {
    arrival:
      "There are survivors on this planet who have worked out that your crew is the only group here with a way "
      + "off it. Somebody is about to attach themselves to you. Decide with the table who — and whether anybody "
      + "checks them for paper cuts first.",
  },

  theme: { accent: "#5FA867" },

  /* ---- sensory pools, keyed to room tags ---- */
  flavour: {
    any: ["Rain, somewhere above you, going on and on."],
    OUTSIDE: [
      "The mud has your boots to the ankle and would like the rest.",
      "Lightning somewhere behind the ridgeline, and a long wait before the sound arrives.",
    ],
    DARK: ["Your lamp reaches about nine metres and then gives up."],
    WATER: ["Something moves the water that is not the current."],
    CARC: [
      "The walls here are warm on one side, and it is not the side facing out.",
      "Everything in here is a shape that has a function, and none of the functions are yours.",
    ],
    RADIATION: ["The counter on your suit is making a noise you have started to filter out, which is the worst thing about it."],
    QUARTERS: ["Nineteen people lived here. The chart in the command centre accounts for all of them."],
  },

  items, handouts, rooms, npcs, npcOrder, threats, tables, map, lore, director,
  start: "lz",

  shops: {
    cargo: {
      name: "DROPSHIP LOADOUT", blurb: "What the Company issued, and what the charter says you may sign out.",
      markup: 1,
      stock: ["hazardsuit", "smg", "pulserifle", "firstaid", "stimpak", "painpills", "automed",
        "flashlight", "radio", "o2tank", "rebreather", "crowbar", "flaregun", "campinggear",
        "bioscanner", "medscanner", "vaccsuit", "toolkit", "lasercutter"],
    },
  },

  /* THE STORM CLOCK DOES NOT START HERE.

     It used to. `onStart` fires as the crew step off the dropship
     at the LZ, and every threshold in the storm timeline describes
     Heron Station — the reactor level, level −01, the hangar, the
     dam. Greta Base is four hundred fiction-minutes of searching on
     its own, so a table that played scenario one as written arrived
     at Heron somewhere around storm hour five or six, at which
     point the reactor and the lower levels had already drowned, the
     dam was already shut, and no evacuation of any kind was
     possible. Scenario two was over before it was reached.

     A table that ran straight past scenario one had the opposite
     problem: they reached the hangar at storm hour zero and nothing
     in the timeline meant anything for the next ten hours.

     The countdown now starts when the crew walk into the hangar.
     See `beginStorm` in sim.js. */
  onStart: [
    { flag: { hinton_alive: true, evac_mode: "landed" } },
  ],

  intro: [
    "SAMSA VI. A wet world with a bad temper, one terraforming colony, and nothing on it the Company thought was "
    + "worth the freight until the biochemistry survey came back strange.",
    { tone: "npc", text: "MAAS: Right. Two retrievals. Dr Edem, and Hinton's logic core. The core especially — I'd like that noted. Everything else is at your discretion." },
    { tone: "system", text: "Greta Base stopped answering six months ago. You are being dropped in the middle of a tropical storm because the weather window was not going to improve and the Company was not going to wait." },
    { tone: "warden", text: "▌ THE JOB: rendezvous with the marine commander, restore comms and the terraformer, and if that fails, get Dr Edem and the logic core out. The Company has strongly implied that the other colonists are not a concern." },
    { tone: "alarm", text: "THE STORM · ten hours. That clock is the module. It takes the map away an hour at a time and it does not care what you are in the middle of." },
    { tone: "warden", text: "▌ HOW THIS WORKS: move, look, talk, and use what you carry. You will only be asked to roll when failing costs something. Guns are going to disappoint you. Run more than you think you should." },
  ],

  talkPrompts: [
    "What happened here?",
    "What are the paper cuts?",
    "Where is everybody else?",
    "Why doesn't the radio work?",
    "What actually kills them?",
    "Who is Hinton, and where is he?",
  ],

  /* ---------------- actions available anywhere ---------------- */
  actions: [
    { id: "listen", label: "Stop and listen", effects: [{ time: 20 }, { table: "quiet" }] },
    { id: "radio", label: "Try the radio", when: "has:radio", effects: [{ time: 5 }, { run: "useRadio" }] },
    {
      id: "scan", label: "Bioscan for larvae", when: "has:bioscanner",
      effects: [{ time: 10 }, { run: "bioscan" }],
    },
    /* THE PLAN HAS TO BE PITCHED BEFORE IT CAN BE TAKEN.

       These three were gated on `flag:reached_heron` alone, so all
       three accent buttons lit up the moment the crew walked through
       the hangar door. The whole of scenario two is a table choosing
       between three people's plans while those three people argue —
       and the software was offering the choice before anybody had
       heard a pitch, which turns a faction decision into a menu.

       `met:` is engine-side (see engine/effects.js). The eleven
       survivors are already placed by `start: "hangar"`; going and
       talking to them is now the price of the button. */
    {
      id: "mission_leave", label: "Take Brookman's plan — retake the tower", kind: "accent",
      when: "flag:reached_heron and met:brookman and !flag:mission_leave and !flag:endgame",
      effects: [{ run: "missionLeave" }],
    },
    {
      id: "mission_study", label: "Take Dr Edem's plan — recover the research", kind: "accent",
      when: "flag:reached_heron and met:edem and !flag:mission_study and !flag:endgame",
      effects: [{ run: "missionStudy" }],
    },
    {
      id: "mission_hog", label: "Take Sgt Valdez's plan — reach the reactor", kind: "accent",
      when: "flag:reached_heron and met:valdez and !flag:mission_hog and !flag:endgame",
      effects: [{ run: "missionHog" }],
    },
    {
      id: "dose", label: "Inject a dose of the cytotoxin", kind: "accent",
      when: "has:cytotoxin",
      effects: [{ time: 10 }, { run: "doseSelf" }],
    },
    {
      id: "callevac", label: "Call the dropship", kind: "accent",
      when: "flag:comms_up and !flag:evac_called",
      effects: [{ run: "callEvac" }],
    },
    {
      id: "boardevac", label: "Board the dropship", kind: "accent",
      when: "flag:evac_inbound and !flag:aboard_ship",
      effects: [{ run: "boardEvac" }],
    },
  ],

  /* ---------------- devices ---------------- */
  devices: {
    comms: {
      title: "Greta Base Communications Stack", icons: "COLONY OPS", label: "Work on the comms stack",
      status: (w) => [
        "GRETA BASE · COMMUNICATIONS",
        `STACK: ${w.flags.greta_comms ? "REBUILT" : "DESTROYED — HOURS OF WORK"}`,
        `CHANNEL: ${w.flags.signal_down ? "CLEAR" : "OCCUPIED — SOURCE UNKNOWN"}`,
      ],
      actions: [
        { id: "repair", label: "Rebuild the stack", kind: "accent", mins: 30, effects: [{ run: "repairComms" }] },
      ],
    },
    generator: {
      title: "Backup Generator", icons: "GRETA BASE", label: "Work on the generator",
      status: (w) => [`POWER: ${w.flags.generator_on ? "ONLINE — ALL CIRCUITS" : "OFFLINE"}`],
      actions: [
        { id: "start", label: "Start the generator", kind: "accent", mins: 15, effects: [{ run: "startGenerator" }] },
      ],
    },
    synth: {
      title: "Chemical Synthesis Rig", icons: "HERON · CLEAN ROOM", label: "Use the synthesis rig",
      status: (w) => [
        `RESEARCH: ${w.flags.have_research ? "LOADED" : "ABSENT"}`,
        `REAGENT: ${w.flags.have_cytotoxin ? "SPENT" : w.flags.knows_doxo ? "DOSAGE NOTE ON FILE — NEEDS 25L" : "UNKNOWN"}`,
        `POWER: ${w.flags.power_out && !w.flags.has_generator ? "NONE" : "AVAILABLE"}`,
      ],
      /* Two products, two different levers, and this is where the
         Study Group faction stops being a side quest. Coating
         ammunition needs Edem's research. The cytotoxin needs the
         unfinished dosage note and twenty-five litres of frozen
         chemotherapy from a medical case at Greta Base. A crew can
         get one, both, or neither. */
      actions: [
        { id: "coat", label: "Coat ammunition", kind: "accent", mins: 60, effects: [{ run: "coatAmmo" }] },
        { id: "doxo", label: "Compound the cytotoxin", kind: "accent", mins: 90, effects: [{ run: "compoundDoxo" }] },
      ],
    },
    floor: {
      title: "Level −01 Control Platform", icons: "HERON · LEVEL −01", label: "Use the floor controls",
      status: (w) => [`DOORS: ${w.flags.doors_forced ? "OVERRIDDEN — ALL OPEN" : "NORMAL"}`],
      actions: [
        { id: "override", label: "Override every door on this level", needs: "has:edemcard", needsText: "Medical authorisation required.", mins: 5, effects: [{ run: "doorOverride" }] },
        { id: "decon", label: "Run the decontamination cycle", mins: 5, effects: [{ run: "decon" }] },
      ],
    },
  },

  itemUse: {
    tinfoilhat: [{ run: "wearFoil" }],
    tumbler: [{ run: "throwAcid" }],
    acidvial: [{ run: "throwAcid" }],
    acidcan: [{ run: "throwAcid" }],
    tracker: [{ run: "readTracker" }],
    logiccore: [{ run: "readCore" }],
    carclimb: [{ run: "waveLimb" }],
    larva: [{ run: "waveLimb" }],
  },

  /* ============================================================
     THE SHRIEK, ONCE IT IS IN YOU

     Five stages, exactly as published, and the arc is the
     module's best horror because for the first two of them the
     victim does not know and neither does anybody else.

     Every stage that can be seen from outside has a `sayOthers`.
     That is the whole difference between an infection timer and
     a paranoia engine: the table needs something to notice,
     argue about, and be wrong about. Stage 1 is fine incisions
     the victim has not looked at yet. Stage 2 is somebody going
     absent for a few minutes. By stage 3 the crew are having a
     conversation about one of their own.
     ============================================================ */
  tracks: {
    shriek: {
      condition: "INFECTED — Stage 1",
      stages: [
        /* STAGE ONE AT 1d10 HOURS, NOT 2d10.

           The published arc is the module's best horror and it was
           being rolled on a clock the session does not have.
           `2d10*60` is a mean of eleven fiction-hours against a
           ten-hour storm — about a 45% chance the paper cuts ever
           become visible to the table during the session in which
           the infection was caught, and the first two stages are
           precisely the ones that matter, because for both of them
           the victim does not know and neither does anybody else.
           1d10 hours puts the incisions inside the storm nearly
           always, and leaves the later stages long. */
        {
          after: "1d10*60",
          effects: [
            { say: "Somebody has been making suggestions to you. Not aloud, and not unpleasantly. You keep almost catching what they want.", tone: "horror" },
            { sayOthers: "{name}'s forearms have come up in fine incisions — dozens of them, shallow, like paper cuts. They have not noticed and it seems rude to be the one to say.", tone: "warden" },
            { whisper: "It is not frightening. That is the part you should be frightened of." },
          ],
        },
        {
          after: "2d10*60",
          effects: [
            { condition: "INFECTED — Stage 2" },
            { say: "You lose some minutes. What is in them is a dream of tunnels, and a great deal of digging, and the enormous relief of being one of many.", tone: "horror" },
            { sayOthers: "{name} has stopped mid-sentence and is looking at nothing at all. It goes on long enough that somebody says their name twice.", tone: "horror" },
            { stressCrew: 1, why: "they were not there for a while" },
            { say: "▌ You now have [-] on anything that would harm a carcinid. A bioscanner will find a larva inside you.", tone: "warden" },
          ],
        },
        {
          after: "1d10*60",
          effects: [
            { condition: "INFECTED — Stage 3" },
            { say: "You come back to yourself somewhere you did not walk to, doing something with your hands that you did not decide to do.", tone: "horror" },
            { sayOthers: "{name} has gone to work — digging, stacking, walking towards something — and is not answering. Only real pain breaks it.", tone: "horror" },
            { stress: 2, why: "you did not walk here" },
          ],
          repeat: { every: 60, effects: [{ save: "body", why: "the drone-work", onFail: [{ stress: 1, why: "you went again" }] }] },
        },
        {
          after: "1d10*60",
          effects: [
            { condition: "ASSIMILATED — Stage 4" },
            { say: "There is no longer a decision being made here. What is left of you can open a door, press a button, and pull a pin.", tone: "horror" },
            { sayOthers: "{name} is standing in the doorway and will not answer to their name. When they try to speak it comes out as one syllable, strained, and then they stop trying.", tone: "horror" },
            { stressCrew: 2, why: "that is not them any more" },
            { flag: "assimilated" },
          ],
        },
        {
          after: "2d10*60",
          effects: [
            { say: "It has finished.", tone: "horror" },
            { sayOthers: "A fully grown carcinid comes out through {name}'s chest and shoulders in about four seconds, and is standing before the rest of them has finished falling.", tone: "horror" },
            { damage: "100", why: "it came out through you" },
            { stressCrew: 3, why: "you watched it happen to somebody you knew" },
            { fight: "carc", surprise: true, distance: 2 },
          ],
        },
      ],
    },
  },

  clocks: [
    {
      id: "colonists", start: 120, every: 180, when: "flag:reached_heron and !flag:endgame and !flag:signal_down",
      effects: [{ vanish: { text: "One of the colonists is not in the hangar and nobody can say when they last were.", witnessText: "It comes over the sandbags and takes somebody standing three metres from you, and it is gone again before the rifles come up.", stress: 1, witnessStress: 2 } }],
    },
  ],

  endings: {
    evacuated: {
      title: "YOU GOT OFF SAMSA VI", good: true,
      text:
        "The dropship claws its way up out of the weather with your crew aboard and whatever else you managed to "
        + "fit. Below, the storm closes over a continent that is not going to belong to anybody you know. The "
        + "Company will want a debrief. You have several days to decide how much of this to put in it.",
    },
    cure: {
      title: "YOU BROUGHT BACK THE CORE", good: true,
      text:
        "Hinton's logic core comes off the dropship in a lead case and goes into a Company lab, and eleven months "
        + "later there is a treatment for the cancer pattern. Your names are not on the paper. Neither is his. The "
        + "beacon he sent is still going, and it will arrive on schedule.",
    },
    quiet: {
      title: "YOU LEFT IT ALONE", good: true,
      text:
        "You break orbit with no samples, no core, and a full crew. The Company will take the ship, the fee and "
        + "most of a year off you for it. Samsa VI goes back to doing what it has been doing for a hundred years, "
        + "on schedule, and in about a decade it stops being the only one.",
    },
    drowned: {
      title: "THE WATER GOT THERE FIRST",
      text:
        "The storm does what the modelling said it would and the station goes under with everybody still arguing "
        + "about which mission to run. The dropship makes three passes over open water and then does not make a "
        + "fourth.",
    },
    hive: {
      title: "YOU CONTRIBUTED",
      text:
        "The suggestions stop being suggestions somewhere around the seventh hour. What walks out of the tunnels "
        + "on Samsa VI is wearing your crew and is very pleased to have been included.",
    },
    escape: {
      title: "YOU WALKED OUT OF THE COURT", good: true,
      text:
        "Nobody stops you. That is the part that stays with the table afterwards — not the three shrouded shapes, "
        + "not the android being reasonable, but the fact that you were allowed to leave because you did not "
        + "matter enough to keep.",
    },
    debrief: {
      title: "BREAKING ORBIT", good: true,
      text:
        "Samsa VI drops away behind you. Somewhere in the hold is whatever you decided was worth the people it "
        + "cost. The pilots want to know where to. Nobody has an answer yet, and there is a great deal of time "
        + "between here and anywhere.",
    },
    dead: {
      title: "ANOTHER BUG HUNT",
      text:
        "The rain keeps coming down on Samsa VI, the way it has for a hundred years, and the terraform continues "
        + "on schedule. In about ten years, something answers a call.",
    },
  },

  warden: {
    setting:
      "A century-old carcinid ship sleeps in the foothills with three nobles aboard. The colony's arrival "
      + "triggered an immune response. The colony's synthetic, Hinton, weaponised the carcs' reproductive Shriek "
      + "into a radio Signal, massacred the colony, and is now trying to upload himself into the hive. He has "
      + "already sent a distress call to the wider carcinid race. It arrives in ten years.",
    voice:
      "Everything is always getting worse and nothing rests. Do not let them settle. Zoom out when the scale "
      + "demands it — hour by hour rather than minute by minute — and zoom back in for the deaths.",
    constraints: [
      "Rifles and fire do not work. Hydrofluoric acid does. Make them pay to learn it; never tell them.",
      "One Wound and a carc breaks off and comes back later. Almost never fight one to the end.",
      "Remind them they can run. Repeatedly. It is usually the correct answer.",
      "None of the three missions in scenario two is the right one. Do not hint that one is.",
      "The Court is not an encounter to beat. Present it and let them decide, including deciding to leave.",
      "Hinton is pragmatic and ambitious, never a gloating villain. He will let a polite crew go.",
      "Failure should complicate, not halt. A failed roll costs time, noise or attention — never the scene.",
      "The cytotoxin makes three doses and there are at least four people who need one. Never suggest who.",
    ],
    npcNote:
      "The eleven survivors are entrenched in their positions and will not change them on their own. Let your "
      + "players move them. Nobody except Jensen knows what Hinton did; Sobol suspects for the wrong reasons and "
      + "is right anyway.",
  },

  debrief: [
    "Who did you leave on Samsa VI, and had you met them?",
    "What did you carry off the planet, and what did it cost?",
    "When did you first realise the guns were not going to work?",
    "Did anybody check each other for paper cuts? Did anybody refuse to be checked?",
    "There were three doses. Who got one, who did not, and who decided?",
    "The beacon is still going. It arrives in about ten years. What does your crew do with that?",
  ],
  xp: [
    { id: "acid", label: "Worked out what actually kills them", xp: 2 },
    { id: "signal", label: "Silenced the Signal", xp: 4 },
    { id: "siege", label: "Completed a mission for one of the three factions", xp: 2 },
    { id: "ship", label: "Boarded the mothership and came back", xp: 4 },
    { id: "core", label: "Recovered Hinton's logic core", xp: 4 },
    { id: "doxo", label: "Worked out the second answer, and made it", xp: 3 },
    { id: "cured", label: "Took a larva out of somebody who was going to die of it", xp: 4 },
    { id: "everyone", label: "Got a colonist off the planet who was not on the contract", xp: 3 },
  ],

  /* ============================================================
     HOOKS

     The simulation lives in sim.js. What is here is the thin
     layer of module-specific plumbing that is shorter as code
     than as effects: the mission buttons, the acid throw, and
     the two or three items that behave differently depending on
     where you are standing when you use them.
     ============================================================ */
  hooks: {
    ...simHooks,

    missionLeave: (api) => { simHooks.takeMission(api, "leave"); },
    missionStudy: (api) => { simHooks.takeMission(api, "study"); },
    missionHog: (api) => { simHooks.takeMission(api, "hog"); },

    stormBreaks(api) {
      if ((api.world().flags || {}).storm_over) return;
      api.say("alarm", "The storm breaks. The rain stops between one second and the next, and the silence afterwards is enormous.");
      api.say("horror", "And every carcinid on this continent, which has spent ten hours underground and underwater, comes up.");
      api.flag({ storm_over: true, evac_mode: "landed" });
      api.say("warden", "▌ A landed evacuation is possible again. So is everything else.");
    },

    throwAcid(api) {
      const w = api.world();
      if (!w.combat) {
        api.say("system", "Not much point throwing it at a wall. Keep hold of it — there is exactly one thing on this planet it is for.");
        return;
      }
      api.say("good", "It goes across the gap and lands, and the carapace stops being carapace where it touches.");
      api.effects([{ damage: "3d10", target: "threat", why: "hydrofluoric acid" }]);
    },

    readTracker(api) {
      api.effects([{ table: null }]);
      api.say("system", "The fix has not moved in three months. It is up in the foothills, under a great deal of rock.");
      api.flag("knows_mountain");
    },

    readCore(api) {
      const f = api.world().flags || {};
      if (f.core_read) { api.say("system", "Still running. Still, in some sense, him."); return; }
      api.flag("core_read");
      api.say("horror",
        "It is still running. Three months of logs, meticulously kept, and the last several weeks are not notes "
        + "on an experiment — they are a diary, and it is happy.");
      api.say("good", "Everything needed to build a treatment for the cancer pattern is in here. Somebody with a lab could do it in under a year.");
      api.flag("knows_cure");
      api.effects([{ save: "sanity", why: "reading somebody's diary about becoming this", onFail: [{ stress: 2, why: "he was happy about it" }] }]);
    },

    waveLimb(api) {
      const w = api.world();
      const room = (api.mod.rooms[w.room] || {});
      if (!(room.tags || []).includes("CARC")) {
        api.say("system", "Nothing here is interested in what you are holding. Everything on the mothership will be.");
        return;
      }
      api.say("good", "Whatever is nearest reads it, decides you are family, and stops treating you as a problem.");
      api.flag("smells_right");
    },

    bioscan(api) {
      const pc = api.pc();
      const cond = (pc.conditions || []).join(" ");
      if (/INFECTED|ASSIMILATED/.test(cond)) {
        api.say("horror", "The scanner finds a second organism inside the person it is pointed at, curled up, developing on schedule.");
        api.whisper("It is in you. It has been in you for a while.");
        api.effects([{ save: "sanity", onFail: [{ stress: 2, why: "you scanned yourself" }] }]);
      } else {
        api.say("good", "Clean. One organism, correct number of hearts.");
      }
      api.say("warden", "▌ From Stage 2 onward a bioscanner finds the larva. Before that it finds nothing, which is not the same as there being nothing.");
    },

    callEvac(api) {
      const f = api.world().flags || {};
      api.flag("evac_called");
      const mode = f.evac_mode || "landed";
      if (mode === "none") {
        api.say("alarm", "The dropship answers, listens to the weather data, and tells you plainly that it cannot come. It will keep the channel open.");
        return;
      }
      if (mode === "hover") {
        api.say("system", "The dropship answers. It cannot land in this — it will come in on a hover and put the co-pilot down on a cable, one at a time, a few minutes each.");
        api.say("warden",
          "▌ Three people, and then the pilot says he will lose the aircraft if he stays. Every additional person "
          + "after that warning is a cumulative ten per cent chance he loses it anyway.");
        api.flag({ hover_evac: true, evac_inbound: true });
        return;
      }
      api.say("good", "The dropship answers and says it can put down. Twenty minutes out.");
      api.flag({ landed_evac: true, evac_inbound: true });
    },

    /* THE WAY OUT, AND THEREFORE THE WAY INTO SCENARIO FOUR.
       The ship is not somewhere anybody walks to — it is where
       you end up if the evacuation works, which is why it has no
       exit pointing at it and this hook instead. */
    boardEvac(api) {
      const f = api.world().flags || {};
      if (f.hover_evac) {
        const lifted = (f.lifted || 0) + 1;
        api.flag({ lifted });
        api.say("system", `The cable comes down through the rain and goes back up with somebody on it. That is ${lifted}.`);
        if (lifted > 3) {
          api.say("alarm", "The pilot has already said he will lose the aircraft. He says it again, louder.");
          if (api.rng() < 0.1 * (lifted - 3)) {
            api.say("horror", "He loses it. The dropship goes over on its side about forty metres up and takes everybody on the cable with it.");
            api.endGame("drowned");
            return;
          }
        }
      }
      api.say("good", "The ramp closes and Samsa VI drops away underneath you, and the rain stops being a thing that is happening to you.");
      api.moveTo("metamorphosis");
    },

    doorOverride(api) {
      api.flag("doors_forced");
      api.say("system", "Every door on the level unseals at once, all the way down the corridor, in sequence.");
      api.say("horror", "Including the ones that were holding something on the other side of them.");
    },

    decon(api) {
      api.say("system", "Overhead sprinklers cut in across the clean room, the cryovault and the airlock, and everything in them is briefly a white blur.");
      api.effects([{ save: "body", why: "the antibacterial spray", onFail: [{ condition: "BLINDED" }, { say: "You cannot see for a round, and neither can anything else in there.", tone: "warden" }] }]);
    },

    onUnconscious(api) {
      api.say("horror", "You go down. The last thing you are sure of is that something in the room has stopped what it was doing and is now attending to you specifically.");
    },
  },
});
