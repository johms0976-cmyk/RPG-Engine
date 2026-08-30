/* ============================================================
   TEMPLATE — copy this folder, rename it, register it in
   src/modules/index.js. Three rooms, one threat, one ending.
   Everything here is optional except id / title / rooms / start.
   ============================================================ */
import { defineModule } from "../../engine/defineModule.js";

export default defineModule({
  id: "template",
  /* Which system this was written for. Every module here has always
     been a Mothership one; saying so is what lets the engine refuse
     to load it into a ruleset where its loadouts and skills would
     silently resolve to nothing. See docs/RULESETS.md. */
  ruleset: "mothership1e",
  title: "A COLD START",
  blurb: "Three rooms and something in the dark. A skeleton to build your own module on.",
  byline: "Template module — safe to delete.",
  length: "Demo",

  theme: { accent: "#4FD1C5" },     // one colour restyles the whole player

  /* ---- extra gear on top of the standard PSG kit ---- */
  items: {
    fuse: { n: "Spare Fuse", d: "Ceramic, warm to the touch.", found: true },
    logslate: { n: "Cracked Slate", d: "Somebody's last shift report.", handout: "log", found: true },
  },

  handouts: {
    log: {
      label: "▶ SHIFT REPORT — INCOMPLETE",
      text: "Three lines of routine, then handwriting that stops mid-word.",
      effects: [{ save: "sanity", onFail: [{ stress: 1, why: "you read to the end" }] }],
    },
  },

  start: "hold",
  rooms: {
    hold: {
      n: 1, name: "CARGO HOLD", tags: ["DARK"],
      look: "Crates lashed to the deck. The lamps are down to emergency amber and the air recycler is running rough.",
      exits: [
        { to: "corridor", label: "Hatch → Corridor [2]", mins: 5 },
        { to: "@leave", label: "Cut loose and go", confirm: "Choose it again to undock." },
      ],
      features: {
        crates: { name: "Lashed crates", d: "Manifest says machine parts. One is open and empty." },
        panel: { name: "Breaker panel", d: "A blown fuse, and a spare taped inside the cover.", gives: ["fuse"] },
      },
    },

    corridor: {
      n: 2, name: "CORRIDOR", tags: ["VENT"],
      look: "A spine of grating and conduit. Something has been through here dragging its own weight.",
      exits: [
        { to: "hold", label: "Back → Cargo Hold [1]", mins: 5 },
        {
          to: "bridge", label: "Pressure door → Bridge [3]", mins: 5,
          gate: {
            flag: "bridge_open",
            routes: [{ when: "has:fuse", text: "You seat the spare fuse. The door remembers what it is for." }],
            roll: { label: "DOOR", stat: "strength", passText: "it grinds open", failText: "it does not move" },
          },
        },
      ],
      features: {
        slate: { name: "A cracked slate", d: "Dropped, face down, still faintly lit.", gives: ["logslate"] },
        grating: { name: "The grating", d: "Scratches, deep and parallel, running the length of it.", deep: true, setsFlag: "saw_scratches" },
      },
    },

    bridge: {
      n: 3, name: "BRIDGE", tags: ["TERMINAL"],
      look: "Consoles up and idling. The pilot's chair is turned to face the door.",
      exits: [{ to: "corridor", label: "Back → Corridor [2]", mins: 5 }],
      features: {
        chair: {
          name: "The pilot's chair",
          d: "Occupied, in the sense that something is sitting in it.",
          effects: [{ save: "fear", onFail: [{ stress: 2, why: "it turns its head" }] }, { fight: "thing", surprise: true }],
        },
      },
    },
  },

  npcs: {},

  threats: {
    thing: {
      name: "THE PASSENGER", combat: 55, speed: 45, maxHits: 2,
      attacks: [{ name: "Grip", dmg: "2d10", text: "It takes hold of you without hurrying." }],
      onSlain: [{ say: "It comes apart and stops.", tone: "good" }, { flag: "cleared" }],
    },
  },

  endings: {
    leave: { title: "YOU LEFT", good: true, text: "You undock. Whatever was aboard is somebody else's contract now." },
    dead: { title: "YOU DIED", text: "The recycler keeps running." },
  },

  warden: {
    setting: "A small derelict hauler. Something came aboard and is still here.",
  },
});
