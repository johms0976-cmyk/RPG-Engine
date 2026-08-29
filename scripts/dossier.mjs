/* ============================================================
   THE DOSSIER GENERATOR

   `docs/YPSILON14_WARDEN_DOSSIER.md` is the single most useful
   document in this repository for the person who has to actually
   run a session, and there is one of them for four modules. The
   README links to `docs/ANOTHERBUGHUNT_WARDEN_DOSSIER.md`, which
   does not exist — the prep material for a 48-room module with
   17 survivors, 9 threats and three parallel director ladders,
   promised and absent.

   ------------------------------------------------------------
   WHAT THIS GENERATES AND WHAT IT REFUSES TO

   A dossier has two halves and only one of them is derivable.

   THE EDITORIAL HALF is what makes Ypsilon's dossier good: "the
   job is six pallets at twenty minutes each — this is the
   module's central squeeze and you should never resolve it for
   them." "Mike wrote SILENCE. The creature writes nothing. Never
   let it become a character." That is a person who has run the
   module telling you how to run it, and no amount of walking the
   data structure produces it. Attempting it would be the exact
   thing INV-1 forbids: composing sentences nobody wrote.

   THE REFERENCE HALF is every fact a Warden looks up mid-session
   with a player waiting — which room connects to which, what the
   gate on that door actually takes, what the creature's stats
   are, when the next clock fires, what this NPC is allowed to
   know. All of that is in the module already, and a Warden
   currently gets it by reading `index.js`.

   This generates the second half only, and says so at the top of
   every file it writes. A generated reference and a hand-written
   dossier are complements, not competitors: the reference stops
   rotting the moment the module changes, and the editorial half
   is worth writing precisely because it cannot be derived.

   ------------------------------------------------------------
   WHY IT IS A SCRIPT AND NOT A SCREEN

   A Warden preps on a train. The output is a file they can read
   on a phone, print, or paste into whatever they already keep
   notes in — and it works with no server, no build and no app,
   which is the same bargain the rest of the project makes.

   Run:  npm run dossier            all modules
         npm run dossier ypsilon14  one
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import MODULES from "../src/modules/index.js";
import { coverage } from "../src/engine/coverage.js";
import { mergeListeners } from "../src/engine/listenerPack.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, "..", "docs");

const esc = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
const trunc = (s, n) => (esc(s).length > n ? `${esc(s).slice(0, n - 1)}…` : esc(s));

/* Minutes as a Warden reads a clock, because "at 380 minutes" is
   not a thing anybody says out loud at a table. */
const hhmm = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60);
  return h ? `${h}h${String(m % 60).padStart(2, "0")}` : `${m}m`;
};

function header(mod) {
  const out = [];
  out.push(`# ${mod.title.toUpperCase()} — WARDEN'S REFERENCE`);
  out.push("");
  out.push("> **Generated from the module. Do not edit by hand — run `npm run dossier`.**");
  out.push(">");
  out.push("> This is the *reference* half of a dossier: the things you look up mid-session");
  out.push("> with a player waiting. It is deliberately not the editorial half — what the");
  out.push("> module is about, where the squeeze is, what to never let happen — because that");
  out.push("> is written by somebody who has run it and cannot be derived from data.");
  if (mod.subtitle) out.push(`\n*${esc(mod.subtitle)}*`);
  if (mod.byline) out.push(`\n${esc(mod.byline)}`);
  if (mod.blurb) out.push(`\n${esc(mod.blurb)}`);
  if (mod.contentWarning) {
    out.push(`\n**Before you start.** ${esc(mod.contentWarning)}`);
  }
  return out.join("\n");
}

function atAGlance(mod) {
  const c = coverage(mod);
  const rows = [
    ["Rooms", c.rooms],
    ["Threats", c.threats],
    ["NPCs", c.npcs],
    ["Endings", c.endings],
    ["Starts in", mod.rooms[mod.start] ? mod.rooms[mod.start].name : mod.start],
    ["Length", mod.length || "—"],
  ];
  return [
    "\n## At a glance\n",
    "| | |",
    "|---|---|",
    ...rows.map(([k, v]) => `| **${k}** | ${esc(v)} |`),
  ].join("\n");
}

/* THE CLOCK. The single most-asked question a Warden has
   mid-session is "what happens next and when", and the answer is
   scattered across `clocks`, `countdowns` inside effects, and
   track stages. Collected here in time order. */
