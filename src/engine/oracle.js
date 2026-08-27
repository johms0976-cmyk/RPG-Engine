/* ============================================================
   THE OFFLINE WARDEN

   There is no language model here and no network call. Everything
   the Warden says is produced from three local systems:

   1. A COMMAND PARSER. Most of what a player types is a real
      action against something the module already describes - a
      door, a feature, an item, a person. The parser matches the
      sentence against the room and routes it to the same code the
      buttons use. This handles the large majority of input, and
      handles it correctly, which an LLM does not.

   2. AN ORACLE. When the player asks a question the module has no
      answer for, we roll on a yes/no oracle weighted by how likely
      the thing is, in the tradition of solo play. It can also
      throw a complication.

   3. AN ATMOSPHERE ENGINE. Sensory lines assembled from fragment
      pools keyed to the room's tags, so "look around" in a vented
      industrial space reads differently to a medbay. Modules add
      their own pools; the engine ships a generic set.

   A seeded PRNG lives in world state, so a saved game replays its
   own atmosphere identically and the same line does not come up
   twice in a row.
   ============================================================ */

/* ---------------- seeded RNG (mulberry32) ---------------- */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedFrom = (s) => {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** Pick from a list, avoiding the last thing picked from that pool. */
export function pickFresh(list, rng, memory, key) {
  if (!list || !list.length) return null;
  if (list.length === 1) return list[0];
  const last = memory[key];
  let choice, guard = 0;
  do { choice = list[Math.floor(rng() * list.length)]; } while (choice === last && ++guard < 8);
  memory[key] = choice;
  return choice;
}

/* ---------------- 1. COMMAND PARSER ---------------- */

const VERBS = {
  look: ["look", "l", "examine", "x", "inspect", "study", "read", "check", "observe", "watch", "view"],
  search: ["search", "rummage", "rifle", "ransack", "loot", "dig", "forage"],
  go: ["go", "walk", "move", "head", "enter", "exit", "leave", "travel", "climb", "crawl", "run"],
  take: ["take", "get", "grab", "pick", "collect", "pocket", "steal"],
  use: ["use", "activate", "operate", "apply", "turn", "switch", "press", "push", "pull", "open", "close", "toggle"],
  talk: ["talk", "speak", "ask", "say", "tell", "question", "greet", "shout", "call", "yell"],
  attack: ["attack", "hit", "shoot", "fire", "stab", "kill", "strike", "swing", "fight"],
  wait: ["wait", "rest", "sleep", "pause", "listen", "stop", "hold"],
  hide: ["hide", "conceal", "duck", "crouch", "sneak", "stealth"],
  inventory: ["inventory", "i", "gear", "kit", "carrying", "equipment"],
  help: ["help", "commands", "?", "what can i do"],
};

/* ------------------------------------------------------------
   DIRECTIONS

   Exit labels in every shipped module lead with a direction —
   "Aft \u2192 Galley", "Down \u2192 Engine Bay", "Out \u2192 The Umbilical".
   Direction words were previously stopwords, so they were stripped
   before matching and typing one could never select an exit: every
   direction became "Which one?" against the full list. They are
   held out of STOPWORDS here and matched ahead of fuzzy scoring in
   the `go` branch below.
   ------------------------------------------------------------ */
export const DIRECTIONS = new Set([
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest",
  "up", "down", "in", "out", "on", "back", "forward", "fore", "aft", "port", "starboard",
  "left", "right", "inside", "outside", "ahead", "onward", "onwards", "deeper",
  "upstairs", "downstairs", "above", "below", "over", "under", "through", "across",
]);

const STOPWORDS = new Set([
  "the", "a", "an", "at", "to", "with", "into", "onto", "of", "for",
  "my", "your", "his", "her", "it", "its", "this", "that", "some", "and", "then",
  "i", "im", "am", "is", "are", "do", "does", "can", "could", "would", "should",
  "around", "about",
]);

/* Verbs that are a whole command on their own. `i` is the killer:
   it is both the inventory shorthand and the first word of most
   sentences a player types, so "I open the hatch" used to come back
   as a list of the character's pockets. */
const SOLO_VERBS = new Set(["i", "?"]);

/* Words that mean "what am I carrying" wherever they appear in the
   sentence, so "I check my pockets" is not read as LOOK. */
const INVENTORY_WORDS = new Set(["inventory", "pockets", "carrying", "backpack", "knapsack"]);

export const tokenise = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);

