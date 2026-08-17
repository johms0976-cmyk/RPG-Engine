/* ============================================================
   PORTABLE CHARACTERS — one character, out of the game and into
   a file, a QR code, or another phone.

   A Mothership character that has survived anything is a trophy,
   so what travels is not just the stat block. It carries the
   scars: sessions endured, phobias collected, who they watched
   die. That history is the point of the format.
   ============================================================ */

export const CHAR_VERSION = 2;
export const CHAR_KIND = "mothership-character";
export const CHAR_EXT = ".msc";

/* ---------------- history ---------------- */

/** A fresh, unblooded record. Attached at creation, grown by play. */
export const newHistory = () => ({
  born: Date.now(),
  sessions: 0,
  modules: [],      // ids of what they have been through
  survived: [],     // titles they walked out of
  witnessed: [],    // names of crew who died in front of them
  panics: 0,
  critFails: 0,
  woundsTaken: 0,
  longestStress: 2,
});

/** Fold a finished session into a character's record. */
export function recordSession(history, { moduleId, title, survived, witnessed = [], panics = 0, critFails = 0, peakStress = 0 }) {
  const h = { ...newHistory(), ...(history || {}) };
  return {
    ...h,
    sessions: h.sessions + 1,
    modules: [...new Set([...h.modules, moduleId])],
    survived: survived ? [...h.survived, title] : h.survived,
    witnessed: [...new Set([...h.witnessed, ...witnessed])],
    panics: h.panics + panics,
    critFails: h.critFails + critFails,
    longestStress: Math.max(h.longestStress, peakStress),
  };
}

/* ---------------- export ---------------- */

/** Strip the run-specific bookkeeping. Ammo loaded in a gun and
    whether you rested today belong to a session, not to a person. */
const PER_SESSION = new Set([
  "ammo", "spare", "uses", "buffs", "wounds", "armorDamage",
  "lastRestDay", "lastAssistDay", "usedPanicReroll", "unconscious", "wakeAt",
  "spentSkills",
]);

export function exportCharacter(pc, { moduleId, note } = {}) {
  if (!pc || !pc.id) return null;
  const body = {};
  for (const [k, v] of Object.entries(pc)) if (!PER_SESSION.has(k)) body[k] = v;
  // A fresh id on arrival, so importing the same file twice at one
  // table gives two characters rather than one impossible twin.
  delete body.id;
  return {
    kind: CHAR_KIND,
    v: CHAR_VERSION,
    exported: Date.now(),
    from: moduleId || null,
    note: note || null,
    history: pc.history || newHistory(),
    pc: body,
  };
}

export const toFileName = (pc) =>
  `${String(pc.name || "unnamed").toLowerCase().replace(/[^a-z0-9]+/g, "-")}${CHAR_EXT}`;

export const toJson = (payload) => JSON.stringify(payload, null, 2);

/* ---------------- import ---------------- */

const MIGRATIONS = {
  // v1 files predate the history record and the conditions array.
  // Guards on f.pc: a migration runs before the shape has been checked,
  // so it must survive a file that has no character in it at all.
  1: (f) => ({
    ...f, v: 2,
    history: f.history || newHistory(),
    pc: f.pc ? { ...f.pc, conditions: f.pc.conditions || [], resolve: f.pc.resolve ?? 0 } : f.pc,
  }),
};

export function migrateCharacter(file) {
  let f = file, guard = 0;
  while (f && (f.v || 1) < CHAR_VERSION && guard++ < 10) {
    const fn = MIGRATIONS[f.v || 1];
    if (!fn) break;
    f = fn(f);
  }
  return f;
}

/** Parse a file's text. Returns { ok, character } or { ok:false, error }.
    Deliberately says nothing about whether the character is *legal* —
    that is validate.js's job, and the two are kept apart so a corrupt
    file and a cheating file produce different messages. */
export function parseCharacter(text) {
  let parsed;
  try { parsed = typeof text === "string" ? JSON.parse(text) : text; }
  catch { return { ok: false, error: "That isn't valid JSON." }; }
  if (!parsed || parsed.kind !== CHAR_KIND) {
    return { ok: false, error: "That isn't a Mothership character file." };
  }
  if ((parsed.v || 1) > CHAR_VERSION) {
    return { ok: false, error: "That file was made by a newer version of the engine." };
  }
  const file = migrateCharacter(parsed);
  const pc = file.pc;
  if (!pc || !pc.name || !pc.cls || !pc.stats || !pc.saves) {
    return { ok: false, error: "The file is missing the character." };
  }
  return { ok: true, character: file };
}

/** Rehydrate into something the engine can put in a crew. */
export function adoptCharacter(file, newId) {
  const pc = {
    ...file.pc,
    id: newId,
    ammo: {}, spare: {}, uses: {}, buffs: [],
    wounds: 0, armorDamage: 0, spentSkills: [],
    lastRestDay: -1, lastAssistDay: -1,
    usedPanicReroll: false, unconscious: false, wakeAt: null,
    alive: true,
    history: file.history || newHistory(),
  };
  // Health cannot exceed what Strength allows, whatever the file claims.
  pc.maxHealth = Math.max(1, pc.stats.strength * 2);
  pc.health = Math.min(pc.health ?? pc.maxHealth, pc.maxHealth);
  return pc;
}

/* ---------------- QR ----------------
   A character is ~1.5KB of JSON, which overflows a scannable QR.
   Squeezing it: drop whitespace, shorten the envelope, and strip
   anything derivable on the far side. Around 600 bytes, which a
   phone camera reads reliably at arm's length. */

export function toCompact(file) {
  const p = file.pc;
  return JSON.stringify({
    k: "msc", v: file.v,
    n: p.name, c: p.cls, l: p.level || 0, x: p.xp || 0,
    s: [p.stats.strength, p.stats.speed, p.stats.intellect, p.stats.combat],
    v4: [p.saves.sanity, p.saves.fear, p.saves.body, p.saves.armor],
    st: p.stress, r: p.resolve, cr: p.credits,
    sk: p.skills || [], it: p.items || [], cd: p.conditions || [],
    t: p.trinket, pa: p.patch,
    h: [file.history.sessions, file.history.panics, file.history.critFails],
  });
}

export function fromCompact(text) {
  let c;
  try { c = typeof text === "string" ? JSON.parse(text) : text; }
  catch { return { ok: false, error: "That QR code isn't a character." }; }
  if (!c || c.k !== "msc") return { ok: false, error: "That QR code isn't a character." };
  const strength = c.s[0];
  return {
    ok: true,
    character: {
      kind: CHAR_KIND, v: CHAR_VERSION, exported: Date.now(), from: null, note: null,
      history: { ...newHistory(), sessions: c.h[0], panics: c.h[1], critFails: c.h[2] },
      pc: {
        name: c.n, cls: c.c, level: c.l, xp: c.x,
        stats: { strength, speed: c.s[1], intellect: c.s[2], combat: c.s[3] },
        saves: { sanity: c.v4[0], fear: c.v4[1], body: c.v4[2], armor: c.v4[3] },
        stress: c.st, resolve: c.r, credits: c.cr,
        skills: c.sk, items: c.it, conditions: c.cd,
        trinket: c.t, patch: c.pa,
        maxHealth: Math.max(1, strength * 2), health: Math.max(1, strength * 2),
        maxWounds: 2, alive: true,
      },
    },
  };
}