function theClock(mod) {
  const out = ["\n## The clock\n"];
  const rows = [];

  for (const c of mod.clocks || []) {
    rows.push([
      c.start != null ? hhmm(c.start) : "—",
      c.id || "—",
      c.every ? `then every ${esc(c.every)}` : "once",
      c.when ? `if \`${esc(c.when)}\`` : "",
    ]);
  }
  for (const [id, t] of Object.entries(mod.tracks || {})) {
    for (const [i, st] of (t.stages || []).entries()) {
      rows.push([
        st.after != null ? `+${esc(st.after)}` : "—",
        `${id} stage ${i + 1}`,
        t.condition ? esc(t.condition) : "track",
        st.repeat ? `then every ${esc(st.repeat.every)}` : "",
      ]);
    }
  }

  if (!rows.length) {
    out.push("_No scheduled beats. This module's pressure comes from play, not the clock._");
    return out.join("\n");
  }
  out.push("| When | What | | |", "|---|---|---|---|");
  for (const r of rows) out.push(`| ${r.map(esc).join(" | ")} |`);
  out.push("\n_Times are fiction minutes from session start. `onTick` accumulates, so a");
  out.push("pacing skip still fires every beat it passes through._");
  return out.join("\n");
}

/* THE MAP, as a table rather than a picture. Every exit, what it
   costs in minutes, and — the part a Warden actually needs — what
   each gate takes, because "the door is locked, now what" is the
   question that stops a session dead. */
