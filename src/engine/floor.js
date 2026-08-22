/* ============================================================
   THE FLOOR — who has it, and who has quietly been waiting.

   `tempo.js` gave the Warden brakes. This is the thing that
   notices when they are needed.

   THE FAILURE, STATED PRECISELY. Not "some players talk more" —
   that is fine, always will be, and a table of enthusiasts is
   not a table with a problem. The failure is that the fast
   player *resolves the situation* before the slow player has
   finished deciding whether to speak. By the time Dana has a
   plan, the door is open, the thing is dead, and the fiction has
   moved past the sentence Dana was building.

   That is a latency problem wearing a volume problem's clothes,
   which is why counting who talked most is the wrong instrument
   and why nothing here is ever displayed as a count.

   THREE SHAPES, and only one of them was previously invisible:

     STEAMROLL  one player answers every prompt inside two
                seconds. Everyone else stops trying, which reads
                as agreement and is not.
     DRIFT      nobody acts, everybody waits for somebody else.
                `pacing.js` already reports this one.
     LOCKOUT    a quiet player *is* trying, and is being beaten
                to the intent every time. `useIntentGate`
                swallows the tap; the host never hears about it;
                the player concludes the app is broken. This is
                the cruellest of the three and it was, until
                this file, entirely unmeasured.

   The lockout signal is why `swallowed` is weighted so heavily
   below. An idle player might be enjoying the ride. A player
   with three eaten taps is not idle — they are being outrun.

   ------------------------------------------------------------
   SIX RULES THIS OBEYS, AND WHY

   1. NEVER NAME ANYONE. Not to themselves, not to the table, not
      to the Warden. "Riley has acted 40% of the time" turns a
      game night into a performance review. Every message this
      produces is about the room.

   2. NEVER SHOW A RANKING. The moment share is visible it
      becomes a thing to optimise, and the eager player is not
      being malicious — they are being enthusiastic, and
      enthusiasm is not a bug. `tests/floor.test.js` fails the
      build if `src/ui` or `src/screens` imports the scoring.

   3. QUIET IS ALLOWED. Somebody who passes is *choosing*.
      `scenePass` is consent and is read here as consent: two
      declines and the floor stops being offered to them for the
      rest of the session.

   4. HOLD, NEVER REFUSE. Every brake in `tempoVerdict` holds and
      drains in arrival order. A floor correction that denied
      would be the first thing in this codebase to tell a player
      *no* for a social reason. It holds, briefly, and it always
      releases — see FLOOR_HOLD_MS.

   5. ONLY WHEN SOMEBODY IS ACTUALLY WAITING. A runaway player in
      a room where nobody else wants the floor is just a player.
      The hold requires a claimant.

   6. OFF BY DEFAULT. A table of four friends who have played
      together for a decade does not need this and will resent
      it. One switch, `floor.on`, and everything above is inert
      until somebody asks for it.

   ------------------------------------------------------------
   Everything here is a pure function over plain data. The ledger
   is one object on the world, so it snapshots, redacts, saves and
   can be reasoned about without a DOM — same contract as
   `w.tempo`.
   ============================================================ */

/** Everything off, everything empty. A world saved before this
    existed has no `floor` key, so every read goes through floorOf. */
export const DEFAULT_FLOOR = {
  on: false,          // rule 6
  since: 0,           // when the ledger opened; the idle baseline
  acts: {},           // pcId -> world-moving actions this round
  swallowed: {},      // pcId -> intents the gate ate. The lockout signal
  last: {},           // pcId -> when they last actually acted
  offered: {},        // pcId -> when the floor was last offered to them
  declines: {},       // pcId -> offers they answered by hanging back
  burst: [],          // [{ pcId, at }] recent acts, for stampede detection
};

export function floorOf(w) {
  return { ...DEFAULT_FLOOR, ...((w && w.floor) || {}) };
}

/* ============================================================
   CONSTANTS

   All named, all here, because every one of them is a social
   judgement rather than a fact and the first thing a table will
   want to do is disagree with one.
   ============================================================ */

/** A minute of fiction time is worth this much of an action when
    weighing who has had the room. Ten minutes of searching is
    about one action's worth of everyone else's patience. */
export const MINUTE_WEIGHT = 0.1;

