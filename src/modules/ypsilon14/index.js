/* ============================================================
   THE HAUNTING OF YPSILON 14
   Module by D. G. Chapman, Tuesday Knight Games.
   Built as a play aid for your own copy. Descriptions here are
   rewritten, not reproduced.
   ============================================================ */
import { defineModule } from "../../engine/defineModule.js";
import { rooms, map } from "./rooms.js";
import { npcs, npcOrder, threats } from "./npcs.js";
import { items, handouts } from "./items.js";

export default defineModule({
  id: "ypsilon14",
  title: "THE HAUNTING OF YPSILON 14",
  subtitle: "MOTHERSHIP · SCI-FI HORROR RPG · ONE SHOT",
  byline: "Module by D. G. Chapman, Tuesday Knight Games. Rules: Mothership 1e.",
  length: "One shot",
  blurb: "A remote asteroid mining base. Ten crew, one cat, and one worker who is no longer accounted for.",
  pitch: [
    "During a routine cargo job on a remote asteroid mining base you learn that one of the workers has disappeared. No blood, no body, no record of the airlock opening. Just gone.",
    "And that is not the only unexplainable thing that has been happening at Ypsilon 14. What is the alien material at the heart of this asteroid? Who, if anyone, can be trusted? And can you make it out alive before you also disappear?",
  ],

  contentWarning: "Body horror, disappearance, isolation, and the death of people you have spoken to. One scene involves a corpse behaving as though it is not one.",
  crewSize: { min: 1, max: 4, suggested: 3 },

  theme: { accent: "#F5C518" },

  flavour: {
    any: [
      "The base breathes through its ducting, in and out, on a cycle you have started to notice.",
      "Rock dust has got into everything, including the seals.",
      "Somewhere a long way below, a drill changes note and settles.",
    ],
    VENT: ["The grille above you is warm, and the air coming through it is warmer."],
    MINE: ["The rock here is the temperature of a hand."],
  },

  shops: {
    cargo: {
      name: "YOUR SHIP'S HOLD",
      blurb: "What you brought with you, and what the manifest says you can sign out.",
      markup: 1,
      stock: ["firstaid", "painpills", "stimpak", "automed", "flashlight", "radio", "o2tank", "rebreather", "crowbar", "boneknife", "flaregun", "campinggear"],
    },
  },

  items, handouts, rooms, npcs, npcOrder, threats, map,
  start: "db2",

  intro: [
    "YPSILON 14. A rock the size of a small town, mined for metals, crewed by ten people and a cat. You are here on a routine cargo job, en route to a trading satellite, and the docking clamps have just taken hold.",
    { tone: "npc", text: "SONYA: You're early. Bay two's yours. I'll open the inner lock from the workspace — give me a minute." },
    { tone: "system", text: "During your approach you learned that one of the workers has disappeared. No blood. No body. No record of the airlock opening. Just gone." },
    { tone: "system", text: "The Warden will only ask you for a roll when failure would cost you something. Everything else is description. Move, look, talk, and use what you're carrying." },
  ],

  talkPrompts: [
    "What happened to Mike?",
    "What is that yellow stuff in the mine?",
    "Has anything felt wrong lately?",
    "Who is Dr Giovanni and what is he doing here?",
  ],

  /* ---- an action available anywhere ---- */
  actions: [{
    id: "listen", label: "Stop and listen",
    effects: [
      { time: 30 },
      { say: "You stop and listen to the base for half an hour. Pumps. The drills, far below. Somewhere, a fan. And under all of it, at the edge of hearing, a sound like a wet click.", tone: "search" },
    ],
  }],

  /* ---- the workspace terminal, and its twin in the vents ---- */
  devices: {
    terminal: {
      title: "Workspace Computer Terminal", icons: "BASE OPS", label: "Use the terminal",
      status: (w, pc) => [
        "YPSILON 14 · OPERATIONS",
        `SHOWERS: ${w.flags.showers ? "RUNNING" : "OFF"} · AIRLOCKS: ${w.flags.airlocks_locked ? "LOCKED" : "RELEASED"}`,
        `AUTH: ${pc.items.includes("keycard") ? "TEAM LEADER KEYCARD PRESENT" : "CREW LEVEL — SOME FUNCTIONS LOCKED"}`,
      ],
      actions: [
        {
          id: "showers",
          label: (w) => (w.flags.showers ? "Shut the showers off" : "Turn the washroom showers on"),
          effects: [{ run: "toggleShowers" }],
        },
        {
          id: "airlocks",
          label: (w) => (w.flags.airlocks_locked ? "Release the airlocks" : "Lock the airlocks"),
          effects: [{ run: "toggleAirlocks" }],
        },
        { id: "manifest", label: "Pull the crew manifest", effects: [{ run: "manifest" }] },
        {
          id: "selfdestruct", kind: "accent",
          label: (w) => (w.flags.destruct_armed ? "Abort the self-destruct sequence" : "Initiate the base self-destruct sequence"),
          needs: "has:keycard",
          needsText: "BASE OPS · SEQUENCE LOCKED. Team leader authorisation required. Insert keycard.",
          effects: [{
            when: "flag:destruct_armed",
            then: [{ flag: { destruct_armed: false } }, { stopCountdown: "selfdestruct" }, { say: "BASE OPS · Sequence aborted." }],
            else: [
              { flag: "destruct_armed" },
              { countdown: { id: "selfdestruct", minutes: 30, tick: "SELF-DESTRUCT · {left} minutes remaining.", onZero: [{ end: "boom" }] } },
              { say: "BASE OPS · CHARGE SEQUENCE ARMED. THIRTY MINUTES. All personnel to docking. This announcement will not be repeated.\n\nEvery light in the base turns the same colour.", tone: "alarm" },
              { stress: 1, why: "you just did that" },
            ],
          }],
        },
      ],
    },
  },

  /* ---- infrared goggles behave specially here ---- */
  itemUse: {
    irgoggles: [
      { time: 5 },
      { flag: "wearing_ir" },
      { say: "You pull the goggles on. The world goes to grades of grey and heat.", tone: "search" },
      {
        when: "room:db1",
        then: [{ say: "Three-toed footprints cover every surface of this ship except the science lab and the ruined washroom. Hundreds of them. Old ones and fresh ones, on the deck, the walls, the ceiling.", tone: "horror" }],
        else: [{
          when: "threat:it",
          then: [{ say: "There is a fuzzy, not-quite-humanoid shape standing about two metres from you. It is not warm enough to be alive. It is close enough to touch.", tone: "horror" }],
          else: [{ say: "Old heat traces on the floor, going through doorways nobody uses." }],
        }],
      },
    ],
  },

  /* ---- the goo, once it is in you ---- */
  tracks: {
    infection: {
      condition: "INFECTED — yellow goo",
      stages: [
        { after: 60, effects: [{ condition: "Strong" }, { say: "Your wounds have closed. You feel extraordinary. You have not wanted a drink of water in over an hour.", tone: "good" }] },
        {
          after: "2d10*60",
          effects: [{ say: "Your hands are wrong. They are the wrong shape, and they are warm, and they are running.", tone: "horror" }, { damage: "1d10", why: "you are becoming the goo" }],
          repeat: { every: 10, effects: [{ damage: "1d10", why: "you are becoming the goo" }] },
        },
      ],
    },
  },

  /* ---- the base gets quieter on its own schedule ---- */
  clocks: [{
    id: "disappearances", start: 90, every: "60+1d6*10",
    effects: [{
      vanish: {
        text: "A radio call goes unanswered somewhere on the base. {name} is not where {name} should be. No blood. No body. No airlock log.",
        stress: 1,
      },
    }],
  }],

  endings: {
    win: { title: "IT IS DEAD", good: true, text: "You undock with a dead thing cooling on the deck behind you and nine names to explain. The Company will want the specimen. You have opinions about that." },
    escape: { title: "YOU GOT OFF THE ROCK", good: true, text: "You clear the collar with minutes to spare. Behind you the asteroid opens like a struck match, and every reason anyone had to come back here goes with it." },
    followed: { title: "IT CAME WITH YOU", text: "You seal up, undock, and put the rock behind you. Two hours into the burn, your ship's dust log records a mass it cannot account for, moving quietly between compartments. It came with you. It was always going to come with you." },
    dead: { title: "YOU DIED", text: "You bleed out on the deck plate of a rock nobody will visit for a fortnight." },
    coma: { title: "YOU DID NOT WAKE UP", text: "You do not wake up. Not here, not on this rock, not in time." },
    insane: { title: "YOU ARE NOT COMING BACK", text: "Whatever is left of you will not be making any more decisions. The Warden has your sheet now." },
    boom: { title: "YOU WERE STILL INSIDE", text: "The sequence completes while you are still inside it. Ypsilon 14 becomes a very brief light, and then nothing at all." },
  },

  debrief: (w, pc, mod) => {
    const lost = mod.npcOrder.filter((n) => w.npcs[n].taken).map((n) => mod.npcs[n].name);
    const alive = mod.npcOrder.filter((n) => w.npcs[n].alive && !w.npcs[n].taken && !mod.npcs[n].gone && n !== "giovanni").map((n) => mod.npcs[n].name);
    return [
      `Still standing: ${alive.length ? alive.join(", ") : "nobody"}`,
      `Unaccounted for: ${["MIKE VOSS", ...lost].join(", ")}`,
      `Understood the goo: ${w.flags.knows_goo ? "yes" : "no"} · Learned it fears water: ${w.flags.knows_water ? "yes" : "no"}`,
    ];
  },

  xp: (w, pc) =>
    10 + (w.flags["slain:it"] ? 3 : 0) + (w.flags.knows_goo ? 2 : 0) + (w.flags.heard_tape3 ? 1 : 0),

  warden: {
    setting: "Ypsilon 14 is a remote asteroid mining base. Ten crew, one cat. A miner named Mike Voss vanished last night — no blood, no body, no airlock log. The mining broke open a stasis pod buried in the rock. An INVISIBLE alien predator is loose on the base. It is blind and hunts by echolocation; loud noise confuses it. It is cautious around water and will avoid it. Wounded, it retreats to its pod in the Mine Antechamber, where yellow goo repairs it. Yellow goo also infects people who touch it: the first sign is an aversion to water, then unnatural strength and healing, then, hours later, they melt. Kantaro is infected. Dr Giovanni on the ship Heracles is already dead — what stands in the lab is wrong, and lunges when approached.",
    constraints: [
      "Nothing the player does can reveal the creature to the naked eye. Infrared, dust, sound, and the cat can imply it.",
      "Never say \"you feel\" — describe what is there and let them feel it.",
    ],
    npcNote: "The crew do NOT know there is an alien. They know Mike is missing. Do not let them work it out for the player.",
  },

  /* ---- the last 5%: things easier to write as code than as data ---- */
  hooks: {
    examineGoo(api) {
      const r = api.rollNow({
        kind: "stat", name: "intellect",
        skill: ["Xenobiology", "Genetics", "Biology"],
        tags: ["science", "diagnose", "medical"],
        why: "the slide under the scope",
      });
      if (!r.success) { api.say("system", "The slide is beautiful and completely opaque to you."); return; }
      api.flag("knows_goo");
      api.awardXp(2);
      api.say("good", "You get it, more or less. It isn't a disease. It's a repair medium - it takes a body apart and rebuilds it into something that suits its owner better. It heals what it infects, and then it finishes the job. Whatever made it left it here to keep something else alive between stars.");
    },

    giovanniEncounter(api) {
      const w = api.world();
      if (w.threats.giovanni.dead) {
        api.say("system", "What's left of Dr Giovanni is on the lab floor, slowly losing its shape.");
        return;
      }
      api.say("horror", "Dr Ethan Giovanni stands at the end of the bench, silent, smiling. Slowly his mouth widens, further than a mouth goes, and yellow goo dribbles out and leaks from his throat like albumen. He lunges for you, grinning wide and crying yellow.");
      api.rollNow({ kind: "save", name: "sanity", why: "that is not a person" });
      api.give(["irgoggles"]);
      api.say("item", "Infrared goggles hang on a cord around his neck.");
      api.startCombat("giovanni", { surprise: false });
    },

    killGiovanni(api) {
      api.effects([{ flag: "giovanni_dead" }]);
      api.setThreat("giovanni", { dead: true });
    },

    toggleShowers(api) {
      const w = api.world();
      const on = !w.flags.showers;
      api.flag("showers", on);
      api.say("system", `BASE OPS · Washroom showers ${on ? "RUNNING" : "OFF"}.${on ? " Water is standing on the floor down there now." : ""}`);
      if (on && w.threats.it.loc === "wash") {
        api.setThreat("it", { loc: "vents", retreat: 20 });
        api.flag("knows_water");
        api.say("horror", "The pipes bang. Something leaves the washrooms very fast.");
      }
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
        .map((n) => `${mod.npcs[n].name}${w.npcs[n].taken ? " (unaccounted)" : ""}`)
        .join(", ");
      api.say("system", `BASE OPS · Crew manifest: Voss (unaccounted), ${crew}. Visiting: Dr E Giovanni, research vessel Heracles, Bay 1, docked 34 days.`);
    },

    onUnconscious(api) {
      api.advance(60);
      api.effects([{ vanish: { text: "You come round. {name} was calling your name a while ago and has stopped." } }]);
    },
  },
});
