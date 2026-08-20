/* ============================================================
   THE SHELF, PERSISTED — modules loaded at runtime, kept across
   sessions.

   Sibling of storage.js, deliberately its own key and its own
   version. A module and a save are different kinds of thing with
   different lifetimes: wiping your saves should not cost you the
   scenario, and a bad module should not take the campaign with
   it. SAVE_VERSION stays where it is.

   ------------------------------------------------------------
   WHAT IS STORED

   The raw envelope text, not the defined module. Re-running
   defineModule on load costs nothing and means a module loaded
   under engine 2.1 is re-validated under 2.2 — so an engine
   change that breaks a module surfaces on the card, at the shelf,
   instead of three rooms into a session.

   Storing raw also means the bytes on disk are the bytes the
   author shipped, which is what makes an integrity check
   possible later without a re-export.
   ============================================================ */

import { readPortableModule } from "./portableModule.js";

export const SHELF_VERSION = 1;
const SHELF = "rpg-engine:shelf:v1";

/* localStorage may be absent (SSR, a sandboxed iframe, a test) or
   present and throwing (Safari private mode, quota). Both are the
   same case here: the shelf is empty and writes fail quietly, and
   the app still runs on its bundled modules. */
const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

function readShelf() {
  if (!ok()) return { v: SHELF_VERSION, mods: {} };
  try {
    const raw = localStorage.getItem(SHELF);
    if (!raw) return { v: SHELF_VERSION, mods: {} };
    const parsed = JSON.parse(raw);
    return parsed && parsed.mods ? parsed : { v: SHELF_VERSION, mods: {} };
  } catch { return { v: SHELF_VERSION, mods: {} }; }
}

function writeShelf(data) {
  if (!ok()) return false;
  try { localStorage.setItem(SHELF, JSON.stringify(data)); return true; }
  catch { return false; }
}

/**
 * Validate and store. Returns the same refusal shape as
 * readPortableModule so a caller has one error path.
 *
 * @param {string|object} input   envelope text or object
 * @param {{overwrite?: boolean}} opts
 */
export function installModule(input, { overwrite = false } = {}) {
  const read = readPortableModule(input);
  if (!read.ok) return read;

  const id = read.mod.id;
  if (!id) return { ok: false, error: "That module has no id." };

  const shelf = readShelf();
  if (shelf.mods[id] && !overwrite)
    return { ok: false, error: `A module called "${id}" is already loaded.`, conflict: id };

  shelf.v = SHELF_VERSION;
  shelf.mods[id] = {
    at: Date.now(),
    title: read.mod.title,
    author: read.meta.author || "",
    /* Normalised to text. An author who pasted a bare module gets a
       proper envelope back out of exportInstalled(). */
    json: typeof input === "string" ? input : JSON.stringify(input),
  };

  if (!writeShelf(shelf))
    return { ok: false, error: "Couldn't write to local storage — it may be full or disabled." };

  return { ok: true, mod: read.mod, meta: read.meta };
}

/**
 * Every stored module, re-validated. Anything that no longer parses is
 * returned as a `broken` entry rather than dropped silently — a module
 * that vanished without explanation is worse than one that says why.
 *
 * @returns {{mods: object[], broken: {id: string, title: string, error: string}[]}}
 */
export function loadInstalled() {
  const shelf = readShelf();
  const mods = [];
  const broken = [];

  for (const [id, rec] of Object.entries(shelf.mods)) {
    const read = readPortableModule(rec.json);
    if (read.ok) {
      read.mod.installedAt = rec.at;
      read.mod.author = rec.author;
      /* A module can parse but be missing its title — defineModule records
         that as a problem rather than a failure, so it lands here and would
         otherwise render as a blank card with no way to tell which one it
         is. The name it was stored under is the only handle left. */
      if (!read.mod.title) read.mod.title = rec.title || id;
      mods.push(read.mod);
    } else {
      broken.push({
        id,
        title: rec.title || id,
        error: read.error + (read.detail ? ` ${read.detail.join(" ")}` : ""),
      });
    }
  }

  mods.sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
  return { mods, broken };
}

/** Ids only — cheap enough to call on every render. */
export function installedIds() {
  return Object.keys(readShelf().mods);
}

export function removeModule(id) {
  const shelf = readShelf();
  if (!shelf.mods[id]) return false;
  delete shelf.mods[id];
  return writeShelf(shelf);
}

/** The stored envelope text, for re-export. */
export function exportInstalled(id) {
  const rec = readShelf().mods[id];
  return rec ? rec.json : null;
}

export function clearShelf() {
  return writeShelf({ v: SHELF_VERSION, mods: {} });
}

/**
 * Merge loaded modules into the bundled shelf.
 *
 * Bundled modules WIN on an id collision. A file dropped into the
 * browser must not be able to shadow Ypsilon 14 — not because anything
 * dramatic follows, but because a user who loads a module named after
 * one they already have should get a clear conflict rather than a
 * quiet substitution.
 */
export function mergeModules(bundled, installed) {
  const taken = new Set(bundled.map((m) => m.id));
  return [...bundled, ...installed.filter((m) => !taken.has(m.id))];
}
