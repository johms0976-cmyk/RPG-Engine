/* ============================================================
   THE CARTRIDGE SLOT
   defineModule() takes a module's raw data, checks it, fills in
   defaults, and hands the engine something it can always rely on.

   Bump ENGINE_VERSION's major when the contract breaks.
   ============================================================ */
import { GEAR, LOADOUTS } from "./gear.js";

export const ENGINE_VERSION = "1.0.0";

const DEFAULT_THEME = {
  void: "#0A0A0B", void2: "#141416", bone: "#EDEAE3", bone2: "#D8D4C9",
  ink: "#111112", accent: "#F5C518", blood: "#7E1416", graphite: "#6F6A61",
  display: "'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', Impact, sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
};

/** Fallback map: lay unplaced rooms out on a grid so a module never *has* to draw one. */
function autoLayout(rooms) {
  const ids = Object.keys(rooms).filter((id) => rooms[id].onMap !== false);
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(ids.length))));
  const BW = 104, BH = 46, GX = 120, GY = 62;
  const pos = {};
  ids.forEach((id, i) => {
    pos[id] = [8 + (i % cols) * GX, 14 + Math.floor(i / cols) * GY];
  });
  return { pos, links: [], BW, BH, width: 8 + cols * GX, height: 30 + Math.ceil(ids.length / cols) * GY };
}

export function defineModule(raw) {
  const problems = [];
  const need = (k) => { if (!raw[k]) problems.push(`module is missing "${k}"`); };
  ["id", "title", "rooms", "start"].forEach(need);

  const rooms = raw.rooms || {};
  if (!rooms[raw.start]) problems.push(`start room "${raw.start}" is not in rooms`);

  // Every exit must go somewhere real (or to a declared terminal like "SHIP").
  const terminals = new Set(Object.keys(raw.endings || {}).map((k) => `@${k}`));
  Object.entries(rooms).forEach(([id, r]) => {
    (r.exits || []).forEach((e) => {
      if (!rooms[e.to] && !terminals.has(e.to) && !String(e.to).startsWith("@")) {
        problems.push(`room "${id}" has an exit to unknown room "${e.to}"`);
      }
    });
  });

  const items = { ...GEAR, ...(raw.items || {}) };
  const loadouts = raw.loadouts ? { ...LOADOUTS, ...raw.loadouts } : LOADOUTS;

  const mod = {
    engine: raw.engine || "^1.0.0",
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle || "MOTHERSHIP · SCI-FI HORROR RPG",
    byline: raw.byline || "",
    blurb: raw.blurb || "",
    pitch: raw.pitch || [],
    contentWarning: raw.contentWarning || "",
    length: raw.length || "One shot",

    theme: { ...DEFAULT_THEME, ...(raw.theme || {}) },
    feedStyles: raw.feedStyles || {},

    items,
    loadouts,
    rooms,
    start: raw.start,
    npcs: raw.npcs || {},
    npcOrder: raw.npcOrder || Object.keys(raw.npcs || {}),
    threats: raw.threats || {},
    handouts: raw.handouts || {},       // tapes, notes, logs — anything with a body of text
    devices: raw.devices || {},         // terminals and consoles, keyed by id
    itemUse: raw.itemUse || {},         // itemId -> effects, overrides default item behaviour
    actions: raw.actions || [],         // actions offered in every room, subject to `when`
    tables: raw.tables || {},           // rollable tables the module can reference
    meters: raw.meters || {},           // extra Stress-like tracks (e.g. The Bends)
    tracks: raw.tracks || {},           // timed conditions (infection, radiation, air)
    clocks: raw.clocks || [],           // scheduled world events
    endings: raw.endings || {},
    intro: raw.intro || [],
    talkPrompts: raw.talkPrompts || [
      "What happened here?", "Has anything felt wrong lately?", "Who else is on board?",
    ],
    warden: raw.warden || null,         // { setting, voice, constraints, npcNote }
    hooks: raw.hooks || {},             // escape hatch: named JS functions
    debrief: raw.debrief || null,       // (world, pc, api) => array of lines
    xp: raw.xp || null,                 // (world, pc) => number
    map: raw.map || autoLayout(rooms),
    problems,
  };

  if (!mod.map.BW) { mod.map.BW = 104; mod.map.BH = 46; }
  if (!mod.map.width) { mod.map.width = 360; mod.map.height = 302; }
  return mod;
}

/** Convenience for the library screen: the bits needed before loading. */
export const moduleCard = (m) => ({
  id: m.id, title: m.title, subtitle: m.subtitle, blurb: m.blurb,
  byline: m.byline, length: m.length, accent: m.theme.accent,
  rooms: Object.keys(m.rooms).length, problems: m.problems,
});
