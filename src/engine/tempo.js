/* ============================================================
   TEMPO — the brakes.

   The engine was fast and correct and completely unable to be
   slowed down. The serial queue in useHost stops two phones
   corrupting the world in the same tick; it does nothing about
   four phones firing four world-moving intents in four seconds,
   each producing three feed lines, while the Warden is still
   answering the first one. That is not a netcode problem. It is
   the absence of the thing a GM does with a raised hand.

   Four brakes live here, weakest to strongest:

     RATE     a per-player cooldown. Off by default; a house rule
              for tables that stampede, costing the Warden no
              attention at all.
     SCENE    out-of-combat spotlight rounds. One player's world
              moves at a time, in an order everyone can see, and
              the others queue rather than being refused.
     HELD     the master pause. Nothing runs. Phones go quiet and
              say why. Release drains the queue in arrival order.
     BREATHER a declared break. Clocks stop, the table screen
              dims, nobody's buttons work and that is the point.

   All four are read by one function, `tempoVerdict`, which
   decideIntent consults before anything else. They are all plain
   fields on the world, which means they are in every snapshot,
   survive a save, and can be reasoned about here without a DOM.

   Nothing in this file generates language. `buildRecap` is a
   template over structured feed events — it counts deaths and
   names rooms; it does not write prose.
   ============================================================ */

/** Everything off. A world restored from a save predating tempo
    has no `tempo` key at all, so every read goes through tempoOf. */
export const DEFAULT_TEMPO = {
  held: false,
  heldWhy: null,
  scene: null,        // { order: [pcId], idx, round, label }
  situation: null,    // the pinned one-line statement
  breather: null,     // { since }
  rateMs: 0,          // 0 = off
  lastRecapAt: 0,     // feed id of the last recap, for "since"
};

export function tempoOf(w) {
  return { ...DEFAULT_TEMPO, ...((w && w.tempo) || {}) };
}

/* ============================================================
   SCENE TURNS
   ============================================================ */

/** Everyone still standing, in crew order. Deliberately not sorted
    by anything clever: the order players see on the table is the
    order they already know. */
export function makeScene(crew, label) {
  const order = (crew || [])
    .filter((c) => c.alive !== false && !c.unconscious)
    .map((c) => c.id);
  return { order, idx: 0, round: 1, label: label || null };
}

/** Whose go is it? Null when no scene is running. */
export function sceneHolder(t) {
  if (!t || !t.scene || !t.scene.order.length) return null;
  return t.scene.order[t.scene.idx] || null;
}

/** Next in the ring, wrapping into a new round. */
export function sceneNext(scene) {
  if (!scene || !scene.order.length) return scene;
  const idx = scene.idx + 1;
  if (idx >= scene.order.length) return { ...scene, idx: 0, round: scene.round + 1 };
  return { ...scene, idx };
}

/** Drop somebody to the end of the round without ending it. The
    out-of-combat twin of holding your initiative. */
export function scenePass(scene, pcId) {
  if (!scene || !scene.order.includes(pcId)) return scene;
  const rest = scene.order.filter((id) => id !== pcId);
  const at = Math.min(scene.idx, rest.length);
  return { ...scene, order: [...rest, pcId], idx: at };
}

/** Someone joined or died mid-scene. Keeps whoever is acting acting. */
export function sceneReconcile(scene, crew) {
  if (!scene) return scene;
  const alive = new Set((crew || [])
    .filter((c) => c.alive !== false && !c.unconscious)
    .map((c) => c.id));
  const holder = scene.order[scene.idx];
  const order = scene.order.filter((id) => alive.has(id));
  for (const c of crew || []) {
    if (alive.has(c.id) && !order.includes(c.id)) order.push(c.id);
  }
  if (!order.length) return null;
  const idx = order.indexOf(holder);
  return { ...scene, order, idx: idx === -1 ? Math.min(scene.idx, order.length - 1) : idx };
}

/** How far away is my go? 0 = now, 1 = next, -1 = not in this scene.
    This is the number the phone turns into "You're up after Riley". */
