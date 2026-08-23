/* ============================================================
   THE VOTE — what a Warden's judgement call becomes when there
   is no Warden.

   A person behind the screen makes a dozen unilateral decisions
   an evening that are not rules decisions at all: we'll skip
   that bit, let's take five, I think we're done, let's rewind and
   do that again. None of them is in the rulebook and all of them
   are needed. With the chair empty they have to come from the
   table, and "whoever taps first decides" is not a table, it is
   the fastest player deciding — the exact failure `floor.js`
   exists to correct.

   So: one primitive, five uses, and the shape is deliberately
   boring. A vote is a plain object. Opening one, casting into
   one, and reading one are pure functions over that object, which
   means the host can hold it, the snapshot can carry it, and a
   test can run an entire disputed evening in four lines with no
   DOM and no clock.

   ------------------------------------------------------------
   WHAT IS NOT A VOTE

   THE SAFETY CARD IS NOT A VOTE, AND MUST NEVER BECOME ONE.

   `stop` is unilateral, anonymous and immediate. The moment a
   table can outvote somebody's stop card the card is worse than
   useless, because it now publishes that there was a card *and*
   that the table overruled it. `veil` may offer a vote about what
   happens next — skip this beat, or carry on differently — but
   the pause itself is never up for election. See useHost.

   ------------------------------------------------------------
   ABSTAINING IS AN ANSWER

   Every vote counts against the number of people who could have
   voted, not the number who did. A table of five where two tap
   yes and three say nothing has not agreed to anything, and a
   primitive that resolves on "2–0, motion carried" would let two
   quick players call the evening over the heads of three who were
   still reading. Silence is a no, and a vote that nobody answers
   expires rather than passing.
   ============================================================ */

/** The five things a table needs to be able to decide for itself.
    Named here rather than passed as strings so a typo is a missing
    topic rather than a silent second election. */
export const VOTE_TOPICS = {
  /* Offered after a `veil` card. Not the pause — the pause has
     already happened, unilaterally, and is not in question. This
     asks only what the table would like to do about the beat. */
  veil: {
    label: "Skip this?",
    blurb: "Someone asked for this to happen off-screen. Skip past it?",
    options: [
      { id: "skip", label: "Skip it" },
      { id: "continue", label: "Carry on" },
    ],
    fallback: "skip",
  },
  /* Five minutes. Deliberately easy to pass. */
  breather: {
    label: "Take five?",
    blurb: "Stop the clocks and put the screen down for a bit.",
    options: [
      { id: "yes", label: "Take five" },
      { id: "no", label: "Keep going" },
    ],
    fallback: "no",
  },
  /* The end of the evening. A Warden says "right, that's a good
     place to stop" and everyone believes them. */
  callit: {
    label: "Call it there?",
    blurb: "End the session here and go to the debrief.",
    options: [
      { id: "yes", label: "Call it" },
      { id: "no", label: "Not yet" },
    ],
    fallback: "no",
  },
  /* "No, wait — I said I was checking the door." The rewind that a
     person grants instantly and a policy cannot grant at all. */
  rewind: {
    label: "Rewind that?",
    blurb: "Undo the last thing that happened and take it again.",
    options: [
      { id: "yes", label: "Rewind" },
      { id: "no", label: "Leave it" },
    ],
    fallback: "no",
  },
  /* Starting the round again, when the room agrees it got muddled. */
  restart: {
    label: "Start the round again?",
    blurb: "Close this go-round and open a fresh one.",
    options: [
      { id: "yes", label: "Start again" },
      { id: "no", label: "Leave it" },
    ],
    fallback: "no",
  },
};

/** How long a vote stays open before it gives up. Long enough that
    somebody who put their phone down still gets a say, short enough
    that a forgotten vote is not sitting on five screens an hour
    later. */
export const VOTE_MS = 90 * 1000;

/** The smallest table where a majority means anything. Below this
    every vote is effectively unanimous anyway, which is correct —
    two people do not need a ballot, but they do need both of them
    to have said yes rather than one of them being fast. */
export const MIN_VOTERS = 1;

/**
 * Open a vote.
 *
 * `of` is the list of clientIds entitled to vote — everybody
 * holding a character, resolved by the host. Passing it in rather
 * than counting later is what makes abstention meaningful: the
 * denominator is fixed at the moment the question was asked, so
 * somebody joining halfway through cannot change what a majority
 * is under the people already deciding.
 */