/** How many more actions than the quietest living player before
    somebody counts as running away with it. Three is roughly "you
    have had two goes while they have had none", which is the point
    at which a real Warden looks up. */
export const RUNAWAY_LEAD = 3;

/** The longest a floor hold can last. It is measured from the
    runaway's *own* last action, so it behaves as a targeted,
    automatic `rateMs` and cannot become a refusal. Nine seconds is
    long enough for somebody else to get a tap in and short enough
    that it reads as a beat rather than a fault. */
export const FLOOR_HOLD_MS = 9000;

/** One eaten tap is worth this many seconds of silence. Weighted
    high on purpose: silence is ambiguous, a swallowed tap is not. */
export const SWALLOW_SECONDS = 60;

/** Above this starvation score the floor is worth offering. 100 is
    a hundred seconds of quiet, or forty seconds and one eaten tap. */
export const STARVE_SCORE = 100;

/** Do not offer the same person the floor twice inside this. The
    whole value of the spotlight is that it is rare — see
    `ui/Spotlight.jsx`, which makes the same argument about itself. */
export const OFFER_COOLDOWN_MS = 3 * 60 * 1000;

/** Two declined offers and we stop asking. Rule 3. */
export const MUTE_AFTER = 2;

/** Stampede detection: this many world-moving actions inside this
    window, with one player holding this share of them, in a crew of
    at least this many. All four have to be true, because any one of
    them alone describes an ordinary busy minute. */
export const BURST_WINDOW_MS = 45 * 1000;
export const BURST_ACTS = 6;
export const BURST_SHARE = 0.5;
export const BURST_CREW = 3;

/** How many burst entries to keep. Enough for the window at a
    frankly implausible rate, and bounded so a long session cannot
    grow the world. */
const BURST_KEEP = 40;

/* ============================================================
   WRITING THE LEDGER

   Four verbs, each returning a new floor. The host calls these;
   nothing else does.
   ============================================================ */

/** A world-moving intent actually ran. */
export function recordAct(f, pcId, now = Date.now()) {
  if (!f || !pcId) return f;
  return {
    ...f,
    acts: { ...f.acts, [pcId]: (f.acts[pcId] || 0) + 1 },
    last: { ...f.last, [pcId]: now },
    burst: [...f.burst, { pcId, at: now }].slice(-BURST_KEEP),
    since: f.since || now,
  };
}

/** A phone tapped while its own previous intent was still in the
    air. Which is to say: somebody tried, and was too slow. */
export function recordSwallow(f, pcId, now = Date.now()) {
  if (!f || !pcId) return f;
  return {
    ...f,
    swallowed: { ...f.swallowed, [pcId]: (f.swallowed[pcId] || 0) + 1 },
    since: f.since || now,
  };
}

/** The floor was offered to somebody. */
export function recordOffer(f, pcId, now = Date.now()) {
  if (!f || !pcId) return f;
  return { ...f, offered: { ...f.offered, [pcId]: now } };
}

/** They hung back after being offered it. Rule 3: this is consent,
    and it accumulates. */
export function recordDecline(f, pcId) {
  if (!f || !pcId) return f;
  return { ...f, declines: { ...f.declines, [pcId]: (f.declines[pcId] || 0) + 1 } };
}

/** Close the round's books. Volume resets; consent does not — a
    player who has hung back twice stays un-nagged for the session,
    which is the entire point of remembering it. */
export function resetFloor(f, now = Date.now()) {
  if (!f) return f;
  return { ...f, acts: {}, swallowed: {}, burst: [], since: now };
}

/* ============================================================
   READING THE LEDGER
   ============================================================ */

const living = (crew) => (crew || []).filter((c) => c.alive !== false && !c.unconscious);

/** Minutes this player has charged the current round. Read off the
    scene's existing cost ledger rather than counted again here —
    `tempo.js` already does this correctly and two counters would
    eventually disagree. */
const minutesOf = (w, pcId) => {
  const scene = w && w.tempo && w.tempo.scene;
  return (scene && scene.cost && scene.cost[pcId]) || 0;
};

/** How much of the room one player has had. Actions, plus their
    fiction-time at a discount. */
export function weightOf(w, pcId) {
  const f = floorOf(w);
  return (f.acts[pcId] || 0) + minutesOf(w, pcId) * MINUTE_WEIGHT;
}

