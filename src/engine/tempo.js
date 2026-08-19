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
  /* `cost` is the round's time ledger — see THE COST OF A ROUND
     below. It starts empty and is settled when the ring wraps. */
  return { order, idx: 0, round: 1, label: label || null, cost: {}, jumped: [], lanes: null };
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
  // A new round returns everybody's reaction. See JUMPING IN below.
  if (idx >= scene.order.length) return { ...scene, idx: 0, round: scene.round + 1, jumped: [] };
  return { ...scene, idx };
}

/* ============================================================
   JUMPING IN

   `scenePass` defers you to the end of the ring. There was no
   inverse — no way to say "I want to react to what Riley just
   did" and be slotted in next — even though `insertIntoInitiative`
   has done exactly that for combat since the beginning.

   Two things are missing without it, and they are the same thing
   viewed from either end. At six players the ring is a four-minute
   cycle, which is a long time to hold a phone while the thing you
   wanted to say stops being relevant. And in the fiction, the
   defining moment of a horror game is *something happens and you
   react* — every interaction in the engine was initiated, never
   responsive.

   The rules are deliberately tight, because "act next" is a
   privilege and an unlimited one would simply replace the ring:

     · you may not jump the person currently holding the room —
       you are reacting to them, so they finish
     · you are slotted immediately *after* them, not instead of
       them
     · once per round per player. A crew where everyone jumps in
       has no order at all, which is the state the scene ring
       exists to leave behind.

   `jumped` is a plain array on the scene, so it snapshots, saves
   and clears itself when the ring wraps.
   ============================================================ */

/** Can this player still claim a reaction this round? */
export function canJumpIn(t, pcId) {
  if (!t || !t.scene || !pcId) return false;
  const s = t.scene;
  if (!s.order.includes(pcId)) return false;
  if (s.order[s.idx] === pcId) return false;              // already holding it
  if ((s.jumped || []).includes(pcId)) return false;       // one per round
  return true;
}

