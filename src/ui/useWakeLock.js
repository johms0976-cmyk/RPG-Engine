/* ============================================================
   THE SCREEN DOES NOT SLEEP

   The cheapest fix in the repository for the configuration this
   engine is actually played in: a PC on a television, and five or
   six phones face-down on a sofa.

   What happened without it. The spotlight fires. The phone in
   somebody's lap buzzes. By the time they have picked it up the
   screen has locked, so they unlock, land wherever the OS left
   them, and the table waits. Four hours, six players, and the
   single most common interruption of the evening is a lock screen.

   ------------------------------------------------------------
   THE PART EVERYONE FORGETS

   The sentinel is released by the browser whenever the document
   stops being visible, and it is NOT reacquired when it comes
   back. A hook that only requests on mount therefore works
   perfectly for about ninety seconds and then silently stops,
   which is worse than not having it — nobody reports a feature
   that used to work.

   So the visibilitychange listener is the load-bearing half. A
   phone going in and out of a pocket is the normal case here, not
   an edge one.

   ------------------------------------------------------------
   WHAT IT DOES NOT DO

   No fallback. iOS Safari below 16.4 has no Wake Lock API and the
   usual workaround is a muted looping video, which holds the
   screen awake by keeping the decoder hot and costs more battery
   than the problem it solves — on a four-hour session, on a phone
   nobody thought to bring a cable for. Those tables get haptics
   and a lock screen, and we say so rather than shipping a hack
   that quietly flattens them by act three.

   A refusal is not an error either. Battery saver refuses. A tab
   with no user gesture yet refuses. Both are the browser doing its
   job, and neither is worth a message on a screen in the middle of
   a horror game.
   ============================================================ */
import { useEffect, useRef } from "react";

/** True where the API exists at all. Exported so a screen can say
    "this phone will dim" once, in the lobby, rather than a table
    discovering it mid-scene. */
export const wakeLockSupported = () =>
  typeof navigator !== "undefined" && !!navigator.wakeLock;

/**
 * Hold the screen awake for as long as `active` is true.
 *
 * @param {boolean} active
 */
export default function useWakeLock(active) {
  const held = useRef(null);

  useEffect(() => {
    if (!active || !wakeLockSupported()) return undefined;
    if (typeof document === "undefined") return undefined;

    let live = true;

    const drop = () => {
      const s = held.current;
      held.current = null;
      if (s) { try { s.release(); } catch { /* already gone */ } }
    };

    const request = () => {
      if (!live || held.current) return;
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then((s) => {
        /* Unmounted while the promise was in flight. Releasing here
           rather than storing it is the difference between a clean
           unmount and a phone that stays lit after the session ends. */
        if (!live) { try { s.release(); } catch { /* fine */ } return; }
        held.current = s;
        /* The browser can take it back for reasons of its own —
           low battery, a system dialog. Clearing the ref means the
           next visibility change asks again instead of believing it
           still has one. */
        s.addEventListener("release", () => {
          if (held.current === s) held.current = null;
        });
      }).catch(() => { /* refused: battery saver, no gesture, policy */ });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") request();
      else held.current = null; // the browser has already released it
    };

    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      drop();
    };
  }, [active]);
}
