/* ============================================================
   THE CAST, RECORDED

   `useVoice` reads the feed aloud in the browser's own voice —
   one voice, for ten people and a cat. It is better than silence
   at a wardenless table and it is nobody's idea of a performance.

   This is the other half: if somebody has run the voice tool,
   Sonya's lines are Sonya's voice and Jerome's are not, and the
   table can tell who is talking without reading the name.

   WHAT THIS IS NOT. Nothing is generated here or at run time. The
   mp3s are cut in advance, from sentences a module author wrote,
   by a tool a human runs on purpose, and they are bundled into
   `public/` and served by the same origin as the app — exactly the
   standing of the three cassettes in `modules/ypsilon14/audio.js`.
   A table on a LAN with no uplink plays them as well as one with
   fibre. INV-1 is about where a sentence came from, and every
   sentence here came from the module.

   FAILURE IS SILENCE, THEN THE SYNTHESISER. Every path out of
   this file is either a clip or `false`. A missing key, a 404, a
   phone that will not decode mp3, an autoplay policy that refuses
   the first sound before the first tap — all of them return
   `false` and the caller says the line the old way. A voice pack
   must never be able to make a line not get read.
   ============================================================ */

import { voiceManifest } from "../voice/manifest.js";

/** Where the clips live, resolved against the document rather than
    the origin. `vite.config.js` builds with a relative base so the
    site works at /RPG-Engine/, in a /docs folder, or off a stick;
    a root-relative "/voice/..." would be correct in exactly one of
    those and silently 404 in the others. */
function base() {
  const b = (import.meta?.env?.BASE_URL) || "./";
  if (typeof document === "undefined") return b;
  try {
    return new URL(b, document.baseURI).href;
  } catch {
    return b;
  }
}

/** Which module a clip belongs to. Callers usually know; when they
    do not, the key is a hash of the words, so looking through every
    recorded module for an NPC of that id finds the right one or
    nothing at all. */
function findModule(npcId, key, hint) {
  const mods = voiceManifest?.modules || {};
  const has = (m) => {
    const npc = mods[m]?.npcs?.[npcId];
    return npc && Array.isArray(npc.clips) && npc.clips.includes(key);
  };
  if (hint && has(hint)) return hint;
  for (const m of Object.keys(mods)) if (m !== hint && has(m)) return m;
  return null;
}

/** Is there a recording of this exact line by this exact person? */
export function hasClip(npcId, key, moduleHint) {
  if (!npcId || !key) return false;
  return findModule(npcId, key, moduleHint) != null;
}

/** The URL of that recording, or null. */
export function clipUrl(npcId, key, moduleHint) {
  const mod = findModule(npcId, key, moduleHint);
  if (!mod) return null;
  return `${base()}voice/${mod}/${npcId}/${key}.mp3`;
}

/** How much of a module is recorded. The Warden's settings drawer
    can say "Ypsilon 14 · 94 lines" instead of asking somebody to
    count files in a folder. */
export function clipCount(moduleId) {
  const npcs = voiceManifest?.modules?.[moduleId]?.npcs || {};
  return Object.values(npcs).reduce((n, v) => n + (v.clips?.length || 0), 0);
}

/** Which modules have any recordings at all. */
export function recordedModules() {
  return Object.keys(voiceManifest?.modules || {});
}

/* ---------------- playing one ----------------

   One at a time, on purpose. Two NPCs talking over each other is
   what happens when a scene fires three lines in the same tick,
   and it is unintelligible — the synthesiser queues, so this has
   to as well, and the cheapest correct queue is "the new line
   stops the old one", which is also what `cancel()` needs. */

let current = null;

export function stopClip() {
  if (!current) return;
  try { current.pause(); } catch { /* already gone */ }
  current = null;
}

/**
 * Play a clip. Resolves true if it actually played to the end,
 * false for every kind of not-playing there is.
 *
 * @returns {Promise<boolean>}
 */
export function playClip(url, { volume = 1 } = {}) {
  if (!url || typeof window === "undefined" || typeof window.Audio !== "function") {
    return Promise.resolve(false);
  }
  stopClip();
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (current === a) current = null;
      resolve(ok);
    };
    let a;
    try {
      a = new window.Audio(url);
    } catch {
      resolve(false);
      return;
    }
    a.volume = volume;
    a.preload = "auto";
    a.addEventListener("ended", () => finish(true));
    a.addEventListener("error", () => finish(false));
    /* A pause that was not an `ended` is `stopClip` or a new line
       arriving. Either way this one is over and the caller must not
       then fall back to the synthesiser and say it twice — so it
       resolves true, meaning "handled", not "heard in full". */
    a.addEventListener("pause", () => { if (a.currentTime > 0) finish(true); });
    current = a;
    const p = a.play();
    /* Autoplay policy. Before the first tap on a fresh tab the
       promise rejects, and the honest answer is that the clip did
       not play — the synthesiser has the same problem and handles
       it the same way, by simply not being heard. */
    if (p && typeof p.catch === "function") p.catch(() => finish(false));
  });
}

/** Pull the files for a module into the HTTP cache while nobody is
    waiting, the way `ypsilon14/audio.js` warms the cassettes. Uses
    Audio elements rather than fetch so that `src/` gains no new
    network call: same bytes, same cache, no allowlist entry.

    Deliberately quiet and deliberately optional — a warm that does
    not finish costs nothing, because the clip is fetched normally
    when the line is said. */
export function warmClips(moduleId, { limit = 40 } = {}) {
  if (typeof window === "undefined" || typeof window.Audio !== "function") return 0;
  const npcs = voiceManifest?.modules?.[moduleId]?.npcs || {};
  let n = 0;
  for (const [npcId, entry] of Object.entries(npcs)) {
    for (const key of entry.clips || []) {
      if (n >= limit) return n;
      try {
        const a = new window.Audio();
        a.preload = "auto";
        a.src = `${base()}voice/${moduleId}/${npcId}/${key}.mp3`;
        n += 1;
      } catch { return n; }
    }
  }
  return n;
}

export default { hasClip, clipUrl, clipCount, playClip, stopClip, warmClips, recordedModules };