export function scenePosition(t, pcId) {
  if (!t || !t.scene || !t.scene.order.length) return -1;
  const i = t.scene.order.indexOf(pcId);
  if (i === -1) return -1;
  const n = t.scene.order.length;
  return (i - t.scene.idx + n) % n;
}

/** The person immediately before me in the ring — the one whose
    finish is my cue. */
export function scenePredecessor(t, pcId) {
  if (!t || !t.scene) return null;
  const i = t.scene.order.indexOf(pcId);
  if (i <= -1) return null;
  const n = t.scene.order.length;
  if (n < 2) return null;
  return t.scene.order[(i - 1 + n) % n];
}

/* ============================================================
   THE GATE
   ============================================================ */

/** Things a brake must never stop. Reading a handout, writing on
    the board, taking something handed to you and answering a
    prompt addressed to you are not world-moving turns — holding
    them makes the pause feel like a crash rather than a pause. */
export const TEMPO_FREE = new Set([
  "resolvePending", "applyLevel",
  "pinClue", "unpinClue", "setClueResolved", "linkClues", "unlinkClues",
  "addMark", "removeMark",
  "acceptTrade", "declineTrade",
  "readHandout",
]);

/**
 * Should this intent hold, and why? Returns null to proceed, or
 * `{ wait: reason }`. The reason travels to the phone so the strip
 * can say something true instead of going grey.
 *
 * Strongest brake wins, so a held table stays held even mid-scene.
 */
export function tempoVerdict({ w, action, pcId, now = Date.now(), lastActed = {} }) {
  if (TEMPO_FREE.has(action)) return null;
  const t = tempoOf(w);

  if (t.breather) return { wait: "breather" };
  if (t.held) return { wait: "held" };

  const holder = sceneHolder(t);
  if (holder && holder !== pcId) return { wait: "scene" };

  if (t.rateMs > 0) {
    const last = lastActed[pcId] || 0;
    if (now - last < t.rateMs) return { wait: "rate" };
  }

  return null;
}

/** Player-facing text for a hold. The phone owns the wording of its
    own strip, but the Warden's "waiting on" panel wants the same
    vocabulary, so it lives here rather than in either component. */
export const WAIT_TEXT = {
  held: "The Warden is speaking.",
  breather: "The table is taking five.",
  scene: "Someone else has the room.",
  rate: "Give it a second.",
  roll: "Waiting on a roll.",
};

/* ============================================================
   RECAP — "Previously on…"

   Template over structured events. Every line is assembled from
   fields the engine already set: a kind, a room id, a name. There
   is no model here and nothing is invented; if the feed does not
   say it, the recap cannot.
   ============================================================ */

/** Feed kinds worth remembering a week later, and how to say so. */
const RECAP_RULES = [
  { kinds: ["death"], bucket: "deaths" },
  { kinds: ["panic"], bucket: "panics" },
  { kinds: ["handout"], bucket: "finds" },
  { kinds: ["beat"], bucket: "beats" },
  { kinds: ["end"], bucket: "endings" },
];

