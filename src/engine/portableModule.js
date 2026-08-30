/* ============================================================
   PORTABLE MODULES — a scenario as a file.

   Adding a module used to mean writing JavaScript, editing
   src/modules/index.js, and running a build. That put the whole
   authoring audience behind a toolchain, which is a rounding
   error of the people who write Mothership scenarios.

   A portable module is the same DSL as docs/MODULE_FORMAT.md,
   expressed as JSON, loaded at runtime, and distributable as a
   file somebody can email.

   ------------------------------------------------------------
   JSON IS DATA, NOT CODE

   This is the whole security posture and it is worth being blunt
   about. A loaded module is parsed, never executed. There is no
   eval, no new Function, no dynamic import. The dice expressions
   inside it go through the recursive-descent parser in
   diceParser.js, which exists precisely because they used to go
   through new Function.

   That is also the format's one real limitation, and it is a
   deliberate trade rather than an oversight.

   ------------------------------------------------------------
   WHAT JSON CANNOT CARRY

   Three places in the DSL take a function:

     hooks              named JS, reached by { run: "name" }
     devices.*.status   (w, pc) => string[]
     devices.*.actions[].label   (w) => string

   A portable module can have none of them. For `hooks` that is a
   hard stop: an effect that says { run: "x" } with no hook `x` is
   already a validation problem, and it should be, because the
   module would silently do nothing at that beat. This file
   detects the case early so the author is told "portable modules
   cannot carry hooks" rather than "run x has no matching hook",
   which is true but unhelpful.

   For the two device fields it is a soft stop. Play.jsx already
   guards both with a typeof check, so a static string label works
   and a missing status renders as no lines. Those are warnings.

   A module that genuinely needs simulation stays a bundled module
   in src/modules/. Everything else — which is nearly everything —
   fits here.
   ============================================================ */

import { defineModule, moduleCard } from "./defineModule.js";

export const PMOD_VERSION = 1;
export const PMOD_KIND = "rpg-engine-module";
export const PMOD_EXT = ".mship";

/* The keys defineModule reads. Anything else in a loaded file is
   dropped rather than passed through, so a module cannot smuggle
   fields into the engine that the engine never agreed to hold. */
const ALLOWED = new Set([
  "engine", "ruleset", "id", "title", "subtitle", "byline", "blurb", "pitch",
  "contentWarning", "length", "crewSize", "theme", "feedStyles",
  "items", "loadouts", "rooms", "start", "npcs", "npcOrder", "threats",
  "handouts", "devices", "itemUse", "actions", "tables", "meters",
  "tracks", "clocks", "endings", "intro", "onStart", "flavour",
  "wardenTables", "talkPrompts", "restSpots", "shops", "warden",
  "lore", "tutorial", "debrief", "xp", "ship", "map",
]);

/** Keys a portable module may never set, with the reason. */
const FORBIDDEN = {
  hooks: "portable modules cannot carry JavaScript hooks",
  problems: "validation output is produced by the engine, not declared",
  warnings: "validation output is produced by the engine, not declared",
};

/* ---------------- shape checks ---------------- */

/** Walk every effects array we can reach, the same shape defineModule walks. */
function walk(node, visit, depth = 0) {
  if (!node || depth > 24) return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit, depth + 1)); return; }
  if (typeof node !== "object") return;
  visit(node);
  for (const v of Object.values(node)) walk(v, visit, depth + 1);
}

/**
 * Structural problems specific to the portable format — the ones worth
 * naming before defineModule's generic validation gets hold of them.
 */
function inspect(raw) {
  const problems = [];
  const warnings = [];

  for (const [key, why] of Object.entries(FORBIDDEN)) {
    if (raw[key] !== undefined) problems.push(`"${key}" is not allowed: ${why}`);
  }

  const unknown = Object.keys(raw).filter((k) => !ALLOWED.has(k) && !FORBIDDEN[k]);
  if (unknown.length) warnings.push(`ignored unknown keys: ${unknown.join(", ")}`);

  /* A `run` effect in a file that cannot carry hooks. Named here so the
     author gets the real reason rather than a dangling-reference error. */
  const runs = new Set();
  walk(raw, (n) => { if (typeof n.run === "string") runs.add(n.run); });
  if (runs.size) {
    problems.push(
      `uses { run: … } for ${[...runs].join(", ")}, but portable modules cannot carry hooks. ` +
      "Rewrite those beats as effects, or ship it as a bundled module.",
    );
  }

  /* Device fields that would have been functions. Play.jsx guards both,
     so these degrade rather than break. */
  Object.entries(raw.devices || {}).forEach(([id, d]) => {
    if (!d || typeof d !== "object") return;
    if (d.status !== undefined && typeof d.status !== "function") {
      warnings.push(`device "${id}": status lines need a function, so this device will show none`);
    }
    (Array.isArray(d.actions) ? d.actions : []).forEach((a) => {
      if (a && a.label === undefined) warnings.push(`device "${id}": an action has no label`);
    });
  });

  /* Anything that survived JSON as a function did not come from JSON.
     Refuse it rather than wonder where it came from. */
  let fn = false;
  walk(raw, (n) => { for (const v of Object.values(n)) if (typeof v === "function") fn = true; });
  if (fn) problems.push("contains functions, which a portable module cannot");

  return { problems, warnings };
}

