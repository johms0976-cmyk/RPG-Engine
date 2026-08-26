/* ============================================================
   ANOTHER BUG HUNT — THE WHOLE PLANET

   Three location sets, kept in three files because they are
   three scenarios and a Warden reads them one at a time.

   The map is drawn by region rather than by geometry: Samsa VI
   is not a deck plan and pretending otherwise produces a
   spaghetti diagram nobody can read at the table. Greta Base
   gets a floor plan because it is a building; Heron gets a
   vertical stack because it is a tower with four levels under
   it; the mothership gets three parallel routes because that is
   the only true thing you can say about its shape.
   ============================================================ */
import { gretabase } from "./rooms.gretabase.js";
import { heron } from "./rooms.heron.js";
import { mothership } from "./rooms.mothership.js";

export const rooms = { ...gretabase, ...heron, ...mothership };

export const map = {
  width: 480, height: 620, BW: 92, BH: 40,

  pos: {
    /* ---- GRETA BASE: a prefab floor plan ---- */
    lz: [16, 16], airlock: [124, 16], commissary: [232, 16], pantry: [340, 16],
    garage: [16, 76], habitat: [232, 76], freezer: [340, 76],
    armory: [124, 136], command: [232, 136], medbay: [340, 136],

    /* ---- HERON: a tower with four levels underneath it ---- */
    relay: [340, 232], control: [340, 292], lift: [232, 292], dam: [124, 292],
    hangar: [16, 292],
    lab: [16, 352], clean: [124, 352], cryo: [232, 352],
    tumblers: [124, 412], walkway: [232, 412], stairs: [340, 412],
    chimney: [16, 412], spillways: [340, 352],
    reactor: [16, 472], tunnels: [124, 472],

    /* ---- THE MOTHERSHIP: three routes, converging ---- */
    thrusters: [16, 544], mothairlock: [124, 544], crack: [232, 544],
    court: [340, 544],
    metamorphosis: [340, 472],
  },

  links: [
    /* Greta Base */
    { p: "M108,36 H124", kind: "hall" },
    { p: "M216,36 H232", kind: "airlock" },
    { p: "M324,36 H340", kind: "hall" },
    { p: "M386,56 V76", kind: "locked" },
    { p: "M278,56 V76", kind: "locked" },
    { p: "M278,116 V136", kind: "hall" },
    { p: "M232,96 H170 V136", kind: "hall" },
    { p: "M324,156 H278", kind: "hall" },
    { p: "M62,56 V96 H16", kind: "hall" },
    { p: "M340,96 V116 H386 V136", kind: "shaft" },
    { p: "M62,96 V156 H124", kind: "shaft" },

    /* Greta ↔ Heron */
    { p: "M62,56 V212 H62 V292", kind: "trail" },

    /* Heron */
    { p: "M108,312 H124", kind: "trail" },
    { p: "M216,312 H232", kind: "trail" },
    { p: "M324,312 H340", kind: "hall" },
    { p: "M386,272 V292", kind: "shaft" },
    { p: "M62,332 V352", kind: "shaft" },
    { p: "M108,372 H124", kind: "airlock" },
    { p: "M216,372 H232", kind: "locked" },
    { p: "M170,392 V412", kind: "shaft" },
    { p: "M278,392 V412", kind: "shaft" },
    { p: "M216,432 H232", kind: "hall" },
    { p: "M324,432 H340", kind: "hall" },
    { p: "M386,392 V352", kind: "hall" },
    { p: "M62,432 V472", kind: "shaft" },
    { p: "M108,492 H124", kind: "crack" },
    { p: "M340,432 H278", kind: "hall" },
    { p: "M62,392 V412", kind: "shaft" },

    /* Heron ↔ mothership */
    { p: "M124,512 V544 H124", kind: "crack" },

    /* The mothership */
    { p: "M108,564 H124", kind: "hall" },
    { p: "M216,564 H232", kind: "hall" },
    { p: "M324,564 H340", kind: "airlock" },
  ],

  extras: [
    { room: "apc", x: 16, y: 196, w: 200, h: 26, label: "THE APC", note: "INSIDE THE GARAGE [10]" },
    { room: "ducts", x: 232, y: 196, w: 232, h: 26, label: "THE DUCTING", note: "CRAWLSPACE — 5 · 8 · 10" },
    { room: "a1", x: 16, y: 588, w: 140, h: 24, label: "ROUTE A — [A1] … [A5]", note: "THRUSTERS · PUZZLES · NO FIGHTS" },
    { room: "b1", x: 170, y: 588, w: 140, h: 24, label: "ROUTE B — [B1] … [B5]", note: "AIRLOCK · SHORT · LETHAL" },
    { room: "c1", x: 324, y: 588, w: 140, h: 24, label: "ROUTE C — [C1] … [C5]", note: "DORSAL CRACK · WET · QUIET" },
  ],
};
