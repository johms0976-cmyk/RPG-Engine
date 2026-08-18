/* ============================================================
   SPOTLIGHT — eye contact, for a room where everyone is looking
   down.

   The failure it fixes is specific and happens at every table
   with phones on it. The Warden says "Riley, what are you
   doing?" and Riley does not look up, because Riley is reading
   their inventory and four other people are also being talked
   to by the same voice. At a table without screens this is
   solved by looking at someone. There was no equivalent.

   So the Warden taps a name and that phone — only that phone —
   buzzes, brightens, and says who is waiting. It carries no game
   state, changes nothing, and cannot be used to make anyone do
   anything. It is punctuation.

   It fades on its own after a few seconds. A permanent marker
   would become wallpaper by the second hour, and the whole value
   is that it is rare.
   ============================================================ */
import React, { useEffect, useState } from "react";

export const SPOTLIGHT_MS = 5200;

export default function Spotlight({ spot, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!spot) return undefined;
    setLeaving(false);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    const fade = setTimeout(() => setLeaving(true), SPOTLIGHT_MS - 600);
    const gone = setTimeout(() => onDone && onDone(), SPOTLIGHT_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [spot, onDone]);

  if (!spot) return null;

  return (
    <div className={`spotlight${leaving ? " is-leaving" : ""}`} role="status" aria-live="assertive">
      <div className="spotlight-inner">
        <span className="spotlight-eye" aria-hidden="true" />
        <strong>The Warden is looking at you.</strong>
        {spot.text && <span className="spotlight-text">{spot.text}</span>}
      </div>
    </div>
  );
}
