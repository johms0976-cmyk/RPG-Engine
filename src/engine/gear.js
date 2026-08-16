/* ============================================================
   GEAR — the standard Player's Survival Guide kit.
   Modules merge their own items on top of this table.

   Item flags the engine understands:
     armor:n     adds to Armor Save (best worn suit counts)
     dmg:"2d10"  weapon damage; tag:"WPN" makes it appear in combat
     shots:n     limited uses before empty
     uses:n      consumable charges
     heal:true   clicking it in the sheet heals
     loud:true   using it makes noise
     melee:true  uses Close-Quarters Combat instead of Firearms
     cuts:true   can cut through doors
   Anything else (water:true, ir:true, goo:true…) is module vocabulary
   and is only meaningful to the module that looks for it.
   ============================================================ */

export const GEAR = {
  crowbar: { n: "Crowbar", d: "Advantage on Strength checks to force doors or lift weight. 1d10 dmg.", dmg: "1d10", tag: "WPN", melee: true },
  handwelder: { n: "Hand Welder", d: "Cuts through airlocks and heavy doors. 1d10 dmg, −10 vs Armor.", dmg: "1d10", tag: "WPN", melee: true, cuts: true },
  lasercutter: { n: "Laser Cutter", d: "Wide beam. d% damage. One round to recharge between shots. 6 shots.", dmg: "d%", tag: "WPN", shots: 6, cuts: true },
  bodycam: { n: "Body Cam", d: "Streams what you see back to a terminal." },
  bioscanner: { n: "Bioscanner", d: "Scans 100m for signs of life. Tells you where, not what.", scanner: true },
  irgoggles: { n: "Infrared Goggles", d: "Heat signatures, sometimes hours old.", ir: true },
  lockpicks: { n: "Lockpick Set", d: "+10% on rolls to open airlock and electronic door systems." },
  vaccsuit: { n: "Vaccsuit", d: "+7% Armor. Speed checks at Disadvantage. Needs an oxygen tank.", armor: 7, vacc: true },
  hazardsuit: { n: "Hazard Suit", d: "+5% Armor. Air filtration, one hour of stored air.", armor: 5, vacc: true },
  battledress: { n: "Standard Battle Dress", d: "+10% Armor. Light plate.", armor: 10 },
  o2tank: { n: "Oxygen Tank", d: "12 hours of air. 6 under stress. Explosive." },
  magboots: { n: "Mag-Boots", d: "Magnetic grip on hull plate and metal asteroid." },
  radio: { n: "Short-range Comms", d: "Surface-to-surface within a dozen kilometres." },
  vibechete: { n: "Vibechete", d: "2d10 dmg. Crit hacks off a limb. Won't cut airlocks.", dmg: "2d10", tag: "WPN", melee: true },
  rigginggun: { n: "Rigging Gun", d: "2d10 dmg, impale on crit. 500m micro-filament. 1 shot.", dmg: "2d10", tag: "WPN", shots: 1 },
  flaregun: { n: "Flare Gun", d: "1d10 dmg. Visible from 25km. 2 shots.", dmg: "1d10", tag: "WPN", shots: 2 },
  firstaid: { n: "First Aid Kit", d: "+10% to rolls to bandage wounds and stop bleeding.", heal: true },
  surveykit: { n: "Survey Kit", d: "Maps a few kilometres of surface. Reads atmosphere and gravity." },
  waterfilter: { n: "Water Filter", d: "50 litres of clean water an hour from almost anything.", water: true },
  locator: { n: "Locator", d: "Lets a terminal track where you are." },
  rebreather: { n: "Rebreather", d: "Twenty minutes of filtered air." },
  binoculars: { n: "Binoculars", d: "20x. Thermal and night options." },
  flashlight: { n: "Flashlight", d: "Illuminates 20m ahead.", light: true },
  mres: { n: "MREs x7", d: "A week of joyless calories." },
  smg: { n: "SMG", d: "4d10 dmg. Fully automatic. 1(5) shots.", dmg: "4d10", tag: "WPN", shots: 5, loud: true },
  fraggrenades: { n: "Frag Grenades x6", d: "1d10 to everything within 15m. Very loud.", dmg: "1d10", tag: "WPN", shots: 6, loud: true },
  hud: { n: "Heads-Up Display", d: "See through squad body cams. Enables smart-link." },
  stimpak: { n: "Stimpak x6", d: "Heals 2d10. +2d10 Strength and Combat for 1d10 hours. Addictive.", uses: 6, heal: "2d10" },
  painpills: { n: "Pain Pills x6", d: "Heals 1d10 and drops Stress by 1. Addictive.", uses: 6, heal: "1d10", calm: 1 },
  automed: { n: "Automed x6", d: "+10% Body saves against disease and poison, +10% Fear saves to shed Stress.", uses: 6 },
  toolkit: { n: "Electronic Tool Set", d: "+10% to repairing electronics." },
  scalpel: { n: "Scalpel", d: "1d10 dmg, +1d10 and bleeding on crit. +10% Surgery.", dmg: "1d10", tag: "WPN", melee: true },
  tranqpistol: { n: "Tranq Pistol", d: "No damage. Body[+] save or unconscious 1d10 rounds. 6 shots.", tag: "WPN", shots: 6 },
  stunbaton: { n: "Stun Baton", d: "1d10 dmg. Body save or stunned one round.", dmg: "1d10", tag: "WPN", melee: true },
  medscanner: { n: "Medscanner", d: "Reads a living or dead body for disease and abnormality." },
  cybscanner: { n: "Cybernetic Diagnostic Scanner", d: "Diagnoses androids. Androids hate it." },
};

export const LOADOUTS = {
  excavation: {
    name: "EXCAVATION", note: "Cutting, prying, and seeing in the dark.",
    items: ["crowbar", "handwelder", "lasercutter", "bodycam", "bioscanner", "irgoggles", "lockpicks", "vaccsuit", "o2tank", "magboots", "radio"],
  },
  exploration: {
    name: "EXPLORATION", note: "Long walks somewhere that wants you dead.",
    items: ["vibechete", "rigginggun", "flaregun", "firstaid", "vaccsuit", "o2tank", "surveykit", "waterfilter", "locator", "rebreather", "binoculars", "flashlight", "mres"],
  },
  extermination: {
    name: "EXTERMINATION", note: "For when the answer is ammunition.",
    items: ["smg", "fraggrenades", "battledress", "hud", "bodycam", "radio", "stimpak", "toolkit"],
  },
  examination: {
    name: "EXAMINATION", note: "Field medicine and unwise curiosity.",
    items: ["scalpel", "tranqpistol", "stunbaton", "hazardsuit", "medscanner", "automed", "painpills", "stimpak", "cybscanner"],
  },
};
