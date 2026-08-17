/* ============================================================
   THE CARTRIDGE SLOT
   defineModule() takes a module's raw data, checks it deeply,
   fills in defaults, and hands the engine something it can rely
   on. Anything wrong shows on the module's card in the library
   instead of blowing up mid-session.

   Validation now resolves EVERY cross-reference: hooks, tables,
   tracks, meters, handouts, item ids, room ids, threat ids,
   endings, and dice expressions. Unknown effect keys warn.
   ============================================================ */
import { GEAR, LOADOUTS } from "./gear.js";
import { EFFECT_KEYS } from "./effects.js";
import { isValidDice } from "./diceParser.js";
import { skillTier } from "./rules.js";

export const ENGINE_VERSION = "2.0.0";

const DEFAULT_THEME = {
  void: "#0A0A0B", void2: "#141416", bone: "#EDEAE3", bone2: "#D8D4C9",
  ink: "#111112", accent: "#F5C518", blood: "#7E1416", graphite: "#57534B",
  display: "'Oswald', 'Arial Narrow', 'Helvetica Neue Condensed', Impact, sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  // Art-direction skin: "print" | "crt" | "thermal". See ui/art.css.
  treatment: "print",
};

function autoLayout(rooms) {
  const ids = Object.keys(rooms).filter((id) => rooms[id].onMap !== false);
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(ids.length))));
  const BW = 104, BH = 46, GX = 120, GY = 62;
  const pos = {};
  ids.forEach((id, i) => { pos[id] = [8 + (i % cols) * GX, 14 + Math.floor(i / cols) * GY]; });
  return { pos, links: [], BW, BH, width: 8 + cols * GX, height: 30 + Math.ceil(ids.length / cols) * GY };
}

/* ---------------- deep validation ---------------- */

function walkEffects(effects, visit, path = "") {
  if (!effects) return;
  const list = Array.isArray(effects) ? effects : [effects];
  list.forEach((e, i) => {
    if (!e || typeof e === "string" || typeof e === "function") return;
    visit(e, `${path}[${i}]`);
    for (const k of ["then", "else", "onPass", "onFail", "onCritFail", "onCritHit", "effects"]) {
      if (e[k]) walkEffects(e[k], visit, `${path}[${i}].${k}`);
    }
    if (e.pick) e.pick.forEach(([, sub], j) => walkEffects(sub, visit, `${path}[${i}].pick[${j}]`));
    if (e.countdown && e.countdown.onZero) walkEffects(e.countdown.onZero, visit, `${path}[${i}].countdown`);
  });
}

/** Collect every effects array anywhere in a module, with a label. */
function allEffectSites(raw) {
  const sites = [];
  const push = (label, eff) => eff && sites.push([label, eff]);

  Object.entries(raw.rooms || {}).forEach(([id, r]) => {
    push(`room ${id}.onEnter`, r.onEnter);
    push(`room ${id}.onFirstEnter`, r.onFirstEnter);
    (r.exits || []).forEach((e, i) => {
      push(`room ${id}.exits[${i}]`, e.effects);
      (e.gate && e.gate.routes || []).forEach((rt, j) => push(`room ${id}.exits[${i}].gate.routes[${j}]`, rt.effects));
    });
    Object.entries(r.features || {}).forEach(([k, f]) => push(`room ${id}.features.${k}`, f.effects));
    (r.actions || []).forEach((a, i) => push(`room ${id}.actions[${i}]`, a.effects));
  });
  (raw.actions || []).forEach((a, i) => push(`actions[${i}]`, a.effects));
  Object.entries(raw.threats || {}).forEach(([id, t]) => {
    push(`threat ${id}.onFirstContact`, t.onFirstContact);
    push(`threat ${id}.onHit`, t.onHit);
    push(`threat ${id}.onSlain`, t.onSlain);
    (t.counters || []).forEach((c, i) => {
      push(`threat ${id}.counters[${i}].effects`, c.effects);
      push(`threat ${id}.counters[${i}].onHold`, c.onHold);
      push(`threat ${id}.counters[${i}].onBreak`, c.onBreak);
    });
  });
  Object.entries(raw.devices || {}).forEach(([id, dv]) =>
    (dv.actions || []).forEach((a, i) => push(`device ${id}.actions[${i}]`, a.effects)));
  Object.entries(raw.itemUse || {}).forEach(([id, eff]) => push(`itemUse.${id}`, eff));
  Object.entries(raw.tables || {}).forEach(([id, t]) =>
    (t.entries || []).forEach((e, i) => push(`table ${id}.entries[${i}]`, e.effects)));
  Object.entries(raw.tracks || {}).forEach(([id, tr]) =>
    (tr.stages || []).forEach((s, i) => {
      push(`track ${id}.stages[${i}]`, s.effects);
      if (s.repeat) push(`track ${id}.stages[${i}].repeat`, s.repeat.effects);
    }));
  (raw.clocks || []).forEach((c, i) => push(`clocks[${i}]`, c.effects));
  Object.entries(raw.handouts || {}).forEach(([id, h]) => push(`handout ${id}`, h.effects));
  push("intro", null);
  return sites;
}

