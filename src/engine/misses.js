/* ============================================================
   THE MISSES — what the table said that the module had no answer
   for.

   ------------------------------------------------------------
   THE PROBLEM THIS IS AIMED AT

   `rungListen` is the only rung that reacts to what a player
   SAID. It fires from module-authored `listeners`, and at 2.16
   there were fifteen in Ypsilon 14, fourteen in Another Bug Hunt
   and eight in Dead Weight — against the two hundred-odd reactive
   judgements a live Warden makes in the same three hours. 2.17
   added a common pack, which covers what EVERY table says. It
   cannot cover what YOUR table says about YOUR module, and that
   is the half an author has to write.

   The trouble is knowing what to write. An author guesses at what
   players will try, and guesses badly, because they already know
   what is in the module and cannot un-know it. The people who
   know are the playtesters, and the record of what they tried is
   already being kept — every sentence that reached the oracle is
   a sentence the module had no answer for.

   Nobody was reading it.

   ------------------------------------------------------------
   WHAT THIS IS

   A tally. Sentences that fell through to the oracle, grouped by
   the words they have in common, most-said first. It is a
   listener backlog generated from real play and written by
   nobody.

   THAT IS ALL IT IS. It does not write listeners, suggest
   phrasings, or rank ideas by quality. It says "four different
   people tried to do something with the vents and the module said
   nothing" and stops. What to do about that is the author's job
   and requires knowing what the vents are.

   ------------------------------------------------------------
   INV-1 STILL HOLDS AND IT IS WORTH SAYING WHY

   Everything here is a verbatim quotation of something a human
   typed, counted and sorted. Nothing is generated, nothing is
   paraphrased, and no sentence is ever shown to a PLAYER — this
   is an authoring tool that reads a finished session, not
   anything the table sees mid-game.

   The temptation this file must never yield to is obvious: it is
   sitting on a list of things players wanted to do, and turning
   those into listener text automatically would be one small
   function away. That function would be the engine writing the
   module's content, which is the line the whole project is built
   not to cross. It stays a report.
   ============================================================ */

/** Words that carry no signal about what somebody was trying to
    do. Grouping on them would put every sentence in one bucket. */
const NOISE = new Set([
  "the", "a", "an", "and", "or", "but", "if", "is", "are", "was", "were",
  "be", "been", "am", "do", "does", "did", "can", "could", "will", "would",
  "should", "shall", "may", "might", "must", "have", "has", "had",
  "i", "we", "you", "he", "she", "it", "they", "me", "us", "them", "my",
  "our", "your", "his", "her", "its", "their", "this", "that", "these",
  "those", "to", "of", "in", "on", "at", "for", "with", "from", "by",
  "as", "into", "over", "under", "out", "up", "down", "off", "then",
  "there", "here", "what", "how", "why", "when", "where", "who",
  "not", "no", "yes", "all", "any", "some", "just", "very", "really",
  "try", "trying", "want", "wants", "lets", "let", "go", "get", "got",
  "one", "two", "about", "like", "back", "now", "again", "too", "so",
]);

/** A sentence's content words, lower-cased and de-duplicated. */
export function keywords(text) {
  return [...new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9' ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !NOISE.has(w)),
  )];
}

/**
 * Pull every sentence that fell through to the oracle out of a
 * finished feed.
 *
 * The sentence rides on the oracle marker line's `extra.miss`,
 * written by `useGame` at the moment of the miss. An earlier
 * draft walked backwards through the feed looking for the
 * player's echoed line — which does not work, because a typed
 * sentence is NEVER echoed into the feed. It resolves and the
 * feed records the result. There was nothing to walk back to.
 *
 * Reading a finished feed rather than instrumenting the parser is
 * still the right shape: the feed is already recorded, already
 * saved and already exported, so this works on any transcript a
 * table sends an author afterwards. An author does not need to
 * have been in the room.
 */
export function missesFrom(feed) {
  const lines = Array.isArray(feed) ? feed : [];
  const out = [];
  for (const l of lines) {
    const miss = l && l.extra && l.extra.miss;
    if (!miss || typeof miss !== "string") continue;
    out.push({ text: miss.trim(), room: l.room || null, clock: l.clock ?? null });
  }
  return out;
}

/**
 * Group misses by their shared keyword, commonest first.
 *
 * Grouping is on the single most-shared word rather than anything
 * cleverer, and the crudeness is the point: an author scanning
 * this wants "eleven people said something about the vents", not
 * a clustering they have to trust. A word that appears in one
 * sentence only is still listed, at the bottom, because the
 * one-off a playtester tried is sometimes the best idea anybody
 * had.
 */
export function backlog(feed, { min = 1 } = {}) {
  const misses = missesFrom(feed);
  const byWord = new Map();

  for (const m of misses) {
    for (const w of keywords(m.text)) {
      if (!byWord.has(w)) byWord.set(w, []);
      byWord.get(w).push(m);
    }
  }

  const seen = new Set();
  return [...byWord.entries()]
    .map(([word, items]) => ({ word, items, n: items.length }))
    .sort((a, b) => b.n - a.n || a.word.localeCompare(b.word))
    .filter((g) => {
      if (g.n < min) return false;
      /* A sentence belongs to its commonest word only. Listing
         "we should crawl into the vents" under both `crawl` and
         `vents` makes a backlog of twelve sentences look like a
         backlog of thirty. */
      const fresh = g.items.filter((m) => !seen.has(m.text));
      if (!fresh.length) return false;
      for (const m of fresh) seen.add(m.text);
      g.items = fresh;
      g.n = fresh.length;
      return true;
    });
}

/** The backlog as lines an author reads. Markdown, because it is
    pasted into an issue or a notes file more often than it is
    looked at once. */
export function backlogMarkdown(feed, { title = "" } = {}) {
  const groups = backlog(feed);
  const total = groups.reduce((n, g) => n + g.n, 0);

  if (!total) {
    return `# ${title || "Parse misses"}\n\nNothing fell through to the oracle this session.\n`;
  }

  const out = [
    `# ${title || "Parse misses"}`,
    "",
    `${total} sentence${total === 1 ? "" : "s"} the module had no answer for, grouped by`,
    "what they were about. Commonest first.",
    "",
    "These are the listeners this module is missing. Each one is something a real",
    "player typed and got a weighted yes/no for — see `engine/listenerPack.js` for",
    "the shape a listener takes, and the editorial rule that a module-specific one",
    "may say things a generic one may not.",
    "",
  ];

  for (const g of groups) {
    out.push(`## ${g.word} — ${g.n}`);
    out.push("");
    for (const m of g.items) {
      out.push(`- ${m.text}${m.room ? `  \`${m.room}\`` : ""}`);
    }
    out.push("");
  }
  return out.join("\n");
}

export default { missesFrom, backlog, backlogMarkdown, keywords };
