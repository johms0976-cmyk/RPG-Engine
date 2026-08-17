/* ============================================================
   STORAGE v2 — named slots, schema versions, migrations,
   and JSON export/import so a save can outlive a browser.

   Silently no-ops where localStorage is unavailable, so the
   engine still runs when pasted into a sandbox.
   ============================================================ */

export const SAVE_VERSION = 2;
const ROOT = "mothership:v2";
const LEGACY = (id) => `mothership:save:${id}`;
const SETTINGS = "mothership:settings";

const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

function readRoot() {
  if (!ok()) return { v: SAVE_VERSION, slots: {} };
  try {
    const raw = localStorage.getItem(ROOT);
    if (!raw) return { v: SAVE_VERSION, slots: {} };
    const parsed = JSON.parse(raw);
    return parsed && parsed.slots ? parsed : { v: SAVE_VERSION, slots: {} };
  } catch { return { v: SAVE_VERSION, slots: {} }; }
}

function writeRoot(data) {
  if (!ok()) return false;
  try { localStorage.setItem(ROOT, JSON.stringify(data)); return true; }
  catch { return false; }
}

/* ---------------- migrations ---------------- */

const MIGRATIONS = {
  /** v1 saves were { world, pc, feed } under a per-module key, single PC. */
  1: (save) => {
    const pc = save.pc ? { ...save.pc } : null;
    const crew = pc ? [{
      id: pc.id || "pc1_legacy",
      wounds: 0, maxWounds: 2, ammo: {}, spare: {}, buffs: [],
      alive: true, unconscious: false, wakeAt: null,
      lastRestDay: -1, lastAssistDay: -1, spentSkills: [], usedPanicReroll: false,
      armorDamage: 0, xp: pc.xp || 0,
      ...pc,
    }] : [];
    return {
      ...save,
      v: 2,
      crew,
      activeId: crew[0] ? crew[0].id : null,
      world: { ...save.world, v: 2, rollLog: [], oracleMemory: {}, seed: save.world?.seed ?? 1, session: 1, day: 0 },
      pc: undefined,
    };
  },
};

export function migrate(save) {
  let s = save;
  let guard = 0;
  while (s && (s.v || 1) < SAVE_VERSION && guard++ < 10) {
    const fn = MIGRATIONS[s.v || 1];
    if (!fn) break;
    s = fn(s);
  }
  return s;
}

/* ---------------- slots ---------------- */

export const slotKey = (moduleId, name) => `${moduleId}::${name || "auto"}`;

export function listSlots(moduleId) {
  const root = readRoot();
  return Object.entries(root.slots)
    .filter(([k]) => !moduleId || k.startsWith(`${moduleId}::`))
    .map(([k, v]) => ({
      key: k,
      moduleId: k.split("::")[0],
      name: k.split("::")[1],
      at: v.at,
      label: v.label || v.name || k.split("::")[1],
      clock: v.world ? v.world.clock : 0,
      crew: (v.crew || []).map((c) => ({ name: c.name, cls: c.cls, alive: c.alive !== false })),
      ended: v.world ? v.world.ended : null,
    }))
    .sort((a, b) => b.at - a.at);
}

export function save(moduleId, name, data) {
  const root = readRoot();
  root.v = SAVE_VERSION;
  root.slots[slotKey(moduleId, name)] = { v: SAVE_VERSION, at: Date.now(), name, ...data };
  return writeRoot(root);
}

export function load(moduleId, name) {
  const root = readRoot();
  const hit = root.slots[slotKey(moduleId, name)];
  if (hit) return migrate(hit);
  // fall back to a v1 save under the legacy key
  if (!ok()) return null;
  try {
    const raw = localStorage.getItem(LEGACY(moduleId));
    if (!raw) return null;
    const legacy = migrate({ v: 1, at: Date.now(), ...JSON.parse(raw) });
    save(moduleId, "auto", legacy);
    localStorage.removeItem(LEGACY(moduleId));
    return legacy;
  } catch { return null; }
}

export function clear(moduleId, name) {
  const root = readRoot();
  delete root.slots[slotKey(moduleId, name)];
  writeRoot(root);
}

export function clearAll(moduleId) {
  const root = readRoot();
  for (const k of Object.keys(root.slots)) if (k.startsWith(`${moduleId}::`)) delete root.slots[k];
  writeRoot(root);
}

/* ---------------- export / import ---------------- */

export function exportSlot(moduleId, name) {
  const s = load(moduleId, name);
  if (!s) return null;
  return JSON.stringify({ kind: "mothership-save", v: SAVE_VERSION, moduleId, exported: Date.now(), save: s }, null, 2);
}

export function importSlot(json, nameOverride) {
  let parsed;
  try { parsed = JSON.parse(json); } catch { return { ok: false, error: "That isn't valid JSON." }; }
  if (!parsed || parsed.kind !== "mothership-save" || !parsed.save)
    return { ok: false, error: "That doesn't look like a Mothership save." };
  const migrated = migrate(parsed.save);
  if (!migrated.world || !migrated.crew)
    return { ok: false, error: "The save is missing a world or a crew." };
  const name = nameOverride || `imported-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}`;
  const done = save(parsed.moduleId, name, migrated);
  return done
    ? { ok: true, moduleId: parsed.moduleId, name }
    : { ok: false, error: "Couldn't write to local storage." };
}

/** Trigger a browser download without any library. */
export function downloadText(filename, text, mime = "text/plain") {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}

/* ---------------- settings ---------------- */

export function settings() {
  if (!ok()) return {};
  try { return JSON.parse(localStorage.getItem(SETTINGS) || "{}"); } catch { return {}; }
}
export function saveSettings(s) {
  if (!ok()) return;
  try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch { /* ignore */ }
}
