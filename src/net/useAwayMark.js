/* ============================================================
   AWAY — where you were when you stopped watching.

   ------------------------------------------------------------
   THE PROBLEM

   Somebody goes to the kitchen. They are gone four minutes, come
   back, and the feed has moved on by twenty lines. What they do
   next is ask the table "what did I miss", and the table stops
   playing to tell them — which costs everybody the thing the
   person who left already lost.

   `tempo.js` has built `buildRecap` since 2.11 and it takes a
   `sinceId`. It has only ever been called with the WARDEN's
   mark, for the whole table at once. A player who wants their own
   catch-up has no way to ask for one, and the machinery to give
   them one has been sitting there the entire time.

   ------------------------------------------------------------
   WHAT MARKS "AWAY"

   Not a button. Asking somebody to press "I am leaving" before
   they go to the kitchen is asking them to plan an interruption,
   and nobody does.

   The browser already knows. A phone that locks, a tab that goes
   to the background, an app switched away from — all of these
   fire `visibilitychange`, and every one of them means the same
   thing: this person stopped being able to see the feed. So the
   mark is set when the page hides and read when it shows again.

   ------------------------------------------------------------
   THE THRESHOLDS, AND WHY THEY ARE NOT ZERO

   Two, and both exist to stop the card appearing when nothing
   was missed.

   AWAY_MIN_MS — glancing at a notification is not leaving. Under
   this, the mark is discarded on return and nothing is offered.

   AWAY_MIN_LINES — being away for ten minutes of a quiet scene
   in which two atmosphere lines fired is not missing anything.
   A recap that says "you missed: the lights flicker" teaches
   people the feature is noise.

   Both fail toward silence. An offer that does not appear costs
   nothing; one that appears when the table was idle costs the
   trust that makes somebody tap it the time it matters.
   ============================================================ */
import { useEffect, useRef, useState } from "react";

/** Four minutes of a phone in a pocket is a kitchen trip. Forty
 *  seconds is a notification. */
export const AWAY_MIN_MS = 45000;

/** Fewer than this and there is nothing worth reading back. */
export const AWAY_MIN_LINES = 4;

/**
 * @param feed      the client's own (already redacted) feed
 * @param active    whether play is actually running
 * @returns {{ sinceId: number|null, missed: number, clear: function }}
 *          `sinceId` is null when there is nothing to offer.
 */
export function useAwayMark(feed, active) {
  const [mark, setMark] = useState(null);
  const away = useRef(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    if (!active) return undefined;
    if (typeof document === "undefined") return undefined;

    const lastId = () => {
      const f = feedRef.current;
      return f && f.length ? (f[f.length - 1].id || 0) : 0;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        /* Where they were when the screen went dark. */
        away.current = { at: Date.now(), id: lastId() };
        return;
      }
      const gone = away.current;
      away.current = null;
      if (!gone) return;
      if (Date.now() - gone.at < AWAY_MIN_MS) return;

      const f = feedRef.current || [];
      const missed = f.filter((l) => (l.id || 0) > gone.id).length;
      if (missed < AWAY_MIN_LINES) return;

      setMark({ sinceId: gone.id, missed });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active]);

  /* Play ending clears it — a catch-up offer surviving into the
     end card would be asking somebody to review a session that is
     already over. */
  useEffect(() => { if (!active) setMark(null); }, [active]);

  return {
    sinceId: mark ? mark.sinceId : null,
    missed: mark ? mark.missed : 0,
    clear: () => setMark(null),
  };
}

export default useAwayMark;
