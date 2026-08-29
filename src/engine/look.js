/* ============================================================
   LOOK — answering "what do I see?" without a person to ask.

   Players could always act on a room, search it, and interrogate
   anybody standing in it. They could not ask the *situation*
   anything: what do I see, ways out, who else is here, how long
   have we been at this, what was that crate again. With a Warden
   present that exchange is something like forty per cent of what
   gets said at a table, and it is invisible as a feature precisely
   because it is not one — it is just talking.

   ------------------------------------------------------------
   THE THING THAT MAKES THIS DANGEROUS

   A ROOM FEATURE'S DESCRIPTION IS A SEARCH RESULT.

   `doSearch` charges ten to fifteen minutes for a feature, and a
   `deep` one costs an Intellect roll and can fail twice before it
   gives anything up. The text lives right there on the feature as
   `d`, one property away from the name — and an answering function
   that helpfully returned it would hand the whole room over for
   free, silently, in a way nothing would ever throw an error
   about.

   So the rule here is absolute and it is the reason this file is
   pure and tested:

     NAMES ARE VISIBLE. DESCRIPTIONS ARE EARNED.

   You may be told there are ore crates in here, because you can
   see them from the door. You may be told what is *in* them only
   once somebody has spent the fifteen minutes. `w.searched` is the
   record of who has, and it is checked on every path.

   The same discipline applies outward: no unvisited room, no NPC
   who is not in front of you, no threat, no flag, no clock the
   crew has not been shown.

   ------------------------------------------------------------
   WHY NOT REGEXES

   The first version of this matched the question against a
   handful of `/see|look|room/` patterns. It worked for the four
   suggested chips and was mediocre for anything typed, which is
   the worst possible split: it looked like it understood, and
   then it did not.

   This scores instead, with the same tokeniser, stemmer and floor
   that `npcReply` uses — so "exits" and "exit" and "way out" are
   one question, and a question that matches nothing is *told* it
   matched nothing rather than being handed the room description
   in a confident tone. The director is not an improviser, and a
   player should find that out once, plainly, rather than by
   slowly noticing the answers are not about what they asked.
   ============================================================ */

import { tokenise, stem, matchScore, TOPIC_FLOOR } from "./oracle.js";
import { roomAddendum, thingAnswer, rulingNouns } from "./ruling.js";

/** What it says when it has nothing. Deliberately points at the two
    things that *would* answer — searching, and asking a person —
    because "I don't know" from a referee should still leave you with
    somewhere to go, and because both of those are real actions with
    real costs rather than a shrug. */
export const MISS =
  "Nothing here answers that. Search something, or ask somebody who would know.";

/* CONTRACTIONS, WHICH ARE HOW PEOPLE ACTUALLY ASK.

   `tokenise` is shared with `npcReply` and deliberately keeps the
   apostrophe, so "who's" arrives as one token and never matches
   "who". That is fine for talking to a person — you say their name
   and a noun — and wrong for talking to a room, where almost every
   question starts "what's", "who's", "where's", "how's".

   So the bare stem is offered alongside the contraction rather than
   instead of it: "don't" still scores against "don't" if a module
   ever writes one, and "who's" now also scores against "who". This
   lives here rather than in the shared tokeniser because changing
   that would quietly move every NPC's topic matching too. */
const expand = (toks) => toks.flatMap((t) => (t.includes("'") ? [t, t.split("'")[0]] : [t]));

/* Same shape as `topicScore`, but scoring against a declared
   keyword list rather than an NPC's prose. Exact tokens are worth
   more than stems, for the reason given in oracle.js: "water" and
   "watering" being the same question is a guess, and "water" and
   "water" is not. */
function keywordScore(words, keywords) {
  const exact = new Set(keywords);
  const stems = new Set(keywords.map(stem));
  let score = 0;
  for (const w of words) {
    if (w.length < 2) continue;
    if (exact.has(w)) { score += 1; continue; }
    if (stems.has(stem(w))) score += 0.6;
  }
  return score;
}

/* ============================================================
   THE FACETS

   Each is a question a player actually asks, the words they ask
   it in, and a resolver over state they are already entitled to.

   `general` marks the ones that answer a bare "what do I see?" —
   the answer a Warden gives when you ask nothing in particular.
   The rest only fire when asked for, because volunteering the
   clock every time somebody looks around is how a system becomes
   wallpaper.
   ============================================================ */
