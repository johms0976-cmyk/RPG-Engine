/* ============================================================
   IS THE DECK IN SOMEBODY'S HAND?

   `App.jsx` refuses to infer desk-versus-couch from the viewport,
   and the reasoning is sound: a 1080p television and a 1080p
   monitor are the same number of pixels and about two and a half
   metres apart, so guessing would be wrong half the time and
   silently. That argument is quoted here because this file does
   the opposite thing, and the difference is worth stating rather
   than letting the two look inconsistent.

   A phone is distinguishable. `pointer: coarse` says there is no
   mouse, and 620 CSS pixels says the viewport is roughly a
   handset in portrait. Together they have no common false
   positive with consequences: the thing they catch that is not a
   phone is a small tablet, which wants the one-hand deck anyway,
   and the thing they miss is a phone in landscape, which gets the
   desk deck and is merely cramped rather than wrong.

   And unlike the couch, being wrong here is visible in half a
   second and reversible in one tap. HostBar carries the switch.

   ------------------------------------------------------------
   THE OVERRIDE IS THREE-VALUED ON PURPOSE

   "auto" is not the same as "desk". A Warden who has never
   touched the switch should get the layout that fits whatever
   they pick the app up on next week, and a Warden who has
   deliberately chosen the desk deck on a phone — because they
   know where everything is and want it — should keep it when they
   rotate the handset. Collapsing those into a boolean loses the
   second one.
   ============================================================ */
import { useState, useEffect, useCallback } from "react";
import { settings as loadSettings, saveSettings } from "../engine/storage.js";

/** Narrow, and no mouse. See the header for why this pair and not
    either half of it. */
export const HANDHELD_QUERY = "(max-width: 620px) and (pointer: coarse)";

export const DECK_SHAPES = ["auto", "phone", "desk"];

/** SSR, jsdom without matchMedia, and a very old browser all land
    here. Desk is the right answer for all three: it is what the
    engine has always rendered, and a test that silently switched
    surface would be testing the wrong component. */
const probe = () => {
  try {
    return !!(typeof window !== "undefined" && window.matchMedia
      && window.matchMedia(HANDHELD_QUERY).matches);
  } catch { return false; }
};

/**
 * @returns {{handheld: boolean, shape: string, setShape: (s: string) => void, detected: boolean}}
 */
export function useHandheld() {
  const [shape, setShapeState] = useState(() => {
    const s = loadSettings().deckShape;
    return DECK_SHAPES.includes(s) ? s : "auto";
  });
  const [detected, setDetected] = useState(probe);

  /* Listened to rather than read once, because the case this is for
     is a Warden rotating the handset mid-session, and a layout that
     only re-decides on reload is one that gets it wrong for the
     rest of the evening. */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    let mq;
    try { mq = window.matchMedia(HANDHELD_QUERY); } catch { return undefined; }
    const on = () => setDetected(!!mq.matches);
    on();
    /* Safari below 14 has `addListener` and not `addEventListener`,
       and a Warden's phone is exactly the device most likely to be
       the old one somebody keeps for the table. */
    if (mq.addEventListener) mq.addEventListener("change", on);
    else if (mq.addListener) mq.addListener(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", on);
      else if (mq.removeListener) mq.removeListener(on);
    };
  }, []);

  const setShape = useCallback((next) => {
    const s = DECK_SHAPES.includes(next) ? next : "auto";
    setShapeState(s);
    saveSettings({ ...loadSettings(), deckShape: s });
  }, []);

  return {
    handheld: shape === "phone" || (shape === "auto" && detected),
    shape,
    setShape,
    detected,
  };
}

export default useHandheld;
