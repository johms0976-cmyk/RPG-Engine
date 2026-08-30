/* ============================================================
   PAPER MODE — the module, on paper, with the app switched off.

   The pitch on the front of this project is "no network, no API
   key, no tokens". The furthest honest end of that sentence is
   no computer, and until now the software did not go there. A
   table whose laptop died, a table in a room with no power, a
   Warden who simply prefers a folder — none of them could get
   anything out of this engine except by running `npm run
   dossier` in a terminal, which is the toolchain the last two
   releases were spent removing.

   So: the whole module, laid out to be printed, from a button.

   ------------------------------------------------------------
   THIS IS NOT THE DOSSIER

   `engine/dossier.js` is the Warden's LIVE view: what has fired,
   who has been told what, which endings are still open. It is
   about a session in progress and it is meaningless without a
   world.

   This is the module ITSELF — every room, every exit, every
   feature, the cast, the threats, the handouts and the endings —
   with no session in it at all. The two overlap on the cast and
   the endings, and this file calls `dossierFor` for those rather
   than growing a second copy that will drift.

   A world is accepted and is optional. Passing one marks what a
   session has already used, which is what makes this printable
   mid-campaign; passing none prints the module as written, which
   is what a Warden prepping on a train wants.

   ------------------------------------------------------------
   IT REPRODUCES. IT DOES NOT SUMMARISE.

   Every string in the output is one the module's author wrote,
   copied verbatim. Nothing here paraphrases a room, condenses a
   description or writes a bridging sentence, and the reason is
   the same one `misses.js` gives: the moment this file starts
   producing prose, the engine is writing the module's content.

   What it does add is MECHANICAL labelling — "gives: fuse",
   "SANITY save", "locked: bridge_open" — because that is the
   author's own declaration read back, not new writing. A Warden
   reference that omitted it would be a worse copy of the module
   rather than a useful one.
   ============================================================ */

import { dossierFor } from "./dossier.js";
import { GEAR } from "./gear.js";

/** Effects are a tree; this only ever reports its shape. Deliberately
    shallow — a Warden scanning a printed page wants "there is a Fear
    save here", not a rendering of the whole effect list, which they
    can read in the module file if they need it. */
function beats(effects, depth = 0) {
  const out = [];
  if (!effects || depth > 4) return out;
  for (const e of (Array.isArray(effects) ? effects : [effects])) {
    if (!e || typeof e !== "object") continue;
    if (e.save) out.push(`${String(e.save).toUpperCase()} save`);
    if (e.check) out.push(`${String(e.check).toUpperCase()} check`);
    if (e.stress) out.push(`${e.stress > 0 ? "+" : ""}${e.stress} Stress`);
    if (e.damage || e.dmg) out.push(`damage ${e.damage || e.dmg}`);
    if (e.fight) out.push(`fight: ${e.fight}`);
    if (e.moveTo) out.push(`→ ${e.moveTo}`);
    if (e.end) out.push(`ends: ${e.end}`);
    if (e.countdown && e.countdown.id) out.push(`starts ${e.countdown.id}`);
    if (typeof e.flag === "string") out.push(`sets ${e.flag}`);
    for (const k of ["then", "else", "onPass", "onFail", "onCritFail", "onCritHit", "effects"]) {
      if (e[k]) out.push(...beats(e[k], depth + 1));
    }
  }
  return [...new Set(out)];
}

/** One room, as a page. */
function roomPage(mod, w, id) {
  const r = mod.rooms[id] || {};
  const visited = !!(w && w.visited && w.visited[id]);
  const searched = (w && w.searched) || {};

  const exits = (r.exits || []).map((e) => {
    const to = String(e.to);
    const ending = to.startsWith("@");
    return {
      to,
      ending,
      /* The author's label if they wrote one, and the destination's
         own name if they did not. Never a sentence this file made up. */
      label: e.label || (ending
        ? ((mod.endings[to.slice(1)] || {}).title || to)
        : ((mod.rooms[to] || {}).name || to)),
      mins: e.mins || null,
      gate: e.gate ? {
        flag: e.gate.flag,
        open: !!(w && w.flags && w.flags[e.gate.flag]),
        roll: e.gate.roll
          ? `${String(e.gate.roll.stat || "intellect").toUpperCase()}${e.gate.roll.label ? ` · ${e.gate.roll.label}` : ""}`
          : null,
        routes: (e.gate.routes || []).map((rt) => rt.when || "").filter(Boolean),
      } : null,
    };
  });

  const features = Object.entries(r.features || {}).map(([key, f]) => ({
    key,
    name: f.name || key,
    text: f.d || f.text || "",
    gives: (f.gives || []).map((i) => (mod.items[i] && mod.items[i].n) || i),
    skills: f.skills || [],
    deep: !!f.deep,
    beats: beats(f.effects),
    /* `searched` is keyed room:feature — see useGame. Marked rather
       than hidden: a Warden printing mid-campaign wants to know what
       the table has already turned over, not to have it removed. */
    done: !!searched[`${id}:${key}`],
  }));

  return {
    id,
    name: r.name || id,
    n: r.n || null,
    tags: r.tags || [],
    look: r.look || "",
    start: mod.start === id,
    visited,
    exits,
    features,
    actions: (r.actions || []).map((a) => ({
      id: a.id || "",
      label: a.label || a.id || "",
      when: a.when || null,
      beats: beats(a.effects),
    })),
    onEnter: beats(r.onEnter),
    onFirstEnter: beats(r.onFirstEnter),
  };
}

