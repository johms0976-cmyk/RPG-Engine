/* ============================================================
   PROTOCOL — the entire vocabulary spoken between the host tab
   and the phones. Both sides import this file, so a message
   shape can never drift out of sync between them.

   Design rule: phones compute nothing. They send an intent and
   render whatever snapshot comes back. All authority lives in
   the one useGame instance running in the host tab.
   ============================================================ */

import { tempoVerdict, tempoOf, sceneHolder, sceneHolders, canJumpIn } from "../engine/tempo.js";

export const PROTOCOL_VERSION = 2;

/* client -> server -> host */
export const C_HELLO = "hello";     // { name, clientId }
export const C_CLAIM = "claim";     // { pcId }  ("" releases)
export const C_INTENT = "intent";   // { action, args, asPc }
export const C_SUBMIT = "submit";   // { character }  a phone offers a character
export const C_WITHDRAW = "withdraw"; // {}  the phone takes its offer back
/* A player speaking to the Warden and nobody else. The mirror of
   H_WHISPER, and the half that was missing: "I quietly pocket the
   keycard" is ruined by being said out loud at the table. */
export const C_WHISPER = "playerwhisper"; // { text, replyTo }
/* The X-card. Deliberately carries no identity — see the relay. */
export const C_SAFETY = "safety";   // { level }
/* One player to another, routed by character rather than by phone.
   Paranoia is Mothership's engine and two players plotting is
   content; until now every secret in the game had to pass through
   the Warden, which is the one thing a conspiracy cannot do. */
export const C_PEER = "peerwhisper"; // { toPcId, text }

/* host -> server -> clients */
export const H_SNAPSHOT = "snapshot"; // { seq, phase, modId, state, claims, roster }
export const H_DENIED = "denied";     // { reason }
export const H_WHISPER = "whisper";   // { to, text } — one player only
export const H_ACK = "ack";           // { to, state, reason } — an offer moved
export const H_ASSIGNED = "assigned"; // { to, pcId } — this body is yours now
export const H_SOUND = "sound";       // { to, cue } — a noise in one player's hand
export const H_SPOTLIGHT = "spotlight"; // { to, text } — the Warden looks at you
export const H_CUE = "cue";           // { to, data, mime } — the Warden's own voice
/* Delivered by the relay, not composed by the host: one player's
   words arriving in another player's hand. */
export const H_PEER = "peerwhisper";  // { from, fromPcId, text }
/* The relay's copy for the Warden. Carries text only when the table
   has agreed it should — see S_CONFIG. */
export const H_PEERNOTE = "peernote"; // { fromPcId, toPcId, text? }

/** Every message the host addresses to a single phone. The relay
    forwards anything named here by its `to` field and silently drops
    everything else, so a new host->player message has to be declared
    here before it can travel. */
export const HOST_TO_CLIENT = new Set([
  H_DENIED, H_WHISPER, H_ACK, H_ASSIGNED, H_SOUND, H_SPOTLIGHT, H_CUE,
]);

/** How much of a player-to-player whisper the Warden is shown. The
    host tells the relay which of these the table agreed to, and the
    relay — not the host — decides what to forward. A promise not to
    look is weaker than never being sent it.

      open   the Warden sees the text
      seen   the Warden is told a whisper happened, and by whom
      dark   the Warden is told nothing at all */
export const PEER_MODES = ["open", "seen", "dark"];
export const S_CONFIG = "config";   // host -> relay { peerWhispers }

/** Levels on the safety card, quietest first. All three are anonymous;
    the difference is only what the table is being asked to do. */
export const SAFETY_LEVELS = {
  check: { label: "Check in", blurb: "Someone would like a pause to check the room is alright." },
  veil: { label: "Veil this", blurb: "Someone would like this to happen off-screen." },
  stop: { label: "Stop this", blurb: "Someone needs this line dropped from the game entirely." },
};

/** Private one-shots the Warden can put in a single player's hand.
    Named here so the phone and the desk cannot drift apart. */