/**
 * Every living player's weight as a multiple of an even split.
 * 1.0 is exactly their share; 2.0 is twice it.
 *
 * NOT FOR DISPLAY. See rule 2 — `tests/floor.test.js` enforces it.
 * This exists so the policy below can reason, and for tests.
 */
export function sharesOf(w, crew) {
  const alive = living(crew);
  const out = {};
  if (!alive.length) return out;
  const weights = alive.map((c) => weightOf(w, c.id));
  const total = weights.reduce((a, b) => a + b, 0);
  const even = total / alive.length;
  alive.forEach((c, i) => { out[c.id] = even > 0 ? weights[i] / even : 1; });
  return out;
}

/** Has this player told us, twice, that they are happy watching? */
export function isMuted(f, pcId) {
  return ((f && f.declines && f.declines[pcId]) || 0) >= MUTE_AFTER;
}

/** Whoever currently holds the room, as a Set — one per lane when
    the party is split. Read straight off the scene rather than
    importing tempo.js, which imports this file. */
const holdersOf = (w) => {
  const scene = w && w.tempo && w.tempo.scene;
  if (!scene || !scene.order || !scene.order.length) return new Set();
  return new Set([scene.order[scene.idx]].filter(Boolean));
};

/**
 * How badly is each living player being left out?
 *
 * Silence in seconds, plus a heavy premium on eaten taps, because
 * those are the only unambiguous evidence that somebody wanted the
 * floor and did not get it.
 *
 * Zero for anyone currently holding the room, anyone who has
 * declined twice, and anyone the ledger has never seen — the last
 * because a ledger that just opened should not immediately declare
 * the entire table starved.
 *
 * NOT FOR DISPLAY. Rule 2.
 */
export function starvationOf(w, crew, now = Date.now()) {
  const f = floorOf(w);
  const holders = holdersOf(w);
  const out = {};
  for (const c of living(crew)) {
    if (holders.has(c.id) || isMuted(f, c.id)) { out[c.id] = 0; continue; }
    const base = f.last[c.id] || f.since;
    if (!base) { out[c.id] = 0; continue; }
    const quiet = Math.max(0, (now - base) / 1000);
    out[c.id] = quiet + (f.swallowed[c.id] || 0) * SWALLOW_SECONDS;
  }
  return out;
}

/** Who most needs the floor, or null when nobody does. Ties break
    on crew order, so the answer does not flicker between renders. */
export function mostStarved(w, crew, now = Date.now()) {
  const scores = starvationOf(w, crew, now);
  let best = null;
  let bestScore = STARVE_SCORE;
  for (const c of living(crew)) {
    const s = scores[c.id] || 0;
    if (s > bestScore) { best = c.id; bestScore = s; }
  }
  return best;
}

/**
 * Is the table stampeding? Returns `{ pcId, share, acts }` for the
 * player carrying it, or null.
 *
 * All four conditions must hold. A busy minute where everyone is
 * busy is a good minute and must not trip this.
 */
export function stampede(w, crew, now = Date.now()) {
  const f = floorOf(w);
  if (living(crew).length < BURST_CREW) return null;
  const recent = f.burst.filter((b) => now - b.at <= BURST_WINDOW_MS);
  if (recent.length < BURST_ACTS) return null;
  const counts = {};
  for (const b of recent) counts[b.pcId] = (counts[b.pcId] || 0) + 1;
  let top = null;
  for (const [pcId, n] of Object.entries(counts)) {
    if (!top || n > top.acts) top = { pcId, acts: n };
  }
  if (!top) return null;
  const share = top.acts / recent.length;
  if (share < BURST_SHARE) return null;
  return { ...top, share };
}

/* ============================================================
   LEVER 1 — THE RING'S ORDER

   `makeScene` sorts by crew order, deliberately: "the order
   players see on the table is the order they already know."
   That is right for the first round and progressively less right
   afterwards, because it means the same person opens every round.

   This comparator opens the round with whoever has had least of
   it. It is invisible — no player is told why they are first, and
   from the sofa it simply looks like the Warden asked them — and
   it is the highest-value lever in this file precisely because
   nobody experiences it as a correction.
   ============================================================ */

