#!/usr/bin/env node
/* ============================================================
   WHAT IS THERE TO SAY

   Step one of three. This works out every sentence an NPC in a
   module is capable of saying, gives each one a key, and writes
   the list to tools/spec/<module>.json for the recorder to read.

     node tools/voice-spec.mjs                 · ypsilon14
     node tools/voice-spec.mjs deadweight
     node tools/voice-spec.mjs --all

   NOTHING IS INVENTED HERE AND NOTHING CAN BE. The lines come
   from three places, all of them written by the module author:

     knows        the dialogue script, and the hard limit on what
                  the person may say — the same list `npcReply`
                  and the director's NPC rung are bound by.
     deflections  what they say instead when they have nothing.
                  An NPC that declares none uses the engine's, so
                  those are read out of oracle.js and recorded in
                  that person's voice too — the table hears the
                  deflection far more often than it hears any
                  single fact, and it is the line most damaged by
                  being read in a stranger's voice.
     npcSay(…)    the handful of lines a module's simulation puts
                  in somebody's mouth directly, at a scripted
                  moment. Found by reading the module's own
                  source, because there is nowhere else they are
                  declared.

   A line's key is a hash of its words — see src/ui/voiceKey.js.
   Edit a sentence and its clip stops matching and gets rebuilt on
   the next run; nothing anywhere has to be renumbered.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { speakable, voiceKey } from "../src/ui/voiceKey.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MODULES = join(ROOT, "src", "modules");
const OUT = join(ROOT, "tools", "spec");

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const QUIET = args.includes("--quiet");
const wanted = args.filter((a) => !a.startsWith("--"));

/* ---------------- finding the cast ---------------- */

/** Modules keep their people in `npcs.js` by convention. Falling
    back to the module's index covers the ones that do not, and a
    module with neither is skipped with a line saying so rather
    than a stack trace — `_template` is deliberately empty and
    must not look like a failure. */
async function castOf(id) {
  const dir = join(MODULES, id);
  const tries = [join(dir, "npcs.js"), join(dir, "index.js")];
  for (const file of tries) {
    if (!existsSync(file)) continue;
    let mod;
    try {
      mod = await import(pathToFileURL(file).href);
    } catch (err) {
      /* Almost always a module whose index imports a bundler-only
         asset (`?url`). npcs.js never does, which is why it is
         tried first. */
      if (!QUIET) console.log(`    (${id}: could not read ${file.split(/[\\/]/).pop()} — ${err.message.split("\n")[0]})`);
      continue;
    }
    const npcs = mod.npcs || mod.default?.npcs || null;
    if (npcs && Object.keys(npcs).length) return npcs;
  }
  return null;
}

/* ---------------- the engine's own deflections ---------------- */

/** Read out of oracle.js rather than copied here, so that editing
    the engine's fallbacks does not silently leave a stale set
    baked into a voice pack. A parse that finds nothing is not
    fatal; it just means those NPCs fall through to the
    synthesiser for their deflections. */
function engineDeflections() {
  try {
    const src = readFileSync(join(ROOT, "src", "engine", "oracle.js"), "utf8");
    /* Anchored on the closing bracket at the start of a line. A
       lazy match to the first "]" stops inside `"[doesn't look up]
       Not now."` and quietly returns two of the six. */
    const block = src.match(/const DEFLECTIONS\s*=\s*\[([\s\S]*?)\n\];/);
    if (!block) return [];
    return [...block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/* ---------------- scripted one-offs ---------------- */

/** `api.npcSay("dana", "…")` in a module's simulation. Two
    arguments, both literal, which is how every one of them is
    written; anything cleverer than that is left to the
    synthesiser rather than guessed at. */
function scriptedLines(id) {
  const dir = join(MODULES, id);
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    if (!/\.jsx?$/.test(entry)) continue;
    const src = readFileSync(join(dir, entry), "utf8");
    const re = /npcSay\(\s*"([A-Za-z0-9_]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
    for (const m of src.matchAll(re)) {
      let text;
      try { text = JSON.parse(`"${m[2]}"`); } catch { continue; }
      found.push({ npc: m[1], text, from: entry });
    }
  }
  return found;
}

/* ---------------- one module ---------------- */

async function build(id) {
  const npcs = await castOf(id);
  if (!npcs) { if (!QUIET) console.log(`  ${id}: no NPC data — skipped.`); return null; }

  const fallback = engineDeflections();
  const scripted = scriptedLines(id);

  const out = [];
  let lines = 0;
  let chars = 0;

  for (const [npcId, n] of Object.entries(npcs)) {
    /* A cat and a man who vanished the night before last. Neither
       has a line and neither should be issued the engine's generic
       deflections, which would give both of them a speaking voice
       the module deliberately withheld. */
    if (n.silent || n.gone) continue;

    const seen = new Set();
    const clips = [];

    const add = (raw, source) => {
      const text = speakable(raw);
      if (!text) return;                     // pure stage direction: nothing to say
      const key = voiceKey(text);
      if (!key || seen.has(key)) return;     // the same sentence twice is one recording
      seen.add(key);
      clips.push({ key, text, source });
    };

    for (const k of n.knows || []) add(k, "knows");
    /* The engine's own deflections stand in only for someone who
       actually talks and was not given any. Somebody with nothing
       to say stays quiet. */
    const own = n.deflections && n.deflections.length;
    const defl = own ? n.deflections : (clips.length ? fallback : []);
    for (const d of defl) add(d, own ? "deflection" : "deflection:engine");
    for (const s of scripted) if (s.npc === npcId) add(s.text, `script:${s.from}`);

    /* Somebody with nothing to say is not a casting problem. Mike
       is gone before the module starts and the cat is a cat. */
    if (!clips.length) continue;

    out.push({
      id: npcId,
      name: n.name || npcId,
      role: n.role || "",
      note: (n.persona || "").replace(/\s+/g, " ").trim(),
      clips,
    });
    lines += clips.length;
    chars += clips.reduce((a, c) => a + c.text.length, 0);
  }

  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${id}.json`);
  writeFileSync(file, `${JSON.stringify({
    module: id,
    generated: new Date().toISOString(),
    npcs: out,
  }, null, 2)}\n`);

  if (!QUIET) {
    console.log(`  ${id}: ${out.length} speaking parts, ${lines} lines, ${chars} characters`);
    for (const p of out) console.log(`    ${p.id.padEnd(12)} ${String(p.clips.length).padStart(3)}  ${p.name}`);
  }
  return { id, parts: out.length, lines, chars, file };
}

/* ---------------- go ---------------- */

const ids = ALL
  ? readdirSync(MODULES).filter((d) => !d.startsWith("_") && !d.startsWith("."))
  : (wanted.length ? wanted : ["ypsilon14"]);

console.log("");
console.log("  Working out what there is to say");
console.log("  --------------------------------");

let any = false;
for (const id of ids) {
  const r = await build(id);
  if (r) any = true;
}

if (!any) {
  console.log("");
  console.log("  Nothing to record. Check the module name against src/modules/.");
  process.exit(1);
}

console.log("");
console.log(`  Written to ${join("tools", "spec")}/`);
console.log("");