export const FACETS = [
  {
    id: "room",
    general: true,
    keywords: ["see", "look", "room", "around", "here", "place", "what", "describe", "surroundings"],
    answer({ room, w, roomId, viewerPcId, isWarden }) {
      /* The module author's own words, and specifically the `look`
         pool — which is exactly what entering the room already
         printed. Retrieval, not revelation. */
      const line = Array.isArray(room.look) ? room.look[0] : room.look;

      /* AND WHATEVER THE TABLE DECIDED WAS ALSO TRUE.

         A Warden who says the ceiling panel is loose has changed the
         room, and a room that goes on describing itself as though
         they had not is the software contradicting the person
         running it. `roomAddendum` is redaction-aware: a ruling made
         privately to one player is absent from everybody else's
         answer, including the shared table screen's. See
         engine/ruling.js. */
      const extra = roomAddendum(w, roomId, { viewerPcId, isWarden });
      const own = line || room.desc || null;
      if (!own && !extra.length) return null;
      return [own, ...extra].filter(Boolean).join(" ");
    },
  },
  {
    id: "exits",
    general: true,
    keywords: ["exit", "exits", "out", "way", "ways", "door", "doors", "leave", "go", "where", "corridor", "hatch"],
    answer({ mod, room }) {
      /* The labels already printed on their own movement buttons.
         An exit to an `@ending` is skipped: naming the way the
         module stops is not "what do I see". */
      const exits = (room.exits || [])
        .filter((e) => e && e.to && !String(e.to).startsWith("@"))
        .map((e) => e.label || ((mod.rooms || {})[e.to] || {}).name || e.to);
      return exits.length ? `Ways out: ${exits.join(" · ")}.` : "No way out of here but the way you came.";
    },
  },
  {
    id: "people",
    general: true,
    keywords: ["who", "whos", "people", "anyone", "anybody", "alone", "crew", "someone", "somebody", "with", "else"],
    answer({ mod, w, roomId }) {
      /* Only people standing in front of you. Where somebody *else*
         is, is not something the room can tell you — you would have
         to go and look, and saying so is the honest answer. */
      const here = Object.entries(w.npcs || {})
        .filter(([id, n]) => n && n.loc === roomId && n.alive && !n.taken && (mod.npcs || {})[id])
        .map(([id]) => mod.npcs[id].name);
      return here.length ? `With you: ${here.join(", ")}.` : "Nobody else in here.";
    },
  },
  {
    id: "things",
    general: true,
    keywords: ["thing", "things", "stuff", "object", "objects", "search", "examine", "notice", "interesting"],
    answer({ room, w, roomId, viewerPcId, isWarden }) {
      /* NAMES ONLY — see the header. A feature you have searched is
         reported as searched, so a player can tell the difference
         between "I have not looked at that" and "I looked and there
         was nothing", which is a distinction a Warden makes without
         thinking and a list of nouns destroys. */
      const keys = Object.keys(room.features || {});
      const named = keys.map((k) => {
        const f = room.features[k];
        const done = !!(w.searched || {})[`${roomId}:${k}`];
        return `${f.name}${done ? " (searched)" : ""}`;
      });

      /* Things that exist because somebody at this table said so.
         They are not marked out as different, and that is the point:
         a ruling the Warden made an hour ago should be as ordinary a
         part of the room as the crates the author shipped. The
         Warden's own ledger is where provenance lives — see
         `wardenLedger` — not in the answer given to a player. */
      const ruled = rulingNouns(w, roomId, { viewerPcId, isWarden });

      const all = [...named, ...ruled.filter((n) => !named.some((m) => m.startsWith(n)))];
      if (!all.length) return "Nothing in here worth taking apart.";
      return `In here: ${all.join(" · ")}.`;
    },
  },
  {
    id: "time",
    keywords: ["time", "clock", "long", "late", "hour", "hours", "minute", "minutes", "been", "window", "left"],
    answer({ w }) {
      const c = w.clock || 0;
      return `${Math.floor(c / 60)}h ${c % 60}m gone.`;
    },
  },
  {
    id: "board",
    keywords: ["know", "knows", "clue", "clues", "board", "found", "learned", "figured", "so", "far"],
    answer({ w }) {
      /* The crew's own record. Nothing here came from anywhere but
         a player pinning it. */
      const pinned = (w.clues || []).filter((c) => c && !c.resolved).slice(-4);
      return pinned.length
        ? `On the board: ${pinned.map((c) => c.text).join(" · ")}`
        : "Nothing on the board yet.";
    },
  },
  {
    id: "carrying",
    keywords: ["carry", "carrying", "have", "hold", "holding", "inventory", "kit", "gear", "pack", "got"],
    answer({ mod, pc }) {
      if (!pc) return null;
      const names = (pc.items || []).map((i) => ((mod.items || {})[i] || {}).n || i);
      return names.length ? `You are carrying: ${names.join(", ")}.` : "You are carrying nothing.";
    },
  },
  {
    id: "self",
    keywords: ["me", "my", "myself", "feel", "feeling", "hurt", "health", "stress", "condition", "okay", "alright"],
    answer({ pc }) {
      if (!pc) return null;
      const bits = [`Health ${pc.health}/${pc.maxHealth}`, `Stress ${pc.stress}`];
      if ((pc.conditions || []).length) bits.push((pc.conditions || []).join(", "));
      return `${bits.join(" · ")}.`;
    },
  },
];

