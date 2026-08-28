/* ============================================================
   PREFLIGHT — does every import point at a file that exists?

   This exists because of a failure that cost an evening. A file
   was left out of an upload, and the only symptom anybody saw
   was Play.bat printing "Build failed. Check the messages
   above." over forty lines of rollup stack trace, in a console
   window that had already scrolled. The name of the missing
   file was in there, once, in the middle.

   Rollup is right to stop, but it stops on the FIRST unresolved
   import and it reports it as a build error rather than as what
   it actually is — a file that is not in the folder. If three
   files are missing you find that out three builds later.

   So this walks every source file, resolves every relative
   import the way Vite would, and reports ALL of them at once,
   in the plain terms of the thing that went wrong: this file is
   missing, and here is who was asking for it.

   Two checks, and a reason for each:

     MISSING   the import does not resolve to anything on disk.
               Almost always a file that did not make it into a
               commit, an upload, or a zip.

     CASE      the import resolves, but the letters on disk are
               not the letters in the import. Windows does not
               care and Linux does, so this builds fine on the
               machine it was written on and 404s on GitHub
               Pages. Warning, not an error — it does not stop
               your local build, because it does not need to.

   Run:  npm run preflight
   Exit: 0 = everything resolves, 1 = something is missing
   ============================================================ */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, not URL.pathname. On Windows a file: URL's pathname
   is "/C:/Users/..." with a leading slash, and every path built from
   it silently misses - which would make this checker report the whole
   repository as absent on the one platform it exists to serve. */
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/* Where to look. `tests` is deliberately out: a test may import a
   fixture that a test helper creates, and a red preflight that
   blocks a build over a test file would be a worse tool. */
const SCAN_DIRS = ["src", "server", "scripts"];
const SCAN_EXT = /\.(jsx?|mjs)$/;

/* Vite's resolution order for a bare relative specifier. The empty
   string first, because most imports in this codebase already carry
   their extension and there is no reason to stat four times. */
const CANDIDATES = ["", ".js", ".jsx", ".mjs", ".json", ".css",
  "/index.js", "/index.jsx", "/index.mjs"];

/* ---------------- collecting files ---------------- */

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(e.name)) out.push(p);
  }
  return out;
}

/* ---------------- finding imports ----------------

   Comments are stripped first. This codebase writes long block
   comments that explain decisions, and several of them quote an
   import line while describing what used to be there. Scanning
   those would report a missing file that nothing actually asks
   for, which is exactly the kind of false alarm that teaches
   people to ignore a checker. */

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    /* Not after a colon, so `http://` survives. A `//` inside a
       string is the only thing this gets wrong, and getting it
       wrong means missing an import, not inventing one. */
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.[^'"]+)\1/g;

function importsIn(file) {
  const src = stripComments(readFileSync(file, "utf8"));
  const found = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) found.push(m[2]);
  return found;
}

/* ---------------- resolving ----------------

   `?url`, `?raw` and `?worker` are Vite query suffixes that change
   how an asset is handed back, not what file it is. Strip before
   touching the disk or every mp3 in the repo reads as missing. */

function resolveSpec(fromFile, spec) {
  const clean = spec.split("?")[0].split("#")[0];
  const base = resolve(dirname(fromFile), clean);
  for (const ext of CANDIDATES) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/* Walk the resolved path segment by segment and compare each one
   against what the directory actually contains. existsSync is
   case-insensitive on Windows and case-sensitive on Linux, so this
   is the only way to catch it from either side. */
function caseMismatch(abs) {
  const rel = relative(ROOT, abs);
  if (rel.startsWith("..")) return null;
  let dir = ROOT;
  for (const part of rel.split(sep)) {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return null;
    }
    if (!names.includes(part)) {
      const hit = names.find((n) => n.toLowerCase() === part.toLowerCase());
      if (hit) return { want: part, real: hit, in: relative(ROOT, dir) || "." };
      return null;
    }
    dir = join(dir, part);
  }
  return null;
}

/* ---------------- run ---------------- */

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

const missing = new Map();   // spec -> Set(importers)
const wrongCase = new Map(); // "want->real" -> Set(importers)

for (const file of files) {
  for (const spec of importsIn(file)) {
    const hit = resolveSpec(file, spec);
    const who = relative(ROOT, file);
    if (!hit) {
      const key = relative(ROOT, resolve(dirname(file), spec.split("?")[0]));
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key).add(who);
      continue;
    }
    const mm = caseMismatch(hit);
    if (mm) {
      const key = `${join(mm.in, mm.want)} -> ${join(mm.in, mm.real)}`;
      if (!wrongCase.has(key)) wrongCase.set(key, new Set());
      wrongCase.get(key).add(who);
    }
  }
}

const n = files.length;

if (!missing.size && !wrongCase.size) {
  console.log(`  Preflight OK - every import in ${n} files resolves.`);
  process.exit(0);
}

if (wrongCase.size) {
  console.log("");
  console.log("  CASE MISMATCH - builds here, 404s on a case-sensitive host:");
  console.log("");
  for (const [key, who] of wrongCase) {
    console.log(`    ${key}`);
    for (const w of who) console.log(`        imported by  ${w}`);
  }
}

if (missing.size) {
  console.log("");
  console.log("  ------------------------------------------------------------");
  const one = missing.size === 1;
  console.log(`  MISSING FILES - ${missing.size} import${one ? "" : "s"} ${one ? "points" : "point"} at nothing.`);
  console.log("  ------------------------------------------------------------");
  console.log("");
  for (const [path, who] of missing) {
    console.log(`    ${path}`);
    for (const w of who) console.log(`        imported by  ${w}`);
    console.log("");
  }
  console.log("  This is not a code error. These files are not in the folder.");
  console.log("  If you have them on another machine, copy them in and run");
  console.log("  this again. If you pulled this from GitHub, they were never");
  console.log("  uploaded - check the repo, not your copy.");
  console.log("");
  process.exit(1);
}

console.log("");
process.exit(0);
