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
/* THE FLOOR UNDER THE EMPTY CHAIR. A module with no `director`
   block loses five of the ladder's thirteen rungs, silently. See
   ./autoDirector.js for what can honestly be derived and why it is
   so little. */
import { autoDirector, directorGaps } from "./autoDirector.js";

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
    if (t.grapple && t.grapple.dmg && !isValidDice(t.grapple.dmg))
      problems.push(`threat "${id}" grapple damage is malformed`);
    if (t.retreatTo && !roomId(t.retreatTo)) problems.push(`threat "${id}" retreats to unknown room "${t.retreatTo}"`);
    (t.counters || []).forEach((c, i) => {
      if (!c.id) problems.push(`threat "${id}" counter ${i} has no id`);
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
      /* `[].concat` rather than `.forEach` DIRECTLY ON THE VALUE.
         An author who writes `give: "torch"` instead of
         `give: ["torch"]` used to crash this function — and this
         function is called from `defineModule`, at import time, so
         a single-character mistake in one module took the entire
         application down with a TypeError from inside the
         validator. The validator is the thing that is supposed to
         turn a bad module into a readable complaint; it must not
         be the thing that cannot survive one. */
      for (const it of [].concat(e.give || [])) {
        if (!items[it]) problems.push(`${where}: gives unknown item "${it}"`);
      }
      for (const it of [].concat(e.take || [])) {
        if (!items[it]) warnings.push(`${where}: takes unknown item "${it}"`);
      }
      if (e.fight) {
        const fid = typeof e.fight === "string" ? e.fight : e.fight.id;
        if (!threats[fid]) problems.push(`${where}: fight names unknown threat "${fid}"`);
      }
      if (e.threat && !threats[e.threat.id]) problems.push(`${where}: threat "${e.threat.id}" does not exist`);
      if (e.npc && !npcs[e.npc.id]) problems.push(`${where}: npc "${e.npc.id}" does not exist`);
      if (e.npc && e.npc.loc && !roomId(e.npc.loc)) problems.push(`${where}: npc moved to unknown room "${e.npc.loc}"`);
      if (e.npcSay && !npcs[e.npcSay.id]) problems.push(`${where}: npcSay names unknown npc "${e.npcSay.id}"`);
      if (e.vanish && e.vanish.id && !npcs[e.vanish.id]) problems.push(`${where}: vanish names unknown npc "${e.vanish.id}"`);
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

  /* ---- the director block ------------------------------------

     Checked here rather than trusted, because every mistake in it
     fails the same silent way: a malformed entry is simply never
     due, and the empty chair goes quiet in a manner indistinguishable
     from a module that is going well. */
  const d = raw.director;
  if (d) {
    if (typeof d !== "object") problems.push(`"director" must be an object`);
    else {
      /* C.1 — a phrase set and a Move the author wrote. Validated
         as strictly as escalate is, and for the same reason: a
         listener that can never fire is a silent bug in a file
         nobody re-reads. */
      (d.listeners || []).forEach((e, i) => {
        if (!e || typeof e !== "object") { problems.push(`director.listeners[${i}] is not an object`); return; }
        if (!Array.isArray(e.phrases) || !e.phrases.length) {
          problems.push(`director.listeners[${i}] has no "phrases", so it can never fire`);
        } else if (e.phrases.some((p) => typeof p !== "string" || !p.trim())) {
          problems.push(`director.listeners[${i}] has a "phrases" entry that is not a non-empty string`);
        }
        /* The line in the rung's own comment, enforced. A listener
           with neither is a keyword that triggers nothing, which is
           the shape a keyword-to-generated-sentence path would take
           if anyone ever tried to build one here. */
        if (!e.effects && !e.label) {
          problems.push(`director.listeners[${i}] declares neither "effects" nor "label", so it has nothing to say`);
        }
      });

      (d.escalate || []).forEach((e, i) => {
        if (!e || typeof e !== "object") { problems.push(`director.escalate[${i}] is not an object`); return; }
        if (e.atClock == null && e.when == null) {
          /* A beat with no trigger is never due. Firing it
             immediately would hide the mistake, so `rungScripted`
             skips it — which means the ladder silently stalls at
             that stage forever. Worth a problem, not a warning. */
          problems.push(`director.escalate[${i}] declares neither "atClock" nor "when", so it can never be due`);
        }
        if (e.atClock != null && !Number.isFinite(e.atClock)) {
          problems.push(`director.escalate[${i}] has a non-numeric "atClock"`);
        }
      });
      (d.rolls || []).forEach((r, i) => {
        if (!r || !r.id) { problems.push(`director.rolls[${i}] has no id`); return; }
        /* `safeMove` drops a called roll with no reason, so an entry
           without one is not a roll — it is a rung that quietly
           never fires. */
        if (!String(r.reason || "").trim()) {
          problems.push(`director.rolls[${i}] ("${r.id}") has no "reason" — safeMove will refuse it every time`);
        }
      });
      (d.endings || []).forEach((e, i) => {
        if (!e || !e.id) { problems.push(`director.endings[${i}] has no id`); return; }
        if (!endings[e.id]) problems.push(`director.endings[${i}] names unknown ending "${e.id}"`);
        if (!e.when) problems.push(`director.endings[${i}] ("${e.id}") has no "when", so it can never be reached`);
      });
      (d.attacks || []).forEach((a, i) => {
        if (!a || !a.threatId) { problems.push(`director.attacks[${i}] has no threatId`); return; }
        if (!(raw.threats || {})[a.threatId]) {
          problems.push(`director.attacks[${i}] names unknown threat "${a.threatId}"`);
        }
        if (!a.when) problems.push(`director.attacks[${i}] has no "when", so it can never be due`);
      });
      if (d.pressure && !((raw.hooks || {})[d.pressure])) {
        problems.push(`director.pressure names hook "${d.pressure}", which the module does not declare`);
      }
    }
  }

  /* And what is missing. These are the reason the empty chair is
     quiet on a module that is otherwise complete, and they are
     invisible from inside a session — so they are said here, once,
     where an author is already reading. */
  for (const g of directorGaps(raw, autoDirector(raw))) warnings.push(g);

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
    /* SIX, NOT FOUR. A module that declares nothing used to cap the
       table at four, and `Lobby` then told players five and six that
       the table was full — for a module whose author had expressed
       no opinion at all. An engine whose stated configuration is
       four to six friends should not turn two of them away on a
       default nobody chose. An author who genuinely wants four says
       so, and is obeyed. */
    crewSize: raw.crewSize || { min: 1, max: 6, suggested: 4 },

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
    /* Effects run once, the moment a session begins — after the
       intro lines, before the first room description. A module that
       wants a clock running from minute zero has had nowhere to say
       so: `clocks` fire on a schedule and `countdown` is an effect
       with no starting gun. This is the starting gun. */
    onStart: raw.onStart || [],
    flavour: raw.flavour || {},
    wardenTables: raw.wardenTables || {},
    talkPrompts: raw.talkPrompts || [
      "What happened here?", "Has anything felt wrong lately?", "Who else is on board?",
    ],
    restSpots: raw.restSpots || [],
    shops: raw.shops || {},
    hooks: raw.hooks || {},
    // The Warden's own material: setting brief, constraints, and the
    // long-form background a table will ask about. Previously dropped.
    warden: raw.warden || null,
    lore: raw.lore || null,
    tutorial: raw.tutorial || null,
    debrief: raw.debrief || null,
    xp: raw.xp || null,
    // A module may declare the ship the crew arrived on. The engine
    // installs it into the headless core at the start of a session.
    ship: raw.ship || null,
    map: raw.map || autoLayout(raw.rooms || {}),
    /* ============================================================
       THE BLOCK THAT NEVER ARRIVED.

       `director` was not on this list. It was authored in
       `src/modules/ypsilon14/director.js`, imported by that
       module's `index.js`, and then dropped on the floor here —
       `defineModule` builds an explicit object rather than
       spreading `raw`, and nobody added the key.

       So `mod.director` was `undefined` for every module in the
       repository, and the five rungs that open with
       `if (!d) return null` — escalate, aftermath, ending,
       callRoll, pressure — had never fired at a table in their
       lives. Everything 2.7.0 shipped for the empty chair was
       unreachable. It went unnoticed because `tests/director2.js`
       builds its module objects inline and therefore always had
       one.

       That is the whole class of bug this engine keeps producing:
       a thing that is missing rather than wrong, failing as
       silence, in the one mode where silence is a legitimate
       output.

       `|| autoDirector(raw)` is the floor described in
       ./autoDirector.js — thin, derived only from what the author
       already declared, and never composed. */
    director: raw.director || autoDirector(raw),
    /* WHERE THE NEXT PERSON COMES FROM.

       Optional, and absent unless an author wrote it. A player whose
       character has died can build a new one from their own phone
       (see ui/DeathTakeover.jsx); `arrival` is the sentence shown to
       them while they do, and it is a fact about the fiction — which
       makes it the module's to state and not the engine's to invent.

       A module with nothing to say here gets a plain button, and the
       table explains the new arrival themselves, which is what tables
       have always done. */
    replacement: raw.replacement || null,
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