/** A comparator over pcIds for `makeScene`, most starved first. */
export function starvationOrder(w, crew, now = Date.now()) {
  const scores = starvationOf(w, crew, now);
  const rank = new Map((crew || []).map((c, i) => [c.id, i]));
  return (a, b) => {
    const d = (scores[b] || 0) - (scores[a] || 0);
    if (d !== 0) return d;
    return (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  };
}

/* ============================================================
   LEVER 4 — THE SOFT HOLD

   The only lever here that touches a player's buttons, and the
   one written most defensively.

   It holds a runaway for at most FLOOR_HOLD_MS measured from
   their own last action, which makes it a targeted, automatic
   version of the `rateMs` house rule that already exists — with
   the difference that it applies to one person, only while they
   are ahead, and only while somebody else is actually waiting.

   Three guards, and all three must fail before anybody is held:

     · the ledger is off                     -> no hold
     · nobody else is behind them            -> no hold
     · their own last action is old enough   -> no hold

   The phone is told `floor`, and `WAIT_TEXT.floor` says "The room
   is waiting on someone else." It does not say who, and it never
   will. Rule 1.
   ============================================================ */

/** Is anybody else meaningfully behind this player? */
function claimantFor(w, crew, pcId, now) {
  const f = floorOf(w);
  const mine = weightOf(w, pcId);
  for (const c of living(crew)) {
    if (c.id === pcId) continue;
    if (isMuted(f, c.id)) continue;               // rule 3
    if ((f.swallowed[c.id] || 0) > 0) return c.id; // they tried and lost
    if (mine - weightOf(w, c.id) >= RUNAWAY_LEAD) return c.id;
  }
  return null;
}

/**
 * Should this intent hold for the floor? `null` to proceed, or
 * `{ wait: "floor" }`.
 *
 * `crew` is required. Called without it — which is every caller
 * that has not opted in — this does nothing at all, exactly as
 * `tempoVerdict`'s lane handling does.
 */
export function floorVerdict({ w, pcId, crew = null, now = Date.now() }) {
  if (!crew || !pcId) return null;
  const f = floorOf(w);
  if (!f.on) return null;
  if (!claimantFor(w, crew, pcId, now)) return null;
  const last = f.last[pcId] || 0;
  if (!last || now - last >= FLOOR_HOLD_MS) return null;
  return { wait: "floor" };
}

/* ============================================================
   THE POLICY

   One function, consulted on a slow timer by the host, returning
   at most one move. Silence is the common answer and must stay
   that way: a system that intervenes every few seconds is worse
   than one that never does.

   Moves are structured requests against things the engine already
   does — there is no prose here, no model, and nothing invented.
   This is deliberately the same shape the wardenless director
   will want, so that work is an extension of this rather than a
   parallel copy.
   ============================================================ */

/** How long between offers of the floor to *anybody*. Separate
    from the per-player cooldown: two people being nudged inside a
    minute is a system with opinions, which is not what this is. */
export const MOVE_COOLDOWN_MS = 60 * 1000;

/** The wording of an offer. Offering, never chiding — it must not
    be possible to read this as "you have not been participating". */
export const FLOOR_OFFER_TEXT = "A gap opens. What are you doing?";

/**
 * @returns null, `{ kind: "scene" }`, or `{ kind: "spotlight", pcId, text }`
 */
export function floorMove({ w, crew, now = Date.now(), lastMoveAt = 0 }) {
  const f = floorOf(w);
  if (!f.on) return null;
  if (now - lastMoveAt < MOVE_COOLDOWN_MS) return null;

  const scene = w && w.tempo && w.tempo.scene;

  /* Lever 3. A stampede with no round running is the situation the
     scene ring was built for, and starting one is a structural
     answer rather than a personal one — nobody is singled out. */
  if (!scene && stampede(w, crew, now)) return { kind: "scene" };

  /* Lever 2. Somebody has been quiet a long time, or has been
     outrun at the buttons. Their phone only. */
  const who = mostStarved(w, crew, now);
  if (who) {
    const offered = f.offered[who] || 0;
    if (now - offered >= OFFER_COOLDOWN_MS) {
      return { kind: "spotlight", pcId: who, text: FLOOR_OFFER_TEXT };
    }
  }

  return null;
}
