/* ============================================================
   useIntentGate — one intent in the air at a time.

   The problem this exists for is invisible from a phone. Every
   player action is fire-and-forget: `send({t:"intent"})` returns
   immediately and nothing on screen changes until a snapshot comes
   back. Usually that is milliseconds and nobody notices. But the
   host holds the queue whenever another player has been asked to
   roll — decideIntent returns "wait", the job sits there, and the
   phone that sent it looks exactly like a phone whose button is
   broken. So you tap it again. And again. Then the roll resolves
   and all four taps run: four searches, four turns of the clock.

   The fix is to make the wire visible. One intent goes out, the
   button set goes quiet, and it stays quiet until the world moves
   (a new snapshot seq), the host refuses (a denial), or we give up
   waiting. Anything tapped in between is dropped and counted, so
   the UI can say "still waiting" rather than swallowing it.

   Deliberately *not* a queue. If you tap Search three times while
   the table is blocked you meant to search once and were checking
   whether the app was alive; replaying all three is never what you
   wanted.
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from "react";

/* ============================================================
   HOW LONG TO WAIT, WHEN NOTHING COMES BACK

   This was a fixed 3500ms, which is a guess about a network that
   is not the network the table is on. On a congested phone hotspot
   the gate reopens before the host has answered and the player
   taps again — reintroducing the exact double-action this hook
   exists to prevent. On a good wired LAN it holds the buttons shut
   for three seconds longer than it needs to.

   So: measure. Every intent that lands gives us one round trip.
   We keep a short rolling median (median, not mean, because one
   phone waking from sleep should not move the estimate for the
   rest of the session) and wait a generous multiple of it —
   floored, so a very fast LAN does not make the gate hair-trigger,
   and capped, so a single terrible sample cannot strand a player
   for a minute.

   The starting value is the old constant, because before the first
   round trip a guess is all anybody has.
   ============================================================ */
export const INTENT_TIMEOUT_MS = 3500;
export const INTENT_TIMEOUT_MIN = 1200;
export const INTENT_TIMEOUT_MAX = 12000;
/** How much slack over the observed round trip. Four is roughly
    "the host is busy with two other players and one of them is
    mid-roll", which is the common case for a slow answer. */
export const INTENT_TIMEOUT_FACTOR = 4;
/** How many samples the estimate is made of. Eight is about a
    minute of play — recent enough to track the wifi getting worse. */
const RTT_SAMPLES = 8;

/* ============================================================
   TELLING THE HOST THAT A TAP WAS EATEN

   The gate has always done two of the three right things with a
   swallowed tap: it drops it, and it tells the player it was
   heard. The third — telling the *host* — was missing, and it is
   the one that matters for anybody other than the tapper.

   A swallowed tap is not noise. It is the only unambiguous
   evidence in the whole system that somebody wanted to act and
   was beaten to it: an idle player might be enjoying the ride, a
   player with three eaten taps is being outrun. engine/floor.js
   weights it accordingly, and could not exist without this line.

   Throttled, because the failure mode this hook exists for is
   somebody tapping a dead-looking button six times in a row, and
   six reports of one frustration is still one frustration. The
   message carries an action name and nothing else; the relay
   attaches the character, so a phone cannot report on anybody's
   behalf but its own.
   ============================================================ */
export const TAP_REPORT_MS = 1000;

