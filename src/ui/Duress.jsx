/* ============================================================
   DURESS — the thing that makes a player look up.

   PlayerStatus answers "am I hurt" with a meter, which is the
   right answer to a slow question and the wrong answer to a fast
   one. A meter that has gone from eight pips to three does not
   make anybody raise their head, and on six separate handsets
   there is no equivalent of the Warden leaning across the table
   and saying "it has your arm".

   So the phone itself changes. Not a badge, not a line in the
   log — the edges of the screen. A frame that is impossible to
   read past, a tag naming the loudest thing, and at the top
   level a slow pulse that will not sit still.

   Three rules keep it from becoming wallpaper:

     · it is derived, never stored. engine/duress.js reads the
       world fresh; nothing has to be maintained by the Warden
       and nothing can be left switched on by accident.
     · it only buzzes on the way UP. Getting worse is news.
       Staying bad is not, and a phone that vibrates every render
       is a phone in a pocket.
     · level 3 is hard to reach. If everything is critical then
       nothing is.

   All of it honours prefers-reduced-motion, because a pulsing
   red frame is exactly the effect that rule exists for.
   ============================================================ */
import React, { useEffect, useRef } from "react";
import { DURESS, duressRose } from "../engine/duress.js";

/** Vibration patterns, quietest first. Level 1 does not buzz at all —
    being in a fight is not news to somebody who is in a fight. */
const BUZZ = {
  [DURESS.PRESSED]: [30, 50, 30],
  [DURESS.CRITICAL]: [60, 40, 60, 40, 120],
};

export default function Duress({ duress, muted = false }) {
  const prev = useRef(null);

  useEffect(() => {
    if (!duress) return;
    if (!muted && duressRose(prev.current, duress) && navigator.vibrate) {
      navigator.vibrate(BUZZ[duress.level] || BUZZ[DURESS.PRESSED]);
    }
    prev.current = duress;
  }, [duress, muted]);

  if (!duress || duress.level < DURESS.EXPOSED) return null;

  return (
    /* aria-hidden on the frame, because the same facts are already
       announced properly by PlayerStatus and the feed — a screen
       reader does not need the decoration read to it as well. The
       headline below is the exception: it is the one thing here that
       is information rather than emphasis. */
    <div className={`duress is-${duress.name}`} data-level={duress.level}>
      <span className="duress-frame" aria-hidden="true" />

      {duress.level >= DURESS.PRESSED && (
        <div className="duress-tags" role="status" aria-live="polite">
          {duress.headline && <strong className="duress-head">{duress.headline}</strong>}
          <span className="duress-chips" aria-hidden="true">
            {duress.tags.map((t) => <i key={t}>{t}</i>)}
          </span>
        </div>
      )}
    </div>
  );
}
