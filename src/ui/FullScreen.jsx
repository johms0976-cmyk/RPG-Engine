/* ============================================================
   FULL SCREEN — a view mode, not a modal.

   The difference matters. A modal is an interruption you dismiss
   to get back to the thing you were doing. This is the opposite:
   the player has chosen to *look at something properly*, and for
   the duration of that looking, the map or the artefact is the
   whole phone.

   Why it needs to exist at all: a 6-inch screen running a
   three-column play grid gives the map about 140px of height
   inside a drawer. That is enough to know a map exists and not
   enough to read one. Same for a handout — a scrap of paper with
   a door code on it is a prop, and props get held up to the face.

   Three rules:

     · It takes the whole viewport including under the notch, and
       hides everything else, so there is nothing to accidentally
       tap while pinching.
     · The way out is always in the same place and always the same
       size, because a player who cannot find the exit will lock
       their phone instead.
     · Escape, the back gesture and the hardware back button all
       close it. A view mode that traps you is a bug report.
   ============================================================ */
import React, { useEffect, useRef } from "react";

export default function FullScreen({ title, onClose, children, tone = "plain" }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose && onClose(); } };
    document.addEventListener("keydown", onKey, true);

    /* Android's back button and the iOS back-swipe both fire popstate.
       Pushing a history entry on open means the gesture every phone
       user already has closes the view instead of leaving the game. */
    const onPop = () => { onClose && onClose(); };
    window.history.pushState({ fullscreen: true }, "");
    window.addEventListener("popstate", onPop);

    const node = ref.current;
    if (node) node.focus();

    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("popstate", onPop);
      // Only unwind our own entry — if popstate is what closed us, the
      // browser has already done it.
      if (window.history.state && window.history.state.fullscreen) window.history.back();
    };
  }, [onClose]);

  return (
    <div className={`fs fs-${tone}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="fs-head">
        <h2>{title}</h2>
        <button type="button" className="fs-close" onClick={onClose} aria-label="Close and go back">
          Done
        </button>
      </header>
      <div className="fs-body" ref={ref} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