/**
 * The whole module, ready to be laid out on paper.
 *
 * @param {object} mod  a defined module
 * @param {object} [w]  a live world, if there is one
 */
export function paperPack(mod, w = null) {
  const d = dossierFor(mod, w || {});

  return {
    card: {
      title: mod.title,
      subtitle: mod.subtitle || "",
      byline: mod.byline || "",
      blurb: mod.blurb || "",
      contentWarning: mod.contentWarning || "",
      length: mod.length || "",
      crewSize: mod.crewSize || { min: 1, max: 6, suggested: 4 },
      rooms: Object.keys(mod.rooms || {}).length,
      start: mod.start,
    },

    /* The author's own material about running it, straight from the
       dossier rather than re-read out of `mod.warden`. */
    running: {
      setting: d.setting,
      voice: d.voice,
      constraints: d.constraints,
      npcNote: d.npcNote,
      intro: (mod.intro || []).map((l) => (typeof l === "string" ? l : l.text)),
    },

    rooms: Object.keys(mod.rooms || {}).map((id) => roomPage(mod, w, id)),
    cast: d.cast,

    threats: Object.entries(mod.threats || {}).map(([id, t]) => ({
      id,
      name: t.name || id,
      combat: t.combat ?? null,
      speed: t.speed ?? null,
      maxHits: t.maxHits ?? null,
      unseen: !!t.unseen,
      note: t.note || "",
      attacks: (t.attacks || []).map((a) => ({
        name: a.name || "", dmg: a.dmg || "", text: a.text || "",
      })),
      counters: (t.counters || []).map((c) => c.label || c.id || ""),
    })),

    /* The module's OWN gear. `defineModule` merges the standard PSG
       kit into `items`, and reprinting eighty pieces of shared
       equipment in every module's pack is how a folder becomes too
       thick to carry. The standard kit is on the character sheet
       already; what a Warden needs on the module's pages is the
       four things this scenario invented. */
    items: Object.entries(mod.items || {})
      .filter(([id]) => !GEAR[id])
      .map(([id, i]) => ({ id, name: i.n || id, text: i.d || "", tag: i.tag || "" })),

    handouts: Object.entries(mod.handouts || {}).map(([id, h]) => ({
      id,
      label: h.label || id,
      text: h.text || "",
      beats: beats(h.effects),
      opened: !!(w && w.handouts && w.handouts[id]),
    })),

    tables: Object.entries(mod.tables || {}).map(([id, t]) => ({
      id,
      name: t.name || id,
      die: t.die || "",
      entries: (t.entries || []).map((e) => ({
        range: e.range || e.roll || "",
        text: e.text || e.t || "",
      })),
    })),

    endings: d.endings.map((e) => ({
      ...e,
      text: (mod.endings[e.id] || {}).text || "",
    })),

    /* Every flag the module can set, which on paper is the closest
       thing a Warden has to a state machine for the evening. */
    flags: d.secrets,
  };
}

/* ------------------------------------------------------------
   THE OTHER HALF OF PAPER: SOMEWHERE TO WRITE.

   A printed module without character sheets is half a kit. These
   are blank on purpose — a sheet with numbers already on it is a
   pregen, and a table who wanted pregens can print a finished
   crew from the app instead.
   ------------------------------------------------------------ */

/** A blank sheet, described as fields rather than drawn, so the
    screen owns the layout and this file owns what is on it. */