export function openVote(topic, { of = [], at = Date.now(), by = null, note = null } = {}) {
  const t = VOTE_TOPICS[topic];
  if (!t) return null;
  const voters = [...new Set((of || []).filter(Boolean))];
  if (voters.length < MIN_VOTERS) return null;
  return {
    topic,
    label: t.label,
    blurb: t.blurb,
    options: t.options,
    of: voters,
    /* clientId -> option id. Deliberately keyed by device rather
       than by character: this is the table deciding, not the crew,
       and a player whose character is dead still gets a say in
       whether the evening stops. */
    cast: {},
    at,
    /* Who opened it, for the feed only. A vote about a safety card
       is opened by the system and carries null, because attaching a
       name to it would identify the person who played the card. */
    by,
    note,
    closesAt: at + VOTE_MS,
    /* Set by `closeVote`. A vote is never mutated in place by the
       host — every transition returns a new object, so the snapshot
       diff is honest and React sees the change. */
    result: null,
  };
}

/** Record one answer. Re-voting is allowed and simply replaces the
    previous answer: somebody who taps the wrong button should not
    have to live in the world it made. */
export function castVote(vote, clientId, choice) {
  if (!vote || !clientId || vote.result) return vote;
  if (!vote.of.includes(clientId)) return vote;
  if (!vote.options.some((o) => o.id === choice)) return vote;
  return { ...vote, cast: { ...vote.cast, [clientId]: choice } };
}

/** option id -> how many. Every option appears, including the ones
    nobody picked, so a display does not have to guess at zeroes. */
export function tallyOf(vote) {
  const out = {};
  if (!vote) return out;
  for (const o of vote.options) out[o.id] = 0;
  for (const c of Object.values(vote.cast || {})) {
    if (out[c] != null) out[c] += 1;
  }
  return out;
}

/** How many people have not answered. */
export const abstaining = (vote) =>
  (vote ? vote.of.length - Object.keys(vote.cast || {}).length : 0);

/**
 * Is this decided?
 *
 * Returns the winning option id, or null for "still open". An
 * option wins when it holds more than half of *everyone entitled
 * to vote* — see ABSTAINING IS AN ANSWER. That makes the common
 * case slightly slower and the wrong case impossible, which is the
 * right way round for a question like "shall we stop playing".
 */
export function decided(vote) {
  if (!vote) return null;
  if (vote.result) return vote.result.choice;
  const tally = tallyOf(vote);
  const need = Math.floor(vote.of.length / 2) + 1;
  for (const [id, n] of Object.entries(tally)) {
    if (n >= need) return id;
  }
  return null;
}

/**
 * Has this run out of time?
 *
 * An expired vote takes the topic's `fallback`, which is always the
 * conservative answer — carry on, don't stop, leave it — except for
 * `veil`, where the conservative answer is to skip. That asymmetry
 * is the point: everywhere else silence means "no change", and on a
 * safety topic silence means "protect the person who asked".
 */
export const expired = (vote, now = Date.now()) =>
  !!(vote && !vote.result && now >= vote.closesAt);

/**
 * Close a vote, by decision or by timeout. Returns the vote with
 * `result` filled in, or the same vote if it is not closable yet.
 */
export function closeVote(vote, now = Date.now()) {
  if (!vote || vote.result) return vote;
  const won = decided(vote);
  if (won) {
    return { ...vote, result: { choice: won, why: "decided", at: now } };
  }
  if (expired(vote, now)) {
    const t = VOTE_TOPICS[vote.topic];
    return {
      ...vote,
      result: { choice: (t && t.fallback) || "no", why: "expired", at: now },
    };
  }
  return vote;
}

/** One line for the feed, once a vote has landed. Templates over the
    vote's own fields — there is nothing generated here, and a vote
    with no result produces nothing. */
export function voteLine(vote) {
  if (!vote || !vote.result) return null;
  const t = tallyOf(vote);
  const opt = vote.options.find((o) => o.id === vote.result.choice);
  const label = opt ? opt.label.toLowerCase() : vote.result.choice;
  const counts = vote.options.map((o) => `${o.label} ${t[o.id] || 0}`).join(" · ");
  return vote.result.why === "expired"
    ? `— the table said nothing, so: ${label} —`
    : `— the table votes: ${label} (${counts}) —`;
}