function validate(raw, items) {
  const problems = [], warnings = [];
  const need = (k) => { if (!raw[k]) problems.push(`module is missing "${k}"`); };
  ["id", "title", "rooms", "start"].forEach(need);

  const rooms = raw.rooms || {};
  const endings = raw.endings || {};
  const npcs = raw.npcs || {};
  const threats = raw.threats || {};
  const tables = raw.tables || {};
  const tracks = raw.tracks || {};
  const meters = raw.meters || {};
  const handouts = raw.handouts || {};
  const hooks = raw.hooks || {};
  const devices = raw.devices || {};

  if (!rooms[raw.start]) problems.push(`start room "${raw.start}" is not in rooms`);

  const roomId = (id) => rooms[id] !== undefined;
  const endingId = (id) => endings[String(id).replace(/^@/, "")] !== undefined;

  /* rooms and exits */
  Object.entries(rooms).forEach(([id, r]) => {
    if (!r.name) problems.push(`room "${id}" has no name`);
    if (!r.look) warnings.push(`room "${id}" has no look text`);
    (r.exits || []).forEach((e, i) => {
      const to = String(e.to);
      if (to.startsWith("@")) {
        if (!endingId(to)) problems.push(`room "${id}" exit ${i} goes to unknown ending "${to}"`);
      } else if (!roomId(to)) {
        problems.push(`room "${id}" exit ${i} goes to unknown room "${to}"`);
      }
      if (e.mins != null && !Number.isFinite(e.mins)) problems.push(`room "${id}" exit ${i} has a non-numeric mins`);
    });
    Object.entries(r.features || {}).forEach(([k, f]) => {
      if (!f.name) problems.push(`room "${id}" feature "${k}" has no name`);
      (f.gives || []).forEach((it) => {
        if (!items[it]) problems.push(`room "${id}" feature "${k}" gives unknown item "${it}"`);
      });
      (f.skills || []).forEach((s) => {
        if (!skillTier(s)) warnings.push(`room "${id}" feature "${k}" names unknown skill "${s}"`);
      });
    });
  });

  /* npcs */
  Object.entries(npcs).forEach(([id, n]) => {
    if (!n.name) problems.push(`npc "${id}" has no name`);
    if (n.start && !roomId(n.start)) problems.push(`npc "${id}" starts in unknown room "${n.start}"`);
  });
  (raw.npcOrder || []).forEach((id) => {
    if (!npcs[id]) problems.push(`npcOrder names unknown npc "${id}"`);
  });

  /* threats */
  Object.entries(threats).forEach(([id, t]) => {
    if (t.start && !roomId(t.start)) problems.push(`threat "${id}" starts in unknown room "${t.start}"`);
    (t.attacks || []).forEach((a, i) => {
      if (a.dmg && !isValidDice(a.dmg)) problems.push(`threat "${id}" attack ${i} has a bad damage expression "${a.dmg}"`);
      if (a.crit && a.crit.dmg && !isValidDice(a.crit.dmg)) problems.push(`threat "${id}" attack ${i} crit damage is malformed`);
    });
    if (t.combat == null) warnings.push(`threat "${id}" has no combat value, defaulting to 40`);
  });

  /* items referenced by loadouts */
  Object.entries(raw.loadouts || {}).forEach(([id, l]) =>
    (l.items || []).forEach((it) => {
      if (!items[it]) problems.push(`loadout "${id}" contains unknown item "${it}"`);
    }));

  /* item internal consistency */
  Object.entries(raw.items || {}).forEach(([id, it]) => {
    if (it.dmg && !isValidDice(it.dmg)) problems.push(`item "${id}" has a bad damage expression "${it.dmg}"`);
    if (it.heal && it.heal !== true && !isValidDice(it.heal)) problems.push(`item "${id}" has a bad heal expression`);
    if (it.handout && !handouts[it.handout]) problems.push(`item "${id}" points at unknown handout "${it.handout}"`);
  });

  /* tables */
  Object.entries(tables).forEach(([id, t]) => {
    if (t.die && !isValidDice(t.die)) problems.push(`table "${id}" has a bad die "${t.die}"`);
    if (!t.entries || !t.entries.length) problems.push(`table "${id}" has no entries`);
  });

  /* tracks */
  Object.entries(tracks).forEach(([id, tr]) => {
    (tr.stages || []).forEach((s, i) => {
      if (s.after != null && !isValidDice(s.after)) problems.push(`track "${id}" stage ${i} has a bad "after"`);
      if (s.repeat && !isValidDice(s.repeat.every)) problems.push(`track "${id}" stage ${i} has a bad repeat interval`);
    });
  });

  /* clocks */
  (raw.clocks || []).forEach((c, i) => {
    if (!c.id) problems.push(`clocks[${i}] has no id`);
    if (c.every != null && !isValidDice(c.every)) problems.push(`clocks[${i}] has a bad "every"`);
    if (c.start != null && !isValidDice(c.start)) problems.push(`clocks[${i}] has a bad "start"`);
  });

  /* devices */
  Object.entries(devices).forEach(([id, dv]) => {
    if (!dv.actions || !dv.actions.length) warnings.push(`device "${id}" has no actions`);
    (dv.actions || []).forEach((a, i) => {
      if (!a.id) problems.push(`device "${id}" action ${i} has no id`);
    });
  });

  /* every effect, everywhere */
  for (const [label, eff] of allEffectSites(raw)) {
    walkEffects(eff, (e, path) => {
      const where = `${label}${path}`;
      for (const k of Object.keys(e)) {
        if (!EFFECT_KEYS.has(k)) warnings.push(`${where}: unknown effect key "${k}"`);
      }
      if (e.run && typeof hooks[e.run] !== "function") problems.push(`${where}: run "${e.run}" has no matching hook`);
      if (e.table && !tables[e.table]) problems.push(`${where}: table "${e.table}" does not exist`);
      if (e.track && !tracks[e.track]) problems.push(`${where}: track "${e.track}" does not exist`);
      if (e.meter) Object.keys(e.meter).forEach((m) => {
        if (!meters[m]) problems.push(`${where}: meter "${m}" does not exist`);
      });
      if (e.moveTo && !roomId(e.moveTo)) problems.push(`${where}: moveTo unknown room "${e.moveTo}"`);
      if (e.end && !endings[e.end]) problems.push(`${where}: end "${e.end}" is not a declared ending`);
      if (e.give) e.give.forEach((it) => { if (!items[it]) problems.push(`${where}: gives unknown item "${it}"`); });
      if (e.take) e.take.forEach((it) => { if (!items[it]) warnings.push(`${where}: takes unknown item "${it}"`); });
      if (e.fight) {
        const fid = typeof e.fight === "string" ? e.fight : e.fight.id;
        if (!threats[fid]) problems.push(`${where}: fight names unknown threat "${fid}"`);
      }
      if (e.threat && !threats[e.threat.id]) problems.push(`${where}: threat "${e.threat.id}" does not exist`);
      if (e.threat && e.threat.loc && !roomId(e.threat.loc)) problems.push(`${where}: threat moved to unknown room "${e.threat.loc}"`);
      for (const k of ["time", "damage", "heal", "stress", "xp"]) {
        if (e[k] != null && !isValidDice(e[k])) problems.push(`${where}: "${k}" is not a valid dice expression`);
      }
      if (e.save && !["sanity", "fear", "body", "armor"].includes(String(e.save).toLowerCase()))
        problems.push(`${where}: "${e.save}" is not a Save`);
      if (e.test && !["strength", "speed", "intellect", "combat"].includes(String(e.test).toLowerCase()))
        problems.push(`${where}: "${e.test}" is not a Stat`);
      if (e.skill) (Array.isArray(e.skill) ? e.skill : [e.skill]).forEach((s) => {
        if (!skillTier(s)) warnings.push(`${where}: unknown skill "${s}"`);
      });
    });
  }

  /* endings must exist at all */
  if (!Object.keys(endings).length) warnings.push("module declares no endings");

  return { problems, warnings };
}

