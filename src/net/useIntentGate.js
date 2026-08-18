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

/** How long to keep the UI quiet if nothing at all comes back. Long
    enough to cover a slow relay, short enough that a dropped packet
    doesn't strand the player. */
export const INTENT_TIMEOUT_MS = 3500;

export function useIntentGate(send, seq, timeoutMs = INTENT_TIMEOUT_MS) {
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

  const land = useCallback(() => { ref.current = null; setInFlight(null); }, []);

  // The world moved, so whatever we sent has landed (or was overtaken
  // by someone else's action, which is equally a reason to re-enable).
  useEffect(() => { land(); }, [seq, land]);

  useEffect(() => {
    if (!inFlight) return;
    const t = setTimeout(land, timeoutMs);
    return () => clearTimeout(t);
  }, [inFlight, timeoutMs, land]);

  const gated = useCallback((msg) => {
    if (!msg || msg.t !== "intent") return send(msg);
    if (ref.current) { setIgnored((n) => n + 1); return false; }
    const entry = { action: msg.action, at: Date.now() };
    ref.current = entry;
    setInFlight(entry);
    const ok = send(msg);
    // A socket that refused the write is not a pending action.
    if (!ok) land();
    return ok;
  }, [send, land]);

  return { send: gated, inFlight, busy: !!inFlight, ignored, clear: land };
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
};

export const intentLabel = (action) => LABELS[action] || "Working";