/** Slot this player in immediately after whoever is acting. */
export function sceneJumpIn(scene, pcId) {
  if (!scene || !scene.order.includes(pcId)) return scene;
  const holder = scene.order[scene.idx];
  if (holder === pcId) return scene;
  const rest = scene.order.filter((id) => id !== pcId);
  const at = rest.indexOf(holder);
  if (at === -1) return scene;
  const order = [...rest.slice(0, at + 1), pcId, ...rest.slice(at + 1)];
  return {
    ...scene,
    order,
    idx: order.indexOf(holder),
    jumped: [...(scene.jumped || []), pcId],
  };
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
   LANES — one ring per room, for a split party.

   The scene ring is a single strict round-robin, and while the
   crew is together that is exactly right. Once they are in two
   places it charges them for a shared spotlight they are not
   sharing: Riley in the mine waits for Dana in the mess, and
   their actions genuinely do not interact. At six players that is
   a four-minute cycle in which two thirds of the table is waiting
   on events they cannot see.

   So when the party is split, the order is *grouped by room* and
   one holder runs per room. Two things make this safe rather than
   merely faster:

     · The cost ledger already settles per round at max() across
       everybody, so parallel lanes do not change what the round
       costs the fiction — four people in two rooms still advance
       the clock by the longest single thing any of them did. The
       time maths was already parallel; only the *spotlight* was
       serial.

     · A lane is derived, never stored as a second source of
       truth. `order` remains the one list, `sceneReconcile`
       remains the one place membership changes, and lanes are
       recomputed from crew positions on every read. A crew that
       walks back into one room silently becomes one ring again.

   Rooms are sorted for stability so the lane order does not
   shuffle under the Warden between renders.
   ============================================================ */

/** roomId -> [pcId] for everyone in the ring, in ring order. */
export function sceneLanes(t, crew, w) {
  if (!t || !t.scene || !t.scene.order.length) return null;
  const where = (id) => {
    const c = (crew || []).find((x) => x.id === id);
    if (!c) return null;
    return c.room || (w && w.room) || null;
  };
  const lanes = new Map();
  for (const id of t.scene.order) {
    const room = where(id) || "__nowhere";
    if (!lanes.has(room)) lanes.set(room, []);
    lanes.get(room).push(id);
  }
  return lanes;
}

/** Is the ring currently running in more than one place? */
export function laneSplit(t, crew, w) {
  const lanes = sceneLanes(t, crew, w);
  return !!lanes && lanes.size > 1;
}

/**
 * Everyone who may act right now: one holder per room.
 *
 * With the crew together this returns exactly `[sceneHolder(t)]`
 * and nothing about the existing behaviour changes — which is the
 * property that made this safe to add. It only widens when the
 * party has actually come apart.
 *
 * The holder of each lane is the member of that lane who appears
 * soonest in the ring starting from `idx`, so the global order is
 * still what decides who goes first within a room, and a player
 * who has just acted still goes to the back of their own lane.
 */
export function sceneHolders(t, crew, w) {
  if (!t || !t.scene || !t.scene.order.length) return [];
  const lanes = sceneLanes(t, crew, w);
  if (!lanes || lanes.size <= 1) {
    const one = sceneHolder(t);
    return one ? [one] : [];
  }
  const order = t.scene.order;
  const n = order.length;
  const rank = new Map(order.map((id, i) => [id, (i - t.scene.idx + n) % n]));
  const out = [];
  for (const room of [...lanes.keys()].sort()) {
    const members = lanes.get(room);
    if (!members.length) continue;
    out.push(members.reduce((a, b) => (rank.get(a) <= rank.get(b) ? a : b)));
  }
  return out;
}

/** May this player act, accounting for lanes? */
export function laneHolds(t, pcId, crew, w) {
  const holders = sceneHolders(t, crew, w);
  if (!holders.length) return false;
  return !holders.includes(pcId);
}

/* ============================================================
   THE COST OF A ROUND

   Time was charged per action against one shared clock. Six
   players each searching a ten-minute feature cost the fiction
   sixty minutes for a single table round. Ypsilon 14 is a
   four-hour stop with a shift bell at 240: four rounds and the
   window is gone, having represented perhaps ten minutes of real
   play. The scene structure gated *who* acted; it did nothing
   about *what it cost*.

   What actually happens at a table when four people search four
   corners of the same room is that it takes as long as the
   slowest of them. So while a round is running, each player's
   minutes accrue against their own name, and when the ring wraps
   the clock moves once, by the largest of them.

   Three consequences worth being explicit about:

     · A player's own actions still SUM. Searching two lockers
       takes twice as long as searching one. It is only across
       people that time is parallel, because they are.

     · Nothing ticks mid-round. Countdowns, module clocks and
       onTick all hang off `advance`, so the world holds still
       until the round settles and then moves once. That is
       correct — the fiction's clock has not moved either — and
       it is the reason the reactor no longer empties while four
       people take one beat each.

     · The ledger is a plain object on the scene, which is on the
       world, which is in every snapshot. Phones can show a
       player what their go has cost so far without a new message
       type, and it survives a save.

   Rest, travel and anything the Warden pushes through by hand
   are charged immediately — see `advance`'s `now` option in
   useGame. Sleeping for six hours is not something the other
   five people are doing in parallel.
   ============================================================ */

/** Add minutes to one player's share of the current round. */
export function sceneCharge(scene, pcId, mins) {
  if (!scene || !pcId || !mins) return scene;
  const cost = { ...(scene.cost || {}) };
  cost[pcId] = (cost[pcId] || 0) + mins;
  return { ...scene, cost };
}

/** What the round has cost so far: the longest thing anyone did. */
export function sceneCost(scene) {
  const cost = (scene && scene.cost) || {};
  const values = Object.values(cost);
  return values.length ? Math.max(...values) : 0;
}

/** One player's own share of the round, for their phone. */
export const sceneSpent = (t, pcId) =>
  (t && t.scene && t.scene.cost && t.scene.cost[pcId]) || 0;

/** Close the ledger. Returns the minutes to charge and a scene with
    an empty one. Safe to call on a scene that cost nothing. */
export function sceneSettle(scene) {
  const mins = sceneCost(scene);
  if (!scene) return { scene, mins: 0 };
  return { scene: { ...scene, cost: {} }, mins };
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
export function tempoVerdict({ w, action, pcId, now = Date.now(), lastActed = {}, crew = null }) {
  if (TEMPO_FREE.has(action)) return null;
  const t = tempoOf(w);

  if (t.breather) return { wait: "breather" };
  if (t.held) return { wait: "held" };

  /* One holder per room once the party has split — see LANES above.
     `crew` is optional so every existing caller keeps the old
     single-ring behaviour rather than silently changing meaning;
     the host passes it, and that is where six players in two rooms
     stop queueing behind each other. */
  if (crew) {
    if (t.scene && laneHolds(t, pcId, crew, w)) return { wait: "scene" };
  } else {
    const holder = sceneHolder(t);
    if (holder && holder !== pcId) return { wait: "scene" };
  }

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