const contentWords = (toks) => toks.filter((t) => !STOPWORDS.has(t) || DIRECTIONS.has(t));

function verbOf(toks) {
  for (const t of toks) {
    if (SOLO_VERBS.has(t) && toks.length > 1) continue;
    for (const [verb, words] of Object.entries(VERBS)) if (words.includes(t)) return verb;
  }
  return null;
}

/** How well does a phrase match a candidate name? 0..1 */
export function matchScore(words, name) {
  const target = tokenise(name);
  if (!target.length || !words.length) return 0;
  let hits = 0;
  for (const w of words) {
    if (w.length < 3 && !DIRECTIONS.has(w)) continue;
    if (target.some((t) => t === w || t.startsWith(w) || w.startsWith(t))) hits++;
  }
  return hits / Math.max(1, Math.min(words.length, target.length));
}

/** The exit whose LABEL leads with a direction the player typed.
    Only when exactly one exit does, so "aft" in a room with two aft
    doorways still asks which one. */
function exitForDirection(toks, exits) {
  const dirs = toks.filter((t) => DIRECTIONS.has(t));
  if (!dirs.length) return null;
  const hits = exits.filter((e) => {
    const lead = tokenise(e.name)[0];
    return lead && dirs.includes(lead);
  });
  return hits.length === 1 ? hits[0] : null;
}

function bestMatch(words, candidates) {
  let best = null, score = 0;
  for (const c of candidates) {
    const s = Math.max(matchScore(words, c.name), c.alt ? matchScore(words, c.alt) : 0);
    if (s > score) { score = s; best = c; }
  }
  return score >= 0.34 ? { ...best, score } : null;
}

/**
 * Turn free text into an intent the engine can execute.
 * @returns {{kind:string, ...}} kind is one of:
 *   look | lookAt | search | move | take | use | talk | attack |
 *   rest | listen | hide | inventory | help | oracle | unknown
 */