/* ---------------- reading ---------------- */

/** Strip to the keys the engine reads. */
const pick = (raw) => {
  const out = {};
  for (const k of Object.keys(raw)) if (ALLOWED.has(k)) out[k] = raw[k];
  return out;
};

/**
 * Parse an envelope. Accepts the wrapped form and, for convenience, a
 * bare module object — people will hand-write these and forget the wrapper.
 *
 * @returns {{ok: true, raw: object, meta: object} | {ok: false, error: string}}
 */
export function unwrap(input) {
  let parsed = input;
  if (typeof input === "string") {
    try { parsed = JSON.parse(input); }
    catch (e) { return { ok: false, error: `That isn't valid JSON: ${e.message}` }; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return { ok: false, error: "A module has to be a JSON object." };

  /* Wrapped. */
  if (parsed.kind === PMOD_KIND) {
    if (!parsed.module || typeof parsed.module !== "object")
      return { ok: false, error: "The envelope has no module in it." };
    if ((parsed.v || 1) > PMOD_VERSION)
      return {
        ok: false,
        error: `This module wants format v${parsed.v}; this engine reads v${PMOD_VERSION}. Update the engine.`,
      };
    return {
      ok: true,
      raw: parsed.module,
      meta: { author: parsed.author || "", exported: parsed.exported || null, v: parsed.v || 1 },
    };
  }

  /* A different kind of file entirely — most likely a save. */
  if (typeof parsed.kind === "string")
    return { ok: false, error: `That is a "${parsed.kind}" file, not a module.` };

  /* Bare. Recognised by the fields every module must have. */
  if (parsed.id && parsed.title && parsed.rooms)
    return { ok: true, raw: parsed, meta: { author: "", exported: null, v: PMOD_VERSION } };

  return { ok: false, error: "That doesn't look like a module — no id, title or rooms." };
}

/**
 * The whole path: text or object in, a defined module out, or a
 * structured refusal. Never throws.
 *
 * Problems from `defineModule` are left ON the module rather than
 * turned into a failure, because that is how bundled modules behave —
 * a broken module appears on the shelf with its problems listed, and
 * the library refuses to start it. One error path, not two.
 *
 * @returns {{ok: true, mod: object, meta: object} | {ok: false, error: string, detail?: string[]}}
 */
export function readPortableModule(input) {
  const un = unwrap(input);
  if (!un.ok) return un;

  const { problems, warnings } = inspect(un.raw);
  if (problems.length)
    return { ok: false, error: "That module can't be loaded.", detail: problems };

  let mod;
  try {
    mod = defineModule(pick(un.raw));
  } catch (e) {
    /* defineModule is not supposed to throw, but it is handed arbitrary
       shapes now. A crash here must read as a bad file, not a bad engine. */
    return { ok: false, error: "The module is malformed.", detail: [String(e && e.message) || "unknown"] };
  }

  mod.portable = true;
  mod.warnings = [...(mod.warnings || []), ...warnings];
  return { ok: true, mod, meta: un.meta };
}

/* ---------------- writing ---------------- */

/** Drop functions and undefined, recursively. What is left is JSON-safe. */
function plain(v, depth = 0) {
  if (depth > 24) return undefined;
  if (typeof v === "function" || v === undefined) return undefined;
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    const out = v.map((x) => plain(x, depth + 1)).filter((x) => x !== undefined);
    return out;
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const p = plain(val, depth + 1);
    if (p !== undefined) out[k] = p;
  }
  return out;
}

/**
 * Dump a defined module to portable JSON — the starting point the
 * docs promise for authors who want to fork Ypsilon 14 rather than
 * start from nothing.
 *
 * Lossy by construction: hooks and function-valued fields cannot
 * survive. `lost` says what went, so the caller can tell the truth
 * about it rather than shipping a quietly broken file.
 *
 * @returns {{json: string, lost: string[]}}
 */
export function toPortable(mod, { author = "", pretty = true } = {}) {
  const lost = [];
  if (mod.hooks && Object.keys(mod.hooks).length)
    lost.push(`hooks: ${Object.keys(mod.hooks).join(", ")}`);

  Object.entries(mod.devices || {}).forEach(([id, d]) => {
    if (d && typeof d.status === "function") lost.push(`device ${id}: status`);
    (d && Array.isArray(d.actions) ? d.actions : []).forEach((a, i) => {
      if (typeof a.label === "function") lost.push(`device ${id}: actions[${i}].label`);
    });
  });

  const body = {};
  for (const k of ALLOWED) {
    if (mod[k] === undefined) continue;
    const p = plain(mod[k]);
    if (p !== undefined) body[k] = p;
  }

  const envelope = {
    kind: PMOD_KIND,
    v: PMOD_VERSION,
    author,
    exported: Date.now(),
    module: body,
  };

  return { json: JSON.stringify(envelope, null, pretty ? 2 : 0), lost };
}

/** A filename that will not fight with a filesystem. */
export const portableFilename = (mod) =>
  `${String(mod.id || "module").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}${PMOD_EXT}`;

export { moduleCard };
