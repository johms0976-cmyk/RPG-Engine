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

export default function Spotlight({ spot, onDone, onNotMe = null }) {
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
        {/* THE ONE CORRECTION THE EMPTY CHAIR HAS, MADE PRESSABLE.

            `C_DISPUTE` has existed since 2.7.0. The relay has always
            forwarded it, `useHost.disputeMove` has always acted on
            it, and `useDirector`'s ledger has always been waiting
            for it — and no screen in the application ever sent one.
            The correction the wardenless design leans on hardest
            was, for three versions, a message with no button.

            It belongs here because this is the moment the empty
            chair is unambiguously pointing at a person, and because
            a person with a Warden simply says "that is not what I
            meant" out loud. Small and to one side: it is an escape
            hatch, not the point of the card.

            Absent rather than disabled when there is nobody to
            hear it — see the switcher in tests/wardenless.test.jsx
            for why this codebase does not ship disabled controls. */}
        {onNotMe && (
          <button
            type="button"
            className="spotlight-not"
            onClick={onNotMe}
          >
            Not what I meant
          </button>
        )}
      </div>
    </div>
  );
}