export function parseCommand(text, ctx) {
  const { mod, world, pc, items } = ctx;
  const toks = tokenise(text);
  if (!toks.length) return { kind: "unknown" };
  const verb = verbOf(toks);
  const words = contentWords(toks);
  const room = mod.rooms[world.room];

  /* candidate nouns in scope */
  const features = Object.entries(room.features || {}).map(([k, f]) => ({ key: k, name: f.name, type: "feature" }));
  const exits = (room.exits || [])
    .filter((e) => !e.hidden || world.flags[e.hidden])
    .map((e, i) => ({ key: i, name: e.label || (mod.rooms[e.to] ? mod.rooms[e.to].name : String(e.to)), alt: mod.rooms[e.to] ? mod.rooms[e.to].name : "", type: "exit", exit: e }));
  const held = (pc ? pc.items : []).map((id) => ({ key: id, name: items[id] ? items[id].n : id, type: "item" }));
  const here = (ctx.npcsHere || []).map((id) => ({ key: id, name: mod.npcs[id].name, alt: mod.npcs[id].role, type: "npc" }));
  const foes = (ctx.enemiesHere || []).map((e) => ({ key: e.uid, name: e.name, type: "enemy" }));

  /* explicit verbs first */
  if (toks.some((t) => INVENTORY_WORDS.has(t))
    && (toks.length <= 2 || toks.includes("my") || toks.includes("i") || toks.includes("own"))) {
    return { kind: "inventory" };
  }
  if (verb === "inventory") return { kind: "inventory" };
  if (verb === "help") return { kind: "help" };
  if (verb === "hide") return { kind: "hide" };

  if (verb === "wait") {
    if (toks.includes("listen")) return { kind: "listen" };
    if (toks.includes("rest") || toks.includes("sleep")) return { kind: "rest" };
    return { kind: "wait" };
  }

  if (verb === "attack") {
    const m = bestMatch(words, foes.concat(here));
    return { kind: "attack", target: m };
  }

  if (verb === "talk") {
    const m = bestMatch(words, here);
    if (m) return { kind: "talk", npc: m.key, text };
    if (here.length === 1) return { kind: "talk", npc: here[0].key, text };
    if (!here.length) return { kind: "oracle", question: text, reason: "nobody here" };
    return { kind: "ambiguous", options: here };
  }

  if (verb === "go") {
    /* A direction the player typed beats fuzzy scoring. "Down" picks
       the exit LABELLED down even when two other exits happen to
       share a word with it. */
    const d = exitForDirection(toks, exits);
    if (d) return { kind: "move", exit: d.exit };
    const m = bestMatch(words, exits);
    if (m) return { kind: "move", exit: m.exit };
    if (exits.length === 1) return { kind: "move", exit: exits[0].exit };
    return { kind: "ambiguous", options: exits, hint: "which way" };
  }

  if (verb === "take") {
    const m = bestMatch(words, features);
    if (m) return { kind: "search", feature: m.key };
    /* "Take the manifest" when the manifest is INSIDE something. The
       player names the prize rather than the container, which is what
       people do, and the module already knows which feature holds it. */
    const inside = Object.entries(room.features || {}).flatMap(([k, f]) =>
      (f.gives || []).map((id) => ({ key: k, name: items[id] ? items[id].n : id, type: "feature" })));
    const g = bestMatch(words, inside);
    if (g) return { kind: "search", feature: g.key };
    return { kind: "oracle", question: text, reason: "nothing like that to take" };
  }

  if (verb === "search") {
    const m = bestMatch(words, features);
    if (m) return { kind: "search", feature: m.key };
    if (features.length === 1) return { kind: "search", feature: features[0].key };
    return { kind: "searchRoom" };
  }

  if (verb === "use") {
    const m = bestMatch(words, held.concat(features).concat(exits));
    if (m && m.type === "item") return { kind: "use", item: m.key };
    if (m && m.type === "feature") return { kind: "search", feature: m.key };
    if (m && m.type === "exit") return { kind: "move", exit: m.exit };
    return { kind: "oracle", question: text, reason: "nothing like that to use" };
  }

  if (verb === "look") {
    const m = bestMatch(words, features.concat(held).concat(here).concat(foes));
    if (!m || !words.length) return { kind: "look" };
    if (m.type === "feature") return { kind: "search", feature: m.key };
    if (m.type === "item") return { kind: "lookAt", item: m.key };
    if (m.type === "npc") return { kind: "lookAt", npc: m.key };
    if (m.type === "enemy") return { kind: "lookAt", enemy: m.key };
    return { kind: "look" };
  }

  /* no verb - a bare direction is a move before it is anything else */
  const bare = exitForDirection(toks, exits);
  if (bare) return { kind: "move", exit: bare.exit };

  /* then try to infer from the noun alone */
  const anyMatch = bestMatch(words, features.concat(exits).concat(held).concat(here).concat(foes));
  if (anyMatch) {
    if (anyMatch.type === "feature") return { kind: "search", feature: anyMatch.key };
    if (anyMatch.type === "exit") return { kind: "move", exit: anyMatch.exit };
    if (anyMatch.type === "item") return { kind: "use", item: anyMatch.key };
    if (anyMatch.type === "npc") return { kind: "talk", npc: anyMatch.key, text };
    if (anyMatch.type === "enemy") return { kind: "attack", target: anyMatch };
  }

  return { kind: "oracle", question: text, reason: "not something the module knows about" };
}

/* ---------------- 2. THE ORACLE ---------------- */

export const ODDS = {
  certain: 90, likely: 75, even: 50, unlikely: 25, impossible: 10,
};

const YES_LINES = [
  "Yes. It is exactly as you thought.",
  "Yes - and it is worse than that.",
  "Yes, though it takes a moment to be sure.",
  "Yes. Nothing about that is in doubt.",
];
const NO_LINES = [
  "No. Not here, not now.",
  "No - and something about the asking makes you uneasy.",
  "No. You look twice and it is still no.",
  "There is nothing of the kind.",
];
const COMPLICATIONS = [
  "Something moved while you were checking.",
  "It takes longer than you meant it to.",
  "You are fairly sure you made a noise doing it.",
  "You notice you have been holding your breath.",
  "There is a mark on the floor that was not there before.",
  "Whatever you touched is warm, and should not be.",
];

/**
 * Roll the oracle. `odds` is a key of ODDS or a number 0-100.
 * @returns {{yes:boolean, exceptional:boolean, complication:string|null, line:string}}
 */