export const SOUND_CUES = {
  knock: { label: "A knock", blurb: "Three knocks, close, on the other side of something." },
  breath: { label: "Breathing", blurb: "Someone else's breath on your channel." },
  scrape: { label: "A scrape", blurb: "Metal moving, slowly, where nothing should be moving." },
  alarm: { label: "Alarm", blurb: "Their handset alarms and nobody else's does." },
  heartbeat: { label: "Heartbeat", blurb: "Your own pulse, suddenly audible." },
};

/** Where the Warden's screen is in the evening.
      title  — module loaded, nothing gathered
      lobby  — the table is assembling: phones building, Warden approving
      create — the Warden is building the crew on the desk instead
      play   — a session exists
    Phones are told this so they can say something truer than
    "waiting…" while nothing is happening yet. */
export const PHASES = ["title", "lobby", "create", "play"];

/* server -> everyone */
export const S_WELCOME = "welcome";   // { clientId, isHost, peers }
/* The relay confirming a character is yours. This exists because the
   phones' roster no longer carries clientId (§9.2) — a phone used to
   confirm its own claim by finding itself in the broadcast list, and
   with the identifier gone there is nothing in that list to match on.
   An explicit ack to the one socket concerned is both cheaper and
   less ambiguous than inferring it from a name. */
export const S_CLAIMED = "claimed";   // { pcId }
export const S_PEERS = "peers";       // { peers }
export const S_HOSTGONE = "hostgone";

/** The only functions a phone is ever allowed to invoke on the host.
    Anything absent from this list is rejected server-side and again
    host-side. Adding an engine action to the game does not silently
    expose it to the network — you have to name it here. */
export const PLAYER_ACTIONS = new Set([
  "doMove", "doSearch", "useItem", "deviceAction", "askNpc", "doFreeAction",
  "attackWith", "reloadWeapon", "aim", "combatMove", "setTarget", "useCounter",
  "fleeCombat", "endPcTurn",
  "doRest", "offerRest", "applyLevel",
  "resolvePending", "buy", "sell",
  // A room/module action, named by id. The host looks the id up in the
  // module and re-checks its `when` before running anything, so this
  // is not a channel for a phone to post arbitrary effects.
  "runAction",
  // The board is the crew's own record, so writing to it is a player right.
  "pinClue", "unpinClue", "setClueResolved", "addMark", "removeMark",
  // Handing something to the person next to you is not an engine
  // privilege, it is the most ordinary thing at a table.
  "giveItem",
  /* Offer -> accept, so a mis-tap in a firefight does not put the
     vibe check in the wrong hands. `giveItem` is kept for the
     Warden and for tables that turn confirmation off. */
  "offerItem", "acceptTrade", "declineTrade",
  // Threads on the clue board. The board is the crew's own record,
  // and so is what they think connects to what.
  "linkClues", "unlinkClues",
  // "I'm done" in an out-of-combat scene round. Passing the spotlight
  // has to be a player's own move or the Warden is a traffic light.
  "endSceneTurn", "passSceneTurn",
  /* "I want to react to that." The inverse of passing, and the only
     out-of-combat way for a player to be responsive rather than
     merely next — see JUMPING IN in engine/tempo.js. Rate-limited
     by the engine to once per player per round, not by the network. */
  "jumpIn",
]);

/** Actions a player may fire even when it is not their turn in combat.
    Everything else waits for the initiative order. */
export const OUT_OF_TURN = new Set([
  "resolvePending", "applyLevel", "useItem", "askNpc",
  // Passing the flashlight mid-firefight is exactly when it matters.
  "giveItem", "offerItem",
  // Taking what someone is holding out to you is never a turn.
  "acceptTrade", "declineTrade",
  // Writing something down is never an action that costs a turn.
  "pinClue", "unpinClue", "setClueResolved", "addMark", "removeMark",
  "linkClues", "unlinkClues",
]);

/** Who is a pending prompt addressed to? Rolls and opt-in Stress both
    carry the character they belong to; anything else is unowned and
    goes to the Warden. */
export function pendingOwner(pending) {
  if (!pending) return null;
  if (pending.kind === "optStress") return pending.pcId || null;
  if (pending.kind === "roll") return (pending.req && pending.req.pcId) || null;
  return null;
}

