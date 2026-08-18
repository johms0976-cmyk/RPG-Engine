/* ============================================================
   PROTOCOL — the entire vocabulary spoken between the host tab
   and the phones. Both sides import this file, so a message
   shape can never drift out of sync between them.

   Design rule: phones compute nothing. They send an intent and
   render whatever snapshot comes back. All authority lives in
   the one useGame instance running in the host tab.
   ============================================================ */

export const PROTOCOL_VERSION = 1;

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

/* host -> server -> clients */
export const H_SNAPSHOT = "snapshot"; // { seq, phase, modId, state, claims, roster }
export const H_DENIED = "denied";     // { reason }
export const H_WHISPER = "whisper";   // { to, text } — one player only
export const H_ACK = "ack";           // { to, state, reason } — an offer moved
export const H_ASSIGNED = "assigned"; // { to, pcId } — this body is yours now
export const H_SOUND = "sound";       // { to, cue } — a noise in one player's hand
export const H_SPOTLIGHT = "spotlight"; // { to, text } — the Warden looks at you

/** Every message the host addresses to a single phone. The relay
    forwards anything named here by its `to` field and silently drops
    everything else, so a new host->player message has to be declared
    here before it can travel. */
export const HOST_TO_CLIENT = new Set([
  H_DENIED, H_WHISPER, H_ACK, H_ASSIGNED, H_SOUND, H_SPOTLIGHT,
]);

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
]);

/** Actions a player may fire even when it is not their turn in combat.
    Everything else waits for the initiative order. */
export const OUT_OF_TURN = new Set([
  "resolvePending", "applyLevel", "useItem", "askNpc",
  // Passing the flashlight mid-firefight is exactly when it matters.
  "giveItem",
  // Writing something down is never an action that costs a turn.
  "pinClue", "unpinClue", "setClueResolved", "addMark", "removeMark",
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
export function packSnapshot({ seq, phase, mod, g, claims, roster, lobby, safety, table }) {
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

export const newClientId = () =>
  `c_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** Should this intent run, wait, or be rejected? Pulled out of the host
    effect so the rules that decide who may act are testable on their own.
    Returns "run" | "wait" | "activate" | { deny: reason }. */
export function decideIntent({ game, job, claims, currentTurn }) {
  if (!game || !game.crew || !game.crew.length) return { deny: "no-session" };
  if (!PLAYER_ACTIONS.has(job.action)) return { deny: "unknown-action" };
  if (claims[job.asPc] !== job.clientId) return { deny: "not-yours" };

  const me = game.crew.find((c) => c.id === job.asPc);
  if (!me) return { deny: "no-such-pc" };
  if (me.alive === false) return { deny: "dead" };

  // Somebody else has been asked to roll. Hold everything rather than
  // letting a third player act into a half-resolved situation.
  const owner = pendingOwner(game.pending);
  if (owner && owner !== job.asPc && job.action !== "resolvePending") return "wait";

  if (game.combat && !OUT_OF_TURN.has(job.action)) {
    const turn = currentTurn(game.combat);
    if (!turn || turn.side !== "pc" || turn.id !== job.asPc) return { deny: "not-your-turn" };
  }

  // Engine actions resolve through the *active* character, so it has to
  // be this one before the call is made.
  if (game.activeId !== job.asPc) return "activate";
  return "run";
}