/* ---------------- the entry point ---------------- */

export function defineModule(raw) {
  const items = { ...GEAR, ...(raw.items || {}) };
  const loadouts = raw.loadouts ? { ...LOADOUTS, ...raw.loadouts } : LOADOUTS;
  const { problems, warnings } = validate(raw, items);

  const mod = {
    engine: raw.engine || "^2.0.0",
    id: raw.id,
    title: raw.title,
    subtitle: raw.subtitle || "MOTHERSHIP · SCI-FI HORROR RPG",
    byline: raw.byline || "",
    blurb: raw.blurb || "",
    pitch: raw.pitch || [],
    contentWarning: raw.contentWarning || "",
    length: raw.length || "One shot",
    crewSize: raw.crewSize || { min: 1, max: 4, suggested: 3 },

    theme: { ...DEFAULT_THEME, ...(raw.theme || {}) },
    feedStyles: raw.feedStyles || {},

    items, loadouts,
    rooms: raw.rooms || {},
    start: raw.start,
    npcs: raw.npcs || {},
    npcOrder: raw.npcOrder || Object.keys(raw.npcs || {}),
    threats: raw.threats || {},
    handouts: raw.handouts || {},
    devices: raw.devices || {},
    itemUse: raw.itemUse || {},
    actions: raw.actions || [],
    tables: raw.tables || {},
    meters: raw.meters || {},
    tracks: raw.tracks || {},
    clocks: raw.clocks || [],
    endings: raw.endings || {},
    intro: raw.intro || [],
    flavour: raw.flavour || {},
    wardenTables: raw.wardenTables || {},
    talkPrompts: raw.talkPrompts || [
      "What happened here?", "Has anything felt wrong lately?", "Who else is on board?",
    ],
    restSpots: raw.restSpots || [],
    shops: raw.shops || {},
    hooks: raw.hooks || {},
    debrief: raw.debrief || null,
    xp: raw.xp || null,
    // A module may declare the ship the crew arrived on. The engine
    // installs it into the headless core at the start of a session.
    ship: raw.ship || null,
    map: raw.map || autoLayout(raw.rooms || {}),
    problems, warnings,
  };

  if (!mod.map.BW) { mod.map.BW = 104; mod.map.BH = 46; }
  if (!mod.map.width) { mod.map.width = 360; mod.map.height = 302; }
  return mod;
}

export const moduleCard = (m) => ({
  id: m.id, title: m.title, subtitle: m.subtitle, blurb: m.blurb,
  byline: m.byline, length: m.length, accent: m.theme.accent,
  rooms: Object.keys(m.rooms).length,
  problems: m.problems, warnings: m.warnings,
  contentWarning: m.contentWarning, crewSize: m.crewSize,
});