/** Below this a facet is a coincidence rather than an answer. Shared
    with `npcReply` on purpose: the two are the same judgement about
    the same tokeniser, and letting them drift would mean a question
    that reaches a person and a question that reaches the room
    disagree about what counts as being asked. */
export const LOOK_FLOOR = TOPIC_FLOOR;

/** How well a question has to hit a *name* before it counts as being
    about that thing. Higher than the facet floor, because naming is
    a stronger claim than topic-matching and a near-miss on a proper
    noun is much more likely to be wrong. */
export const NAME_FLOOR = 0.5;

/* ============================================================
   NAMED THINGS

   "What's in the crates?" is the question the regex version got
   most obviously wrong: it matched nothing, fell through to the
   general answer, and returned the room description — which reads
   as an answer and is not one.

   Matching a name is the single biggest improvement available
   here, and it is also where the search rule bites hardest, so
   the two live in the same function.
   ============================================================ */
function namedAnswer({ mod, w, room, roomId, words, pc, viewerPcId, isWarden }) {
  let best = null;

  // A feature in this room.
  for (const [key, f] of Object.entries(room.features || {})) {
    const score = Math.max(matchScore(words, f.name), keywordScore(words, tokenise(key)));
    if (score < NAME_FLOOR || (best && score <= best.score)) continue;
    const searched = !!(w.searched || {})[`${roomId}:${key}`];
    best = {
      score,
      /* THE RULE. The description is a search result and costs time,
         and sometimes a roll. Being told it exists is free; being
         told what is in it is not, and this is the one place where
         getting that backwards would quietly break the module. */
      text: searched
        ? `${f.name} — ${f.d}`
        : `${f.name} is here. You have not gone through it yet — that takes time.`,
    };
  }

  // Somebody standing in this room.
  for (const [id, decl] of Object.entries(mod.npcs || {})) {
    const state = (w.npcs || {})[id];
    if (!state || !state.alive || state.taken) continue;
    const score = matchScore(words, decl.name);
    if (score < NAME_FLOOR || (best && score <= best.score)) continue;
    best = state.loc === roomId
      ? { score, text: `${decl.name} is right here. Ask them yourself.` }
      /* Where somebody else is, is not something the room knows.
         Answering it would turn a look into base-wide surveillance. */
      : { score, text: `${decl.name} is not in here. You would have to go and find them.` };
  }

  // Something in your own hands.
  for (const id of (pc && pc.items) || []) {
    const item = (mod.items || {})[id];
    if (!item) continue;
    const score = matchScore(words, item.n || id);
    if (score < NAME_FLOOR || (best && score <= best.score)) continue;
    best = { score, text: `${item.n}${item.d ? ` — ${item.d}` : ""}. You have it on you.` };
  }

  /* THE TABLE'S OWN, RESOLVED LAST AND DELIBERATELY SO.

     A ruling is the most recent thing a human said about that name,
     and the most recent thing a human said is the true one. If the
     module ships a `panel` feature and the Warden has since ruled
     that the panel is off and there is a duct behind it, the player
     asking about the panel wants the duct — not the author's
     description of an intact panel.

     So this loop wins ties (`<` rather than `<=`), which is the
     opposite of every loop above it. That is the whole mechanism by
     which a Warden can correct a module without editing one.

     THE SEARCH RULE IS NOT BYPASSED. A ruling's text is a sentence
     a person chose to say out loud at the table; it is not a
     feature's `d`, and it is never read out of one. Nothing here can
     hand over a search result, because nothing here can reach one. */
  for (const name of rulingNouns(w, roomId, { viewerPcId, isWarden })) {
    const score = Math.max(matchScore(words, name), keywordScore(words, tokenise(name)));
    if (score < NAME_FLOOR || (best && score < best.score)) continue;
    const hit = thingAnswer(w, roomId, name, { viewerPcId, isWarden });
    if (hit) best = { score, text: `${hit.subject} — ${hit.text}` };
  }

  return best;
}

