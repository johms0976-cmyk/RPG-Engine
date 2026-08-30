/* ============================================================
   WHICH DECK.

   One line of decision, in its own file so that `Play.jsx`'s
   change is the word `WardenDeck` becoming the word
   `WardenSurface` and nothing else. A two-line diff to a
   twelve-hundred-line screen is a diff somebody can read.

   The switch is here rather than in HostBar for a reason worth
   stating. HostBar is the strip across the *desk*: it carries the
   join address, the peer count and the activity ticker, and it is
   the one piece of chrome a Warden on a phone will never see,
   because `wphone` is `position: fixed; inset: 0` and covers it.
   Putting the "go back to the desk deck" control there would mean
   the only way out of the one-hand deck is a control the one-hand
   deck hides. So each surface carries the door to the other one.

   The detected case needs no door at all and does not get one: a
   Warden on a laptop never sees this chip, because nothing about
   a laptop matches the handheld query.
   ============================================================ */
import React from "react";
import WardenDeck from "./WardenDeck.jsx";
import WardenPhone from "./WardenPhone.jsx";
import useHandheld from "../ui/useHandheld.js";
import "../ui/wardenphone.css";

export default function WardenSurface({ g, net }) {
  const { handheld, shape, setShape, detected } = useHandheld();

  if (handheld) {
    return (
      <>
        <WardenPhone g={g} net={net} />
        <button
          type="button"
          className="wphone-swap"
          title="The full deck, with every tab"
          onClick={() => setShape("desk")}>
          Desk deck
        </button>
      </>
    );
  }

  return (
    <>
      <WardenDeck g={g} net={net} />
      {/* Only on a device the query recognised. A Warden who forced
          the desk deck on their phone gets one tap back; a Warden on
          a laptop is never offered a layout their screen does not
          want. */}
      {detected && shape !== "auto" && (
        <button
          type="button"
          className="wphone-swap is-desk"
          onClick={() => setShape("phone")}>
          One-hand deck
        </button>
      )}
    </>
  );
}