const bucketOf = (kind) => {
  for (const r of RECAP_RULES) if (r.kinds.includes(kind)) return r.bucket;
  return null;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Build a recap card from the feed since a given point.
 * Returns { title, lines: [string], from, to } — never null, so the
 * Warden always gets a card even if it says nothing happened.
 */
export function buildRecap({ feed = [], crew = [], mod, w, sinceId = 0 }) {
  const recent = feed.filter((l) => (l.id || 0) > sinceId && !l.wardenOnly);

  const found = new Set();
  const beats = [];
  const deaths = [];
  const panics = new Set();
  let endings = 0;

  for (const line of recent) {
    const b = bucketOf(line.kind);
    if (b === "finds" && line.handout) found.add(line.handout);
    else if (b === "beats" && line.text) beats.push(line.text);
    else if (b === "deaths" && line.text) deaths.push(line.text);
    else if (b === "panics" && line.pcId) panics.add(line.pcId);
    else if (b === "endings") endings += 1;
  }

  const rooms = [...new Set(recent.filter((l) => l.kind === "room" && l.room).map((l) => l.room))];
  const nameOf = (id) => {
    const pc = (crew || []).find((c) => c.id === id);
    return (pc && pc.name) || null;
  };

  const lines = [];

  if (beats.length) lines.push(...beats.slice(-3));

  if (rooms.length) {
    const names = rooms
      .map((id) => (mod && mod.rooms[id] && mod.rooms[id].name) || id)
      .slice(-4);
    lines.push(`Been through: ${names.join(", ")}.`);
  }

  if (found.size) {
    const labels = [...found]
      .map((id) => (mod && mod.handouts[id] && mod.handouts[id].label) || id)
      .slice(0, 4);
    lines.push(`Turned up: ${labels.join(" · ")}.`);
  }

  if (panics.size) {
    const who = [...panics].map(nameOf).filter(Boolean);
    lines.push(who.length ? `Panicked: ${who.join(", ")}.` : `${plural(panics.size, "panic", "panics")}.`);
  }

  for (const d of deaths.slice(-3)) lines.push(d);

  const clocks = Object.entries((w && w.countdowns) || {});
  if (clocks.length) {
    lines.push(`On the clock: ${clocks.map(([id, c]) => `${id.toUpperCase()} ${c.left}m`).join(" · ")}.`);
  }

  const alive = (crew || []).filter((c) => c.alive !== false).length;
  if (crew && crew.length) {
    lines.push(`${plural(alive, "still standing", "still standing")} of ${crew.length}.`);
  }

  if (endings) lines.push("The job ended.");
  if (!lines.length) lines.push("Nothing worth writing down yet.");

  return {
    title: (mod && mod.title) || "Previously",
    lines,
    from: sinceId,
    to: feed.length ? feed[feed.length - 1].id || 0 : sinceId,
  };
}

/* ============================================================
   INITIATIVE EDITING (#4 lives here so it is testable)

   combat.order is a plain array of { side, id }. Everything the
   editor does is an array move, plus one rule: whoever is acting
   stays acting unless they were the one moved.
   ============================================================ */

/** Move the entry at `from` to `to`, keeping turnIndex pointing at
    the same actor it pointed at before. */
export function reorderInitiative(combat, from, to) {
  if (!combat || !combat.order) return combat;
  const order = [...combat.order];
  if (from < 0 || from >= order.length || to < 0 || to >= order.length) return combat;
  const acting = order[combat.turnIndex];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  const turnIndex = Math.max(0, order.indexOf(acting));
  return { ...combat, order, turnIndex };
}

/** Drop this actor to the end of the round. Their turn is not spent,
    it is deferred — which is the thing every table does by hand. */
export function holdInitiative(combat, index) {
  if (!combat || !combat.order || index < 0 || index >= combat.order.length) return combat;
  return reorderInitiative(combat, index, combat.order.length - 1);
}

/** Take somebody out of the order entirely for this fight. */
export function dropFromInitiative(combat, index) {
  if (!combat || !combat.order || index < 0 || index >= combat.order.length) return combat;
  const acting = combat.order[combat.turnIndex];
  const order = combat.order.filter((_, i) => i !== index);
  if (!order.length) return { ...combat, order, turnIndex: 0 };
  const at = order.indexOf(acting);
  return { ...combat, order, turnIndex: at === -1 ? Math.min(combat.turnIndex, order.length - 1) : at };
}

/** Slot a fresh actor in immediately after whoever is acting — the
    thing that walks through the door on round three. */
export function insertIntoInitiative(combat, entry, at) {
  if (!combat || !combat.order) return combat;
  const order = [...combat.order];
  const where = at == null ? combat.turnIndex + 1 : at;
  order.splice(Math.max(0, Math.min(order.length, where)), 0, entry);
  const turnIndex = combat.turnIndex + (where <= combat.turnIndex ? 1 : 0);
  return { ...combat, order, turnIndex };
}