/** Who is the whole table waiting on? A pending roll addressed to one
    player stalls every other player's intents in the host queue — which
    is invisible from a phone, so it looks like the buttons have stopped
    working. Naming the culprit turns a bug report into a turn. */
export function blockedBy(state, myPcId) {
  if (!state) return null;
  const owner = pendingOwner(state.pending);
  if (!owner || owner === myPcId) return null;
  const pc = (state.crew || []).find((c) => c.id === owner);
  return (pc && pc.name) || "another player";
}

/** Trim a live game down to what travels. The module itself never goes
    over the wire — every client already has it compiled in, so we send
    an id and rehydrate on the other side. Saves ~200KB a message. */
export function packSnapshot({ seq, phase, mod, g, claims, roster, lobby, safety, table, waiting }) {
  return {
    t: H_SNAPSHOT,
    v: PROTOCOL_VERSION,
    seq,
    phase,
    modId: mod ? mod.id : null,
    claims,
    roster,
    /* Lines and veils agreed in the lobby. Every phone gets these in
       full: they are the table's contract with itself, and a contract
       one party cannot read is not one. */
    safety: safety || { lines: [], veils: [], enabled: true },
    /* Whatever the Warden has deliberately put in the middle of the
       table — currently a handout everyone is being shown at once. */
    table: table || null,
    /* Per-player state as the host sees it: acting, held, blocked,
       idle. The Warden's "waiting on" panel reads this, and so does
       each phone, so nobody has to guess why a button went quiet. */
    waiting: waiting || {},
    // Characters approved but not yet playing. Only names and owners —
    // it exists so a phone waiting in the lobby can see the table filling
    // up rather than staring at a spinner.
    lobby: (lobby || []).map((c) => ({ id: c.id, name: c.name, cls: c.cls })),
    state: g
      ? {
          clues: g.w.clues || [],
          marks: g.w.marks || [],
          w: g.w,
          crew: g.crew,
          activeId: g.activeId,
          feed: g.feed.slice(-120),
          pending: g.pending,
          combat: g.combat,
          resting: g.resting,
          levelUp: g.levelUp,
          shopping: g.shopping,
          lastRoll: g.lastRoll,
          houseRules: g.houseRules,
        }
      : null,
  };
}

/* KEPT, BUT NO LONGER AN IDENTITY.

   Client-generated ids were the credential in §9.2: broadcast to
   every phone in the roster, accepted by the relay without checking,
   and therefore replayable by anyone who read one. The relay assigns
   clientIds now (see server/host.mjs) and a phone proves continuity
   with the private resume key in net/session.js instead.

   This remains only for local, non-networked uses — the solo and
   probe modes label a single notional client — and is deliberately
   never sent as `hello.clientId` any more. */