/* ============================================================
   THE ANSWER
   ============================================================ */

/**
 * Answer a player's question about the situation they are in.
 *
 * Returns `{ matched, parts, text }`. `matched` is false when
 * nothing scored — and a false there is a *result*, not a failure
 * to be papered over. See `MISS`.
 *
 * Pure. No React, no clock, no network. Everything it can say
 * comes from arguments, which is what lets a test assert the
 * search rule rather than trusting a comment about it.
 */
export function answerLook({ mod, w, pc, about = "", isWarden = false } = {}) {
  if (!mod || !w) return { matched: false, parts: [], text: MISS };
  const roomId = (pc && pc.room) || w.room;
  const room = (mod.rooms || {})[roomId];
  /* A room the crew is not in is a room the crew is not told about.
     `safeMove`'s first check, applied to the other direction of
     travel. */
  if (!room || !(w.visited || {})[roomId]) return { matched: false, parts: [], text: MISS };

  /* WHO IS ASKING, WHICH DECIDES WHAT THEY GET.

     Derived rather than passed, because every existing caller
     already supplies the `pc` and adding a required argument would
     mean four call sites where forgetting it publishes a private
     ruling to the whole table. A missing `pc` yields `null`, and
     `null` is the shared-screen viewer — the one that sees only
     public rulings. Failing closed is the only acceptable default
     here; see INV-6 and the header of engine/ruling.js. */
  const viewerPcId = (pc && pc.id) || null;

  const ctx = { mod, w, pc, room, roomId, viewerPcId, isWarden };
  const words = expand(tokenise(about));

  /* A bare question — "what do I see?", or an empty one — gets the
     answer a Warden gives when you ask nothing in particular. */
  const bare = !words.length;

  const named = bare ? null : namedAnswer({ ...ctx, words });

  const scored = FACETS
    .map((f) => ({ f, score: bare ? (f.general ? 1 : 0) : keywordScore(words, f.keywords) }))
    .filter((x) => x.score >= (bare ? 1 : LOOK_FLOOR))
    .sort((a, b) => b.score - a.score);

  const parts = [];

  /* A named thing outranks a topic. Somebody who asked about the
     crates wants the crates, not a paragraph about the bay with the
     crates mentioned in it. */
  if (named && (!scored.length || named.score >= scored[0].score)) {
    parts.push({ facet: "named", text: named.text });
  }

  /* Two facets at most. A question gets an answer; a question that
     returns six paragraphs is a system showing off, and on a phone
     it is a wall the player has to scroll. */
  for (const { f } of scored.slice(0, bare ? 3 : 2)) {
    const text = f.answer(ctx);
    if (text) parts.push({ facet: f.id, text });
  }

  if (!parts.length) {
    /* THE HONEST FAILURE. Not the room description with a confident
       tone — that is the answer that teaches a player the thing is
       cleverer than it is, and every subsequent answer then gets
       read as possibly-nonsense. */
    return { matched: false, parts: [], text: MISS };
  }

  return { matched: true, parts, text: parts.map((p) => p.text).join(" ") };
}
