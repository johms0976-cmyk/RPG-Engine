/* ============================================================
   WHAT THE WARDEN IS BEING WAITED ON FOR

   The deck is seven tabs and about ninety controls, and that is
   the right shape for a laptop: a Warden scans it, sees the
   whole table at once, and reaches for the one lever they want.
   A phone cannot do that. Six hundred pixels of height holds
   roughly four things, so something has to choose which four —
   and if nothing chooses, the phone is a deck with a scrollbar,
   which is a deck you cannot use mid-sentence.

   This chooses. It is the whole reason WardenPhone can exist,
   and it is deliberately a separate file from the screen for the
   same reason `coverage.js` is separate from the library card:
   the interesting part is the decision, and a decision buried in
   JSX cannot be argued with or tested.

   ------------------------------------------------------------
   IT REPORTS. IT DOES NOT ADVISE.

   Same posture as coverage.js, and it matters more here because
   the temptation is stronger. Every line below answers "who is
   waiting, and how long have they been waiting" — a fact about
   the table's state that the host already holds. None of them
   answers "what should you do about it", and none of them should
   ever start to. A Warden's phone that says "ask Riley
   something" is an assistant director, and this project has one
   of those already; it lives in `director.js`, it runs only when
   the chair is empty, and it is vetoable. This is not that.

   The ordering is not a judgement either, or not much of one.
   It is roughly "how many people are stuck behind this", which
   is why the safety card is first and an idle player is near the
   bottom: one is the whole table stopped and the other is one
   person who has gone quiet.

   ------------------------------------------------------------
   THE CARD IS ALONE

   `wardenNow` returns the safety card as the only item when it
   is up, rather than as the first of five. That is not tidiness.
   A pause somebody asked for, rendered as the top entry in a
   list of table management, reads as one more thing to get
   through — and the whole value of the card is that everything
   stops. So everything stops here too.
   ============================================================ */

import { tempoOf, WAIT_TEXT } from "./tempo.js";
import { currentTurn } from "./combat.js";
import { isSplit, partySummary } from "./party.js";
import { SAFETY_LEVELS } from "../net/protocol.js";

/** How an entry wants to be read. The screen maps these to colour;
    nothing here knows what colour means. */
export const TONE = {
  STOP: "stop",     // the table has stopped and is waiting on a person
  TURN: "turn",     // somebody's go, or somebody's prompt
  CARE: "care",     // a character is in trouble
  NOTE: "note",     // a standing fact worth glancing at
};

/** Long enough that somebody has genuinely stopped playing rather
    than merely thought for a moment. Deliberately shorter than
    protocol.js's IDLE_MS, which drives the Warden's desk panel: on
    a phone the entry has to earn its four hundred pixels, and two
    minutes of silence from one player at a table of five is worth
    less than four minutes of it. */
export const QUIET_MS = 4 * 60 * 1000;

/** Stress at which a panic check stops being unlikely. Not a rule —
    RAW panics on 2d10 over Stress, so 15 is simply the point past
    which most rolls fail. */
const STRESS_HIGH = 15;

const mins = (ms) => Math.max(1, Math.round(ms / 60000));

/**
 * What is the table waiting on the Warden for, most-stopped first.
 *
 * Every argument is optional and every one of them can be missing in
 * a legitimate configuration — a local table has no `waiting` map, an
 * unhosted one has no `unread`, and a session that has not started
 * has no crew. Nothing here may throw on any of those: this renders
 * on the surface a Warden looks at while somebody is mid-sentence,
 * and a crash there costs the evening.
 *
 * @param {object}   a.g          the authoritative game
 * @param {object}   a.waiting    protocol.js waitingRoom(), if hosted
 * @param {object}   a.safetyCall the card, if it is up
 * @param {number}   a.unread     whispers the Warden has not read
 * @param {number}   a.now        clock, injectable for tests
 * @returns {{id: string, tone: string, title: string, note: string, pcId?: string}[]}
 */
