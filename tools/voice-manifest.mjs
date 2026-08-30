#!/usr/bin/env node
/* ============================================================
   WHAT ACTUALLY GOT RECORDED

   Step three of three. Looks at the mp3s that exist in
   public/voice/, checks them against the specs, and writes
   src/voice/manifest.js — the list the app reads to know whether
   a line has a recording before it tries to play one.

     node tools/voice-manifest.mjs
     node tools/voice-manifest.mjs --prune      delete orphans

   ON DISK IS THE TRUTH. The manifest is built by reading the
   folder, not by trusting the recorder's report. A file deleted
   by hand, a run killed halfway, a clip that never made it — all
   of them are simply absent from the folder and therefore absent
   from the manifest, and the app falls back to the synthesiser
   for those lines without being told anything.

   ORPHANS. A clip whose line has since been edited keeps its old
   key and stops matching anything in the spec. It is harmless —
   nothing will ever ask for it — but it is dead weight in the
   build and in git, so it is counted here and removed by --prune.
   Counted by default rather than deleted by default, because a
   tool that deletes audio without being asked is a tool nobody
   trusts twice.
   ============================================================ */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VOICE = join(ROOT, "public", "voice");
const SPEC = join(ROOT, "tools", "spec");
const OUT = join(ROOT, "src", "voice", "manifest.js");
const CAST = join(ROOT, "tools", "voice-cast.json");

const PRUNE = process.argv.includes("--prune");
const MIN_BYTES = 512;

const dirs = (p) => (existsSync(p)
  ? readdirSync(p).filter((d) => !d.startsWith(".") && statSync(join(p, d)).isDirectory())
  : []);

const cast = existsSync(CAST) ? JSON.parse(readFileSync(CAST, "utf8")) : {};
const voiceOf = (mod, npc) =>
  (cast[mod]?.[npc]?.voice) || (cast[mod]?._default?.voice) || (cast._default?.voice) || null;

const modules = {};
let clips = 0;
let orphans = 0;
let stale = 0;

console.log("");
console.log("  Building the manifest");
console.log("  ---------------------");

for (const mod of dirs(VOICE)) {
  const specFile = join(SPEC, `${mod}.json`);
  const spec = existsSync(specFile) ? JSON.parse(readFileSync(specFile, "utf8")) : null;
  /* Keys the module can currently produce. No spec means no way to
     tell a live clip from an orphan, so nothing is pruned and
     everything found is trusted. */
  const known = spec
    ? new Map(spec.npcs.map((p) => [p.id, new Set(p.clips.map((c) => c.key))]))
    : null;

  const npcs = {};
  for (const npc of dirs(join(VOICE, mod))) {
    const folder = join(VOICE, mod, npc);
    const live = [];
    for (const file of readdirSync(folder)) {
      if (!file.endsWith(".mp3")) continue;
      const key = file.slice(0, -4);
      const full = join(folder, file);
      if (statSync(full).size < MIN_BYTES) {
        /* A truncated cut. Removed either way: it is not a
           recording, and leaving it means the recorder skips it
           forever and the line is silently never voiced. */
        unlinkSync(full);
        continue;
      }
      if (known && !(known.get(npc)?.has(key))) {
        orphans += 1;
        if (PRUNE) unlinkSync(full);
        continue;
      }
      live.push(key);
    }
    if (!live.length) continue;
    live.sort();
    npcs[npc] = { voice: voiceOf(mod, npc), clips: live };
    clips += live.length;
  }

  if (!Object.keys(npcs).length) continue;
  modules[mod] = { npcs };

  if (spec) {
    const want = spec.npcs.reduce((n, p) => n + p.clips.length, 0);
    const have = Object.values(npcs).reduce((n, v) => n + v.clips.length, 0);
    stale += Math.max(0, want - have);
    console.log(`  ${mod}: ${have} of ${want} lines recorded`);
    for (const p of spec.npcs) {
      const have2 = npcs[p.id]?.clips.length || 0;
      const mark = have2 === p.clips.length ? " " : "·";
      console.log(`   ${mark} ${p.id.padEnd(12)} ${String(have2).padStart(3)}/${String(p.clips.length).padEnd(3)} ${npcs[p.id]?.voice || "—"}`);
    }
  } else {
    console.log(`  ${mod}: ${Object.values(npcs).reduce((n, v) => n + v.clips.length, 0)} clips (no spec — nothing checked)`);
  }
}

const body = `/* ============================================================
   GENERATED FILE — do not edit by hand.

   Written by \`node tools/voice-manifest.mjs\`. See that file, and
   src/ui/voiceClips.js for what is done with this.

   The path of a clip is:  <base>voice/<module>/<npcId>/<key>.mp3
   ============================================================ */

export const voiceManifest = ${JSON.stringify({
  version: 1,
  generated: new Date().toISOString(),
  modules,
}, null, 2)};

export default voiceManifest;
`;

mkdirSync(join(ROOT, "src", "voice"), { recursive: true });
writeFileSync(OUT, body);

console.log("");
console.log(`  ${clips} clips in ${Object.keys(modules).length} module(s) → src/voice/manifest.js`);
if (stale) console.log(`  ${stale} line(s) not recorded yet — those fall back to the tablet's own voice.`);
if (orphans) {
  console.log(PRUNE
    ? `  ${orphans} orphaned clip(s) deleted.`
    : `  ${orphans} orphaned clip(s) — lines that have been edited since. Re-run with --prune to remove them.`);
}
console.log("");
