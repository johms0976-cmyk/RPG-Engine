/* ============================================================
   THE LOCKER — characters kept on your own phone, across
   campaigns and across Wardens.

   Separate from the save-slot store on purpose. A save belongs
   to a table; a character belongs to a player, and should
   outlive the table it was made at.
   ============================================================ */
import { exportCharacter, parseCharacter, CHAR_VERSION } from "./portable.js";

const KEY = "mothership:locker:v1";
const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

function read() {
  if (!ok()) return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(d) {
  if (!ok()) return false;
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

export const lockerKey = (file) =>
  `${String(file.pc.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${file.pc.cls}`;

export function listCharacters() {
  const all = read();
  return Object.entries(all)
    .map(([key, file]) => ({
      key,
      name: file.pc.name,
      cls: file.pc.cls,
      level: file.pc.level || 0,
      sessions: (file.history && file.history.sessions) || 0,
      alive: file.pc.alive !== false,
      at: file.exported || 0,
      file,
    }))
    .sort((a, b) => b.at - a.at);
}

export function stash(file) {
  if (!file || !file.pc) return false;
  const all = read();
  all[lockerKey(file)] = { ...file, v: CHAR_VERSION, exported: Date.now() };
  return write(all);
}

/** Take a live character out of a session and keep it. */
export const stashLive = (pc, meta) => stash(exportCharacter(pc, meta));

export function forget(key) {
  const all = read();
  delete all[key];
  return write(all);
}

export function importText(text) {
  const r = parseCharacter(text);
  if (!r.ok) return r;
  stash(r.character);
  return r;
}

export const getCharacter = (key) => read()[key] || null;