function theMap(mod) {
  const out = ["\n## Rooms and exits\n"];
  out.push("| Room | Leads to | Mins | Locked behind |");
  out.push("|---|---|---|---|");
  for (const [id, r] of Object.entries(mod.rooms || {})) {
    const exits = r.exits || [];
    if (!exits.length) {
      out.push(`| **${esc(r.name || id)}** \`${id}\` | _no exits_ | | |`);
      continue;
    }
    for (const [i, e] of exits.entries()) {
      const to = String(e.to || "");
      const dest = to.startsWith("@")
        ? `**ENDING: ${to.slice(1)}**`
        : (mod.rooms[to] ? `${esc(mod.rooms[to].name)} \`${to}\`` : `\`${to}\``);
      const gate = [];
      if (e.needs) gate.push(`needs \`${esc(e.needs)}\``);
      if (e.hidden) gate.push(`hidden until \`${esc(e.hidden)}\``);
      if (e.gate) {
        for (const rt of e.gate.routes || []) gate.push(`route: \`${esc(rt.when)}\``);
        if (e.gate.roll) {
          gate.push(
            `roll ${esc(e.gate.roll.stat)}${e.gate.roll.skills ? ` (${e.gate.roll.skills.join("/")})` : ""}`,
          );
        }
      }
      out.push(
        `| ${i === 0 ? `**${esc(r.name || id)}** \`${id}\`` : ""} | ${dest} | ${e.mins ?? ""} | ${gate.join("; ") || ""} |`,
      );
    }
  }
  return out.join("\n");
}

/* THE THINGS. Stats a Warden reads out of a book mid-combat,
   plus the two fields that matter more than the stats: what it
   wants, and what makes it stop. */
function theThreats(mod) {
  const ts = Object.entries(mod.threats || {});
  if (!ts.length) return "\n## Threats\n\n_None._";
  const out = ["\n## Threats\n"];
  for (const [id, t] of ts) {
    out.push(`### ${esc(t.name || id)} \`${id}\`\n`);
    const bits = [
      ["Combat", t.combat], ["Speed", t.speed], ["Instinct", t.instinct],
      ["Hits", t.maxHits], ["Max damage", t.maxDmg], ["Starts", t.start],
      ["Tactics", t.tactics || "weakest"],
      ["Morale", t.morale != null ? t.morale : "—"],
    ].filter(([, v]) => v != null && v !== "");
    out.push(`| ${bits.map(([k]) => k).join(" | ")} |`);
    out.push(`|${bits.map(() => "---").join("|")}|`);
    out.push(`| ${bits.map(([, v]) => esc(v)).join(" | ")} |`);
    out.push("");
    if (t.unseen) {
      out.push(`**Unseen.** Defends with Advantage unless somebody carries \`${esc(t.seenWith || "?")}\`.`);
    }
    if (t.breaksOff) out.push("**Breaks off** the moment it takes a hit.");
    if (t.hearsNoise) out.push(`**Hears noise.** Draw chance ${t.noiseDraw ?? "—"}.`);
    for (const a of t.attacks || []) {
      out.push(`- **${esc(a.name)}** ${esc(a.dmg)}${a.crit ? ` · crit ${esc(a.crit.dmg)}` : ""}`);
    }
    /* THE WAYS OUT. A counter is the module telling you what the
       clever answer is, and it is the thing a Warden most needs to
       recognise the moment a player gropes toward it. */
    if ((t.counters || []).length) {
      out.push("\n**Ways out other than shooting it:**");
      for (const c of t.counters) {
        out.push(`- ${esc(c.label)} — needs \`${esc(c.when)}\`${c.endsCombat ? " · ends combat" : ""}`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

/* THE PEOPLE. `knows` is not a hint — it is the complete set of
   sentences this person can ever say (INV-6). So the useful thing
   to print is all of them, which is also the fastest way for a
   Warden to notice somebody has three. */
function thePeople(mod) {
  const ns = Object.entries(mod.npcs || {});
  if (!ns.length) return "\n## People\n\n_None._";
  const out = ["\n## People\n", "_`knows` is everything they can say. Selection is allowed; invention is not._\n"];
  for (const [id, n] of ns) {
    const flags = [
      n.silent ? "silent" : null,
      n.gone ? "starts absent" : null,
      n.vanishable === false ? "cannot vanish" : null,
    ].filter(Boolean);
    out.push(`### ${esc(n.name || id)}${n.role ? ` — ${esc(n.role)}` : ""} \`${id}\``);
    out.push(
      `*${esc(n.start || "nowhere")}*${flags.length ? ` · ${flags.join(", ")}` : ""}` +
      ` · **${(n.knows || []).length} line${(n.knows || []).length === 1 ? "" : "s"}**`,
    );
    if (n.brief) out.push(`\n${esc(n.brief)}`);
    if (n.note) out.push(`\n> ${esc(n.note)}`);
    for (const k of n.knows || []) out.push(`- ${trunc(k, 240)}`);
    out.push("");
  }
  return out.join("\n");
}

function theEndings(mod) {
  const es = Object.entries(mod.endings || {});
  if (!es.length) return "";
  const out = ["\n## How it can end\n", "| | Good | |", "|---|---|---|"];
  for (const [id, e] of es) {
    out.push(`| **${esc(e.title || id)}** \`${id}\` | ${e.good ? "yes" : "no"} | ${trunc(e.text, 180)} |`);
  }
  return out.join("\n");
}

/* WHAT THE EMPTY CHAIR WILL SAY IF NOBODY IS RUNNING IT. A Warden
   reading this wants to know what the software will do on its own
   — and a wardenless table's organiser wants to know what it
   won't. */
function theListeners(mod) {
  const own = ((mod.director && mod.director.listeners) || []).filter(Boolean);
  const all = mergeListeners(mod.director);
  const out = ["\n## What the table can say and be heard\n"];
  out.push(
    `${own.length} written for this module, ${all.length - own.length} from the common pack.\n`,
  );
  if (own.length) {
    out.push("**This module's own:**\n");
    for (const l of own) out.push(`- \`${esc(l.id)}\` — ${(l.phrases || []).map((p) => `"${esc(p)}"`).join(", ")}`);
  }
  out.push(
    "\n_Anything else falls through to the oracle, which answers yes/no and does not",
    "update the fiction. With nobody behind the screen, that is what **Make it true**",
    "is for — see `engine/tableRuling.js`._",
  );
  return out.join("\n");
}

function theGaps(mod) {
  const notes = mod.coverage || [];
  if (!notes.length) return "";
  return ["\n## Coverage notes\n", "_Not errors. A count of what is and is not there._\n",
    ...notes.map((n) => `- ${n}`)].join("\n");
}

export function dossier(mod) {
  return [
    header(mod),
    atAGlance(mod),
    theClock(mod),
    theMap(mod),
    theThreats(mod),
    thePeople(mod),
    theEndings(mod),
    theListeners(mod),
    theGaps(mod),
    "",
  ].filter(Boolean).join("\n");
}

/* ---- run ---- */
const want = process.argv.slice(2);
const targets = want.length ? MODULES.filter((m) => want.includes(m.id)) : MODULES;

if (!targets.length) {
  console.error(`No such module. Have: ${MODULES.map((m) => m.id).join(", ")}`);
  process.exit(1);
}

mkdirSync(DOCS, { recursive: true });
for (const mod of targets) {
  const name = `${mod.id.toUpperCase()}_WARDEN_REFERENCE.md`;
  const path = resolve(DOCS, name);
  writeFileSync(path, dossier(mod), "utf8");
  console.log(`docs/${name}  ${Object.keys(mod.rooms).length} rooms`);
}
