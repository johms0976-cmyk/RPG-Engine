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

/* host -> server -> clients */
export const H_SNAPSHOT = "snapshot"; // { seq, phase, modId, state, claims, roster }
export const H_DENIED = "denied";     // { reason }
export const H_WHISPER = "whisper";   // { to, text } — one player only

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
  // The board is the crew's own record, so writing to it is a player right.
  "pinClue", "unpinClue", "setClueResolved", "addMark", "removeMark",
]);

/** Actions a player may fire even when it is not their turn in combat.
    Everything else waits for the initiative order. */
export const OUT_OF_TURN = new Set([
  "resolvePending", "applyLevel", "useItem", "askNpc",
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

/** Trim a live game down to what travels. The module itself never goes
    over the wire — every client already has it compiled in, so we send
    an id and rehydrate on the other side. Saves ~200KB a message. */
export function packSnapshot({ seq, phase, mod, g, claims, roster }) {
  return {
    t: H_SNAPSHOT,
    v: PROTOCOL_VERSION,
    seq,
    phase,
    modId: mod ? mod.id : null,
    claims,
    roster,
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