export function medianOf(list) {
  if (!list || !list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** The wait, given what the wire has actually been doing. */
export function timeoutFor(samples, fallback = INTENT_TIMEOUT_MS) {
  const m = medianOf(samples);
  if (m == null) return fallback;
  return Math.max(INTENT_TIMEOUT_MIN, Math.min(INTENT_TIMEOUT_MAX, m * INTENT_TIMEOUT_FACTOR));
}

export function useIntentGate(send, seq, timeoutMs, onTap) {
  // { action, at } while an intent is outstanding, else null.
  const [inFlight, setInFlight] = useState(null);
  // Bumped every time a tap is swallowed, so the UI can react without
  // needing to know what was tapped.
  const [ignored, setIgnored] = useState(0);
  /* The ref is written synchronously rather than mirrored from state on
     render. Two taps in the same tick are exactly the case this hook
     exists for, and React has not re-rendered between them — a ref that
     only catches up at render time would let the second one through. */
  const ref = useRef(null);
  /* Observed round trips, newest last. A ref rather than state: the
     estimate changing is not a reason to repaint anything. */
  const rtts = useRef([]);
  const [wait, setWait] = useState(timeoutMs || INTENT_TIMEOUT_MS);
  /* Last time we told the host a tap was eaten. A ref: reporting is
     not a reason to repaint anything. */
  const reported = useRef(0);

  const land = useCallback((measured) => {
    const entry = ref.current;
    if (entry && measured) {
      const rtt = Date.now() - entry.at;
      // A round trip longer than the cap is a lost packet, not a slow
      // one, and folding it into the estimate punishes everybody.
      if (rtt > 0 && rtt < INTENT_TIMEOUT_MAX) {
        rtts.current = [...rtts.current, rtt].slice(-RTT_SAMPLES);
        if (!timeoutMs) setWait(timeoutFor(rtts.current));
      }
    }
    ref.current = null;
    setInFlight(null);
  }, [timeoutMs]);

  // The world moved, so whatever we sent has landed (or was overtaken
  // by someone else's action, which is equally a reason to re-enable).
  // Either way it is a real observation of how long the wire took.
  useEffect(() => { land(true); }, [seq, land]);

  useEffect(() => {
    if (!inFlight) return;
    const t = setTimeout(() => land(false), wait);
    return () => clearTimeout(t);
  }, [inFlight, wait, land]);

  const gated = useCallback((msg) => {
    if (!msg || msg.t !== "intent") return send(msg);
    /* THE TAP IS ACKNOWLEDGED BEFORE THE WIRE IS.

       Everything below this line is about the network. This line
       is not: it fires synchronously, on the tap, whether the
       intent is about to go out or about to be swallowed. A
       swallowed tap and a broken button were indistinguishable
       from the sofa, and the player's response to both is to tap
       again — which is the exact behaviour this hook exists to
       prevent. Telling them "yes, received, still waiting" costs
       one callback and removes the reason to. */
    if (onTap) { try { onTap(msg.action, !!ref.current); } catch { /* never break a tap */ } }
    if (ref.current) {
      setIgnored((n) => n + 1);
      const at = Date.now();
      if (at - reported.current >= TAP_REPORT_MS) {
        reported.current = at;
        // Never break a tap for the sake of telemetry about taps.
        try { send({ t: "tap", action: msg.action }); } catch { /* ignore */ }
      }
      return false;
    }
    const entry = { action: msg.action, at: Date.now() };
    ref.current = entry;
    setInFlight(entry);
    const ok = send(msg);
    // A socket that refused the write is not a pending action, and
    // it is certainly not a measurement of anything.
    if (!ok) land(false);
    return ok;
  }, [send, land, onTap]);

  return {
    send: gated, inFlight, busy: !!inFlight, ignored,
    clear: () => land(false),
    /* What the wire is actually doing, for the reconnect strip: a
       phone that is merely slow should say so differently from a
       phone that has lost the host. */
    rtt: medianOf(rtts.current), timeout: wait,
  };
}

/** Plain-language label for the strip. Engine action names are not
    written for players to read. */
const LABELS = {
  doMove: "Moving", doSearch: "Searching", useItem: "Using that",
  deviceAction: "Working the terminal", askNpc: "Talking", doFreeAction: "Acting",
  attackWith: "Attacking", reloadWeapon: "Reloading", aim: "Aiming",
  combatMove: "Moving", setTarget: "Taking aim", useCounter: "Countering",
  fleeCombat: "Running", endPcTurn: "Ending your turn",
  doRest: "Resting", offerRest: "Resting", applyLevel: "Levelling up",
  resolvePending: "Rolling", buy: "Buying", sell: "Selling",
  runAction: "Acting",
  pinClue: "Pinning that", unpinClue: "Clearing that",
  setClueResolved: "Updating the board", addMark: "Marking the map",
  removeMark: "Clearing the mark",
  giveItem: "Handing that over",
  offerItem: "Holding it out",
  acceptTrade: "Taking it",
  declineTrade: "Leaving it",
  linkClues: "Drawing a thread",
  unlinkClues: "Cutting a thread",
  endSceneTurn: "Passing it on",
  passSceneTurn: "Hanging back",
  jumpIn: "Cutting in",
  /* Deliberately neutral. The strip is on the sharer's own phone and
     nobody else's, but a label that said "Telling the truth" or
     "Lying" would be the software taking a view on a move whose whole
     point is that it does not know. */
  shareSecret: "Speaking up",
};

export const intentLabel = (action) => LABELS[action] || "Working";
