/* ============================================================
   LORE INDEX — the dossier as a surface rather than a document.

   `docs/YPSILON14_WARDEN_DOSSIER.md` is 174 lines of genuinely
   good preparation that a Warden has to read in a second window,
   and `modules/ypsilon14/lore.js` is 320 more — "everything the
   table will ask you and the module never says out loud". Both
   were written to be consulted mid-scene. Neither could be.

   The problem is not that the material is missing from the app.
   It is that a nested object is not a thing you can look
   something up in while a player is waiting for an answer. What a
   Warden does at that moment is not browse — they have a word in
   mind. "Water." "Kantaro." "The pod."

   So: flatten the tree into entries with a path, a title and a
   body, and match a query against all three. Deliberately naive
   matching — substring, case-folded, all terms must appear
   somewhere in the entry. No stemming, no ranking cleverness, no
   index to keep in sync. A Warden typing "kant" wants every line
   with Kantaro in it and wants it before they have finished
   typing, and a fuzzy matcher that returns Sonya because she is
   thematically adjacent is worse than nothing.

   Pure. Given a module it returns the same array, so it can be
   memoised on the module and never recomputed.
   ============================================================ */

/** Keys whose contents are prose to be read rather than structure
    to be walked into. Used only for labelling. */
const PRETTY = {
  public: "what anyone will tell you",
  private: "if they like you, or once they are frightened",
  secret: "they will not tell you",
  summary: "in short",
  note: "note",
  brief: "brief",
};

const titleCase = (k) =>
  String(k).replace(/[_:]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();

/**
 * Walk any plain object/array tree into flat entries.
 * @returns {Array<{ id, path, title, label, body }>}
 */
export function flattenLore(node, path = [], out = [], seen = new Set()) {
  if (node == null) return out;

  if (typeof node === "string" || typeof node === "number") {
    const text = String(node).trim();
    if (!text) return out;
    const key = path[path.length - 1];
    out.push({
      id: path.join("."),
      path: path.slice(),
      title: path.slice(0, -1).map(titleCase).join(" · ") || titleCase(key),
      label: PRETTY[key] || titleCase(key),
      body: text,
    });
    return out;
  }

  if (typeof node !== "object") return out;
  // Cycles are not expected in a module's lore, but a module is a
  // file somebody edits and an infinite walk is a hung Warden screen.
  if (seen.has(node)) return out;
  seen.add(node);

  if (Array.isArray(node)) {
    node.forEach((v, i) => flattenLore(v, [...path, String(i + 1)], out, seen));
    return out;
  }

  for (const [k, v] of Object.entries(node)) flattenLore(v, [...path, k], out, seen);
  return out;
}

/** Everything in the module worth looking up mid-scene: its lore
    tree, plus the Warden-facing material that lives elsewhere. */
export function loreIndex(mod) {
  if (!mod) return [];
  const out = [];
  flattenLore(mod.lore || {}, [], out);
  flattenLore(
    {
      running: {
        setting: (mod.warden || {}).setting,
        voice: (mod.warden || {}).voice,
        constraints: (mod.warden || {}).constraints,
        cast: (mod.warden || {}).npcNote,
      },
    },
    [], out,
  );
  // Each NPC's own script, so "what does Sonya know about the
  // shower" is one search rather than two screens.
  for (const id of mod.npcOrder || []) {
    const n = mod.npcs[id];
    if (!n) continue;
    flattenLore(
      { [n.name]: { brief: n.brief, note: n.note, persona: n.persona, knows: n.knows } },
      ["cast"], out,
    );
  }
  return out;
}

/** All terms must appear somewhere in the entry. Blunt on purpose —
    see the header. */
export function searchLore(entries, query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    const hay = `${e.title} ${e.label} ${e.body} ${e.path.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/** The top-level sections, for browsing when there is no word in
    mind yet. */
export function loreSections(entries) {
  const out = [];
  for (const e of entries) {
    const top = e.path[0];
    if (top && !out.includes(top)) out.push(top);
  }
  return out;
}