export function consultOracle(odds, rng, memory = {}) {
  const chance = typeof odds === "number" ? odds : ODDS[odds] ?? ODDS.even;
  const roll = Math.floor(rng() * 100);
  const yes = roll < chance;
  const exceptional = roll < chance / 5 || roll > 100 - (100 - chance) / 5;
  const complication = rng() < 0.2 ? pickFresh(COMPLICATIONS, rng, memory, "comp") : null;
  const line = pickFresh(yes ? YES_LINES : NO_LINES, rng, memory, yes ? "yes" : "no");
  return { yes, exceptional, complication, line, roll, chance };
}

/** Guess how likely a question is from its shape. Crude, but it reads well. */
export function guessOdds(question) {
  const q = String(question).toLowerCase();
  if (/\b(is there|are there|can i see|do i see|is it|does it)\b/.test(q)) return "even";
  if (/\b(secret|hidden|another way|escape|way out|weapon|ammo|food|water)\b/.test(q)) return "unlikely";
  if (/\b(dead|blood|broken|damaged|wrong|cold|dark|locked)\b/.test(q)) return "likely";
  return "even";
}

/* ============================================================
   WHEN THE PARSER MISSES AND THE CHARACTER SHOULD BE TESTED

   A human Warden's most frequent move, by a wide margin, is
   "roll Strength." The empty chair could not make it. Called
   rolls fire only from a module-authored `director.rolls` list,
   `safeMove` rightly refuses a roll with no stated reason, and
   `autoDirector` rightly refuses to compose sentences — so a
   player typing "I force the hatch with the crowbar" fell
   straight through to a yes/no. The world answered and the
   character never participated. Over three hours that is a table
   whose Strength scores did nothing.

   THE WAY OUT WITHOUT BREAKING INV-1: the reason does not have to
   be composed, because the player already wrote it. Quoting a
   human's own sentence back to them is not generation. So the
   reason for the save is their words, trimmed — never ours.

   The map itself is engine content, not module content: these are
   facts about English verbs, not judgements about any particular
   ship, which is exactly the line autoDirector.js draws when it
   refuses to derive `rolls` and `attacks`.
   ============================================================ */

/** Verb families that imply the character is risking something.
    Ordered most-specific first; `riskOf` takes the first hit. */
export const RISK_VERBS = [
  ["strength", /\b(forc(e|ing)|pry|prise|lever|lift|haul|heave|shove|wrench|smash|barricade|hold shut|hold back|push through|rip|tear)\b/],
  ["speed",    /\b(dodg(e|ing)|leap|jump|vault|sprint|dash|scramble|catch|outrun|duck|dive|slide under|squeeze through)\b/],
  ["intellect",/\b(hotwire|hot-wire|rewire|bypass|hack|splice|decipher|decode|jury.?rig|improvis(e|ing)|repair|patch|recalibrat(e|ing)|disarm|defus(e|ing))\b/],
  ["combat",   /\b(tackl(e|ing)|wrestl(e|ing)|grappl(e|ing)|disarm them|pin|choke)\b/],
];

/** Saves rather than stats — the ones that are about enduring
    something rather than doing something. Checked first because
    "hold my nerve" is a Fear save, not a Strength check. */