export function wardenNow({ g, waiting = {}, safetyCall = null, unread = 0, now = Date.now() } = {}) {
  if (!g || !g.w) return [];

  /* Alone, and before anything else is even computed. See the
     header — this is the point of the function, not a special
     case in it. */
  if (safetyCall) {
    const level = SAFETY_LEVELS[safetyCall.level] || SAFETY_LEVELS.check;
    return [{
      id: "safety",
      tone: TONE.STOP,
      title: level.label.toUpperCase(),
      note: `${level.blurb} Nobody is told who.`,
    }];
  }

  const { w, crew = [], mod, pending, combat } = g;
  const out = [];
  const t = tempoOf(w);
  const nameOf = (id) => {
    const pc = crew.find((c) => c.id === id);
    return (pc && pc.name) || "somebody";
  };

  /* ---- 1. a prompt on somebody's screen ----
     The table's intents queue behind an unanswered roll (see
     decideIntent), so this is the single condition under which
     every other player's buttons have genuinely stopped working. */
  if (pending) {
    const owner = (pending.req && pending.req.pcId) || pending.pcId || null;
    out.push({
      id: "pending",
      tone: TONE.STOP,
      pcId: owner || undefined,
      title: owner ? `${nameOf(owner)} has not answered` : "A prompt is open",
      note: owner
        ? "Everyone else's taps are queued behind this one."
        : "Nobody owns this prompt, so it is yours to resolve.",
    });
  }

  /* ---- 2. a brake the Warden put on and may have forgotten ----
     Both of these are deliberate acts that stop the table, and both
     are invisible from the Warden's own screen once the drawer is
     shut. A hold nobody remembers taking is the commonest way an
     evening stalls. */
  if (t.breather || t.held) {
    const why = t.breather ? "breather" : "held";
    out.push({
      id: `brake-${why}`,
      tone: TONE.STOP,
      title: t.breather ? "The table is on a break" : "You are holding the table",
      note: WAIT_TEXT[why] || "Nobody can act until you let go.",
    });
  }

  /* ---- 3. whose go ---- */
  const turn = combat ? currentTurn(combat) : null;
  if (turn) {
    out.push({
      id: "turn",
      tone: TONE.TURN,
      pcId: turn.side === "pc" ? turn.id : undefined,
      title: turn.side === "pc"
        ? `${turn.name || nameOf(turn.id)} — their go`
        : `${turn.name || "It"} — your go`,
      note: `Round ${combat.round}.`,
    });
  }

  /* ---- 4. a character in trouble ----
     Health and Stress only. Not conditions, not Panic effects, not
     what they are carrying: those are things the Warden looks up
     when they matter, and a list that includes everything is a list
     nobody reads. */
  for (const pc of crew) {
    if (pc.alive === false) continue;
    const hurt = pc.maxHealth > 0 && pc.health <= Math.floor(pc.maxHealth / 3);
    const strung = (pc.stress || 0) >= STRESS_HIGH;
    if (!hurt && !strung) continue;
    out.push({
      id: `hurt-${pc.id}`,
      tone: TONE.CARE,
      pcId: pc.id,
      title: pc.name,
      note: [
        hurt ? `Health ${pc.health}/${pc.maxHealth}` : null,
        strung ? `Stress ${pc.stress}` : null,
      ].filter(Boolean).join(" · "),
    });
  }

  /* ---- 5. a clock about to land ----
     Two minutes rather than five: a countdown a Warden learns about
     with five minutes on it is one they will be reminded of twice
     more before it fires, and an entry that repeats is an entry
     people stop reading. Paused ones are excluded — a held clock is
     not about to do anything. */
  for (const [id, c] of Object.entries((w && w.countdowns) || {})) {
    if (!c || c.paused) continue;
    if (typeof c.left !== "number" || c.left > 2) continue;
    out.push({
      id: `cd-${id}`,
      tone: TONE.TURN,
      title: `${id.toUpperCase()} — ${c.left}m`,
      note: "This fires on its own.",
    });
  }

  /* ---- 6. somebody who has gone quiet ----
     Only ever computed from the host's own timings. A player who
     has never acted has no `since` and does not appear: on a table
     that started ninety seconds ago that would be everybody. */
  for (const [pcId, state] of Object.entries(waiting || {})) {
    if (!state || state.state === "out") continue;
    if (typeof state.since !== "number" || state.since < QUIET_MS) continue;
    out.push({
      id: `quiet-${pcId}`,
      tone: TONE.NOTE,
      pcId,
      title: `${nameOf(pcId)} — ${mins(state.since)}m`,
      note: state.state === "held" || state.state === "blocked"
        ? "Waiting on the table, not on themselves."
        : "Nothing is stopping them.",
    });
  }

  /* ---- 7. the party is in two places ----
     Last, and a note rather than a call, because a split party is
     a decision the players made and not a problem to be solved.
     It is here because it is the fact most easily lost on a small
     screen: the room name at the top is one room. */
  if (isSplit(crew, w)) {
    out.push({
      id: "split",
      tone: TONE.NOTE,
      title: "The party is split",
      note: partySummary(crew, w, mod)
        .map((grp) => `${grp.name}: ${grp.who.map((p) => p.name).join(", ") || "nobody"}`)
        .join(" · "),
    });
  }

  if (unread > 0) {
    out.push({
      id: "unread",
      tone: TONE.NOTE,
      title: `${unread} unread`,
      note: unread === 1 ? "A player said something to you." : "Players said something to you.",
    });
  }

  return out;
}

export default wardenNow;