export const newClientId = () =>
  `c_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** Should this intent run, wait, or be rejected? Pulled out of the host
    effect so the rules that decide who may act are testable on their own.
    Returns "run" | "wait" | { wait: reason } | "activate" | { deny: reason }.

    Order matters and is deliberate. Ownership and liveness come first
    because they are refusals — a phone acting as someone else's dead
    character is a bug, not a queue. Then the *brakes*, which are holds:
    the table is paused, or it is not this player's go, or they acted a
    second ago. A hold keeps the job in the queue and tells the phone
    what it is waiting for. Only then does combat's turn order refuse,
    because inside a fight acting out of turn genuinely is a mistake
    rather than impatience. */
export function decideIntent({
  game, job, claims, currentTurn, now = Date.now(), lastActed = {},
}) {
  if (!game || !game.crew || !game.crew.length) return { deny: "no-session" };
  if (!PLAYER_ACTIONS.has(job.action)) return { deny: "unknown-action" };
  if (claims[job.asPc] !== job.clientId) return { deny: "not-yours" };

  const me = game.crew.find((c) => c.id === job.asPc);
  if (!me) return { deny: "no-such-pc" };
  if (me.alive === false) return { deny: "dead" };

  // Somebody else has been asked to roll. Hold everything rather than
  // letting a third player act into a half-resolved situation.
  /* Still the bare string, not { wait: "roll" }. This verdict predates
     the brakes below and everything that reads it — including the
     host's own queue — already knows the word. `isWait` accepts both. */
  const owner = pendingOwner(game.pending);
  if (owner && owner !== job.asPc && job.action !== "resolvePending") return "wait";

  /* The Warden's brakes. A held table, a scene round belonging to
     somebody else, a declared break, or a rate limit the table opted
     into. All of them hold rather than refuse. */
  /* `crew` is what turns the single ring into one ring per room
     while the party is split. Passing it here rather than reading
     it inside tempoVerdict keeps that function a pure decision over
     its arguments, and keeps every other caller on the old
     behaviour until it opts in. */
  const brake = tempoVerdict({
    w: game.w, action: job.action, pcId: job.asPc, now, lastActed, crew: game.crew,
  });
  if (brake) return brake;

  if (game.combat && !OUT_OF_TURN.has(job.action)) {
    const turn = currentTurn(game.combat);
    if (!turn || turn.side !== "pc" || turn.id !== job.asPc) return { deny: "not-your-turn" };
  }

  // Engine actions resolve through the *active* character, so it has to
  // be this one before the call is made.
  if (game.activeId !== job.asPc) return "activate";
  return "run";
}

/** Is this verdict a hold rather than an answer? The host queue asks
    this instead of matching on the string, so a new brake does not
    have to be taught to three call sites. */
export const isWait = (v) => v === "wait" || !!(v && typeof v === "object" && v.wait);

/** Why is it holding, in one word. */
export const waitReason = (v) => (v === "wait" ? "roll" : (v && v.wait) || null);

/**
 * What is every connected player's situation, from the host's side?
 * One object, computed once per snapshot, read by the Warden's
 * "waiting on" panel and mirrored to the phones.
 *
 *   acting   it is their go, in combat or in a scene round
 *   rolling  they have a prompt on their screen
 *   held     a brake is on, and which
 *   blocked  waiting for another player's roll
 *   idle     nothing is stopping them and they have done nothing
 *            for a while — the Warden's cue to look at somebody
 */
export function waitingRoom({ game, claims, currentTurn, lastActed = {}, now = Date.now() }) {
  const out = {};
  if (!game || !game.crew) return out;

  const t = tempoOf(game.w);
  const owner = pendingOwner(game.pending);
  const holder = sceneHolder(t);
  const holders = sceneHolders(t, game.crew, game.w);
  const turn = game.combat && currentTurn ? currentTurn(game.combat) : null;

  for (const pc of game.crew) {
    if (pc.alive === false) { out[pc.id] = { state: "out" }; continue; }

    const since = now - (lastActed[pc.id] || 0);
    const base = { since: lastActed[pc.id] ? since : null, claimed: !!claims[pc.id] };

    if (owner === pc.id) { out[pc.id] = { ...base, state: "rolling" }; continue; }
    if (owner) { out[pc.id] = { ...base, state: "blocked", by: owner }; continue; }
    if (t.breather) { out[pc.id] = { ...base, state: "held", why: "breather" }; continue; }
    if (t.held) { out[pc.id] = { ...base, state: "held", why: "held" }; continue; }

    if (turn) {
      out[pc.id] = turn.side === "pc" && turn.id === pc.id
        ? { ...base, state: "acting" }
        : { ...base, state: "held", why: "turn" };
      continue;
    }

    if (holder) {
      /* Lanes: with the crew split, several people hold their own
         room at once and the Warden's panel must say so, or it
         reports five players blocked when in fact two are acting. */
      out[pc.id] = holders.includes(pc.id)
        ? { ...base, state: "acting" }
        : { ...base, state: "held", why: "scene", canJump: canJumpIn(t, pc.id) };
      continue;
    }

    if (t.rateMs > 0 && since < t.rateMs) { out[pc.id] = { ...base, state: "held", why: "rate" }; continue; }

    out[pc.id] = { ...base, state: lastActed[pc.id] && since > IDLE_MS ? "idle" : "open" };
  }

  return out;
}

/** How long a player has to be doing nothing before the Warden's panel
    calls it idle. Four minutes is roughly the point at which someone
    has stopped playing and started reading their phone. */
export const IDLE_MS = 4 * 60 * 1000;