export const RISK_SAVES = [
  ["fear",   /\b(steady myself|hold my nerve|keep calm|steel myself|look anyway|face it|don'?t look|stay calm)\b/],
  ["body",   /\b(endure|stomach|hold my breath|push through the pain|resist|brace|tough it out|wade through)\b/],
  ["sanity", /\b(make sense of|comprehend|understand what|process what|rationalis|rationaliz)\b/],
];

/**
 * Does this unparsed sentence describe the character risking
 * something? Returns the check to call, or null to leave it to
 * the oracle alone.
 *
 * Conservative on purpose. A false positive turns a throwaway
 * line into a test the player did not ask for, which is worse
 * than the status quo; a false negative just leaves things
 * exactly as they were.
 *
 * @returns {{stat:string, save:boolean, reason:string}|null}
 */
export function riskOf(text) {
  const q = String(text || "").toLowerCase().trim();
  if (!q) return null;

  /* A question is not an attempt. "can I force the door" is asking
     the oracle what is true; "I force the door" is doing it. The
     distinction matters because testing somebody for asking a
     question is the single most annoying thing a referee does. */
  if (/^(is|are|can|could|does|do|did|will|would|should|has|have|was|were|am)\b/.test(q)) return null;
  if (q.endsWith("?")) return null;

  for (const [name, re] of RISK_SAVES) if (re.test(q)) return { stat: name, save: true, reason: cleanReason(text) };
  for (const [name, re] of RISK_VERBS) if (re.test(q)) return { stat: name, save: false, reason: cleanReason(text) };
  return null;
}

/** The player's own words, tidied into something that reads on a
    prompt. Strips a leading "I" and trailing punctuation and does
    nothing else — every word that survives is theirs. */
export function cleanReason(text) {
  let s = String(text || "").trim().replace(/[.!]+$/, "");
  s = s.replace(/^(i|we)\s+(try to|attempt to|want to|am going to|'?m going to|will|would like to)\s+/i, "");
  s = s.replace(/^(i|we)\s+/i, "");
  return s.slice(0, 120);
}

/* ---------------- 3. ATMOSPHERE ---------------- */

/** Generic pools. Modules override or extend via `mod.flavour`. */
export const FLAVOUR = {
  /* Lines safe in ANY room of ANY module: no light source, no suit,
     no vacuum, nothing that assumes what the crew is wearing or
     carrying. The two that did assume those things ("in the beam of
     your light", "you can hear your own suit") lived here and turned
     up on lit, crewed, shirtsleeve bridges. They are under DARK now,
     where they are true. */
  any: [
    "The air handling changes pitch somewhere above you, and settles.",
    "A light flickers, decides against it, and holds.",
    "Something in the structure ticks as it cools.",
    "The deck plate underfoot flexes very slightly, then does not.",
  ],
  VENT: [
    "The ducting overhead carries a sound a long way and then stops carrying it.",
    "Warm air pushes down from the vent, smelling faintly of machinery.",
    "Something in the ducts settles with a sound like a held breath.",
  ],
  MEDBAY: [
    "The sterile lights hum at a frequency you can feel in your teeth.",
    "Plastic sheeting moves in the draught, slowly, like something breathing.",
    "There is a smell of disinfectant over the top of a smell of something else.",
  ],
  AIRLOCK: [
    "The seal ticks as the pressure differential works on it.",
    "Beyond the inner door there is a very large amount of nothing.",
    "Frost has formed on the inside of the port and been wiped away by a hand.",
  ],
  TERMINAL: [
    "The screen scrolls a line of maintenance log and waits.",
    "A cursor blinks in a field nobody has filled in for weeks.",
  ],
  DARK: [
    "Your light reaches about twenty metres and then simply gives up.",
    "You are aware of the size of the room only by the way sound comes back.",
    "Dust hangs in the beam of your light, moving very slowly.",
    "You can hear your own suit. Nothing else.",
  ],
  MINE: [
    "Rock dust settles on everything, including you.",
    "Somewhere below, the drills are still running on their cycle.",
    "The rock face is warmer than the air, and you do not know why.",
  ],
  QUARTERS: [
    "Somebody's things are exactly where they left them.",
    "A bunk light is still on above an empty bed.",
  ],
};

/**
 * A line of atmosphere appropriate to where the player is standing.
 * Modules contribute pools under `mod.flavour[tag] = [...]`.
 */
export function atmosphere(mod, room, rng, memory) {
  const pools = [];
  for (const tag of room.tags || []) {
    const modPool = (mod.flavour || {})[tag];
    if (modPool) pools.push(...modPool);
    if (FLAVOUR[tag]) pools.push(...FLAVOUR[tag]);
  }
  /* A module that wrote its own general pool gets its own general
     pool. The engine's six are the default for a module that wrote
     none, not a floor under every module forever — mixing them in
     meant a module could not stop the generic lines coming up. */
  if ((mod.flavour || {}).any) pools.push(...mod.flavour.any);
  if (!pools.length) pools.push(...FLAVOUR.any);
  return pickFresh(pools, rng, memory, `atmo:${room.name}`);
}

/* ---------------- NPC dialogue, offline ---------------- */

/**
 * Match what the player said against what this NPC knows.
 * Scores each `knows` entry on shared content words and returns the
 * best unused one, falling back to a deflection in character.
 */
/* ============================================================
   WHAT AN NPC HEARD YOU ASK

   The old scoring compared the first four characters of each
   word, which produced two failures that both look like the NPC
   being obtuse:

     · "water" matched "watch", "silent" matched "silence",
       "mine" matched "mind". A four-character prefix is not a
       stem, it is a truncation, and on a base where water and
       watching are both load-bearing it misfires constantly.

     · the recency bias was `(knows.length - i) * 0.05`, so with
       a ten-entry list the first entry started 0.5 ahead — which
       is exactly the `best <= 0.5` deflection threshold. Ask an
       NPC with a long script about something they have nothing
       on and they would confidently answer their first line
       instead of deflecting.

   So: a real (if small) stemmer, exact-token matching preferred
   over stem matching, an explicit `topics` array per entry when
   the module author wants to be precise, and a bias that can
   never on its own carry an entry over the threshold.

   Still no generation. An NPC cannot say anything the module did
   not authorise, which is the whole point — what Sonya does and
   does not know *is* the puzzle.
   ============================================================ */

/** Enough morphology for English nouns and verbs at table speed.
    Deliberately conservative: a stemmer that is too eager
    reintroduces exactly the collisions this replaces. */
export function stem(word) {
  let w = String(word).toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses") || w.endsWith("shes") || w.endsWith("ches")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ly") && w.length > 4) return w.slice(0, -2);
  return w;
}

/** How strongly do these words hit this entry? Exact tokens are
    worth more than stems, because "water" and "watering" being the
    same question is a guess and "water" and "water" is not. */
export function topicScore(words, entry, topics) {
  const text = typeof entry === "string" ? entry : "";
  const kw = contentWords(tokenise(`${text} ${(topics || []).join(" ")}`));
  const exact = new Set(kw);
  const stems = new Set(kw.map(stem));
  let score = 0;
  for (const w of words) {
    if (w.length < 3 && !DIRECTIONS.has(w)) continue;
    if (exact.has(w)) { score += 1; continue; }
    if (stems.has(stem(w))) score += 0.6;
  }
  return score;
}

/** Below this an answer is a coincidence rather than a reply. */
export const TOPIC_FLOOR = 0.6;

export function npcReply(npc, said, state, rng, memory) {
  const knows = npc.knows || [];
  if (!knows.length) return { line: "They have nothing for you.", topic: null };

  const words = contentWords(tokenise(said));
  const told = new Set(state.told || []);
  // A module may declare `topics: [["water","shower"], ...]` parallel
  // to `knows` when the entry's own wording does not contain the word
  // a player would actually use.
  const topics = npc.topics || [];

  let best = 0, bestIdx = null;
  knows.forEach((k, i) => {
    if (told.has(i)) return;
    const score = topicScore(words, k, topics[i]);
    if (score < TOPIC_FLOOR) return;
    /* The bias breaks ties towards the earlier, more important
       facts. It is scaled to stay well under the floor, so it can
       order two real matches but can never manufacture one. */
    const biased = score + ((knows.length - i) / Math.max(1, knows.length)) * 0.25;
    if (biased > best) { best = biased; bestIdx = i; }
  });

  // Nothing matched at all — give the next untold fact, or deflect.
  if (bestIdx == null) {
    const next = knows.findIndex((_, i) => !told.has(i));
    if (next >= 0 && rng() < 0.55) return { line: knows[next], topic: next };
    return { line: pickFresh(npc.deflections || DEFLECTIONS, rng, memory, `defl:${npc.name}`), topic: null, deflected: true };
  }
  return { line: knows[bestIdx], topic: bestIdx };
}

const DEFLECTIONS = [
  "\"I wouldn't know about that.\"",
  "\"Ask someone who gets paid to know.\"",
  "\"[doesn't look up] Not now.\"",
  "\"That's above my pay grade and I like it there.\"",
  "\"Why are you asking me that?\"",
  "\"[a pause a beat too long] No.\"",
];

/** Suggested things to say, drawn from what the NPC still has to give. */
export function suggestedTopics(npc, state, mod) {
  const told = new Set(state.told || []);
  const untold = (npc.knows || []).map((k, i) => i).filter((i) => !told.has(i));
  const base = mod.talkPrompts || [];
  return { base, remaining: untold.length };
}