export function blankSheet({ stats, saves }) {
  return {
    stats: stats.map((k) => ({ key: k, label: k.toUpperCase() })),
    saves: saves.map((k) => ({ key: k, label: k.toUpperCase() })),
    rows: {
      identity: ["Name", "Pronouns", "Class", "Level", "Credits"],
      condition: ["Health", "Maximum Health", "Stress", "Minimum Stress", "Wounds"],
      kit: ["Armour", "Weapon", "Loadout", "Trinket", "Patch"],
    },
    /* Lines rather than boxes for the two things that are written in
       during play and rubbed out again. */
    lined: { skills: 8, gear: 12, notes: 10, conditions: 4 },
  };
}

/* ------------------------------------------------------------
   MARKDOWN, for the people who would rather have a file.

   `scripts/dossier.mjs` already writes a Warden reference from a
   terminal. This is the same idea from the browser and about the
   whole module rather than a live session — and it exists because
   "print" on a phone means "save as PDF" on some platforms and
   nothing at all on others, and a table should not lose the pack
   to a browser's print dialogue.
   ------------------------------------------------------------ */

const h = (n, text) => `${"#".repeat(n)} ${text}\n\n`;

export function paperMarkdown(pack) {
  const out = [];
  out.push(h(1, pack.card.title));
  if (pack.card.byline) out.push(`*${pack.card.byline}*\n\n`);
  if (pack.card.blurb) out.push(`${pack.card.blurb}\n\n`);
  if (pack.card.contentWarning) out.push(`> **Content warning.** ${pack.card.contentWarning}\n\n`);
  out.push(`${pack.card.rooms} locations · crew of ${pack.card.crewSize.min}–${pack.card.crewSize.max}`
    + ` · ${pack.card.length}\n\n`);

  if (pack.running.setting || pack.running.constraints.length) {
    out.push(h(2, "Running it"));
    if (pack.running.setting) out.push(`${pack.running.setting}\n\n`);
    if (pack.running.voice) out.push(`**Voice.** ${pack.running.voice}\n\n`);
    for (const c of pack.running.constraints) out.push(`- ${c}\n`);
    if (pack.running.constraints.length) out.push("\n");
  }

  out.push(h(2, "Rooms"));
  for (const r of pack.rooms) {
    out.push(h(3, `${r.n ? `${r.n}. ` : ""}${r.name}${r.start ? " — START" : ""}`));
    if (r.tags.length) out.push(`\`${r.tags.join(" ")}\`\n\n`);
    if (r.look) out.push(`${r.look}\n\n`);
    for (const e of r.exits) {
      const bits = [e.label, e.mins ? `${e.mins}m` : null,
        e.gate ? `locked: ${e.gate.flag}${e.gate.roll ? ` · ${e.gate.roll}` : ""}` : null];
      out.push(`- **→ ${e.to}** — ${bits.filter(Boolean).join(" · ")}\n`);
    }
    if (r.exits.length) out.push("\n");
    for (const f of r.features) {
      const tail = [f.gives.length ? `gives ${f.gives.join(", ")}` : null,
        f.beats.length ? f.beats.join(", ") : null].filter(Boolean).join(" · ");
      out.push(`- **${f.name}.** ${f.text}${tail ? ` *(${tail})*` : ""}\n`);
    }
    if (r.features.length) out.push("\n");
  }

  if (pack.cast.length) {
    out.push(h(2, "Cast"));
    for (const c of pack.cast) {
      out.push(h(3, `${c.name}${c.role ? ` — ${c.role}` : ""}`));
      if (c.brief) out.push(`${c.brief}\n\n`);
      for (const k of c.knows) out.push(`- ${k.text}\n`);
      out.push("\n");
    }
  }

  if (pack.threats.length) {
    out.push(h(2, "Threats"));
    for (const t of pack.threats) {
      out.push(`**${t.name}** — Combat ${t.combat ?? "—"} · Speed ${t.speed ?? "—"}`
        + ` · ${t.maxHits ?? "—"} hits\n\n`);
      for (const a of t.attacks) out.push(`- ${a.name} (${a.dmg}) — ${a.text}\n`);
      out.push("\n");
    }
  }

  if (pack.handouts.length) {
    out.push(h(2, "Handouts"));
    for (const ho of pack.handouts) out.push(`**${ho.label}**\n\n${ho.text}\n\n`);
  }

  if (pack.endings.length) {
    out.push(h(2, "Endings"));
    for (const e of pack.endings) out.push(`**${e.title}** (\`@${e.id}\`)\n\n${e.text}\n\n`);
  }

  if (pack.flags.length) {
    out.push(h(2, "Flags"));
    for (const f of pack.flags) out.push(`- \`${f.id}\`\n`);
  }

  return out.join("");
}

/** A filename a Warden will recognise in a downloads folder. */
export const paperFilename = (mod, ext = "md") =>
  `${String(mod.id || "module").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-pack.${ext}`;

export default paperPack;
