/* Save/resume. Silently no-ops in sandboxes without localStorage
   (e.g. pasted into a Claude artifact), so the engine still runs. */
const KEY = (id) => `mothership:save:${id}`;
const ok = () => { try { return typeof localStorage !== "undefined"; } catch { return false; } };

export function save(id, data) {
  if (!ok()) return;
  try { localStorage.setItem(KEY(id), JSON.stringify({ at: Date.now(), ...data })); } catch { /* full or blocked */ }
}
export function load(id) {
  if (!ok()) return null;
  try { const raw = localStorage.getItem(KEY(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clear(id) {
  if (!ok()) return;
  try { localStorage.removeItem(KEY(id)); } catch { /* ignore */ }
}
export function settings() {
  if (!ok()) return {};
  try { return JSON.parse(localStorage.getItem("mothership:settings") || "{}"); } catch { return {}; }
}
export function saveSettings(s) {
  if (!ok()) return;
  try { localStorage.setItem("mothership:settings", JSON.stringify(s)); } catch { /* ignore */ }
}
